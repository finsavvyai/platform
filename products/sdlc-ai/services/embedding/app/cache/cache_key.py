"""
Cache key generation utilities.

This module provides utilities for generating consistent and efficient
cache keys for embedding requests.
"""

import hashlib
import json
from typing import Any, Dict, Optional


class CacheKeyGenerator:
    """Generates cache keys for embedding requests."""

    def __init__(self, key_prefix: str = "emb"):
        """
        Initialize cache key generator.

        Args:
            key_prefix: Prefix for all cache keys
        """
        self.key_prefix = key_prefix

    def generate_key(self, text: str, provider: str, model: str, **kwargs) -> str:
        """
        Generate cache key for embedding request.

        Args:
            text: Text to embed
            provider: Provider name
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Cache key string
        """
        # Create normalized key data
        key_data = {
            "text": text.strip().lower(),  # Normalize text
            "provider": provider.lower(),
            "model": model.lower(),
        }

        # Add relevant kwargs that affect the embedding
        relevant_kwargs = {}

        # Common parameters that affect embeddings
        parameter_whitelist = [
            "dimensions",
            "input_type",  # Cohere specific
            "encoding_format",  # OpenAI specific
            "user",  # OpenAI specific
            "truncate",  # Some providers support truncation
            "normalize",  # Normalization settings
        ]

        for key, value in kwargs.items():
            if key in parameter_whitelist and value is not None:
                relevant_kwargs[key] = value

        if relevant_kwargs:
            key_data["params"] = relevant_kwargs

        # Convert to JSON string for consistent hashing
        key_string = json.dumps(key_data, sort_keys=True, separators=(",", ":"))

        # Generate SHA-256 hash
        hash_value = hashlib.sha256(key_string.encode("utf-8")).hexdigest()

        # Combine with prefix
        cache_key = f"{self.key_prefix}:{hash_value}"

        return cache_key

    def generate_batch_key(
        self, texts: list, provider: str, model: str, **kwargs
    ) -> str:
        """
        Generate cache key for batch embedding request.

        Args:
            texts: List of texts to embed
            provider: Provider name
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Cache key string
        """
        # Normalize texts
        normalized_texts = [text.strip().lower() for text in texts]

        # Create normalized key data
        key_data = {
            "texts": normalized_texts,
            "provider": provider.lower(),
            "model": model.lower(),
            "batch": True,  # Mark as batch request
        }

        # Add relevant kwargs
        relevant_kwargs = {}

        parameter_whitelist = [
            "dimensions",
            "input_type",
            "encoding_format",
            "user",
            "truncate",
            "normalize",
            "batch_size",
        ]

        for key, value in kwargs.items():
            if key in parameter_whitelist and value is not None:
                relevant_kwargs[key] = value

        if relevant_kwargs:
            key_data["params"] = relevant_kwargs

        # Convert to JSON string for consistent hashing
        key_string = json.dumps(key_data, sort_keys=True, separators=(",", ":"))

        # Generate SHA-256 hash
        hash_value = hashlib.sha256(key_string.encode("utf-8")).hexdigest()

        # Combine with prefix
        cache_key = f"{self.key_prefix}:batch:{hash_value}"

        return cache_key

    def generate_content_hash(self, text: str) -> str:
        """
        Generate content hash for text (independent of provider/model).

        Args:
            text: Text to hash

        Returns:
            Content hash string
        """
        # Normalize text
        normalized_text = text.strip().lower()

        # Generate SHA-256 hash
        hash_value = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()

        return hash_value

    def parse_key(self, cache_key: str) -> Dict[str, Any]:
        """
        Parse cache key to extract information.

        Args:
            cache_key: Cache key string

        Returns:
            Parsed key information
        """
        try:
            # Remove prefix
            if cache_key.startswith(f"{self.key_prefix}:"):
                key_without_prefix = cache_key[len(f"{self.key_prefix}:") :]
            else:
                return {"error": "Invalid key prefix"}

            # Check if it's a batch key
            if key_without_prefix.startswith("batch:"):
                key_without_prefix = key_without_prefix[6:]
                is_batch = True
            else:
                is_batch = False

            # The remaining part is the hash
            hash_value = key_without_prefix

            return {
                "prefix": self.key_prefix,
                "hash": hash_value,
                "is_batch": is_batch,
                "full_key": cache_key,
            }

        except Exception as e:
            return {"error": f"Failed to parse key: {e}"}

    def generate_ttl_key(self, cache_key: str, ttl_seconds: int) -> str:
        """
        Generate TTL tracking key.

        Args:
            cache_key: Original cache key
            ttl_seconds: TTL in seconds

        Returns:
            TTL tracking key
        """
        ttl_hash = hashlib.sha256(f"{cache_key}:{ttl_seconds}".encode()).hexdigest()
        return f"{self.key_prefix}:ttl:{ttl_hash}"

    def generate_stats_key(self, provider: str, model: str) -> str:
        """
        Generate statistics tracking key.

        Args:
            provider: Provider name
            model: Model name

        Returns:
            Stats key
        """
        return f"{self.key_prefix}:stats:{provider.lower()}:{model.lower()}"

    def generate_warmup_key(self, pattern: str) -> str:
        """
        Generate cache warmup tracking key.

        Args:
            pattern: Warmup pattern identifier

        Returns:
            Warmup key
        """
        pattern_hash = hashlib.sha256(pattern.encode()).hexdigest()
        return f"{self.key_prefix}:warmup:{pattern_hash}"

    def is_valid_key(self, cache_key: str) -> bool:
        """
        Check if a cache key is valid.

        Args:
            cache_key: Cache key to validate

        Returns:
            True if key is valid
        """
        try:
            # Basic format validation
            if not cache_key or not isinstance(cache_key, str):
                return False

            # Check prefix
            if not cache_key.startswith(f"{self.key_prefix}:"):
                return False

            # Check length (SHA-256 hash)
            parts = cache_key.split(":")
            if len(parts) < 2:
                return False

            # The hash part should be 64 characters (SHA-256 hex)
            hash_part = parts[-1]
            if len(hash_part) != 64:
                return False

            # Check if hash is valid hex
            try:
                int(hash_part, 16)
            except ValueError:
                return False

            return True

        except Exception:
            return False

    def estimate_key_collision_probability(self, key_space_size: int = 2**256) -> float:
        """
        Estimate the probability of key collision.

        Args:
            key_space_size: Size of the key space

        Returns:
            Collision probability
        """
        # With SHA-256, collision probability is extremely low
        # This is mainly for documentation purposes
        return 1.0 / key_space_size

    def generate_fingerprint(self, text: str, length: int = 8) -> str:
        """
        Generate short fingerprint for text (for logging/debugging).

        Args:
            text: Text to fingerprint
            length: Length of fingerprint

        Returns:
            Short fingerprint
        """
        full_hash = hashlib.sha256(text.encode()).hexdigest()
        return full_hash[:length]
