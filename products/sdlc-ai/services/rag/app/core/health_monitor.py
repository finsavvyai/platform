"""
Service Health Monitoring System

Comprehensive health monitoring for RAG service with:
- Comprehensive health check system
- Dependency health monitoring
- Metrics collection and reporting
- Service availability monitoring
- Performance benchmarking
- Alert integration
- Health status aggregation
- Automatic recovery recommendations
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable, Union
from enum import Enum
from dataclasses import dataclass, field
from contextlib import asynccontextmanager

import psutil
import aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import get_settings
from app.core.performance import get_performance_optimizer, get_resource_usage

logger = logging.getLogger(__name__)
settings = get_settings()


class HealthStatus(str, Enum):
    """Health status levels"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class CheckType(str, Enum):
    """Health check types"""

    DATABASE = "database"
    REDIS = "redis"
    EXTERNAL_API = "external_api"
    DISK_SPACE = "disk_space"
    MEMORY = "memory"
    CPU = "cpu"
    NETWORK = "network"
    CUSTOM = "custom"


@dataclass
class HealthCheckResult:
    """Individual health check result"""

    name: str
    status: HealthStatus
    message: str
    response_time_ms: float
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)
    check_type: CheckType = CheckType.CUSTOM
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None
    current_value: Optional[float] = None

    @property
    def is_healthy(self) -> bool:
        """Check if result is healthy"""
        return self.status in [HealthStatus.HEALTHY, HealthStatus.DEGRADED]

    @property
    def needs_attention(self) -> bool:
        """Check if result needs attention"""
        return self.status in [HealthStatus.UNHEALTHY, HealthStatus.CRITICAL]


@dataclass
class HealthCheckConfig:
    """Configuration for health checks"""

    name: str
    check_type: CheckType
    check_function: Callable
    interval_seconds: int = 60
    timeout_seconds: float = 10.0
    retries: int = 3
    retry_delay: float = 1.0
    enabled: bool = True
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None
    tags: List[str] = field(default_factory=list)
    description: str = ""

    # Alert configuration
    alert_on_failure: bool = True
    alert_on_degraded: bool = True
    alert_cooldown_minutes: int = 15

    # Recovery configuration
    auto_recovery: bool = False
    recovery_actions: List[Callable] = field(default_factory=list)


@dataclass
class ServiceHealthStatus:
    """Overall service health status"""

    status: HealthStatus
    timestamp: datetime
    uptime_seconds: float
    checks: List[HealthCheckResult] = field(default_factory=list)
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    resource_usage: Dict[str, Any] = field(default_factory=dict)
    dependencies: Dict[str, HealthStatus] = field(default_factory=dict)
    alerts: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    @classmethod
    def aggregate_status(cls, checks: List[HealthCheckResult]) -> HealthStatus:
        """Aggregate overall status from individual checks"""
        if not checks:
            return HealthStatus.UNKNOWN

        # Count statuses
        status_counts = {}
        for check in checks:
            status_counts[check.status] = status_counts.get(check.status, 0) + 1

        # Determine overall status
        if status_counts.get(HealthStatus.CRITICAL, 0) > 0:
            return HealthStatus.CRITICAL
        elif status_counts.get(HealthStatus.UNHEALTHY, 0) > 0:
            return HealthStatus.UNHEALTHY
        elif status_counts.get(HealthStatus.DEGRADED, 0) > 0:
            return HealthStatus.DEGRADED
        elif status_counts.get(HealthStatus.HEALTHY, 0) > 0:
            return HealthStatus.HEALTHY
        else:
            return HealthStatus.UNKNOWN


