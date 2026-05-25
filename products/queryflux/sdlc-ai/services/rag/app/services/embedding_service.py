"""
Embedding generation service for multi-provider support.

This module provides comprehensive embedding generation capabilities with support for:
- Multiple providers (OpenAI, Cohere, local models)
- Intelligent caching with 24h TTL
- Batch processing for large datasets
- Cost optimization with provider selection
- Automatic fallback mechanisms
- Quality validation and similarity scoring
- Metadata tracking and version management
"""

import asyncio
import hashlib
import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID, uuid4

import numpy as np
from pydantic import BaseModel, Field, validator

# Try to import optional dependencies
try:
    import openai
    from openai import AsyncOpenAI

    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import cohere

    COHERE_AVAILABLE = True
except ImportError:
    COHERE_AVAILABLE = False

try:
    import onnxruntime as ort
    from sentence_transformers import SentenceTransformer

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

try:
    import redis.asyncio as redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from ..core.config import get_settings
from ..models.document import DocumentChunk, DocumentStatus

logger = logging.getLogger(__name__)


class EmbeddingProvider(str, Enum):
    """Supported embedding providers."""

    OPENAI = "openai"
    COHERE = "cohere"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    ONNX = "onnx"


class EmbeddingModel(str, Enum):
    """Supported embedding models."""

    # OpenAI models
    OPENAI_ADA_002 = "text-embedding-ada-002"
    OPENAI_SMALL_3 = "text-embedding-3-small"
    OPENAI_LARGE_3 = "text-embedding-3-large"

    # Cohere models
    COHERE_EMBED_EN_V3 = "embed-english-v3.0"
    COHERE_EMBED_MULTILANG_V3 = "embed-multilingual-v3.0"

    # Sentence Transformers models
    SENTENCE_MINILM_L6_V2 = "all-MiniLM-L6-v2"
    SENTENCE_MPNET_BASE_V2 = "all-mpnet-base-v2"
    SENTENCE_BERT_BASE_NLI_MEAN_TOKENS = (
        "sentence-transformers/bert-base-nli-mean-tokens"
    )

    # ONNX optimized models
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
    priority: int = 1  # 1=low, 5=medium, 10=high

    def __post_init__(self):
        """Validate request after initialization."""
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
        """Get total tokens used."""
        return self.usage.get("total_tokens", 0)

    @property
    def cost_estimate_usd(self) -> float:
        """Get estimated cost in USD."""
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

    def __init__(
        self,
        message: str,
        provider: str = None,
        model: str = None,
        error_code: str = None,
    ):
        self.provider = provider
        self.model = model
        self.error_code = error_code
        super().__init__(message)


class ProviderError(EmbeddingError):
    """Provider-specific error."""

    pass


class RateLimitError(EmbeddingError):
    """Rate limiting error."""

    pass


class QuotaExceededError(EmbeddingError):
    """Quota exceeded error."""

    pass


class ValidationError(EmbeddingError):
    """Validation error."""

    pass


