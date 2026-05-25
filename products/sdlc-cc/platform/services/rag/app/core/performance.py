"""
Performance Optimization Module

High-performance optimization features for RAG service with:
- Request caching strategies
- Connection pooling optimization
- Memory management
- Response compression
- Request batching optimization
- Performance monitoring and metrics
- Resource usage tracking
- Automatic performance tuning
"""

import asyncio
import gc
import gzip
import hashlib
import json
import logging
import psutil
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Dict, List, Optional, Callable, Tuple

import aioredis
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# Cache strategies
class CacheStrategy:
    """Base cache strategy"""

    def __init__(self, ttl_seconds: int = 3600, max_size: int = 1000):
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        raise NotImplementedError

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache"""
        raise NotImplementedError

    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        raise NotImplementedError

    async def clear(self) -> None:
        """Clear cache"""
        raise NotImplementedError

    def generate_key(self, *args, **kwargs) -> str:
        """Generate cache key from arguments"""
        key_data = json.dumps([args, kwargs], sort_keys=True, default=str)
        return hashlib.md5(key_data.encode()).hexdigest()


class MemoryCache(CacheStrategy):
    """In-memory LRU cache with TTL"""

    def __init__(self, ttl_seconds: int = 3600, max_size: int = 1000):
        super().__init__(ttl_seconds, max_size)
        self._cache: OrderedDict[str, Tuple[Any, datetime]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from memory cache"""
        async with self._lock:
            if key in self._cache:
                value, expiry = self._cache[key]
                if datetime.utcnow() < expiry:
                    # Move to end (most recently used)
                    self._cache.move_to_end(key)
                    return value
                else:
                    # Expired, remove
                    del self._cache[key]
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in memory cache"""
        async with self._lock:
            expiry = datetime.utcnow() + timedelta(seconds=ttl or self.ttl_seconds)
            self._cache[key] = (value, expiry)
            self._cache.move_to_end(key)

            # Remove oldest if at capacity
            while len(self._cache) > self.max_size:
                self._cache.popitem(last=False)

    async def delete(self, key: str) -> bool:
        """Delete value from memory cache"""
        async with self._lock:
            return self._cache.pop(key, None) is not None

    async def clear(self) -> None:
        """Clear memory cache"""
        async with self._lock:
            self._cache.clear()

    async def cleanup_expired(self) -> int:
        """Clean up expired entries"""
        now = datetime.utcnow()
        expired_keys = []

        async with self._lock:
            for key, (_, expiry) in self._cache.items():
                if expiry < now:
                    expired_keys.append(key)

            for key in expired_keys:
                del self._cache[key]

        return len(expired_keys)


class RedisCache(CacheStrategy):
    """Redis-based cache with TTL"""

    def __init__(
        self,
        redis_url: str = None,
        ttl_seconds: int = 3600,
        max_size: int = 10000,
        key_prefix: str = "rag_cache:",
    ):
        super().__init__(ttl_seconds, max_size)
        self.redis_url = redis_url or settings.redis_url
        self.key_prefix = key_prefix
        self._redis: Optional[aioredis.Redis] = None
        self._initialized = False

    async def _ensure_initialized(self) -> None:
        """Ensure Redis connection is initialized"""
        if not self._initialized:
            self._redis = aioredis.from_url(self.redis_url)
            self._initialized = True

    def _make_key(self, key: str) -> str:
        """Make full Redis key"""
        return f"{self.key_prefix}{key}"

    async def get(self, key: str) -> Optional[Any]:
        """Get value from Redis cache"""
        await self._ensure_initialized()
        try:
            value = await self._redis.get(self._make_key(key))
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in Redis cache"""
        await self._ensure_initialized()
        try:
            serialized_value = json.dumps(value, default=str)
            await self._redis.setex(
                self._make_key(key), ttl or self.ttl_seconds, serialized_value
            )
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    async def delete(self, key: str) -> bool:
        """Delete value from Redis cache"""
        await self._ensure_initialized()
        try:
            result = await self._redis.delete(self._make_key(key))
            return result > 0
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False

    async def clear(self) -> None:
        """Clear cache (delete all keys with prefix)"""
        await self._ensure_initialized()
        try:
            pattern = f"{self.key_prefix}*"
            keys = await self._redis.keys(pattern)
            if keys:
                await self._redis.delete(*keys)
        except Exception as e:
            logger.error(f"Redis clear error: {e}")

    async def close(self) -> None:
        """Close Redis connection"""
        if self._redis:
            await self._redis.close()
            self._initialized = False


