import pymupdf

from app.services.ingestion import DocumentIngestionService


def create_in_memory_pdf(text: str) -> bytes:
    """Helper to generate an in-memory test PDF using PyMuPDF."""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)  # Letter size
    # Insert text at top of page
    page.insert_text(
        pymupdf.Point(50, 72),
        text,
        fontsize=12,
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_ingestion_digital_pdf():
    service = DocumentIngestionService()
    sample_text = (
        "Alice Smith\n"
        "Senior Distributed Systems Engineer\n"
        "Architected Kafka event streaming platforms handling 500k events/sec."
    )
    pdf_bytes = create_in_memory_pdf(sample_text)

    doc = service.extract_from_bytes(pdf_bytes, filename="alice_resume.pdf")

    assert doc.filename == "alice_resume.pdf"
    assert doc.page_count == 1
    assert not doc.is_scanned
    assert "Alice Smith" in doc.raw_text
    assert len(doc.pages) == 1

    page = doc.pages[0]
    assert len(page.words) > 5

    # Check normalized coordinate ranges
    for w in page.words:
        assert 0.0 <= w.bbox["x0"] <= 1.0
        assert 0.0 <= w.bbox["y0"] <= 1.0
        assert 0.0 <= w.bbox["x1"] <= 1.0
        assert 0.0 <= w.bbox["y1"] <= 1.0
        assert w.bbox["x0"] <= w.bbox["x1"]
        assert w.bbox["y0"] <= w.bbox["y1"]


def test_ingestion_scanned_detection():
    service = DocumentIngestionService()
    # Create an empty PDF page (0 characters extracted)
    doc = pymupdf.open()
    doc.new_page(width=612, height=792)
    blank_bytes = doc.tobytes()
    doc.close()

    result = service.extract_from_bytes(blank_bytes, filename="scanned_resume.pdf")
    assert result.is_scanned
    assert len(result.raw_text) < service.MIN_TEXT_CHARS_THRESHOLD
