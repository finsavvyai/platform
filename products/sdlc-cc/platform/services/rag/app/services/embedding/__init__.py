"""
Embedding Service Package

Re-exports all public types for backward compatibility.
"""

from typing import List, Optional
from uuid import UUID

from .models import (
    EmbeddingProvider,
    EmbeddingModel,
    EmbeddingRequest,
    EmbeddingResponse,
    EmbeddingMetrics,
    EmbeddingError,
    ProviderError,
    RateLimitError,
    QuotaExceededError,
    ValidationError,
)
from .providers import EmbeddingProviderABC
from .cache import EmbeddingCache
from .service import EmbeddingService

_embedding_service: Optional[EmbeddingService] = None


async def get_embedding_service() -> EmbeddingService:
    """Get global embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
        await _embedding_service.initialize()
    return _embedding_service


async def generate_embeddings(
    texts: List[str],
    provider: EmbeddingProvider = EmbeddingProvider.SENTENCE_TRANSFORMERS,
    model: EmbeddingModel = EmbeddingModel.SENTENCE_MINILM_L6_V2,
    tenant_id: UUID = None,
    **kwargs,
) -> EmbeddingResponse:
    """Generate embeddings for texts."""
    service = await get_embedding_service()
    request = EmbeddingRequest(
        texts=texts, provider=provider, model=model,
        tenant_id=tenant_id or UUID(int=0), **kwargs,
    )
    return await service.generate_embeddings(request)


async def process_document_chunks_with_embeddings(chunks, provider=None, model=None):
    """Process document chunks with embeddings."""
    service = await get_embedding_service()
    return await service.process_document_chunks(chunks, provider, model)


__all__ = [
    "EmbeddingProvider",
    "EmbeddingModel",
    "EmbeddingRequest",
    "EmbeddingResponse",
    "EmbeddingMetrics",
    "EmbeddingError",
    "ProviderError",
    "RateLimitError",
    "QuotaExceededError",
    "ValidationError",
    "EmbeddingProviderABC",
    "EmbeddingCache",
    "EmbeddingService",
    "get_embedding_service",
    "generate_embeddings",
    "process_document_chunks_with_embeddings",
]
