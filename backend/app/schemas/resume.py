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
