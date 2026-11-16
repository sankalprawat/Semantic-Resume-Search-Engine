import uuid
from typing import TYPE_CHECKING, Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.resume import Resume


class ResumeChunk(Base):
    """
    ResumeChunk entity stores granular sliding-window text segments with character
    bounding box coordinates and a 768-dimensional dense vector embedding.
    Indexed with HNSW (Hierarchical Navigable Small World) for sub-15ms cosine retrieval.
    """

    __tablename__ = "resume_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # List of normalized bounding boxes:
    # [{"x0": float, "y0": float, "x1": float, "y1": float, "text": str}]
    bounding_boxes: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )

    # 768-dimensional geometric semantic vector from Gemini embedding model
    embedding: Mapped[list[float]] = mapped_column(
        Vector(settings.EMBEDDING_DIMENSION),
        nullable=False,
    )

    # Relationships
    resume: Mapped["Resume"] = relationship("Resume", back_populates="chunks")
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="chunks")

    __table_args__ = (
        # HNSW Index for ultra-fast approximate cosine similarity search (<=> operator)
        Index(
            "idx_resume_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        # Compound index for candidate-level retrieval filtering
        Index(
            "idx_resume_chunks_candidate_chunk",
            "candidate_id",
            "chunk_index",
        ),
    )
