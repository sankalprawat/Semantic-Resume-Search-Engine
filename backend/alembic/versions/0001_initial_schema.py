"""create talent engine schema with pgvector

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-11 21:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Create talent_pools table
    op.create_table(
        "talent_pools",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_talent_pools_id"), "talent_pools", ["id"], unique=False)

    # 3. Create candidates table
    op.create_table(
        "candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pool_id",
            UUID(as_uuid=True),
            sa.ForeignKey("talent_pools.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("headline", sa.String(length=500), nullable=True),
        sa.Column("raw_skills", JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_candidates_id"), "candidates", ["id"], unique=False)
    op.create_index(op.f("ix_candidates_pool_id"), "candidates", ["pool_id"], unique=False)

    # 4. Create resumes table
    op.create_table(
        "resumes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "candidate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("candidates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column(
            "is_scanned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_resumes_id"), "resumes", ["id"], unique=False)
    op.create_index(op.f("ix_resumes_candidate_id"), "resumes", ["candidate_id"], unique=False)

    # 5. Create resume_chunks table with Vector(768)
    op.create_table(
        "resume_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "resume_id",
            UUID(as_uuid=True),
            sa.ForeignKey("resumes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "candidate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("candidates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("bounding_boxes", JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("embedding", Vector(768), nullable=False),
    )
    op.create_index(op.f("ix_resume_chunks_id"), "resume_chunks", ["id"], unique=False)
    op.create_index(
        op.f("ix_resume_chunks_resume_id"),
        "resume_chunks",
        ["resume_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resume_chunks_candidate_id"),
        "resume_chunks",
        ["candidate_id"],
        unique=False,
    )
    op.create_index(
        "idx_resume_chunks_candidate_chunk",
        "resume_chunks",
        ["candidate_id", "chunk_index"],
        unique=False,
    )

    # HNSW Index with vector_cosine_ops, m=16, ef_construction=64
    op.execute("""
        CREATE INDEX idx_resume_chunks_embedding_hnsw
        ON resume_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    """)

    # 6. Create evaluations table
    op.create_table(
        "evaluations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pool_id",
            UUID(as_uuid=True),
            sa.ForeignKey("talent_pools.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("synthesis_markdown", sa.Text(), nullable=False),
        sa.Column("candidate_ids", JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_evaluations_id"), "evaluations", ["id"], unique=False)
    op.create_index(op.f("ix_evaluations_pool_id"), "evaluations", ["pool_id"], unique=False)

    # 7. Create evaluation_citations table
    op.create_table(
        "evaluation_citations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "evaluation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("evaluations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "candidate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("candidates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            UUID(as_uuid=True),
            sa.ForeignKey("resume_chunks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("citation_index", sa.Integer(), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("bounding_boxes", JSONB(astext_type=sa.Text()), nullable=False),
    )
    op.create_index(
        op.f("ix_evaluation_citations_id"),
        "evaluation_citations",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_evaluation_citations_evaluation_id"),
        "evaluation_citations",
        ["evaluation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("evaluation_citations")
    op.drop_table("evaluations")
    op.execute("DROP INDEX IF EXISTS idx_resume_chunks_embedding_hnsw;")
    op.drop_table("resume_chunks")
    op.drop_table("resumes")
    op.drop_table("candidates")
    op.drop_table("talent_pools")
