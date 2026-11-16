from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EvaluationRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Natural language hiring requirement prompt")
    top_k: int = Field(
        15, ge=1, le=50, description="Maximum total chunks to retrieve across candidates"
    )
    min_similarity: float = Field(
        0.20, ge=0.0, le=1.0, description="Minimum cosine similarity cutoff"
    )
    temperature: float = Field(
        0.20, ge=0.0, le=1.0, description="Sampling temperature for deterministic grounding"
    )


class CitationDetail(BaseModel):
    id: UUID
    citation_index: int
    candidate_id: UUID
    candidate_name: str
    chunk_id: UUID
    chunk_index: int
    page_number: int
    source_text: str
    bounding_boxes: list[dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)


class EvaluationResponse(BaseModel):
    id: UUID
    pool_id: UUID
    query_text: str
    synthesis_markdown: str
    candidate_ids: list[str]
    citations: list[CitationDetail] = []
    grounding_score: float = 100.0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvaluationListItem(BaseModel):
    id: UUID
    pool_id: UUID
    query_text: str
    synthesis_preview: str
    candidate_count: int
    citation_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
