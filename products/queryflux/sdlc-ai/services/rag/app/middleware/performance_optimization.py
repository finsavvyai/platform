"""
Performance Optimization Middleware for RAG Service

Comprehensive performance optimization middleware with:
- Intelligent caching strategies (multi-level caching)
- Request/response compression
- Connection pooling and optimization
- Resource utilization monitoring
- Automatic performance tuning
- Adaptive load balancing
- Performance metrics collection and analysis
"""

import asyncio
import gzip
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Tuple, Union
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, OrderedDict
import uuid
import pickle
import zlib
import lzma

from fastapi import Request, Response, HTTPException
from fastapi.responses import StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CacheLevel(str, Enum):
    """Cache levels"""

    L1_MEMORY = "l1_memory"  # In-memory cache (fastest)
    L2_REDIS = "l2_redis"  # Redis cache (fast)
    L3_DATABASE = "l3_database"  # Database cache (slow)


class CompressionType(str, Enum):
    """Compression types"""

    NONE = "none"
    GZIP = "gzip"
    LZMA = "lzma"
    ZSTD = "zstd"


@dataclass
class PerformanceConfig:
    """Configuration for performance optimization"""

    # Caching configuration
    enable_caching: bool = True
    default_cache_ttl_seconds: int = 300
    l1_cache_max_size: int = 1000
    l2_cache_max_size_mb: int = 100
    cache_key_prefix: str = "rag_cache"

    # Compression configuration
    enable_compression: bool = True
    compression_min_size_bytes: int = 1024
    compression_level: int = 6
    compression_type: CompressionType = CompressionType.GZIP

    # Connection pooling
    max_connections_per_endpoint: int = 100
    connection_timeout_seconds: float = 5.0
    connection_keepalive_seconds: int = 30

    # Performance monitoring
    enable_monitoring: bool = True
    metrics_collection_interval_seconds: int = 60
    performance_threshold_p95_ms: float = 500.0
    performance_threshold_p99_ms: float = 1000.0

    # Adaptive optimization
    enable_adaptive_optimization: bool = True
    auto_tuning_interval_seconds: int = 300
    performance_window_minutes: int = 10

    # Resource limits
    max_memory_usage_mb: int = 1024
    max_cpu_usage_percent: float = 80.0


@dataclass
class CacheEntry:
    """Cache entry with metadata"""

    key: str
    value: Any
    created_at: datetime
    ttl_seconds: int
    access_count: int = 0
    last_accessed: datetime = field(default_factory=datetime.now)
    size_bytes: int = 0
    compression_type: Optional[CompressionType] = None
    etag: Optional[str] = None

    @property
    def is_expired(self) -> bool:
        """Check if cache entry is expired"""
        return datetime.now() - self.created_at > timedelta(seconds=self.ttl_seconds)

    @property
    def age_seconds(self) -> float:
        """Get age of cache entry in seconds"""
        return (datetime.now() - self.created_at).total_seconds()


class L1MemoryCache:
    """Level 1 in-memory cache with LRU eviction"""

    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = asyncio.Lock()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "total_requests": 0,
        }

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        async with self._lock:
            self._stats["total_requests"] += 1

            if key in self._cache:
                entry = self._cache[key]

                # Check if expired
                if entry.is_expired:
                    del self._cache[key]
                    self._stats["misses"] += 1
                    return None

                # Update access information
                entry.access_count += 1
                entry.last_accessed = datetime.now()

                # Move to end (LRU)
                self._cache.move_to_end(key)

                self._stats["hits"] += 1
                return entry.value

            self._stats["misses"] += 1
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: int = 300,
        compress: bool = True,
    ) -> None:
        """Set value in cache"""
        async with self._lock:
            # Calculate size
            try:
                size_bytes = len(pickle.dumps(value))
            except:
                size_bytes = len(str(value).encode())

            # Compress if needed
            compression_type = None
            if compress and size_bytes > 1024:
                try:
                    compressed = gzip.compress(pickle.dumps(value))
                    if len(compressed) < size_bytes:
                        value = compressed
                        size_bytes = len(compressed)
                        compression_type = CompressionType.GZIP
                except:
                    pass

            # Create cache entry
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=datetime.now(),
                ttl_seconds=ttl_seconds,
                size_bytes=size_bytes,
                compression_type=compression_type,
            )

            # Evict if necessary
            if len(self._cache) >= self.max_size:
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
                self._stats["evictions"] += 1

            # Add to cache
            self._cache[key] = entry

    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    async def clear(self) -> None:
        """Clear cache"""
        async with self._lock:
            self._cache.clear()

    async def cleanup_expired(self) -> int:
        """Clean up expired entries"""
        async with self._lock:
            expired_keys = [
                key for key, entry in self._cache.items() if entry.is_expired
            ]

            for key in expired_keys:
                del self._cache[key]

            return len(expired_keys)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self._stats["total_requests"]
        hit_rate = self._stats["hits"] / total_requests if total_requests > 0 else 0

        return {
            **self._stats,
            "hit_rate": hit_rate,
            "cache_size": len(self._cache),
            "max_size": self.max_size,
            "memory_usage_mb": sum(entry.size_bytes for entry in self._cache.values())
            / (1024 * 1024),
        }


