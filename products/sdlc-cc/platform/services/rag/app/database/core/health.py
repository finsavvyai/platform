"""
Database health monitoring for the RAG service.

This module provides comprehensive health checking for database connections,
connection pools, and performance metrics with async monitoring.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from datetime import datetime

import aioredis
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import text

logger = logging.getLogger(__name__)


@dataclass
class HealthStatus:
    """Health check result."""

    database_healthy: bool = False
    redis_healthy: bool = False
    overall_healthy: bool = False
    last_check: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None
    checks: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    response_times: Dict[str, float] = field(default_factory=dict)
    connection_stats: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConnectionStats:
    """Database connection statistics."""

    total_connections: int = 0
    active_connections: int = 0
    idle_connections: int = 0
    waiting_connections: int = 0
    max_connections: int = 0
    average_response_time: float = 0.0
    queries_per_second: float = 0.0
    database_size: int = 0
    index_size: int = 0


class HealthChecker:
    """Async database health checker."""

    def __init__(
        self,
        engine: AsyncEngine,
        redis: Optional[aioredis.Redis] = None,
        check_interval: float = 30.0,
        check_timeout: float = 5.0,
    ):
        self.engine = engine
        self.redis = redis
        self.check_interval = check_interval
        self.check_timeout = check_timeout
        self._monitor_task: Optional[asyncio.Task] = None
        self._status = HealthStatus()
        self._lock = asyncio.Lock()
        self._query_times: List[float] = []
        self._max_query_times = 100

    async def start(self) -> None:
        """Start health monitoring task."""
        if self._monitor_task is not None:
            return

        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("Health checker started")

    async def stop(self) -> None:
        """Stop health monitoring task."""
        if self._monitor_task is not None:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            self._monitor_task = None
            logger.info("Health checker stopped")

    async def _monitor_loop(self) -> None:
        """Health monitoring loop."""
        while True:
            try:
                await self.check_health()
                await asyncio.sleep(self.check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")
                await asyncio.sleep(self.check_interval)

    async def check_health(self) -> HealthStatus:
        """Perform comprehensive health check."""
        async with self._lock:
            status = HealthStatus()
            status.last_check = datetime.utcnow()

            # Database health checks
            await self._check_database_connection(status)
            await self._check_database_queries(status)
            await self._check_connection_pool(status)
            await self._check_database_size(status)

            # Redis health check
            await self._check_redis_connection(status)

            # Determine overall health
            status.database_healthy = status.checks.get("database_connection", {}).get(
                "healthy", False
            ) and status.checks.get("database_queries", {}).get("healthy", False)

            status.redis_healthy = (
                (status.checks.get("redis_connection", {}).get("healthy", False))
                if self.redis
                else True
            )  # Redis is optional

            status.overall_healthy = status.database_healthy and status.redis_healthy

            # Update average response time
            if status.response_times:
                status.connection_stats["average_response_time"] = sum(
                    status.response_times.values()
                ) / len(status.response_times)

            self._status = status
            return status

    async def _check_database_connection(self, status: HealthStatus) -> None:
        """Check database connection health."""
        start_time = time.time()

        try:
            # Simple connection test with timeout
            async with asyncio.wait_for(
                self.engine.connect(), timeout=self.check_timeout
            ) as conn:
                await conn.execute(text("SELECT 1"))

            response_time = (time.time() - start_time) * 1000

            status.checks["database_connection"] = {
                "healthy": True,
                "response_time_ms": response_time,
                "timestamp": datetime.utcnow(),
                "error": None,
            }
            status.response_times["database_connection"] = response_time

        except asyncio.TimeoutError:
            status.checks["database_connection"] = {
                "healthy": False,
                "response_time_ms": self.check_timeout * 1000,
                "timestamp": datetime.utcnow(),
                "error": "Connection timeout",
            }
            status.response_times["database_connection"] = self.check_timeout * 1000

        except Exception as e:
            status.checks["database_connection"] = {
                "healthy": False,
                "response_time_ms": (time.time() - start_time) * 1000,
                "timestamp": datetime.utcnow(),
                "error": str(e),
            }
            status.response_times["database_connection"] = (
                time.time() - start_time
            ) * 1000

    async def _check_database_queries(self, status: HealthStatus) -> None:
        """Check database query performance."""
        start_time = time.time()

        try:
            async with self.engine.connect() as conn:
                # Test different types of queries
                queries = [
                    "SELECT 1 as test",
                    "SELECT version()",
                    "SELECT current_database(), current_user",
                ]

                results = []
                for query in queries:
                    query_start = time.time()
                    await conn.execute(text(query))
                    query_time = (time.time() - query_start) * 1000
                    results.append(query_time)

                avg_query_time = sum(results) / len(results)

            status.checks["database_queries"] = {
                "healthy": True,
                "average_query_time_ms": avg_query_time,
                "query_times_ms": results,
                "timestamp": datetime.utcnow(),
                "error": None,
            }
            status.response_times["database_queries"] = avg_query_time

            # Update query time history for performance tracking
            self._update_query_time_history(avg_query_time)

        except Exception as e:
            status.checks["database_queries"] = {
                "healthy": False,
                "average_query_time_ms": (time.time() - start_time) * 1000,
                "query_times_ms": [],
                "timestamp": datetime.utcnow(),
                "error": str(e),
            }
            status.response_times["database_queries"] = (
                time.time() - start_time
            ) * 1000

    async def _check_connection_pool(self, status: HealthStatus) -> None:
        """Check connection pool statistics."""
        try:
            pool = self.engine.pool
            if pool:
                pool_status = pool.status()

                status.connection_stats.update(
                    {
                        "total_connections": pool_status.pool_size,
                        "active_connections": pool_status.checkedout,
                        "idle_connections": pool_status.pool_size
                        - pool_status.checkedout,
                        "max_connections": self.engine.pool.size(),
                        "pool_overflow": getattr(pool_status, "overflow", 0),
                    }
                )

                # Check if pool is healthy
                pool_usage = pool_status.checkedout / pool_status.pool_size
                pool_healthy = pool_usage < 0.9  # Less than 90% usage

                status.checks["connection_pool"] = {
                    "healthy": pool_healthy,
                    "usage_percent": pool_usage * 100,
                    "timestamp": datetime.utcnow(),
                    "error": None if pool_healthy else "High pool usage",
                }
            else:
                status.checks["connection_pool"] = {
                    "healthy": False,
                    "usage_percent": 0,
                    "timestamp": datetime.utcnow(),
                    "error": "Pool not available",
                }

        except Exception as e:
            status.checks["connection_pool"] = {
                "healthy": False,
                "usage_percent": 0,
                "timestamp": datetime.utcnow(),
                "error": str(e),
            }

    async def _check_database_size(self, status: HealthStatus) -> None:
        """Check database size information."""
        try:
            async with self.engine.connect() as conn:
                # Get database size (PostgreSQL specific)
                result = await conn.execute(
                    text("""
                    SELECT
                        pg_database_size(current_database()) as database_size,
                        pg_size_pretty(pg_database_size(current_database())) as size_pretty
                """)
                )
                row = result.first()

                if row:
                    status.connection_stats["database_size"] = row.database_size
                    status.connection_stats["database_size_pretty"] = row.size_pretty

                # Get total index size
                result = await conn.execute(
                    text("""
                    SELECT pg_indexes_size(current_database()) as index_size,
                           pg_size_pretty(pg_indexes_size(current_database())) as index_size_pretty
                """)
                )
                row = result.first()

                if row:
                    status.connection_stats["index_size"] = row.index_size
                    status.connection_stats["index_size_pretty"] = row.index_size_pretty

                status.checks["database_size"] = {
                    "healthy": True,
                    "timestamp": datetime.utcnow(),
                    "error": None,
                }

        except Exception as e:
            status.checks["database_size"] = {
                "healthy": False,
                "timestamp": datetime.utcnow(),
                "error": str(e),
            }

    async def _check_redis_connection(self, status: HealthStatus) -> None:
        """Check Redis connection health."""
        if not self.redis:
            status.checks["redis_connection"] = {
                "healthy": True,
                "response_time_ms": 0,
                "timestamp": datetime.utcnow(),
                "error": None,
                "message": "Redis not configured",
            }
            return

        start_time = time.time()

        try:
            # Test Redis connection
            await asyncio.wait_for(self.redis.ping(), timeout=self.check_timeout)

            response_time = (time.time() - start_time) * 1000

            # Get Redis info
            info = await self.redis.info()

            status.checks["redis_connection"] = {
                "healthy": True,
                "response_time_ms": response_time,
                "timestamp": datetime.utcnow(),
                "error": None,
                "redis_info": {
                    "used_memory": info.get("used_memory", 0),
                    "connected_clients": info.get("connected_clients", 0),
                    "total_commands_processed": info.get("total_commands_processed", 0),
                    "keyspace_hits": info.get("keyspace_hits", 0),
                    "keyspace_misses": info.get("keyspace_misses", 0),
                },
            }
            status.response_times["redis_connection"] = response_time

        except asyncio.TimeoutError:
            status.checks["redis_connection"] = {
                "healthy": False,
                "response_time_ms": self.check_timeout * 1000,
                "timestamp": datetime.utcnow(),
                "error": "Redis connection timeout",
            }
            status.response_times["redis_connection"] = self.check_timeout * 1000

        except Exception as e:
            status.checks["redis_connection"] = {
                "healthy": False,
                "response_time_ms": (time.time() - start_time) * 1000,
                "timestamp": datetime.utcnow(),
                "error": str(e),
            }
            status.response_times["redis_connection"] = (
                time.time() - start_time
            ) * 1000

    def _update_query_time_history(self, query_time: float) -> None:
        """Update query time history for performance tracking."""
        self._query_times.append(query_time)

        # Keep only recent measurements
        if len(self._query_times) > self._max_query_times:
            self._query_times = self._query_times[-self._max_query_times :]

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics."""
        if not self._query_times:
            return {}

        return {
            "average_query_time_ms": sum(self._query_times) / len(self._query_times),
            "min_query_time_ms": min(self._query_times),
            "max_query_time_ms": max(self._query_times),
            "total_queries": len(self._query_times),
            "queries_per_second": len(self._query_times) / self.check_interval,
        }

    def is_healthy(self) -> bool:
        """Check if system is healthy."""
        return self._status.overall_healthy

    def get_status(self) -> HealthStatus:
        """Get current health status."""
        return self._status


