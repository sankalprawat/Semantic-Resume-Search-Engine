import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings


@pytest_asyncio.fixture
async def test_engine():
    """Function-scoped async engine using NullPool to avoid cross-loop connection leakage."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
    )
    yield engine
    await engine.dispose()
