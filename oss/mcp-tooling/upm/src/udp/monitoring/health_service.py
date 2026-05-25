"""
Health check service for UPM.

Provides comprehensive health checks for all system components
including database, Redis, workflow engine, and external services.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

import aiohttp
from redis.asyncio import Redis
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..services.base import BaseAsyncService


class HealthStatus(str, Enum):
    """Health check status."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class CheckType(str, Enum):
    """Health check types."""

    DATABASE = "database"
    REDIS = "redis"
    WORKFLOW_ENGINE = "workflow_engine"
    EXTERNAL_SERVICES = "external_services"
    SYSTEM_RESOURCES = "system_resources"
    DEPENDENCY_ANALYSIS = "dependency_analysis"
    SECURITY_SCANNING = "security_scanning"


@dataclass
class HealthCheckResult:
    """Result of a health check."""

    name: str
    type: CheckType
    status: HealthStatus
    message: str
    details: dict[str, Any]
    response_time_ms: Optional[float] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class SystemHealthReport:
    """Overall system health report."""

    status: HealthStatus
    checks: list[HealthCheckResult]
    summary: dict[str, Any]
    timestamp: datetime

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class HealthCheckService(BaseAsyncService):
    """
    Health check service for UPM system components.

    Provides comprehensive health monitoring for all system services,
    databases, and external dependencies.
    """

    def __init__(self, db_session: AsyncSession, redis_client: Redis):
        super().__init__(db_session, redis_client)
        self._health_checks: dict[str, Callable] = {}
        self._external_service_urls = {
            "nvd_api": "https://services.nvd.nist.gov/rest/json/cves/1.0",
            "github_advisories": "https://api.github.com/advisories",
            "osv_dev": "https://api.osv.dev/v1/query",
        }

        # Health check thresholds
        self._response_time_thresholds = {
            "database": 1000,  # 1 second
            "redis": 100,  # 100ms
            "external_api": 5000,  # 5 seconds
        }

        self._register_default_checks()

    def _register_default_checks(self) -> None:
        """Register default health checks."""
        self._health_checks.update(
            {
                "database_connection": self._check_database_connection,
                "database_performance": self._check_database_performance,
                "redis_connection": self._check_redis_connection,
                "redis_memory": self._check_redis_memory,
                "workflow_engine": self._check_workflow_engine,
                "external_services": self._check_external_services,
                "system_resources": self._check_system_resources,
            }
        )

    def register_health_check(self, name: str, check_func: Callable) -> None:
        """
        Register a custom health check.

        Args:
            name: Unique name for the health check
            check_func: Async function that returns HealthCheckResult
        """
        self._health_checks[name] = check_func
        self.logger.info(f"Registered health check: {name}")

    async def run_health_checks(
        self, checks: Optional[list[str]] = None
    ) -> SystemHealthReport:
        """
        Run health checks for system components.

        Args:
            checks: List of specific checks to run (runs all if None)

        Returns:
            System health report
        """
        start_time = time.time()
        results = []

        checks_to_run = checks if checks else list(self._health_checks.keys())

        for check_name in checks_to_run:
            if check_name not in self._health_checks:
                results.append(
                    HealthCheckResult(
                        name=check_name,
                        type=CheckType.SYSTEM_RESOURCES,
                        status=HealthStatus.UNKNOWN,
                        message=f"Unknown health check: {check_name}",
                        details={"error": "Health check not found"},
                    )
                )
                continue

            try:
                result = await self._health_checks[check_name]()
                results.append(result)
            except Exception as e:
                self.logger.error(f"Health check '{check_name}' failed: {e}")
                results.append(
                    HealthCheckResult(
                        name=check_name,
                        type=CheckType.SYSTEM_RESOURCES,
                        status=HealthStatus.UNHEALTHY,
                        message=f"Health check failed: {str(e)}",
                        details={"error": str(e), "exception_type": type(e).__name__},
                    )
                )

        # Calculate overall system health
        overall_status = self._calculate_overall_status(results)

        # Create summary
        summary = {
            "total_checks": len(results),
            "healthy_checks": len(
                [r for r in results if r.status == HealthStatus.HEALTHY]
            ),
            "degraded_checks": len(
                [r for r in results if r.status == HealthStatus.DEGRADED]
            ),
            "unhealthy_checks": len(
                [r for r in results if r.status == HealthStatus.UNHEALTHY]
            ),
            "unknown_checks": len(
                [r for r in results if r.status == HealthStatus.UNKNOWN]
            ),
            "total_response_time_ms": (time.time() - start_time) * 1000,
        }

        return SystemHealthReport(
            status=overall_status,
            checks=results,
            summary=summary,
            timestamp=datetime.utcnow(),
        )

    async def _check_database_connection(self) -> HealthCheckResult:
        """Check database connectivity."""
        start_time = time.time()

        try:
            # Simple database query
            result = await self.db_session.execute(text("SELECT 1"))
            await result.fetchone()

            response_time = (time.time() - start_time) * 1000

            if response_time > self._response_time_thresholds["database"]:
                return HealthCheckResult(
                    name="database_connection",
                    type=CheckType.DATABASE,
                    status=HealthStatus.DEGRADED,
                    message="Database connection slow",
                    details={
                        "response_time_ms": response_time,
                        "threshold_ms": self._response_time_thresholds["database"],
                    },
                    response_time_ms=response_time,
                )

            return HealthCheckResult(
                name="database_connection",
                type=CheckType.DATABASE,
                status=HealthStatus.HEALTHY,
                message="Database connection successful",
                details={
                    "response_time_ms": response_time,
                    "threshold_ms": self._response_time_thresholds["database"],
                },
                response_time_ms=response_time,
            )

        except Exception as e:
            return HealthCheckResult(
                name="database_connection",
                type=CheckType.DATABASE,
                status=HealthStatus.UNHEALTHY,
                message=f"Database connection failed: {str(e)}",
                details={"error": str(e)},
                response_time_ms=(time.time() - start_time) * 1000,
            )

    async def _check_database_performance(self) -> HealthCheckResult:
        """Check database performance metrics."""
        start_time = time.time()

        try:
            # Check table sizes and query performance
            queries = [
                "SELECT COUNT(*) FROM workflow_states",
                "SELECT COUNT(*) FROM workflow_events",
                "SELECT COUNT(*) FROM dependencies",
                "SELECT COUNT(*) FROM vulnerabilities",
            ]

            results = {}
            total_response_time = 0

            for query in queries:
                query_start = time.time()
                result = await self.db_session.execute(text(query))
                count = result.scalar()
                query_time = (time.time() - query_start) * 1000
                total_response_time += query_time

                table_name = query.split("FROM")[1].strip()
                results[table_name] = {"count": count, "query_time_ms": query_time}

            # Check if any queries are slow
            slow_queries = [
                name for name, data in results.items() if data["query_time_ms"] > 1000
            ]

            if slow_queries:
                return HealthCheckResult(
                    name="database_performance",
                    type=CheckType.DATABASE,
                    status=HealthStatus.DEGRADED,
                    message=f"Slow queries detected: {', '.join(slow_queries)}",
                    details={
                        "table_stats": results,
                        "slow_queries": slow_queries,
                        "total_response_time_ms": total_response_time,
                    },
                    response_time_ms=(time.time() - start_time) * 1000,
                )

            return HealthCheckResult(
                name="database_performance",
                type=CheckType.DATABASE,
                status=HealthStatus.HEALTHY,
                message="Database performance acceptable",
                details={
                    "table_stats": results,
                    "total_response_time_ms": total_response_time,
                },
                response_time_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            return HealthCheckResult(
                name="database_performance",
                type=CheckType.DATABASE,
                status=HealthStatus.UNHEALTHY,
                message=f"Database performance check failed: {str(e)}",
                details={"error": str(e)},
                response_time_ms=(time.time() - start_time) * 1000,
            )

    async def _check_redis_connection(self) -> HealthCheckResult:
        """Check Redis connectivity."""
        start_time = time.time()

        try:
            # Test Redis with PING
            pong = await self.redis.ping()

            response_time = (time.time() - start_time) * 1000

            if not pong:
                return HealthCheckResult(
                    name="redis_connection",
                    type=CheckType.REDIS,
                    status=HealthStatus.UNHEALTHY,
                    message="Redis ping failed",
                    details={"response": pong},
                    response_time_ms=response_time,
                )

            if response_time > self._response_time_thresholds["redis"]:
                return HealthCheckResult(
                    name="redis_connection",
                    type=CheckType.REDIS,
                    status=HealthStatus.DEGRADED,
                    message="Redis response slow",
                    details={
                        "response_time_ms": response_time,
                        "threshold_ms": self._response_time_thresholds["redis"],
                        "ping_response": pong,
                    },
                    response_time_ms=response_time,
                )

            # Test basic operations
            test_key = "health_check_test"
            await self.redis.set(test_key, "test_value", ex=10)
            value = await self.redis.get(test_key)
            await self.redis.delete(test_key)

            if value != b"test_value":
                return HealthCheckResult(
                    name="redis_connection",
                    type=CheckType.REDIS,
                    status=HealthStatus.DEGRADED,
                    message="Redis basic operations failed",
                    details={
                        "test_value": value.decode() if value else None,
                        "expected": "test_value",
                    },
                    response_time_ms=response_time,
                )

            return HealthCheckResult(
                name="redis_connection",
                type=CheckType.REDIS,
                status=HealthStatus.HEALTHY,
                message="Redis connection healthy",
                details={
                    "response_time_ms": response_time,
                    "ping_response": pong,
                    "basic_operations": "passed",
                },
                response_time_ms=response_time,
            )

        except Exception as e:
            return HealthCheckResult(
                name="redis_connection",
                type=CheckType.REDIS,
                status=HealthStatus.UNHEALTHY,
                message=f"Redis connection failed: {str(e)}",
                details={"error": str(e)},
                response_time_ms=(time.time() - start_time) * 1000,
            )

    async def _check_redis_memory(self) -> HealthCheckResult:
        """Check Redis memory usage."""
        start_time = time.time()

        try:
            info = await self.redis.info("memory")

            used_memory = info.get("used_memory", 0)
            max_memory = info.get("maxmemory", 0)
            used_memory_human = info.get("used_memory_human", "unknown")

            memory_usage_mb = used_memory // (1024 * 1024)
            memory_usage_percent = (
                (used_memory / max_memory * 100) if max_memory > 0 else None
            )

            # Check memory usage thresholds
            if memory_usage_percent and memory_usage_percent > 90:
                return HealthCheckResult(
                    name="redis_memory",
                    type=CheckType.REDIS,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Redis memory usage critical: {memory_usage_percent:.1f}%",
                    details={
                        "used_memory_bytes": used_memory,
                        "used_memory_human": used_memory_human,
                        "max_memory_bytes": max_memory,
                        "memory_usage_mb": memory_usage_mb,
                        "memory_usage_percent": memory_usage_percent,
                    },
                    response_time_ms=(time.time() - start_time) * 1000,
                )
            elif memory_usage_percent and memory_usage_percent > 80:
                return HealthCheckResult(
                    name="redis_memory",
                    type=CheckType.REDIS,
                    status=HealthStatus.DEGRADED,
                    message=f"Redis memory usage high: {memory_usage_percent:.1f}%",
                    details={
                        "used_memory_bytes": used_memory,
                        "used_memory_human": used_memory_human,
                        "max_memory_bytes": max_memory,
                        "memory_usage_mb": memory_usage_mb,
                        "memory_usage_percent": memory_usage_percent,
                    },
                    response_time_ms=(time.time() - start_time) * 1000,
                )

            return HealthCheckResult(
                name="redis_memory",
                type=CheckType.REDIS,
                status=HealthStatus.HEALTHY,
                message="Redis memory usage normal",
                details={
                    "used_memory_bytes": used_memory,
                    "used_memory_human": used_memory_human,
                    "memory_usage_mb": memory_usage_mb,
                    "memory_usage_percent": memory_usage_percent,
                },
                response_time_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            return HealthCheckResult(
                name="redis_memory",
                type=CheckType.REDIS,
                status=HealthStatus.UNKNOWN,
                message=f"Redis memory check failed: {str(e)}",
                details={"error": str(e)},
                response_time_ms=(time.time() - start_time) * 1000,
            )

    async def _check_workflow_engine(self) -> HealthCheckResult:
        """Check workflow engine health."""
        start_time = time.time()

        try:
            from ..core.models.workflow_state import (
                WorkflowStateModel,
                WorkflowStateStatus,
            )

            # Check active workflows count
            active_query = select(func.count(WorkflowStateModel.id)).where(
                WorkflowStateModel.status == WorkflowStateStatus.ACTIVE
            )
            active_result = await self.db_session.execute(active_query)
            active_count = active_result.scalar() or 0

            # Check recent workflow completions
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_query = select(func.count(WorkflowStateModel.id)).where(
                and_(
                    WorkflowStateModel.updated_at >= one_hour_ago,
                    WorkflowStateModel.status == WorkflowStateStatus.COMPLETED,
                )
            )
            recent_result = await self.db_session.execute(recent_query)
            recent_count = recent_result.scalar() or 0

            # Check for stuck workflows (active for too long)
            stuck_threshold = datetime.utcnow() - timedelta(hours=2)
            stuck_query = select(func.count(WorkflowStateModel.id)).where(
                and_(
                    WorkflowStateModel.status == WorkflowStateStatus.ACTIVE,
                    WorkflowStateModel.created_at < stuck_threshold,
                )
            )
            stuck_result = await self.db_session.execute(stuck_query)
            stuck_count = stuck_result.scalar() or 0

            if stuck_count > 0:
                return HealthCheckResult(
                    name="workflow_engine",
                    type=CheckType.WORKFLOW_ENGINE,
                    status=HealthStatus.DEGRADED,
                    message=f"Found {stuck_count} potentially stuck workflows",
                    details={
                        "active_workflows": active_count,
                        "recent_completions": recent_count,
                        "stuck_workflows": stuck_count,
                        "stuck_threshold_hours": 2,
                    },
                    response_time_ms=(time.time() - start_time) * 1000,
                )

            if active_count > 1000:
                return HealthCheckResult(
                    name="workflow_engine",
                    type=CheckType.WORKFLOW_ENGINE,
                    status=HealthStatus.DEGRADED,
                    message=f"High number of active workflows: {active_count}",
                    details={
                        "active_workflows": active_count,
                        "recent_completions": recent_count,
                        "stuck_workflows": stuck_count,
                    },
                    response_time_ms=(time.time() - start_time) * 1000,
                )

            return HealthCheckResult(
                name="workflow_engine",
                type=CheckType.WORKFLOW_ENGINE,
                status=HealthStatus.HEALTHY,
                message="Workflow engine operating normally",
                details={
                    "active_workflows": active_count,
                    "recent_completions": recent_count,
                    "stuck_workflows": stuck_count,
                },
                response_time_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            return HealthCheckResult(
                name="workflow_engine",
                type=CheckType.WORKFLOW_ENGINE,
                status=HealthStatus.UNKNOWN,
                message=f"Workflow engine check failed: {str(e)}",
                details={"error": str(e)},
                response_time_ms=(time.time() - start_time) * 1000,
            )

    async def _check_external_services(self) -> HealthCheckResult:
        """Check external service availability."""
        start_time = time.time()
        service_results = {}
        overall_status = HealthStatus.HEALTHY

        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=5)
        ) as session:
            for service_name, url in self._external_service_urls.items():
                service_start = time.time()

                try:
                    async with session.get(url) as response:
                        response_time = (time.time() - service_start) * 1000

                        if response.status == 200:
                            service_results[service_name] = {
                                "status": "available",
                                "response_time_ms": response_time,
                                "status_code": response.status,
                            }
                        else:
                            service_results[service_name] = {
                                "status": "error",
                                "response_time_ms": response_time,
                                "status_code": response.status,
                            }
                            if overall_status == HealthStatus.HEALTHY:
                                overall_status = HealthStatus.DEGRADED

                except Exception as e:
                    service_results[service_name] = {
                        "status": "unavailable",
                        "error": str(e),
                        "response_time_ms": (time.time() - service_start) * 1000,
                    }
                    overall_status = HealthStatus.DEGRADED

        # Check if any services are completely unavailable
        unavailable_services = [
            name
            for name, result in service_results.items()
            if result.get("status") == "unavailable"
        ]

        if unavailable_services:
            overall_status = HealthStatus.UNHEALTHY

        return HealthCheckResult(
            name="external_services",
            type=CheckType.EXTERNAL_SERVICES,
            status=overall_status,
            message=f"External services status: {overall_status.value}",
            details={
                "services": service_results,
                "unavailable_services": unavailable_services,
                "total_services": len(self._external_service_urls),
            },
            response_time_ms=(time.time() - start_time) * 1000,
        )

    async def _check_system_resources(self) -> HealthCheckResult:
        """Check system resource usage."""
        start_time = time.time()

        try:
            import psutil

            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)

            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_used_gb = memory.used / (1024**3)
            memory_total_gb = memory.total / (1024**3)

            # Disk usage
            disk = psutil.disk_usage("/")
            disk_percent = (disk.used / disk.total) * 100
            disk_used_gb = disk.used / (1024**3)
            disk_total_gb = disk.total / (1024**3)

            # Determine health status
            status = HealthStatus.HEALTHY

            if cpu_percent > 90 or memory_percent > 90 or disk_percent > 90:
                status = HealthStatus.UNHEALTHY
            elif cpu_percent > 70 or memory_percent > 70 or disk_percent > 80:
                status = HealthStatus.DEGRADED

            return HealthCheckResult(
                name="system_resources",
                type=CheckType.SYSTEM_RESOURCES,
                status=status,
                message=f"System resource usage: {status.value}",
                details={
                    "cpu": {
                        "percent": cpu_percent,
                        "status": "critical"
                        if cpu_percent > 90
                        else "high"
                        if cpu_percent > 70
                        else "normal",
                    },
                    "memory": {
                        "percent": memory_percent,
                        "used_gb": round(memory_used_gb, 2),
                        "total_gb": round(memory_total_gb, 2),
                        "status": "critical"
                        if memory_percent > 90
                        else "high"
                        if memory_percent > 70
                        else "normal",
                    },
                    "disk": {
                        "percent": disk_percent,
                        "used_gb": round(disk_used_gb, 2),
                        "total_gb": round(disk_total_gb, 2),
                        "status": "critical"
                        if disk_percent > 90
                        else "high"
                        if disk_percent > 80
                        else "normal",
                    },
                },
                response_time_ms=(time.time() - start_time) * 1000,
            )

        except ImportError:
            return HealthCheckResult(
                name="system_resources",
                type=CheckType.SYSTEM_RESOURCES,
                status=HealthStatus.UNKNOWN,
                message="psutil not available for system resource monitoring",
                details={"error": "psutil package not installed"},
            )
        except Exception as e:
            return HealthCheckResult(
                name="system_resources",
                type=CheckType.SYSTEM_RESOURCES,
                status=HealthStatus.UNKNOWN,
                message=f"System resource check failed: {str(e)}",
                details={"error": str(e)},
                response_time_ms=(time.time() - start_time) * 1000,
            )

    def _calculate_overall_status(
        self, results: list[HealthCheckResult]
    ) -> HealthStatus:
        """Calculate overall system health status."""

        if not results:
            return HealthStatus.UNKNOWN

        # Priority order: UNHEALTHY > DEGRADED > HEALTHY > UNKNOWN
        has_unhealthy = any(r.status == HealthStatus.UNHEALTHY for r in results)
        has_degraded = any(r.status == HealthStatus.DEGRADED for r in results)
        has_healthy = any(r.status == HealthStatus.HEALTHY for r in results)

        if has_unhealthy:
            return HealthStatus.UNHEALTHY
        elif has_degraded:
            return HealthStatus.DEGRADED
        elif has_healthy:
            return HealthStatus.HEALTHY
        else:
            return HealthStatus.UNKNOWN

    async def get_health_summary(self) -> dict[str, Any]:
        """
        Get a quick health summary for monitoring dashboards.

        Returns:
            Simplified health summary
        """
        report = await self.run_health_checks()

        return {
            "status": report.status.value,
            "timestamp": report.timestamp.isoformat(),
            "summary": report.summary,
            "critical_issues": [
                check.name
                for check in report.checks
                if check.status == HealthStatus.UNHEALTHY
            ],
            "warnings": [
                check.name
                for check in report.checks
                if check.status == HealthStatus.DEGRADED
            ],
        }
