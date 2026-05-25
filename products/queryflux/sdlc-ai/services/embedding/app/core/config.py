"""
Configuration settings for the Embedding Service.

This module manages all configuration parameters including database connections,
API keys, provider settings, and service configuration.
"""

import os
from functools import lru_cache
from typing import Dict, List, Optional, Union

from pydantic import Field, validator
from pydantic_settings import BaseSettings


class DatabaseSettings(BaseSettings):
    """Database configuration settings."""

    url: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/sdlc",
        description="Database connection URL",
    )
    pool_size: int = Field(default=10, ge=1, le=100, description="Database pool size")
    max_overflow: int = Field(
        default=20, ge=0, le=100, description="Database pool overflow"
    )
    pool_timeout: int = Field(
        default=30, ge=1, le=300, description="Pool timeout in seconds"
    )
    pool_recycle: int = Field(
        default=3600, ge=60, description="Pool recycle time in seconds"
    )
    echo: bool = Field(default=False, description="Enable SQL query logging")


class RedisSettings(BaseSettings):
    """Redis configuration settings."""

    url: str = Field(
        default="redis://localhost:6379/0", description="Redis connection URL"
    )
    max_connections: int = Field(
        default=20, ge=1, le=100, description="Maximum Redis connections"
    )
    socket_timeout: int = Field(
        default=5, ge=1, le=30, description="Socket timeout in seconds"
    )
    socket_connect_timeout: int = Field(
        default=5, ge=1, le=30, description="Connection timeout in seconds"
    )
    health_check_interval: int = Field(
        default=30, ge=10, description="Health check interval in seconds"
    )


class OpenAISettings(BaseSettings):
    """OpenAI API configuration settings."""

    api_key: str = Field(..., description="OpenAI API key")
    organization_id: Optional[str] = Field(
        default=None, description="OpenAI organization ID"
    )
    base_url: str = Field(
        default="https://api.openai.com/v1", description="OpenAI API base URL"
    )
    timeout: int = Field(
        default=60, ge=1, le=300, description="Request timeout in seconds"
    )
    max_retries: int = Field(
        default=3, ge=0, le=10, description="Maximum retry attempts"
    )
    retry_delay: float = Field(
        default=1.0, ge=0.1, le=10.0, description="Retry delay in seconds"
    )

    # Model settings
    default_model: str = Field(
        default="text-embedding-3-small", description="Default embedding model"
    )
    available_models: List[str] = Field(
        default=[
            "text-embedding-ada-002",
            "text-embedding-3-small",
            "text-embedding-3-large",
        ],
        description="Available OpenAI embedding models",
    )

    # Rate limiting
    requests_per_minute: int = Field(
        default=3000, ge=1, description="Requests per minute limit"
    )
    tokens_per_minute: int = Field(
        default=160000, ge=1, description="Tokens per minute limit"
    )

    class Config:
        env_prefix = "OPENAI_"


class CohereSettings(BaseSettings):
    """Cohere API configuration settings."""

    api_key: str = Field(..., description="Cohere API key")
    base_url: str = Field(
        default="https://api.cohere.ai/v1", description="Cohere API base URL"
    )
    timeout: int = Field(
        default=60, ge=1, le=300, description="Request timeout in seconds"
    )
    max_retries: int = Field(
        default=3, ge=0, le=10, description="Maximum retry attempts"
    )
    retry_delay: float = Field(
        default=1.0, ge=0.1, le=10.0, description="Retry delay in seconds"
    )

    # Model settings
    default_model: str = Field(
        default="embed-english-v3.0", description="Default embedding model"
    )
    available_models: List[str] = Field(
        default=[
            "embed-english-v3.0",
            "embed-multilingual-v3.0",
            "embed-english-light-v3.0",
            "embed-multilingual-light-v3.0",
        ],
        description="Available Cohere embedding models",
    )

    # Rate limiting
    requests_per_minute: int = Field(
        default=1000, ge=1, description="Requests per minute limit"
    )

    class Config:
        env_prefix = "COHERE_"