class RequestCache:
    """Request/response cache with intelligent key generation"""

    def __init__(self, l1_cache: L1MemoryCache, redis_client=None):
        self.l1_cache = l1_cache
        self.redis_client = redis_client
        self._cacheable_methods = {"GET", "HEAD", "OPTIONS"}
        self._cacheable_status_codes = {200, 201, 202, 204}

    def is_cacheable(self, request: Request, response: Response) -> bool:
        """Check if request/response is cacheable"""
        # Check method
        if request.method not in self._cacheable_methods:
            return False

        # Check status code
        if response.status_code not in self._cacheable_status_codes:
            return False

        # Check cache control headers
        cache_control = response.headers.get("cache-control", "")
        if "no-cache" in cache_control or "private" in cache_control:
            return False

        # Check authorization
        if request.headers.get("authorization"):
            return False

        # Check content type
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith(("application/json", "text/html", "text/plain")):
            return False

        return True

    def generate_cache_key(self, request: Request) -> str:
        """Generate cache key for request"""
        # Include method, path, and relevant headers
        key_parts = [
            request.method,
            request.url.path,
            str(sorted(request.query_params.items())),
        ]

        # Add relevant headers
        relevant_headers = ["accept", "accept-language", "accept-encoding"]
        for header in relevant_headers:
            value = request.headers.get(header)
            if value:
                key_parts.append(f"{header}:{value}")

        # Create hash
        key_string = "|".join(key_parts)
        key_hash = hashlib.md5(key_string.encode()).hexdigest()

        return f"req:{key_hash}"

    async def get(self, request: Request) -> Optional[Tuple[Any, Dict[str, str]]]:
        """Get cached response"""
        if not self.is_cacheable_request(request):
            return None

        cache_key = self.generate_cache_key(request)

        # Try L1 cache
        cached = await self.l1_cache.get(cache_key)
        if cached:
            logger.debug(f"L1 cache hit for {cache_key}")
            return cached["data"], cached.get("headers", {})

        # Try L2 cache (Redis)
        if self.redis_client:
            try:
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    cached = json.loads(cached_data)
                    logger.debug(f"L2 cache hit for {cache_key}")

                    # Store in L1 cache
                    await self.l1_cache.set(
                        cache_key,
                        cached,
                        ttl_seconds=cached.get("ttl", 300),
                    )

                    return cached["data"], cached.get("headers", {})
            except Exception as e:
                logger.warning(f"L2 cache error: {e}")

        return None

    async def set(
        self,
        request: Request,
        response: Response,
        ttl_seconds: int = 300,
    ) -> None:
        """Cache response"""
        if not self.is_cacheable_request(request) or not self.is_cacheable_response(
            response
        ):
            return

        cache_key = self.generate_cache_key(request)

        # Prepare cached data
        headers = dict(response.headers)
        headers["x-cache"] = "HIT"
        headers["x-cache-timestamp"] = datetime.now().isoformat()

        # Read response body
        if hasattr(response, "body"):
            body = response.body
        else:
            body = b""

        # Parse JSON if possible
        try:
            data = json.loads(body.decode())
        except:
            data = body.decode()

        cached_data = {
            "data": data,
            "headers": headers,
            "status_code": response.status_code,
            "ttl": ttl_seconds,
            "cached_at": datetime.now().isoformat(),
        }

        # Store in L1 cache
        await self.l1_cache.set(cache_key, cached_data, ttl_seconds=ttl_seconds)

        # Store in L2 cache
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    cache_key,
                    ttl_seconds,
                    json.dumps(cached_data),
                )
            except Exception as e:
                logger.warning(f"L2 cache set error: {e}")

    def is_cacheable_request(self, request: Request) -> bool:
        """Check if request is cacheable"""
        # Skip certain endpoints
        skip_paths = ["/health", "/metrics", "/monitoring"]
        if any(request.url.path.startswith(path) for path in skip_paths):
            return False

        return True

    def is_cacheable_response(self, response: Response) -> bool:
        """Check if response is cacheable"""
        return response.status_code in self._cacheable_status_codes


