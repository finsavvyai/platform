"""
Pydantic schemas for the embedding service API.

This module contains all the Pydantic models used for API requests,
responses, and data validation in the embedding service.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator

from .embedding import JobStatus, ProviderType, QualityLevel


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v),
            uuid.UUID: lambda v: str(v),
        }


class TenantMixin(BaseModel):
    """Mixin for tenant-scoped schemas."""

    tenant_id: uuid.UUID = Field(..., description="Tenant ID")


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""

    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


# Request schemas
class EmbeddingRequest(BaseSchema):
    """Schema for single embedding request."""

    text: str = Field(..., min_length=1, max_length=100000, description="Text to embed")
    provider: Optional[str] = Field(None, description="Embedding provider")
    model: Optional[str] = Field(None, description="Embedding model")
    chunk_id: Optional[uuid.UUID] = Field(None, description="Document chunk ID")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class BatchEmbeddingRequest(BaseSchema, TenantMixin):
    """Schema for batch embedding request."""

    texts: List[str] = Field(
        ..., min_items=1, max_items=10000, description="Texts to embed"
    )
    provider: Optional[str] = Field(None, description="Embedding provider")
    model: Optional[str] = Field(None, description="Embedding model")
    batch_size: int = Field(default=100, ge=1, le=1000, description="Batch size")
    priority: int = Field(default=0, ge=0, le=10, description="Job priority")
    job_name: Optional[str] = Field(None, description="Job name for tracking")
    source_type: str = Field(default="text", description="Source type")
    source_id: Optional[uuid.UUID] = Field(None, description="Source identifier")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    @validator("texts")
    def validate_texts(cls, v):
        """Validate texts list."""
        if not v:
            raise ValueError("At least one text must be provided")
        total_length = sum(len(text) for text in v)
        if total_length > 10000000:  # 10MB limit
            raise ValueError("Total text length exceeds 10MB limit")
        return v


class EmbeddingJobCreate(BaseSchema, TenantMixin):
    """Schema for creating an embedding job."""

    job_name: str = Field(..., min_length=1, max_length=255, description="Job name")
    job_type: str = Field(default="single", description="Job type")
    source_type: str = Field(..., description="Source type")
    source_id: Optional[uuid.UUID] = Field(None, description="Source ID")
    provider: str = Field(..., description="Provider")
    model: str = Field(..., description="Model")
    model_version: str = Field(default="latest", description="Model version")
    input_text_count: int = Field(..., ge=1, description="Number of input texts")
    total_token_count: int = Field(default=0, ge=0, description="Total token count")
    total_character_count: int = Field(
        default=0, ge=0, description="Total character count"
    )
    batch_size: int = Field(default=1, ge=1, description="Batch size")
    priority: int = Field(default=0, ge=0, description="Priority")


class EmbeddingJobUpdate(BaseSchema):
    """Schema for updating an embedding job."""

    status: Optional[JobStatus] = Field(None, description="Job status")
    processing_started_at: Optional[datetime] = Field(
        None, description="Processing start time"
    )
    processing_completed_at: Optional[datetime] = Field(
        None, description="Processing completion time"
    )
    processing_duration_ms: Optional[int] = Field(
        None, ge=0, description="Processing duration"
    )
    error_message: Optional[str] = Field(None, description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
    retry_count: Optional[int] = Field(None, ge=0, description="Retry count")


class EmbeddingProviderCreate(BaseSchema, TenantMixin):
    """Schema for creating an embedding provider."""

    name: str = Field(..., min_length=1, max_length=100, description="Provider name")
    provider_type: ProviderType = Field(..., description="Provider type")
    base_url: Optional[str] = Field(None, description="Base URL")
    api_version: str = Field(default="v1", description="API version")
    requests_per_minute: int = Field(
        default=1000, ge=1, description="Requests per minute"
    )
    tokens_per_minute: int = Field(
        default=100000, ge=1, description="Tokens per minute"
    )
    cost_per_1m_tokens: Decimal = Field(..., ge=0, description="Cost per 1M tokens")
    supported_dimensions: List[int] = Field(
        default=[], description="Supported dimensions"
    )
    max_sequence_length: int = Field(
        default=512, ge=1, description="Max sequence length"
    )
    health_check_url: Optional[str] = Field(None, description="Health check URL")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class EmbeddingBatchCreate(BaseSchema):
    """Schema for creating an embedding batch."""

    job_id: uuid.UUID = Field(..., description="Job ID")
    batch_index: int = Field(..., ge=0, description="Batch index")
    input_text_count: int = Field(..., ge=1, description="Input text count")
    token_count: int = Field(..., ge=0, description="Token count")


# Response schemas
class EmbeddingResponse(BaseSchema):
    """Schema for embedding response."""

    embedding: List[float] = Field(..., description="Embedding vector")
    dimensions: int = Field(..., description="Embedding dimensions")
    provider: str = Field(..., description="Provider used")
    model: str = Field(..., description="Model used")
    processing_time_ms: int = Field(..., description="Processing time in ms")
    token_count: int = Field(..., description="Token count")
    cache_hit: bool = Field(default=False, description="Whether result came from cache")
    quality_score: Optional[float] = Field(None, description="Quality score")


class BatchEmbeddingResponse(BaseSchema):
    """Schema for batch embedding response."""

    job_id: uuid.UUID = Field(..., description="Job ID")
    status: JobStatus = Field(..., description="Job status")
    total_texts: int = Field(..., description="Total number of texts")
    processed_texts: int = Field(..., description="Number of processed texts")
    failed_texts: int = Field(..., description="Number of failed texts")
    embeddings: List[EmbeddingResponse] = Field(..., description="Embedding results")
    errors: List[str] = Field(default=[], description="Processing errors")
    estimated_completion: Optional[datetime] = Field(
        None, description="Estimated completion time"
    )


class EmbeddingJobResponse(BaseSchema, TenantMixin, TimestampMixin):
    """Schema for embedding job response."""

    id: uuid.UUID = Field(..., description="Job ID")
    job_name: str = Field(..., description="Job name")
    job_type: str = Field(..., description="Job type")
    status: JobStatus = Field(..., description="Job status")

    source_type: str = Field(..., description="Source type")
    source_id: Optional[uuid.UUID] = Field(None, description="Source ID")

    provider: str = Field(..., description="Provider")
    model: str = Field(..., description="Model")
    model_version: str = Field(..., description="Model version")

    input_text_count: int = Field(..., description="Input text count")
    total_token_count: int = Field(..., description="Total token count")
    total_character_count: int = Field(..., description="Total character count")

    processing_started_at: Optional[datetime] = Field(
        None, description="Processing start"
    )
    processing_completed_at: Optional[datetime] = Field(
        None, description="Processing completion"
    )
    processing_duration_ms: Optional[int] = Field(
        None, description="Processing duration"
    )

    error_message: Optional[str] = Field(None, description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
    retry_count: int = Field(..., description="Retry count")

    batch_size: int = Field(..., description="Batch size")
    priority: int = Field(..., description="Priority")

    # Computed properties
    is_completed: bool = Field(..., description="Is completed")
    is_failed: bool = Field(..., description="Is failed")
    is_processing: bool = Field(..., description="Is processing")
    processing_time_seconds: Optional[float] = Field(
        None, description="Processing time in seconds"
    )

    # Nested relationships
    batches: List["EmbeddingBatchResponse"] = Field(default=[], description="Batches")


class EmbeddingBatchResponse(BaseSchema, TenantMixin, TimestampMixin):
    """Schema for embedding batch response."""

    id: uuid.UUID = Field(..., description="Batch ID")
    job_id: uuid.UUID = Field(..., description="Job ID")
    batch_index: int = Field(..., description="Batch index")
    input_text_count: int = Field(..., description="Input text count")
    token_count: int = Field(..., description="Token count")

    processing_started_at: Optional[datetime] = Field(
        None, description="Processing start"
    )
    processing_completed_at: Optional[datetime] = Field(
        None, description="Processing completion"
    )
    processing_duration_ms: Optional[int] = Field(
        None, description="Processing duration"
    )

    error_message: Optional[str] = Field(None, description="Error message")
    retry_count: int = Field(..., description="Retry count")


class EmbeddingProviderResponse(BaseSchema, TenantMixin, TimestampMixin):
    """Schema for embedding provider response."""

    id: uuid.UUID = Field(..., description="Provider ID")
    name: str = Field(..., description="Provider name")
    provider_type: ProviderType = Field(..., description="Provider type")
    status: str = Field(..., description="Status")

    base_url: Optional[str] = Field(None, description="Base URL")
    api_version: str = Field(..., description="API version")

    requests_per_minute: int = Field(..., description="Requests per minute")
    tokens_per_minute: int = Field(..., description="Tokens per minute")

    cost_per_1m_tokens: Decimal = Field(..., description="Cost per 1M tokens")
    supported_dimensions: List[int] = Field(..., description="Supported dimensions")
    max_sequence_length: int = Field(..., description="Max sequence length")

    is_available: bool = Field(..., description="Is available")
    health_check_url: Optional[str] = Field(None, description="Health check URL")
    last_health_check: Optional[datetime] = Field(None, description="Last health check")

    average_quality_score: Optional[float] = Field(
        None, description="Average quality score"
    )
    total_requests: int = Field(..., description="Total requests")
    successful_requests: int = Field(..., description="Successful requests")

    metadata: Dict[str, Any] = Field(..., description="Additional metadata")

    # Computed properties
    success_rate: float = Field(..., description="Success rate")
    is_healthy: bool = Field(..., description="Is healthy")


class EmbeddingQualityReport(BaseSchema):
    """Schema for embedding quality report."""

    job_id: uuid.UUID = Field(..., description="Job ID")
    provider: str = Field(..., description="Provider")
    model: str = Field(..., description="Model")

    overall_quality_score: float = Field(..., description="Overall quality score")
    consistency_score: float = Field(..., description="Consistency score")
    similarity_score: float = Field(..., description="Similarity score")
    anomaly_score: Optional[float] = Field(None, description="Anomaly score")

    validation_passed: bool = Field(..., description="Validation passed")
    validation_issues: List[str] = Field(..., description="Validation issues")
    sample_size: int = Field(..., description="Sample size")

    quality_level: QualityLevel = Field(..., description="Quality level")
    recommendations: List[str] = Field(default=[], description="Recommendations")


class CostReport(BaseSchema):
    """Schema for cost report."""

    period_start: datetime = Field(..., description="Period start")
    period_end: datetime = Field(..., description="Period end")

    provider: str = Field(..., description="Provider")
    model: str = Field(..., description="Model")

    total_requests: int = Field(..., description="Total requests")
    total_tokens: int = Field(..., description="Total tokens")
    total_embeddings: int = Field(..., description="Total embeddings")

    cost_per_token: Decimal = Field(..., description="Cost per token")
    total_cost: Decimal = Field(..., description="Total cost")

    budget_allocated: Decimal = Field(..., description="Budget allocated")
    budget_remaining: Decimal = Field(..., description="Budget remaining")

    # Computed properties
    budget_utilization: float = Field(..., description="Budget utilization")
    is_over_budget: bool = Field(..., description="Is over budget")
    budget_warning_threshold: bool = Field(..., description="Budget warning threshold")


class HealthCheckResponse(BaseSchema):
    """Schema for health check response."""

    status: str = Field(..., description="Overall status")
    timestamp: datetime = Field(..., description="Check timestamp")
    version: str = Field(..., description="Service version")

    services: Dict[str, Dict[str, Any]] = Field(..., description="Service statuses")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="System metrics")


class MetricsResponse(BaseSchema):
    """Schema for metrics response."""

    timestamp: datetime = Field(..., description="Metrics timestamp")

    # Request metrics
    total_requests: int = Field(..., description="Total requests")
    successful_requests: int = Field(..., description="Successful requests")
    failed_requests: int = Field(..., description="Failed requests")
    average_response_time: float = Field(..., description="Average response time")

    # Cache metrics
    cache_hit_rate: float = Field(..., description="Cache hit rate")
    cache_size: int = Field(..., description="Cache size")

    # Cost metrics
    total_cost: Decimal = Field(..., description="Total cost")
    cost_per_request: Decimal = Field(..., description="Cost per request")

    # Provider metrics
    provider_metrics: Dict[str, Dict[str, Any]] = Field(
        ..., description="Provider metrics"
    )


class ErrorResponse(BaseSchema):
    """Schema for error responses."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Error details")
    timestamp: datetime = Field(..., description="Error timestamp")
    request_id: Optional[str] = Field(None, description="Request ID for tracing")


