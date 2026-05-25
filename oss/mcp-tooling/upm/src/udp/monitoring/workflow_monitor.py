"""
Workflow monitoring service for UPM.

Provides comprehensive monitoring, observability, and health checks
for workflow execution and system performance.
"""

import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, Union
from uuid import uuid4

from redis.asyncio import Redis
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.models.workflow_state import (
    WorkflowEventModel,
    WorkflowMetricsModel,
    WorkflowStateModel,
    WorkflowStateStatus,
)
from ..services.base import BaseAsyncService


class WorkflowHealthStatus(str, Enum):
    """Workflow health status."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class WorkflowMetrics:
    """Workflow execution metrics."""

    workflow_id: str
    workflow_type: str
    project_id: str

    # Performance metrics
    total_duration_ms: Optional[int] = None
    average_step_duration_ms: Optional[float] = None
    cpu_usage: Optional[float] = None
    memory_usage_mb: Optional[int] = None

    # Count metrics
    steps_executed: int = 0
    steps_failed: int = 0
    steps_retried: int = 0
    checkpoints_created: int = 0

    # Data metrics
    state_size_bytes: Optional[int] = None
    results_size_bytes: Optional[int] = None

    # Timing
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Health indicators
    error_rate: float = 0.0
    retry_rate: float = 0.0
    status: str = "unknown"


@dataclass
class SystemHealthMetrics:
    """System-wide health metrics."""

    # Workflow counts
    total_workflows: int = 0
    active_workflows: int = 0
    completed_workflows: int = 0
    failed_workflows: int = 0

    # Performance metrics
    average_workflow_duration_ms: Optional[float] = None
    workflow_throughput_per_hour: float = 0.0

    # Resource usage
    redis_memory_usage_mb: Optional[int] = None
    database_connections: int = 0

    # Error rates
    overall_error_rate: float = 0.0
    timeout_rate: float = 0.0

    # System status
    health_status: WorkflowHealthStatus = WorkflowHealthStatus.UNKNOWN
    last_updated: datetime = None

    # Active alerts
    active_alerts: list[dict[str, Any]] = None

    def __post_init__(self):
        if self.active_alerts is None:
            self.active_alerts = []
        if self.last_updated is None:
            self.last_updated = datetime.utcnow()


@dataclass
class Alert:
    """System alert."""

    id: str
    severity: AlertSeverity
    title: str
    description: str
    workflow_id: Optional[str]
    workflow_type: Optional[str]
    project_id: Optional[str]
    metric_name: str
    current_value: Union[float, int, str]
    threshold_value: Union[float, int]
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    metadata: dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class WorkflowMonitorService(BaseAsyncService):
    """
    Workflow monitoring and observability service.

    Provides real-time monitoring, health checks, performance metrics,
    and alerting for workflow execution.
    """

    def __init__(self, db_session: AsyncSession, redis_client: Redis):
        super().__init__(db_session, redis_client)
        self._monitoring_active = False
        self._monitoring_task = None
        self._alert_handlers = []
        self._metrics_cache = {}
        self._cache_ttl = 300  # 5 minutes

        # Alert thresholds
        self._alert_thresholds = {
            "workflow_duration_ms": 300000,  # 5 minutes
            "error_rate": 0.1,  # 10%
            "retry_rate": 0.2,  # 20%
            "memory_usage_mb": 1024,  # 1GB
            "cpu_usage": 0.8,  # 80%
            "timeout_rate": 0.05,  # 5%
        }

    async def start_monitoring(self, interval_seconds: int = 60) -> None:
        """
        Start continuous workflow monitoring.

        Args:
            interval_seconds: Monitoring interval in seconds
        """
        if self._monitoring_active:
            return

        self._monitoring_active = True
        self._monitoring_task = asyncio.create_task(
            self._monitoring_loop(interval_seconds)
        )

        self.logger.info(
            f"Started workflow monitoring with {interval_seconds}s interval"
        )

    async def stop_monitoring(self) -> None:
        """Stop continuous workflow monitoring."""
        if not self._monitoring_active:
            return

        self._monitoring_active = False
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        self.logger.info("Stopped workflow monitoring")

    async def _monitoring_loop(self, interval_seconds: int) -> None:
        """Main monitoring loop."""
        while self._monitoring_active:
            try:
                await self._collect_and_process_metrics()
                await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(interval_seconds)

    async def _collect_and_process_metrics(self) -> None:
        """Collect and process workflow metrics."""
        try:
            # Collect system health metrics
            health_metrics = await self.get_system_health_metrics()

            # Check for alerts
            await self._check_and_create_alerts(health_metrics)

            # Update cache
            self._metrics_cache["system_health"] = {
                "data": asdict(health_metrics),
                "timestamp": datetime.utcnow(),
            }

            # Clean old cache entries
            await self._clean_metrics_cache()

        except Exception as e:
            self.logger.error(f"Error collecting metrics: {e}")

    async def get_workflow_metrics(
        self, workflow_id: str, include_details: bool = False
    ) -> WorkflowMetrics:
        """
        Get metrics for a specific workflow.

        Args:
            workflow_id: Workflow identifier
            include_details: Whether to include detailed step metrics

        Returns:
            Workflow metrics
        """
        # Check cache first
        cache_key = f"workflow_metrics:{workflow_id}"
        cached_metrics = self._get_cached_metrics(cache_key)
        if cached_metrics:
            return WorkflowMetrics(**cached_metrics)

        # Query workflow state and metrics
        state_query = select(WorkflowStateModel).where(
            WorkflowStateModel.workflow_id == workflow_id
        )
        state_result = await self.db_session.execute(state_query)
        state = state_result.scalar_one_or_none()

        if not state:
            return WorkflowMetrics(
                workflow_id=workflow_id, workflow_type="unknown", project_id="unknown"
            )

        # Query workflow metrics
        metrics_query = select(WorkflowMetricsModel).where(
            WorkflowMetricsModel.workflow_id == workflow_id
        )
        metrics_result = await self.db_session.execute(metrics_query)
        metrics_data = metrics_result.scalar_one_or_none()

        # Calculate metrics
        metrics = WorkflowMetrics(
            workflow_id=workflow_id,
            workflow_type=state.workflow_type,
            project_id=str(state.project_id),
            total_duration_ms=metrics_data.total_duration_ms if metrics_data else None,
            cpu_usage=metrics_data.cpu_usage if metrics_data else None,
            memory_usage_mb=metrics_data.memory_usage if metrics_data else None,
            steps_executed=metrics_data.steps_executed if metrics_data else 0,
            steps_failed=metrics_data.steps_failed if metrics_data else 0,
            steps_retried=metrics_data.steps_retried if metrics_data else 0,
            checkpoints_created=metrics_data.checkpoints_created if metrics_data else 0,
            state_size_bytes=metrics_data.state_size_bytes if metrics_data else None,
            results_size_bytes=metrics_data.results_size_bytes
            if metrics_data
            else None,
            started_at=state.created_at,
            completed_at=state.updated_at if state.status == "completed" else None,
        )

        # Calculate derived metrics
        if metrics.steps_executed > 0:
            metrics.error_rate = metrics.steps_failed / metrics.steps_executed
            metrics.retry_rate = metrics.steps_retried / metrics.steps_executed

        if include_details:
            metrics.step_details = await self._get_step_details(workflow_id)

        # Cache the results
        self._cache_metrics(cache_key, asdict(metrics))

        return metrics

    async def get_system_health_metrics(self) -> SystemHealthMetrics:
        """
        Get system-wide health metrics.

        Returns:
            System health metrics
        """
        # Check cache first
        cache_key = "system_health"
        cached_metrics = self._get_cached_metrics(cache_key)
        if cached_metrics:
            return SystemHealthMetrics(**cached_metrics)

        # Query workflow counts
        workflow_counts = await self._get_workflow_counts()

        # Query performance metrics
        performance_metrics = await self._get_performance_metrics()

        # Query resource usage
        resource_metrics = await self._get_resource_metrics()

        # Query error rates
        error_metrics = await self._get_error_metrics()

        # Calculate health status
        health_status = self._calculate_health_status(
            workflow_counts, performance_metrics, error_metrics
        )

        # Get active alerts
        active_alerts = await self.get_active_alerts()

        metrics = SystemHealthMetrics(
            total_workflows=workflow_counts.get("total", 0),
            active_workflows=workflow_counts.get("active", 0),
            completed_workflows=workflow_counts.get("completed", 0),
            failed_workflows=workflow_counts.get("failed", 0),
            average_workflow_duration_ms=performance_metrics.get("avg_duration"),
            workflow_throughput_per_hour=performance_metrics.get("throughput", 0.0),
            redis_memory_usage_mb=resource_metrics.get("redis_memory"),
            database_connections=resource_metrics.get("db_connections", 0),
            overall_error_rate=error_metrics.get("overall_error_rate", 0.0),
            timeout_rate=error_metrics.get("timeout_rate", 0.0),
            health_status=health_status,
            active_alerts=[asdict(alert) for alert in active_alerts],
            last_updated=datetime.utcnow(),
        )

        # Cache the results
        self._cache_metrics(cache_key, asdict(metrics))

        return metrics

    async def _get_workflow_counts(self) -> dict[str, int]:
        """Get workflow count statistics."""
        counts = {}

        # Total workflows
        total_query = select(func.count(WorkflowStateModel.id))
        total_result = await self.db_session.execute(total_query)
        counts["total"] = total_result.scalar() or 0

        # Active workflows
        active_query = select(func.count(WorkflowStateModel.id)).where(
            WorkflowStateModel.status == WorkflowStateStatus.ACTIVE
        )
        active_result = await self.db_session.execute(active_query)
        counts["active"] = active_result.scalar() or 0

        # Completed workflows
        completed_query = select(func.count(WorkflowStateModel.id)).where(
            WorkflowStateModel.status == WorkflowStateStatus.COMPLETED
        )
        completed_result = await self.db_session.execute(completed_query)
        counts["completed"] = completed_result.scalar() or 0

        # Failed workflows
        failed_query = select(func.count(WorkflowStateModel.id)).where(
            WorkflowStateModel.status == WorkflowStateStatus.FAILED
        )
        failed_result = await self.db_session.execute(failed_query)
        counts["failed"] = failed_result.scalar() or 0

        return counts

    async def _get_performance_metrics(self) -> dict[str, Any]:
        """Get performance metrics."""
        metrics = {}

        # Average workflow duration
        duration_query = select(func.avg(WorkflowMetricsModel.total_duration_ms)).where(
            WorkflowMetricsModel.completed_at.isnot(None)
        )
        duration_result = await self.db_session.execute(duration_query)
        metrics["avg_duration"] = duration_result.scalar()

        # Workflow throughput (last hour)
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        throughput_query = select(func.count(WorkflowStateModel.id)).where(
            WorkflowStateModel.created_at >= one_hour_ago
        )
        throughput_result = await self.db_session.execute(throughput_query)
        metrics["throughput"] = throughput_result.scalar() or 0

        return metrics

    async def _get_resource_metrics(self) -> dict[str, Any]:
        """Get resource usage metrics."""
        metrics = {}

        try:
            # Redis memory usage
            redis_info = await self.redis.info("memory")
            metrics["redis_memory"] = redis_info.get("used_memory", 0) // (
                1024 * 1024
            )  # Convert to MB
        except Exception as e:
            self.logger.warning(f"Failed to get Redis metrics: {e}")

        # Database connections (this would depend on your database setup)
        metrics["db_connections"] = 0  # Placeholder

        return metrics

    async def _get_error_metrics(self) -> dict[str, Any]:
        """Get error rate metrics."""
        metrics = {}

        # Overall error rate (last 24 hours)
        one_day_ago = datetime.utcnow() - timedelta(days=1)

        total_workflows_query = select(func.count(WorkflowStateModel.id)).where(
            WorkflowStateModel.created_at >= one_day_ago
        )
        total_result = await self.db_session.execute(total_workflows_query)
        total_count = total_result.scalar() or 0

        failed_workflows_query = select(func.count(WorkflowStateModel.id)).where(
            and_(
                WorkflowStateModel.created_at >= one_day_ago,
                WorkflowStateModel.status == WorkflowStateStatus.FAILED,
            )
        )
        failed_result = await self.db_session.execute(failed_workflows_query)
        failed_count = failed_result.scalar() or 0

        if total_count > 0:
            metrics["overall_error_rate"] = failed_count / total_count
        else:
            metrics["overall_error_rate"] = 0.0

        # Timeout rate (placeholder - would need timeout tracking)
        metrics["timeout_rate"] = 0.0

        return metrics

    def _calculate_health_status(
        self,
        workflow_counts: dict[str, int],
        performance_metrics: dict[str, Any],
        error_metrics: dict[str, Any],
    ) -> WorkflowHealthStatus:
        """Calculate overall system health status."""

        # Check error rate
        error_rate = error_metrics.get("overall_error_rate", 0.0)
        if error_rate > 0.2:  # > 20% error rate
            return WorkflowHealthStatus.UNHEALTHY
        elif error_rate > 0.1:  # > 10% error rate
            return WorkflowHealthStatus.DEGRADED

        # Check active workflow count
        active_count = workflow_counts.get("active", 0)
        if active_count > 1000:  # Too many active workflows
            return WorkflowHealthStatus.DEGRADED

        # Check performance
        avg_duration = performance_metrics.get("avg_duration")
        if avg_duration and avg_duration > 600000:  # > 10 minutes average
            return WorkflowHealthStatus.DEGRADED

        return WorkflowHealthStatus.HEALTHY

    async def _check_and_create_alerts(
        self, health_metrics: SystemHealthMetrics
    ) -> None:
        """Check metrics against thresholds and create alerts."""

        # Check error rate
        if health_metrics.overall_error_rate > self._alert_thresholds["error_rate"]:
            await self._create_alert(
                severity=AlertSeverity.HIGH,
                title="High Error Rate Detected",
                description=f"System error rate is {health_metrics.overall_error_rate:.2%}",
                metric_name="overall_error_rate",
                current_value=health_metrics.overall_error_rate,
                threshold_value=self._alert_thresholds["error_rate"],
            )

        # Check failed workflows
        if health_metrics.failed_workflows > 10:
            await self._create_alert(
                severity=AlertSeverity.MEDIUM,
                title="Multiple Failed Workflows",
                description=f"{health_metrics.failed_workflows} workflows have failed",
                metric_name="failed_workflows",
                current_value=health_metrics.failed_workflows,
                threshold_value=10,
            )

        # Check active workflow count
        if health_metrics.active_workflows > 500:
            await self._create_alert(
                severity=AlertSeverity.MEDIUM,
                title="High Workflow Queue",
                description=f"{health_metrics.active_workflows} workflows are currently active",
                metric_name="active_workflows",
                current_value=health_metrics.active_workflows,
                threshold_value=500,
            )

    async def _create_alert(
        self,
        severity: AlertSeverity,
        title: str,
        description: str,
        metric_name: str,
        current_value: Union[float, int],
        threshold_value: Union[float, int],
        workflow_id: Optional[str] = None,
        workflow_type: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> Alert:
        """Create a new alert."""

        alert = Alert(
            id=str(uuid4()),
            severity=severity,
            title=title,
            description=description,
            workflow_id=workflow_id,
            workflow_type=workflow_type,
            project_id=project_id,
            metric_name=metric_name,
            current_value=current_value,
            threshold_value=threshold_value,
            triggered_at=datetime.utcnow(),
        )

        # Store alert in Redis for active alerts tracking
        alert_key = f"alert:{alert.id}"
        alert_data = asdict(alert)
        await self.redis.setex(alert_key, 3600, json.dumps(alert_data))  # 1 hour TTL

        # Add to active alerts set
        await self.redis.sadd("active_alerts", alert.id)

        self.logger.warning(f"Alert created: {title} - {description}")

        # Call alert handlers
        await self._notify_alert_handlers(alert)

        return alert

    async def get_active_alerts(self) -> list[Alert]:
        """Get all active alerts."""

        alert_ids = await self.redis.smembers("active_alerts")
        alerts = []

        for alert_id in alert_ids:
            alert_key = f"alert:{alert_id}"
            alert_data = await self.redis.get(alert_key)
            if alert_data:
                alert_dict = json.loads(alert_data)
                alert_dict["triggered_at"] = datetime.fromisoformat(
                    alert_dict["triggered_at"]
                )
                if alert_dict.get("resolved_at"):
                    alert_dict["resolved_at"] = datetime.fromisoformat(
                        alert_dict["resolved_at"]
                    )
                alerts.append(Alert(**alert_dict))

        return alerts

    async def resolve_alert(self, alert_id: str) -> bool:
        """Resolve an alert."""

        alert_key = f"alert:{alert_id}"
        alert_data = await self.redis.get(alert_key)

        if not alert_data:
            return False

        # Update alert with resolution time
        alert_dict = json.loads(alert_data)
        alert_dict["resolved_at"] = datetime.utcnow().isoformat()

        await self.redis.setex(alert_key, 86400, json.dumps(alert_dict))  # 24 hours TTL

        # Remove from active alerts
        await self.redis.srem("active_alerts", alert_id)

        self.logger.info(f"Alert resolved: {alert_id}")

        return True

    def add_alert_handler(self, handler: callable) -> None:
        """Add an alert handler function."""
        self._alert_handlers.append(handler)

    async def _notify_alert_handlers(self, alert: Alert) -> None:
        """Notify all registered alert handlers."""
        for handler in self._alert_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(alert)
                else:
                    handler(alert)
            except Exception as e:
                self.logger.error(f"Error in alert handler: {e}")

    def _get_cached_metrics(self, cache_key: str) -> Optional[dict[str, Any]]:
        """Get metrics from cache."""
        if cache_key in self._metrics_cache:
            cached_data = self._metrics_cache[cache_key]
            age = datetime.utcnow() - cached_data["timestamp"]
            if age.total_seconds() < self._cache_ttl:
                return cached_data["data"]
            else:
                del self._metrics_cache[cache_key]
        return None

    def _cache_metrics(self, cache_key: str, data: dict[str, Any]) -> None:
        """Cache metrics data."""
        self._metrics_cache[cache_key] = {
            "data": data,
            "timestamp": datetime.utcnow(),
        }

    async def _clean_metrics_cache(self) -> None:
        """Clean expired entries from metrics cache."""
        current_time = datetime.utcnow()
        expired_keys = []

        for cache_key, cached_data in self._metrics_cache.items():
            age = current_time - cached_data["timestamp"]
            if age.total_seconds() > self._cache_ttl:
                expired_keys.append(cache_key)

        for key in expired_keys:
            del self._metrics_cache[key]

    async def _get_step_details(self, workflow_id: str) -> dict[str, Any]:
        """Get detailed step metrics for a workflow."""
        # Query workflow events for step details
        events_query = (
            select(WorkflowEventModel)
            .where(WorkflowEventModel.workflow_id == workflow_id)
            .order_by(WorkflowEventModel.timestamp)
        )

        events_result = await self.db_session.execute(events_query)
        events = events_result.scalars().all()

        step_details = {}
        for event in events:
            if event.step not in step_details:
                step_details[event.step] = {
                    "start_time": None,
                    "end_time": None,
                    "duration_ms": None,
                    "status": "unknown",
                    "events": [],
                }

            step_details[event.step]["events"].append(
                {
                    "type": event.event_type,
                    "timestamp": event.timestamp,
                    "data": event.event_data,
                }
            )

            if event.event_type == "STEP_STARTED":
                step_details[event.step]["start_time"] = event.timestamp
            elif event.event_type == "STEP_COMPLETED":
                step_details[event.step]["end_time"] = event.timestamp
                step_details[event.step]["status"] = "completed"
            elif event.event_type == "STEP_FAILED":
                step_details[event.step]["status"] = "failed"

        # Calculate durations
        for step_name, step_data in step_details.items():
            if step_data["start_time"] and step_data["end_time"]:
                duration = step_data["end_time"] - step_data["start_time"]
                step_data["duration_ms"] = int(duration.total_seconds() * 1000)

        return step_details

    async def get_workflow_performance_report(
        self,
        workflow_type: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """
        Generate a comprehensive workflow performance report.

        Args:
            workflow_type: Filter by workflow type
            start_time: Start time for report period
            end_time: End time for report period

        Returns:
            Performance report data
        """
        if not start_time:
            start_time = datetime.utcnow() - timedelta(days=7)  # Last 7 days
        if not end_time:
            end_time = datetime.utcnow()

        # Query workflow metrics in the time range
        metrics_query = select(WorkflowMetricsModel).where(
            and_(
                WorkflowMetricsModel.started_at >= start_time,
                WorkflowMetricsModel.started_at <= end_time,
            )
        )

        if workflow_type:
            metrics_query = metrics_query.where(
                WorkflowMetricsModel.workflow_type == workflow_type
            )

        metrics_result = await self.db_session.execute(metrics_query)
        metrics_data = metrics_result.scalars().all()

        # Calculate report statistics
        report = {
            "period": {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "workflow_type": workflow_type,
            },
            "summary": {
                "total_workflows": len(metrics_data),
                "completed_workflows": len([m for m in metrics_data if m.completed_at]),
                "failed_workflows": len(
                    [m for m in metrics_data if not m.completed_at]
                ),
            },
            "performance": {
                "average_duration_ms": 0,
                "min_duration_ms": None,
                "max_duration_ms": None,
                "average_steps_executed": 0,
                "average_steps_failed": 0,
            },
            "resource_usage": {
                "average_memory_usage_mb": 0,
                "peak_memory_usage_mb": 0,
                "average_cpu_usage": 0,
                "peak_cpu_usage": 0,
            },
            "errors": {
                "most_common_errors": [],
                "error_rate_trend": [],
            },
        }

        if metrics_data:
            # Calculate performance statistics
            durations = [
                m.total_duration_ms for m in metrics_data if m.total_duration_ms
            ]
            if durations:
                report["performance"]["average_duration_ms"] = sum(durations) / len(
                    durations
                )
                report["performance"]["min_duration_ms"] = min(durations)
                report["performance"]["max_duration_ms"] = max(durations)

            report["performance"]["average_steps_executed"] = sum(
                m.steps_executed for m in metrics_data
            ) / len(metrics_data)

            report["performance"]["average_steps_failed"] = sum(
                m.steps_failed for m in metrics_data
            ) / len(metrics_data)

            # Calculate resource usage statistics
            memory_usage = [m.memory_usage for m in metrics_data if m.memory_usage]
            if memory_usage:
                report["resource_usage"]["average_memory_usage_mb"] = sum(
                    memory_usage
                ) / len(memory_usage)
                report["resource_usage"]["peak_memory_usage_mb"] = max(memory_usage)

            cpu_usage = [m.cpu_usage for m in metrics_data if m.cpu_usage]
            if cpu_usage:
                report["resource_usage"]["average_cpu_usage"] = sum(cpu_usage) / len(
                    cpu_usage
                )
                report["resource_usage"]["peak_cpu_usage"] = max(cpu_usage)

        return report