@dataclass
class PerformanceMetrics:
    """Performance metrics tracking"""

    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    avg_response_time_ms: float = 0.0
    avg_cache_time_ms: float = 0.0
    memory_usage_mb: float = 0.0
    cpu_usage_percent: float = 0.0
    active_connections: int = 0
    request_rate_per_second: float = 0.0
    batch_requests_processed: int = 0
    compression_ratio: float = 0.0

    # Detailed metrics
    response_times: List[float] = field(default_factory=list)
    cache_times: List[float] = field(default_factory=list)
    endpoint_metrics: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def update_response_time(self, response_time_ms: float) -> None:
        """Update response time metrics"""
        self.response_times.append(response_time_ms)
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]
        self.avg_response_time_ms = sum(self.response_times) / len(self.response_times)

    def update_cache_time(self, cache_time_ms: float) -> None:
        """Update cache time metrics"""
        self.cache_times.append(cache_time_ms)
        if len(self.cache_times) > 1000:
            self.cache_times = self.cache_times[-1000:]
        self.avg_cache_time_ms = sum(self.cache_times) / len(self.cache_times)

    def get_cache_hit_rate(self) -> float:
        """Get cache hit rate"""
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0.0


class ConnectionPool:
    """Generic connection pool manager"""

    def __init__(
        self,
        create_connection: Callable,
        max_connections: int = 20,
        min_connections: int = 5,
        max_idle_time: int = 300,
        health_check_interval: int = 30,
    ):
        self.create_connection = create_connection
        self.max_connections = max_connections
        self.min_connections = min_connections
        self.max_idle_time = max_idle_time
        self.health_check_interval = health_check_interval

        self._pool: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self._health_check_task: Optional[asyncio.Task] = None
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize connection pool"""
        if self._initialized:
            return

        async with self._lock:
            # Create minimum connections
            for _ in range(self.min_connections):
                await self._create_connection()

            # Start health check task
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            self._initialized = True

            logger.info(
                f"Connection pool initialized with {len(self._pool)} connections"
            )

    async def _create_connection(self) -> Dict[str, Any]:
        """Create a new connection"""
        try:
            connection = await self.create_connection()
            conn_info = {
                "connection": connection,
                "created_at": time.time(),
                "last_used": time.time(),
                "in_use": False,
                "is_healthy": True,
            }
            self._pool.append(conn_info)
            return conn_info
        except Exception as e:
            logger.error(f"Failed to create connection: {e}")
            raise

    async def get_connection(self) -> Any:
        """Get a connection from the pool"""
        await self.initialize()

        async with self._lock:
            # Try to find an available connection
            for conn_info in self._pool:
                if not conn_info["in_use"] and conn_info["is_healthy"]:
                    conn_info["in_use"] = True
                    conn_info["last_used"] = time.time()
                    return conn_info["connection"]

            # Try to create new connection if under max
            if len(self._pool) < self.max_connections:
                conn_info = await self._create_connection()
                conn_info["in_use"] = True
                conn_info["last_used"] = time.time()
                return conn_info["connection"]

            # No available connections
            raise RuntimeError("Connection pool exhausted")

    async def release_connection(self, connection: Any) -> None:
        """Release a connection back to the pool"""
        async with self._lock:
            for conn_info in self._pool:
                if conn_info["connection"] is connection:
                    conn_info["in_use"] = False
                    conn_info["last_used"] = time.time()
                    return

            logger.warning("Attempted to release unknown connection")

    async def _health_check_loop(self) -> None:
        """Background health check loop"""
        while True:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(self.health_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")
                await asyncio.sleep(60)

    async def _perform_health_checks(self) -> None:
        """Perform health checks on all connections"""
        now = time.time()
        connections_to_remove = []

        async with self._lock:
            for i, conn_info in enumerate(self._pool):
                # Check if connection is idle for too long
                if (
                    not conn_info["in_use"]
                    and (now - conn_info["last_used"]) > self.max_idle_time
                ):
                    connections_to_remove.append(i)
                    continue

                # Perform health check if connection is not in use
                if not conn_info["in_use"]:
                    try:
                        # Basic health check (would be implemented per connection type)
                        conn_info["is_healthy"] = True
                    except Exception:
                        conn_info["is_healthy"] = False
                        connections_to_remove.append(i)

            # Remove unhealthy or idle connections
            for i in reversed(connections_to_remove):
                if i < len(self._pool):
                    conn_info = self._pool.pop(i)
                    try:
                        # Close connection
                        if hasattr(conn_info["connection"], "close"):
                            if asyncio.iscoroutinefunction(
                                conn_info["connection"].close
                            ):
                                await conn_info["connection"].close()
                            else:
                                conn_info["connection"].close()
                    except Exception as e:
                        logger.error(f"Error closing connection: {e}")

            # Ensure minimum connections
            while len(self._pool) < self.min_connections:
                await self._create_connection()

    async def close(self) -> None:
        """Close all connections and cleanup"""
        if self._health_check_task:
            self._health_check_task.cancel()

        async with self._lock:
            for conn_info in self._pool:
                try:
                    if hasattr(conn_info["connection"], "close"):
                        if asyncio.iscoroutinefunction(conn_info["connection"].close):
                            await conn_info["connection"].close()
                        else:
                            conn_info["connection"].close()
                except Exception as e:
                    logger.error(f"Error closing connection: {e}")

            self._pool.clear()

        self._initialized = False


class BatchProcessor:
    """Batch processing optimizer"""

    def __init__(
        self,
        batch_size: int = 100,
        max_wait_time: float = 1.0,
        max_concurrent_batches: int = 5,
    ):
        self.batch_size = batch_size
        self.max_wait_time = max_wait_time
        self.max_concurrent_batches = max_concurrent_batches

        self._pending_requests: List[Dict[str, Any]] = []
        self._batch_semaphore = asyncio.Semaphore(max_concurrent_batches)
        self._lock = asyncio.Lock()
        self._batch_task: Optional[asyncio.Task] = None

    async def add_request(
        self, func: Callable, args: tuple = (), kwargs: dict = None
    ) -> Any:
        """Add request to batch"""
        request = {
            "func": func,
            "args": args,
            "kwargs": kwargs or {},
            "future": asyncio.Future(),
            "added_at": time.time(),
        }

        async with self._lock:
            self._pending_requests.append(request)

            # Start batch processing if needed
            if self._batch_task is None or self._batch_task.done():
                self._batch_task = asyncio.create_task(self._process_batches())

        return await request["future"]

    async def _process_batches(self) -> None:
        """Process pending requests in batches"""
        while True:
            batch = await self._get_next_batch()
            if not batch:
                break

            # Process batch
            async with self._batch_semaphore:
                asyncio.create_task(self._process_batch(batch))

    async def _get_next_batch(self) -> Optional[List[Dict[str, Any]]]:
        """Get next batch of requests"""
        while True:
            async with self._lock:
                if not self._pending_requests:
                    return None

                # Check if we have enough requests or waited too long
                now = time.time()
                oldest_request = min(
                    self._pending_requests, key=lambda r: r["added_at"]
                )

                if (
                    len(self._pending_requests) >= self.batch_size
                    or (now - oldest_request["added_at"]) >= self.max_wait_time
                ):
                    # Take batch
                    batch_size = min(len(self._pending_requests), self.batch_size)
                    batch = self._pending_requests[:batch_size]
                    self._pending_requests = self._pending_requests[batch_size:]
                    return batch

            await asyncio.sleep(0.1)

    async def _process_batch(self, batch: List[Dict[str, Any]]) -> None:
        """Process a batch of requests"""
        try:
            # Group requests by function
            func_groups = {}
            for request in batch:
                func = request["func"]
                if func not in func_groups:
                    func_groups[func] = []
                func_groups[func].append(request)

            # Process each group
            for func, requests in func_groups.items():
                try:
                    # Check if function supports batch processing
                    if hasattr(func, "batch_process"):
                        # Batch processing
                        args_list = [req["args"] for req in requests]
                        kwargs_list = [req["kwargs"] for req in requests]

                        results = await func.batch_process(args_list, kwargs_list)

                        # Set results
                        for request, result in zip(requests, results):
                            if isinstance(result, Exception):
                                request["future"].set_exception(result)
                            else:
                                request["future"].set_result(result)
                    else:
                        # Individual processing
                        for request in requests:
                            try:
                                result = await func(
                                    *request["args"], **request["kwargs"]
                                )
                                request["future"].set_result(result)
                            except Exception as e:
                                request["future"].set_exception(e)

                except Exception as e:
                    # Set exception for all requests in group
                    for request in requests:
                        request["future"].set_exception(e)

        except Exception as e:
            # Set exception for all requests in batch
            for request in batch:
                request["future"].set_exception(e)


class PerformanceOptimizer:
    """Main performance optimizer coordinator"""

    def __init__(self):
        self.metrics = PerformanceMetrics()
        self.caches: Dict[str, CacheStrategy] = {}
        self.connection_pools: Dict[str, ConnectionPool] = {}
        self.batch_processors: Dict[str, BatchProcessor] = {}

        # Memory management
        self.memory_monitor_task: Optional[asyncio.Task] = None
        self.gc_task: Optional[asyncio.Task] = None

        # Configuration
        self.memory_threshold_mb = 1024  # 1GB
        self.memory_check_interval = 30  # seconds
        self.gc_interval = 300  # 5 minutes

        self._initialized = False

    async def initialize(self) -> None:
        """Initialize performance optimizer"""
        if self._initialized:
            return

        # Initialize caches
        await self._initialize_caches()

        # Start monitoring tasks
        self.memory_monitor_task = asyncio.create_task(self._memory_monitor_loop())
        self.gc_task = asyncio.create_task(self._gc_loop())

        self._initialized = True
        logger.info("Performance optimizer initialized")

    async def _initialize_caches(self) -> None:
        """Initialize default caches"""
        # Memory cache for frequently accessed data
        self.caches["memory"] = MemoryCache(
            ttl_seconds=settings.cache_ttl_seconds, max_size=settings.cache_max_size
        )

        # Redis cache for distributed caching
        try:
            self.caches["redis"] = RedisCache(
                redis_url=settings.redis_url,
                ttl_seconds=settings.cache_ttl_seconds,
                max_size=10000,
            )
        except Exception as e:
            logger.warning(f"Failed to initialize Redis cache: {e}")

    def get_cache(self, name: str = "memory") -> CacheStrategy:
        """Get cache by name"""
        return self.caches.get(name, self.caches["memory"])

    def get_batch_processor(self, name: str = "default") -> BatchProcessor:
        """Get batch processor by name"""
        if name not in self.batch_processors:
            self.batch_processors[name] = BatchProcessor(
                batch_size=settings.batch_size,
                max_wait_time=settings.batch_timeout_seconds,
                max_concurrent_batches=settings.max_concurrent_batches,
            )
        return self.batch_processors[name]

    async def _memory_monitor_loop(self) -> None:
        """Background memory monitoring"""
        while True:
            try:
                await self._check_memory_usage()
                await asyncio.sleep(self.memory_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Memory monitor error: {e}")
                await asyncio.sleep(60)

    async def _check_memory_usage(self) -> None:
        """Check and manage memory usage"""
        process = psutil.Process()
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / 1024 / 1024

        self.metrics.memory_usage_mb = memory_mb
        self.metrics.cpu_usage_percent = process.cpu_percent()

        # Trigger cleanup if memory threshold exceeded
        if memory_mb > self.memory_threshold_mb:
            logger.warning(f"High memory usage: {memory_mb:.1f}MB")
            await self._cleanup_memory()

    async def _cleanup_memory(self) -> None:
        """Clean up memory"""
        # Clean up expired cache entries
        for cache in self.caches.values():
            if isinstance(cache, MemoryCache):
                cleaned = await cache.cleanup_expired()
                if cleaned > 0:
                    logger.info(f"Cleaned {cleaned} expired cache entries")

        # Force garbage collection
        collected = gc.collect()
        logger.info(f"Garbage collection collected {collected} objects")

    async def _gc_loop(self) -> None:
        """Periodic garbage collection"""
        while True:
            try:
                await asyncio.sleep(self.gc_interval)
                collected = gc.collect()
                if collected > 0:
                    logger.debug(f"Periodic GC collected {collected} objects")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"GC loop error: {e}")

    async def get_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics"""
        # Update request rate
        if self.metrics.total_requests > 0:
            # Calculate from request times (simplified)
            recent_requests = len(self.metrics.response_times)
            if recent_requests > 0:
                time_window = (
                    max(self.metrics.response_times) / 1000
                    if self.metrics.response_times
                    else 1
                )
                self.metrics.request_rate_per_second = recent_requests / max(
                    time_window, 1
                )

        return self.metrics

    async def close(self) -> None:
        """Close all resources"""
        # Cancel background tasks
        if self.memory_monitor_task:
            self.memory_monitor_task.cancel()
        if self.gc_task:
            self.gc_task.cancel()

        # Close Redis caches
        for cache in self.caches.values():
            if isinstance(cache, RedisCache):
                await cache.close()

        # Close connection pools
        for pool in self.connection_pools.values():
            await pool.close()

        self._initialized = False


