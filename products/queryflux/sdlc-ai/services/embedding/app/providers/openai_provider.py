"""
OpenAI embedding provider implementation.

This module implements the OpenAI embedding provider using the official
OpenAI API client with support for multiple models and advanced features.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional

import openai
import tiktoken
from openai import AsyncOpenAI

from .base import (
    BaseEmbeddingProvider,
    BatchEmbeddingResult,
    EmbeddingResult,
    ProviderCapabilities,
    ProviderConfig,
)


class OpenAIProvider(BaseEmbeddingProvider):
    """OpenAI embedding provider implementation."""

    def __init__(self, config: ProviderConfig):
        """Initialize OpenAI provider."""
        super().__init__(config)
        self.client: Optional[AsyncOpenAI] = None
        self._tokenizer_cache: Dict[str, tiktoken.Encoding] = {}

    @property
    def capabilities(self) -> ProviderCapabilities:
        """Get OpenAI provider capabilities."""
        return ProviderCapabilities(
            supported_dimensions=[
                1536,
                3072,
                512,
            ],  # ada-002: 1536, 3-small: 1536, 3-large: 3072
            max_sequence_length=8192,
            max_batch_size=2048,
            supports_multiple_texts=True,
            supports_custom_dimensions=False,
            average_latency_ms=500,
            cost_per_1m_tokens=0.0001,  # Varies by model
            quality_score=0.95,
        )

    async def initialize(self) -> None:
        """Initialize OpenAI client."""
        self.client = AsyncOpenAI(
            api_key=self.config.api_key,
            organization_id=self.config.organization_id,
            base_url=self.config.base_url,
            timeout=self.config.timeout,
            max_retries=self.config.max_retries,
        )

        # Test connection with a simple request
        try:
            await self._test_connection()
            self.status = self.ProviderStatus.HEALTHY
        except Exception as e:
            self.status = self.ProviderStatus.UNHEALTHY
            raise RuntimeError(f"Failed to initialize OpenAI provider: {e}")

    async def cleanup(self) -> None:
        """Cleanup OpenAI client resources."""
        if self.client:
            await self.client.close()
            self.client = None

    async def _test_connection(self) -> None:
        """Test connection to OpenAI API."""
        if not self.client:
            raise RuntimeError("OpenAI client not initialized")

        # Use a simple models list request to test connection
        await self.client.models.list()

    def _get_model(self, model: Optional[str] = None) -> str:
        """Get model name, falling back to config default."""
        return model or self.config.model or "text-embedding-3-small"

    def _get_tokenizer(self, model: str) -> tiktoken.Encoding:
        """Get tokenizer for the specified model."""
        if model not in self._tokenizer_cache:
            try:
                self._tokenizer_cache[model] = tiktoken.encoding_for_model(model)
            except KeyError:
                # Fallback to a general tokenizer
                self._tokenizer_cache[model] = tiktoken.get_encoding("cl100k_base")

        return self._tokenizer_cache[model]

    def _count_tokens(self, text: str, model: str) -> int:
        """Count tokens for text using the appropriate tokenizer."""
        tokenizer = self._get_tokenizer(model)
        return len(tokenizer.encode(text))

    def _validate_model(self, model: str) -> None:
        """Validate that the model is supported."""
        supported_models = {
            "text-embedding-ada-002": 1536,
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
        }

        if model not in supported_models:
            raise ValueError(
                f"Unsupported model: {model}. "
                f"Supported models: {list(supported_models.keys())}"
            )

    async def generate_embedding(
        self, text: str, model: Optional[str] = None, **kwargs
    ) -> EmbeddingResult:
        """Generate embedding for a single text using OpenAI."""
        if not self.client:
            raise RuntimeError("OpenAI client not initialized")

        model = self._get_model(model)
        self._validate_model(model)
        self.validate_text(text)

        start_time = time.time()

        try:
            # Count tokens
            token_count = self._count_tokens(text, model)

            # Create embedding request
            response = await self.client.embeddings.create(
                model=model, input=text, encoding_format="float", **kwargs
            )

            processing_time_ms = int((time.time() - start_time) * 1000)

            embedding_data = response.data[0]

            return EmbeddingResult(
                embedding=embedding_data.embedding,
                dimensions=len(embedding_data.embedding),
                token_count=token_count,
                processing_time_ms=processing_time_ms,
                model=model,
                provider=self.name,
                metadata={
                    "usage": response.usage.model_dump() if response.usage else None,
                    "model": response.model,
                    "object": response.object,
                },
            )

        except openai.APIError as e:
            raise RuntimeError(f"OpenAI API error: {e}")
        except openai.RateLimitError as e:
            raise RuntimeError(f"OpenAI rate limit exceeded: {e}")
        except openai.AuthenticationError as e:
            raise RuntimeError(f"OpenAI authentication error: {e}")
        except Exception as e:
            raise RuntimeError(f"Failed to generate embedding: {e}")

    async def generate_batch_embeddings(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: Optional[int] = None,
        **kwargs,
    ) -> BatchEmbeddingResult:
        """Generate embeddings for multiple texts using OpenAI."""
        if not self.client:
            raise RuntimeError("OpenAI client not initialized")

        model = self._get_model(model)
        self._validate_model(model)
        self.validate_batch(texts)

        # Use provider's max batch size or specified batch size
        effective_batch_size = min(
            batch_size or self.capabilities.max_batch_size,
            self.capabilities.max_batch_size,
        )

        start_time = time.time()
        all_embeddings: List[List[float]] = []
        all_token_counts: List[int] = []

        # Process in batches
        for i in range(0, len(texts), effective_batch_size):
            batch_texts = texts[i : i + effective_batch_size]

            try:
                # Count tokens for batch
                tokenizer = self._get_tokenizer(model)
                batch_token_counts = [
                    len(tokenizer.encode(text)) for text in batch_texts
                ]

                # Create batch embedding request
                response = await self.client.embeddings.create(
                    model=model, input=batch_texts, encoding_format="float", **kwargs
                )

                # Extract embeddings
                batch_embeddings = [data.embedding for data in response.data]

                all_embeddings.extend(batch_embeddings)
                all_token_counts.extend(batch_token_counts)

            except openai.APIError as e:
                raise RuntimeError(f"OpenAI API error in batch processing: {e}")
            except openai.RateLimitError as e:
                # Implement exponential backoff for rate limits
                retry_delay = 2 ** (i // effective_batch_size)  # Exponential backoff
                await asyncio.sleep(min(retry_delay, 10))  # Cap at 10 seconds
                continue  # Retry this batch
            except Exception as e:
                raise RuntimeError(
                    f"Failed to process batch {i // effective_batch_size}: {e}"
                )

        processing_time_ms = int((time.time() - start_time) * 1000)

        if not all_embeddings:
            raise RuntimeError("No embeddings were generated")

        dimensions = len(all_embeddings[0])

        return BatchEmbeddingResult(
            embeddings=all_embeddings,
            dimensions=dimensions,
            token_counts=all_token_counts,
            processing_time_ms=processing_time_ms,
            model=model,
            provider=self.name,
            batch_size=len(texts),
            metadata={
                "actual_batch_size": effective_batch_size,
                "total_batches": (len(texts) + effective_batch_size - 1)
                // effective_batch_size,
                "average_tokens_per_text": sum(all_token_counts)
                / len(all_token_counts),
            },
        )

    async def health_check(self) -> bool:
        """Perform health check specific to OpenAI."""
        if not self.client:
            return False

        try:
            # Test with a simple API call
            await self.client.models.list()
            self.status = self.ProviderStatus.HEALTHY
            return True
        except Exception:
            self.status = self.ProviderStatus.UNHEALTHY
            return False

    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get information about a specific model."""
        model_info = {
            "text-embedding-ada-002": {
                "dimensions": 1536,
                "max_tokens": 8191,
                "cost_per_1m_tokens": 0.0004,
                "description": "General purpose embedding model",
            },
            "text-embedding-3-small": {
                "dimensions": 1536,
                "max_tokens": 8191,
                "cost_per_1m_tokens": 0.00002,
                "description": "New small embedding model with better performance",
            },
            "text-embedding-3-large": {
                "dimensions": 3072,
                "max_tokens": 8191,
                "cost_per_1m_tokens": 0.00013,
                "description": "New large embedding model with best performance",
            },
        }

        return model_info.get(model, {})

    async def estimate_cost(
        self, texts: List[str], model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Estimate cost for embedding texts.

        Args:
            texts: List of texts to embed
            model: Model to use

        Returns:
            Dictionary with cost estimation
        """
        model = self._get_model(model)
        self._validate_model(model)

        # Count tokens
        tokenizer = self._get_tokenizer(model)
        total_tokens = sum(len(tokenizer.encode(text)) for text in texts)

        # Get model cost info
        model_info = self.get_model_info(model)
        cost_per_1m_tokens = model_info.get("cost_per_1m_tokens", 0.0001)

        estimated_cost = (total_tokens / 1_000_000) * cost_per_1m_tokens

        return {
            "total_texts": len(texts),
            "total_tokens": total_tokens,
            "model": model,
            "cost_per_1m_tokens": cost_per_1m_tokens,
            "estimated_cost_usd": estimated_cost,
            "estimated_cost_per_text": estimated_cost / len(texts),
        }
