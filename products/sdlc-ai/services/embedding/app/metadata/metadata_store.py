"""
Metadata storage implementation.

This module provides storage and retrieval capabilities for embedding metadata
with support for various storage backends.
"""

import json
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    import redis.asyncio as redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class MetadataStorageBackend(ABC):
    """Abstract base class for metadata storage backends."""

    @abstractmethod
    async def store_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Store metadata."""
        pass

    @abstractmethod
    async def get_metadata(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata by ID."""
        pass

    @abstractmethod
    async def update_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Update metadata."""
        pass

    @abstractmethod
    async def delete_metadata(self, metadata_id: str) -> bool:
        """Delete metadata."""
        pass

    @abstractmethod
    async def search_metadata(
        self,
        filters: Dict[str, Any],
        date_filters: Dict[str, datetime],
        quality_filters: Dict[str, float],
        limit: int,
        offset: int,
        sort_by: str,
        sort_order: str,
    ) -> List[Dict[str, Any]]:
        """Search metadata."""
        pass


class InMemoryMetadataStore(MetadataStorageBackend):
    """In-memory metadata store for testing and development."""

    def __init__(self):
        """Initialize in-memory store."""
        self._store: Dict[str, Dict[str, Any]] = {}

    async def store_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Store metadata in memory."""
        self._store[metadata_id] = metadata.copy()
        return True

    async def get_metadata(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata from memory."""
        return self._store.get(metadata_id, {}).copy()

    async def update_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Update metadata in memory."""
        if metadata_id in self._store:
            self._store[metadata_id] = metadata.copy()
            return True
        return False

    async def delete_metadata(self, metadata_id: str) -> bool:
        """Delete metadata from memory."""
        if metadata_id in self._store:
            del self._store[metadata_id]
            return True
        return False

    async def search_metadata(
        self,
        filters: Dict[str, Any],
        date_filters: Dict[str, datetime],
        quality_filters: Dict[str, float],
        limit: int,
        offset: int,
        sort_by: str,
        sort_order: str,
    ) -> List[Dict[str, Any]]:
        """Search metadata in memory."""
        results = []

        for metadata in self._store.values():
            # Apply filters
            if self._matches_filters(metadata, filters, date_filters, quality_filters):
                results.append(metadata.copy())

        # Sort results
        reverse = sort_order.lower() == "desc"
        results.sort(key=lambda x: x.get(sort_by, ""), reverse=reverse)

        # Apply pagination
        return results[offset : offset + limit]

    def _matches_filters(
        self,
        metadata: Dict[str, Any],
        filters: Dict[str, Any],
        date_filters: Dict[str, datetime],
        quality_filters: Dict[str, float],
    ) -> bool:
        """Check if metadata matches all filters."""
        # Regular filters
        for key, value in filters.items():
            if metadata.get(key) != value:
                return False

        # Date filters
        created_at = metadata.get("created_at")
        if created_at and isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)

            if (
                "created_after" in date_filters
                and created_at < date_filters["created_after"]
            ):
                return False
            if (
                "created_before" in date_filters
                and created_at > date_filters["created_before"]
            ):
                return False

        # Quality filters
        quality_score = metadata.get("quality_score")
        if quality_score is not None:
            if (
                "min_quality" in quality_filters
                and quality_score < quality_filters["min_quality"]
            ):
                return False
            if (
                "max_quality" in quality_filters
                and quality_score > quality_filters["max_quality"]
            ):
                return False

        return True