class LocalModelSettings(BaseSettings):
    """Local model configuration settings."""

    models_directory: str = Field(
        default="/app/models", description="Directory to store local models"
    )
    default_model: str = Field(
        default="all-MiniLM-L6-v2", description="Default local model"
    )
    device: str = Field(
        default="cpu", description="Device to run models on (cpu, cuda, mps)"
    )
    batch_size: int = Field(
        default=32, ge=1, le=256, description="Batch size for local inference"
    )
    max_length: int = Field(
        default=512, ge=1, le=8192, description="Maximum sequence length"
    )

    # Model cache settings
    cache_size: int = Field(
        default=3, ge=1, le=10, description="Number of models to cache in memory"
    )
    download_timeout: int = Field(
        default=300, ge=60, description="Model download timeout in seconds"
    )

    # ONNX settings
    use_onnx: bool = Field(default=False, description="Use ONNX runtime for inference")
    onnx_optimization_level: str = Field(
        default="all", description="ONNX optimization level"
    )

    class Config:
        env_prefix = "LOCAL_MODEL_"


class CacheSettings(BaseSettings):
    """Caching configuration settings."""

    ttl_seconds: int = Field(
        default=86400, ge=3600, description="Cache TTL in seconds (default 24h)"
    )
    max_size: int = Field(
        default=10000, ge=100, description="Maximum number of cached embeddings"
    )
    compression_enabled: bool = Field(
        default=True, description="Enable cache compression"
    )
    cleanup_interval: int = Field(
        default=3600, ge=60, description="Cleanup interval in seconds"
    )
    eviction_policy: str = Field(
        default="lru", description="Cache eviction policy (lru, lfu, random)"
    )

    # Cache warming
    warm_up_enabled: bool = Field(default=True, description="Enable cache warming")
    warm_up_batch_size: int = Field(
        default=100, ge=1, description="Batch size for cache warming"
    )
    warm_up_threshold: int = Field(
        default=10, ge=1, description="Minimum access count for warming"
    )


class BatchProcessingSettings(BaseSettings):
    """Batch processing configuration settings."""

    max_batch_size: int = Field(
        default=1000, ge=1, le=10000, description="Maximum batch size"
    )
    default_batch_size: int = Field(
        default=100, ge=1, le=1000, description="Default batch size"
    )
    concurrent_batches: int = Field(
        default=5, ge=1, le=20, description="Number of concurrent batches"
    )
    processing_timeout: int = Field(
        default=3600, ge=60, description="Batch processing timeout in seconds"
    )
    retry_attempts: int = Field(
        default=3, ge=0, le=10, description="Number of retry attempts"
    )
    retry_delay: float = Field(
        default=5.0, ge=0.1, le=60.0, description="Retry delay in seconds"
    )

    # Queue settings
    queue_name: str = Field(
        default="embedding_jobs", description="Queue name for batch jobs"
    )
    result_ttl: int = Field(default=86400, ge=3600, description="Result TTL in seconds")

    class Config:
        env_prefix = "BATCH_"


class CostOptimizationSettings(BaseSettings):
    """Cost optimization configuration settings."""

    enabled: bool = Field(default=True, description="Enable cost optimization")
    budget_per_tenant: float = Field(
        default=100.0, ge=0, description="Monthly budget per tenant in USD"
    )
    cost_threshold: float = Field(
        default=0.8, ge=0.1, le=1.0, description="Cost alert threshold"
    )
    optimization_strategy: str = Field(
        default="balanced",
        description="Optimization strategy (cost, quality, balanced)",
    )

    # Provider costs (per 1M tokens)
    provider_costs: Dict[str, Dict[str, float]] = Field(
        default={
            "openai": {
                "text-embedding-ada-002": 0.0004,
                "text-embedding-3-small": 0.00002,
                "text-embedding-3-large": 0.00013,
            },
            "cohere": {
                "embed-english-v3.0": 0.0001,
                "embed-multilingual-v3.0": 0.0001,
            },
        },
        description="Provider costs per 1M tokens",
    )

    class Config:
        env_prefix = "COST_"


