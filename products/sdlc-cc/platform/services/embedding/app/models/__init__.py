"""
Embedding service models package.

This package contains all the data models used by the embedding service,
including database models, Pydantic schemas, and domain models.
"""

from .base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin
from .embedding import (
    EmbeddingJob,
    EmbeddingProvider,
    EmbeddingCache,
    EmbeddingQuality,
    EmbeddingMetadata,
    EmbeddingBatch,
    EmbeddingCost,
)
from .schemas import (
    EmbeddingJobCreate,
    EmbeddingJobResponse,
    EmbeddingJobUpdate,
    EmbeddingProviderCreate,
    EmbeddingProviderResponse,
    EmbeddingBatchCreate,
    EmbeddingBatchResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
    EmbeddingQualityReport,
    CostReport,
)

__all__ = [
    # Base models
    "Base",
    "SoftDeleteMixin",
    "TenantMixin",
    "TimestampMixin",
    # Database models
    "EmbeddingJob",
    "EmbeddingProvider",
    "EmbeddingCache",
    "EmbeddingQuality",
    "EmbeddingMetadata",
    "EmbeddingBatch",
    "EmbeddingCost",
    # Pydantic schemas
    "EmbeddingJobCreate",
    "EmbeddingJobResponse",
    "EmbeddingJobUpdate",
    "EmbeddingProviderCreate",
    "EmbeddingProviderResponse",
    "EmbeddingBatchCreate",
    "EmbeddingBatchResponse",
    "EmbeddingRequest",
    "EmbeddingResponse",
    "BatchEmbeddingRequest",
    "BatchEmbeddingResponse",
    "EmbeddingQualityReport",
    "CostReport",
]
