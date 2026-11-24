from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO

import pymupdf

from app.utils.coordinates import normalize_bbox


@dataclass
class ExtractedWord:
    """Represents an individual extracted word and its normalized page coordinates."""

    text: str
    page_number: int
    bbox: dict[str, float]  # Normalized: {"x0": float, "y0": float, "x1": float, "y1": float}


@dataclass
class ExtractedPage:
    """Represents all text and layout data extracted from a single PDF page."""

    page_number: int
    width_points: float
    height_points: float
    text: str
    words: list[ExtractedWord] = field(default_factory=list)


@dataclass
class ExtractedDocument:
    """Master document representation returned by DocumentIngestionService."""

    filename: str
    page_count: int
    raw_text: str
    is_scanned: bool
    pages: list[ExtractedPage] = field(default_factory=list)


class DocumentIngestionService:
    """
    High-performance C-accelerated PDF ingestion service using PyMuPDF.
    Extracts text streams and word-level bounding box coordinates, and detects
    scanned/image-only resumes.
    """

    MIN_TEXT_CHARS_THRESHOLD: int = 50

    def extract_from_bytes(
        self,
        pdf_bytes: bytes,
        filename: str = "document.pdf",
    ) -> ExtractedDocument:
        """Parse a PDF document directly from memory buffer (bytes)."""
        with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
            return self._process_document(doc, filename)

    def extract_from_file(self, file_path: Path | str) -> ExtractedDocument:
        """Parse a PDF document from a local filesystem path."""
        path = Path(file_path)
        with pymupdf.open(str(path)) as doc:
            return self._process_document(doc, path.name)

    def extract_from_stream(
        self,
        stream: BinaryIO,
        filename: str = "document.pdf",
    ) -> ExtractedDocument:
        """Parse a PDF document from an open binary file stream."""
        pdf_bytes = stream.read()
        return self.extract_from_bytes(pdf_bytes, filename)

    def _process_document(self, doc: pymupdf.Document, filename: str) -> ExtractedDocument:
        pages: list[ExtractedPage] = []
        full_text_parts: list[str] = []
        total_chars = 0
        has_images = False

        for page_index in range(len(doc)):
            page = doc[page_index]
            page_number = page_index + 1  # 1-indexed for recruiter view
            page_width = float(page.rect.width)
            page_height = float(page.rect.height)

            # 1. Extract plain text for the page
            page_text = page.get_text("text").strip()
            if page_text:
                full_text_parts.append(page_text)
                total_chars += len(page_text)

            # Check for presence of embedded images
            if len(page.get_images()) > 0:
                has_images = True

            # 2. Extract words with bounding box points (x0, y0, x1, y1, word)
            extracted_words: list[ExtractedWord] = []
            raw_words = page.get_text("words")

            for word_tuple in raw_words:
                x0, y0, x1, y1, word_text = (
                    float(word_tuple[0]),
                    float(word_tuple[1]),
                    float(word_tuple[2]),
                    float(word_tuple[3]),
                    str(word_tuple[4]),
                )
                norm_bbox = normalize_bbox(x0, y0, x1, y1, page_width, page_height)
                extracted_words.append(
                    ExtractedWord(
                        text=word_text,
                        page_number=page_number,
                        bbox=norm_bbox,
                    )
                )

            pages.append(
                ExtractedPage(
                    page_number=page_number,
                    width_points=page_width,
                    height_points=page_height,
                    text=page_text,
                    words=extracted_words,
                )
            )

        # Scanned document detection:
        # If the PDF has very little or no extractable text but contains images or empty pages
        is_scanned = total_chars < self.MIN_TEXT_CHARS_THRESHOLD and (
            has_images or len(doc) > 0
        )

        return ExtractedDocument(
            filename=filename,
            page_count=len(doc),
            raw_text="\n\n".join(full_text_parts),
            is_scanned=is_scanned,
            pages=pages,
        )


ingestion_service = DocumentIngestionService()