class QualitySettings(BaseSettings):
    """Quality validation configuration settings."""

    enabled: bool = Field(default=True, description="Enable quality validation")
    similarity_threshold: float = Field(
        default=0.8, ge=0.0, le=1.0, description="Similarity threshold for validation"
    )
    consistency_threshold: float = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
        description="Consistency threshold across providers",
    )
    anomaly_threshold: float = Field(
        default=2.0,
        ge=1.0,
        le=5.0,
        description="Anomaly detection threshold (std devs)",
    )

    # Validation settings
    sample_size: int = Field(
        default=100, ge=10, le=1000, description="Sample size for validation"
    )
    validation_frequency: int = Field(
        default=1000, ge=100, description="Validation frequency in embeddings"
    )

    class Config:
        env_prefix = "QUALITY_"


class MonitoringSettings(BaseSettings):
    """Monitoring configuration settings."""

    enabled: bool = Field(default=True, description="Enable monitoring")
    metrics_port: int = Field(
        default=9090, ge=1024, le=65535, description="Metrics port"
    )
    health_check_interval: int = Field(
        default=30, ge=10, description="Health check interval in seconds"
    )
    log_level: str = Field(default="INFO", description="Log level")
    structured_logging: bool = Field(
        default=True, description="Enable structured logging"
    )

    # Alerting
    alert_webhook_url: Optional[str] = Field(
        default=None, description="Webhook URL for alerts"
    )
    error_rate_threshold: float = Field(
        default=0.05, ge=0.0, le=1.0, description="Error rate alert threshold"
    )
    latency_threshold: float = Field(
        default=5.0, ge=0.1, description="Latency alert threshold in seconds"
    )

    class Config:
        env_prefix = "MONITORING_"


class SecuritySettings(BaseSettings):
    """Security configuration settings."""

    jwt_secret_key: str = Field(..., description="JWT secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    jwt_expiration: int = Field(
        default=3600, ge=300, description="JWT expiration in seconds"
    )

    # Rate limiting
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_requests_per_minute: int = Field(
        default=100, ge=1, description="Rate limit requests per minute"
    )

    # API keys
    api_key_header: str = Field(default="X-API-Key", description="API key header name")

    class Config:
        env_prefix = "SECURITY_"


class Settings(BaseSettings):
    """Main application settings."""

    # Application
    app_name: str = Field(default="Embedding Service", description="Application name")
    app_version: str = Field(default="1.0.0", description="Application version")
    debug: bool = Field(default=False, description="Enable debug mode")
    environment: str = Field(
        default="development",
        description="Environment (development, staging, production)",
    )
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8003, ge=1024, le=65535, description="Server port")

    # Service URLs
    gateway_url: str = Field(
        default="http://localhost:8080", description="Gateway service URL"
    )
    rag_service_url: str = Field(
        default="http://localhost:8001", description="RAG service URL"
    )

    # Sub-settings
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    openai: OpenAISettings = Field(default_factory=OpenAISettings)
    cohere: CohereSettings = Field(default_factory=CohereSettings)
    local_model: LocalModelSettings = Field(default_factory=LocalModelSettings)
    cache: CacheSettings = Field(default_factory=CacheSettings)
    batch_processing: BatchProcessingSettings = Field(
        default_factory=BatchProcessingSettings
    )
    cost_optimization: CostOptimizationSettings = Field(
        default_factory=CostOptimizationSettings
    )
    quality: QualitySettings = Field(default_factory=QualitySettings)
    monitoring: MonitoringSettings = Field(default_factory=MonitoringSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)

    @validator("environment")
    def validate_environment(cls, v):
        """Validate environment value."""
        valid_envs = ["development", "staging", "production"]
        if v not in valid_envs:
            raise ValueError(f"Environment must be one of: {valid_envs}")
        return v

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment == "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
