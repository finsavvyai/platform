"""
Base embedding provider interface.

This module defines the abstract base class and interfaces that all
embedding providers must implement, ensuring consistent behavior
across different providers.
"""

import abc
import time
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from pydantic import BaseModel


class ProviderStatus(str, Enum):
    """Provider status enumeration."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    DISABLED = "disabled"


@dataclass
class ProviderCapabilities:
    """Provider capabilities configuration."""

    supported_dimensions: List[int]
    max_sequence_length: int
    max_batch_size: int
    supports_multiple_texts: bool
    supports_custom_dimensions: bool
    average_latency_ms: int
    cost_per_1m_tokens: float
    quality_score: float = 0.8


@dataclass
class ProviderConfig:
    """Provider configuration."""

    name: str
    provider_type: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    api_version: str = "v1"
    timeout: int = 60
    max_retries: int = 3
    retry_delay: float = 1.0
    model: Optional[str] = None
    organization_id: Optional[str] = None
    extra_config: Dict[str, Any] = None

    def __post_init__(self):
        """Initialize extra config if not provided."""
        if self.extra_config is None:
            self.extra_config = {}


class EmbeddingResult(BaseModel):
    """Result of embedding generation."""

    embedding: List[float]
    dimensions: int
    token_count: int
    processing_time_ms: int
    model: str
    provider: str
    metadata: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class BatchEmbeddingResult(BaseModel):
    """Result of batch embedding generation."""

    embeddings: List[List[float]]
    dimensions: int
    token_counts: List[int]
    processing_time_ms: int
    model: str
    provider: str
    batch_size: int
    metadata: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class ProviderMetrics(BaseModel):
    """Provider performance metrics."""

    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_tokens: int = 0
    total_processing_time_ms: int = 0
    average_response_time_ms: float = 0.0
    success_rate: float = 1.0
    last_request_time: Optional[float] = None
    error_rate: float = 0.0

    class Config:
        from_attributes = True


class BaseEmbeddingProvider(abc.ABC):
    """
    Abstract base class for embedding providers.

    All embedding providers must inherit from this class and implement
    the required methods to ensure consistent behavior across providers.
    """

    def __init__(self, config: ProviderConfig):
        """Initialize the provider with configuration."""
        self.config = config
        self.metrics = ProviderMetrics()
        self.status = ProviderStatus.HEALTHY
        self._last_health_check = 0.0
        self._circuit_breaker_failures = 0
        self._circuit_breaker_last_failure = 0.0

    @property
    @abc.abstractmethod
    def capabilities(self) -> ProviderCapabilities:
        """Get provider capabilities."""
        pass

    @property
    def name(self) -> str:
        """Get provider name."""
        return self.config.name

    @property
    def provider_type(self) -> str:
        """Get provider type."""
        return self.config.provider_type

    @abc.abstractmethod
    async def initialize(self) -> None:
        """Initialize the provider (e.g., load models, test connection)."""
        pass

    @abc.abstractmethod
    async def cleanup(self) -> None:
        """Cleanup provider resources."""
        pass

    @abc.abstractmethod
    async def generate_embedding(
        self, text: str, model: Optional[str] = None, **kwargs
    ) -> EmbeddingResult:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed
            model: Model to use (overrides config)
            **kwargs: Additional provider-specific parameters

        Returns:
            EmbeddingResult containing the embedding and metadata
        """
        pass

    @abc.abstractmethod
    async def generate_batch_embeddings(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: Optional[int] = None,
        **kwargs,
    ) -> BatchEmbeddingResult:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed
            model: Model to use (overrides config)
            batch_size: Batch size for processing
            **kwargs: Additional provider-specific parameters

        Returns:
            BatchEmbeddingResult containing embeddings and metadata
        """
        pass

    async def health_check(self) -> bool:
        """
        Perform a health check on the provider.

        Returns:
            True if provider is healthy, False otherwise
        """
        current_time = time.time()

        # Rate limit health checks
        if current_time - self._last_health_check < 30:
            return self.status == ProviderStatus.HEALTHY

        try:
            # Perform a simple embedding request
            test_text = "Health check test"
            await self.generate_embedding(test_text)

            self.status = ProviderStatus.HEALTHY
            self._last_health_check = current_time
            return True

        except Exception as e:
            self.status = ProviderStatus.UNHEALTHY
            self._last_health_check = current_time
            return False

    def update_metrics(
        self, success: bool, processing_time_ms: int, token_count: int = 0
    ) -> None:
        """
        Update provider metrics.

        Args:
            success: Whether the request was successful
            processing_time_ms: Processing time in milliseconds
            token_count: Number of tokens processed
        """
        current_time = time.time()

        self.metrics.total_requests += 1
        self.metrics.total_tokens += token_count
        self.metrics.total_processing_time_ms += processing_time_ms
        self.metrics.last_request_time = current_time

        if success:
            self.metrics.successful_requests += 1
        else:
            self.metrics.failed_requests += 1
            self._circuit_breaker_failures += 1
            self._circuit_breaker_last_failure = current_time

        # Update calculated metrics
        self.metrics.success_rate = (
            self.metrics.successful_requests / self.metrics.total_requests
        )
        self.metrics.error_rate = 1.0 - self.metrics.success_rate
        self.metrics.average_response_time_ms = (
            self.metrics.total_processing_time_ms / self.metrics.total_requests
        )

    def is_circuit_breaker_open(self) -> bool:
        """
        Check if circuit breaker is open.

        Circuit breaker opens after consecutive failures and stays open
        for a cooldown period to prevent cascading failures.

        Returns:
            True if circuit breaker is open
        """
        if self._circuit_breaker_failures < 5:
            return False

        cooldown_period = 300  # 5 minutes
        current_time = time.time()

        if current_time - self._circuit_breaker_last_failure > cooldown_period:
            # Reset circuit breaker after cooldown
            self._circuit_breaker_failures = 0
            return False

        return True

    def reset_circuit_breaker(self) -> None:
        """Reset the circuit breaker."""
        self._circuit_breaker_failures = 0
        self._circuit_breaker_last_failure = 0.0

    async def generate_embedding_with_retry(
        self,
        text: str,
        model: Optional[str] = None,
        max_retries: Optional[int] = None,
        **kwargs,
    ) -> EmbeddingResult:
        """
        Generate embedding with retry logic and circuit breaker.

        Args:
            text: Text to embed
            model: Model to use
            max_retries: Maximum number of retries
            **kwargs: Additional parameters

        Returns:
            EmbeddingResult

        Raises:
            Exception: If all retries fail or circuit breaker is open
        """
        if self.is_circuit_breaker_open():
            raise Exception(f"Circuit breaker is open for provider {self.name}")

        max_retries = max_retries or self.config.max_retries
        last_exception = None

        for attempt in range(max_retries + 1):
            start_time = time.time()

            try:
                result = await self.generate_embedding(text, model, **kwargs)
                processing_time_ms = int((time.time() - start_time) * 1000)

                self.update_metrics(True, processing_time_ms, result.token_count)
                self.reset_circuit_breaker()  # Reset on success

                return result

            except Exception as e:
                processing_time_ms = int((time.time() - start_time) * 1000)
                self.update_metrics(False, processing_time_ms)
                last_exception = e

                if attempt < max_retries:
                    # Exponential backoff
                    delay = self.config.retry_delay * (2**attempt)
                    await asyncio.sleep(delay)

        # All retries failed
        raise last_exception

    def get_cache_key(self, text: str, model: str, **kwargs) -> str:
        """
        Generate cache key for embedding request.

        Args:
            text: Text to embed
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Cache key string
        """
        import hashlib

        # Create a deterministic key from text and parameters
        key_data = f"{self.name}:{model}:{text}"

        # Add any relevant kwargs to the key
        if kwargs:
            sorted_kwargs = sorted(kwargs.items())
            key_data += ":" + ":".join(f"{k}={v}" for k, v in sorted_kwargs)

        return hashlib.sha256(key_data.encode()).hexdigest()

    def validate_text(self, text: str) -> None:
        """
        Validate input text.

        Args:
            text: Text to validate

        Raises:
            ValueError: If text is invalid
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        if len(text) > self.capabilities.max_sequence_length:
            raise ValueError(
                f"Text exceeds maximum sequence length of {self.capabilities.max_sequence_length}"
            )

    def validate_batch(self, texts: List[str]) -> None:
        """
        Validate batch of texts.

        Args:
            texts: List of texts to validate

        Raises:
            ValueError: If batch is invalid
        """
        if not texts:
            raise ValueError("Texts list cannot be empty")

        if len(texts) > self.capabilities.max_batch_size:
            raise ValueError(
                f"Batch size exceeds maximum of {self.capabilities.max_batch_size}"
            )

        # Validate each text
        for text in texts:
            self.validate_text(text)

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"{self.__class__.__name__}("
            f"name='{self.name}', "
            f"status='{self.status.value}', "
            f"success_rate={self.metrics.success_rate:.2%})"
        )