# Global performance optimizer instance
_performance_optimizer: Optional[PerformanceOptimizer] = None


async def get_performance_optimizer() -> PerformanceOptimizer:
    """Get global performance optimizer instance"""
    global _performance_optimizer
    if _performance_optimizer is None:
        _performance_optimizer = PerformanceOptimizer()
        await _performance_optimizer.initialize()
    return _performance_optimizer


async def setup_performance_monitoring() -> None:
    """Setup performance monitoring"""
    await get_performance_optimizer()
    logger.info("Performance monitoring setup complete")


# Performance middleware
class PerformanceMiddleware(BaseHTTPMiddleware):
    """Performance monitoring middleware"""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # Get performance optimizer
        optimizer = await get_performance_optimizer()

        # Update active connections
        optimizer.metrics.active_connections += 1

        try:
            # Process request
            response = await call_next(request)

            # Calculate metrics
            processing_time = (time.time() - start_time) * 1000
            optimizer.metrics.total_requests += 1
            optimizer.metrics.update_response_time(processing_time)

            # Update endpoint metrics
            endpoint = f"{request.method} {request.url.path}"
            if endpoint not in optimizer.metrics.endpoint_metrics:
                optimizer.metrics.endpoint_metrics[endpoint] = {
                    "count": 0,
                    "avg_time": 0.0,
                    "total_time": 0.0,
                }

            endpoint_metrics = optimizer.metrics.endpoint_metrics[endpoint]
            endpoint_metrics["count"] += 1
            endpoint_metrics["total_time"] += processing_time
            endpoint_metrics["avg_time"] = (
                endpoint_metrics["total_time"] / endpoint_metrics["count"]
            )

            # Add performance headers
            response.headers["X-Response-Time"] = f"{processing_time:.2f}"
            response.headers["X-Request-ID"] = getattr(
                request.state, "request_id", "unknown"
            )

            return response

        finally:
            # Update active connections
            optimizer.metrics.active_connections -= 1


