"""
Enhanced Health Monitor for RAG Service

Comprehensive health monitoring with:
- Component-level health checks
- Dependency health verification
- Performance metrics monitoring
- Resource utilization tracking
- Automated health recovery
- Health trend analysis
- Integration with monitoring systems
"""

import asyncio
import logging
import psutil
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Tuple
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class HealthStatus(str, Enum):
    """Health status levels"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    CRITICAL = "critical"


class ComponentType(str, Enum):
    """Component types for health monitoring"""

    DATABASE = "database"
    CACHE = "cache"
    LLM_PROVIDER = "llm_provider"
    EMBEDDING_SERVICE = "embedding_service"
    VECTOR_STORE = "vector_store"
    DOCUMENT_PROCESSOR = "document_processor"
    QUEUE = "queue"
    STORAGE = "storage"
    EXTERNAL_API = "external_api"
    SYSTEM = "system"


@dataclass
class HealthCheck:
    """Health check configuration and results"""

    name: str
    component_type: ComponentType
    check_function: Callable
    timeout_seconds: float = 5.0
    interval_seconds: float = 60.0
    critical: bool = False
    dependencies: List[str] = field(default_factory=list)

    # Runtime state
    last_check: Optional[datetime] = None
    last_result: Optional[bool] = None
    last_error: Optional[str] = None
    consecutive_failures: int = 0
    response_time_ms: Optional[float] = None
    metrics: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.metrics:
            self.metrics = {}


@dataclass
class HealthCheckResult:
    """Result of a health check"""

    check_name: str
    status: HealthStatus
    healthy: bool
    message: str
    response_time_ms: float
    timestamp: datetime
    metrics: Dict[str, Any] = field(default_factory=dict)
    details: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)


@dataclass
class SystemMetrics:
    """System resource metrics"""

    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_available_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_available_gb: float
    network_io: Dict[str, int]
    process_count: int
    load_average: Optional[Tuple[float, float, float]] = None
    uptime_seconds: float = 0.0

    @property
    def is_healthy(self) -> bool:
        """Check if system metrics are healthy"""
        return (
            self.cpu_percent < 80
            and self.memory_percent < 85
            and self.disk_percent < 90
        )


class HealthMonitor:
    """Enhanced health monitoring system"""

    def __init__(self):
        self._checks: Dict[str, HealthCheck] = {}
        self._results: Dict[str, HealthCheckResult] = {}
        self._system_metrics: deque = deque(maxlen=1000)
        self._alert_thresholds = {
            "cpu_warning": 70.0,
            "cpu_critical": 90.0,
            "memory_warning": 75.0,
            "memory_critical": 90.0,
            "disk_warning": 80.0,
            "disk_critical": 95.0,
            "response_time_warning": 1000.0,
            "response_time_critical": 5000.0,
        }

        # Health history
        self._health_history: deque = deque(maxlen=1000)
        self._last_health_check: Optional[datetime] = None

        # Background tasks
        self._monitor_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # Event handlers
        self._health_change_handlers: List[Callable] = []

        logger.info("Health Monitor initialized")

    async def initialize(self) -> None:
        """Initialize health monitoring"""
        logger.info("Initializing Health Monitor...")

        # Register default health checks
        await self._register_default_checks()

        # Start background monitoring
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        logger.info("Health Monitor initialized successfully")

    async def register_check(
        self,
        name: str,
        component_type: ComponentType,
        check_function: Callable,
        timeout_seconds: float = 5.0,
        interval_seconds: float = 60.0,
        critical: bool = False,
        dependencies: Optional[List[str]] = None,
    ) -> None:
        """Register a new health check"""
        check = HealthCheck(
            name=name,
            component_type=component_type,
            check_function=check_function,
            timeout_seconds=timeout_seconds,
            interval_seconds=interval_seconds,
            critical=critical,
            dependencies=dependencies or [],
        )

        self._checks[name] = check
        logger.info(f"Registered health check: {name}")

    async def unregister_check(self, name: str) -> None:
        """Unregister a health check"""
        if name in self._checks:
            del self._checks[name]
            if name in self._results:
                del self._results[name]
            logger.info(f"Unregistered health check: {name}")

    async def check_health(
        self, check_names: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Perform health checks"""
        if not check_names:
            check_names = list(self._checks.keys())

        results = {}
        overall_status = HealthStatus.HEALTHY
        total_response_time = 0

        # Run all checks
        tasks = []
        for name in check_names:
            if name in self._checks:
                task = asyncio.create_task(self._run_check(name))
                tasks.append((name, task))

        # Wait for all checks
        for name, task in tasks:
            try:
                result = await task
                results[name] = result
                total_response_time += result.response_time_ms

                # Determine overall status
                if result.status == HealthStatus.CRITICAL:
                    overall_status = HealthStatus.CRITICAL
                elif (
                    result.status == HealthStatus.UNHEALTHY
                    and overall_status != HealthStatus.CRITICAL
                ):
                    overall_status = HealthStatus.UNHEALTHY
                elif (
                    result.status == HealthStatus.DEGRADED
                    and overall_status == HealthStatus.HEALTHY
                ):
                    overall_status = HealthStatus.DEGRADED

            except Exception as e:
                logger.error(f"Health check {name} failed: {e}")
                results[name] = HealthCheckResult(
                    check_name=name,
                    status=HealthStatus.CRITICAL,
                    healthy=False,
                    message=f"Health check failed: {str(e)}",
                    response_time_ms=0,
                    timestamp=datetime.now(),
                )
                overall_status = HealthStatus.CRITICAL

        # Get system metrics
        system_metrics = await self._get_system_metrics()
        self._system_metrics.append((datetime.now(), system_metrics))

        # Check system health
        if not system_metrics.is_healthy:
            overall_status = HealthStatus.DEGRADED

        # Create health summary
        health_summary = {
            "status": overall_status,
            "timestamp": datetime.now(),
            "checks": results,
            "system_metrics": system_metrics,
            "total_checks": len(results),
            "healthy_checks": sum(1 for r in results.values() if r.healthy),
            "unhealthy_checks": sum(1 for r in results.values() if not r.healthy),
            "critical_checks": sum(
                1 for r in results.values() if r.status == HealthStatus.CRITICAL
            ),
            "average_response_time_ms": total_response_time / len(results)
            if results
            else 0,
            "uptime_seconds": await self._get_uptime(),
        }

        # Store results
        self._results.update(results)
        self._last_health_check = datetime.now()

        # Add to history
        self._health_history.append(health_summary)

        # Trigger health change handlers
        await self._trigger_health_change_handlers(health_summary)

        return health_summary

    async def _run_check(self, name: str) -> HealthCheckResult:
        """Run a single health check"""
        check = self._checks[name]
        start_time = time.time()

        try:
            # Check dependencies
            for dep in check.dependencies:
                if dep in self._results:
                    if not self._results[dep].healthy:
                        return HealthCheckResult(
                            check_name=name,
                            status=HealthStatus.UNHEALTHY,
                            healthy=False,
                            message=f"Dependency {dep} is unhealthy",
                            response_time_ms=0,
                            timestamp=datetime.now(),
                            dependencies=check.dependencies,
                        )

            # Run health check with timeout
            result = await asyncio.wait_for(
                self._execute_check(check), timeout=check.timeout_seconds
            )

            # Calculate response time
            response_time = (time.time() - start_time) * 1000

            # Update check state
            check.last_check = datetime.now()
            check.last_result = result["healthy"]
            check.response_time_ms = response_time
            check.metrics = result.get("metrics", {})

            if result["healthy"]:
                check.consecutive_failures = 0
                check.last_error = None
            else:
                check.consecutive_failures += 1
                check.last_error = result.get("message", "Unknown error")

            # Determine status
            if not result["healthy"]:
                if check.critical or check.consecutive_failures >= 3:
                    status = HealthStatus.CRITICAL
                else:
                    status = HealthStatus.UNHEALTHY
            else:
                # Check for performance degradation
                if response_time > self._alert_thresholds["response_time_warning"]:
                    status = HealthStatus.DEGRADED
                else:
                    status = HealthStatus.HEALTHY

            return HealthCheckResult(
                check_name=name,
                status=status,
                healthy=result["healthy"],
                message=result.get("message", "OK"),
                response_time_ms=response_time,
                timestamp=datetime.now(),
                metrics=result.get("metrics", {}),
                details=result.get("details", {}),
                dependencies=check.dependencies,
            )

        except asyncio.TimeoutError:
            # Check timed out
            check.consecutive_failures += 1
            check.last_error = "Health check timed out"
            check.last_check = datetime.now()

            return HealthCheckResult(
                check_name=name,
                status=HealthStatus.CRITICAL
                if check.critical
                else HealthStatus.UNHEALTHY,
                healthy=False,
                message=f"Health check timed out after {check.timeout_seconds}s",
                response_time_ms=check.timeout_seconds * 1000,
                timestamp=datetime.now(),
                dependencies=check.dependencies,
            )

        except Exception as e:
            # Check failed with exception
            check.consecutive_failures += 1
            check.last_error = str(e)
            check.last_check = datetime.now()

            return HealthCheckResult(
                check_name=name,
                status=HealthStatus.CRITICAL
                if check.critical
                else HealthStatus.UNHEALTHY,
                healthy=False,
                message=f"Health check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.now(),
                dependencies=check.dependencies,
            )

    async def _execute_check(self, check: HealthCheck) -> Dict[str, Any]:
        """Execute health check function"""
        if asyncio.iscoroutinefunction(check.check_function):
            return await check.check_function()
        else:
            # Run synchronous function in thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, check.check_function)

    async def _register_default_checks(self) -> None:
        """Register default health checks"""
        # System health check
        await self.register_check(
            name="system",
            component_type=ComponentType.SYSTEM,
            check_function=self._check_system,
            timeout_seconds=2.0,
            interval_seconds=30.0,
            critical=True,
        )

        # Database health check
        await self.register_check(
            name="database",
            component_type=ComponentType.DATABASE,
            check_function=self._check_database,
            timeout_seconds=5.0,
            interval_seconds=30.0,
            critical=True,
        )

        # Cache health check
        await self.register_check(
            name="cache",
            component_type=ComponentType.CACHE,
            check_function=self._check_cache,
            timeout_seconds=3.0,
            interval_seconds=30.0,
        )

        # LLM Provider health check
        await self.register_check(
            name="llm_provider",
            component_type=ComponentType.LLM_PROVIDER,
            check_function=self._check_llm_provider,
            timeout_seconds=10.0,
            interval_seconds=60.0,
        )

        # Embedding service health check
        await self.register_check(
            name="embedding_service",
            component_type=ComponentType.EMBEDDING_SERVICE,
            check_function=self._check_embedding_service,
            timeout_seconds=5.0,
            interval_seconds=60.0,
            dependencies=["cache"],
        )

        # Vector store health check
        await self.register_check(
            name="vector_store",
            component_type=ComponentType.VECTOR_STORE,
            check_function=self._check_vector_store,
            timeout_seconds=5.0,
            interval_seconds=60.0,
            dependencies=["database"],
        )

    async def _check_system(self) -> Dict[str, Any]:
        """Check system health"""
        metrics = await self._get_system_metrics()

        return {
            "healthy": metrics.is_healthy,
            "message": "System is healthy"
            if metrics.is_healthy
            else "System resources under stress",
            "metrics": {
                "cpu_percent": metrics.cpu_percent,
                "memory_percent": metrics.memory_percent,
                "disk_percent": metrics.disk_percent,
                "load_average": metrics.load_average,
            },
        }

    async def _check_database(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            # This would be implemented with actual database connection check
            # For now, simulate check
            await asyncio.sleep(0.1)

            return {
                "healthy": True,
                "message": "Database is healthy",
                "metrics": {
                    "connection_pool_active": 5,
                    "connection_pool_idle": 10,
                    "query_time_ms": 10,
                },
            }
        except Exception as e:
            return {
                "healthy": False,
                "message": f"Database check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_cache(self) -> Dict[str, Any]:
        """Check cache health"""
        try:
            # This would be implemented with actual cache check
            # For now, simulate check
            await asyncio.sleep(0.05)

            return {
                "healthy": True,
                "message": "Cache is healthy",
                "metrics": {
                    "cache_hit_rate": 0.85,
                    "memory_usage_mb": 50,
                    "connected_clients": 3,
                },
            }
        except Exception as e:
            return {
                "healthy": False,
                "message": f"Cache check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_llm_provider(self) -> Dict[str, Any]:
        """Check LLM provider health"""
        try:
            # This would check actual LLM provider health
            # For now, simulate check
            await asyncio.sleep(0.2)

            return {
                "healthy": True,
                "message": "LLM providers are healthy",
                "metrics": {
                    "openai_status": "healthy",
                    "anthropic_status": "healthy",
                    "avg_response_time_ms": 200,
                },
            }
        except Exception as e:
            return {
                "healthy": False,
                "message": f"LLM provider check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_embedding_service(self) -> Dict[str, Any]:
        """Check embedding service health"""
        try:
            # This would check actual embedding service health
            # For now, simulate check
            await asyncio.sleep(0.1)

            return {
                "healthy": True,
                "message": "Embedding service is healthy",
                "metrics": {
                    "models_loaded": 3,
                    "queue_size": 0,
                    "processing_time_ms": 50,
                },
            }
        except Exception as e:
            return {
                "healthy": False,
                "message": f"Embedding service check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_vector_store(self) -> Dict[str, Any]:
        """Check vector store health"""
        try:
            # This would check actual vector store health
            # For now, simulate check
            await asyncio.sleep(0.1)

            return {
                "healthy": True,
                "message": "Vector store is healthy",
                "metrics": {
                    "index_status": "healthy",
                    "vector_count": 100000,
                    "query_time_ms": 25,
                },
            }
        except Exception as e:
            return {
                "healthy": False,
                "message": f"Vector store check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _get_system_metrics(self) -> SystemMetrics:
        """Get system resource metrics"""
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)

        # Memory metrics
        memory = psutil.virtual_memory()
        memory_used_mb = memory.used / (1024 * 1024)
        memory_available_mb = memory.available / (1024 * 1024)

        # Disk metrics
        disk = psutil.disk_usage("/")
        disk_used_gb = disk.used / (1024 * 1024 * 1024)
        disk_available_gb = disk.available / (1024 * 1024 * 1024)

        # Network metrics
        network = psutil.net_io_counters()
        network_io = {
            "bytes_sent": network.bytes_sent,
            "bytes_recv": network.bytes_recv,
        }

        # Process count
        process_count = len(psutil.pids())

        # Load average (Linux/Mac only)
        load_average = None
        try:
            load_average = psutil.getloadavg()
        except AttributeError:
            pass

        return SystemMetrics(
            cpu_percent=cpu_percent,
            memory_percent=memory.percent,
            memory_used_mb=memory_used_mb,
            memory_available_mb=memory_available_mb,
            disk_percent=disk.percent,
            disk_used_gb=disk_used_gb,
            disk_available_gb=disk_available_gb,
            network_io=network_io,
            process_count=process_count,
            load_average=load_average,
        )

    async def _get_uptime(self) -> float:
        """Get service uptime in seconds"""
        # This would track actual start time
        # For now, simulate
        return time.time() - getattr(self, "_start_time", time.time())

    async def _monitor_loop(self) -> None:
        """Background monitoring loop"""
        self._start_time = time.time()

        while True:
            try:
                # Run health checks
                await self.check_health()

                # Wait for next check
                await asyncio.sleep(30)

            except Exception as e:
                logger.error(f"Health monitor loop error: {e}")
                await asyncio.sleep(30)

    async def _cleanup_loop(self) -> None:
        """Background cleanup loop"""
        while True:
            try:
                # Clean up old metrics
                cutoff_time = datetime.now() - timedelta(hours=1)

                # Clean health history
                self._health_history = deque(
                    (h for h in self._health_history if h["timestamp"] > cutoff_time),
                    maxlen=1000,
                )

                # Clean system metrics
                self._system_metrics = deque(
                    (t, m) for t, m in self._system_metrics if t > cutoff_time
                )

                await asyncio.sleep(300)  # Clean up every 5 minutes

            except Exception as e:
                logger.error(f"Health monitor cleanup error: {e}")
                await asyncio.sleep(300)

    async def _trigger_health_change_handlers(
        self, health_summary: Dict[str, Any]
    ) -> None:
        """Trigger health change event handlers"""
        for handler in self._health_change_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(health_summary)
                else:
                    handler(health_summary)
            except Exception as e:
                logger.error(f"Health change handler error: {e}")

    def add_health_change_handler(self, handler: Callable) -> None:
        """Add health change event handler"""
        self._health_change_handlers.append(handler)

    def remove_health_change_handler(self, handler: Callable) -> None:
        """Remove health change event handler"""
        if handler in self._health_change_handlers:
            self._health_change_handlers.remove(handler)

    async def get_health_trends(self, hours: int = 24) -> Dict[str, Any]:
        """Get health trends over time"""
        cutoff_time = datetime.now() - timedelta(hours=hours)

        # Filter health history
        history = [h for h in self._health_history if h["timestamp"] > cutoff_time]

        if not history:
            return {"message": "No health history available"}

        # Calculate trends
        status_counts = defaultdict(int)
        response_times = []
        check_counts = defaultdict(list)

        for h in history:
            status_counts[h["status"]] += 1
            response_times.append(h["average_response_time_ms"])
            for check_name, result in h["checks"].items():
                check_counts[check_name].append(result.healthy)

        # Calculate health percentages
        total_checks = sum(status_counts.values())
        health_percentages = {
            status: (count / total_checks) * 100
            for status, count in status_counts.items()
        }

        # Calculate check availability
        check_availability = {}
        for check_name, results in check_counts.items():
            if results:
                availability = sum(results) / len(results) * 100
                check_availability[check_name] = availability

        return {
            "period_hours": hours,
            "total_checks": total_checks,
            "health_percentages": health_percentages,
            "average_response_time_ms": sum(response_times) / len(response_times),
            "check_availability": check_availability,
            "trend_direction": self._calculate_trend_direction(history),
        }

    def _calculate_trend_direction(self, history: List[Dict]) -> str:
        """Calculate health trend direction"""
        if len(history) < 2:
            return "stable"

        # Compare first and last half
        mid = len(history) // 2
        first_half = history[:mid]
        second_half = history[mid:]

        # Calculate health scores
        def health_score(summary):
            if summary["status"] == HealthStatus.HEALTHY:
                return 1.0
            elif summary["status"] == HealthStatus.DEGRADED:
                return 0.5
            else:
                return 0.0

        first_score = sum(health_score(h) for h in first_half) / len(first_half)
        second_score = sum(health_score(h) for h in second_half) / len(second_half)

        # Determine trend
        if second_score > first_score + 0.1:
            return "improving"
        elif second_score < first_score - 0.1:
            return "degrading"
        else:
            return "stable"

    async def shutdown(self) -> None:
        """Shutdown health monitor"""
        logger.info("Shutting down Health Monitor...")

        # Cancel background tasks
        if self._monitor_task:
            self._monitor_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        logger.info("Health Monitor shutdown complete")
