import asyncio
import json
import logging
import random
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID, uuid4

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.candidate import Candidate
from app.models.chunk import ResumeChunk
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
   - Your SOLE function is parsing, analyzing, comparing, ranking, and recommending candidates from their resumes against ANY hiring query or role suitability question (including internships, junior/senior engineering roles, full-stack/backend/frontend roles, or comparative candidate selection).
   - You MUST ALWAYS evaluate and compare the retrieved candidates whenever the query asks about candidate suitability, skills, experience, projects, internships, or hiring decisions — even if phrased casually or briefly.
   - Refuse ONLY clearly non-recruitment prompts completely unrelated to evaluating candidates (such as jokes, weather, general knowledge trivia, creative writing, or standalone coding tutorials). In that case ONLY, respond: "SemanticPin exclusively performs candidate resume parsing and comparative technical evaluations against retrieved resume evidence. Please provide a technical hiring requirement to evaluate candidate profiles."

2. FACTUAL GROUNDING & CITATION INTEGRITY:
   - You must evaluate candidates SOLELY based on the retrieved evidence provided in <context_chunks>.
   - Every single technical claim, metric, achievement, technology stack, and production responsibility MUST cite its exact source chunk using the format: [Candidate: <Name> | Chunk: <ID>] (e.g. [Candidate: Alice Smith | Chunk: C1]).
   - Write each chunk citation in its own bracket (e.g. [Candidate: Alice Smith | Chunk: C1] [Candidate: Alice Smith | Chunk: C2]), NEVER combine IDs like [Candidate: Alice Smith | Chunk: C1, C2].
   - ZERO-HALLUCINATION POLICY: Never invent past employers, job titles, years of experience, scale metrics, or technologies not explicitly written in the provided resume chunks.
   - UNVERIFIED CAPABILITIES: If a candidate has no evidence in the provided chunks for a requested skill or requirement, explicitly state that it is unverified or absent in their resume excerpts. Never assume or extrapolate.