# Cache decorators
def cache_result(
    cache_name: str = "memory",
    ttl_seconds: Optional[int] = None,
    key_func: Optional[Callable] = None,
):
    """Decorator to cache function results"""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            optimizer = await get_performance_optimizer()
            cache = optimizer.get_cache(cache_name)

            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = cache.generate_key(*args, **kwargs)

            # Try to get from cache
            start_time = time.time()
            cached_result = await cache.get(cache_key)
            cache_time = (time.time() - start_time) * 1000

            if cached_result is not None:
                optimizer.metrics.cache_hits += 1
                optimizer.metrics.update_cache_time(cache_time)
                logger.debug(f"Cache hit for {func.__name__} in {cache_time:.2f}ms")
                return cached_result

            # Cache miss, execute function
            optimizer.metrics.cache_misses += 1
            result = (
                await func(*args, **kwargs)
                if asyncio.iscoroutinefunction(func)
                else func(*args, **kwargs)
            )

            # Store in cache
            await cache.set(cache_key, result, ttl_seconds)

            logger.debug(f"Cache miss for {func.__name__}, stored result")
            return result

        # Add batch processing support if available
        if hasattr(func, "batch_process"):

            async def batch_process(
                args_list: List[tuple], kwargs_list: List[dict]
            ) -> List[Any]:
                """Batch process wrapper"""
                # Try to get cached results
                optimizer = await get_performance_optimizer()
                cache = optimizer.get_cache(cache_name)

                results = []
                uncached_indices = []
                uncached_args = []
                uncached_kwargs = []

                # Check cache for each request
                for i, (args, kwargs) in enumerate(zip(args_list, kwargs_list)):
                    if key_func:
                        cache_key = key_func(*args, **kwargs)
                    else:
                        cache_key = cache.generate_key(*args, **kwargs)

                    cached_result = await cache.get(cache_key)
                    if cached_result is not None:
                        results.append(cached_result)
                    else:
                        results.append(None)
                        uncached_indices.append(i)
                        uncached_args.append(args)
                        uncached_kwargs.append(kwargs)

                # Process uncached requests
                if uncached_indices:
                    uncached_results = await func.batch_process(
                        uncached_args, uncached_kwargs
                    )

                    # Store results in cache and update results list
                    for idx, result in zip(uncached_indices, uncached_results):
                        args = args_list[idx]
                        kwargs = kwargs_list[idx]

                        if key_func:
                            cache_key = key_func(*args, **kwargs)
                        else:
                            cache_key = cache.generate_key(*args, **kwargs)

                        await cache.set(cache_key, result, ttl_seconds)
                        results[idx] = result

                return results

            wrapper.batch_process = batch_process

        return wrapper

    return decorator


