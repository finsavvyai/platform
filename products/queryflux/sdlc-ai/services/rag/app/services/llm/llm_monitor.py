"""
LLM Monitoring Service.

This module provides comprehensive monitoring for LLM operations including
performance metrics, health monitoring, error tracking, and alerting.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from collections import defaultdict, deque

from .base_provider import ProviderStatus
from .cost_tracker import CostTracker
from .llm_manager import LLMManager

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class MetricType(Enum):
    """Types of metrics collected."""

    REQUEST_COUNT = "request_count"
    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"
    TOKEN_USAGE = "token_usage"
    COST = "cost"
    PROVIDER_HEALTH = "provider_health"
    QUEUE_SIZE = "queue_size"
    CONCURRENT_REQUESTS = "concurrent_requests"


@dataclass
class MetricPoint:
    """Single metric data point."""

    timestamp: datetime
    value: float
    tags: Dict[str, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Alert:
    """Alert definition."""

    id: str
    name: str
    description: str
    severity: AlertSeverity
    condition: str
    threshold: float
    metric_type: MetricType
    tags: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True
    cooldown_minutes: int = 15
    last_triggered: Optional[datetime] = None
    trigger_count: int = 0

    @property
    def is_in_cooldown(self) -> bool:
        """Check if alert is in cooldown period."""
        if not self.last_triggered:
            return False
        return datetime.now() - self.last_triggered < timedelta(
            minutes=self.cooldown_minutes
        )


@dataclass
class PerformanceSnapshot:
    """Snapshot of performance metrics."""

    timestamp: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    p95_response_time: float
    p99_response_time: float
    requests_per_second: float
    error_rate: float
    total_tokens: int
    total_cost: float
    provider_metrics: Dict[str, Dict[str, Any]]


class MetricsCollector:
    """Collects and aggregates metrics from various sources."""

    def __init__(self, retention_hours: int = 24):
        """Initialize metrics collector."""
        self.retention_hours = retention_hours
        self.metrics: Dict[MetricType, deque] = {
            metric_type: deque(maxlen=10000) for metric_type in MetricType
        }
        self._lock = asyncio.Lock()

    async def add_metric(
        self,
        metric_type: MetricType,
        value: float,
        tags: Dict[str, str] = None,
        metadata: Dict[str, Any] = None,
    ):
        """Add a metric data point."""
        async with self._lock:
            point = MetricPoint(
                timestamp=datetime.now(),
                value=value,
                tags=tags or {},
                metadata=metadata or {},
            )
            self.metrics[metric_type].append(point)

    async def get_metrics(
        self,
        metric_type: MetricType,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        tags: Dict[str, str] = None,
    ) -> List[MetricPoint]:
        """Get metrics for a specific type and time range."""
        async with self._lock:
            points = list(self.metrics[metric_type])

        # Filter by time range
        if start_time:
            points = [p for p in points if p.timestamp >= start_time]
        if end_time:
            points = [p for p in points if p.timestamp <= end_time]

        # Filter by tags
        if tags:
            points = [
                p for p in points if all(p.tags.get(k) == v for k, v in tags.items())
            ]

        return points

    async def get_aggregated_metrics(
        self,
        metric_type: MetricType,
        period_minutes: int = 5,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[datetime, Dict[str, float]]:
        """Get aggregated metrics for time periods."""
        points = await self.get_metrics(metric_type, start_time, end_time)

        if not points:
            return {}

        # Group points by time periods
        aggregated = defaultdict(list)
        for point in points:
            # Round timestamp to nearest period
            period_start = point.timestamp.replace(
                minute=(point.timestamp.minute // period_minutes) * period_minutes,
                second=0,
                microsecond=0,
            )
            aggregated[period_start].append(point.value)

        # Calculate aggregates
        result = {}
        for period_start, values in aggregated.items():
            if values:
                result[period_start] = {
                    "count": len(values),
                    "sum": sum(values),
                    "avg": sum(values) / len(values),
                    "min": min(values),
                    "max": max(values),
                }

        return result

    async def cleanup_old_metrics(self):
        """Remove metrics older than retention period."""
        cutoff_time = datetime.now() - timedelta(hours=self.retention_hours)

        async with self._lock:
            for metric_type in MetricType:
                original_length = len(self.metrics[metric_type])
                self.metrics[metric_type] = deque(
                    (
                        p
                        for p in self.metrics[metric_type]
                        if p.timestamp >= cutoff_time
                    ),
                    maxlen=10000,
                )
                removed = original_length - len(self.metrics[metric_type])
                if removed > 0:
                    logger.debug(
                        f"Cleaned up {removed} old metrics for {metric_type.value}"
                    )


class AlertManager:
    """Manages alert rules and notifications."""

    def __init__(self):
        """Initialize alert manager."""
        self.alerts: Dict[str, Alert] = {}
        self.alert_history: deque = deque(maxlen=1000)
        self.notification_handlers: List[callable] = []
        self._lock = asyncio.Lock()

    def add_alert(self, alert: Alert) -> None:
        """Add an alert rule."""
        self.alerts[alert.id] = alert
        logger.info(f"Added alert: {alert.name}")

    def remove_alert(self, alert_id: str) -> bool:
        """Remove an alert rule."""
        if alert_id in self.alerts:
            del self.alerts[alert_id]
            logger.info(f"Removed alert: {alert_id}")
            return True
        return False

    async def check_alerts(self, metrics_collector: MetricsCollector) -> List[Alert]:
        """Check all alert rules against current metrics."""
        triggered_alerts = []

        async with self._lock:
            for alert in self.alerts.values():
                if not alert.enabled or alert.is_in_cooldown:
                    continue

                try:
                    # Get recent metrics for this alert
                    recent_points = await metrics_collector.get_metrics(
                        alert.metric_type,
                        start_time=datetime.now() - timedelta(minutes=5),
                        tags=alert.tags,
                    )

                    if not recent_points:
                        continue

                    # Evaluate alert condition
                    latest_value = recent_points[-1].value

                    if self._evaluate_condition(
                        alert.condition, latest_value, alert.threshold
                    ):
                        # Alert triggered
                        alert.last_triggered = datetime.now()
                        alert.trigger_count += 1
                        triggered_alerts.append(alert)

                        # Add to history
                        self.alert_history.append(
                            {
                                "alert_id": alert.id,
                                "name": alert.name,
                                "severity": alert.severity.value,
                                "value": latest_value,
                                "threshold": alert.threshold,
                                "timestamp": datetime.now(),
                            }
                        )

                        logger.warning(
                            f"Alert triggered: {alert.name} - {alert.metric_type.value} "
                            f"({latest_value}) {alert.condition} {alert.threshold}"
                        )

                        # Send notifications
                        await self._send_notifications(alert, latest_value)

                except Exception as e:
                    logger.error(f"Error checking alert {alert.name}: {e}")

        return triggered_alerts

    def _evaluate_condition(
        self, condition: str, value: float, threshold: float
    ) -> bool:
        """Evaluate alert condition."""
        try:
            if condition == "gt":
                return value > threshold
            elif condition == "gte":
                return value >= threshold
            elif condition == "lt":
                return value < threshold
            elif condition == "lte":
                return value <= threshold
            elif condition == "eq":
                return abs(value - threshold) < 0.001
            else:
                logger.warning(f"Unknown alert condition: {condition}")
                return False
        except Exception as e:
            logger.error(f"Error evaluating condition {condition}: {e}")
            return False

    async def _send_notifications(self, alert: Alert, value: float) -> None:
        """Send alert notifications."""
        message = (
            f"Alert: {alert.name}\n"
            f"Description: {alert.description}\n"
            f"Current value: {value}\n"
            f"Threshold: {alert.threshold}\n"
            f"Severity: {alert.severity.value}\n"
            f"Time: {datetime.now().isoformat()}"
        )

        for handler in self.notification_handlers:
            try:
                await handler(alert, message, value)
            except Exception as e:
                logger.error(f"Error sending notification: {e}")

    def add_notification_handler(self, handler: callable) -> None:
        """Add a notification handler."""
        self.notification_handlers.append(handler)


class LLMMonitor:
    """Main LLM monitoring service."""

    def __init__(
        self,
        llm_manager: LLMManager,
        cost_tracker: Optional[CostTracker] = None,
        enabled: bool = True,
        metrics_interval: int = 60,  # seconds
        health_check_interval: int = 300,  # seconds
        cleanup_interval: int = 3600,  # seconds
        retention_hours: int = 24,
    ):
        """Initialize LLM Monitor."""
        self.llm_manager = llm_manager
        self.cost_tracker = cost_tracker
        self.enabled = enabled
        self.metrics_interval = metrics_interval
        self.health_check_interval = health_check_interval
        self.cleanup_interval = cleanup_interval

        # Components
        self.metrics_collector = MetricsCollector(retention_hours)
        self.alert_manager = AlertManager()

        # Background tasks
        self._metrics_task: Optional[asyncio.Task] = None
        self._health_check_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # State
        self._initialized = False
        self._start_time = datetime.now()

        # Setup default alerts
        self._setup_default_alerts()

    async def initialize(self) -> None:
        """Initialize the monitoring service."""
        if self._initialized or not self.enabled:
            return

        logger.info("Initializing LLM Monitor...")

        # Start background tasks
        self._metrics_task = asyncio.create_task(self._metrics_collection_loop())
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        self._initialized = True
        logger.info("LLM Monitor initialized successfully")

    async def cleanup(self) -> None:
        """Clean up monitoring resources."""
        if not self._initialized:
            return

        logger.info("Cleaning up LLM Monitor...")

        # Cancel background tasks
        tasks = [self._metrics_task, self._health_check_task, self._cleanup_task]
        for task in tasks:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        self._initialized = False
        logger.info("LLM Monitor cleaned up")

    async def record_request(
        self,
        provider: str,
        model: str,
        success: bool,
        response_time: float,
        tokens: int = 0,
        cost: float = 0.0,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        error_type: Optional[str] = None,
    ) -> None:
        """Record metrics for a completed request."""
        if not self.enabled:
            return

        tags = {
            "provider": provider,
            "model": model,
            "success": str(success),
        }

        if tenant_id:
            tags["tenant_id"] = tenant_id
        if user_id:
            tags["user_id"] = user_id
        if error_type:
            tags["error_type"] = error_type

        # Record metrics
        await self.metrics_collector.add_metric(MetricType.REQUEST_COUNT, 1, tags)

        await self.metrics_collector.add_metric(
            MetricType.RESPONSE_TIME, response_time, tags
        )

        if tokens > 0:
            await self.metrics_collector.add_metric(
                MetricType.TOKEN_USAGE, tokens, tags
            )

        if cost > 0:
            await self.metrics_collector.add_metric(MetricType.COST, cost, tags)

        if not success:
            await self.metrics_collector.add_metric(MetricType.ERROR_RATE, 1, tags)

    async def get_performance_snapshot(self) -> PerformanceSnapshot:
        """Get current performance snapshot."""
        now = datetime.now()
        five_minutes_ago = now - timedelta(minutes=5)

        # Get recent metrics
        request_points = await self.metrics_collector.get_metrics(
            MetricType.REQUEST_COUNT, start_time=five_minutes_ago
        )
        response_time_points = await self.metrics_collector.get_metrics(
            MetricType.RESPONSE_TIME, start_time=five_minutes_ago
        )
        error_points = await self.metrics_collector.get_metrics(
            MetricType.ERROR_RATE, start_time=five_minutes_ago
        )
        token_points = await self.metrics_collector.get_metrics(
            MetricType.TOKEN_USAGE, start_time=five_minutes_ago
        )
        cost_points = await self.metrics_collector.get_metrics(
            MetricType.COST, start_time=five_minutes_ago
        )

        # Calculate aggregates
        total_requests = len(request_points)
        successful_requests = total_requests - len(error_points)
        failed_requests = len(error_points)

        response_times = [p.value for p in response_time_points]
        avg_response_time = (
            sum(response_times) / len(response_times) if response_times else 0.0
        )

        # Calculate percentiles
        sorted_times = sorted(response_times)
        p95_response_time = (
            sorted_times[int(len(sorted_times) * 0.95)] if sorted_times else 0.0
        )
        p99_response_time = (
            sorted_times[int(len(sorted_times) * 0.99)] if sorted_times else 0.0
        )

        requests_per_second = total_requests / 300.0  # 5 minutes = 300 seconds
        error_rate = (failed_requests / total_requests) if total_requests > 0 else 0.0

        total_tokens = sum(p.value for p in token_points)
        total_cost = sum(p.value for p in cost_points)

        # Get provider-specific metrics
        provider_metrics = {}
        if hasattr(self.llm_manager, "_providers"):
            for name, metrics in self.llm_manager._providers.items():
                provider_metrics[name] = {
                    "current_requests": metrics.current_requests,
                    "total_requests": metrics.total_requests,
                    "avg_response_time": metrics.avg_response_time,
                    "success_rate": metrics.provider.metrics.success_rate,
                    "consecutive_failures": metrics.consecutive_failures,
                    "status": metrics.provider.metrics.status.value,
                }

        return PerformanceSnapshot(
            timestamp=now,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time=avg_response_time,
            p95_response_time=p95_response_time,
            p99_response_time=p99_response_time,
            requests_per_second=requests_per_second,
            error_rate=error_rate,
            total_tokens=total_tokens,
            total_cost=total_cost,
            provider_metrics=provider_metrics,
        )

    async def get_metrics_summary(
        self,
        period_hours: int = 1,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get metrics summary for a time period."""
        start_time = datetime.now() - timedelta(hours=period_hours)

        # Build tags filter
        tags = {}
        if provider:
            tags["provider"] = provider
        if model:
            tags["model"] = model

        # Get metrics
        request_points = await self.metrics_collector.get_metrics(
            MetricType.REQUEST_COUNT, start_time=start_time, tags=tags
        )
        response_time_points = await self.metrics_collector.get_metrics(
            MetricType.RESPONSE_TIME, start_time=start_time, tags=tags
        )
        token_points = await self.metrics_collector.get_metrics(
            MetricType.TOKEN_USAGE, start_time=start_time, tags=tags
        )
        cost_points = await self.metrics_collector.get_metrics(
            MetricType.COST, start_time=start_time, tags=tags
        )

        # Calculate summary
        summary = {
            "period_hours": period_hours,
            "start_time": start_time.isoformat(),
            "total_requests": len(request_points),
            "total_tokens": sum(p.value for p in token_points),
            "total_cost": sum(p.value for p in cost_points),
        }

        if response_time_points:
            response_times = [p.value for p in response_time_points]
            summary.update(
                {
                    "avg_response_time": sum(response_times) / len(response_times),
                    "min_response_time": min(response_times),
                    "max_response_time": max(response_times),
                    "p95_response_time": sorted(response_times)[
                        int(len(response_times) * 0.95)
                    ],
                    "p99_response_time": sorted(response_times)[
                        int(len(response_times) * 0.99)
                    ],
                }
            )

        return summary

    def _setup_default_alerts(self) -> None:
        """Setup default alert rules."""
        # High error rate alert
        self.alert_manager.add_alert(
            Alert(
                id="high_error_rate",
                name="High Error Rate",
                description="Error rate is above 5%",
                severity=AlertSeverity.ERROR,
                condition="gt",
                threshold=5.0,
                metric_type=MetricType.ERROR_RATE,
                cooldown_minutes=10,
            )
        )

        # Slow response time alert
        self.alert_manager.add_alert(
            Alert(
                id="slow_response_time",
                name="Slow Response Time",
                description="Average response time is above 5 seconds",
                severity=AlertSeverity.WARNING,
                condition="gt",
                threshold=5.0,
                metric_type=MetricType.RESPONSE_TIME,
                cooldown_minutes=15,
            )
        )

        # Provider unhealthy alert
        self.alert_manager.add_alert(
            Alert(
                id="provider_unhealthy",
                name="Provider Unhealthy",
                description="A provider is unhealthy",
                severity=AlertSeverity.CRITICAL,
                condition="gt",
                threshold=0.5,  # Health check fails
                metric_type=MetricType.PROVIDER_HEALTH,
                cooldown_minutes=5,
            )
        )

    async def _metrics_collection_loop(self) -> None:
        """Background loop for collecting metrics."""
        while self._initialized:
            try:
                await asyncio.sleep(self.metrics_interval)
                await self._collect_system_metrics()
                await self.alert_manager.check_alerts(self.metrics_collector)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Metrics collection error: {e}")

    async def _health_check_loop(self) -> None:
        """Background loop for health checks."""
        while self._initialized:
            try:
                await asyncio.sleep(self.health_check_interval)
                await self._perform_health_checks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")

    async def _cleanup_loop(self) -> None:
        """Background loop for cleanup operations."""
        while self._initialized:
            try:
                await asyncio.sleep(self.cleanup_interval)
                await self.metrics_collector.cleanup_old_metrics()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup error: {e}")

    async def _collect_system_metrics(self) -> None:
        """Collect system-level metrics."""
        try:
            # Record uptime
            uptime = (datetime.now() - self._start_time).total_seconds()
            await self.metrics_collector.add_metric(
                MetricType.PROVIDER_HEALTH, uptime, {"metric": "uptime"}
            )

            # Get provider statuses
            if hasattr(self.llm_manager, "_providers"):
                for name, metrics in self.llm_manager._providers.items():
                    health_score = 1.0 if metrics.is_healthy else 0.0
                    await self.metrics_collector.add_metric(
                        MetricType.PROVIDER_HEALTH,
                        health_score,
                        {"provider": name, "metric": "health_score"},
                    )

                    await self.metrics_collector.add_metric(
                        MetricType.CONCURRENT_REQUESTS,
                        metrics.current_requests,
                        {"provider": name},
                    )

                    await self.metrics_collector.add_metric(
                        MetricType.QUEUE_SIZE,
                        0,  # Would need to implement queue tracking
                        {"provider": name},
                    )

        except Exception as e:
            logger.error(f"System metrics collection error: {e}")

    async def _perform_health_checks(self) -> None:
        """Perform health checks on monitored components."""
        try:
            # Check LLM manager health
            if hasattr(self.llm_manager, "_providers"):
                unhealthy_providers = []
                for name, metrics in self.llm_manager._providers.items():
                    if not metrics.is_healthy:
                        unhealthy_providers.append(name)
                        await self.metrics_collector.add_metric(
                            MetricType.PROVIDER_HEALTH,
                            0.0,
                            {"provider": name, "metric": "health_status"},
                        )

                if unhealthy_providers:
                    logger.warning(
                        f"Unhealthy providers detected: {unhealthy_providers}"
                    )

            # Check cost tracker health
            if self.cost_tracker:
                # Could add health check for cost tracker
                pass

        except Exception as e:
            logger.error(f"Health check error: {e}")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()
