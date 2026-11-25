import json
import logging
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.chunk import ResumeChunk
from app.models.pool import TalentPool
from app.models.resume import Resume
from app.schemas.resume import CandidateListItem
from app.schemas.search import CandidateSearchResult, SearchChunkResult
from app.services.chunking import ChunkResult

logger = logging.getLogger(__name__)


class VectorStoreService:
    """
    Persistence and vector similarity retrieval service backed by PostgreSQL + pgvector.
    Enforces referential integrity, cascading deletes, and candidate diversity filtering.
    """

    def __init__(self) -> None:
        self._supports_iterative_scan: bool | None = None

    async def create_pool(
        self,
        session: AsyncSession,
        title: str,
        description: str | None = None,
    ) -> TalentPool:
        pool = TalentPool(title=title, description=description)
        session.add(pool)
        await session.commit()
        await session.refresh(pool)
        return pool

    async def list_pools(
        self,
        session: AsyncSession,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        query = (
            select(
                TalentPool.id,
                TalentPool.title,
                TalentPool.description,
                TalentPool.created_at,
                TalentPool.updated_at,
                func.count(Candidate.id).label("candidate_count"),
            )
            .outerjoin(Candidate, TalentPool.id == Candidate.pool_id)
            .group_by(TalentPool.id)
            .order_by(TalentPool.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(query)
        rows = result.all()
        return [
            {
                "id": row.id,
                "title": row.title,
                "description": row.description,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "candidate_count": row.candidate_count,
            }
            for row in rows
        ]

    async def pool_exists(
        self,
        session: AsyncSession,
        pool_id: UUID,
    ) -> bool:
        res = await session.execute(select(TalentPool.id).where(TalentPool.id == pool_id))
        return res.scalar_one_or_none() is not None

    async def get_pool(
        self,
        session: AsyncSession,
        pool_id: UUID,
        include_candidates: bool = False,
    ) -> TalentPool | None:
        query = select(TalentPool).where(TalentPool.id == pool_id)
        if include_candidates:
            query = query.options(selectinload(TalentPool.candidates))
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def get_pool_with_count(
        self,
        session: AsyncSession,
        pool_id: UUID,
    ) -> dict[str, Any] | None:
        query = (
            select(
                TalentPool.id,
                TalentPool.title,
                TalentPool.description,
                TalentPool.created_at,
                TalentPool.updated_at,
                func.count(Candidate.id).label("candidate_count"),
            )
            .outerjoin(Candidate, TalentPool.id == Candidate.pool_id)
            .where(TalentPool.id == pool_id)
            .group_by(TalentPool.id)
        )
        row = (await session.execute(query)).first()
        if not row:
            return None
        return {
            "id": row.id,
            "title": row.title,
            "description": row.description,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "candidate_count": row.candidate_count,
        }

    async def list_candidates_for_pool(
        self,
        session: AsyncSession,
        pool_id: UUID,
        limit: int = 200,
        offset: int = 0,
    ) -> list[CandidateListItem]:
        """Lists candidates within a talent pool using aggregate SQL projections."""
        paged_candidates = (
            select(
                Candidate.id,
                Candidate.pool_id,
                Candidate.full_name,
                Candidate.email,
                Candidate.created_at,
            )
            .where(Candidate.pool_id == pool_id)
            .order_by(Candidate.created_at.desc())
            .limit(limit)
            .offset(offset)
            .cte("paged_candidates")
        )

        chunk_counts = (
            select(
                ResumeChunk.candidate_id,
                func.count(ResumeChunk.id).label("chunks_count"),
            )
            .where(ResumeChunk.candidate_id.in_(select(paged_candidates.c.id)))
            .group_by(ResumeChunk.candidate_id)
            .subquery()
        )

        latest_resume = (
            select(
                Resume.id.label("resume_id"),
                Resume.candidate_id,
                Resume.filename,
                Resume.page_count,
                func.row_number()
                .over(
                    partition_by=Resume.candidate_id,
                    order_by=Resume.created_at.desc(),
                )
                .label("rn"),
            )
            .where(Resume.candidate_id.in_(select(paged_candidates.c.id)))
            .subquery()
        )

        query = (
            select(
                paged_candidates.c.id,
                paged_candidates.c.pool_id,
                paged_candidates.c.full_name,
                paged_candidates.c.email,
                paged_candidates.c.created_at,
                latest_resume.c.resume_id,
                latest_resume.c.filename,
                func.coalesce(latest_resume.c.page_count, 1).label("page_count"),
                func.coalesce(chunk_counts.c.chunks_count, 0).label("chunks_count"),
            )
            .outerjoin(
                latest_resume,
                and_(
                    latest_resume.c.candidate_id == paged_candidates.c.id,
                    latest_resume.c.rn == 1,
                ),
            )
            .outerjoin(
                chunk_counts,
                chunk_counts.c.candidate_id == paged_candidates.c.id,
            )
            .order_by(paged_candidates.c.created_at.desc())
        )

        rows = (await session.execute(query)).all()
        return [
            CandidateListItem(
                id=row.id,
                pool_id=row.pool_id,
                full_name=row.full_name,
                email=row.email,
                resume_id=row.resume_id,
                filename=row.filename,
                page_count=row.page_count,
                chunks_count=row.chunks_count,
                created_at=row.created_at,
            )
            for row in rows
        ]

    async def get_candidate_resume(
        self,
        session: AsyncSession,
        candidate_id: UUID,
    ) -> Resume | None:
        """Retrieves the latest resume for a candidate."""
        query = (
            select(Resume)
            .where(Resume.candidate_id == candidate_id)
            .order_by(Resume.created_at.desc())
            .limit(1)
        )
        res = await session.execute(query)
        return res.scalar_one_or_none()

    async def delete_pool(
        self,
        session: AsyncSession,
        pool_id: UUID,
    ) -> bool:
        pool = await session.get(TalentPool, pool_id)
        if not pool:
            return False
        await session.delete(pool)
        await session.commit()
        return True

    async def save_candidate_and_resume(
        self,
        session: AsyncSession,
        pool_id: UUID,
        candidate_name: str,
        filename: str,
        file_path: str,
        file_size_bytes: int,
        page_count: int,
        raw_text: str,
        is_scanned: bool,
        chunks: list[ChunkResult],
        embeddings: list[list[float]],
    ) -> tuple[Candidate, Resume, list[ResumeChunk]]:
        """
        Atomically saves a candidate, their resume record, and all vector chunks in
        a single transactional unit of work.
        """
        # 1. Create Candidate
        candidate = Candidate(
            id=uuid4(),
            pool_id=pool_id,
            full_name=candidate_name,
            headline=None,
            raw_skills=[],
        )
        session.add(candidate)

        # 2. Create Resume
        resume = Resume(
            id=uuid4(),
            candidate_id=candidate.id,
            filename=filename,
            file_path=file_path,
            file_size_bytes=file_size_bytes,
            page_count=page_count,
            raw_text=raw_text,
            is_scanned=is_scanned,
        )
        session.add(resume)

        # 3. Create Chunks with Vector(768)
        chunk_models: list[ResumeChunk] = []
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            chunk_row = ResumeChunk(
                id=uuid4(),
                resume_id=resume.id,
                candidate_id=candidate.id,
                chunk_index=chunk.chunk_index,
                page_number=chunk.page_number,
                text_content=chunk.text_content,
                token_count=chunk.token_count,
                bounding_boxes=chunk.bounding_boxes,
                embedding=embedding,
            )
            chunk_models.append(chunk_row)
            session.add(chunk_row)

        await session.commit()
        return candidate, resume, chunk_models

    async def semantic_search(
        self,
        session: AsyncSession,
        pool_id: UUID,
        query_vector: list[float],
        top_k: int = 15,
        min_similarity: float = 0.20,
        max_per_candidate: int = 3,
    ) -> list[CandidateSearchResult]:
        """
        Executes HNSW cosine distance search on pgvector with a materialized pool CTE
        and Python-side candidate diversity capping.
        """
        ef_search = max(
            int(settings.HNSW_EF_SEARCH),
            min(400, top_k * max_per_candidate * 4),
        )
        if self._supports_iterative_scan is None:
            cap_res = await session.execute(
                text("SELECT 1 FROM pg_settings WHERE name = 'hnsw.iterative_scan'")
            )
            self._supports_iterative_scan = cap_res.scalar_one_or_none() is not None

        if self._supports_iterative_scan:
            await session.execute(
                text(
                    "SELECT "
                    "set_config('hnsw.ef_search', :ef, true), "
                    "set_config('enable_seqscan', 'off', true), "
                    "set_config('hnsw.iterative_scan', 'relaxed_order', true)"
                ),
                {"ef": str(ef_search)},
            )
        else:
            await session.execute(
                text("SELECT set_config('hnsw.ef_search', :ef, true)"),
                {"ef": str(ef_search)},
            )

        query_vector_str = f"[{','.join(str(x) for x in query_vector)}]"
        oversample_limit = max(top_k * max_per_candidate * 5, 150)

        sql = text("""
            WITH pool_cands AS MATERIALIZED (
                SELECT id, full_name, headline
                FROM candidates
                WHERE pool_id = :pool_id
            ),
            nn AS (
                SELECT
                    rc.id AS chunk_id,
                    rc.candidate_id,
                    rc.chunk_index,
                    rc.page_number,
                    rc.text_content,
                    rc.bounding_boxes,
                    (rc.embedding <=> CAST(:query_vec AS vector)) AS distance
                FROM resume_chunks rc
                WHERE rc.candidate_id IN (SELECT id FROM pool_cands)
                ORDER BY rc.embedding <=> CAST(:query_vec AS vector) ASC
                LIMIT :oversample_limit
            )
            SELECT
                nn.chunk_id,
                nn.candidate_id,
                pc.full_name AS candidate_name,
                pc.headline AS candidate_headline,
                nn.chunk_index,
                nn.page_number,
                nn.text_content,
                nn.bounding_boxes,
                nn.distance
            FROM nn
            JOIN pool_cands pc ON nn.candidate_id = pc.id
            ORDER BY nn.distance ASC;
        """)

        result = await session.execute(
            sql,
            {
                "pool_id": pool_id,
                "query_vec": query_vector_str,
                "oversample_limit": oversample_limit,
            },
        )
        raw_rows = sorted(result.mappings().all(), key=lambda r: float(r["distance"]))

        # Group matched chunks by candidate while enforcing diversity cap and top_k
        candidate_map: dict[UUID, dict[str, Any]] = {}
        kept_chunks = 0

        for row in raw_rows:
            if kept_chunks >= top_k:
                break

            similarity = 1.0 - float(row["distance"])
            if similarity < min_similarity:
                continue

            cid = row["candidate_id"]
            existing = candidate_map.get(cid)
            if existing and len(existing["matching_chunks"]) >= max_per_candidate:
                continue

            boxes = row["bounding_boxes"]
            if isinstance(boxes, str):
                boxes = json.loads(boxes)

            chunk_res = SearchChunkResult(
                chunk_id=row["chunk_id"],
                chunk_index=row["chunk_index"],
                page_number=row["page_number"],
                text_content=row["text_content"],
                similarity_score=round(similarity, 4),
                bounding_boxes=boxes or [],
            )

            if not existing:
                candidate_map[cid] = {
                    "candidate_id": cid,
                    "full_name": row["candidate_name"],
                    "headline": row["candidate_headline"],
                    "top_similarity": chunk_res.similarity_score,
                    "matching_chunks": [chunk_res],
                }
            else:
                existing["matching_chunks"].append(chunk_res)
                if chunk_res.similarity_score > existing["top_similarity"]:
                    existing["top_similarity"] = chunk_res.similarity_score

            kept_chunks += 1

        # Return candidates sorted by their top chunk similarity score
        sorted_candidates = sorted(
            candidate_map.values(),
            key=lambda c: c["top_similarity"],
            reverse=True,
        )

        return [
            CandidateSearchResult(
                candidate_id=c["candidate_id"],
                full_name=c["full_name"],
                headline=c["headline"],
                top_similarity=c["top_similarity"],
                matching_chunks=c["matching_chunks"],
            )
            for c in sorted_candidates
        ]


vector_store = VectorStoreService()