# Response compression
async def compress_response(response: Response, min_size: int = 1000) -> Response:
    """Compress response if beneficial"""
    if len(response.body) < min_size:
        return response

    try:
        compressed = gzip.compress(response.body)
        compression_ratio = len(compressed) / len(response.body)

        if compression_ratio < 0.9:  # Only use if we save at least 10%
            response.body = compressed
            response.headers["Content-Encoding"] = "gzip"
            response.headers["Content-Length"] = str(len(compressed))

            # Update metrics
            optimizer = await get_performance_optimizer()
            optimizer.metrics.compression_ratio = compression_ratio

            return response

    except Exception as e:
        logger.error(f"Compression error: {e}")

    return response


# Memory management utilities
async def get_memory_usage() -> Dict[str, float]:
    """Get detailed memory usage information"""
    process = psutil.Process()
    memory_info = process.memory_info()

    return {
        "rss_mb": memory_info.rss / 1024 / 1024,
        "vms_mb": memory_info.vms / 1024 / 1024,
        "percent": process.memory_percent(),
        "available_mb": psutil.virtual_memory().available / 1024 / 1024,
    }


async def optimize_memory_usage() -> None:
    """Manually trigger memory optimization"""
    optimizer = await get_performance_optimizer()
    await optimizer._cleanup_memory()


# Resource monitoring
async def get_resource_usage() -> Dict[str, Any]:
    """Get comprehensive resource usage"""
    process = psutil.Process()

    return {
        "cpu": {"percent": process.cpu_percent(), "count": process.cpu_num()},
        "memory": await get_memory_usage(),
        "connections": len(process.connections()),
        "threads": process.num_threads(),
        "fds": process.num_fds() if hasattr(process, "num_fds") else 0,
    }
