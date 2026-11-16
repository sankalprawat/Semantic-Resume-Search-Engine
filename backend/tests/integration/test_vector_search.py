from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.chunking import ChunkResult
from app.services.embeddings import embedding_service
from app.services.vector_store import vector_store


@pytest.mark.asyncio
async def test_semantic_search_with_diversity_cap(test_session: AsyncSession):
    """
    Integration test verifying:
    1. Real embedding generation using gemini-embedding-2.
    2. Real HNSW cosine similarity search on Supabase PostgreSQL.
    3. Correct candidate ranking (Kafka engineer vs React engineer).
    4. Candidate diversity cap (no more than 3 chunks per candidate).
    5. Cleanup via cascading deletes.
    """
    # 1. Create a test talent pool
    pool = await vector_store.create_pool(
        session=test_session,
        title=f"Test Sourcing Pool {uuid4().hex[:6]}",
        description="Testing cosine retrieval and candidate diversity",
    )

    try:
        # 2. Setup Candidate A (Distributed Systems / Kafka - 4 chunks)
        alice_chunks_text = [
            "Architected distributed event-driven microservices using Apache Kafka and RabbitMQ.",
            (
                "Implemented high-throughput messaging pipelines handling 1,000,000 events/sec"
                " with zero loss."
            ),
            (
                "Managed PostgreSQL database replication and failover across multiple AWS"
                " availability zones."
            ),
            "Optimized Kafka consumer group rebalances under high partition skew.",
        ]
        alice_chunks = [
            ChunkResult(
                chunk_index=i,
                page_number=1,
                text_content=t,
                token_count=20,
                bounding_boxes=[{"x0": 0.1, "y0": 0.1 * i, "x1": 0.9, "y1": 0.1 * i + 0.05}],
            )
            for i, t in enumerate(alice_chunks_text)
        ]
        alice_embeddings = await embedding_service.embed_texts_batch(alice_chunks_text)

        await vector_store.save_candidate_and_resume(
            session=test_session,
            pool_id=pool.id,
            candidate_name="Alice Distributed",
            filename="alice_resume.pdf",
            file_path="/tmp/alice.pdf",
            file_size_bytes=1024,
            page_count=1,
            raw_text="\n".join(alice_chunks_text),
            is_scanned=False,
            chunks=alice_chunks,
            embeddings=alice_embeddings,
        )

        # 3. Setup Candidate B (Frontend / UI - 2 chunks)
        bob_chunks_text = [
            "Designed modern responsive web user interfaces using React, Next.js and Tailwind CSS.",
            (
                "Implemented state management with Zustand and built accessible component"
                " libraries with shadcn/ui."
            ),
        ]
        bob_chunks = [
            ChunkResult(
                chunk_index=i,
                page_number=1,
                text_content=t,
                token_count=18,
                bounding_boxes=[{"x0": 0.1, "y0": 0.2 * i, "x1": 0.9, "y1": 0.2 * i + 0.05}],
            )
            for i, t in enumerate(bob_chunks_text)
        ]
        bob_embeddings = await embedding_service.embed_texts_batch(bob_chunks_text)

        await vector_store.save_candidate_and_resume(
            session=test_session,
            pool_id=pool.id,
            candidate_name="Bob Frontend",
            filename="bob_resume.pdf",
            file_path="/tmp/bob.pdf",
            file_size_bytes=1024,
            page_count=1,
            raw_text="\n".join(bob_chunks_text),
            is_scanned=False,
            chunks=bob_chunks,
            embeddings=bob_embeddings,
        )

        # 4. Execute query: "Kafka distributed event streaming pipelines"
        query = "Kafka distributed event streaming pipelines"
        query_vector = await embedding_service.embed_text(query)

        results = await vector_store.semantic_search(
            session=test_session,
            pool_id=pool.id,
            query_vector=query_vector,
            top_k=10,
            min_similarity=0.25,
            max_per_candidate=3,
        )

        assert len(results) >= 1
        # Alice MUST be the top candidate for a Kafka query
        top_match = results[0]
        assert top_match.full_name == "Alice Distributed"
        assert top_match.top_similarity > 0.40

        # Verify candidate diversity cap:
        # Alice had 4 chunks, but should have at most 3 matching chunks in the returned result!
        assert len(top_match.matching_chunks) <= 3
        assert len(top_match.matching_chunks) > 0

    finally:
        # Clean up test pool
        await vector_store.delete_pool(session=test_session, pool_id=pool.id)