# Filter and query schemas
class EmbeddingJobFilter(BaseSchema):
    """Schema for filtering embedding jobs."""

    status: Optional[JobStatus] = Field(None, description="Job status")
    provider: Optional[str] = Field(None, description="Provider")
    model: Optional[str] = Field(None, description="Model")
    source_type: Optional[str] = Field(None, description="Source type")
    created_after: Optional[datetime] = Field(None, description="Created after")
    created_before: Optional[datetime] = Field(None, description="Created before")
    min_priority: Optional[int] = Field(None, ge=0, description="Minimum priority")
    max_priority: Optional[int] = Field(None, ge=0, description="Maximum priority")
    limit: int = Field(default=50, ge=1, le=1000, description="Limit")
    offset: int = Field(default=0, ge=0, description="Offset")


class EmbeddingProviderFilter(BaseSchema):
    """Schema for filtering embedding providers."""

    provider_type: Optional[ProviderType] = Field(None, description="Provider type")
    status: Optional[str] = Field(None, description="Status")
    is_available: Optional[bool] = Field(None, description="Is available")
    min_quality_score: Optional[float] = Field(
        None, ge=0, le=1, description="Minimum quality score"
    )
    limit: int = Field(default=50, ge=1, le=1000, description="Limit")
    offset: int = Field(default=0, ge=0, description="Offset")


class EmbeddingCacheStats(BaseSchema):
    """Schema for cache statistics."""

    total_entries: int = Field(..., description="Total cache entries")
    hit_rate: float = Field(..., description="Cache hit rate")
    miss_rate: float = Field(..., description="Cache miss rate")
    average_access_count: float = Field(..., description="Average access count")
    total_memory_usage: int = Field(..., description="Total memory usage in bytes")
    expired_entries: int = Field(..., description="Number of expired entries")
    entries_by_provider: Dict[str, int] = Field(..., description="Entries by provider")
    entries_by_model: Dict[str, int] = Field(..., description="Entries by model")


# Update forward references
EmbeddingJobResponse.model_rebuild()
