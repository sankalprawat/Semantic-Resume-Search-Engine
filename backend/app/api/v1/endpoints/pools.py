from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.pool import TalentPoolCreate, TalentPoolResponse
from app.schemas.resume import CandidateListItem
from app.services.sample_seeder import seed_or_get_sample_pool
from app.services.vector_store import vector_store

router = APIRouter()


@router.post("/seed-sample", response_model=TalentPoolResponse, status_code=status.HTTP_200_OK)
async def seed_sample_talent_pool(
    db: AsyncSession = Depends(get_db),
) -> TalentPoolResponse:
    """
    Idempotently creates or returns a pre-populated talent pool with 3
    pre-indexed sample candidate resumes (Alice Vance, Bob Chen, Carol Rodriguez)
    with genuine PDF text, bounding box coordinates, and 768-dim embeddings.
    """
    return await seed_or_get_sample_pool(session=db)


@router.post("", response_model=TalentPoolResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TalentPoolResponse, status_code=status.HTTP_201_CREATED)
async def create_talent_pool(
    pool_in: TalentPoolCreate,
    db: AsyncSession = Depends(get_db),
) -> TalentPoolResponse:
    """Create a new hiring requisition talent pool workspace."""
    pool = await vector_store.create_pool(
        session=db,
        title=pool_in.title,
        description=pool_in.description,
    )
    return TalentPoolResponse(
        id=pool.id,
        title=pool.title,
        description=pool.description,
        candidate_count=0,
        created_at=pool.created_at,
        updated_at=pool.updated_at,
    )


@router.get("", response_model=list[TalentPoolResponse])
@router.get("/", response_model=list[TalentPoolResponse])
async def list_talent_pools(
    db: AsyncSession = Depends(get_db),
) -> list[TalentPoolResponse]:
    """List all hiring requisition pools with candidate counts."""
    pools = await vector_store.list_pools(session=db)
    return [TalentPoolResponse(**p) for p in pools]


@router.get("/{pool_id}", response_model=TalentPoolResponse)
async def get_talent_pool(
    pool_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> TalentPoolResponse:
    """Fetch details of a single talent pool."""
    pool = await vector_store.get_pool(session=db, pool_id=pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )
    return TalentPoolResponse(
        id=pool.id,
        title=pool.title,
        description=pool.description,
        candidate_count=len(pool.candidates) if pool.candidates else 0,
        created_at=pool.created_at,
        updated_at=pool.updated_at,
    )


@router.get("/{pool_id}/candidates", response_model=list[CandidateListItem])
async def list_pool_candidates(
    pool_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[CandidateListItem]:
    """Fetch all candidates and their resume details within a talent pool."""
    pool = await vector_store.get_pool(session=db, pool_id=pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )
    return await vector_store.list_candidates_for_pool(session=db, pool_id=pool_id)


@router.delete("/{pool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_talent_pool(
    pool_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a talent pool and cascade-delete all candidates, resumes, and vector chunks."""
    deleted = await vector_store.delete_pool(session=db, pool_id=pool_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )
