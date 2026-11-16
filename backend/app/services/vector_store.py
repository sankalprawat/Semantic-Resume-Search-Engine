import json
import logging
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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

    async def list_pools(self, session: AsyncSession) -> list[dict[str, Any]]:
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

    async def get_pool(
        self,
        session: AsyncSession,
        pool_id: UUID,
    ) -> TalentPool | None:
        query = select(TalentPool).where(TalentPool.id == pool_id)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def list_candidates_for_pool(
        self,
        session: AsyncSession,
        pool_id: UUID,
    ) -> list[CandidateListItem]:
        """Lists all candidates within a talent pool with resume metadata."""
        query = (
            select(Candidate)
            .where(Candidate.pool_id == pool_id)
            .options(
                selectinload(Candidate.resumes),
                selectinload(Candidate.chunks),
            )
            .order_by(Candidate.created_at.desc())
        )
        res = await session.execute(query)
        candidates = res.scalars().all()

        items: list[CandidateListItem] = []
        for c in candidates:
            latest_resume = c.resumes[0] if c.resumes else None
            items.append(
                CandidateListItem(
                    id=c.id,
                    pool_id=c.pool_id,
                    full_name=c.full_name,
                    email=c.email,
                    resume_id=latest_resume.id if latest_resume else None,
                    filename=latest_resume.filename if latest_resume else None,
                    page_count=latest_resume.page_count if latest_resume else 1,
                    chunks_count=len(c.chunks) if c.chunks else 0,
                    created_at=c.created_at,
                )
            )
        return items

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
        pool = await self.get_pool(session, pool_id)
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
        await session.refresh(candidate)
        await session.refresh(resume)
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
        Executes HNSW cosine distance search on pgvector with a window-partitioned
        candidate diversity cap. Ensures single candidates with repeated keywords
        cannot monopolize search results.
        """
        query_vector_str = f"[{','.join(str(x) for x in query_vector)}]"

        sql = text("""
            WITH ranked_chunks AS (
                SELECT
                    rc.id AS chunk_id,
                    rc.candidate_id,
                    rc.resume_id,
                    rc.chunk_index,
                    rc.page_number,
                    rc.text_content,
                    rc.bounding_boxes,
                    c.full_name AS candidate_name,
                    c.headline AS candidate_headline,
                    (1 - (rc.embedding <=> CAST(:query_vec AS vector))) AS similarity_score,
                    ROW_NUMBER() OVER (
                        PARTITION BY rc.candidate_id
                        ORDER BY rc.embedding <=> CAST(:query_vec AS vector) ASC
                    ) AS candidate_rank
                FROM resume_chunks rc
                JOIN candidates c ON rc.candidate_id = c.id
                WHERE c.pool_id = :pool_id
                  AND (1 - (rc.embedding <=> CAST(:query_vec AS vector))) >= :min_similarity
            )
            SELECT *
            FROM ranked_chunks
            WHERE candidate_rank <= :max_per_candidate
            ORDER BY similarity_score DESC
            LIMIT :top_k;
        """)

        result = await session.execute(
            sql,
            {
                "pool_id": pool_id,
                "query_vec": query_vector_str,
                "min_similarity": min_similarity,
                "max_per_candidate": max_per_candidate,
                "top_k": top_k,
            },
        )
        rows = result.mappings().all()

        # Group matched chunks by candidate
        candidate_map: dict[UUID, dict[str, Any]] = {}

        for row in rows:
            cid = row["candidate_id"]
            boxes = row["bounding_boxes"]
            if isinstance(boxes, str):
                boxes = json.loads(boxes)

            chunk_res = SearchChunkResult(
                chunk_id=row["chunk_id"],
                chunk_index=row["chunk_index"],
                page_number=row["page_number"],
                text_content=row["text_content"],
                similarity_score=round(float(row["similarity_score"]), 4),
                bounding_boxes=boxes or [],
            )

            if cid not in candidate_map:
                candidate_map[cid] = {
                    "candidate_id": cid,
                    "full_name": row["candidate_name"],
                    "headline": row["candidate_headline"],
                    "top_similarity": chunk_res.similarity_score,
                    "matching_chunks": [chunk_res],
                }
            else:
                candidate_map[cid]["matching_chunks"].append(chunk_res)
                # Keep top_similarity updated to highest score
                if chunk_res.similarity_score > candidate_map[cid]["top_similarity"]:
                    candidate_map[cid]["top_similarity"] = chunk_res.similarity_score

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