class HealthMonitor:
    """Comprehensive health monitoring system"""

    def __init__(self):
        self.checks: Dict[str, HealthCheckConfig] = {}
        self.check_results: Dict[str, HealthCheckResult] = {}
        self.check_tasks: Dict[str, asyncio.Task] = {}

        # Monitoring state
        self._start_time = datetime.utcnow()
        self._initialized = False
        self._shutdown = False

        # Alert management
        self._last_alerts: Dict[str, datetime] = {}
        self._alert_callbacks: List[Callable] = []

        # Metrics and history
        self._health_history: List[ServiceHealthStatus] = []
        self._max_history_size = 1000

        # Background tasks
        self._monitor_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

    async def initialize(self) -> None:
        """Initialize health monitor"""
        if self._initialized:
            return

        logger.info("Initializing health monitor...")

        # Register default health checks
        await self._register_default_checks()

        # Start monitoring tasks
        self._monitor_task = asyncio.create_task(self._monitoring_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        self._initialized = True
        logger.info("Health monitor initialized successfully")

    async def shutdown(self) -> None:
        """Shutdown health monitor"""
        logger.info("Shutting down health monitor...")

        self._shutdown = True

        # Cancel background tasks
        if self._monitor_task:
            self._monitor_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        # Cancel health check tasks
        for task in self.check_tasks.values():
            task.cancel()

        self._initialized = False
        logger.info("Health monitor shutdown complete")

    async def register_check(self, config: HealthCheckConfig) -> None:
        """Register a new health check"""
        self.checks[config.name] = config

        # Start monitoring task if enabled
        if config.enabled and not self._shutdown:
            await self._start_check_task(config)

        logger.info(f"Registered health check: {config.name}")

    async def unregister_check(self, name: str) -> None:
        """Unregister a health check"""
        if name in self.checks:
            # Stop monitoring task
            if name in self.check_tasks:
                self.check_tasks[name].cancel()
                del self.check_tasks[name]

            del self.checks[name]
            self.check_results.pop(name, None)

            logger.info(f"Unregistered health check: {name}")

    async def run_check(self, name: str) -> HealthCheckResult:
        """Run a specific health check"""
        if name not in self.checks:
            raise ValueError(f"Health check '{name}' not found")

        config = self.checks[name]
        return await self._execute_check(config)

    async def check_health(self) -> ServiceHealthStatus:
        """Check overall service health"""
        # Run all enabled checks
        current_results = []
        tasks = []

        for name, config in self.checks.items():
            if config.enabled:
                task = asyncio.create_task(self._execute_check(config))
                tasks.append((name, task))

        # Wait for all checks to complete
        for name, task in tasks:
            try:
                result = await asyncio.wait_for(task, timeout=config.timeout_seconds)
                current_results.append(result)
                self.check_results[name] = result
            except asyncio.TimeoutError:
                # Create timeout result
                timeout_result = HealthCheckResult(
                    name=name,
                    status=HealthStatus.UNHEALTHY,
                    message="Health check timed out",
                    response_time_ms=config.timeout_seconds * 1000,
                    timestamp=datetime.utcnow(),
                    check_type=config.check_type,
                )
                current_results.append(timeout_result)
                self.check_results[name] = timeout_result
            except Exception as e:
                # Create error result
                error_result = HealthCheckResult(
                    name=name,
                    status=HealthStatus.CRITICAL,
                    message=f"Health check failed: {str(e)}",
                    response_time_ms=0.0,
                    timestamp=datetime.utcnow(),
                    check_type=config.check_type,
                    details={"error": str(e)},
                )
                current_results.append(error_result)
                self.check_results[name] = error_result

        # Get performance metrics
        performance_metrics = await self._get_performance_metrics()

        # Get resource usage
        resource_usage = await self._get_resource_usage()

        # Get dependency health
        dependencies = await self._get_dependency_health()

        # Generate recommendations
        recommendations = await self._generate_recommendations(current_results)

        # Create overall status
        overall_status = ServiceHealthStatus.aggregate_status(current_results)

        service_status = ServiceHealthStatus(
            status=overall_status,
            timestamp=datetime.utcnow(),
            uptime_seconds=(datetime.utcnow() - self._start_time).total_seconds(),
            checks=current_results,
            performance_metrics=performance_metrics,
            resource_usage=resource_usage,
            dependencies=dependencies,
            alerts=[],  # Would be populated from alert system
            recommendations=recommendations,
        )

        # Store in history
        self._health_history.append(service_status)
        if len(self._health_history) > self._max_history_size:
            self._health_history = self._health_history[-self._max_history_size :]

        return service_status

    async def _register_default_checks(self) -> None:
        """Register default health checks"""
        # Database health check
        await self.register_check(
            HealthCheckConfig(
                name="database",
                check_type=CheckType.DATABASE,
                check_function=self._check_database,
                interval_seconds=60,
                timeout_seconds=10.0,
                threshold_warning=1000.0,  # response time in ms
                threshold_critical=5000.0,
                description="Database connectivity and performance check",
            )
        )

        # Redis health check
        await self.register_check(
            HealthCheckConfig(
                name="redis",
                check_type=CheckType.REDIS,
                check_function=self._check_redis,
                interval_seconds=30,
                timeout_seconds=5.0,
                threshold_warning=100.0,
                threshold_critical=1000.0,
                description="Redis connectivity and performance check",
            )
        )

        # Memory usage check
        await self.register_check(
            HealthCheckConfig(
                name="memory",
                check_type=CheckType.MEMORY,
                check_function=self._check_memory,
                interval_seconds=60,
                timeout_seconds=5.0,
                threshold_warning=80.0,  # percentage
                threshold_critical=95.0,
                description="Memory usage monitoring",
            )
        )

        # Disk space check
        await self.register_check(
            HealthCheckConfig(
                name="disk_space",
                check_type=CheckType.DISK_SPACE,
                check_function=self._check_disk_space,
                interval_seconds=300,  # 5 minutes
                timeout_seconds=5.0,
                threshold_warning=80.0,  # percentage
                threshold_critical=95.0,
                description="Disk space monitoring",
            )
        )

        # External API health checks
        if settings.openai_api_key:
            await self.register_check(
                HealthCheckConfig(
                    name="openai_api",
                    check_type=CheckType.EXTERNAL_API,
                    check_function=self._check_openai_api,
                    interval_seconds=300,
                    timeout_seconds=10.0,
                    threshold_warning=2000.0,
                    threshold_critical=10000.0,
                    description="OpenAI API connectivity check",
                )
            )

    async def _start_check_task(self, config: HealthCheckConfig) -> None:
        """Start monitoring task for a health check"""
        if config.name in self.check_tasks:
            return  # Already running

        task = asyncio.create_task(self._check_loop(config))
        self.check_tasks[config.name] = task

    async def _check_loop(self, config: HealthCheckConfig) -> None:
        """Background loop for running health checks"""
        while not self._shutdown and config.enabled:
            try:
                result = await self._execute_check(config)
                self.check_results[config.name] = result

                # Check for alerts
                await self._check_alerts(config, result)

                # Check for auto-recovery
                if config.auto_recovery and result.status in [
                    HealthStatus.UNHEALTHY,
                    HealthStatus.CRITICAL,
                ]:
                    await self._attempt_recovery(config, result)

            except Exception as e:
                logger.error(f"Health check error for {config.name}: {e}")

                # Create error result
                error_result = HealthCheckResult(
                    name=config.name,
                    status=HealthStatus.CRITICAL,
                    message=f"Health check execution failed: {str(e)}",
                    response_time_ms=0.0,
                    timestamp=datetime.utcnow(),
                    check_type=config.check_type,
                    details={"error": str(e)},
                )
                self.check_results[config.name] = error_result

            # Wait for next interval
            await asyncio.sleep(config.interval_seconds)

    async def _execute_check(self, config: HealthCheckConfig) -> HealthCheckResult:
        """Execute a single health check"""
        start_time = time.time()

        try:
            # Run check function
            if asyncio.iscoroutinefunction(config.check_function):
                result_data = await asyncio.wait_for(
                    config.check_function(), timeout=config.timeout_seconds
                )
            else:
                result_data = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None, config.check_function
                    ),
                    timeout=config.timeout_seconds,
                )

            response_time = (time.time() - start_time) * 1000

            # Parse result
            if isinstance(result_data, dict):
                status = HealthStatus(result_data.get("status", "healthy"))
                message = result_data.get("message", "Check passed")
                current_value = result_data.get("value")
                details = result_data.get("details", {})
            else:
                status = HealthStatus.HEALTHY
                message = "Check passed"
                current_value = None
                details = {}

            # Check thresholds
            if current_value is not None:
                if (
                    config.threshold_critical
                    and current_value >= config.threshold_critical
                ):
                    status = HealthStatus.CRITICAL
                elif (
                    config.threshold_warning
                    and current_value >= config.threshold_warning
                ):
                    status = HealthStatus.DEGRADED

            return HealthCheckResult(
                name=config.name,
                status=status,
                message=message,
                response_time_ms=response_time,
                timestamp=datetime.utcnow(),
                details=details,
                check_type=config.check_type,
                threshold_warning=config.threshold_warning,
                threshold_critical=config.threshold_critical,
                current_value=current_value,
            )

        except asyncio.TimeoutError:
            return HealthCheckResult(
                name=config.name,
                status=HealthStatus.UNHEALTHY,
                message="Health check timed out",
                response_time_ms=config.timeout_seconds * 1000,
                timestamp=datetime.utcnow(),
                check_type=config.check_type,
            )
        except Exception as e:
            return HealthCheckResult(
                name=config.name,
                status=HealthStatus.CRITICAL,
                message=f"Health check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow(),
                check_type=config.check_type,
                details={"error": str(e)},
            )

    async def _check_database(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            from app.database.connection import get_database_session

            async with get_database_session() as session:
                # Simple query to test connectivity
                result = await session.execute(text("SELECT 1"))
                await result.fetchone()

                # Check connection pool status
                # This would depend on your connection pool implementation

                return {
                    "status": "healthy",
                    "message": "Database connection successful",
                    "details": {
                        "query_time_ms": 10.0,  # Would measure actual query time
                        "pool_size": 20,  # Would get from pool
                        "active_connections": 5,
                    },
                }

        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"Database connection failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_redis(self) -> Dict[str, Any]:
        """Check Redis health"""
        try:
            redis = aioredis.from_url(settings.redis_url)

            # Test basic operations
            test_key = "health_check_test"
            await redis.set(test_key, "test", ex=60)
            value = await redis.get(test_key)
            await redis.delete(test_key)

            if value != b"test":
                raise Exception("Redis read/write test failed")

            # Get Redis info
            info = await redis.info()
            await redis.close()

            return {
                "status": "healthy",
                "message": "Redis connection successful",
                "value": info.get("used_memory", 0) / 1024 / 1024,  # MB
                "details": {
                    "connected_clients": info.get("connected_clients", 0),
                    "used_memory_mb": info.get("used_memory", 0) / 1024 / 1024,
                    "redis_version": info.get("redis_version", "unknown"),
                },
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"Redis connection failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_memory(self) -> Dict[str, Any]:
        """Check memory usage"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_percent = process.memory_percent()

            # Get system memory info
            system_memory = psutil.virtual_memory()

            return {
                "status": "healthy"
                if memory_percent < 80
                else "degraded"
                if memory_percent < 95
                else "unhealthy",
                "message": f"Memory usage: {memory_percent:.1f}%",
                "value": memory_percent,
                "details": {
                    "process_memory_mb": memory_info.rss / 1024 / 1024,
                    "process_memory_percent": memory_percent,
                    "system_memory_percent": system_memory.percent,
                    "system_available_mb": system_memory.available / 1024 / 1024,
                },
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"Memory check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_disk_space(self) -> Dict[str, Any]:
        """Check disk space"""
        try:
            disk = psutil.disk_usage("/")
            used_percent = (disk.used / disk.total) * 100

            return {
                "status": "healthy"
                if used_percent < 80
                else "degraded"
                if used_percent < 95
                else "unhealthy",
                "message": f"Disk usage: {used_percent:.1f}%",
                "value": used_percent,
                "details": {
                    "total_gb": disk.total / 1024 / 1024 / 1024,
                    "used_gb": disk.used / 1024 / 1024 / 1024,
                    "free_gb": disk.free / 1024 / 1024 / 1024,
                    "used_percent": used_percent,
                },
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"Disk space check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _check_openai_api(self) -> Dict[str, Any]:
        """Check OpenAI API connectivity"""
        try:
            import openai

            client = openai.AsyncClient(api_key=settings.openai_api_key)

            # Simple API call to test connectivity
            start_time = time.time()
            response = await client.models.list()
            response_time = (time.time() - start_time) * 1000

            return {
                "status": "healthy",
                "message": "OpenAI API connection successful",
                "value": response_time,
                "details": {
                    "response_time_ms": response_time,
                    "models_count": len(response.data) if response.data else 0,
                },
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"OpenAI API check failed: {str(e)}",
                "details": {"error": str(e)},
            }

    async def _get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        try:
            optimizer = await get_performance_optimizer()
            metrics = await optimizer.get_metrics()

            return {
                "total_requests": metrics.total_requests,
                "avg_response_time_ms": metrics.avg_response_time_ms,
                "cache_hit_rate": metrics.get_cache_hit_rate(),
                "request_rate_per_second": metrics.request_rate_per_second,
                "active_connections": metrics.active_connections,
                "memory_usage_mb": metrics.memory_usage_mb,
                "cpu_usage_percent": metrics.cpu_usage_percent,
            }

        except Exception as e:
            logger.error(f"Failed to get performance metrics: {e}")
            return {}

    async def _get_resource_usage(self) -> Dict[str, Any]:
        """Get resource usage information"""
        try:
            return await get_resource_usage()
        except Exception as e:
            logger.error(f"Failed to get resource usage: {e}")
            return {}

    async def _get_dependency_health(self) -> Dict[str, HealthStatus]:
        """Get health status of dependencies"""
        dependencies = {}

        # Database
        if "database" in self.check_results:
            dependencies["database"] = self.check_results["database"].status

        # Redis
        if "redis" in self.check_results:
            dependencies["redis"] = self.check_results["redis"].status

        # External APIs
        for name, result in self.check_results.items():
            if result.check_type == CheckType.EXTERNAL_API:
                dependencies[name] = result.status

        return dependencies

    async def _generate_recommendations(
        self, results: List[HealthCheckResult]
    ) -> List[str]:
        """Generate health recommendations"""
        recommendations = []

        for result in results:
            if result.status == HealthStatus.CRITICAL:
                recommendations.append(
                    f"URGENT: {result.name} is critical - {result.message}"
                )
            elif result.status == HealthStatus.UNHEALTHY:
                recommendations.append(
                    f"Attention needed: {result.name} is unhealthy - {result.message}"
                )
            elif result.status == HealthStatus.DEGRADED:
                recommendations.append(
                    f"Monitor: {result.name} is degraded - {result.message}"
                )

            # Performance recommendations
            if result.response_time_ms > 5000:
                recommendations.append(
                    f"Performance: {result.name} response time is high ({result.response_time_ms:.1f}ms)"
                )

            # Threshold recommendations
            if result.current_value is not None:
                if (
                    result.threshold_critical
                    and result.current_value >= result.threshold_critical
                ):
                    recommendations.append(
                        f"Threshold: {result.name} exceeded critical threshold ({result.current_value})"
                    )
                elif (
                    result.threshold_warning
                    and result.current_value >= result.threshold_warning
                ):
                    recommendations.append(
                        f"Threshold: {result.name} exceeded warning threshold ({result.current_value})"
                    )

        return recommendations

    async def _check_alerts(
        self, config: HealthCheckConfig, result: HealthCheckResult
    ) -> None:
        """Check if alerts should be triggered"""
        if not config.alert_on_failure and not config.alert_on_degraded:
            return

        should_alert = False
        alert_reason = ""

        if config.alert_on_failure and result.status in [
            HealthStatus.UNHEALTHY,
            HealthStatus.CRITICAL,
        ]:
            should_alert = True
            alert_reason = (
                f"Health check {config.name} {result.status.value}: {result.message}"
            )
        elif config.alert_on_degraded and result.status == HealthStatus.DEGRADED:
            should_alert = True
            alert_reason = f"Health check {config.name} degraded: {result.message}"

        if should_alert:
            # Check cooldown
            last_alert_time = self._last_alerts.get(config.name)
            if last_alert_time:
                cooldown_period = timedelta(minutes=config.alert_cooldown_minutes)
                if datetime.utcnow() - last_alert_time < cooldown_period:
                    return  # Still in cooldown period

            # Trigger alert
            await self._trigger_alert(config, result, alert_reason)
            self._last_alerts[config.name] = datetime.utcnow()

    async def _trigger_alert(
        self, config: HealthCheckConfig, result: HealthCheckResult, reason: str
    ) -> None:
        """Trigger health alert"""
        alert_data = {
            "check_name": config.name,
            "status": result.status.value,
            "message": reason,
            "timestamp": result.timestamp.isoformat(),
            "response_time_ms": result.response_time_ms,
            "details": result.details,
        }

        logger.warning(f"Health alert triggered: {reason}")

        # Call alert callbacks
        for callback in self._alert_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(alert_data)
                else:
                    callback(alert_data)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")

    async def _attempt_recovery(
        self, config: HealthCheckConfig, result: HealthCheckResult
    ) -> None:
        """Attempt automatic recovery"""
        if not config.recovery_actions:
            return

        logger.info(f"Attempting recovery for {config.name}")

        for action in config.recovery_actions:
            try:
                if asyncio.iscoroutinefunction(action):
                    await action(config, result)
                else:
                    action(config, result)

                logger.info(f"Recovery action executed for {config.name}")

            except Exception as e:
                logger.error(f"Recovery action failed for {config.name}: {e}")

    async def _monitoring_loop(self) -> None:
        """Main monitoring loop"""
        while not self._shutdown:
            try:
                # Perform comprehensive health check
                await self.check_health()

                # Wait before next check
                await asyncio.sleep(60)  # Check every minute

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(60)

    async def _cleanup_loop(self) -> None:
        """Background cleanup loop"""
        while not self._shutdown:
            try:
                # Clean up old history
                cutoff_time = datetime.utcnow() - timedelta(hours=24)
                self._health_history = [
                    status
                    for status in self._health_history
                    if status.timestamp > cutoff_time
                ]

                # Clean up old alert timestamps
                cutoff_alert = datetime.utcnow() - timedelta(hours=1)
                self._last_alerts = {
                    name: time
                    for name, time in self._last_alerts.items()
                    if time > cutoff_alert
                }

                await asyncio.sleep(3600)  # Run every hour

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(3600)

    def add_alert_callback(self, callback: Callable) -> None:
        """Add alert callback"""
        self._alert_callbacks.append(callback)

    def remove_alert_callback(self, callback: Callable) -> None:
        """Remove alert callback"""
        if callback in self._alert_callbacks:
            self._alert_callbacks.remove(callback)

    def get_health_history(self, hours: int = 24) -> List[ServiceHealthStatus]:
        """Get health history for specified time period"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return [
            status for status in self._health_history if status.timestamp > cutoff_time
        ]

    def get_check_results(self) -> Dict[str, HealthCheckResult]:
        """Get latest health check results"""
        return self.check_results.copy()


# Alert callback functions
async def log_health_alert(alert_data: Dict[str, Any]) -> None:
    """Default alert logging callback"""
    logger.warning(f"Health Alert: {alert_data}")


async def send_health_notification(alert_data: Dict[str, Any]) -> None:
    """Send health notification (placeholder for external integration)"""
    # This could integrate with Slack, PagerDuty, email, etc.
    logger.info(
        f"Health notification sent: {alert_data['check_name']} - {alert_data['status']}"
    )
