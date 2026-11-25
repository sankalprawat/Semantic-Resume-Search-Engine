from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings
    Loads configuration from environment variables and backend/.env file.
    """

    # General Application
    PROJECT_NAME: str = "SemanticPin"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SQL_ECHO: bool = False

    # Database Configuration (PostgreSQL 16 + pgvector)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/talent_engine"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # Google Gemini AI Platform
    GEMINI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "gemini-embedding-2"
    COMPLETION_MODEL: str = "gemini-3.5-flash-lite"
    COMPLETION_FALLBACK_MODELS: list[str] | str = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-4-hydrogen",
        "gemini-3.8-flash",
    ]
    EMBEDDING_DIMENSION: int = 768
    MAX_OUTPUT_TOKENS: int = 8192

    @field_validator("COMPLETION_FALLBACK_MODELS", mode="before")
    @classmethod
    def assemble_fallback_models(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [m.strip() for m in v.split(",") if m.strip()]
        return v

    # Security & CORS
    CORS_ORIGINS: list[str] | str = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Storage Settings
    STORAGE_LOCAL_DIR: Path = Path("./storage/resumes")
    MAX_UPLOAD_SIZE_MB: int = 25

    # pgvector Search Tuning Parameters
    HNSW_EF_SEARCH: int = 40
    CHUNK_SIMILARITY_THRESHOLD: float = 0.35
    MAX_CHUNKS_PER_CANDIDATE: int = 3

    model_config = SettingsConfigDict(
        env_file=["backend/.env", ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
