from app.services.chunking import SlidingWindowChunker
from app.services.ingestion import ExtractedPage, ExtractedWord


def test_chunker_sentence_snapping():
    chunker = SlidingWindowChunker(target_tokens=30, overlap_tokens=10, chars_per_token=4.0)

    # Synthetic text with clear sentence boundaries
    sentences = [
        "Architected scalable microservices using FastAPI and Kafka.",
        "Engineered real-time transaction streaming pipelines with strict latency SLAs.",
        "Managed distributed PostgreSQL clusters with high availability failover.",
        "Implemented automated CI/CD deployment pipelines on Kubernetes clusters.",
    ]
    raw_text = " ".join(sentences)
    words: list[ExtractedWord] = []

    for idx, w in enumerate(raw_text.split()):
        words.append(
            ExtractedWord(
                text=w,
                page_number=1,
                bbox={"x0": 0.1, "y0": 0.1 + (idx * 0.01), "x1": 0.5, "y1": 0.12 + (idx * 0.01)},
            )
        )

    page = ExtractedPage(
        page_number=1,
        width_points=612.0,
        height_points=792.0,
        text=raw_text,
        words=words,
    )

    chunks = chunker.chunk_page(page, start_chunk_index=0)
    assert len(chunks) >= 2

    # Verify that the first chunk snaps at a sentence boundary (ends with period or colon)
    first_chunk_text = chunks[0].text_content.strip()
    assert first_chunk_text.endswith((".", "!", "?"))

    # Verify that overlap exists (some words from chunk 1 appear in chunk 2)
    chunk0_words = set(chunks[0].text_content.split())
    chunk1_words = set(chunks[1].text_content.split())
    overlap = chunk0_words.intersection(chunk1_words)
    assert len(overlap) > 0, "Expected overlap between consecutive chunks"

    # Verify bounding boxes were aggregated
    assert len(chunks[0].bounding_boxes) > 0


def test_chunker_small_page_single_chunk():
    chunker = SlidingWindowChunker(target_tokens=400, overlap_tokens=100)
    words = [
        ExtractedWord(
            text="Short", page_number=1, bbox={"x0": 0.1, "y0": 0.1, "x1": 0.2, "y1": 0.12}
        ),
        ExtractedWord(
            text="Resume", page_number=1, bbox={"x0": 0.21, "y0": 0.1, "x1": 0.35, "y1": 0.12}
        ),
    ]
    page = ExtractedPage(
        page_number=1,
        width_points=612.0,
        height_points=792.0,
        text="Short Resume",
        words=words,
    )

    chunks = chunker.chunk_page(page, start_chunk_index=0)
    assert len(chunks) == 1
    assert chunks[0].text_content == "Short Resume"
    assert len(chunks[0].bounding_boxes) == 1  # Merged adjacent boxes
