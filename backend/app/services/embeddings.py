import asyncio
import logging
import time
from collections import OrderedDict
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

_TRANSIENT_HTTP_STATUS = {429, 500, 502, 503, 504}
_MAX_BATCH_SIZE = 100


def _is_transient_embedding_error(exc: BaseException) -> bool:
    if isinstance(exc, genai_errors.APIError):
        return getattr(exc, "code", None) in _TRANSIENT_HTTP_STATUS
    if isinstance(exc, (TimeoutError, ConnectionError, OSError)):
        return True
    name = type(exc).__name__.lower()
    return "timeout" in name or "connect" in name


class GeminiEmbeddingService:
    """
    Asynchronous embedding client for Google Gemini.
    Features:
    - Isolated interactive vs batch semaphores so uploads do not starve search queries.
    - True batch embedding via Gemini batchEmbedContents (up to 100 texts/request).
    - Bounded TTL/LRU cache for repeated query strings.
    - Explicit HTTP timeout + single internal retry paired with transient tenacity backoff.
    """

    def __init__(
        self,
        max_concurrency: int = 8,
        cache_max_size: int = 512,
        cache_ttl_seconds: float = 600.0,
    ) -> None:
        self.max_concurrency = max_concurrency
        self.semaphore = asyncio.Semaphore(max(32, max_concurrency))
        self.batch_semaphore = asyncio.Semaphore(max_concurrency)
        self._cache_max_size = cache_max_size
        self._cache_ttl_seconds = cache_ttl_seconds
        self._query_cache: OrderedDict[str, tuple[float, list[float]]] = OrderedDict()
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is not configured in settings or .env")
            self._client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options=types.HttpOptions(
                    timeout=8_000,
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
        return self._client

    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_random_exponential(multiplier=0.5, max=8),
        retry=retry_if_exception(_is_transient_embedding_error),
    )
    async def embed_single(self, text: str) -> list[float]:
        """
        Embeds a single string into a 768-dimensional float vector.
        Uses the interactive semaphore so background upload batches cannot block queries.
        """
        async with self.semaphore:
            response: Any = await self.client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=text,
                config={"output_dimensionality": settings.EMBEDDING_DIMENSION},
            )
            return response.embeddings[0].values

    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_random_exponential(multiplier=0.5, max=8),
        retry=retry_if_exception(_is_transient_embedding_error),
    )
    async def _embed_batch_chunk(self, texts: list[str]) -> list[list[float]]:
        batch_contents = [
            types.Content(parts=[types.Part.from_text(text=txt)]) for txt in texts
        ]
        async with self.batch_semaphore:
            response: Any = await self.client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=batch_contents,
                config={"output_dimensionality": settings.EMBEDDING_DIMENSION},
            )
            return [emb.values for emb in response.embeddings]

    async def embed_text(self, text: str) -> list[float]:
        """Public method to embed a single query or text fragment with bounded LRU/TTL cache."""
        if not text or not text.strip():
            # Return zero-vector fallback for empty strings to prevent API exceptions
            return [0.0] * settings.EMBEDDING_DIMENSION

        normalized = text.strip()
        now = time.monotonic()
        cached = self._query_cache.get(normalized)
        if cached is not None:
            expires_at, vec = cached
            if expires_at > now:
                self._query_cache.move_to_end(normalized)
                return vec
            self._query_cache.pop(normalized, None)

        vec = await self.embed_single(normalized)
        self._query_cache[normalized] = (now + self._cache_ttl_seconds, vec)
        self._query_cache.move_to_end(normalized)
        while len(self._query_cache) > self._cache_max_size:
            self._query_cache.popitem(last=False)
        return vec

    async def embed_texts_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Embeds a list of texts using batched Gemini batchEmbedContents calls
        controlled by the dedicated batch semaphore.
        """
        if not texts:
            return []

        clean_texts = [t.strip() if t and t.strip() else "empty" for t in texts]
        if len(clean_texts) <= _MAX_BATCH_SIZE:
            return await self._embed_batch_chunk(clean_texts)

        batches = [
            clean_texts[i : i + _MAX_BATCH_SIZE]
            for i in range(0, len(clean_texts), _MAX_BATCH_SIZE)
        ]
        batch_results = await asyncio.gather(*(self._embed_batch_chunk(b) for b in batches))
        merged: list[list[float]] = []
        for batch_vecs in batch_results:
            merged.extend(batch_vecs)
        return merged


embedding_service = GeminiEmbeddingService()
