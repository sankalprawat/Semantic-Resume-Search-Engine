import asyncio
import logging
from pathlib import Path
from uuid import UUID

import aiofiles
from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.schemas.resume import BatchResumeUploadResponse, ResumeUploadResponse
from app.services.chunking import ChunkResult, chunker
from app.services.embeddings import embedding_service
from app.services.ingestion import ExtractedDocument, ingestion_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

router = APIRouter()

_READ_CHUNK_BYTES = 1024 * 1024  # 1 MiB


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


def _parse_and_chunk_pdf(
    content: bytes,
    filename: str,
) -> tuple[ExtractedDocument, str, list[ChunkResult]]:
    """CPU-bound PDF extraction + sliding-window chunking helper executed off the event loop."""
    extracted_doc = ingestion_service.extract_from_bytes(content, filename=filename)
    candidate_name = extract_candidate_name(extracted_doc.raw_text, filename)
    chunks = chunker.chunk_document(extracted_doc)
    return extracted_doc, candidate_name, chunks


def _resolve_existing_file(possible_paths: list[Path]) -> Path | None:
    for p in possible_paths:
        if p.exists() and p.is_file():
            return p
    return None


def _build_fallback_pdf_bytes(raw_text: str) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # Standard A4
    rect = pymupdf.Rect(50, 50, 545, 792)
    page.insert_textbox(rect, raw_text, fontsize=10)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


async def _read_bounded_upload(file: UploadFile, max_bytes: int, filename: str) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"File '{filename}' exceeds maximum upload size "
                    f"of {settings.MAX_UPLOAD_SIZE_MB} MB"
                ),
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/{pool_id}/upload", response_model=BatchResumeUploadResponse)
async def upload_resumes(
    pool_id: UUID,
    files: list[UploadFile] = File(...),
) -> BatchResumeUploadResponse:
    """
    Batch upload candidate PDF resumes into a talent pool.
    Offloads CPU-bound PDF parsing/chunking and disk writes from the event loop,
    uses batched embeddings, and opens short-lived DB sessions only for SQL steps.
    """
    async with AsyncSessionLocal() as db:
        exists = await vector_store.pool_exists(session=db, pool_id=pool_id)
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talent pool with id {pool_id} not found",
        )

    pool_storage = settings.STORAGE_LOCAL_DIR / str(pool_id)
    await asyncio.to_thread(pool_storage.mkdir, parents=True, exist_ok=True)
    max_upload_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    uploaded_results: list[ResumeUploadResponse] = []

    for file in files:
        safe_filename = Path(file.filename).name if file.filename else ""
        if not safe_filename or not safe_filename.lower().endswith(".pdf"):
            logger.warning(f"Skipping non-PDF file: {file.filename}")
            continue

        content = await _read_bounded_upload(file, max_upload_bytes, safe_filename)
        if not content:
            logger.warning(f"Skipping empty PDF file: {safe_filename}")
            continue

        file_path = pool_storage / safe_filename
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        # 1 & 2. PyMuPDF Ingestion + Sliding-Window Chunking (offloaded to worker thread)
        extracted_doc, candidate_name, chunks = await asyncio.to_thread(
            _parse_and_chunk_pdf,
            content,
            safe_filename,
        )

        # 3. Batched Gemini Embeddings Generation (no DB connection held)
        chunk_texts = [c.text_content for c in chunks]
        embeddings = await embedding_service.embed_texts_batch(chunk_texts)

        # 4. Atomic PostgreSQL Persistence in short-lived session
        async with AsyncSessionLocal() as db:
            candidate, resume, chunk_rows = await vector_store.save_candidate_and_resume(
                session=db,
                pool_id=pool_id,
                candidate_name=candidate_name,
                filename=safe_filename,
                file_path=file_path.as_posix(),
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
) -> Response:
    """Streams the raw candidate resume PDF file for client-side rendering."""
    async with AsyncSessionLocal() as db:
        resume = await vector_store.get_candidate_resume(session=db, candidate_id=candidate_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume for candidate {candidate_id} not found",
        )

    clean_path_str = resume.file_path.replace("\\", "/")
    filename = Path(clean_path_str).name

    possible_paths = [
        Path(clean_path_str),
        Path("backend") / clean_path_str,
        Path("..") / clean_path_str,
        settings.STORAGE_LOCAL_DIR / filename,
        Path("backend/storage/resumes/0310dece-8d3a-4504-802e-f39f03895052") / filename,
        Path("storage/resumes/0310dece-8d3a-4504-802e-f39f03895052") / filename,
    ]

    found_path = await asyncio.to_thread(_resolve_existing_file, possible_paths)
    if found_path is not None:
        return FileResponse(
            path=str(found_path),
            filename=resume.filename,
            media_type="application/pdf",
        )

    # Ephemeral cloud fallback: Reconstruct PDF document on the fly off the event loop
    if resume.raw_text:
        try:
            pdf_bytes = await asyncio.to_thread(_build_fallback_pdf_bytes, resume.raw_text)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'inline; filename="{resume.filename}"'
                },
            )
        except Exception as e:
            logger.error(f"Failed to generate fallback PDF for candidate {candidate_id}: {e}")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Resume PDF file does not exist on disk",
    )