class CircuitBreaker:
    """Circuit breaker for database operations."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: type = Exception,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception

        self._failure_count = 0
        self._last_failure_time = None
        self._state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    async def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self._state == "OPEN":
            if self._should_attempt_reset():
                self._state = "HALF_OPEN"
            else:
                raise Exception("Circuit breaker is OPEN")

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise e

    def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt to reset."""
        if self._last_failure_time is None:
            return False
        return time.time() - self._last_failure_time >= self.recovery_timeout

    def _on_success(self) -> None:
        """Handle successful operation."""
        self._failure_count = 0
        self._state = "CLOSED"

    def _on_failure(self) -> None:
        """Handle failed operation."""
        self._failure_count += 1
        self._last_failure_time = time.time()

        if self._failure_count >= self.failure_threshold:
            self._state = "OPEN"


class HealthCheckMiddleware:
    """Health check middleware for integration with web frameworks."""

    def __init__(self, health_checker: HealthChecker):
        self.health_checker = health_checker

    async def health_endpoint(self) -> Dict[str, Any]:
        """Health check endpoint response."""
        status = await self.health_checker.check_health()
        metrics = self.health_checker.get_performance_metrics()

        return {
            "status": "healthy" if status.overall_healthy else "unhealthy",
            "timestamp": status.last_check.isoformat(),
            "checks": status.checks,
            "response_times": status.response_times,
            "connection_stats": status.connection_stats,
            "performance_metrics": metrics,
        }

    async def readiness_endpoint(self) -> Dict[str, Any]:
        """Readiness check endpoint response."""
        status = self.health_checker.get_status()

        return {
            "ready": status.overall_healthy,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {
                "database": status.database_healthy,
                "redis": status.redis_healthy,
            },
        }

    async def liveness_endpoint(self) -> Dict[str, Any]:
        """Liveness check endpoint response."""
        return {
            "alive": True,
            "timestamp": datetime.utcnow().isoformat(),
        }
