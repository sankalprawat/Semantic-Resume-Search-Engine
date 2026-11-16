from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.schemas.search import SearchQueryRequest, SearchResponse
from app.services.embeddings import embedding_service
from app.services.vector_store import vector_store

router = APIRouter()


@router.post("/{pool_id}/search", response_model=SearchResponse)
async def semantic_search_pool(
    pool_id: UUID,
    request: SearchQueryRequest,
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """
    Execute a natural language semantic query across all candidate resumes in a talent pool.
    Pipeline:
    1. Vectorizes query string into 768-dim manifold using gemini-embedding-2.
    2. Executes HNSW cosine distance search (<=>) on Supabase PostgreSQL.
    3. Enforces candidate diversity windowing (max 3 chunks per candidate).
    4. Returns ranked candidates with citation coordinate bounding boxes for UI highlights.
    """
    pool = await vector_store.get_pool(session=db, pool_id=pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )

    # 1. Embed query into vector space
    query_vector = await embedding_service.embed_text(request.query)

    # 2. Run vector search with diversity cap
    matches = await vector_store.semantic_search(
        session=db,
        pool_id=pool_id,
        query_vector=query_vector,
        top_k=request.top_k,
        min_similarity=request.min_similarity,
        max_per_candidate=settings.MAX_CHUNKS_PER_CANDIDATE,
    )

    return SearchResponse(
        pool_id=pool_id,
        query=request.query,
        total_candidates=len(matches),
        matches=matches,
    )