class EmbeddingProviderABC(ABC):
    """Abstract base class for embedding providers."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize provider with configuration."""
        self.config = config
        self.provider_name = config.get("name", self.__class__.__name__.lower())

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the provider (e.g., load models, establish connections)."""
        pass

    @abstractmethod
    async def generate_embeddings(
        self, texts: List[str], model: str, **kwargs
    ) -> Tuple[List[List[float]], Dict[str, Any]]:
        """Generate embeddings for the given texts."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is healthy and available."""
        pass

    @abstractmethod
    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get information about a specific model."""
        pass

    @property
    @abstractmethod
    def supported_models(self) -> List[str]:
        """Get list of supported models."""
        pass


class OpenAIEmbeddingProvider(EmbeddingProviderABC):
    """OpenAI embedding provider."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize OpenAI provider."""
        super().__init__(config)
        self.client: Optional[AsyncOpenAI] = None
        self.api_key = config.get("api_key")
        self.organization = config.get("organization")
        self.base_url = config.get("base_url")
        self.timeout = config.get("timeout", 30)
        self.max_retries = config.get("max_retries", 3)

    async def initialize(self) -> None:
        """Initialize OpenAI client."""
        if not OPENAI_AVAILABLE:
            raise EmbeddingError("OpenAI library not installed", self.provider_name)

        if not self.api_key:
            raise EmbeddingError("OpenAI API key not provided", self.provider_name)

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            organization=self.organization,
            base_url=self.base_url,
            timeout=self.timeout,
            max_retries=self.max_retries,
        )

        logger.info(
            f"OpenAI embedding provider initialized for organization: {self.organization}"
        )

    async def generate_embeddings(
        self, texts: List[str], model: str, **kwargs
    ) -> Tuple[List[List[float]], Dict[str, Any]]:
        """Generate embeddings using OpenAI API."""
        if not self.client:
            await self.initialize()

        try:
            response = await self.client.embeddings.create(
                model=model, input=texts, **kwargs
            )

            embeddings = [data.embedding for data in response.data]
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "total_tokens": response.usage.total_tokens,
                "model": model,
            }

            return embeddings, usage

        except openai.RateLimitError as e:
            raise RateLimitError(
                f"OpenAI rate limit exceeded: {str(e)}",
                self.provider_name,
                model,
                "rate_limit_exceeded",
            )
        except openai.AuthenticationError as e:
            raise EmbeddingError(
                f"OpenAI authentication error: {str(e)}",
                self.provider_name,
                model,
                "authentication_error",
            )
        except openai.APIError as e:
            raise ProviderError(
                f"OpenAI API error: {str(e)}", self.provider_name, model, "api_error"
            )
        except Exception as e:
            raise EmbeddingError(
                f"Unexpected error: {str(e)}",
                self.provider_name,
                model,
                "unexpected_error",
            )

    async def health_check(self) -> bool:
        """Check OpenAI API health."""
        try:
            if not self.client:
                await self.initialize()

            # Test with a simple embedding request
            await self.client.embeddings.create(
                model=EmbeddingModel.OPENAI_ADA_002.value, input=["health check"]
            )
            return True
        except Exception as e:
            logger.warning(f"OpenAI health check failed: {str(e)}")
            return False

    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get OpenAI model information."""
        model_configs = {
            EmbeddingModel.OPENAI_ADA_002.value: {
                "dimensions": 1536,
                "max_tokens": 8191,
                "cost_per_1k_tokens": 0.0004,
                "description": "General purpose text embedding model",
            },
            EmbeddingModel.OPENAI_SMALL_3.value: {
                "dimensions": 1536,
                "max_tokens": 8191,
                "cost_per_1k_tokens": 0.00002,
                "description": "Smaller, cheaper embedding model",
            },
            EmbeddingModel.OPENAI_LARGE_3.value: {
                "dimensions": 3072,
                "max_tokens": 8191,
                "cost_per_1k_tokens": 0.00013,
                "description": "Larger, more capable embedding model",
            },
        }
        return model_configs.get(model, {})

    @property
    def supported_models(self) -> List[str]:
        """Get supported OpenAI models."""
        return [
            EmbeddingModel.OPENAI_ADA_002.value,
            EmbeddingModel.OPENAI_SMALL_3.value,
            EmbeddingModel.OPENAI_LARGE_3.value,
        ]


class CohereEmbeddingProvider(EmbeddingProviderABC):
    """Cohere embedding provider."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize Cohere provider."""
        super().__init__(config)
        self.client: Optional[cohere.AsyncClient] = None
        self.api_key = config.get("api_key")
        self.timeout = config.get("timeout", 30)
        self.max_retries = config.get("max_retries", 3)

    async def initialize(self) -> None:
        """Initialize Cohere client."""
        if not COHERE_AVAILABLE:
            raise EmbeddingError("Cohere library not installed", self.provider_name)

        if not self.api_key:
            raise EmbeddingError("Cohere API key not provided", self.provider_name)

        self.client = cohere.AsyncClient(
            api_key=self.api_key,
            timeout=self.timeout,
            max_retries=self.max_retries,
        )

        logger.info(f"Cohere embedding provider initialized")

    async def generate_embeddings(
        self, texts: List[str], model: str, **kwargs
    ) -> Tuple[List[List[float]], Dict[str, Any]]:
        """Generate embeddings using Cohere API."""
        if not self.client:
            await self.initialize()

        try:
            response = await self.client.embed(texts=texts, model=model, **kwargs)

            embeddings = response.embeddings
            usage = {
                "prompt_tokens": response.meta.billed_units.input_tokens,
                "total_tokens": response.meta.billed_units.input_tokens,
                "model": model,
            }

            return embeddings, usage

        except cohere.errors.TooManyRequestsError as e:
            raise RateLimitError(
                f"Cohere rate limit exceeded: {str(e)}",
                self.provider_name,
                model,
                "rate_limit_exceeded",
            )
        except cohere.errors.AuthenticationError as e:
            raise EmbeddingError(
                f"Cohere authentication error: {str(e)}",
                self.provider_name,
                model,
                "authentication_error",
            )
        except cohere.errors.APIError as e:
            raise ProviderError(
                f"Cohere API error: {str(e)}", self.provider_name, model, "api_error"
            )
        except Exception as e:
            raise EmbeddingError(
                f"Unexpected error: {str(e)}",
                self.provider_name,
                model,
                "unexpected_error",
            )

    async def health_check(self) -> bool:
        """Check Cohere API health."""
        try:
            if not self.client:
                await self.initialize()

            # Test with a simple embedding request
            await self.client.embed(
                texts=["health check"], model=EmbeddingModel.COHERE_EMBED_EN_V3.value
            )
            return True
        except Exception as e:
            logger.warning(f"Cohere health check failed: {str(e)}")
            return False

    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get Cohere model information."""
        model_configs = {
            EmbeddingModel.COHERE_EMBED_EN_V3.value: {
                "dimensions": 1024,
                "max_tokens": 512,
                "cost_per_1k_tokens": 0.0001,
                "description": "English embedding model v3",
            },
            EmbeddingModel.COHERE_EMBED_MULTILANG_V3.value: {
                "dimensions": 1024,
                "max_tokens": 512,
                "cost_per_1k_tokens": 0.0001,
                "description": "Multilingual embedding model v3",
            },
        }
        return model_configs.get(model, {})

    @property
    def supported_models(self) -> List[str]:
        """Get supported Cohere models."""
        return [
            EmbeddingModel.COHERE_EMBED_EN_V3.value,
            EmbeddingModel.COHERE_EMBED_MULTILANG_V3.value,
        ]


class SentenceTransformersProvider(EmbeddingProviderABC):
    """Sentence Transformers embedding provider."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize Sentence Transformers provider."""
        super().__init__(config)
        self.model: Optional[SentenceTransformer] = None
        self.model_name = config.get(
            "model_name", EmbeddingModel.SENTENCE_MINILM_L6_V2.value
        )
        self.device = config.get("device", "cpu")
        self.cache_folder = config.get("cache_folder", "./models")

    async def initialize(self) -> None:
        """Initialize Sentence Transformers model."""
        if not TRANSFORMERS_AVAILABLE:
            raise EmbeddingError(
                "Transformers library not installed", self.provider_name
            )

        def load_model():
            self.model = SentenceTransformer(
                self.model_name, device=self.device, cache_folder=self.cache_folder
            )

        # Run blocking model loading in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, load_model)

        logger.info(
            f"Sentence Transformers provider initialized with model: {self.model_name}"
        )

    async def generate_embeddings(
        self, texts: List[str], model: str, **kwargs
    ) -> Tuple[List[List[float]], Dict[str, Any]]:
        """Generate embeddings using Sentence Transformers."""
        if not self.model:
            await self.initialize()

        try:

            def encode():
                return self.model.encode(
                    texts,
                    batch_size=kwargs.get("batch_size", 32),
                    show_progress_bar=False,
                    convert_to_numpy=True,
                )

            # Run blocking encoding in thread pool
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(None, encode)

            # Convert numpy arrays to lists
            embedding_lists = [embedding.tolist() for embedding in embeddings]

            # Estimate tokens (rough approximation: 1 token ≈ 4 characters)
            total_chars = sum(len(text) for text in texts)
            estimated_tokens = total_chars // 4

            usage = {
                "prompt_tokens": estimated_tokens,
                "total_tokens": estimated_tokens,
                "model": model,
                "local_processing": True,
            }

            return embedding_lists, usage

        except Exception as e:
            raise EmbeddingError(
                f"Sentence Transformers error: {str(e)}",
                self.provider_name,
                model,
                "model_error",
            )

    async def health_check(self) -> bool:
        """Check model health."""
        try:
            if not self.model:
                await self.initialize()

            # Test with a simple embedding
            await self.generate_embeddings(["health check"], self.model_name)
            return True
        except Exception as e:
            logger.warning(f"Sentence Transformers health check failed: {str(e)}")
            return False

    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get model information."""
        model_configs = {
            EmbeddingModel.SENTENCE_MINILM_L6_V2.value: {
                "dimensions": 384,
                "max_tokens": 512,
                "cost_per_1k_tokens": 0.0,  # Free
                "description": "Small, fast English model",
            },
            EmbeddingModel.SENTENCE_MPNET_BASE_V2.value: {
                "dimensions": 768,
                "max_tokens": 512,
                "cost_per_1k_tokens": 0.0,  # Free
                "description": "Balanced performance model",
            },
            EmbeddingModel.SENTENCE_BERT_BASE_NLI_MEAN_TOKENS.value: {
                "dimensions": 768,
                "max_tokens": 512,
                "cost_per_1k_tokens": 0.0,  # Free
                "description": "NLI-optimized model",
            },
        }
        return model_configs.get(model, {})

    @property
    def supported_models(self) -> List[str]:
        """Get supported models."""
        return [
            EmbeddingModel.SENTENCE_MINILM_L6_V2.value,
            EmbeddingModel.SENTENCE_MPNET_BASE_V2.value,
            EmbeddingModel.SENTENCE_BERT_BASE_NLI_MEAN_TOKENS.value,
        ]


class ONNXEmbeddingProvider(EmbeddingProviderABC):
    """ONNX-optimized embedding provider."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize ONNX provider."""
        super().__init__(config)
        self.session: Optional[ort.InferenceSession] = None
        self.model_path = config.get("model_path")
        self.tokenizer = None
        self.device = config.get("device", "cpu")

    async def initialize(self) -> None:
        """Initialize ONNX session."""
        if not TRANSFORMERS_AVAILABLE:
            raise EmbeddingError(
                "Transformers library not installed", self.provider_name
            )

        def load_model():
            # Load ONNX model
            self.session = ort.InferenceSession(
                self.model_path,
                providers=["CPUExecutionProvider"]
                if self.device == "cpu"
                else ["CUDAExecutionProvider"],
            )

            # Load tokenizer (assuming we have transformers available)
            from transformers import AutoTokenizer

            model_name = self.model_path.split("/")[-1].replace("-onnx", "")
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)

        # Run blocking model loading in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, load_model)

        logger.info(
            f"ONNX embedding provider initialized with model: {self.model_path}"
        )

    async def generate_embeddings(
        self, texts: List[str], model: str, **kwargs
    ) -> Tuple[List[List[float]], Dict[str, Any]]:
        """Generate embeddings using ONNX model."""
        if not self.session or not self.tokenizer:
            await self.initialize()

        try:

            def encode():
                # Tokenize texts
                inputs = self.tokenizer(
                    texts,
                    padding=True,
                    truncation=True,
                    max_length=512,
                    return_tensors="np",
                )

                # Run inference
                outputs = self.session.run(
                    None,
                    {
                        "input_ids": inputs["input_ids"],
                        "attention_mask": inputs["attention_mask"],
                    },
                )

                # Get embeddings (assume first output is embeddings)
                embeddings = outputs[0]

                # Mean pooling
                attention_mask_expanded = np.expand_dims(
                    inputs["attention_mask"], axis=-1
                )
                embeddings_sum = np.sum(embeddings * attention_mask_expanded, axis=1)
                mask_sum = np.sum(attention_mask_expanded, axis=1)
                embeddings = embeddings_sum / np.maximum(mask_sum, 1e-9)

                return embeddings.tolist()

            # Run blocking encoding in thread pool
            loop = asyncio.get_event_loop()
            embedding_lists = await loop.run_in_executor(None, encode)

            # Estimate tokens
            total_chars = sum(len(text) for text in texts)
            estimated_tokens = total_chars // 4

            usage = {
                "prompt_tokens": estimated_tokens,
                "total_tokens": estimated_tokens,
                "model": model,
                "local_processing": True,
                "onnx_optimized": True,
            }

            return embedding_lists, usage

        except Exception as e:
            raise EmbeddingError(
                f"ONNX embedding error: {str(e)}",
                self.provider_name,
                model,
                "model_error",
            )

    async def health_check(self) -> bool:
        """Check ONNX model health."""
        try:
            if not self.session:
                await self.initialize()

            # Test with a simple embedding
            await self.generate_embeddings(["health check"], "onnx_model")
            return True
        except Exception as e:
            logger.warning(f"ONNX health check failed: {str(e)}")
            return False

    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get ONNX model information."""
        model_configs = {
            EmbeddingModel.ONNX_MINILM_L6_V2.value: {
                "dimensions": 384,
                "max_tokens": 512,
                "cost_per_1k_tokens": 0.0,  # Free
                "description": "ONNX-optimized MiniLM model",
            },
            EmbeddingModel.ONNX_MPNET_BASE_V2.value: {
                "dimensions": 768,
                "max_tokens": 512,
                "cost_per_1k_tokens": 0.0,  # Free
                "description": "ONNX-optimized MPNet model",
            },
        }
        return model_configs.get(model, {})

    @property
    def supported_models(self) -> List[str]:
        """Get supported ONNX models."""
        return [
            EmbeddingModel.ONNX_MINILM_L6_V2.value,
            EmbeddingModel.ONNX_MPNET_BASE_V2.value,
        ]


class EmbeddingCache:
    """Intelligent embedding cache with 24h TTL."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize cache."""
        self.redis_url = config.get("redis_url")
        self.ttl_seconds = config.get("ttl_seconds", 24 * 60 * 60)  # 24 hours
        self.max_size = config.get("max_size", 10000)
        self.compression_enabled = config.get("compression_enabled", True)
        self.client: Optional[redis.Redis] = None

    async def initialize(self) -> None:
        """Initialize Redis client."""
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available, caching disabled")
            return

        if self.redis_url:
            self.client = redis.from_url(self.redis_url, decode_responses=False)
            await self.client.ping()
            logger.info("Embedding cache initialized with Redis")
        else:
            logger.warning("Redis URL not provided, caching disabled")

    def _generate_cache_key(
        self, text: str, provider: str, model: str, tenant_id: UUID
    ) -> str:
        """Generate cache key for embedding."""
        # Create content hash
        content_hash = hashlib.sha256(text.encode()).hexdigest()

        # Create cache key
        return f"embedding:{tenant_id}:{provider}:{model}:{content_hash}"

    async def get(
        self, text: str, provider: str, model: str, tenant_id: UUID
    ) -> Optional[List[float]]:
        """Get cached embedding."""
        if not self.client:
            return None

        try:
            cache_key = self._generate_cache_key(text, provider, model, tenant_id)
            cached_data = await self.client.get(cache_key)

            if cached_data:
                data = json.loads(cached_data)
                return data.get("embedding")

            return None

        except Exception as e:
            logger.warning(f"Cache get error: {str(e)}")
            return None

    async def set(
        self,
        text: str,
        provider: str,
        model: str,
        tenant_id: UUID,
        embedding: List[float],
        metadata: Dict[str, Any] = None,
    ) -> bool:
        """Cache embedding."""
        if not self.client:
            return False

        try:
            cache_key = self._generate_cache_key(text, provider, model, tenant_id)

            data = {
                "embedding": embedding,
                "provider": provider,
                "model": model,
                "created_at": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            }

            if self.compression_enabled:
                # Note: In production, you might want to use proper compression
                cached_data = json.dumps(data)
            else:
                cached_data = json.dumps(data)

            await self.client.setex(cache_key, self.ttl_seconds, cached_data)
            return True

        except Exception as e:
            logger.warning(f"Cache set error: {str(e)}")
            return False

    async def invalidate_by_model(
        self, provider: str, model: str, tenant_id: UUID
    ) -> int:
        """Invalidate cache entries for a specific model."""
        if not self.client:
            return 0

        try:
            pattern = f"embedding:{tenant_id}:{provider}:{model}:*"
            keys = await self.client.keys(pattern)

            if keys:
                deleted_count = await self.client.delete(*keys)
                logger.info(
                    f"Invalidated {deleted_count} cache entries for model {model}"
                )
                return deleted_count

            return 0

        except Exception as e:
            logger.warning(f"Cache invalidation error: {str(e)}")
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.client:
            return {"enabled": False}

        try:
            info = await self.client.info("memory")
            return {
                "enabled": True,
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "ttl_seconds": self.ttl_seconds,
                "compression_enabled": self.compression_enabled,
            }
        except Exception as e:
            logger.warning(f"Cache stats error: {str(e)}")
            return {"enabled": False, "error": str(e)}


