"""
Smart Caching Service
Provides distributed caching capabilities with Redis backend for improved performance
"""

import json
import logging
import pickle
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib

import redis.asyncio as redis
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheStrategy(str, Enum):
    """Cache strategy types"""
    WRITE_THROUGH = "write_through"      # Write to cache and DB simultaneously
    WRITE_BEHIND = "write_behind"        # Write to cache first, DB later
    CACHE_ASIDE = "cache_aside"          # Manual cache management
    READ_THROUGH = "read_through"        # Cache loads from DB on miss


class CacheLevel(str, Enum):
    """Cache level priorities"""
    L1_MEMORY = "l1_memory"              # In-memory cache (fastest)
    L2_REDIS = "l2_redis"                # Redis cache (fast)
    L3_DATABASE = "l3_database"          # Database cache (persistent)


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    key: str
    value: Any
    ttl: int
    created_at: datetime
    last_accessed: datetime
    access_count: int = 0
    tags: List[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.metadata is None:
            self.metadata = {}


class CacheMetrics(BaseModel):
    """Cache performance metrics"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    evictions: int = 0
    total_size: int = 0
    avg_response_time: float = 0.0
    hit_ratio: float = 0.0
    memory_usage: int = 0


class SmartCacheService:
    """
    Smart caching service with multi-level caching, intelligent eviction,
    and performance optimization
    """

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.l1_cache: Dict[str, CacheEntry] = {}  # In-memory cache
        self.metrics = CacheMetrics()
        self.max_l1_size = 1000  # Max L1 cache entries
        self.default_ttl = 3600  # 1 hour default TTL

        # Performance tracking
        self.operation_times: List[float] = []
        self.initialized = False

    async def initialize(self):
        """Initialize Redis connection and cache service"""
        try:
            # Initialize Redis client
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379')
            self.redis_client = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=False  # Handle binary data
            )

            # Test connection
            await self.redis_client.ping()
            logger.info("Redis cache service initialized successfully")

            # Initialize metrics
            await self._initialize_metrics()
            self.initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize cache service: {e}")
            # Fall back to memory-only cache
            self.redis_client = None
            self.initialized = True

    async def _initialize_metrics(self):
        """Initialize cache metrics"""
        try:
            if self.redis_client:
                # Get Redis info for initial metrics
                info = await self.redis_client.info('memory')
                self.metrics.memory_usage = info.get('used_memory', 0)
        except Exception as e:
            logger.warning(f"Failed to initialize cache metrics: {e}")

    def _generate_key(self, namespace: str, key: str, **params) -> str:
        """Generate cache key with namespace and parameters"""
        if params:
            # Create deterministic key from parameters
            param_str = json.dumps(params, sort_keys=True)
            param_hash = hashlib.md5(param_str.encode()).hexdigest()[:8]
            return f"{namespace}:{key}:{param_hash}"
        return f"{namespace}:{key}"

    async def get(
        self,
        key: str,
        namespace: str = "default",
        **params
    ) -> Optional[Any]:
        """Get value from cache with multi-level lookup"""
        start_time = datetime.now()
        cache_key = self._generate_key(namespace, key, **params)

        try:
            # L1 Cache (Memory) - Fastest
            if cache_key in self.l1_cache:
                entry = self.l1_cache[cache_key]
                if self._is_valid(entry):
                    entry.last_accessed = datetime.now()
                    entry.access_count += 1
                    self.metrics.hits += 1
                    self._record_operation_time(start_time)
                    return entry.value
                else:
                    # Expired entry
                    del self.l1_cache[cache_key]

            # L2 Cache (Redis) - Fast
            if self.redis_client:
                try:
                    data = await self.redis_client.get(cache_key)
                    if data:
                        value = pickle.loads(data)
                        # Promote to L1 cache
                        await self._set_l1(cache_key, value, self.default_ttl)
                        self.metrics.hits += 1
                        self._record_operation_time(start_time)
                        return value
                except Exception as e:
                    logger.warning(f"Redis get failed for {cache_key}: {e}")

            # Cache miss
            self.metrics.misses += 1
            self._record_operation_time(start_time)
            return None

        except Exception as e:
            logger.error(f"Cache get error for {cache_key}: {e}")
            self.metrics.misses += 1
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = None,
        namespace: str = "default",
        tags: List[str] = None,
        strategy: CacheStrategy = CacheStrategy.WRITE_THROUGH,
        **params
    ) -> bool:
        """Set value in cache with specified strategy"""
        start_time = datetime.now()
        cache_key = self._generate_key(namespace, key, **params)
        ttl = ttl or self.default_ttl

        try:
            success = True

            # Set in L1 cache (memory)
            await self._set_l1(cache_key, value, ttl, tags)

            # Set in L2 cache (Redis) based on strategy
            if self.redis_client and strategy in [
                CacheStrategy.WRITE_THROUGH,
                CacheStrategy.WRITE_BEHIND
            ]:
                try:
                    serialized_value = pickle.dumps(value)
                    await self.redis_client.setex(cache_key, ttl, serialized_value)

                    # Set tags for cache invalidation
                    if tags:
                        for tag in tags:
                            tag_key = f"tag:{tag}"
                            await self.redis_client.sadd(tag_key, cache_key)
                            await self.redis_client.expire(tag_key, ttl + 3600)  # Tags live longer

                except Exception as e:
                    logger.warning(f"Redis set failed for {cache_key}: {e}")
                    success = False

            self.metrics.sets += 1
            self._record_operation_time(start_time)
            return success

        except Exception as e:
            logger.error(f"Cache set error for {cache_key}: {e}")
            return False

    async def _set_l1(
        self,
        cache_key: str,
        value: Any,
        ttl: int,
        tags: List[str] = None
    ):
        """Set value in L1 (memory) cache"""
        # Evict if cache is full
        if len(self.l1_cache) >= self.max_l1_size:
            await self._evict_l1()

        entry = CacheEntry(
            key=cache_key,
            value=value,
            ttl=ttl,
            created_at=datetime.now(),
            last_accessed=datetime.now(),
            tags=tags or []
        )

        self.l1_cache[cache_key] = entry

    async def _evict_l1(self):
        """Evict least recently used entries from L1 cache"""
        if not self.l1_cache:
            return

        # Sort by last accessed time (LRU)
        sorted_entries = sorted(
            self.l1_cache.items(),
            key=lambda x: x[1].last_accessed
        )

        # Remove oldest 25% of entries
        evict_count = max(1, len(sorted_entries) // 4)
        for i in range(evict_count):
            key_to_evict = sorted_entries[i][0]
            del self.l1_cache[key_to_evict]
            self.metrics.evictions += 1

    def _is_valid(self, entry: CacheEntry) -> bool:
        """Check if cache entry is still valid"""
        age = datetime.now() - entry.created_at
        return age.total_seconds() < entry.ttl

    async def delete(
        self,
        key: str,
        namespace: str = "default",
        **params
    ) -> bool:
        """Delete value from cache"""
        cache_key = self._generate_key(namespace, key, **params)

        try:
            # Delete from L1
            if cache_key in self.l1_cache:
                del self.l1_cache[cache_key]

            # Delete from L2 (Redis)
            if self.redis_client:
                try:
                    await self.redis_client.delete(cache_key)
                except Exception as e:
                    logger.warning(f"Redis delete failed for {cache_key}: {e}")

            self.metrics.deletes += 1
            return True

        except Exception as e:
            logger.error(f"Cache delete error for {cache_key}: {e}")
            return False

    async def invalidate_by_tags(self, tags: List[str]) -> int:
        """Invalidate all cache entries with specified tags"""
        invalidated_count = 0

        try:
            # Invalidate from L1 cache
            keys_to_delete = []
            for cache_key, entry in self.l1_cache.items():
                if any(tag in entry.tags for tag in tags):
                    keys_to_delete.append(cache_key)

            for key in keys_to_delete:
                del self.l1_cache[key]
                invalidated_count += 1

            # Invalidate from L2 cache (Redis)
            if self.redis_client:
                for tag in tags:
                    try:
                        tag_key = f"tag:{tag}"
                        cache_keys = await self.redis_client.smembers(tag_key)
                        if cache_keys:
                            # Delete all keys with this tag
                            await self.redis_client.delete(*cache_keys)
                            invalidated_count += len(cache_keys)
                            # Delete the tag set
                            await self.redis_client.delete(tag_key)
                    except Exception as e:
                        logger.warning(f"Redis tag invalidation failed for {tag}: {e}")

            logger.info(f"Invalidated {invalidated_count} cache entries for tags: {tags}")
            return invalidated_count

        except Exception as e:
            logger.error(f"Cache invalidation error for tags {tags}: {e}")
            return 0

    async def clear_namespace(self, namespace: str) -> int:
        """Clear all cache entries in a namespace"""
        cleared_count = 0

        try:
            # Clear from L1 cache
            keys_to_delete = [k for k in self.l1_cache.keys() if k.startswith(f"{namespace}:")]
            for key in keys_to_delete:
                del self.l1_cache[key]
                cleared_count += 1

            # Clear from L2 cache (Redis)
            if self.redis_client:
                try:
                    pattern = f"{namespace}:*"
                    keys = []
                    async for key in self.redis_client.scan_iter(match=pattern):
                        keys.append(key)

                    if keys:
                        await self.redis_client.delete(*keys)
                        cleared_count += len(keys)

                except Exception as e:
                    logger.warning(f"Redis namespace clear failed for {namespace}: {e}")

            logger.info(f"Cleared {cleared_count} cache entries for namespace: {namespace}")
            return cleared_count

        except Exception as e:
            logger.error(f"Cache clear error for namespace {namespace}: {e}")
            return 0

    def _record_operation_time(self, start_time: datetime):
        """Record operation time for performance metrics"""
        operation_time = (datetime.now() - start_time).total_seconds() * 1000  # ms
        self.operation_times.append(operation_time)

        # Keep only last 1000 operations for average calculation
        if len(self.operation_times) > 1000:
            self.operation_times = self.operation_times[-1000:]

        # Update average response time
        if self.operation_times:
            self.metrics.avg_response_time = sum(self.operation_times) / len(self.operation_times)

    async def get_metrics(self) -> Dict[str, Any]:
        """Get cache performance metrics"""
        try:
            # Update hit ratio
            total_operations = self.metrics.hits + self.metrics.misses
            if total_operations > 0:
                self.metrics.hit_ratio = (self.metrics.hits / total_operations) * 100

            # Update memory usage from Redis
            if self.redis_client:
                try:
                    info = await self.redis_client.info('memory')
                    self.metrics.memory_usage = info.get('used_memory', 0)
                except Exception:
                    pass

            return {
                "hits": self.metrics.hits,
                "misses": self.metrics.misses,
                "sets": self.metrics.sets,
                "deletes": self.metrics.deletes,
                "evictions": self.metrics.evictions,
                "hit_ratio_percent": round(self.metrics.hit_ratio, 2),
                "avg_response_time_ms": round(self.metrics.avg_response_time, 2),
                "l1_cache_size": len(self.l1_cache),
                "memory_usage_bytes": self.metrics.memory_usage,
                "redis_connected": self.redis_client is not None,
                "initialized": self.initialized
            }

        except Exception as e:
            logger.error(f"Error getting cache metrics: {e}")
            return {"error": str(e)}

    async def health_check(self) -> Dict[str, Any]:
        """Perform cache service health check"""
        try:
            status = "healthy"
            checks = {}

            # Check L1 cache
            checks["l1_cache"] = {
                "status": "healthy",
                "size": len(self.l1_cache),
                "max_size": self.max_l1_size
            }

            # Check Redis connection
            if self.redis_client:
                try:
                    await self.redis_client.ping()
                    checks["redis"] = {"status": "healthy", "connected": True}
                except Exception as e:
                    checks["redis"] = {"status": "unhealthy", "error": str(e)}
                    status = "degraded"
            else:
                checks["redis"] = {"status": "unavailable", "connected": False}
                status = "degraded"

            return {
                "service_name": "cache_service",
                "status": status,
                "timestamp": datetime.now().isoformat(),
                "checks": checks,
                "metrics": await self.get_metrics()
            }

        except Exception as e:
            logger.error(f"Cache health check failed: {e}")
            return {
                "service_name": "cache_service",
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def cleanup(self):
        """Cleanup resources"""
        try:
            if self.redis_client:
                await self.redis_client.close()
            self.l1_cache.clear()
            logger.info("Cache service cleanup completed")
        except Exception as e:
            logger.error(f"Cache cleanup error: {e}")


# Global cache service instance
cache_service = SmartCacheService()