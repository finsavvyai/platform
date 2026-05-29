"""
Cohere embedding provider implementation.

This module implements the Cohere embedding provider using the Cohere
API client with support for multiple models and advanced features.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional

import cohere
from cohere import AsyncClient

from .base import (
    BaseEmbeddingProvider,
    BatchEmbeddingResult,
    EmbeddingResult,
    ProviderCapabilities,
    ProviderConfig,
)


class CohereProvider(BaseEmbeddingProvider):
    """Cohere embedding provider implementation."""

    def __init__(self, config: ProviderConfig):
        """Initialize Cohere provider."""
        super().__init__(config)
        self.client: Optional[AsyncClient] = None

    @property
    def capabilities(self) -> ProviderCapabilities:
        """Get Cohere provider capabilities."""
        return ProviderCapabilities(
            supported_dimensions=[1024, 768, 384],
            max_sequence_length=512,
            max_batch_size=96,
            supports_multiple_texts=True,
            supports_custom_dimensions=False,
            average_latency_ms=600,
            cost_per_1m_tokens=0.0001,
            quality_score=0.92,
        )

    async def initialize(self) -> None:
        """Initialize Cohere client."""
        self.client = AsyncClient(
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            timeout=self.config.timeout,
            max_retries=self.config.max_retries,
            client_name="sdlc-embedding-service",
        )

        # Test connection
        try:
            await self._test_connection()
            self.status = self.ProviderStatus.HEALTHY
        except Exception as e:
            self.status = self.ProviderStatus.UNHEALTHY
            raise RuntimeError(f"Failed to initialize Cohere provider: {e}")

    async def cleanup(self) -> None:
        """Cleanup Cohere client resources."""
        if self.client:
            await self.client.close()
            self.client = None

    async def _test_connection(self) -> None:
        """Test connection to Cohere API."""
        if not self.client:
            raise RuntimeError("Cohere client not initialized")

        # Use a simple embed request to test connection
        try:
            await self.client.embed(
                texts=["test"], model="embed-english-v3.0", input_type="search_document"
            )
        except Exception as e:
            raise RuntimeError(f"Cohere connection test failed: {e}")

    def _get_model(self, model: Optional[str] = None) -> str:
        """Get model name, falling back to config default."""
        return model or self.config.model or "embed-english-v3.0"

    def _validate_model(self, model: str) -> None:
        """Validate that the model is supported."""
        supported_models = {
            "embed-english-v3.0": 1024,
            "embed-multilingual-v3.0": 1024,
            "embed-english-light-v3.0": 384,
            "embed-multilingual-light-v3.0": 384,
        }

        if model not in supported_models:
            raise ValueError(
                f"Unsupported model: {model}. "
                f"Supported models: {list(supported_models.keys())}"
            )

    def _estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for text.
        Cohere doesn't provide a public tokenizer, so we use a rough estimate.
        """
        # Rough estimation: approximately 4 characters per token
        return len(text) // 4

    def _get_input_type(self, **kwargs) -> str:
        """Get input type for Cohere API."""
        return kwargs.get("input_type", "search_document")

    def _validate_input_type(self, input_type: str) -> None:
        """Validate input type."""
        valid_input_types = [
            "search_document",
            "search_query",
            "classification",
            "clustering",
        ]

        if input_type not in valid_input_types:
            raise ValueError(
                f"Invalid input type: {input_type}. Valid types: {valid_input_types}"
            )

    async def generate_embedding(
        self, text: str, model: Optional[str] = None, **kwargs
    ) -> EmbeddingResult:
        """Generate embedding for a single text using Cohere."""
        if not self.client:
            raise RuntimeError("Cohere client not initialized")

        model = self._get_model(model)
        self._validate_model(model)
        self.validate_text(text)

        input_type = self._get_input_type(**kwargs)
        self._validate_input_type(input_type)

        start_time = time.time()

        try:
            # Estimate token count
            token_count = self._estimate_tokens(text)

            # Create embedding request
            response = await self.client.embed(
                texts=[text],
                model=model,
                input_type=input_type,
                embedding_types=["float"],
            )

            processing_time_ms = int((time.time() - start_time) * 1000)

            # Cohere returns embeddings in response.embeddings.float_
            embeddings = response.embeddings.float_

            if not embeddings:
                raise RuntimeError("No embedding returned from Cohere")

            embedding = embeddings[0]

            return EmbeddingResult(
                embedding=embedding,
                dimensions=len(embedding),
                token_count=token_count,
                processing_time_ms=processing_time_ms,
                model=model,
                provider=self.name,
                metadata={
                    "input_type": input_type,
                    "response_id": response.id,
                    "meta": response.meta,
                },
            )

        except cohere.CohereAPIError as e:
            raise RuntimeError(f"Cohere API error: {e}")
        except cohere.CohereConnectionError as e:
            raise RuntimeError(f"Cohere connection error: {e}")
        except Exception as e:
            raise RuntimeError(f"Failed to generate embedding: {e}")

    async def generate_batch_embeddings(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: Optional[int] = None,
        **kwargs,
    ) -> BatchEmbeddingResult:
        """Generate embeddings for multiple texts using Cohere."""
        if not self.client:
            raise RuntimeError("Cohere client not initialized")

        model = self._get_model(model)
        self._validate_model(model)
        self.validate_batch(texts)

        input_type = self._get_input_type(**kwargs)
        self._validate_input_type(input_type)

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
                # Estimate tokens for batch
                batch_token_counts = [
                    self._estimate_tokens(text) for text in batch_texts
                ]

                # Create batch embedding request
                response = await self.client.embed(
                    texts=batch_texts,
                    model=model,
                    input_type=input_type,
                    embedding_types=["float"],
                )

                # Extract embeddings
                embeddings = response.embeddings.float_

                if not embeddings:
                    raise RuntimeError(
                        f"No embeddings returned for batch {i // effective_batch_size}"
                    )

                if len(embeddings) != len(batch_texts):
                    raise RuntimeError(
                        f"Mismatch in batch size: expected {len(batch_texts)}, "
                        f"got {len(embeddings)} embeddings"
                    )

                all_embeddings.extend(embeddings)
                all_token_counts.extend(batch_token_counts)

            except cohere.CohereAPIError as e:
                if "rate limit" in str(e).lower():
                    # Implement exponential backoff for rate limits
                    retry_delay = 2 ** (i // effective_batch_size)
                    await asyncio.sleep(min(retry_delay, 10))
                    continue  # Retry this batch
                raise RuntimeError(f"Cohere API error in batch processing: {e}")
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
                "input_type": input_type,
                "actual_batch_size": effective_batch_size,
                "total_batches": (len(texts) + effective_batch_size - 1)
                // effective_batch_size,
                "average_tokens_per_text": sum(all_token_counts)
                / len(all_token_counts),
            },
        )

    async def health_check(self) -> bool:
        """Perform health check specific to Cohere."""
        if not self.client:
            return False

        try:
            # Test with a simple embed request
            await self.client.embed(
                texts=["health check"],
                model="embed-english-v3.0",
                input_type="search_document",
            )
            self.status = self.ProviderStatus.HEALTHY
            return True
        except Exception:
            self.status = self.ProviderStatus.UNHEALTHY
            return False

    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get information about a specific model."""
        model_info = {
            "embed-english-v3.0": {
                "dimensions": 1024,
                "max_tokens": 512,
                "cost_per_1m_tokens": 0.0001,
                "description": "English embedding model v3",
                "languages": ["en"],
            },
            "embed-multilingual-v3.0": {
                "dimensions": 1024,
                "max_tokens": 512,
                "cost_per_1m_tokens": 0.0001,
                "description": "Multilingual embedding model v3",
                "languages": ["en", "de", "fr", "es", "it", "pt", "zh", "ja"],
            },
            "embed-english-light-v3.0": {
                "dimensions": 384,
                "max_tokens": 512,
                "cost_per_1m_tokens": 0.00003,
                "description": "Light English embedding model v3",
                "languages": ["en"],
            },
            "embed-multilingual-light-v3.0": {
                "dimensions": 384,
                "max_tokens": 512,
                "cost_per_1m_tokens": 0.00003,
                "description": "Light multilingual embedding model v3",
                "languages": ["en", "de", "fr", "es", "it", "pt", "zh", "ja"],
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

        # Estimate tokens (rough estimation)
        total_tokens = sum(self._estimate_tokens(text) for text in texts)

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
            "model_languages": model_info.get("languages", []),
        }