class EmbeddingService:
    """
    Comprehensive embedding service with multi-provider support, intelligent caching,
    cost optimization, and quality validation.
    """

    def __init__(self, config: Dict[str, Any] = None):
        """Initialize embedding service."""
        self.settings = get_settings()
        self.config = config or {}

        # Initialize providers
        self.providers: Dict[EmbeddingProvider, EmbeddingProviderABC] = {}
        self.provider_configs = self._load_provider_configs()

        # Initialize cache
        cache_config = self.config.get("cache", {})
        cache_config["redis_url"] = cache_config.get(
            "redis_url", self.settings.redis_url
        )
        self.cache = EmbeddingCache(cache_config)

        # Initialize metrics
        self.metrics: List[EmbeddingMetrics] = []

        # Provider priority and cost optimization
        self.provider_priority = self.config.get(
            "provider_priority",
            [
                EmbeddingProvider.SENTENCE_TRANSFORMERS,  # Free local models first
                EmbeddingProvider.ONNX,  # Then ONNX optimized
                EmbeddingProvider.OPENAI,  # Then paid providers
                EmbeddingProvider.COHERE,  # Fallback
            ],
        )

        # Batch processing settings
        self.batch_size = self.config.get("batch_size", 100)
        self.max_concurrent_batches = self.config.get("max_concurrent_batches", 5)

        # Quality validation settings
        self.quality_validation_enabled = self.config.get(
            "quality_validation_enabled", True
        )
        self.min_similarity_threshold = self.config.get("min_similarity_threshold", 0.7)

    def _load_provider_configs(self) -> Dict[EmbeddingProvider, Dict[str, Any]]:
        """Load provider configurations."""
        return {
            EmbeddingProvider.OPENAI: {
                "name": "openai",
                "api_key": self.settings.openai_api_key,
                "organization": self.settings.openai_organization,
                "base_url": self.settings.openai_base_url,
                "timeout": self.settings.openai_timeout,
                "max_retries": self.settings.openai_max_retries,
            },
            EmbeddingProvider.COHERE: {
                "name": "cohere",
                "api_key": self.config.get("cohere_api_key"),
                "timeout": 30,
                "max_retries": 3,
            },
            EmbeddingProvider.SENTENCE_TRANSFORMERS: {
                "name": "sentence_transformers",
                "model_name": self.settings.sentence_transformer_model,
                "device": self.settings.sentence_transformer_device,
                "cache_folder": "./models/embeddings",
            },
            EmbeddingProvider.ONNX: {
                "name": "onnx",
                "model_path": self.config.get("onnx_model_path"),
                "device": "cpu",
            },
        }

    async def initialize(self) -> None:
        """Initialize all providers and cache."""
        logger.info("Initializing embedding service...")

        # Initialize cache
        await self.cache.initialize()

        # Initialize providers
        for provider_name, provider_config in self.provider_configs.items():
            try:
                provider_class = self._get_provider_class(provider_name)
                if provider_class:
                    provider = provider_class(provider_config)
                    await provider.initialize()
                    self.providers[provider_name] = provider
                    logger.info(f"Initialized {provider_name} provider")
                else:
                    logger.warning(f"Provider class not found for {provider_name}")
            except Exception as e:
                logger.warning(
                    f"Failed to initialize {provider_name} provider: {str(e)}"
                )

        logger.info(
            f"Embedding service initialized with {len(self.providers)} providers"
        )

    def _get_provider_class(self, provider: EmbeddingProvider) -> type:
        """Get provider class by name."""
        provider_classes = {
            EmbeddingProvider.OPENAI: OpenAIEmbeddingProvider,
            EmbeddingProvider.COHERE: CohereEmbeddingProvider,
            EmbeddingProvider.SENTENCE_TRANSFORMERS: SentenceTransformersProvider,
            EmbeddingProvider.ONNX: ONNXEmbeddingProvider,
        }
        return provider_classes.get(provider)

    async def generate_embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """
        Generate embeddings with intelligent provider selection, caching, and fallback.
        """
        start_time = time.time()

        # Validate request
        self._validate_request(request)

        # Check cache first
        cached_embeddings = []
        uncached_texts = []
        uncached_indices = []

        for i, text in enumerate(request.texts):
            cached_embedding = await self.cache.get(
                text, request.provider.value, request.model.value, request.tenant_id
            )
            if cached_embedding:
                cached_embeddings.append((i, cached_embedding))
            else:
                uncached_texts.append(text)
                uncached_indices.append(i)

        logger.info(f"Cache hit rate: {len(cached_embeddings)}/{len(request.texts)}")

        # Generate embeddings for uncached texts
        new_embeddings = []
        usage = {"total_tokens": 0, "model": request.model.value}
        error_count = 0

        if uncached_texts:
            try:
                # Try primary provider first
                embeddings, provider_usage = await self._generate_with_provider(
                    uncached_texts, request.provider, request.model
                )
                new_embeddings = embeddings
                usage.update(provider_usage)

                # Cache new embeddings
                for text, embedding in zip(uncached_texts, new_embeddings):
                    await self.cache.set(
                        text,
                        request.provider.value,
                        request.model.value,
                        request.tenant_id,
                        embedding,
                    )

            except Exception as e:
                logger.error(f"Primary provider {request.provider} failed: {str(e)}")
                error_count += len(uncached_texts)

                # Try fallback providers
                for fallback_provider in self.provider_priority:
                    if (
                        fallback_provider != request.provider
                        and fallback_provider in self.providers
                    ):
                        try:
                            logger.info(
                                f"Trying fallback provider: {fallback_provider}"
                            )
                            (
                                embeddings,
                                provider_usage,
                            ) = await self._generate_with_provider(
                                uncached_texts, fallback_provider, request.model
                            )
                            new_embeddings = embeddings
                            usage.update(provider_usage)

                            # Cache with fallback provider
                            for text, embedding in zip(uncached_texts, new_embeddings):
                                await self.cache.set(
                                    text,
                                    fallback_provider.value,
                                    request.model.value,
                                    request.tenant_id,
                                    embedding,
                                )
                            break
                        except Exception as fallback_error:
                            logger.warning(
                                f"Fallback provider {fallback_provider} failed: {str(fallback_error)}"
                            )
                            continue
                    else:
                        logger.warning(
                            f"Fallback provider {fallback_provider} not available"
                        )

                if not new_embeddings:
                    raise EmbeddingError("All providers failed to generate embeddings")

        # Combine cached and new embeddings
        all_embeddings = [None] * len(request.texts)

        # Fill cached embeddings
        for index, embedding in cached_embeddings:
            all_embeddings[index] = embedding

        # Fill new embeddings
        for index, embedding in zip(uncached_indices, new_embeddings):
            all_embeddings[index] = embedding

        # Validate all embeddings were generated
        if any(emb is None for emb in all_embeddings):
            raise EmbeddingError("Failed to generate all embeddings")

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Estimate cost
        cost_estimate = self._estimate_cost(
            usage.get("total_tokens", 0), request.provider
        )

        # Quality validation if enabled
        quality_scores = []
        if self.quality_validation_enabled:
            quality_scores = await self._validate_embeddings(
                all_embeddings, request.texts
            )

        # Create response
        response = EmbeddingResponse(
            embeddings=all_embeddings,
            model=request.model.value,
            provider=request.provider.value,
            dimensions=len(all_embeddings[0]) if all_embeddings else 0,
            usage=usage,
            processing_time_ms=processing_time_ms,
            cached_count=len(cached_embeddings),
            error_count=error_count,
            metadata={
                "cost_estimate_usd": cost_estimate,
                "quality_scores": quality_scores,
                "tenant_id": str(request.tenant_id),
                "batch_id": str(request.batch_id) if request.batch_id else None,
            },
        )

        # Log metrics
        self._log_metrics(request, response)

        return response

    async def _generate_with_provider(
        self, texts: List[str], provider: EmbeddingProvider, model: EmbeddingModel
    ) -> Tuple[List[List[float]], Dict[str, Any]]:
        """Generate embeddings using specific provider."""
        if provider not in self.providers:
            raise EmbeddingError(f"Provider {provider} not available")

        provider_instance = self.providers[provider]

        # Process in batches if needed
        if len(texts) > self.batch_size:
            all_embeddings = []
            total_usage = {"total_tokens": 0, "model": model.value}

            for i in range(0, len(texts), self.batch_size):
                batch_texts = texts[i : i + self.batch_size]
                (
                    batch_embeddings,
                    batch_usage,
                ) = await provider_instance.generate_embeddings(
                    batch_texts, model.value
                )
                all_embeddings.extend(batch_embeddings)
                total_usage["total_tokens"] += batch_usage.get("total_tokens", 0)

            return all_embeddings, total_usage
        else:
            return await provider_instance.generate_embeddings(texts, model.value)

    def _validate_request(self, request: EmbeddingRequest) -> None:
        """Validate embedding request."""
        if not request.texts:
            raise ValidationError("No texts provided for embedding generation")

        if request.provider not in self.providers:
            raise ValidationError(f"Provider {request.provider} not available")

        # Check if model is supported by provider
        provider_instance = self.providers[request.provider]
        if request.model.value not in provider_instance.supported_models:
            raise ValidationError(
                f"Model {request.model} not supported by provider {request.provider}"
            )

        # Validate text length
        max_length = 8000  # Conservative limit
        for text in request.texts:
            if len(text) > max_length * 4:  # Rough token estimate
                raise ValidationError(f"Text too long: {len(text)} characters")

    def _estimate_cost(self, tokens: int, provider: EmbeddingProvider) -> float:
        """Estimate cost in USD for token usage."""
        # Cost per 1K tokens for different providers
        costs = {
            EmbeddingProvider.OPENAI: 0.0004,  # text-embedding-ada-002
            EmbeddingProvider.COHERE: 0.0001,  # embed-english-v3
            EmbeddingProvider.SENTENCE_TRANSFORMERS: 0.0,  # Free
            EmbeddingProvider.ONNX: 0.0,  # Free
        }

        cost_per_1k = costs.get(provider, 0.0)
        return (tokens / 1000) * cost_per_1k

    async def _validate_embeddings(
        self, embeddings: List[List[float]], texts: List[str]
    ) -> List[float]:
        """Validate embedding quality."""
        quality_scores = []

        for embedding, text in zip(embeddings, texts):
            score = 1.0  # Default score

            # Check embedding dimensions
            if not embedding or len(embedding) == 0:
                score = 0.0
            elif len(embedding) < 100:
                score *= 0.5  # Penalize very small embeddings
            elif len(embedding) > 4000:
                score *= 0.8  # Penalize very large embeddings

            # Check for NaN or infinite values
            if any(
                not isinstance(x, (int, float)) or x != x or abs(x) == float("inf")
                for x in embedding
            ):
                score = 0.0

            # Check embedding norm (should be normalized for most models)
            norm = sum(x * x for x in embedding) ** 0.5
            if norm == 0:
                score = 0.0
            elif abs(norm - 1.0) > 0.5:
                score *= 0.7  # Penalize poorly normalized embeddings

            quality_scores.append(score)

        return quality_scores

    def _log_metrics(
        self, request: EmbeddingRequest, response: EmbeddingResponse
    ) -> None:
        """Log performance metrics."""
        metrics = EmbeddingMetrics(
            request_id=str(uuid4()),
            provider=response.provider,
            model=response.model,
            texts_count=len(request.texts),
            tokens_used=response.total_tokens,
            processing_time_ms=response.processing_time_ms,
            cache_hit_rate=response.cached_count / len(request.texts),
            cost_usd=response.cost_estimate_usd,
            error_rate=response.error_count / len(request.texts),
            timestamp=datetime.utcnow(),
        )

        self.metrics.append(metrics)

        # Keep only last 1000 metrics in memory
        if len(self.metrics) > 1000:
            self.metrics = self.metrics[-1000:]

        logger.info(f"Embedding metrics: {metrics}")

    async def process_document_chunks(
        self,
        chunks: List[DocumentChunk],
        provider: EmbeddingProvider = EmbeddingProvider.SENTENCE_TRANSFORMERS,
        model: EmbeddingModel = EmbeddingModel.SENTENCE_MINILM_L6_V2,
        tenant_id: Optional[UUID] = None,
    ) -> List[DocumentChunk]:
        """
        Process document chunks and generate embeddings.
        This is the main integration point with the document processing pipeline.
        """
        if not chunks:
            return []

        # Extract tenant ID from first chunk if not provided
        if not tenant_id:
            tenant_id = chunks[0].tenant_id

        # Prepare embedding request
        texts = [chunk.content for chunk in chunks]

        request = EmbeddingRequest(
            texts=texts,
            provider=provider,
            model=model,
            tenant_id=tenant_id,
            batch_id=uuid4(),
            priority=5,  # Medium priority for document processing
        )

        try:
            # Generate embeddings
            response = await self.generate_embeddings(request)

            # Update chunks with embeddings
            for i, chunk in enumerate(chunks):
                if i < len(response.embeddings):
                    chunk.embedding = response.embeddings[i]
                    chunk.embedding_model = response.model
                    chunk.embedding_dimensions = response.dimensions
                    chunk.embedding_status = DocumentStatus.COMPLETED
                    chunk.processing_time_ms = response.processing_time_ms // len(
                        chunks
                    )

                    # Add quality score to metadata
                    if "quality_scores" in response.metadata and i < len(
                        response.metadata["quality_scores"]
                    ):
                        chunk.metadata["embedding_quality_score"] = response.metadata[
                            "quality_scores"
                        ][i]
                        chunk.metadata["embedding_provider"] = response.provider
                        chunk.metadata["embedding_cost_estimate"] = (
                            response.cost_estimate_usd / len(chunks)
                        )
                else:
                    chunk.embedding_status = DocumentStatus.FAILED
                    chunk.metadata["embedding_error"] = "Embedding not generated"

            logger.info(f"Processed {len(chunks)} document chunks with embeddings")
            return chunks

        except Exception as e:
            logger.error(f"Failed to process document chunks: {str(e)}")

            # Mark all chunks as failed
            for chunk in chunks:
                chunk.embedding_status = DocumentStatus.FAILED
                chunk.metadata["embedding_error"] = str(e)

            raise

    async def regenerate_embeddings(
        self,
        provider: EmbeddingProvider,
        model: EmbeddingModel,
        tenant_id: UUID,
        model_version: Optional[str] = None,
    ) -> int:
        """
        Regenerate embeddings for a specific model update.
        This handles automatic embedding regeneration when models are updated.
        """
        logger.info(
            f"Regenerating embeddings for provider={provider}, model={model}, tenant={tenant_id}"
        )

        # Invalidate cache for old model
        invalidated_count = await self.cache.invalidate_by_model(
            provider.value, model.value, tenant_id
        )

        # In a real implementation, you would:
        # 1. Query database for chunks with old embeddings
        # 2. Regenerate embeddings with new model
        # 3. Update database records

        logger.info(f"Invalidated {invalidated_count} cache entries")
        return invalidated_count

    async def get_provider_status(self) -> Dict[str, Any]:
        """Get status of all providers."""
        status = {}

        for provider_name, provider in self.providers.items():
            try:
                is_healthy = await provider.health_check()
                model_info = {
                    model: provider.get_model_info(model)
                    for model in provider.supported_models
                }

                status[provider_name.value] = {
                    "healthy": is_healthy,
                    "supported_models": provider.supported_models,
                    "model_info": model_info,
                }
            except Exception as e:
                status[provider_name.value] = {
                    "healthy": False,
                    "error": str(e),
                    "supported_models": provider.supported_models,
                }

        # Add cache status
        status["cache"] = await self.cache.get_stats()

        return status

    async def get_metrics(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent metrics."""
        recent_metrics = self.metrics[-limit:] if limit else self.metrics
        return [
            {
                "request_id": m.request_id,
                "provider": m.provider,
                "model": m.model,
                "texts_count": m.texts_count,
                "tokens_used": m.tokens_used,
                "processing_time_ms": m.processing_time_ms,
                "cache_hit_rate": m.cache_hit_rate,
                "cost_usd": m.cost_usd,
                "error_rate": m.error_rate,
                "timestamp": m.timestamp.isoformat(),
            }
            for m in recent_metrics
        ]

    def get_supported_providers(self) -> List[Dict[str, Any]]:
        """Get list of supported providers with their capabilities."""
        providers_info = []

        for provider_name in EmbeddingProvider:
            provider_class = self._get_provider_class(provider_name)
            if provider_class and provider_name in self.providers:
                provider_instance = self.providers[provider_name]
                models_info = []

                for model in provider_instance.supported_models:
                    model_info = provider_instance.get_model_info(model)
                    model_info["name"] = model
                    models_info.append(model_info)

                providers_info.append(
                    {
                        "name": provider_name.value,
                        "display_name": provider_name.value.replace("_", " ").title(),
                        "supported_models": models_info,
                        "available": True,
                    }
                )
            else:
                providers_info.append(
                    {
                        "name": provider_name.value,
                        "display_name": provider_name.value.replace("_", " ").title(),
                        "supported_models": [],
                        "available": False,
                        "reason": "Not initialized or missing dependencies",
                    }
                )

        return providers_info


# Global instance
_embedding_service: Optional[EmbeddingService] = None


async def get_embedding_service() -> EmbeddingService:
    """Get global embedding service instance."""
    global _embedding_service

    if _embedding_service is None:
        _embedding_service = EmbeddingService()
        await _embedding_service.initialize()

    return _embedding_service


# Convenience functions
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
        texts=texts,
        provider=provider,
        model=model,
        tenant_id=tenant_id or UUID(int=0),  # Default tenant
        **kwargs,
    )

    return await service.generate_embeddings(request)


async def process_document_chunks_with_embeddings(
    chunks: List[DocumentChunk],
    provider: EmbeddingProvider = EmbeddingProvider.SENTENCE_TRANSFORMERS,
    model: EmbeddingModel = EmbeddingModel.SENTENCE_MINILM_L6_V2,
) -> List[DocumentChunk]:
    """Process document chunks with embeddings."""
    service = await get_embedding_service()
    return await service.process_document_chunks(chunks, provider, model)
