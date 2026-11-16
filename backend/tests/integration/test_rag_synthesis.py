import json
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.chunking import ChunkResult
from app.services.embeddings import embedding_service
from app.services.rag_engine import rag_orchestrator
from app.services.vector_store import vector_store


@pytest.mark.asyncio
async def test_live_grounded_rag_stream(test_session: AsyncSession):
    """
    Live integration test verifying:
    1. Multi-candidate RAG prompt construction.
    2. Real-time streaming from gemini-4-hydrogen.
    3. Citation generation and verification with CitationVerifier.
    4. Database persistence into evaluations & evaluation_citations.
    """
    # 1. Create a test talent pool
    pool = await vector_store.create_pool(
        session=test_session,
        title=f"RAG Synthesis Pool {uuid4().hex[:6]}",
        description="Testing comparative synthesis and citation grounding",
    )

    try:
        # Candidate 1: Alice (Kafka / Distributed Streams)
        alice_text = [
            "Architected Apache Kafka pipelines processing 500,000 events/sec without loss.",
            "Led incident management and designed automated consumer rebalancing strategies.",
        ]
        alice_chunks = [
            ChunkResult(
                chunk_index=i,
                page_number=1,
                text_content=t,
                token_count=20,
                bounding_boxes=[
                    {"x0": 0.1, "y0": 0.1 * (i + 1), "x1": 0.8, "y1": 0.1 * (i + 1) + 0.04}
                ],
            )
            for i, t in enumerate(alice_text)
        ]
        alice_embeddings = await embedding_service.embed_texts_batch(alice_text)
        await vector_store.save_candidate_and_resume(
            session=test_session,
            pool_id=pool.id,
            candidate_name="Alice Architect",
            filename="alice_resume.pdf",
            file_path="/tmp/alice.pdf",
            file_size_bytes=1024,
            page_count=1,
            raw_text="\n".join(alice_text),
            is_scanned=False,
            chunks=alice_chunks,
            embeddings=alice_embeddings,
        )

        # Candidate 2: Bob (CockroachDB / Database Clustering)
        bob_text = [
            "Re-architected monolithic SQL database into CockroachDB clusters with zero downtime.",
            "Implemented Raft consensus replication and fine-tuned transaction isolation levels.",
        ]
        bob_chunks = [
            ChunkResult(
                chunk_index=i,
                page_number=2,
                text_content=t,
                token_count=20,
                bounding_boxes=[
                    {"x0": 0.15, "y0": 0.2 * (i + 1), "x1": 0.85, "y1": 0.2 * (i + 1) + 0.04}
                ],
            )
            for i, t in enumerate(bob_text)
        ]
        bob_embeddings = await embedding_service.embed_texts_batch(bob_text)
        await vector_store.save_candidate_and_resume(
            session=test_session,
            pool_id=pool.id,
            candidate_name="Bob Database",
            filename="bob_resume.pdf",
            file_path="/tmp/bob.pdf",
            file_size_bytes=1024,
            page_count=2,
            raw_text="\n".join(bob_text),
            is_scanned=False,
            chunks=bob_chunks,
            embeddings=bob_embeddings,
        )

        # 2. Run stream_comparative_synthesis
        query = (
            "Compare candidates with high-throughput event streaming or distributed DB clustering."
        )
        stream = rag_orchestrator.stream_comparative_synthesis(
            session=test_session,
            pool_id=pool.id,
            query=query,
            top_k=5,
            min_similarity=0.20,
            temperature=0.20,
        )

        tokens: list[str] = []
        done_payload: dict = {}
        error_payload: dict = {}

        async for sse_line in stream:
            # Lines are formatted as 'data: {...}\n\n'
            raw = sse_line.strip()
            if raw.startswith("data: "):
                data = json.loads(raw[6:])
                if data.get("type") == "token":
                    tokens.append(data["content"])
                elif data.get("type") == "done":
                    done_payload = data
                elif data.get("type") == "error":
                    error_payload = data

        assert not error_payload, f"RAG stream returned error: {error_payload.get('message')}"

        full_output = "".join(tokens)
        assert len(full_output) > 100
        assert "Alice" in full_output
        assert "Bob" in full_output

        # Verify done payload
        assert "evaluation_id" in done_payload
        eval_id = done_payload["evaluation_id"]
        assert done_payload["grounding_score"] >= 75.0
        assert done_payload["total_citations"] >= 2
        assert len(done_payload["citations"]) >= 2

        # 3. Verify Database Persistence
        persisted_eval = await rag_orchestrator.get_evaluation(
            session=test_session,
            evaluation_id=uuid4() if not eval_id else uuid4().__class__(eval_id),
        )
        assert persisted_eval is not None
        assert persisted_eval.query_text == query
        assert len(persisted_eval.citations) >= 2
        assert any(c.candidate_name == "Alice Architect" for c in persisted_eval.citations)
        assert any(c.candidate_name == "Bob Database" for c in persisted_eval.citations)

    finally:
        # Cleanup
        await vector_store.delete_pool(session=test_session, pool_id=pool.id)
