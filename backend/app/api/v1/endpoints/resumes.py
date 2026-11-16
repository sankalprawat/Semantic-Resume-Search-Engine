import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.schemas.resume import BatchResumeUploadResponse, ResumeUploadResponse
from app.services.chunking import chunker
from app.services.embeddings import embedding_service
from app.services.ingestion import ingestion_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

router = APIRouter()


def extract_candidate_name(raw_text: str, filename: str) -> str:
    """
    Extracts a plausible candidate name from resume text or falls back to cleaned filename.
    """
    for line in raw_text.splitlines():
        line = line.strip()
        # Look for a line with 2-4 words that is not an email, phone, or title
        is_word_count_ok = 2 <= len(line.split()) <= 4
        is_not_contact = "@" not in line and not any(c.isdigit() for c in line)
        if is_word_count_ok and is_not_contact:
            if len(line) < 40 and not any(
                kw in line.lower() for kw in ["resume", "curriculum", "page"]
            ):
                return line

    # Fallback to file basename (e.g. "Jane_Doe_Resume.pdf" -> "Jane Doe")
    stem = Path(filename).stem
    cleaned = stem.replace("_", " ").replace("-", " ")
    for suffix in ["resume", "cv", "profile"]:
        cleaned = cleaned.lower().replace(suffix, "").strip().title()
    return cleaned or "Candidate"


@router.post("/{pool_id}/upload", response_model=BatchResumeUploadResponse)
async def upload_resumes(
    pool_id: UUID,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
) -> BatchResumeUploadResponse:
    """
    Batch upload candidate PDF resumes into a talent pool.
    Pipeline:
    1. PyMuPDF extracts text streams and bounding boxes.
    2. SlidingWindowChunker generates 400-token chunks with sentence boundary snapping.
    3. GeminiEmbeddingService generates 768-dim embeddings using gemini-embedding-2.
    4. Database atomically persists Candidate, Resume, and ResumeChunks with HNSW vectors.
    """
    pool = await vector_store.get_pool(session=db, pool_id=pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )

    pool_storage = settings.STORAGE_LOCAL_DIR / str(pool_id)
    pool_storage.mkdir(parents=True, exist_ok=True)

    uploaded_results: list[ResumeUploadResponse] = []

    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            logger.warning(f"Skipping non-PDF file: {file.filename}")
            continue

        content = await file.read()
        file_path = pool_storage / file.filename
        with open(file_path, "wb") as f:
            f.write(content)

        # 1. PyMuPDF Ingestion
        extracted_doc = ingestion_service.extract_from_bytes(content, filename=file.filename)
        candidate_name = extract_candidate_name(extracted_doc.raw_text, file.filename)

        # 2. Sliding-Window Chunking
        chunks = chunker.chunk_document(extracted_doc)

        # 3. Gemini Embeddings Generation
        chunk_texts = [c.text_content for c in chunks]
        embeddings = await embedding_service.embed_texts_batch(chunk_texts)

        # 4. Atomic PostgreSQL Persistence
        candidate, resume, chunk_rows = await vector_store.save_candidate_and_resume(
            session=db,
            pool_id=pool_id,
            candidate_name=candidate_name,
            filename=file.filename,
            file_path=str(file_path),
            file_size_bytes=len(content),
            page_count=extracted_doc.page_count,
            raw_text=extracted_doc.raw_text,
            is_scanned=extracted_doc.is_scanned,
            chunks=chunks,
            embeddings=embeddings,
        )

        uploaded_results.append(
            ResumeUploadResponse(
                candidate_id=candidate.id,
                candidate_name=candidate.full_name,
                resume_id=resume.id,
                filename=resume.filename,
                chunks_created=len(chunk_rows),
                is_scanned=resume.is_scanned,
                page_count=resume.page_count,
            )
        )

    return BatchResumeUploadResponse(
        pool_id=pool_id,
        total_uploaded=len(uploaded_results),
        resumes=uploaded_results,
    )


@router.get("/{candidate_id}/file")
async def get_candidate_resume_file(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Streams the raw candidate resume PDF file for client-side rendering."""
    resume = await vector_store.get_candidate_resume(session=db, candidate_id=candidate_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume for candidate {candidate_id} not found",
        )

    file_path = Path(resume.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume PDF file does not exist on disk",
        )

    return FileResponse(
        path=str(file_path),
        filename=resume.filename,
        media_type="application/pdf",
    )
