"""
Health check service for UPM.

Provides comprehensive health checks for all system components
including database, Redis, workflow engine, and external services.
"""

import asyncio
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import Any

import httpx
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from .workflow_monitor import WorkflowHealthStatus, WorkflowMonitorService


class HealthCheckStatus(str, Enum):
    """Health check status."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class HealthCheckResult:
    """Result of a health check."""

    name: str
    status: HealthCheckStatus
    message: str
    response_time_ms: float
    details: dict[str, Any] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class SystemHealthReport:
    """Comprehensive system health report."""

    overall_status: HealthCheckStatus
    checks: list[HealthCheckResult]
    timestamp: datetime
    uptime_seconds: float
    version: str = "1.0.0"

    @property
    def is_healthy(self) -> bool:
        """Check if system is overall healthy."""
        return self.overall_status == HealthCheckStatus.HEALTHY

    @property
    def is_degraded(self) -> bool:
        """Check if system is degraded."""
        return self.overall_status == HealthCheckStatus.DEGRADED

    @property
    def failed_checks(self) -> list[HealthCheckResult]:
        """Get list of failed health checks."""
        return [
            check
            for check in self.checks
            if check.status in [HealthCheckStatus.UNHEALTHY, HealthCheckStatus.DEGRADED]
        ]


class HealthCheckService:
    """
    Health check service for monitoring system components.

    Provides comprehensive health checks for database, Redis, external services,
    and internal system health.
    """

    def __init__(
        self,
        db_session: AsyncSession,
        redis_client: Redis,
        settings: Settings,
        workflow_monitor: WorkflowMonitorService,
    ):
        self.db_session = db_session
        self.redis_client = redis_client
        self.settings = settings
        self.workflow_monitor = workflow_monitor
        self._start_time = datetime.utcnow()
        self._health_checks: dict[str, Callable] = {}
        self._external_endpoints: list[str] = []

        # Register default health checks
        self._register_default_health_checks()

    def _register_default_health_checks(self) -> None:
        """Register default health check functions."""
        self._health_checks.update(
            {
                "database": self._check_database_health,
                "redis": self._check_redis_health,
                "workflow_engine": self._check_workflow_engine_health,
                "disk_space": self._check_disk_space,
                "memory_usage": self._check_memory_usage,
            }
        )

    def register_health_check(self, name: str, check_func: Callable) -> None:
        """
        Register a custom health check.

        Args:
            name: Health check name
            check_func: Function that performs the health check
        """
        self._health_checks[name] = check_func

    def register_external_endpoint(self, url: str) -> None:
        """
        Register an external endpoint for health checking.

        Args:
            url: External service URL to check
        """
        if url not in self._external_endpoints:
            self._external_endpoints.append(url)

    async def run_health_checks(self) -> SystemHealthReport:
        """
        Run all registered health checks.

        Returns:
            Comprehensive system health report
        """
        checks = []

        # Run all registered health checks
        for check_name, check_func in self._health_checks.items():
            try:
                result = await check_func()
                checks.append(result)
            except Exception as e:
                checks.append(
                    HealthCheckResult(
                        name=check_name,
                        status=HealthCheckStatus.UNHEALTHY,
                        message=f"Health check failed: {str(e)}",
                        response_time_ms=0,
                        details={"error": str(e)},
                    )
                )

        # Check external endpoints
        for endpoint in self._external_endpoints:
            try:
                result = await self._check_external_endpoint(endpoint)
                checks.append(result)
            except Exception as e:
                checks.append(
                    HealthCheckResult(
                        name=f"external_endpoint_{endpoint}",
                        status=HealthCheckStatus.UNHEALTHY,
                        message=f"External endpoint check failed: {str(e)}",
                        response_time_ms=0,
                        details={"url": endpoint, "error": str(e)},
                    )
                )

        # Calculate overall status
        overall_status = self._calculate_overall_status(checks)

        # Calculate uptime
        uptime_seconds = (datetime.utcnow() - self._start_time).total_seconds()

        return SystemHealthReport(
            overall_status=overall_status,
            checks=checks,
            timestamp=datetime.utcnow(),
            uptime_seconds=uptime_seconds,
        )

    async def _check_database_health(self) -> HealthCheckResult:
        """Check database connectivity and performance."""
        start_time = time.time()

        try:
            # Test basic connectivity
            result = await self.db_session.execute(text("SELECT 1"))
            result.fetchone()

            # Test table accessibility
            tables_query = text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                LIMIT 5
            """)
            tables_result = await self.db_session.execute(tables_query)
            tables = tables_result.fetchall()

            # Test query performance
            perf_start = time.time()
            await self.db_session.execute(
                text("SELECT COUNT(*) FROM workflow_states LIMIT 1")
            )
            query_time = (time.time() - perf_start) * 1000

            response_time_ms = (time.time() - start_time) * 1000

            # Determine health status
            if response_time_ms > 5000:  # > 5 seconds
                status = HealthCheckStatus.DEGRADED
                message = "Database response is slow"
            elif query_time > 1000:  # > 1 second for query
                status = HealthCheckStatus.DEGRADED
                message = "Database query performance is degraded"
            else:
                status = HealthCheckStatus.HEALTHY
                message = "Database is healthy"

            return HealthCheckResult(
                name="database",
                status=status,
                message=message,
                response_time_ms=response_time_ms,
                details={
                    "tables_accessible": len(tables),
                    "query_time_ms": query_time,
                    "connection_test": "passed",
                },
            )

        except Exception as e:
            return HealthCheckResult(
                name="database",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"Database health check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                details={"error": str(e)},
            )

    async def _check_redis_health(self) -> HealthCheckResult:
        """Check Redis connectivity and performance."""
        start_time = time.time()

        try:
            # Test basic connectivity
            await self.redis_client.ping()

            # Test read/write performance
            test_key = f"health_check_test_{int(time.time())}"
            test_value = "test_value"

            write_start = time.time()
            await self.redis_client.set(test_key, test_value, ex=60)
            write_time = (time.time() - write_start) * 1000

            read_start = time.time()
            retrieved_value = await self.redis_client.get(test_key)
            read_time = (time.time() - read_start) * 1000

            # Cleanup
            await self.redis_client.delete(test_key)

            response_time_ms = (time.time() - start_time) * 1000

            # Get Redis info
            redis_info = await self.redis_client.info()

            # Determine health status
            if response_time_ms > 1000:  # > 1 second
                status = HealthCheckStatus.DEGRADED
                message = "Redis response is slow"
            elif write_time > 100 or read_time > 100:  # > 100ms for operations
                status = HealthCheckStatus.DEGRADED
                message = "Redis operation performance is degraded"
            elif retrieved_value != test_value:
                status = HealthCheckStatus.UNHEALTHY
                message = "Redis data integrity check failed"
            else:
                status = HealthCheckStatus.HEALTHY
                message = "Redis is healthy"

            return HealthCheckResult(
                name="redis",
                status=status,
                message=message,
                response_time_ms=response_time_ms,
                details={
                    "write_time_ms": write_time,
                    "read_time_ms": read_time,
                    "memory_usage_mb": redis_info.get("used_memory", 0)
                    // (1024 * 1024),
                    "connected_clients": redis_info.get("connected_clients", 0),
                    "uptime_seconds": redis_info.get("uptime_in_seconds", 0),
                },
            )

        except Exception as e:
            return HealthCheckResult(
                name="redis",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"Redis health check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                details={"error": str(e)},
            )

    async def _check_workflow_engine_health(self) -> HealthCheckResult:
        """Check workflow engine health."""
        start_time = time.time()

        try:
            # Get workflow health metrics
            health_metrics = await self.workflow_monitor.get_system_health_metrics()

            response_time_ms = (time.time() - start_time) * 1000

            # Determine health status based on workflow health
            if health_metrics.health_status == WorkflowHealthStatus.HEALTHY:
                status = HealthCheckStatus.HEALTHY
                message = "Workflow engine is healthy"
            elif health_metrics.health_status == WorkflowHealthStatus.DEGRADED:
                status = HealthCheckStatus.DEGRADED
                message = "Workflow engine is degraded"
            else:
                status = HealthCheckStatus.UNHEALTHY
                message = "Workflow engine is unhealthy"

            return HealthCheckResult(
                name="workflow_engine",
                status=status,
                message=message,
                response_time_ms=response_time,
                details={
                    "active_workflows": health_metrics.active_workflows,
                    "failed_workflows": health_metrics.failed_workflows,
                    "error_rate": health_metrics.overall_error_rate,
                    "active_alerts": len(health_metrics.active_alerts),
                },
            )

        except Exception as e:
            return HealthCheckResult(
                name="workflow_engine",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"Workflow engine health check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                details={"error": str(e)},
            )

    async def _check_disk_space(self) -> HealthCheckResult:
        """Check available disk space."""
        start_time = time.time()

        try:
            import shutil

            # Get disk usage
            total, used, free = shutil.disk_usage("/")

            free_percent = (free / total) * 100
            used_percent = (used / total) * 100

            response_time_ms = (time.time() - start_time) * 1000

            # Determine health status
            if free_percent < 5:  # Less than 5% free
                status = HealthCheckStatus.UNHEALTHY
                message = "Critical: Very low disk space"
            elif free_percent < 10:  # Less than 10% free
                status = HealthCheckStatus.DEGRADED
                message = "Low disk space"
            else:
                status = HealthCheckStatus.HEALTHY
                message = "Disk space is adequate"

            return HealthCheckResult(
                name="disk_space",
                status=status,
                message=message,
                response_time_ms=response_time_ms,
                details={
                    "total_gb": total // (1024**3),
                    "used_gb": used // (1024**3),
                    "free_gb": free // (1024**3),
                    "free_percent": round(free_percent, 2),
                    "used_percent": round(used_percent, 2),
                },
            )

        except Exception as e:
            return HealthCheckResult(
                name="disk_space",
                status=HealthCheckStatus.UNKNOWN,
                message=f"Disk space check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                details={"error": str(e)},
            )

    async def _check_memory_usage(self) -> HealthCheckResult:
        """Check system memory usage."""
        start_time = time.time()

        try:
            import psutil

            # Get memory information
            memory = psutil.virtual_memory()

            response_time_ms = (time.time() - start_time) * 1000

            # Determine health status
            if memory.percent > 90:  # More than 90% used
                status = HealthCheckStatus.UNHEALTHY
                message = "Critical: Very high memory usage"
            elif memory.percent > 80:  # More than 80% used
                status = HealthCheckStatus.DEGRADED
                message = "High memory usage"
            else:
                status = HealthCheckStatus.HEALTHY
                message = "Memory usage is normal"

            return HealthCheckResult(
                name="memory_usage",
                status=status,
                message=message,
                response_time_ms=response_time_ms,
                details={
                    "total_gb": round(memory.total / (1024**3), 2),
                    "used_gb": round(memory.used / (1024**3), 2),
                    "free_gb": round(memory.available / (1024**3), 2),
                    "usage_percent": round(memory.percent, 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                },
            )

        except Exception as e:
            return HealthCheckResult(
                name="memory_usage",
                status=HealthCheckStatus.UNKNOWN,
                message=f"Memory usage check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                details={"error": str(e)},
            )

    async def _check_external_endpoint(self, url: str) -> HealthCheckResult:
        """Check an external endpoint health."""
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)

                response_time_ms = (time.time() - start_time) * 1000

                # Determine health status
                if response.status_code == 200:
                    if response_time_ms > 5000:  # > 5 seconds
                        status = HealthCheckStatus.DEGRADED
                        message = f"External endpoint responded slowly ({response_time_ms:.0f}ms)"
                    else:
                        status = HealthCheckStatus.HEALTHY
                        message = "External endpoint is healthy"
                elif 400 <= response.status_code < 500:
                    status = HealthCheckStatus.DEGRADED
                    message = f"External endpoint returned client error ({response.status_code})"
                else:
                    status = HealthCheckStatus.UNHEALTHY
                    message = f"External endpoint returned server error ({response.status_code})"

                return HealthCheckResult(
                    name=f"external_endpoint_{url}",
                    status=status,
                    message=message,
                    response_time_ms=response_time_ms,
                    details={
                        "url": url,
                        "status_code": response.status_code,
                        "response_time_ms": response_time_ms,
                    },
                )

        except Exception as e:
            return HealthCheckResult(
                name=f"external_endpoint_{url}",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"External endpoint check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                details={"url": url, "error": str(e)},
            )

    def _calculate_overall_status(
        self, checks: list[HealthCheckResult]
    ) -> HealthCheckStatus:
        """Calculate overall system health status."""
        if not checks:
            return HealthCheckStatus.UNKNOWN

        # Check for any unhealthy checks
        unhealthy_checks = [
            c for c in checks if c.status == HealthCheckStatus.UNHEALTHY
        ]
        if unhealthy_checks:
            return HealthCheckStatus.UNHEALTHY

        # Check for any degraded checks
        degraded_checks = [c for c in checks if c.status == HealthCheckStatus.DEGRADED]
        if degraded_checks:
            return HealthCheckStatus.DEGRADED

        # Check for any unknown checks
        unknown_checks = [c for c in checks if c.status == HealthCheckStatus.UNKNOWN]
        if unknown_checks:
            return HealthCheckStatus.DEGRADED

        return HealthCheckStatus.HEALTHY

    async def get_health_summary(self) -> dict[str, Any]:
        """Get a summary of system health."""
        health_report = await self.run_health_checks()

        summary = {
            "overall_status": health_report.overall_status,
            "is_healthy": health_report.is_healthy,
            "is_degraded": health_report.is_degraded,
            "uptime_seconds": health_report.uptime_seconds,
            "uptime_hours": health_report.uptime_seconds / 3600,
            "timestamp": health_report.timestamp.isoformat(),
            "version": health_report.version,
            "checks_count": len(health_report.checks),
            "healthy_checks": len(
                [
                    c
                    for c in health_report.checks
                    if c.status == HealthCheckStatus.HEALTHY
                ]
            ),
            "degraded_checks": len(
                [
                    c
                    for c in health_report.checks
                    if c.status == HealthCheckStatus.DEGRADED
                ]
            ),
            "unhealthy_checks": len(
                [
                    c
                    for c in health_report.checks
                    if c.status == HealthCheckStatus.UNHEALTHY
                ]
            ),
            "unknown_checks": len(
                [
                    c
                    for c in health_report.checks
                    if c.status == HealthCheckStatus.UNKNOWN
                ]
            ),
            "failed_checks_count": len(health_report.failed_checks),
            "failed_checks": [
                {
                    "name": check.name,
                    "status": check.status,
                    "message": check.message,
                    "response_time_ms": check.response_time_ms,
                }
                for check in health_report.failed_checks
            ],
        }

        return summary

    async def start_health_monitoring(self, interval_seconds: int = 300) -> None:
        """
        Start continuous health monitoring.

        Args:
            interval_seconds: Health check interval in seconds
        """

        async def monitoring_loop():
            while True:
                try:
                    health_report = await self.run_health_checks()

                    # Store latest health report in Redis
                    health_data = {
                        "report": asdict(health_report),
                        "summary": await self.get_health_summary(),
                    }
                    await self.redis_client.setex(
                        "latest_health_report",
                        3600,  # 1 hour TTL
                        json.dumps(health_data, default=str),
                    )

                    # Log health status
                    if not health_report.is_healthy:
                        failed_checks = ", ".join(
                            [c.name for c in health_report.failed_checks]
                        )
                        print(f"Health check failed: {failed_checks}")

                    await asyncio.sleep(interval_seconds)

                except Exception as e:
                    print(f"Error in health monitoring loop: {e}")
                    await asyncio.sleep(interval_seconds)

        # Start monitoring task
        asyncio.create_task(monitoring_loop())
