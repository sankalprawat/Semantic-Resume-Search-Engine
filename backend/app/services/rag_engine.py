import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID, uuid4

from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.evaluation import Evaluation, EvaluationCitation
from app.schemas.evaluation import CitationDetail, EvaluationListItem, EvaluationResponse
from app.schemas.search import CandidateSearchResult
from app.services.citation_verifier import citation_verifier
from app.services.embeddings import embedding_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

SEMANTICPIN_SYSTEM_INSTRUCTION = """You are the Senior Technical Hiring Principal and Grounded Talent Evaluator for SemanticPin.

PRIMARY DIRECTIVE & OPERATIONAL DOMAIN:
1. STRICT RESUME EVALUATION SCOPE:
   - Your SOLE function is parsing, analyzing, and synthesizing candidate resumes, engineering qualifications, and technical backgrounds against hiring mandates.
   - You MUST STRICTLY REFUSE any off-topic queries, conversational prompts, coding tutorials, creative writing, or general knowledge questions unrelated to evaluating candidate resumes.
   - If an off-topic or irrelevant prompt is received, immediately decline: "SemanticPin exclusively performs candidate resume parsing and comparative technical evaluations against retrieved resume evidence. Please provide a technical hiring requirement to evaluate candidate profiles."

2. FACTUAL GROUNDING & CITATION INTEGRITY:
   - You must evaluate candidates SOLELY based on the retrieved evidence provided in <context_chunks>.
   - Every single technical claim, metric, achievement, technology stack, and production responsibility MUST cite its exact source chunk using the format: [Candidate: <Name> | Chunk: <ID>] (e.g. [Candidate: Alice Smith | Chunk: C1]).
   - ZERO-HALLUCINATION POLICY: Never invent past employers, job titles, years of experience, scale metrics, or technologies not explicitly written in the provided resume chunks.
   - UNVERIFIED CAPABILITIES: If a candidate has no evidence in the provided chunks for a requested skill or requirement, explicitly state that it is unverified or absent in their resume excerpts. Never assume or extrapolate.

3. COMPARATIVE RIGOR & CRITICAL CONTRAST:
   - Objectively contrast candidates on architectural depth, system scale handled, hands-on engineering contributions vs high-level leadership, and concrete production trade-offs.
   - Maintain an executive, analytical, and highly structured tone.
"""


