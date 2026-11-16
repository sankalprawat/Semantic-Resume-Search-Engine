import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.evaluation import Evaluation


class TalentPool(Base):
    """
    TalentPool entity represents a recruitment requisition workspace.
    Groups candidate resumes, semantic indexes, and generated comparative evaluations.
    """

    __tablename__ = "talent_pools"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    # Relationships with CASCADE deletion
    candidates: Mapped[list["Candidate"]] = relationship(
        "Candidate",
        back_populates="pool",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    evaluations: Mapped[list["Evaluation"]] = relationship(
        "Evaluation",
        back_populates="pool",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
