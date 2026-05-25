"""
Embedding Models

Data models, enums, exceptions, and request/response types.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID


class EmbeddingProvider(str, Enum):
    """Supported embedding providers."""

    OPENAI = "openai"
    COHERE = "cohere"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    ONNX = "onnx"


class EmbeddingModel(str, Enum):
    """Supported embedding models."""

    OPENAI_ADA_002 = "text-embedding-ada-002"
    OPENAI_SMALL_3 = "text-embedding-3-small"
    OPENAI_LARGE_3 = "text-embedding-3-large"
    COHERE_EMBED_EN_V3 = "embed-english-v3.0"
    COHERE_EMBED_MULTILANG_V3 = "embed-multilingual-v3.0"
    SENTENCE_MINILM_L6_V2 = "all-MiniLM-L6-v2"
    SENTENCE_MPNET_BASE_V2 = "all-mpnet-base-v2"
    SENTENCE_BERT_BASE_NLI_MEAN_TOKENS = (
        "sentence-transformers/bert-base-nli-mean-tokens"
    )
    ONNX_MINILM_L6_V2 = "all-MiniLM-L6-v2-onnx"
    ONNX_MPNET_BASE_V2 = "all-mpnet-base-v2-onnx"


@dataclass
class EmbeddingRequest:
    """Embedding generation request."""

    texts: List[str]
    provider: EmbeddingProvider
    model: EmbeddingModel
    tenant_id: UUID
    user_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    priority: int = 1

    def __post_init__(self):
        if not self.texts:
            raise ValueError("At least one text is required")
        if any(not text.strip() for text in self.texts):
            raise ValueError("Texts cannot be empty")


@dataclass
class EmbeddingResponse:
    """Embedding generation response."""

    embeddings: List[List[float]]
    model: str
    provider: str
    dimensions: int
    usage: Dict[str, Any]
    processing_time_ms: int
    cached_count: int = 0
    error_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def total_tokens(self) -> int:
        return self.usage.get("total_tokens", 0)

    @property
    def cost_estimate_usd(self) -> float:
        return self.metadata.get("cost_estimate_usd", 0.0)


@dataclass
class EmbeddingMetrics:
    """Embedding generation metrics."""

    request_id: str
    provider: str
    model: str
    texts_count: int
    tokens_used: int
    processing_time_ms: int
    cache_hit_rate: float
    cost_usd: float
    error_rate: float
    quality_score: Optional[float] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)


class EmbeddingError(Exception):
    """Base exception for embedding errors."""

    def __init__(self, message, provider=None, model=None, error_code=None):
        self.provider = provider
        self.model = model
        self.error_code = error_code
        super().__init__(message)


class ProviderError(EmbeddingError):
    pass


class RateLimitError(EmbeddingError):
    pass


class QuotaExceededError(EmbeddingError):
    pass


class ValidationError(EmbeddingError):
    pass
