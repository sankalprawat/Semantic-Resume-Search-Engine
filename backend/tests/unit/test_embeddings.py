import pytest

from app.services.embeddings import GeminiEmbeddingService


@pytest.mark.asyncio
async def test_embed_empty_string():
    service = GeminiEmbeddingService()
    vec = await service.embed_text("")
    assert len(vec) == 768
    assert all(v == 0.0 for v in vec)


@pytest.mark.asyncio
async def test_embed_single_text():
    service = GeminiEmbeddingService()
    vec = await service.embed_text("Senior backend engineer experienced in PostgreSQL and Kafka.")
    assert len(vec) == 768
    # Assert non-zero vector
    assert any(v != 0.0 for v in vec)


@pytest.mark.asyncio
async def test_embed_batch_texts():
    service = GeminiEmbeddingService()
    texts = [
        "Architected distributed databases using CockroachDB.",
        "Built responsive web applications with React and Next.js.",
    ]
    vecs = await service.embed_texts_batch(texts)
    assert len(vecs) == 2
    assert len(vecs[0]) == 768
    assert len(vecs[1]) == 768