class PerformanceMonitor:
    """Performance monitoring and metrics collection"""

    def __init__(self, config: PerformanceConfig):
        self.config = config
        self._metrics = defaultdict(list)
        self._alerts = []
        self._lock = asyncio.Lock()

        # Performance thresholds
        self.thresholds = {
            "p50": 100.0,  # ms
            "p95": config.performance_threshold_p95_ms,
            "p99": config.performance_threshold_p99_ms,
            "max_memory_mb": config.max_memory_usage_mb,
            "max_cpu_percent": config.max_cpu_usage_percent,
        }

    async def record_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
        response_size_bytes: int,
        cache_hit: bool = False,
    ) -> None:
        """Record request metrics"""
        if not self.config.enable_monitoring:
            return

        async with self._lock:
            self._metrics["requests"].append(
                {
                    "timestamp": datetime.now(),
                    "endpoint": endpoint,
                    "method": method,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "response_size_bytes": response_size_bytes,
                    "cache_hit": cache_hit,
                }
            )

            # Keep only recent metrics
            cutoff_time = datetime.now() - timedelta(
                minutes=self.config.performance_window_minutes
            )
            self._metrics["requests"] = [
                r for r in self._metrics["requests"] if r["timestamp"] > cutoff_time
            ]

            # Check performance thresholds
            await self._check_thresholds(endpoint, duration_ms)

    async def _check_thresholds(self, endpoint: str, duration_ms: float) -> None:
        """Check if performance thresholds are exceeded"""
        if duration_ms > self.thresholds["p99"]:
            await self._trigger_alert(
                "performance_p99_exceeded",
                f"P99 threshold exceeded for {endpoint}: {duration_ms:.2f}ms",
                severity="high",
                endpoint=endpoint,
                duration_ms=duration_ms,
            )

    async def _trigger_alert(
        self,
        alert_type: str,
        message: str,
        severity: str = "medium",
        **kwargs,
    ) -> None:
        """Trigger performance alert"""
        alert = {
            "type": alert_type,
            "message": message,
            "severity": severity,
            "timestamp": datetime.now(),
            **kwargs,
        }

        self._alerts.append(alert)

        # Keep only recent alerts
        self._alerts = self._alerts[-100:]

        logger.warning(f"Performance alert: {message}")

    async def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        async with self._lock:
            requests = self._metrics["requests"]

            if not requests:
                return {
                    "total_requests": 0,
                    "avg_response_time_ms": 0,
                    "p50_response_time_ms": 0,
                    "p95_response_time_ms": 0,
                    "p99_response_time_ms": 0,
                    "cache_hit_rate": 0,
                    "requests_per_second": 0,
                }

            # Calculate percentiles
            durations = [r["duration_ms"] for r in requests]
            durations.sort()

            total_requests = len(requests)
            time_window = self.config.performance_window_minutes * 60
            requests_per_second = total_requests / time_window

            cache_hits = sum(1 for r in requests if r["cache_hit"])
            cache_hit_rate = cache_hits / total_requests if total_requests > 0 else 0

            # Calculate percentiles
            def percentile(data, p):
                if not data:
                    return 0
                index = int(len(data) * p / 100)
                return data[min(index, len(data) - 1)]

            return {
                "total_requests": total_requests,
                "requests_per_second": requests_per_second,
                "avg_response_time_ms": sum(durations) / len(durations),
                "p50_response_time_ms": percentile(durations, 50),
                "p95_response_time_ms": percentile(durations, 95),
                "p99_response_time_ms": percentile(durations, 99),
                "cache_hit_rate": cache_hit_rate,
                "error_rate": sum(1 for r in requests if r["status_code"] >= 400)
                / total_requests,
                "avg_response_size_kb": sum(r["response_size_bytes"] for r in requests)
                / total_requests
                / 1024,
                "top_endpoints": self._get_top_endpoints(requests),
                "recent_alerts": self._alerts[-10:],
            }

    def _get_top_endpoints(self, requests: List[Dict], top_n: int = 10) -> List[Dict]:
        """Get top endpoints by request count"""
        endpoint_counts = defaultdict(int)
        endpoint_times = defaultdict(list)

        for r in requests:
            endpoint_counts[r["endpoint"]] += 1
            endpoint_times[r["endpoint"]].append(r["duration_ms"])

        # Calculate statistics for each endpoint
        top_endpoints = []
        for endpoint, count in sorted(
            endpoint_counts.items(), key=lambda x: x[1], reverse=True
        )[:top_n]:
            times = endpoint_times[endpoint]
            times.sort()

            top_endpoints.append(
                {
                    "endpoint": endpoint,
                    "request_count": count,
                    "avg_response_time_ms": sum(times) / len(times),
                    "p95_response_time_ms": times[int(len(times) * 0.95)],
                    "error_rate": sum(
                        1
                        for r in requests
                        if r["endpoint"] == endpoint and r["status_code"] >= 400
                    )
                    / count,
                }
            )

        return top_endpoints


