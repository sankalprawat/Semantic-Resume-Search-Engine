from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ResumeUploadResponse(BaseModel):
    candidate_id: UUID
    candidate_name: str
    resume_id: UUID
    filename: str
    chunks_created: int
    is_scanned: bool
    page_count: int

    model_config = ConfigDict(from_attributes=True)


class BatchResumeUploadResponse(BaseModel):
    pool_id: UUID
    total_uploaded: int
    resumes: list[ResumeUploadResponse]


class CandidateListItem(BaseModel):
    id: UUID
    pool_id: UUID
    full_name: str
    email: str | None = None
    resume_id: UUID | None = None
    filename: str | None = None
    page_count: int = 1
    chunks_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
