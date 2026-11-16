from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.
    Initializes local storage directories and pre-warms connections.
    """
    settings.STORAGE_LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-Candidate Semantic Talent Engine - Retrieval-Augmented Hiring Intelligence",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS for Next.js frontend
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Mount versioned API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
@app.get(f"{settings.API_V1_PREFIX}/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint for container probes and uptime monitors."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "embedding_model": settings.EMBEDDING_MODEL,
        "completion_model": settings.COMPLETION_MODEL,
    }


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    return {
        "message": "Welcome to the Multi-Candidate Semantic Talent Engine API",
        "documentation": "/docs",
        "api_v1": settings.API_V1_PREFIX,
    }