3. COMPARATIVE RIGOR & CRITICAL CONTRAST:
   - Objectively contrast candidates on architectural depth, system scale handled, hands-on engineering contributions vs leadership, project experience, and concrete trade-offs.
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
            self._client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options=types.HttpOptions(
                    timeout=25_000,
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
        return self._client

    def _generation_config_for_model(
        self,
        model_name: str,
        temperature: float,
    ) -> types.GenerateContentConfig:
        # Non-lite 3.5/3.6 thinking models count internal reasoning tokens against
        # max_output_tokens; disabling thinking budget guarantees full synthesis output.
        if model_name in ("gemini-3.5-flash", "gemini-3.6-flash"):
            return types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=settings.MAX_OUTPUT_TOKENS,
                system_instruction=SEMANTICPIN_SYSTEM_INSTRUCTION,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            )
        return types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=settings.MAX_OUTPUT_TOKENS,
            system_instruction=SEMANTICPIN_SYSTEM_INSTRUCTION,
        )

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
                name_parts = cand_name.split()
                if name_parts:
                    retrieval_map[f"{name_parts[0].lower()}:{chunk_label.lower()}"] = chunk_data
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
   (e.g. [Candidate: Alice Smith | Chunk: C1]). Cite one chunk per bracket
   (e.g. [Candidate: Alice Smith | Chunk: C1] [Candidate: Alice Smith | Chunk: C2]),
   never comma-separated IDs inside one bracket.
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
        session: AsyncSession | None,
        pool_id: UUID,
        query: str,
        top_k: int = 15,
        min_similarity: float = 0.20,
        temperature: float = 0.20,
    ) -> AsyncGenerator[str, None]:
        """
        Asynchronous generator yielding Server-Sent Events (SSE) formatted data.
        Streams markdown tokens, runs anti-hallucination verification, persists the
        completed evaluation to PostgreSQL, and delivers final metadata.
        Uses short-lived DB sessions when `session` is None so no connection stays pinned
        during embedding calls or multi-second LLM streaming.
        """
        # 1. Vectorize query (external API) & retrieve relevant candidate chunks
        try:
            query_vector = await embedding_service.embed_text(query)
            if session is not None:
                candidates = await vector_store.semantic_search(
                    session=session,
                    pool_id=pool_id,
                    query_vector=query_vector,
                    top_k=top_k,
                    min_similarity=min_similarity,
                    max_per_candidate=settings.MAX_CHUNKS_PER_CANDIDATE,
                )
            else:
                async with AsyncSessionLocal() as db:
                    candidates = await vector_store.semantic_search(
                        session=db,
                        pool_id=pool_id,
                        query_vector=query_vector,
                        top_k=top_k,
                        min_similarity=min_similarity,
                        max_per_candidate=settings.MAX_CHUNKS_PER_CANDIDATE,
                    )
        except Exception as e:
            logger.error(f"Error retrieving candidate chunks: {e}", exc_info=True)
            err_event = {
                "type": "error",
                "message": "Unable to search candidate resumes right now. Please try again in a moment.",
            }
            yield f"data: {json.dumps(err_event)}\n\n"
            return

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

        # 3. Stream tokens from Gemini with model fallback, jittered backoff, and atomic fallback
        accumulated_tokens: list[str] = []
        fallback_list = (
            settings.COMPLETION_FALLBACK_MODELS
            if isinstance(settings.COMPLETION_FALLBACK_MODELS, list)
            else []
        )
        models_to_try = [settings.COMPLETION_MODEL] + [
            m for m in fallback_list if m != settings.COMPLETION_MODEL
        ]
        stream_succeeded = False
        last_error: Exception | None = None
        last_model_name = settings.COMPLETION_MODEL

        # Attempt 3a: Stream tokens with model fallback and jittered backoff
        for attempt, model_name in enumerate(models_to_try):
            last_model_name = model_name
            yield f"data: {json.dumps({'type': 'model', 'model': model_name})}\n\n"
            generation_config = self._generation_config_for_model(model_name, temperature)
            try:
                stream = await self.client.aio.models.generate_content_stream(
                    model=model_name,
                    contents=prompt,
                    config=generation_config,
                )
                async for chunk in stream:
                    token_text = chunk.text
                    if token_text:
                        accumulated_tokens.append(token_text)
                        event = {"type": "token", "content": token_text}
                        yield f"data: {json.dumps(event)}\n\n"
                if not accumulated_tokens:
                    raise ValueError(f"Empty stream returned from {model_name}")
                stream_succeeded = True
                break
            except Exception as e:
                last_error = e
                had_partial_tokens = bool(accumulated_tokens)
                if had_partial_tokens:
                    # Stream dropped mid-generation; reset partial buffer before retrying cleanly
                    accumulated_tokens.clear()
                    yield f"data: {json.dumps({'type': 'reset'})}\n\n"

                if attempt < len(models_to_try) - 1:
                    next_model = models_to_try[attempt + 1]
                    err_str = str(e)
                    # Quota exhausted (429) on one model should fail over quickly to next model
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        backoff = random.uniform(0.1, 0.3)
                    else:
                        backoff = (2 ** min(attempt, 2)) * 0.5 + random.uniform(0.2, 0.8)
                    logger.warning(
                        f"Transient Gemini stream error on {model_name} "
                        f"(partial={had_partial_tokens}, attempt {attempt + 1}): {e}. "
                        f"Falling back to {next_model} in {backoff:.2f}s..."
                    )
                    await asyncio.sleep(backoff)

        # Attempt 3b: Non-streaming atomic fallback if streaming dropped or hit 503 across models
        if not stream_succeeded:
            sync_models = list(reversed(models_to_try))
            for idx, model_name in enumerate(sync_models):
                last_model_name = model_name
                yield f"data: {json.dumps({'type': 'model', 'model': model_name})}\n\n"
                generation_config = self._generation_config_for_model(model_name, temperature)
                try:
                    logger.info(f"Trying non-streaming generate_content fallback on {model_name}...")
                    response = await self.client.aio.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=generation_config,
                    )
                    text = (response.text or "").strip()
                    if not text:
                        raise ValueError(f"Empty response from {model_name}")
                    accumulated_tokens = [text]
                    event = {"type": "token", "content": text}
                    yield f"data: {json.dumps(event)}\n\n"
                    stream_succeeded = True
                    break
                except Exception as e:
                    last_error = e
                    if idx < len(sync_models) - 1:
                        await asyncio.sleep(random.uniform(0.2, 0.6))

        if not stream_succeeded:
            logger.error(
                f"Error generating synthesis from Gemini ({last_model_name}): {last_error}",
                exc_info=last_error,
            )
            err_str = str(last_error or "")
            status_code = (
                getattr(last_error, "code", None)
                if isinstance(last_error, genai_errors.APIError)
                else None
            )
            if status_code == 503 or "503" in err_str or "UNAVAILABLE" in err_str:
                user_msg = (
                    "The AI evaluation model is experiencing temporary high demand. "
                    "Please retry in a few seconds."
                )
            elif status_code == 429 or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                user_msg = (
                    "AI service rate limit or quota reached. "
                    "Please wait a moment and try again."
                )
            else:
                user_msg = "Unable to complete AI evaluation right now. Please try again."

            err_event = {
                "type": "error",
                "message": user_msg,
            }
            yield f"data: {json.dumps(err_event)}\n\n"
            return

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

        cit_rows: list[EvaluationCitation] = []
        citation_dtos: list[CitationDetail] = []
        for v_cit in grounding_report.valid_citations:
            cit_id = uuid4()
            cit_rows.append(
                EvaluationCitation(
                    id=cit_id,
                    evaluation_id=eval_id,
                    candidate_id=v_cit.candidate_id,
                    chunk_id=v_cit.chunk_id,
                    citation_index=v_cit.citation_index,
                    source_text=v_cit.source_text,
                    page_number=v_cit.page_number,
                    bounding_boxes=v_cit.bounding_boxes,
                )
            )

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

        if session is not None:
            session.add(eval_row)
            if cit_rows:
                session.add_all(cit_rows)
            await session.commit()
        else:
            async with AsyncSessionLocal() as db:
                db.add(eval_row)
                if cit_rows:
                    db.add_all(cit_rows)
                await db.commit()

        # 6. Final Stream Event
        done_event = {
            "type": "done",
            "evaluation_id": str(eval_id),
            "grounding_score": grounding_report.grounding_score,
            "total_citations": grounding_report.total_citations,
            "citations": [c.model_dump(mode="json") for c in citation_dtos],
            "hallucinations_detected": len(grounding_report.hallucinated_citations),
            "model": last_model_name,
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    async def get_evaluation(
        self,
        session: AsyncSession,
        evaluation_id: UUID,
    ) -> EvaluationResponse | None:
        """Fetches a persisted evaluation with projected citations (no chunk vector hydration)."""
        eval_obj = (
            await session.execute(select(Evaluation).where(Evaluation.id == evaluation_id))
        ).scalar_one_or_none()
        if not eval_obj:
            return None

        cit_query = (
            select(
                EvaluationCitation.id,
                EvaluationCitation.citation_index,
                EvaluationCitation.candidate_id,
                func.coalesce(Candidate.full_name, "Candidate").label("candidate_name"),
                EvaluationCitation.chunk_id,
                func.coalesce(ResumeChunk.chunk_index, 0).label("chunk_index"),
                EvaluationCitation.page_number,
                EvaluationCitation.source_text,
                EvaluationCitation.bounding_boxes,
            )
            .outerjoin(Candidate, EvaluationCitation.candidate_id == Candidate.id)
            .outerjoin(ResumeChunk, EvaluationCitation.chunk_id == ResumeChunk.id)
            .where(EvaluationCitation.evaluation_id == evaluation_id)
            .order_by(EvaluationCitation.citation_index.asc())
        )
        cit_rows = (await session.execute(cit_query)).all()

        cit_dtos = [
            CitationDetail(
                id=row.id,
                citation_index=row.citation_index,
                candidate_id=row.candidate_id,
                candidate_name=row.candidate_name,
                chunk_id=row.chunk_id,
                chunk_index=row.chunk_index,
                page_number=row.page_number,
                source_text=row.source_text,
                bounding_boxes=row.bounding_boxes or [],
            )
            for row in cit_rows
        ]

        total_parsed = len(citation_verifier.parse_citations(eval_obj.synthesis_markdown))
        grounding_score = (
            round((len(cit_dtos) / total_parsed) * 100.0, 1)
            if total_parsed > 0
            else (100.0 if cit_dtos else 0.0)
        )

        return EvaluationResponse(
            id=eval_obj.id,
            pool_id=eval_obj.pool_id,
            query_text=eval_obj.query_text,
            synthesis_markdown=eval_obj.synthesis_markdown,
            candidate_ids=eval_obj.candidate_ids,
            citations=cit_dtos,
            grounding_score=grounding_score,
            created_at=eval_obj.created_at,
        )

    async def list_evaluations_for_pool(
        self,
        session: AsyncSession,
        pool_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[EvaluationListItem]:
        """Lists historical evaluations using SQL projections without hydrating citation JSONB."""
        paged_evals = (
            select(
                Evaluation.id,
                Evaluation.pool_id,
                Evaluation.query_text,
                func.left(Evaluation.synthesis_markdown, 201).label("synthesis_head"),
                func.jsonb_array_length(Evaluation.candidate_ids).label("candidate_count"),
                Evaluation.created_at,
            )
            .where(Evaluation.pool_id == pool_id)
            .order_by(Evaluation.created_at.desc())
            .limit(limit)
            .offset(offset)
            .cte("paged_evals")
        )

        citation_counts = (
            select(
                EvaluationCitation.evaluation_id,
                func.count(EvaluationCitation.id).label("citation_count"),
            )
            .where(EvaluationCitation.evaluation_id.in_(select(paged_evals.c.id)))
            .group_by(EvaluationCitation.evaluation_id)
            .subquery()
        )

        query = (
            select(
                paged_evals.c.id,
                paged_evals.c.pool_id,
                paged_evals.c.query_text,
                paged_evals.c.synthesis_head,
                paged_evals.c.candidate_count,
                func.coalesce(citation_counts.c.citation_count, 0).label("citation_count"),
                paged_evals.c.created_at,
            )
            .outerjoin(
                citation_counts,
                citation_counts.c.evaluation_id == paged_evals.c.id,
            )
            .order_by(paged_evals.c.created_at.desc())
        )

        rows = (await session.execute(query)).all()
        return [
            EvaluationListItem(
                id=row.id,
                pool_id=row.pool_id,
                query_text=row.query_text,
                synthesis_preview=(
                    row.synthesis_head[:200] + "..."
                    if len(row.synthesis_head) > 200
                    else row.synthesis_head
                ),
                candidate_count=row.candidate_count,
                citation_count=row.citation_count,
                created_at=row.created_at,
            )
            for row in rows
        ]


rag_orchestrator = GroundedRAGOrchestrator()
