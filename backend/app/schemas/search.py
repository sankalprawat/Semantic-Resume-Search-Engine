from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SearchQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Natural language search prompt")
    top_k: int = Field(15, ge=1, le=50, description="Maximum total chunks to retrieve")
    min_similarity: float = Field(
        0.20, ge=0.0, le=1.0, description="Minimum cosine similarity cutoff"
    )


class SearchChunkResult(BaseModel):
    chunk_id: UUID
    chunk_index: int
    page_number: int
    text_content: str
    similarity_score: float
    bounding_boxes: list[dict[str, Any]]


class CandidateSearchResult(BaseModel):
    candidate_id: UUID
    full_name: str
    headline: str | None = None
    top_similarity: float
    matching_chunks: list[SearchChunkResult]


class SearchResponse(BaseModel):
    pool_id: UUID
    query: str
    total_candidates: int
    matches: list[CandidateSearchResult]
