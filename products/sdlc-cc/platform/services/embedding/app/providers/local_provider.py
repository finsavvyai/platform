"""
Local embedding provider implementation.

This module implements local embedding providers using sentence transformers
and ONNX runtime for offline embedding generation with support for
various models and optimization strategies.
"""

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModel

from .base import (
    BaseEmbeddingProvider,
    BatchEmbeddingResult,
    EmbeddingResult,
    ProviderCapabilities,
    ProviderConfig,
)


class LocalProvider(BaseEmbeddingProvider):
    """Local embedding provider implementation using sentence transformers."""

    def __init__(self, config: ProviderConfig):
        """Initialize local provider."""
        super().__init__(config)

        # Configuration from extra_config
        self.models_directory = config.extra_config.get(
            "models_directory", "/app/models"
        )
        self.device = config.extra_config.get("device", "cpu")
        self.use_onnx = config.extra_config.get("use_onnx", False)
        self.cache_size = config.extra_config.get("cache_size", 3)

        # Model cache
        self._model_cache: Dict[str, SentenceTransformer] = {}
        self._tokenizer_cache: Dict[str, AutoTokenizer] = {}

        # Ensure models directory exists
        Path(self.models_directory).mkdir(parents=True, exist_ok=True)

    @property
    def capabilities(self) -> ProviderCapabilities:
        """Get local provider capabilities."""
        return ProviderCapabilities(
            supported_dimensions=[384, 512, 768, 1024, 1536],
            max_sequence_length=512,
            max_batch_size=64,  # Conservative for local processing
            supports_multiple_texts=True,
            supports_custom_dimensions=False,
            average_latency_ms=200,  # Usually faster than API calls
            cost_per_1m_tokens=0.0,  # Free (except compute costs)
            quality_score=0.85,  # Generally good but varies by model
        )

    async def initialize(self) -> None:
        """Initialize local provider."""
        try:
            # Test device availability
            if self.device == "cuda" and not torch.cuda.is_available():
                self.device = "cpu"
                print("CUDA not available, falling back to CPU")

            if self.device == "mps" and not torch.backends.mps.is_available():
                self.device = "cpu"
                print("MPS not available, falling back to CPU")

            # Load default model to test initialization
            default_model = self.config.model or "all-MiniLM-L6-v2"
            await self._load_model(default_model)

            self.status = self.ProviderStatus.HEALTHY

        except Exception as e:
            self.status = self.ProviderStatus.UNHEALTHY
            raise RuntimeError(f"Failed to initialize local provider: {e}")

    async def cleanup(self) -> None:
        """Cleanup local provider resources."""
        # Clear model cache
        self._model_cache.clear()
        self._tokenizer_cache.clear()

        # Clear CUDA cache if using GPU
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _get_model(self, model: Optional[str] = None) -> str:
        """Get model name, falling back to config default."""
        return model or self.config.model or "all-MiniLM-L6-v2"

    def _validate_model(self, model: str) -> None:
        """Validate that the model is supported."""
        # List of commonly supported sentence transformer models
        supported_models = {
            "all-MiniLM-L6-v2": 384,
            "all-mpnet-base-v2": 768,
            "paraphrase-multilingual-MiniLM-L12-v2": 384,
            "multi-qa-mpnet-base-dot-v1": 768,
            "all-distilroberta-v1": 768,
            "paraphrase-multilingual-mpnet-base-v2": 768,
            "sentence-t5-xl": 768,
            "sentence-t5-base": 768,
        }

        # For local models, we're more permissive
        # The model will be downloaded if not available
        pass

    async def _load_model(self, model_name: str) -> SentenceTransformer:
        """Load model into cache if not already loaded."""
        if model_name not in self._model_cache:
            # Check cache size limit
            if len(self._model_cache) >= self.cache_size:
                # Remove least recently used model
                oldest_model = next(iter(self._model_cache))
                del self._model_cache[oldest_model]

                # Clear CUDA cache if needed
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()

            try:
                # Download and load model
                model_path = os.path.join(self.models_directory, model_name)

                if os.path.exists(model_path):
                    # Load from local cache
                    model = SentenceTransformer(model_path, device=self.device)
                else:
                    # Download and cache model
                    model = SentenceTransformer(model_name, device=self.device)

                    # Save to local cache
                    model.save(model_path)

                self._model_cache[model_name] = model

            except Exception as e:
                raise RuntimeError(f"Failed to load model {model_name}: {e}")

        return self._model_cache[model_name]

    async def _load_tokenizer(self, model_name: str) -> AutoTokenizer:
        """Load tokenizer into cache if not already loaded."""
        if model_name not in self._tokenizer_cache:
            try:
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                self._tokenizer_cache[model_name] = tokenizer
            except Exception as e:
                raise RuntimeError(f"Failed to load tokenizer for {model_name}: {e}")

        return self._tokenizer_cache[model_name]

    def _count_tokens(self, text: str, model_name: str) -> int:
        """Count tokens using the model's tokenizer."""
        try:
            tokenizer = self._tokenizer_cache.get(model_name)
            if not tokenizer:
                # Fallback to simple estimation
                return len(text.split())

            return len(tokenizer.encode(text, add_special_tokens=False))
        except Exception:
            # Fallback estimation
            return len(text.split())

    async def generate_embedding(
        self, text: str, model: Optional[str] = None, **kwargs
    ) -> EmbeddingResult:
        """Generate embedding for a single text using local model."""
        model_name = self._get_model(model)
        self._validate_model(model_name)
        self.validate_text(text)

        start_time = time.time()

        try:
            # Load model if not cached
            model = await self._load_model(model_name)

            # Count tokens
            token_count = self._count_tokens(text, model_name)

            # Generate embedding
            embedding = model.encode(
                text,
                convert_to_tensor=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )

            # Convert to list
            if isinstance(embedding, torch.Tensor):
                embedding = embedding.cpu().numpy()

            embedding_list = embedding.tolist()

            processing_time_ms = int((time.time() - start_time) * 1000)

            return EmbeddingResult(
                embedding=embedding_list,
                dimensions=len(embedding_list),
                token_count=token_count,
                processing_time_ms=processing_time_ms,
                model=model_name,
                provider=self.name,
                metadata={
                    "device": str(embedding.device)
                    if hasattr(embedding, "device")
                    else self.device,
                    "model_type": "sentence_transformer",
                    "normalized": True,
                },
            )

        except Exception as e:
            raise RuntimeError(f"Failed to generate embedding with {model_name}: {e}")

    async def generate_batch_embeddings(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: Optional[int] = None,
        **kwargs,
    ) -> BatchEmbeddingResult:
        """Generate embeddings for multiple texts using local model."""
        model_name = self._get_model(model)
        self._validate_model(model_name)
        self.validate_batch(texts)

        # Use provider's max batch size or specified batch size
        effective_batch_size = min(
            batch_size or self.capabilities.max_batch_size,
            self.capabilities.max_batch_size,
        )

        start_time = time.time()
        all_embeddings: List[List[float]] = []
        all_token_counts: List[int] = []

        try:
            # Load model if not cached
            model = await self._load_model(model_name)

            # Load tokenizer for token counting
            try:
                tokenizer = await self._load_tokenizer(model_name)
            except Exception:
                tokenizer = None

            # Process in batches
            for i in range(0, len(texts), effective_batch_size):
                batch_texts = texts[i : i + effective_batch_size]

                # Count tokens for batch
                if tokenizer:
                    batch_token_counts = [
                        len(tokenizer.encode(text, add_special_tokens=False))
                        for text in batch_texts
                    ]
                else:
                    batch_token_counts = [len(text.split()) for text in batch_texts]

                # Generate embeddings for batch
                batch_embeddings = model.encode(
                    batch_texts,
                    convert_to_tensor=True,
                    normalize_embeddings=True,
                    show_progress_bar=False,
                    batch_size=len(batch_texts),
                )

                # Convert to list format
                if isinstance(batch_embeddings, torch.Tensor):
                    batch_embeddings = batch_embeddings.cpu().numpy()

                if batch_embeddings.ndim == 1:
                    batch_embeddings = batch_embeddings.reshape(1, -1)

                batch_embedding_lists = batch_embeddings.tolist()

                all_embeddings.extend(batch_embedding_lists)
                all_token_counts.extend(batch_token_counts)

            processing_time_ms = int((time.time() - start_time) * 1000)

            if not all_embeddings:
                raise RuntimeError("No embeddings were generated")

            dimensions = len(all_embeddings[0])

            return BatchEmbeddingResult(
                embeddings=all_embeddings,
                dimensions=dimensions,
                token_counts=all_token_counts,
                processing_time_ms=processing_time_ms,
                model=model_name,
                provider=self.name,
                batch_size=len(texts),
                metadata={
                    "device": self.device,
                    "model_type": "sentence_transformer",
                    "normalized": True,
                    "actual_batch_size": effective_batch_size,
                    "total_batches": (len(texts) + effective_batch_size - 1)
                    // effective_batch_size,
                    "average_tokens_per_text": sum(all_token_counts)
                    / len(all_token_counts),
                },
            )

        except Exception as e:
            raise RuntimeError(
                f"Failed to generate batch embeddings with {model_name}: {e}"
            )

    async def health_check(self) -> bool:
        """Perform health check specific to local provider."""
        try:
            # Test with default model
            default_model = self.config.model or "all-MiniLM-L6-v2"

            # Try to load model
            model = await self._load_model(default_model)

            # Test embedding generation
            test_embedding = model.encode(
                "health check test",
                convert_to_tensor=True,
                normalize_embeddings=True,
            )

            # Check if embedding is valid
            if test_embedding is None or len(test_embedding) == 0:
                return False

            self.status = self.ProviderStatus.HEALTHY
            return True

        except Exception:
            self.status = self.ProviderStatus.UNHEALTHY
            return False

    def get_model_info(self, model: str) -> Dict[str, Any]:
        """Get information about a specific model."""
        # Common sentence transformer models info
        model_info = {
            "all-MiniLM-L6-v2": {
                "dimensions": 384,
                "max_tokens": 512,
                "cost_per_1m_tokens": 0.0,
                "description": "Fast and efficient multilingual model",
                "languages": ["en", "de", "fr", "es", "it", "pt", "zh", "ja", "ru"],
                "size_mb": 90,
            },
            "all-mpnet-base-v2": {
                "dimensions": 768,
                "max_tokens": 514,
                "cost_per_1m_tokens": 0.0,
                "description": "High quality English model",
                "languages": ["en"],
                "size_mb": 420,
            },
            "paraphrase-multilingual-MiniLM-L12-v2": {
                "dimensions": 384,
                "max_tokens": 512,
                "cost_per_1m_tokens": 0.0,
                "description": "Multilingual paraphrase model",
                "languages": ["en", "de", "fr", "es", "it", "pt", "zh", "ja", "ru"],
                "size_mb": 470,
            },
            "multi-qa-mpnet-base-dot-v1": {
                "dimensions": 768,
                "max_tokens": 514,
                "cost_per_1m_tokens": 0.0,
                "description": "Fine-tuned for QA tasks",
                "languages": ["en"],
                "size_mb": 420,
            },
        }

        return model_info.get(model, {})

    async def estimate_cost(
        self, texts: List[str], model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Estimate cost for embedding texts (always zero for local models).

        Args:
            texts: List of texts to embed
            model: Model to use

        Returns:
            Dictionary with cost estimation
        """
        model = self._get_model(model)

        # Estimate tokens (rough estimation)
        total_tokens = sum(len(text.split()) for text in texts)

        return {
            "total_texts": len(texts),
            "total_tokens": total_tokens,
            "model": model,
            "cost_per_1m_tokens": 0.0,
            "estimated_cost_usd": 0.0,
            "estimated_cost_per_text": 0.0,
            "note": "Local models have no direct API costs, only compute costs",
            "estimated_compute_time_ms": len(texts) * 50,  # Rough estimate
        }

    async def list_available_models(self) -> List[str]:
        """List models available in the local cache."""
        models_directory = Path(self.models_directory)

        if not models_directory.exists():
            return []

        available_models = []
        for model_dir in models_directory.iterdir():
            if model_dir.is_dir() and (model_dir / "config.json").exists():
                available_models.append(model_dir.name)

        return available_models

    async def download_model(self, model_name: str) -> Dict[str, Any]:
        """
        Download and cache a model.

        Args:
            model_name: Name of the model to download

        Returns:
            Dictionary with download status
        """
        try:
            start_time = time.time()

            # Load model (this will download if not cached)
            model = await self._load_model(model_name)

            download_time = int((time.time() - start_time) * 1000)

            # Get model info
            model_info = self.get_model_info(model_name)

            return {
                "model_name": model_name,
                "status": "success",
                "download_time_ms": download_time,
                "model_info": model_info,
                "cached_path": os.path.join(self.models_directory, model_name),
            }

        except Exception as e:
            return {
                "model_name": model_name,
                "status": "error",
                "error": str(e),
            }
