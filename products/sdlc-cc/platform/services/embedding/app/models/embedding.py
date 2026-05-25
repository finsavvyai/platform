"""
Embedding-related database models.

This module contains all the database models related to embeddings,
including jobs, providers, cache, quality metrics, and cost tracking.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID, VECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import (
    AuditMixin,
    Base,
    MetadataMixin,
    SoftDeleteMixin,
    StatusMixin,
    TenantMixin,
    TimestampMixin,
    VersionMixin,
)


class JobStatus(str, Enum):
    """Embedding job status enumeration."""

    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class ProviderType(str, Enum):
    """Embedding provider type enumeration."""

    OPENAI = "openai"
    COHERE = "cohere"
    LOCAL = "local"
    CUSTOM = "custom"


class QualityLevel(str, Enum):
    """Embedding quality level enumeration."""

    POOR = "poor"
    FAIR = "fair"
    GOOD = "good"
    EXCELLENT = "excellent"


class EmbeddingJob(Base, TenantMixin, TimestampMixin, SoftDeleteMixin, StatusMixin):
    """Model for tracking embedding generation jobs."""

    __tablename__ = "embedding_jobs"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        comment="Unique job identifier",
    )

    # Job information
    job_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable job name",
    )
    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="single",
        comment="Job type (single, batch, bulk)",
    )

    # Source information
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Source type (document, chunk, text)",
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="Source identifier",
    )

    # Provider and model information
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Embedding provider",
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Embedding model name",
    )
    model_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="latest",
        comment="Model version",
    )

    # Input information
    input_text_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of input texts",
    )
    total_token_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total token count",
    )
    total_character_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total character count",
    )

    # Processing metrics
    processing_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Processing start time",
    )
    processing_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Processing completion time",
    )
    processing_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Total processing duration in milliseconds",
    )

    # Error information
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Error message if job failed",
    )
    error_code: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Error code if job failed",
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of retry attempts",
    )

    # Configuration
    batch_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Batch size used for processing",
    )
    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Job priority (higher = more important)",
    )

    # Relationships
    batches = relationship(
        "EmbeddingBatch",
        back_populates="job",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("idx_embedding_jobs_status_created", "status", "created_at"),
        Index("idx_embedding_jobs_provider_model", "provider", "model"),
        Index("idx_embedding_jobs_tenant_status", "tenant_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<EmbeddingJob(id={self.id}, status={self.status}, provider={self.provider})>"

    @property
    def is_completed(self) -> bool:
        """Check if the job is completed."""
        return self.status == JobStatus.COMPLETED

    @property
    def is_failed(self) -> bool:
        """Check if the job has failed."""
        return self.status == JobStatus.FAILED

    @property
    def is_processing(self) -> bool:
        """Check if the job is currently processing."""
        return self.status == JobStatus.PROCESSING

    @property
    def processing_time_seconds(self) -> Optional[float]:
        """Get processing time in seconds."""
        if self.processing_started_at and self.processing_completed_at:
            delta = self.processing_completed_at - self.processing_started_at
            return delta.total_seconds()
        return None


class EmbeddingBatch(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """Model for tracking embedding batches within jobs."""

    __tablename__ = "embedding_batches"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Job relationship
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("embedding_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Batch information
    batch_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Index of this batch within the job",
    )
    input_text_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of texts in this batch",
    )
    token_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total token count for this batch",
    )

    # Processing information
    processing_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    processing_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    processing_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    # Error information
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # Relationships
    job = relationship("EmbeddingJob", back_populates="batches")

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "job_id", "batch_index", name="uq_embedding_batches_job_index"
        ),
        Index("idx_embedding_batches_job_status", "job_id", "processing_started_at"),
    )

    def __repr__(self) -> str:
        return f"<EmbeddingBatch(id={self.id}, job_id={self.job_id}, index={self.batch_index})>"


class EmbeddingProvider(Base, TenantMixin, TimestampMixin, MetadataMixin, StatusMixin):
    """Model for managing embedding providers and their configurations."""

    __tablename__ = "embedding_providers"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Provider information
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="Provider name",
    )
    provider_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Provider type",
    )

    # Configuration
    base_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Base URL for the provider API",
    )
    api_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="v1",
        comment="API version",
    )

    # Rate limiting
    requests_per_minute: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1000,
        comment="Requests per minute limit",
    )
    tokens_per_minute: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=100000,
        comment="Tokens per minute limit",
    )

    # Cost information
    cost_per_1m_tokens: Mapped[Decimal] = mapped_column(
        Numeric(10, 6),
        nullable=False,
        default=Decimal("0.001"),
        comment="Cost per 1 million tokens",
    )

    # Capabilities
    supported_dimensions: Mapped[List[int]] = mapped_column(
        ARRAY(Integer),
        default=list,
        nullable=False,
        comment="Supported embedding dimensions",
    )
    max_sequence_length: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=512,
        comment="Maximum sequence length",
    )

    # Health and reliability
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether the provider is available",
    )
    health_check_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="URL for health checks",
    )
    last_health_check: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Quality metrics
    average_quality_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Average quality score",
    )
    total_requests: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total number of requests",
    )
    successful_requests: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of successful requests",
    )

    def __repr__(self) -> str:
        return f"<EmbeddingProvider(id={self.id}, name={self.name}, type={self.provider_type})>"

    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.total_requests == 0:
            return 0.0
        return self.successful_requests / self.total_requests

    @property
    def is_healthy(self) -> bool:
        """Check if provider is healthy."""
        return (
            self.is_available and self.status == "active" and self.success_rate >= 0.95
        )


class EmbeddingCache(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """Model for caching embeddings to reduce API calls."""

    __tablename__ = "embedding_cache"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Cache key
    cache_key: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
        index=True,
        comment="Unique cache key for the content",
    )

    # Content hash
    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="SHA-256 hash of the content",
    )

    # Embedding information
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Provider that generated the embedding",
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Model used for embedding",
    )
    dimensions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Embedding dimensions",
    )

    # The actual embedding
    embedding: Mapped[List[float]] = mapped_column(
        VECTOR(1536),  # Will be adjusted based on actual dimensions
        nullable=False,
        comment="Embedding vector",
    )

    # Cache metadata
    access_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of times this cache entry was accessed",
    )
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last access time",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Cache expiration time",
    )

    # Quality metrics
    quality_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Quality score of the embedding",
    )

    def __repr__(self) -> str:
        return f"<EmbeddingCache(id={self.id}, provider={self.provider}, model={self.model})>"

    @property
    def is_expired(self) -> bool:
        """Check if the cache entry is expired."""
        return datetime.utcnow() > self.expires_at

    def update_access(self) -> None:
        """Update access information."""
        self.access_count += 1
        self.last_accessed_at = datetime.utcnow()


class EmbeddingQuality(Base, TenantMixin, TimestampMixin):
    """Model for tracking embedding quality metrics."""

    __tablename__ = "embedding_quality"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Reference information
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("embedding_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Provider information
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Quality metrics
    overall_quality_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Overall quality score (0-1)",
    )
    consistency_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Consistency score (0-1)",
    )
    similarity_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Similarity score (0-1)",
    )
    anomaly_score: Mapped[float] = mapped_column(
        Float,
        nullable=True,
        comment="Anomaly score (higher is more anomalous)",
    )

    # Validation results
    validation_passed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        comment="Whether validation passed",
    )
    validation_issues: Mapped[List[str]] = mapped_column(
        ARRAY(String),
        default=list,
        nullable=False,
        comment="List of validation issues",
    )

    # Sample information
    sample_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of samples used for validation",
    )

    def __repr__(self) -> str:
        return f"<EmbeddingQuality(id={self.id}, score={self.overall_quality_score})>"


class EmbeddingMetadata(Base, TenantMixin, TimestampMixin, MetadataMixin):
    """Model for storing comprehensive embedding metadata."""

    __tablename__ = "embedding_metadata"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Reference information
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Source type (document, chunk, text)",
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="Source identifier",
    )

    # Provider and model information
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    model_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="latest",
    )

    # Embedding parameters
    dimensions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    max_sequence_length: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    embedding_strategy: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="mean",
        comment="Embedding strategy (mean, cls, max)",
    )

    # Processing metrics
    processing_time_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Processing time in milliseconds",
    )
    token_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Token count",
    )
    character_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Character count",
    )

    # Quality information
    quality_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Quality score",
    )
    validated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When quality was validated",
    )

    def __repr__(self) -> str:
        return f"<EmbeddingMetadata(id={self.id}, provider={self.provider}, model={self.model})>"


class EmbeddingCost(Base, TenantMixin, TimestampMixin):
    """Model for tracking embedding costs and budgets."""

    __tablename__ = "embedding_costs"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Time period
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Start of the billing period",
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="End of the billing period",
    )

    # Provider breakdown
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Usage metrics
    total_requests: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total number of requests",
    )
    total_tokens: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
        comment="Total number of tokens processed",
    )
    total_embeddings: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total number of embeddings generated",
    )

    # Cost information
    cost_per_token: Mapped[Decimal] = mapped_column(
        Numeric(10, 8),
        nullable=False,
        comment="Cost per token",
    )
    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        default=Decimal("0.0000"),
        comment="Total cost for the period",
    )

    # Budget information
    budget_allocated: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        default=Decimal("0.0000"),
        comment="Allocated budget for the period",
    )
    budget_remaining: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        default=Decimal("0.0000"),
        comment="Remaining budget for the period",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "period_start", "period_end", "provider", "model"
        ),
        Index("idx_embedding_costs_period", "tenant_id", "period_start", "period_end"),
        Index("idx_embedding_costs_provider", "provider", "model"),
    )

    def __repr__(self) -> str:
        return f"<EmbeddingCost(id={self.id}, period={self.period_start}, cost={self.total_cost})>"

    @property
    def budget_utilization(self) -> float:
        """Calculate budget utilization as a percentage."""
        if self.budget_allocated == 0:
            return 0.0
        return float(self.total_cost / self.budget_allocated)

    @property
    def is_over_budget(self) -> bool:
        """Check if over budget."""
        return self.total_cost > self.budget_allocated

    @property
    def budget_warning_threshold(self) -> bool:
        """Check if approaching budget limit (80% threshold)."""
        return self.budget_utilization >= 0.8