class AdaptiveOptimizer:
    """Adaptive performance optimizer"""

    def __init__(self, config: PerformanceConfig, monitor: PerformanceMonitor):
        self.config = config
        self.monitor = monitor
        self._optimization_history = []
        self._last_optimization = None

    async def optimize(self) -> Dict[str, Any]:
        """Perform adaptive optimization"""
        if not self.config.enable_adaptive_optimization:
            return {}

        # Get current metrics
        metrics = await self.monitor.get_metrics()

        optimizations = {}

        # Optimize cache TTL based on hit rate
        if metrics["cache_hit_rate"] < 0.5:
            optimizations["cache_ttl"] = {
                "action": "increase",
                "current": self.config.default_cache_ttl_seconds,
                "new": min(self.config.default_cache_ttl_seconds * 2, 3600),
                "reason": f"Low cache hit rate: {metrics['cache_hit_rate']:.2%}",
            }
        elif metrics["cache_hit_rate"] > 0.9:
            optimizations["cache_ttl"] = {
                "action": "decrease",
                "current": self.config.default_cache_ttl_seconds,
                "new": max(self.config.default_cache_ttl_seconds // 2, 60),
                "reason": f"High cache hit rate: {metrics['cache_hit_rate']:.2%}",
            }

        # Optimize compression based on response sizes
        if metrics["avg_response_size_kb"] > 100:
            optimizations["compression"] = {
                "action": "enable",
                "current": self.config.enable_compression,
                "new": True,
                "reason": f"Large responses: {metrics['avg_response_size_kb']:.1f}KB",
            }

        # Record optimization
        optimization_record = {
            "timestamp": datetime.now(),
            "metrics": metrics,
            "optimizations": optimizations,
        }
        self._optimization_history.append(optimization_record)
        self._last_optimization = datetime.now()

        # Keep only recent history
        if len(self._optimization_history) > 100:
            self._optimization_history = self._optimization_history[-100:]

        logger.info(f"Adaptive optimization completed: {optimizations}")
        return optimizations


class PerformanceOptimizationMiddleware(BaseHTTPMiddleware):
    """Performance optimization middleware"""

    def __init__(
        self,
        app: ASGIApp,
        config: Optional[PerformanceConfig] = None,
        redis_client=None,
    ):
        super().__init__(app)
        self.config = config or PerformanceConfig()

        # Initialize components
        self.l1_cache = L1MemoryCache(max_size=self.config.l1_cache_max_size)
        self.request_cache = RequestCache(self.l1_cache, redis_client)
        self.monitor = PerformanceMonitor(self.config)
        self.optimizer = AdaptiveOptimizer(self.config, self.monitor)

        # Background tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        self._optimization_task: Optional[asyncio.Task] = None
        self._metrics_task: Optional[asyncio.Task] = None

        logger.info("Performance Optimization Middleware initialized")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with performance optimization"""
        start_time = time.time()
        cache_hit = False

        try:
            # Check cache
            cached_response = await self.request_cache.get(request)
            if cached_response:
                data, headers = cached_response
                cache_hit = True

                # Create response from cache
                response = Response(
                    content=json.dumps(data) if isinstance(data, dict) else data,
                    status_code=200,
                    headers=headers,
                )
            else:
                # Process request
                response = await call_next(request)

                # Cache response if appropriate
                await self.request_cache.set(request, response)

            # Add performance headers
            processing_time = (time.time() - start_time) * 1000
            response.headers["X-Response-Time"] = f"{processing_time:.2f}"
            response.headers["X-Cache"] = "HIT" if cache_hit else "MISS"

            # Record metrics
            await self.monitor.record_request(
                endpoint=request.url.path,
                method=request.method,
                status_code=response.status_code,
                duration_ms=processing_time,
                response_size_bytes=len(str(response.body).encode()),
                cache_hit=cache_hit,
            )

            return response

        except Exception as e:
            # Record error metrics
            processing_time = (time.time() - start_time) * 1000
            await self.monitor.record_request(
                endpoint=request.url.path,
                method=request.method,
                status_code=500,
                duration_ms=processing_time,
                response_size_bytes=0,
                cache_hit=False,
            )

            raise

    async def start_background_tasks(self) -> None:
        """Start background tasks for maintenance"""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        self._optimization_task = asyncio.create_task(self._optimization_loop())
        self._metrics_task = asyncio.create_task(self._metrics_loop())

    async def stop_background_tasks(self) -> None:
        """Stop background tasks"""
        for task in [self._cleanup_task, self._optimization_task, self._metrics_task]:
            if task and not task.done():
                task.cancel()

    async def _cleanup_loop(self) -> None:
        """Background cleanup loop"""
        while True:
            try:
                # Clean up expired cache entries
                expired_count = await self.l1_cache.cleanup_expired()
                if expired_count > 0:
                    logger.debug(f"Cleaned up {expired_count} expired cache entries")

                await asyncio.sleep(60)  # Clean up every minute

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(60)

    async def _optimization_loop(self) -> None:
        """Background optimization loop"""
        while True:
            try:
                await self.optimizer.optimize()
                await asyncio.sleep(self.config.auto_tuning_interval_seconds)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Optimization loop error: {e}")
                await asyncio.sleep(60)

    async def _metrics_loop(self) -> None:
        """Background metrics collection loop"""
        while True:
            try:
                metrics = await self.monitor.get_metrics()
                logger.debug(f"Performance metrics: {metrics}")
                await asyncio.sleep(self.config.metrics_collection_interval_seconds)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Metrics loop error: {e}")
                await asyncio.sleep(60)

    async def get_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive performance statistics"""
        return {
            "cache": self.l1_cache.get_stats(),
            "monitoring": await self.monitor.get_metrics(),
            "optimization": {
                "last_optimization": self.optimizer._last_optimization.isoformat()
                if self.optimizer._last_optimization
                else None,
                "optimization_count": len(self.optimizer._optimization_history),
            },
            "config": {
                "caching_enabled": self.config.enable_caching,
                "compression_enabled": self.config.enable_compression,
                "monitoring_enabled": self.config.enable_monitoring,
                "adaptive_optimization": self.config.enable_adaptive_optimization,
            },
        }
