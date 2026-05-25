"""
Redis-based embedding cache implementation.

This module provides a Redis-based caching system for embeddings with
intelligent eviction, compression, and performance monitoring.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import redis.asyncio as redis
from redis.asyncio import Redis

from .cache_key import CacheKeyGenerator
from .compression import CompressionManager


class RedisEmbeddingCache:
    """Redis-based embedding cache with advanced features."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        key_prefix: str = "emb",
        ttl_seconds: int = 86400,  # 24 hours
        compression_enabled: bool = True,
        max_connections: int = 20,
        compression_level: int = 6,
    ):
        """
        Initialize Redis embedding cache.

        Args:
            redis_url: Redis connection URL
            key_prefix: Prefix for cache keys
            ttl_seconds: Default TTL in seconds
            compression_enabled: Enable compression
            max_connections: Maximum Redis connections
            compression_level: Compression level (1-9)
        """
        self.redis_url = redis_url
        self.key_prefix = key_prefix
        self.ttl_seconds = ttl_seconds
        self.compression_enabled = compression_enabled
        self.max_connections = max_connections

        self._redis: Optional[Redis] = None
        self._key_generator = CacheKeyGenerator(key_prefix)
        self._compression_manager = CompressionManager(compression_level)

        # Statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "errors": 0,
            "total_requests": 0,
            "cache_size": 0,
            "last_access": None,
            "compression_ratio": 0.0,
            "memory_usage": 0,
        }

    async def initialize(self) -> None:
        """Initialize Redis connection."""
        try:
            self._redis = redis.from_url(
                self.redis_url,
                max_connections=self.max_connections,
                socket_timeout=5,
                socket_connect_timeout=5,
                health_check_interval=30,
            )

            # Test connection
            await self._redis.ping()

            # Load initial statistics
            await self._load_stats()

        except Exception as e:
            raise RuntimeError(f"Failed to initialize Redis cache: {e}")

    async def cleanup(self) -> None:
        """Cleanup Redis connection."""
        if self._redis:
            await self._redis.close()
            await self._redis.wait_closed()
            self._redis = None

    async def get_embedding(
        self, text: str, provider: str, model: str, **kwargs
    ) -> Optional[List[float]]:
        """
        Get cached embedding.

        Args:
            text: Text that was embedded
            provider: Provider name
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Cached embedding or None if not found
        """
        if not self._redis:
            raise RuntimeError("Redis cache not initialized")

        start_time = time.time()
        self._stats["total_requests"] += 1

        try:
            # Generate cache key
            cache_key = self._key_generator.generate_key(
                text, provider, model, **kwargs
            )

            # Try to get from cache
            cached_data = await self._redis.get(cache_key)

            if cached_data is None:
                self._stats["misses"] += 1
                return None

            # Deserialize cached data
            cache_entry = json.loads(cached_data)

            # Check if expired (double-check)
            if self._is_expired(cache_entry):
                await self._redis.delete(cache_key)
                self._stats["misses"] += 1
                return None

            # Decompress embedding if needed
            if self.compression_enabled and cache_entry.get("compressed", False):
                embedding = self._compression_manager.decompress_embedding(
                    cache_entry["embedding_data"]
                )
            else:
                embedding = cache_entry["embedding"]

            # Update access statistics
            await self._update_access_stats(cache_key, cache_entry)

            self._stats["hits"] += 1
            self._stats["last_access"] = datetime.utcnow()

            return embedding

        except Exception as e:
            self._stats["errors"] += 1
            raise RuntimeError(f"Failed to get cached embedding: {e}")
        finally:
            # Track performance
            elapsed_ms = (time.time() - start_time) * 1000
            await self._track_performance("get", elapsed_ms)

    async def set_embedding(
        self,
        text: str,
        embedding: List[float],
        provider: str,
        model: str,
        ttl_seconds: Optional[int] = None,
        quality_score: Optional[float] = None,
        **kwargs,
    ) -> bool:
        """
        Cache an embedding.

        Args:
            text: Text that was embedded
            embedding: Embedding vector
            provider: Provider name
            model: Model name
            ttl_seconds: Custom TTL (overrides default)
            quality_score: Quality score of the embedding
            **kwargs: Additional parameters

        Returns:
            True if successfully cached
        """
        if not self._redis:
            raise RuntimeError("Redis cache not initialized")

        start_time = time.time()
        ttl = ttl_seconds or self.ttl_seconds

        try:
            # Generate cache key
            cache_key = self._key_generator.generate_key(
                text, provider, model, **kwargs
            )

            # Prepare cache entry
            cache_entry = {
                "text_hash": self._key_generator.generate_content_hash(text),
                "provider": provider.lower(),
                "model": model.lower(),
                "dimensions": len(embedding),
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(seconds=ttl)).isoformat(),
                "access_count": 0,
                "last_accessed": datetime.utcnow().isoformat(),
                "quality_score": quality_score,
                "compressed": False,
            }

            # Add relevant parameters
            relevant_params = {}
            parameter_whitelist = [
                "input_type",
                "encoding_format",
                "user",
                "truncate",
                "normalize",
            ]
            for key, value in kwargs.items():
                if key in parameter_whitelist and value is not None:
                    relevant_params[key] = value
            if relevant_params:
                cache_entry["params"] = relevant_params

            # Compress embedding if beneficial
            if (
                self.compression_enabled
                and self._compression_manager.is_compression_beneficial(embedding)
            ):
                compressed_embedding = self._compression_manager.compress_embedding(
                    embedding
                )
                cache_entry["embedding_data"] = compressed_embedding
                cache_entry["compressed"] = True
                cache_entry["original_size"] = len(embedding) * 8  # 8 bytes per float
                cache_entry["compressed_size"] = len(compressed_embedding)
            else:
                cache_entry["embedding"] = embedding

            # Serialize and cache
            serialized_data = json.dumps(cache_entry)

            # Set in Redis with TTL
            await self._redis.setex(cache_key, ttl, serialized_data)

            # Update statistics
            self._stats["sets"] += 1

            # Update cache size tracking
            await self._update_cache_size()

            return True

        except Exception as e:
            self._stats["errors"] += 1
            raise RuntimeError(f"Failed to cache embedding: {e}")
        finally:
            # Track performance
            elapsed_ms = (time.time() - start_time) * 1000
            await self._track_performance("set", elapsed_ms)

    async def get_batch_embeddings(
        self, texts: List[str], provider: str, model: str, **kwargs
    ) -> Tuple[List[Optional[List[float]]], List[int]]:
        """
        Get cached embeddings for a batch of texts.

        Args:
            texts: List of texts
            provider: Provider name
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Tuple of (cached_embeddings, missing_indices)
        """
        if not self._redis:
            raise RuntimeError("Redis cache not initialized")

        cached_embeddings = []
        missing_indices = []

        # Generate batch cache key
        batch_key = self._key_generator.generate_batch_key(
            texts, provider, model, **kwargs
        )

        try:
            # Try to get batch result
            batch_data = await self._redis.get(batch_key)

            if batch_data is not None:
                # Batch found in cache
                batch_entry = json.loads(batch_data)

                if not self._is_expired(batch_entry):
                    # Decompress batch embeddings
                    if self.compression_enabled and batch_entry.get(
                        "compressed", False
                    ):
                        embeddings = (
                            self._compression_manager.decompress_batch_embeddings(
                                batch_entry["embedding_data"]
                            )
                        )
                    else:
                        embeddings = batch_entry["embeddings"]

                    cached_embeddings = embeddings

                    # Update batch access stats
                    await self._update_access_stats(batch_key, batch_entry)

                    self._stats["hits"] += 1
                    return cached_embeddings, missing_indices

        except Exception:
            # Fall back to individual lookups
            pass

        # Individual lookups for missing embeddings
        for i, text in enumerate(texts):
            try:
                embedding = await self.get_embedding(text, provider, model, **kwargs)
                cached_embeddings.append(embedding)

                if embedding is None:
                    missing_indices.append(i)

            except Exception:
                cached_embeddings.append(None)
                missing_indices.append(i)

        return cached_embeddings, missing_indices

    async def set_batch_embeddings(
        self,
        texts: List[str],
        embeddings: List[List[float]],
        provider: str,
        model: str,
        ttl_seconds: Optional[int] = None,
        **kwargs,
    ) -> bool:
        """
        Cache a batch of embeddings.

        Args:
            texts: List of texts
            embeddings: List of embeddings
            provider: Provider name
            model: Model name
            ttl_seconds: Custom TTL
            **kwargs: Additional parameters

        Returns:
            True if successfully cached
        """
        if not self._redis:
            raise RuntimeError("Redis cache not initialized")

        if len(texts) != len(embeddings):
            raise ValueError("Texts and embeddings must have same length")

        ttl = ttl_seconds or self.ttl_seconds

        try:
            # Generate batch cache key
            batch_key = self._key_generator.generate_batch_key(
                texts, provider, model, **kwargs
            )

            # Prepare batch cache entry
            batch_entry = {
                "text_hashes": [
                    self._key_generator.generate_content_hash(text) for text in texts
                ],
                "provider": provider.lower(),
                "model": model.lower(),
                "dimensions": len(embeddings[0]) if embeddings else 0,
                "batch_size": len(embeddings),
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(seconds=ttl)).isoformat(),
                "access_count": 0,
                "last_accessed": datetime.utcnow().isoformat(),
                "compressed": False,
            }

            # Add relevant parameters
            relevant_params = {}
            parameter_whitelist = [
                "input_type",
                "encoding_format",
                "user",
                "truncate",
                "normalize",
            ]
            for key, value in kwargs.items():
                if key in parameter_whitelist and value is not None:
                    relevant_params[key] = value
            if relevant_params:
                batch_entry["params"] = relevant_params

            # Compress batch embeddings if beneficial
            if self.compression_enabled:
                # Estimate compression for batch
                stats = self._compression_manager.calculate_stats(embeddings)
                if stats.get("compression_ratio", 0) > 1.2:  # 20% reduction threshold
                    compressed_embeddings = (
                        self._compression_manager.compress_batch_embeddings(embeddings)
                    )
                    batch_entry["embedding_data"] = compressed_embeddings
                    batch_entry["compressed"] = True
                    batch_entry["original_size"] = stats.get("original_size_bytes", 0)
                    batch_entry["compressed_size"] = stats.get(
                        "compressed_size_bytes", 0
                    )
                else:
                    batch_entry["embeddings"] = embeddings
            else:
                batch_entry["embeddings"] = embeddings

            # Serialize and cache
            serialized_data = json.dumps(batch_entry)

            # Set in Redis with TTL
            await self._redis.setex(batch_key, ttl, serialized_data)

            self._stats["sets"] += 1
            return True

        except Exception as e:
            self._stats["errors"] += 1
            raise RuntimeError(f"Failed to cache batch embeddings: {e}")

    async def delete_embedding(
        self, text: str, provider: str, model: str, **kwargs
    ) -> bool:
        """
        Delete cached embedding.

        Args:
            text: Text that was embedded
            provider: Provider name
            model: Model name
            **kwargs: Additional parameters

        Returns:
            True if successfully deleted
        """
        if not self._redis:
            raise RuntimeError("Redis cache not initialized")

        try:
            cache_key = self._key_generator.generate_key(
                text, provider, model, **kwargs
            )
            result = await self._redis.delete(cache_key)

            if result > 0:
                self._stats["deletes"] += 1
                return True

            return False

        except Exception as e:
            self._stats["errors"] += 1
            raise RuntimeError(f"Failed to delete cached embedding: {e}")

    async def clear_expired(self) -> int:
        """
        Clear expired entries from cache.

        Returns:
            Number of expired entries removed
        """
        if not self._redis:
            raise RuntimeError("Redis cache not initialized")

        try:
            # Get all keys with our prefix
            pattern = f"{self.key_prefix}:*"
            keys = await self._redis.keys(pattern)

            expired_count = 0
            current_time = datetime.utcnow()

            for key in keys:
                try:
                    # Get cache entry
                    cached_data = await self._redis.get(key)
                    if cached_data is None:
                        continue

                    cache_entry = json.loads(cached_data)

                    # Check if expired
                    if self._is_expired(cache_entry):
                        await self._redis.delete(key)
                        expired_count += 1

                except Exception:
                    # Skip problematic entries
                    continue

            return expired_count

        except Exception as e:
            self._stats["errors"] += 1
            raise RuntimeError(f"Failed to clear expired entries: {e}")

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Cache statistics
        """
        try:
            # Update current cache size
            await self._update_cache_size()

            # Get Redis info
            if self._redis:
                redis_info = await self._redis.info("memory")
                self._stats["memory_usage"] = redis_info.get("used_memory", 0)

            # Calculate derived metrics
            hit_rate = (
                self._stats["hits"] / self._stats["total_requests"]
                if self._stats["total_requests"] > 0
                else 0.0
            )

            return {
                **self._stats,
                "hit_rate": hit_rate,
                "miss_rate": 1.0 - hit_rate,
                "total_keys": self._stats["cache_size"],
                "redis_url": self.redis_url,
                "ttl_seconds": self.ttl_seconds,
                "compression_enabled": self.compression_enabled,
            }

        except Exception as e:
            return {
                "error": str(e),
                **self._stats,
            }

    async def reset_stats(self) -> None:
        """Reset cache statistics."""
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "errors": 0,
            "total_requests": 0,
            "cache_size": 0,
            "last_access": None,
            "compression_ratio": 0.0,
            "memory_usage": 0,
        }

    def _is_expired(self, cache_entry: Dict[str, Any]) -> bool:
        """Check if cache entry is expired."""
        try:
            expires_at_str = cache_entry.get("expires_at")
            if not expires_at_str:
                return True

            expires_at = datetime.fromisoformat(expires_at_str)
            return datetime.utcnow() > expires_at

        except Exception:
            return True

    async def _update_access_stats(
        self, cache_key: str, cache_entry: Dict[str, Any]
    ) -> None:
        """Update access statistics for a cache entry."""
        try:
            # Update access count and last accessed time
            cache_entry["access_count"] = cache_entry.get("access_count", 0) + 1
            cache_entry["last_accessed"] = datetime.utcnow().isoformat()

            # Update in Redis
            serialized_data = json.dumps(cache_entry)

            # Get remaining TTL
            ttl = await self._redis.ttl(cache_key)
            if ttl > 0:
                await self._redis.setex(cache_key, ttl, serialized_data)

        except Exception:
            # Don't fail the operation if stats update fails
            pass

    async def _update_cache_size(self) -> None:
        """Update cache size statistics."""
        try:
            if self._redis:
                pattern = f"{self.key_prefix}:*"
                keys = await self._redis.keys(pattern)
                self._stats["cache_size"] = len(keys)
        except Exception:
            pass

    async def _load_stats(self) -> None:
        """Load initial statistics from Redis."""
        try:
            stats_key = f"{self.key_prefix}:stats"
            stats_data = await self._redis.get(stats_key)

            if stats_data:
                saved_stats = json.loads(stats_data)
                self._stats.update(saved_stats)

        except Exception:
            # Use default stats if loading fails
            pass

    async def _track_performance(self, operation: str, elapsed_ms: float) -> None:
        """Track operation performance."""
        try:
            # Track performance metrics in Redis
            perf_key = f"{self.key_prefix}:perf:{operation}"

            # Use Redis sorted set for time-series data
            timestamp = int(time.time() * 1000)  # milliseconds
            await self._redis.zadd(perf_key, {str(timestamp): elapsed_ms})

            # Keep only last 1000 entries
            await self._redis.zremrangebyrank(perf_key, 0, -1001)

        except Exception:
            # Don't fail the operation if performance tracking fails
            pass