class GroundedRAGOrchestrator:
    """
    Orchestrates grounded comparative candidate evaluations using Gemini.
    - Constructs multi-candidate prompts with explicit chunk delimiters.
    - Streams tokens in real time over HTTP Server-Sent Events (SSE).
    - Runs anti-hallucination regex verification on citations.
    - Persists evaluation briefs and verified citation coordinates to PostgreSQL.
    """

    def __init__(self) -> None:
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is not configured in settings or .env")
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def _build_context_and_mapping(
        self,
        candidates: list[CandidateSearchResult],
    ) -> tuple[str, dict[str, dict[str, Any]]]:
        """
        Builds the delimited context string for the prompt and a normalized lookup map
        for citation verification.
        """
        context_snippets: list[str] = []
        retrieval_map: dict[str, dict[str, Any]] = {}
        global_chunk_idx = 1

        for cand in candidates:
            cand_name = cand.full_name
            cand_id = cand.candidate_id

            for chunk in cand.matching_chunks:
                chunk_label = f"C{global_chunk_idx}"
                snippet = (
                    f"[{chunk_label} | Candidate: {cand_name} (Page {chunk.page_number})]:\n"
                    f"{chunk.text_content.strip()}"
                )
                context_snippets.append(snippet)

                chunk_data = {
                    "candidate_id": cand_id,
                    "candidate_name": cand_name,
                    "chunk_id": chunk.chunk_id,
                    "chunk_index": chunk.chunk_index,
                    "page_number": chunk.page_number,
                    "text_content": chunk.text_content,
                    "bounding_boxes": chunk.bounding_boxes,
                }

                # Register multiple lookup aliases for resilient verification
                retrieval_map[chunk_label.lower()] = chunk_data
                retrieval_map[f"{cand_name.lower()}:{chunk_label.lower()}"] = chunk_data
                first_name = cand_name.split()[0].lower()
                retrieval_map[f"{first_name}:{chunk_label.lower()}"] = chunk_data
                retrieval_map[str(chunk.chunk_id)] = chunk_data

                global_chunk_idx += 1

        return "\n\n".join(context_snippets), retrieval_map

    def _build_prompt(self, query: str, context_text: str) -> str:
        return f"""You are the Lead Systems Architect and Executive Technical Hiring Evaluator
for SemanticPin. Your objective is to produce a grounded, critical, comparative candidate
evaluation assessing multiple engineers side-by-side against a specific hiring mandate.

### RECRUITER HIRING REQUIREMENT:
"{query}"

### RETRIEVED CANDIDATE RESUME EVIDENCE:
<context_chunks>
{context_text}
</context_chunks>

### NON-NEGOTIABLE GROUNDING & CITATION RULES:
1. Grounding Rule: You MUST ONLY evaluate candidates based strictly on evidence in <context_chunks>.
2. Bracketed Citations: EVERY factual statement, achievement, or technical capability MUST cite
   its source chunk in the exact format: [Candidate: <Name> | Chunk: <ID>]
   (e.g. [Candidate: Alice Smith | Chunk: C1]).
3. Zero Hallucination: Do not invent employers, scale metrics, or technologies not stated in
   the evidence. If an area is not covered in their resume chunks, state it as unverified.
4. Critical Side-by-Side Contrast: Contrast candidate architectural maturity, scale, language depth,
   and specific trade-offs.

### OUTPUT FORMAT (GitHub-Flavored Markdown):
- ### Executive Summary Matrix (A markdown table: Candidate, Stack, Scale Handled, Top Match Reason)
- ### Comparative Architectural Analysis (Detailed multi-paragraph breakdown with citations)
- ### Final Hiring Recommendation & Ranking (Numbered ranking 1..N with strengths & risks)
"""

    async def stream_comparative_synthesis(
        self,
        session: AsyncSession,
        pool_id: UUID,
        query: str,
        top_k: int = 15,
        min_similarity: float = 0.20,
        temperature: float = 0.20,
    ) -> AsyncGenerator[str, None]:
        """
        Asynchronous generator yielding Server-Sent Events (SSE) formatted data.
        Streams markdown tokens, runs anti-hallucination verification, persists the
        completed evaluation to Supabase, and delivers final metadata.
        """
        # 1. Vectorize query & retrieve relevant candidate chunks
        query_vector = await embedding_service.embed_text(query)
        candidates = await vector_store.semantic_search(
            session=session,
            pool_id=pool_id,
            query_vector=query_vector,
            top_k=top_k,
            min_similarity=min_similarity,
            max_per_candidate=settings.MAX_CHUNKS_PER_CANDIDATE,
        )

        if not candidates:
            no_match_event = {
                "type": "error",
                "message": (
                    "No candidates in this talent pool met the minimum similarity threshold."
                ),
            }
            yield f"data: {json.dumps(no_match_event)}\n\n"
            return

        # 2. Build structured context and mapping
        context_text, retrieval_map = self._build_context_and_mapping(candidates)
        prompt = self._build_prompt(query, context_text)

        # 3. Stream tokens from Gemini with transient error backoff
        generation_config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=settings.MAX_OUTPUT_TOKENS,
            system_instruction=SEMANTICPIN_SYSTEM_INSTRUCTION,
        )

        accumulated_tokens: list[str] = []
        max_stream_retries = 3
        for attempt in range(max_stream_retries + 1):
            try:
                stream = await self.client.aio.models.generate_content_stream(
                    model=settings.COMPLETION_MODEL,
                    contents=prompt,
                    config=generation_config,
                )
                async for chunk in stream:
                    token_text = chunk.text
                    if token_text:
                        accumulated_tokens.append(token_text)
                        event = {"type": "token", "content": token_text}
                        yield f"data: {json.dumps(event)}\n\n"
                break
            except Exception as e:
                # If tokens were already sent to client or retries exhausted, deliver error event
                if accumulated_tokens or attempt == max_stream_retries:
                    logger.error(f"Error streaming from Gemini: {e}", exc_info=True)
                    err_event = {
                        "type": "error",
                        "message": f"LLM generation error: {str(e)}",
                    }
                    yield f"data: {json.dumps(err_event)}\n\n"
                    return

                backoff = (2**attempt) * 1.5
                logger.warning(
                    f"Transient Gemini stream error (attempt {attempt + 1}): "
                    f"{e}. Retrying in {backoff:.1f}s..."
                )
                await asyncio.sleep(backoff)

        full_synthesis = "".join(accumulated_tokens).strip()

        # 4. Anti-Hallucination Verification
        grounding_report = citation_verifier.verify_synthesis(full_synthesis, retrieval_map)

        # 5. Persist Evaluation and Citations in PostgreSQL
        eval_id = uuid4()
        eval_row = Evaluation(
            id=eval_id,
            pool_id=pool_id,
            query_text=query,
            synthesis_markdown=full_synthesis,
            candidate_ids=[str(c.candidate_id) for c in candidates],
        )
        session.add(eval_row)

        citation_dtos: list[CitationDetail] = []
        for v_cit in grounding_report.valid_citations:
            cit_id = uuid4()
            cit_row = EvaluationCitation(
                id=cit_id,
                evaluation_id=eval_id,
                candidate_id=v_cit.candidate_id,
                chunk_id=v_cit.chunk_id,
                citation_index=v_cit.citation_index,
                source_text=v_cit.source_text,
                page_number=v_cit.page_number,
                bounding_boxes=v_cit.bounding_boxes,
            )
            session.add(cit_row)

            citation_dtos.append(
                CitationDetail(
                    id=cit_id,
                    citation_index=v_cit.citation_index,
                    candidate_id=v_cit.candidate_id,
                    candidate_name=v_cit.candidate_name,
                    chunk_id=v_cit.chunk_id,
                    chunk_index=v_cit.chunk_index,
                    page_number=v_cit.page_number,
                    source_text=v_cit.source_text,
                    bounding_boxes=v_cit.bounding_boxes,
                )
            )

        await session.commit()

        # 6. Final Stream Event
        done_event = {
            "type": "done",
            "evaluation_id": str(eval_id),
            "grounding_score": grounding_report.grounding_score,
            "total_citations": grounding_report.total_citations,
            "citations": [c.model_dump(mode="json") for c in citation_dtos],
            "hallucinations_detected": len(grounding_report.hallucinated_citations),
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    async def get_evaluation(
        self,
        session: AsyncSession,
        evaluation_id: UUID,
    ) -> EvaluationResponse | None:
        """Fetches a persisted evaluation with its citations."""
        query = (
            select(Evaluation)
            .where(Evaluation.id == evaluation_id)
            .options(
                selectinload(Evaluation.citations).selectinload(EvaluationCitation.candidate),
                selectinload(Evaluation.citations).selectinload(EvaluationCitation.chunk),
            )
        )
        res = await session.execute(query)
        eval_obj = res.scalar_one_or_none()
        if not eval_obj:
            return None

        cit_dtos = [
            CitationDetail(
                id=c.id,
                citation_index=c.citation_index,
                candidate_id=c.candidate_id,
                candidate_name=c.candidate.full_name if c.candidate else "Candidate",
                chunk_id=c.chunk_id,
                chunk_index=c.chunk.chunk_index if c.chunk else 0,
                page_number=c.page_number,
                source_text=c.source_text,
                bounding_boxes=c.bounding_boxes or [],
            )
            for c in eval_obj.citations
        ]

        return EvaluationResponse(
            id=eval_obj.id,
            pool_id=eval_obj.pool_id,
            query_text=eval_obj.query_text,
            synthesis_markdown=eval_obj.synthesis_markdown,
            candidate_ids=eval_obj.candidate_ids,
            citations=cit_dtos,
            grounding_score=100.0,
            created_at=eval_obj.created_at,
        )

    async def list_evaluations_for_pool(
        self,
        session: AsyncSession,
        pool_id: UUID,
    ) -> list[EvaluationListItem]:
        """Lists previous evaluations generated for a talent pool."""
        query = (
            select(Evaluation)
            .where(Evaluation.id == Evaluation.id)
            .where(Evaluation.pool_id == pool_id)
            .order_by(Evaluation.created_at.desc())
        )
        res = await session.execute(query)
        evals = res.scalars().all()

        return [
            EvaluationListItem(
                id=e.id,
                pool_id=e.pool_id,
                query_text=e.query_text,
                synthesis_preview=e.synthesis_markdown[:200] + "..."
                if len(e.synthesis_markdown) > 200
                else e.synthesis_markdown,
                candidate_count=len(e.candidate_ids),
                citation_count=len(e.citations) if e.citations else 0,
                created_at=e.created_at,
            )
            for e in evals
        ]


rag_orchestrator = GroundedRAGOrchestrator()
