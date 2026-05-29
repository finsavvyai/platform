"""
High-level cache manager for embeddings.

This module provides a high-level interface for managing embedding caches
with intelligent strategies, warming, and optimization.
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from .redis_cache import RedisEmbeddingCache
from .cache_stats import CacheStats


class CacheManager:
    """High-level cache manager with intelligent strategies."""

    def __init__(
        self,
        redis_cache: RedisEmbeddingCache,
        enable_warming: bool = True,
        enable_stats: bool = True,
        cleanup_interval: int = 3600,  # 1 hour
        stats_retention_days: int = 30,
    ):
        """
        Initialize cache manager.

        Args:
            redis_cache: Redis cache instance
            enable_warming: Enable cache warming
            enable_stats: Enable detailed statistics
            cleanup_interval: Cleanup interval in seconds
            stats_retention_days: Days to retain statistics
        """
        self.cache = redis_cache
        self.enable_warming = enable_warming
        self.enable_stats = enable_stats
        self.cleanup_interval = cleanup_interval
        self.stats_retention_days = stats_retention_days

        self._stats = CacheStats()
        self._warming_queue: asyncio.Queue = asyncio.Queue()
        self._cleanup_task: Optional[asyncio.Task] = None
        self._warming_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Start cache manager background tasks."""
        if self._running:
            return

        self._running = True

        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_worker())

        # Start warming task if enabled
        if self.enable_warming:
            self._warming_task = asyncio.create_task(self._warming_worker())

    async def stop(self) -> None:
        """Stop cache manager background tasks."""
        self._running = False

        # Cancel tasks
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        if self._warming_task:
            self._warming_task.cancel()
            try:
                await self._warming_task
            except asyncio.CancelledError:
                pass

    async def get_embedding(
        self, text: str, provider: str, model: str, **kwargs
    ) -> Optional[List[float]]:
        """
        Get cached embedding with analytics.

        Args:
            text: Text that was embedded
            provider: Provider name
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Cached embedding or None if not found
        """
        start_time = time.time()

        try:
            result = await self.cache.get_embedding(text, provider, model, **kwargs)

            # Update statistics
            elapsed_ms = (time.time() - start_time) * 1000
            if result:
                self._stats.record_hit(elapsed_ms)
            else:
                self._stats.record_miss(elapsed_ms)

            # Add to warming queue if this is a frequently accessed pattern
            if self.enable_warming and result is None:
                await self._add_to_warming_queue(text, provider, model, kwargs)

            return result

        except Exception as e:
            self._stats.record_error()
            raise e

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
        Cache an embedding with analytics.

        Args:
            text: Text that was embedded
            embedding: Embedding vector
            provider: Provider name
            model: Model name
            ttl_seconds: Custom TTL
            quality_score: Quality score
            **kwargs: Additional parameters

        Returns:
            True if successfully cached
        """
        start_time = time.time()

        try:
            result = await self.cache.set_embedding(
                text, embedding, provider, model, ttl_seconds, quality_score, **kwargs
            )

            # Update statistics
            elapsed_ms = (time.time() - start_time) * 1000
            self._stats.record_set(elapsed_ms, len(embedding))

            return result

        except Exception as e:
            self._stats.record_error()
            raise e

    async def get_batch_embeddings(
        self, texts: List[str], provider: str, model: str, **kwargs
    ) -> Tuple[List[Optional[List[float]]], List[int]]:
        """
        Get cached embeddings for a batch with analytics.

        Args:
            texts: List of texts
            provider: Provider name
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Tuple of (cached_embeddings, missing_indices)
        """
        start_time = time.time()

        try:
            cached_embeddings, missing_indices = await self.cache.get_batch_embeddings(
                texts, provider, model, **kwargs
            )

            # Update statistics
            elapsed_ms = (time.time() - start_time) * 1000
            hit_count = len(texts) - len(missing_indices)
            self._stats.record_batch_hit(len(texts), hit_count, elapsed_ms)

            return cached_embeddings, missing_indices

        except Exception as e:
            self._stats.record_error()
            raise e

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
        Cache a batch of embeddings with analytics.

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
        start_time = time.time()

        try:
            result = await self.cache.set_batch_embeddings(
                texts, embeddings, provider, model, ttl_seconds, **kwargs
            )

            # Update statistics
            elapsed_ms = (time.time() - start_time) * 1000
            total_size = sum(len(emb) for emb in embeddings)
            self._stats.record_batch_set(len(embeddings), total_size, elapsed_ms)

            return result

        except Exception as e:
            self._stats.record_error()
            raise e

    async def warm_cache(
        self, texts: List[str], provider: str, model: str, priority: int = 0, **kwargs
    ) -> None:
        """
        Add texts to cache warming queue.

        Args:
            texts: List of texts to warm up
            provider: Provider name
            model: Model name
            priority: Warmup priority (higher = more important)
            **kwargs: Additional parameters
        """
        if not self.enable_warming:
            return

        warmup_request = {
            "texts": texts,
            "provider": provider,
            "model": model,
            "priority": priority,
            "kwargs": kwargs,
            "timestamp": datetime.utcnow(),
        }

        await self._warming_queue.put(warmup_request)

    async def invalidate_by_provider(self, provider: str) -> int:
        """
        Invalidate all cache entries for a provider.

        Args:
            provider: Provider name

        Returns:
            Number of invalidated entries
        """
        # This would require implementing pattern-based deletion in RedisEmbeddingCache
        # For now, return 0 as placeholder
        return 0

    async def invalidate_by_model(self, provider: str, model: str) -> int:
        """
        Invalidate all cache entries for a specific model.

        Args:
            provider: Provider name
            model: Model name

        Returns:
            Number of invalidated entries
        """
        # This would require implementing pattern-based deletion in RedisEmbeddingCache
        # For now, return 0 as placeholder
        return 0

    async def optimize_cache(self) -> Dict[str, Any]:
        """
        Optimize cache performance and storage.

        Returns:
            Optimization results
        """
        try:
            # Get current stats
            current_stats = await self.get_stats()

            optimization_results = {
                "timestamp": datetime.utcnow().isoformat(),
                "before_stats": current_stats,
                "actions_taken": [],
                "space_saved": 0,
                "performance_improvement": 0.0,
            }

            # Clear expired entries
            expired_count = await self.cache.clear_expired()
            if expired_count > 0:
                optimization_results["actions_taken"].append(
                    f"Cleaned up {expired_count} expired entries"
                )

            # Analyze hit rate and suggest optimizations
            hit_rate = current_stats.get("hit_rate", 0.0)
            if hit_rate < 0.5:  # Less than 50% hit rate
                optimization_results["actions_taken"].append(
                    "Low hit rate detected - consider increasing TTL or reviewing access patterns"
                )

            # Check memory usage
            memory_usage = current_stats.get("memory_usage", 0)
            if memory_usage > 1024 * 1024 * 1024:  # > 1GB
                optimization_results["actions_taken"].append(
                    "High memory usage detected - consider reducing TTL or implementing eviction policies"
                )

            # Get optimized stats
            optimized_stats = await self.get_stats()
            optimization_results["after_stats"] = optimized_stats

            return optimization_results

        except Exception as e:
            return {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get comprehensive cache statistics.

        Returns:
            Cache statistics
        """
        # Get base cache stats
        cache_stats = await self.cache.get_stats()

        # Add manager stats
        manager_stats = self._stats.to_dict() if self.enable_stats else {}

        return {
            **cache_stats,
            "manager_stats": manager_stats,
            "warming_enabled": self.enable_warming,
            "warming_queue_size": self._warming_queue.qsize()
            if self.enable_warming
            else 0,
            "cleanup_interval": self.cleanup_interval,
            "stats_retention_days": self.stats_retention_days,
        }

    async def export_stats(self, format: str = "json") -> Union[str, bytes]:
        """
        Export cache statistics.

        Args:
            format: Export format (json, csv)

        Returns:
            Exported statistics
        """
        stats = await self.get_stats()

        if format.lower() == "json":
            import json

            return json.dumps(stats, indent=2, default=str)

        elif format.lower() == "csv":
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow(["metric", "value"])

            # Write stats
            for key, value in stats.items():
                if isinstance(value, (int, float, str)):
                    writer.writerow([key, value])

            return output.getvalue()

        else:
            raise ValueError(f"Unsupported export format: {format}")

    async def _add_to_warming_queue(
        self, text: str, provider: str, model: str, kwargs: Dict[str, Any]
    ) -> None:
        """Add single text to warming queue."""
        if not self.enable_warming:
            return

        warmup_request = {
            "texts": [text],
            "provider": provider,
            "model": model,
            "priority": 1,  # Lower priority for automatic warming
            "kwargs": kwargs,
            "timestamp": datetime.utcnow(),
        }

        try:
            await self._warming_queue.put_nowait(warmup_request)
        except asyncio.QueueFull:
            # Queue is full, skip warming
            pass

    async def _warming_worker(self) -> None:
        """Background worker for cache warming."""
        while self._running:
            try:
                # Wait for warmup request with timeout
                warmup_request = await asyncio.wait_for(
                    self._warming_queue.get(), timeout=60.0
                )

                # Process warmup request
                await self._process_warmup_request(warmup_request)

            except asyncio.TimeoutError:
                # No warmup requests, continue
                continue
            except Exception as e:
                # Log error and continue
                print(f"Cache warming error: {e}")
                continue

    async def _process_warmup_request(self, warmup_request: Dict[str, Any]) -> None:
        """Process a single warmup request."""
        try:
            texts = warmup_request["texts"]
            provider = warmup_request["provider"]
            model = warmup_request["model"]
            kwargs = warmup_request.get("kwargs", {})

            # Check if texts are already cached
            cached_embeddings, missing_indices = await self.get_batch_embeddings(
                texts, provider, model, **kwargs
            )

            # Only warm up missing texts
            if missing_indices:
                missing_texts = [texts[i] for i in missing_indices]

                # In a real implementation, you would generate embeddings here
                # For now, we'll just log that warming is needed
                print(f"Cache warming needed for {len(missing_texts)} texts")

        except Exception as e:
            print(f"Failed to process warmup request: {e}")

    async def _cleanup_worker(self) -> None:
        """Background worker for cache cleanup."""
        while self._running:
            try:
                # Sleep for cleanup interval
                await asyncio.sleep(self.cleanup_interval)

                # Perform cleanup
                if not self._running:
                    break

                await self._perform_cleanup()

            except Exception as e:
                print(f"Cache cleanup error: {e}")
                continue

    async def _perform_cleanup(self) -> None:
        """Perform periodic cleanup tasks."""
        try:
            # Clear expired entries
            expired_count = await self.cache.clear_expired()
            if expired_count > 0:
                print(f"Cleaned up {expired_count} expired cache entries")

            # Clean up old performance data
            await self._cleanup_performance_data()

            # Clean up old statistics
            if self.enable_stats:
                await self._cleanup_old_stats()

        except Exception as e:
            print(f"Cleanup task failed: {e}")

    async def _cleanup_performance_data(self) -> None:
        """Clean up old performance tracking data."""
        try:
            # This would require implementing cleanup in RedisEmbeddingCache
            # For now, just log
            pass
        except Exception as e:
            print(f"Performance data cleanup failed: {e}")

    async def _cleanup_old_stats(self) -> None:
        """Clean up old statistics data."""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.stats_retention_days)

            # This would require implementing time-based cleanup in CacheStats
            # For now, just log
            pass
        except Exception as e:
            print(f"Old stats cleanup failed: {e}")