class RedisMetadataStore(MetadataStorageBackend):
    """Redis-based metadata store."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/2",
        key_prefix: str = "metadata",
        ttl_seconds: int = 86400 * 30,  # 30 days
    ):
        """
        Initialize Redis metadata store.

        Args:
            redis_url: Redis connection URL
            key_prefix: Key prefix for metadata
            ttl_seconds: TTL for metadata records
        """
        if not REDIS_AVAILABLE:
            raise RuntimeError("Redis is not available")

        self.redis_url = redis_url
        self.key_prefix = key_prefix
        self.ttl_seconds = ttl_seconds
        self._redis: Optional[redis.Redis] = None

    async def _get_redis(self) -> redis.Redis:
        """Get Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url)
        return self._redis

    async def store_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Store metadata in Redis."""
        try:
            redis_client = await self._get_redis()
            key = f"{self.key_prefix}:{metadata_id}"

            # Store as JSON
            await redis_client.setex(
                key, self.ttl_seconds, json.dumps(metadata, default=str)
            )

            # Add to search indexes
            await self._update_search_indexes(metadata_id, metadata)

            return True

        except Exception:
            return False

    async def get_metadata(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata from Redis."""
        try:
            redis_client = await self._get_redis()
            key = f"{self.key_prefix}:{metadata_id}"

            data = await redis_client.get(key)
            if data:
                return json.loads(data)

            return None

        except Exception:
            return None

    async def update_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Update metadata in Redis."""
        return await self.store_metadata(metadata_id, metadata)

    async def delete_metadata(self, metadata_id: str) -> bool:
        """Delete metadata from Redis."""
        try:
            redis_client = await self._get_redis()
            key = f"{self.key_prefix}:{metadata_id}"

            result = await redis_client.delete(key)

            # Remove from search indexes
            await self._remove_from_search_indexes(metadata_id)

            return result > 0

        except Exception:
            return False

    async def search_metadata(
        self,
        filters: Dict[str, Any],
        date_filters: Dict[str, datetime],
        quality_filters: Dict[str, float],
        limit: int,
        offset: int,
        sort_by: str,
        sort_order: str,
    ) -> List[Dict[str, Any]]:
        """Search metadata in Redis."""
        # This is a simplified implementation
        # In practice, you'd use Redis search or secondary indexes
        try:
            redis_client = await self._get_redis()

            # Get all metadata keys
            pattern = f"{self.key_prefix}:*"
            keys = await redis_client.keys(pattern)

            results = []

            for key in keys:
                data = await redis_client.get(key)
                if data:
                    metadata = json.loads(data)

                    if self._matches_filters(
                        metadata, filters, date_filters, quality_filters
                    ):
                        results.append(metadata)

            # Sort and paginate
            reverse = sort_order.lower() == "desc"
            results.sort(key=lambda x: x.get(sort_by, ""), reverse=reverse)

            return results[offset : offset + limit]

        except Exception:
            return []

    def _matches_filters(
        self,
        metadata: Dict[str, Any],
        filters: Dict[str, Any],
        date_filters: Dict[str, datetime],
        quality_filters: Dict[str, float],
    ) -> bool:
        """Check if metadata matches filters."""
        # Same implementation as in InMemoryMetadataStore
        for key, value in filters.items():
            if metadata.get(key) != value:
                return False

        created_at = metadata.get("created_at")
        if created_at and isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)

            if (
                "created_after" in date_filters
                and created_at < date_filters["created_after"]
            ):
                return False
            if (
                "created_before" in date_filters
                and created_at > date_filters["created_before"]
            ):
                return False

        quality_score = metadata.get("quality_score")
        if quality_score is not None:
            if (
                "min_quality" in quality_filters
                and quality_score < quality_filters["min_quality"]
            ):
                return False
            if (
                "max_quality" in quality_filters
                and quality_score > quality_filters["max_quality"]
            ):
                return False

        return True

    async def _update_search_indexes(
        self, metadata_id: str, metadata: Dict[str, Any]
    ) -> None:
        """Update search indexes for metadata."""
        # This would implement Redis search indexes
        # For now, it's a placeholder
        pass

    async def _remove_from_search_indexes(self, metadata_id: str) -> None:
        """Remove metadata from search indexes."""
        # This would implement Redis search index cleanup
        # For now, it's a placeholder
        pass


class MetadataStore:
    """High-level metadata store with backend abstraction."""

    def __init__(
        self,
        backend: Optional[MetadataStorageBackend] = None,
        backend_type: str = "memory",
        **backend_kwargs,
    ):
        """
        Initialize metadata store.

        Args:
            backend: Custom storage backend
            backend_type: Backend type (memory, redis)
            **backend_kwargs: Backend-specific arguments
        """
        if backend:
            self.backend = backend
        elif backend_type == "memory":
            self.backend = InMemoryMetadataStore()
        elif backend_type == "redis":
            self.backend = RedisMetadataStore(**backend_kwargs)
        else:
            raise ValueError(f"Unsupported backend type: {backend_type}")

    async def store_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Store metadata."""
        return await self.backend.store_metadata(metadata_id, metadata)

    async def get_metadata(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata by ID."""
        return await self.backend.get_metadata(metadata_id)

    async def update_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> bool:
        """Update metadata."""
        return await self.backend.update_metadata(metadata_id, metadata)

    async def delete_metadata(self, metadata_id: str) -> bool:
        """Delete metadata."""
        return await self.backend.delete_metadata(metadata_id)

    async def search_metadata(
        self,
        filters: Dict[str, Any] = None,
        date_filters: Dict[str, datetime] = None,
        quality_filters: Dict[str, float] = None,
        limit: int = 100,
        offset: int = 0,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> List[Dict[str, Any]]:
        """Search metadata."""
        return await self.backend.search_metadata(
            filters or {},
            date_filters or {},
            quality_filters or {},
            limit,
            offset,
            sort_by,
            sort_order,
        )

    async def get_statistics(
        self,
        tenant_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get metadata statistics."""
        # Search for relevant metadata
        filters = {}
        if tenant_id:
            filters["tenant_id"] = tenant_id

        date_filters = {}
        if start_date:
            date_filters["created_after"] = start_date
        if end_date:
            date_filters["created_before"] = end_date

        metadata_list = await self.search_metadata(
            filters=filters,
            date_filters=date_filters,
            limit=10000,  # Large limit for statistics
        )

        if not metadata_list:
            return {
                "total_count": 0,
                "total_tokens": 0,
                "total_characters": 0,
                "total_processing_time_ms": 0,
                "average_processing_time_ms": 0.0,
                "average_quality_score": 0.0,
                "cache_hit_rate": 0.0,
                "total_cost_usd": 0.0,
            }

        # Calculate statistics
        total_count = len(metadata_list)
        total_tokens = sum(m.get("token_count", 0) for m in metadata_list)
        total_characters = sum(m.get("character_count", 0) for m in metadata_list)
        total_processing_time = sum(
            m.get("processing_time_ms", 0) for m in metadata_list
        )

        cache_hits = sum(1 for m in metadata_list if m.get("cache_hit", False))
        cache_hit_rate = cache_hits / total_count if total_count > 0 else 0.0

        quality_scores = [
            m.get("quality_score")
            for m in metadata_list
            if m.get("quality_score") is not None
        ]
        average_quality_score = (
            sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
        )

        total_cost = sum(
            m.get("cost_usd", 0) for m in metadata_list if m.get("cost_usd") is not None
        )

        return {
            "total_count": total_count,
            "total_tokens": total_tokens,
            "total_characters": total_characters,
            "total_processing_time_ms": total_processing_time,
            "average_processing_time_ms": total_processing_time / total_count
            if total_count > 0
            else 0.0,
            "average_quality_score": average_quality_score,
            "cache_hit_rate": cache_hit_rate,
            "total_cost_usd": total_cost,
            "period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
        }

    async def get_provider_statistics(
        self,
        tenant_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """Get statistics by provider."""
        filters = {}
        if tenant_id:
            filters["tenant_id"] = tenant_id

        date_filters = {}
        if start_date:
            date_filters["created_after"] = start_date
        if end_date:
            date_filters["created_before"] = end_date

        metadata_list = await self.search_metadata(
            filters=filters,
            date_filters=date_filters,
            limit=10000,
        )

        provider_stats = {}

        for metadata in metadata_list:
            provider = metadata.get("provider", "unknown")

            if provider not in provider_stats:
                provider_stats[provider] = {
                    "count": 0,
                    "total_tokens": 0,
                    "total_processing_time_ms": 0,
                    "cache_hits": 0,
                    "total_cost_usd": 0.0,
                    "models": set(),
                }

            stats = provider_stats[provider]
            stats["count"] += 1
            stats["total_tokens"] += metadata.get("token_count", 0)
            stats["total_processing_time_ms"] += metadata.get("processing_time_ms", 0)

            if metadata.get("cache_hit", False):
                stats["cache_hits"] += 1

            if metadata.get("cost_usd") is not None:
                stats["total_cost_usd"] += metadata["cost_usd"]

            stats["models"].add(metadata.get("model", "unknown"))

        # Convert sets to lists and calculate derived metrics
        for provider, stats in provider_stats.items():
            stats["models"] = list(stats["models"])
            stats["cache_hit_rate"] = (
                stats["cache_hits"] / stats["count"] if stats["count"] > 0 else 0.0
            )
            stats["average_processing_time_ms"] = (
                stats["total_processing_time_ms"] / stats["count"]
                if stats["count"] > 0
                else 0.0
            )
            stats["average_tokens_per_request"] = (
                stats["total_tokens"] / stats["count"] if stats["count"] > 0 else 0.0
            )

        return provider_stats

    async def get_model_statistics(
        self,
        tenant_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """Get statistics by model."""
        filters = {}
        if tenant_id:
            filters["tenant_id"] = tenant_id

        date_filters = {}
        if start_date:
            date_filters["created_after"] = start_date
        if end_date:
            date_filters["created_before"] = end_date

        metadata_list = await self.search_metadata(
            filters=filters,
            date_filters=date_filters,
            limit=10000,
        )

        model_stats = {}

        for metadata in metadata_list:
            provider = metadata.get("provider", "unknown")
            model = metadata.get("model", "unknown")
            key = f"{provider}:{model}"

            if key not in model_stats:
                model_stats[key] = {
                    "provider": provider,
                    "model": model,
                    "count": 0,
                    "total_tokens": 0,
                    "total_processing_time_ms": 0,
                    "cache_hits": 0,
                    "total_cost_usd": 0.0,
                    "quality_scores": [],
                }

            stats = model_stats[key]
            stats["count"] += 1
            stats["total_tokens"] += metadata.get("token_count", 0)
            stats["total_processing_time_ms"] += metadata.get("processing_time_ms", 0)

            if metadata.get("cache_hit", False):
                stats["cache_hits"] += 1

            if metadata.get("cost_usd") is not None:
                stats["total_cost_usd"] += metadata["cost_usd"]

            if metadata.get("quality_score") is not None:
                stats["quality_scores"].append(metadata["quality_score"])

        # Calculate derived metrics
        for key, stats in model_stats.items():
            stats["cache_hit_rate"] = (
                stats["cache_hits"] / stats["count"] if stats["count"] > 0 else 0.0
            )
            stats["average_processing_time_ms"] = (
                stats["total_processing_time_ms"] / stats["count"]
                if stats["count"] > 0
                else 0.0
            )
            stats["average_tokens_per_request"] = (
                stats["total_tokens"] / stats["count"] if stats["count"] > 0 else 0.0
            )

            if stats["quality_scores"]:
                stats["average_quality_score"] = sum(stats["quality_scores"]) / len(
                    stats["quality_scores"]
                )
                stats["min_quality_score"] = min(stats["quality_scores"])
                stats["max_quality_score"] = max(stats["quality_scores"])
            else:
                stats["average_quality_score"] = 0.0
                stats["min_quality_score"] = 0.0
                stats["max_quality_score"] = 0.0

            # Remove raw scores list
            del stats["quality_scores"]

        return model_stats

    async def delete_old_metadata(self, cutoff_date: datetime) -> int:
        """Delete metadata older than cutoff date."""
        # This is a simplified implementation
        # In practice, you'd use database-specific bulk deletion
        date_filters = {"created_before": cutoff_date}

        old_metadata = await self.search_metadata(
            date_filters=date_filters,
            limit=10000,
        )

        deleted_count = 0
        for metadata in old_metadata:
            metadata_id = metadata.get("metadata_id")
            if metadata_id and await self.delete_metadata(metadata_id):
                deleted_count += 1

        return deleted_count
