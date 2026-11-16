from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.evaluation import EvaluationListItem, EvaluationRequest, EvaluationResponse
from app.services.rag_engine import rag_orchestrator
from app.services.vector_store import vector_store

router = APIRouter()


@router.post("/{pool_id}/evaluate/stream")
async def stream_candidate_evaluation(
    pool_id: UUID,
    request: EvaluationRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Stream a multi-candidate comparative evaluation using Server-Sent Events (SSE).
    Pipeline:
    1. Cosine similarity retrieval with candidate diversity filtering.
    2. Builds multi-candidate context with delimiter isolation.
    3. Streams tokens in real time from gemini-4-hydrogen.
    4. Automatically verifies citations with CitationVerifier regex guardrail.
    5. Persists evaluation markdown and coordinate bounding boxes into PostgreSQL.
    """
    pool = await vector_store.get_pool(session=db, pool_id=pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )

    stream_generator = rag_orchestrator.stream_comparative_synthesis(
        session=db,
        pool_id=pool_id,
        query=request.query,
        top_k=request.top_k,
        min_similarity=request.min_similarity,
        temperature=request.temperature,
    )

    return StreamingResponse(
        stream_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{pool_id}/evaluations", response_model=list[EvaluationListItem])
async def list_pool_evaluations(
    pool_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[EvaluationListItem]:
    """List historical comparative evaluations generated for a talent pool."""
    pool = await vector_store.get_pool(session=db, pool_id=pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )
    return await rag_orchestrator.list_evaluations_for_pool(session=db, pool_id=pool_id)


@router.get("/{pool_id}/evaluations/{evaluation_id}", response_model=EvaluationResponse)
async def get_single_evaluation(
    pool_id: UUID,
    evaluation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> EvaluationResponse:
    """Fetch an evaluation and all its verified citations with PDF bounding box coordinates."""
    evaluation = await rag_orchestrator.get_evaluation(session=db, evaluation_id=evaluation_id)
    if not evaluation or evaluation.pool_id != pool_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation with id {evaluation_id} not found in pool {pool_id}",
        )
    return evaluation
