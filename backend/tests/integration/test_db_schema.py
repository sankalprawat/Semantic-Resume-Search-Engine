import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


@pytest.mark.asyncio
async def test_database_tables_exist(test_engine: AsyncEngine):
    """Verify that all core tables exist in the public schema."""
    async with test_engine.connect() as conn:
        res = await conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
        )
        tables = {r[0] for r in res.fetchall()}

        expected_tables = {
            "alembic_version",
            "talent_pools",
            "candidates",
            "resumes",
            "resume_chunks",
            "evaluations",
            "evaluation_citations",
        }
        assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"


@pytest.mark.asyncio
async def test_hnsw_index_exists(test_engine: AsyncEngine):
    """Verify that the HNSW cosine index is active on resume_chunks.embedding."""
    async with test_engine.connect() as conn:
        res = await conn.execute(
            text(
                "SELECT indexname, indexdef FROM pg_indexes "
                "WHERE schemaname = 'public' AND tablename = 'resume_chunks';"
            )
        )
        indexes = {r[0]: r[1] for r in res.fetchall()}
        assert "idx_resume_chunks_embedding_hnsw" in indexes
        defn = indexes["idx_resume_chunks_embedding_hnsw"]
        assert "hnsw" in defn.lower()
        assert "vector_cosine_ops" in defn.lower()
