import asyncio
import logging
from typing import Any

from google import genai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiEmbeddingService:
    """
    Asynchronous embedding client for Google Gemini.
    Features:
    - High-throughput parallel processing with asyncio.Semaphore concurrency control.
    - Automatic Matryoshka Representation Learning (MRL) dimension clamping (768-dim).
    - Exponential backoff with random jitter on rate-limits (HTTP 429) or network blips.
    """

    def __init__(self, max_concurrency: int = 8) -> None:
        self.max_concurrency = max_concurrency
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is not configured in settings or .env")
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_random_exponential(multiplier=1, max=10),
        retry=retry_if_exception_type(Exception),
    )
    async def embed_single(self, text: str) -> list[float]:
        """
        Embeds a single string into a 768-dimensional float vector.
        Protected by exponential backoff and jitter.
        """
        async with self.semaphore:
            response: Any = await self.client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=text,
                config={"output_dimensionality": settings.EMBEDDING_DIMENSION},
            )
            return response.embeddings[0].values

    async def embed_text(self, text: str) -> list[float]:
        """Public method to embed a single query or text fragment."""
        if not text or not text.strip():
            # Return zero-vector fallback for empty strings to prevent API exceptions
            return [0.0] * settings.EMBEDDING_DIMENSION
        return await self.embed_single(text.strip())

    async def embed_texts_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Embeds an arbitrary list of texts concurrently using the internal semaphore
        to stay safely within API rate limits.
        """
        if not texts:
            return []

        clean_texts = [t.strip() if t and t.strip() else "empty" for t in texts]
        tasks = [self.embed_single(t) for t in clean_texts]
        results = await asyncio.gather(*tasks)
        return list(results)


embedding_service = GeminiEmbeddingService()
