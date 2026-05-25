"""
Configuration management for the RAG service.
"""

import os
import secrets
from functools import lru_cache
from typing import Any, Dict, List, Optional

from pydantic import BaseSettings, Field, validator


class Settings(BaseSettings):
    """Application settings."""

    # Application settings
    app_name: str = Field(default="SDLC RAG Service", env="APP_NAME")
    app_version: str = Field(default="1.0.0", env="APP_VERSION")
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="development", env="ENVIRONMENT")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # Server settings
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    workers: int = Field(default=1, env="WORKERS")

    # Security settings
    secret_key: str = Field(
        default_factory=lambda: secrets.token_urlsafe(32), env="SECRET_KEY"
    )
    algorithm: str = Field(default="HS256", env="ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=15, env="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    refresh_token_expire_days: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")

    # Database settings
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/sdlc_platform",
        env="DATABASE_URL",
    )
    db_pool_size: int = Field(default=20, env="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=10, env="DB_MAX_OVERFLOW")
    db_echo: bool = Field(default=False, env="DB_ECHO")

    # Redis settings
    redis_url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    redis_max_connections: int = Field(default=20, env="REDIS_MAX_CONNECTIONS")
    redis_timeout: int = Field(default=5, env="REDIS_TIMEOUT")

    # Vector database settings
    vector_db_url: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/sdlc_platform",
        env="VECTOR_DB_URL",
    )
    vector_dimensions: int = Field(default=1536, env="VECTOR_DIMENSIONS")
    embedding_model: str = Field(
        default="text-embedding-ada-002", env="EMBEDDING_MODEL"
    )

    # OpenAI settings
    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    openai_organization: Optional[str] = Field(default=None, env="OPENAI_ORGANIZATION")
    openai_base_url: Optional[str] = Field(default=None, env="OPENAI_BASE_URL")
    openai_timeout: int = Field(default=30, env="OPENAI_TIMEOUT")
    openai_max_retries: int = Field(default=3, env="OPENAI_MAX_RETRIES")

    # Anthropic settings
    anthropic_api_key: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    anthropic_base_url: Optional[str] = Field(default=None, env="ANTHROPIC_BASE_URL")
    anthropic_timeout: int = Field(default=30, env="ANTHROPIC_TIMEOUT")
    anthropic_max_retries: int = Field(default=3, env="ANTHROPIC_MAX_RETRIES")

    # Sentence Transformers settings
    sentence_transformer_model: str = Field(
        default="all-MiniLM-L6-v2", env="SENTENCE_TRANSFORMER_MODEL"
    )
    sentence_transformer_device: str = Field(
        default="cpu", env="SENTENCE_TRANSFORMER_DEVICE"
    )

    # Document processing settings
    max_file_size: int = Field(default=50 * 1024 * 1024, env="MAX_FILE_SIZE")  # 50MB
    allowed_file_types: List[str] = Field(
        default_factory=lambda: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "text/plain",
            "text/html",
            "text/markdown",
            "application/json",
            "text/csv",
        ],
        env="ALLOWED_FILE_TYPES",
    )
    chunk_size: int = Field(default=1024, env="CHUNK_SIZE")
    chunk_overlap: int = Field(default=256, env="CHUNK_OVERLAP")
    max_chunks_per_document: int = Field(default=10000, env="MAX_CHUNKS_PER_DOCUMENT")

    # Storage settings
    storage_type: str = Field(default="r2", env="STORAGE_TYPE")
    r2_endpoint_url: Optional[str] = Field(default=None, env="R2_ENDPOINT_URL")
    r2_access_key_id: Optional[str] = Field(default=None, env="R2_ACCESS_KEY_ID")
    r2_secret_access_key: Optional[str] = Field(
        default=None, env="R2_SECRET_ACCESS_KEY"
    )
    r2_bucket_name: str = Field(default="sdlc-documents", env="R2_BUCKET_NAME")
    r2_region: str = Field(default="auto", env="R2_REGION")

    # DLP settings
    dlp_enabled: bool = Field(default=True, env="DLP_ENABLED")
    presidio_server_url: str = Field(
        default="http://localhost:5000", env="PRESIDIO_SERVER_URL"
    )
    dlp_confidence_threshold: float = Field(default=0.8, env="DLP_CONFIDENCE_THRESHOLD")
    dlp_timeout: int = Field(default=10, env="DLP_TIMEOUT")

    # Rate limiting settings
    rate_limit_enabled: bool = Field(default=True, env="RATE_LIMIT_ENABLED")
    rate_limit_requests_per_minute: int = Field(
        default=60, env="RATE_LIMIT_REQUESTS_PER_MINUTE"
    )
    rate_limit_burst: int = Field(default=10, env="RATE_LIMIT_BURST")

    # Monitoring settings
    monitoring_enabled: bool = Field(default=True, env="MONITORING_ENABLED")
    prometheus_port: int = Field(default=9090, env="PROMETHEUS_PORT")
    jaeger_endpoint: Optional[str] = Field(default=None, env="JAEGER_ENDPOINT")
    sentry_dsn: Optional[str] = Field(default=None, env="SENTRY_DSN")

    # API settings
    api_v1_prefix: str = Field(default="/api/v1", env="API_V1_PREFIX")
    docs_url: str = Field(default="/docs", env="DOCS_URL")
    redoc_url: str = Field(default="/redoc", env="REDOC_URL")
    openapi_url: str = Field(default="/openapi.json", env="OPENAPI_URL")

    # CORS settings
    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000"], env="CORS_ORIGINS"
    )
    cors_methods: List[str] = Field(
        default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        env="CORS_METHODS",
    )
    cors_headers: List[str] = Field(default_factory=lambda: ["Accept", "Authorization", "Content-Type", "X-Request-ID"], env="CORS_HEADERS")
    cors_allow_credentials: bool = Field(default=True, env="CORS_ALLOW_CREDENTIALS")

    # Caching settings
    cache_ttl_seconds: int = Field(default=3600, env="CACHE_TTL_SECONDS")
    cache_max_size: int = Field(default=1000, env="CACHE_MAX_SIZE")

    # Batch processing settings
    batch_size: int = Field(default=100, env="BATCH_SIZE")
    batch_timeout_seconds: int = Field(default=30, env="BATCH_TIMEOUT_SECONDS")
    max_concurrent_batches: int = Field(default=5, env="MAX_CONCURRENT_BATCHES")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @validator("environment", pre=True)
    def validate_environment(cls, v):
        """Validate environment setting."""
        allowed = ["development", "staging", "production", "test"]
        if v not in allowed:
            raise ValueError(f"Environment must be one of {allowed}")
        return v

    @validator("log_level", pre=True)
    def validate_log_level(cls, v):
        """Validate log level setting."""
        allowed = ["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"]
        if v.upper() not in allowed:
            raise ValueError(f"Log level must be one of {allowed}")
        return v.upper()

    @validator("allowed_file_types", pre=True)
    def validate_allowed_file_types(cls, v):
        """Validate allowed file types."""
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @validator("cors_origins", pre=True)
    def validate_cors_origins(cls, v):
        """Validate CORS origins."""
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @validator("cors_methods", pre=True)
    def validate_cors_methods(cls, v):
        """Validate CORS methods."""
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @validator("cors_headers", pre=True)
    def validate_cors_headers(cls, v):
        """Validate CORS headers."""
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def is_test(self) -> bool:
        """Check if running in test environment."""
        return self.environment == "test"

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL for migrations."""
        return self.database_url.replace("+asyncpg", "")

    def get_cors_origins_regex(self) -> List[str]:
        """Get CORS origins as regex patterns."""
        import re

        patterns = []
        for origin in self.cors_origins:
            if origin == "*":
                patterns.append(".*")
            elif "*" in origin:
                # Convert wildcard to regex
                pattern = origin.replace("*", ".*")
                patterns.append(f"^{pattern}$")
            else:
                patterns.append(f"^{origin}$")

        return patterns


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Database connection helper
def get_database_url(
    host: str = None,
    port: int = None,
    user: str = None,
    password: str = None,
    database: str = None,
    ssl_mode: str = None,
) -> str:
    """Build database URL from components."""
    settings = get_settings()

    # Parse existing URL to extract defaults
    if settings.database_url:
        import urllib.parse

        parsed = urllib.parse.urlparse(settings.database_url)

        host = host or parsed.hostname
        port = port or (parsed.port if parsed.port else 5432)
        user = user or parsed.username
        password = password or parsed.password
        database = database or parsed.path.lstrip("/")

        # Extract SSL mode from query parameters
        query = urllib.parse.parse_qs(parsed.query)
        ssl_mode = ssl_mode or query.get("sslmode", [None])[0]

    # Build connection URL
    auth_part = ""
    if user:
        auth_part = user
        if password:
            auth_part += f":{password}"
        auth_part += "@"

    port_part = f":{port}" if port else ""
    query_part = f"?sslmode={ssl_mode}" if ssl_mode else ""

    return f"postgresql+asyncpg://{auth_part}{host}{port_part}/{database}{query_part}"


# Redis connection helper
def get_redis_url(
    host: str = None,
    port: int = None,
    db: int = None,
    password: str = None,
) -> str:
    """Build Redis URL from components."""
    settings = get_settings()

    # Parse existing URL to extract defaults
    if settings.redis_url:
        import urllib.parse

        parsed = urllib.parse.urlparse(settings.redis_url)

        host = host or parsed.hostname
        port = port or (parsed.port if parsed.port else 6379)
        db = db or (parsed.path.lstrip("/") if parsed.path else 0)
        password = password or parsed.password

    # Build connection URL
    auth_part = f":{password}@" if password else ""
    db_part = f"/{db}" if db != 0 else ""

    return f"redis://{auth_part}{host}:{port}{db_part}"


# Environment-specific settings
def get_environment_overrides() -> Dict[str, Any]:
    """Get environment-specific setting overrides."""
    settings = get_settings()
    overrides = {}

    if settings.is_production:
        overrides.update(
            {
                "debug": False,
                "log_level": "WARNING",
                "db_echo": False,
                "rate_limit_enabled": True,
                "monitoring_enabled": True,
                "dlp_enabled": True,
            }
        )
    elif settings.is_development:
        overrides.update(
            {
                "debug": True,
                "log_level": "DEBUG",
                "db_echo": True,
                "rate_limit_enabled": False,
                "monitoring_enabled": True,
                "dlp_enabled": True,
            }
        )
    elif settings.is_test:
        overrides.update(
            {
                "debug": False,
                "log_level": "ERROR",
                "db_echo": False,
                "rate_limit_enabled": False,
                "monitoring_enabled": False,
                "dlp_enabled": False,
                # Use separate test database
                "database_url": settings.database_url.replace(
                    "/sdlc_platform", "/sdlc_platform_test"
                ),
            }
        )

    return overrides


# Feature flags
def get_feature_flags() -> Dict[str, bool]:
    """Get feature flag settings."""
    settings = get_settings()

    return {
        "rate_limiting": settings.rate_limit_enabled,
        "monitoring": settings.monitoring_enabled,
        "dlp_scanning": settings.dlp_enabled,
        "batch_processing": settings.max_concurrent_batches > 0,
        "file_upload": settings.storage_type is not None,
        "vector_search": settings.vector_db_url is not None,
        "openai_integration": settings.openai_api_key is not None,
        "anthropic_integration": settings.anthropic_api_key is not None,
        "sentence_transformers": settings.sentence_transformer_model is not None,
    }
