from uuid import uuid4

from app.services.citation_verifier import CitationVerifier


def test_parse_citations():
    verifier = CitationVerifier()
    text = (
        "Alice architected Kafka clusters [Candidate: Alice Smith | Chunk: C1], "
        "while Bob built frontend apps [Candidate: Bob Jones | Chunk: C2]."
    )
    matches = verifier.parse_citations(text)
    assert len(matches) == 2
    assert matches[0][1] == "Alice Smith"
    assert matches[0][2] == "C1"
    assert matches[1][1] == "Bob Jones"
    assert matches[1][2] == "C2"


def test_verify_synthesis_100_grounded():
    verifier = CitationVerifier()
    cand1_id = uuid4()
    chunk1_id = uuid4()

    cand2_id = uuid4()
    chunk2_id = uuid4()

    retrieval_map = {
        "c1": {
            "candidate_id": cand1_id,
            "candidate_name": "Alice Smith",
            "chunk_id": chunk1_id,
            "chunk_index": 0,
            "page_number": 1,
            "text_content": "Architected Kafka streaming pipelines.",
            "bounding_boxes": [{"x0": 0.1, "y0": 0.1, "x1": 0.5, "y1": 0.15}],
        },
        "alice smith:c1": {
            "candidate_id": cand1_id,
            "candidate_name": "Alice Smith",
            "chunk_id": chunk1_id,
            "chunk_index": 0,
            "page_number": 1,
            "text_content": "Architected Kafka streaming pipelines.",
            "bounding_boxes": [{"x0": 0.1, "y0": 0.1, "x1": 0.5, "y1": 0.15}],
        },
        "c2": {
            "candidate_id": cand2_id,
            "candidate_name": "Bob Jones",
            "chunk_id": chunk2_id,
            "chunk_index": 0,
            "page_number": 2,
            "text_content": "Built Next.js frontend applications.",
            "bounding_boxes": [{"x0": 0.2, "y0": 0.3, "x1": 0.8, "y1": 0.35}],
        },
    }

    markdown = (
        "Alice has deep distributed systems experience [Candidate: Alice Smith | Chunk: C1]. "
        "Bob specializes in user interfaces [Candidate: Bob Jones | Chunk: C2]."
    )

    report = verifier.verify_synthesis(markdown, retrieval_map)
    assert report.total_citations == 2
    assert len(report.valid_citations) == 2
    assert len(report.hallucinated_citations) == 0
    assert report.grounding_score == 100.0

    assert report.valid_citations[0].candidate_name == "Alice Smith"
    assert report.valid_citations[0].page_number == 1
    assert report.valid_citations[1].candidate_name == "Bob Jones"
    assert report.valid_citations[1].page_number == 2


def test_verify_synthesis_detects_hallucination():
    verifier = CitationVerifier()
    retrieval_map = {
        "c1": {
            "candidate_id": uuid4(),
            "candidate_name": "Alice Smith",
            "chunk_id": uuid4(),
            "chunk_index": 0,
            "page_number": 1,
            "text_content": "Architected Kafka streaming pipelines.",
            "bounding_boxes": [],
        }
    }

    # Cites valid C1, but also hallucinated Eve C99
    markdown = (
        "Alice handled streaming [Candidate: Alice Smith | Chunk: C1]. "
        "Eve allegedly managed Kubernetes [Candidate: Eve | Chunk: C99]."
    )

    report = verifier.verify_synthesis(markdown, retrieval_map)
    assert report.total_citations == 2
    assert len(report.valid_citations) == 1
    assert len(report.hallucinated_citations) == 1
    assert report.grounding_score == 50.0
    assert report.hallucinated_citations[0]["chunk_key"] == "C99"
