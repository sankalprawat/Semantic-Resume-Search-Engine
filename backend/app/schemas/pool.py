from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TalentPoolBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Title of hiring requisition")
    description: str | None = Field(None, description="Detailed description of hiring requirements")


class TalentPoolCreate(TalentPoolBase):
    pass


class TalentPoolUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class TalentPoolResponse(TalentPoolBase):
    id: UUID
    candidate_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
