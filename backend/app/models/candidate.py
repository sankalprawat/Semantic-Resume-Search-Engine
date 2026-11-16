import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.chunk import ResumeChunk
    from app.models.pool import TalentPool
    from app.models.resume import Resume


class Candidate(Base):
    """
    Candidate entity representing an individual applicant profile extracted from resumes.
    """

    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    pool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("talent_pools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_skills: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    pool: Mapped["TalentPool"] = relationship("TalentPool", back_populates="candidates")
    resumes: Mapped[list["Resume"]] = relationship(
        "Resume",
        back_populates="candidate",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    chunks: Mapped[list["ResumeChunk"]] = relationship(
        "ResumeChunk",
        back_populates="candidate",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
