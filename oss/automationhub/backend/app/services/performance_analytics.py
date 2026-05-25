"""
Agent Performance Metrics Collection and Analysis Service

This module provides comprehensive performance metrics collection,
real-time analysis, trend identification, and optimization recommendations
for the UPM.Plus agent system.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Union, Any, Callable
from uuid import UUID
from dataclasses import dataclass, field
from enum import Enum
import json
import redis.asyncio as redis
import numpy as np
import pandas as pd
from collections import defaultdict, deque
from statistics import mean, median, stdev
import time

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.agent import Agent


class MetricType(str, Enum):
    """Types of performance metrics."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


class AggregationType(str, Enum):
    """Metric aggregation types."""
    SUM = "sum"
    AVERAGE = "average"
    MIN = "min"
    MAX = "max"
    PERCENTILE = "percentile"
    RATE = "rate"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class PerformanceMetric:
    """Individual performance metric data point."""
    agent_id: UUID
    metric_name: str
    metric_type: MetricType
    value: Union[int, float]
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)
    unit: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agent_id": str(self.agent_id),
            "metric_name": self.metric_name,
            "metric_type": self.metric_type,
            "value": self.value,
            "timestamp": self.timestamp.isoformat(),
            "tags": self.tags,
            "unit": self.unit,
            "metadata": self.metadata
        }


@dataclass
class MetricAggregation:
    """Aggregated metric data."""
    agent_id: Optional[UUID]
    metric_name: str
    aggregation_type: AggregationType
    value: float
    timestamp: datetime
    period_start: datetime
    period_end: datetime
    sample_count: int = 0
    tags: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agent_id": str(self.agent_id) if self.agent_id else None,
            "metric_name": self.metric_name,
            "aggregation_type": self.aggregation_type,
            "value": self.value,
            "timestamp": self.timestamp.isoformat(),
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "sample_count": self.sample_count,
            "tags": self.tags
        }


@dataclass
class PerformanceAlert:
    """Performance alert definition."""
    alert_id: str
    agent_id: Optional[UUID]
    metric_name: str
    condition: str  # e.g., ">", "<", "==", "!=", "contains"
    threshold: float
    severity: AlertSeverity
    message: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    is_active: bool = True
    tags: Dict[str, str] = field(default_factory=dict)
    notification_channels: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "alert_id": self.alert_id,
            "agent_id": str(self.agent_id) if self.agent_id else None,
            "metric_name": self.metric_name,
            "condition": self.condition,
            "threshold": self.threshold,
            "severity": self.severity,
            "message": self.message,
            "triggered_at": self.triggered_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "is_active": self.is_active,
            "tags": self.tags,
            "notification_channels": self.notification_channels
        }


@dataclass
class PerformanceReport:
    """Comprehensive performance report."""
    report_id: str
    agent_id: Optional[UUID]
    report_type: str
    period_start: datetime
    period_end: datetime
    metrics: Dict[str, Any]
    insights: List[str]
    recommendations: List[str]
    trends: Dict[str, str]
    alerts: List[PerformanceAlert]
    generated_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "report_id": self.report_id,
            "agent_id": str(self.agent_id) if self.agent_id else None,
            "report_type": self.report_type,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "metrics": self.metrics,
            "insights": self.insights,
            "recommendations": self.recommendations,
            "trends": self.trends,
            "alerts": [alert.to_dict() for alert in self.alerts],
            "generated_at": self.generated_at.isoformat()
        }


class PerformanceAnalyticsService:
    """
    Comprehensive performance analytics and monitoring service.

    Provides real-time metrics collection, analysis, alerting,
    and optimization recommendations for the agent system.
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

        # Metric storage
        self._metrics_buffer: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self._aggregations: Dict[str, MetricAggregation] = {}
        self._alerts: Dict[str, PerformanceAlert] = {}

        # Performance tracking
        self._agent_performance: Dict[UUID, Dict[str, Any]] = defaultdict(dict)
        self._system_metrics: Dict[str, List[PerformanceMetric]] = defaultdict(list)

        # Configuration
        self._buffer_flush_interval = 30  # seconds
        self._aggregation_intervals = [60, 300, 900, 3600]  # seconds
        self._metric_retention_hours = 168  # 7 days
        self._alert_evaluation_interval = 60  # seconds

        # Background tasks
        self._collection_task: Optional[asyncio.Task] = None
        self._aggregation_task: Optional[asyncio.Task] = None
        self._alert_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # Metric definitions
        self._metric_definitions = self._initialize_metric_definitions()

    def start(self):
        """Start the performance analytics service."""
        self.logger.info("Starting Performance Analytics Service")

        # Start background tasks
        self._collection_task = asyncio.create_task(self._metrics_collection_loop())
        self._aggregation_task = asyncio.create_task(self._aggregation_loop())
        self._alert_task = asyncio.create_task(self._alert_evaluation_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        self.logger.info("Performance Analytics Service started")

    async def stop(self):
        """Stop the performance analytics service."""
        self.logger.info("Stopping Performance Analytics Service")

        # Cancel background tasks
        if self._collection_task:
            self._collection_task.cancel()
        if self._aggregation_task:
            self._aggregation_task.cancel()
        if self._alert_task:
            self._alert_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(
            self._collection_task,
            self._aggregation_task,
            self._alert_task,
            self._cleanup_task,
            return_exceptions=True
        )

        # Flush remaining metrics
        await self._flush_metrics_buffer()

        self.logger.info("Performance Analytics Service stopped")

    async def record_metric(
        self,
        agent_id: UUID,
        metric_name: str,
        value: Union[int, float],
        metric_type: MetricType = MetricType.GAUGE,
        tags: Optional[Dict[str, str]] = None,
        unit: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Record a performance metric.

        Args:
            agent_id: The agent ID
            metric_name: The metric name
            value: The metric value
            metric_type: The type of metric
            tags: Optional tags for the metric
            unit: Optional unit of measurement
            metadata: Additional metadata
        """
        try:
            metric = PerformanceMetric(
                agent_id=agent_id,
                metric_name=metric_name,
                metric_type=metric_type,
                value=value,
                timestamp=datetime.utcnow(),
                tags=tags or {},
                unit=unit,
                metadata=metadata or {}
            )

            # Add to buffer
            buffer_key = f"{agent_id}:{metric_name}"
            self._metrics_buffer[buffer_key].append(metric)

            # Update real-time analytics
            await self._update_real_time_analytics(metric)

        except Exception as e:
            self.logger.error(f"Failed to record metric {metric_name} for agent {agent_id}: {e}")

    async def record_task_execution(
        self,
        agent_id: UUID,
        task_id: UUID,
        task_type: str,
        success: bool,
        execution_time_ms: float,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Record task execution metrics.

        Args:
            agent_id: The agent ID
            task_id: The task ID
            task_type: The type of task
            success: Whether the task was successful
            execution_time_ms: Execution time in milliseconds
            error_message: Optional error message
            metadata: Additional metadata
        """
        try:
            # Record basic execution metrics
            await self.record_metric(
                agent_id=agent_id,
                metric_name="task_execution_time",
                value=execution_time_ms,
                metric_type=MetricType.TIMER,
                tags={"task_type": task_type, "success": str(success)},
                unit="milliseconds"
            )

            await self.record_metric(
                agent_id=agent_id,
                metric_name="task_success_rate",
                value=1.0 if success else 0.0,
                metric_type=MetricType.GAUGE,
                tags={"task_type": task_type}
            )

            await self.record_metric(
                agent_id=agent_id,
                metric_name="tasks_completed",
                value=1,
                metric_type=MetricType.COUNTER,
                tags={"task_type": task_type, "status": "success" if success else "failed"}
            )

            # Record error details if failed
            if not success and error_message:
                await self.record_metric(
                    agent_id=agent_id,
                    metric_name="task_errors",
                    value=1,
                    metric_type=MetricType.COUNTER,
                    tags={"task_type": task_type, "error_type": self._classify_error(error_message)},
                    metadata={"error_message": error_message}
                )

            # Update agent performance tracking
            await self._update_agent_task_performance(
                agent_id, task_type, success, execution_time_ms
            )

        except Exception as e:
            self.logger.error(f"Failed to record task execution metrics: {e}")

    async def record_agent_health(
        self,
        agent_id: UUID,
        healthy: bool,
        response_time_ms: float,
        cpu_usage: float,
        memory_usage: float,
        active_connections: int = 0
    ):
        """
        Record agent health metrics.

        Args:
            agent_id: The agent ID
            healthy: Whether the agent is healthy
            response_time_ms: Health check response time
            cpu_usage: CPU usage percentage
            memory_usage: Memory usage percentage
            active_connections: Number of active connections
        """
        try:
            await self.record_metric(
                agent_id=agent_id,
                metric_name="agent_healthy",
                value=1.0 if healthy else 0.0,
                metric_type=MetricType.GAUGE
            )

            await self.record_metric(
                agent_id=agent_id,
                metric_name="health_check_time",
                value=response_time_ms,
                metric_type=MetricType.TIMER,
                unit="milliseconds"
            )

            await self.record_metric(
                agent_id=agent_id,
                metric_name="cpu_usage_percent",
                value=cpu_usage,
                metric_type=MetricType.GAUGE,
                unit="percent"
            )

            await self.record_metric(
                agent_id=agent_id,
                metric_name="memory_usage_percent",
                value=memory_usage,
                metric_type=MetricType.GAUGE,
                unit="percent"
            )

            await self.record_metric(
                agent_id=agent_id,
                metric_name="active_connections",
                value=active_connections,
                metric_type=MetricType.GAUGE
            )

        except Exception as e:
            self.logger.error(f"Failed to record agent health metrics: {e}")

    async def get_agent_metrics(
        self,
        agent_id: UUID,
        metric_names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        aggregations: Optional[List[AggregationType]] = None
    ) -> Dict[str, List[MetricAggregation]]:
        """
        Get metrics for a specific agent.

        Args:
            agent_id: The agent ID
            metric_names: Optional list of specific metrics to retrieve
            start_time: Optional start time for the query
            end_time: Optional end time for the query
            aggregations: Optional list of aggregations to compute

        Returns:
            Dictionary of metric names to list of aggregations
        """
        try:
            # Set default time range
            if not end_time:
                end_time = datetime.utcnow()
            if not start_time:
                start_time = end_time - timedelta(hours=24)

            # Get metrics from storage
            metrics_data = await self._retrieve_agent_metrics(
                agent_id, metric_names, start_time, end_time
            )

            # Compute aggregations if requested
            if aggregations:
                result = await self._compute_aggregations(
                    metrics_data, aggregations, start_time, end_time
                )
            else:
                result = await self._group_metrics_by_name(metrics_data)

            return result

        except Exception as e:
            self.logger.error(f"Failed to get metrics for agent {agent_id}: {e}")
            return {}

    async def get_system_performance_overview(self) -> Dict[str, Any]:
        """
        Get overall system performance overview.

        Returns:
            Dictionary containing system performance metrics
        """
        try:
            overview = {
                "timestamp": datetime.utcnow().isoformat(),
                "total_agents": 0,
                "healthy_agents": 0,
                "unhealthy_agents": 0,
                "average_response_time": 0.0,
                "total_tasks_last_hour": 0,
                "success_rate_last_hour": 0.0,
                "system_load": {
                    "cpu_avg": 0.0,
                    "memory_avg": 0.0,
                    "active_connections_total": 0
                },
                "alerts": {
                    "active": 0,
                    "critical": 0,
                    "warning": 0
                }
            }

            # Get agent count and health status
            healthy_count = 0
            total_response_time = 0.0
            agent_count = 0

            # Count active alerts
            active_alerts = [alert for alert in self._alerts.values() if alert.is_active]
            overview["alerts"]["active"] = len(active_alerts)
            overview["alerts"]["critical"] = len([a for a in active_alerts if a.severity == AlertSeverity.CRITICAL])
            overview["alerts"]["warning"] = len([a for a in active_alerts if a.severity == AlertSeverity.WARNING])

            # Get recent system metrics (last hour)
            start_time = datetime.utcnow() - timedelta(hours=1)

            for agent_id, perf_data in self._agent_performance.items():
                agent_count += 1

                # Get health status
                health_metrics = await self.get_agent_metrics(
                    agent_id, ["agent_healthy"], start_time
                )
                if health_metrics.get("agent_healthy"):
                    recent_health = health_metrics["agent_healthy"]
                    if recent_health and any(ag.value > 0.5 for ag in recent_health[-1:]):
                        healthy_count += 1

                # Get response time
                response_metrics = await self.get_agent_metrics(
                    agent_id, ["health_check_time"], start_time
                )
                if response_metrics.get("health_check_time"):
                    recent_response = response_metrics["health_check_time"]
                    if recent_response:
                        total_response_time += recent_response[-1].value

                # Get system resource usage
                cpu_metrics = await self.get_agent_metrics(agent_id, ["cpu_usage_percent"], start_time)
                memory_metrics = await self.get_agent_metrics(agent_id, ["memory_usage_percent"], start_time)
                conn_metrics = await self.get_agent_metrics(agent_id, ["active_connections"], start_time)

                if cpu_metrics.get("cpu_usage_percent"):
                    overview["system_load"]["cpu_avg"] += cpu_metrics["cpu_usage_percent"][-1].value

                if memory_metrics.get("memory_usage_percent"):
                    overview["system_load"]["memory_avg"] += memory_metrics["memory_usage_percent"][-1].value

                if conn_metrics.get("active_connections"):
                    overview["system_load"]["active_connections_total"] += conn_metrics["active_connections"][-1].value

            # Calculate averages
            overview["total_agents"] = agent_count
            overview["healthy_agents"] = healthy_count
            overview["unhealthy_agents"] = agent_count - healthy_count

            if agent_count > 0:
                overview["average_response_time"] = total_response_time / agent_count
                overview["system_load"]["cpu_avg"] /= agent_count
                overview["system_load"]["memory_avg"] /= agent_count

            return overview

        except Exception as e:
            self.logger.error(f"Failed to get system performance overview: {e}")
            return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}

    async def create_performance_report(
        self,
        agent_id: Optional[UUID] = None,
        report_type: str = "summary",
        period_hours: int = 24
    ) -> PerformanceReport:
        """
        Create a comprehensive performance report.

        Args:
            agent_id: Optional agent ID (None for system-wide report)
            report_type: Type of report to generate
            period_hours: Time period in hours for the report

        Returns:
            Performance report with metrics, insights, and recommendations
        """
        try:
            report_id = f"{report_type}_{agent_id or 'system'}_{int(time.time())}"
            period_end = datetime.utcnow()
            period_start = period_end - timedelta(hours=period_hours)

            # Get metrics for the period
            if agent_id:
                metrics_data = await self.get_agent_metrics(agent_id, end_time=period_end, start_time=period_start)
            else:
                metrics_data = await self._get_system_metrics(period_start, period_end)

            # Analyze metrics and generate insights
            insights = await self._generate_insights(metrics_data, agent_id)
            recommendations = await self._generate_recommendations(metrics_data, insights, agent_id)
            trends = await self._identify_trends(metrics_data)

            # Get relevant alerts
            relevant_alerts = [
                alert for alert in self._alerts.values()
                if (agent_id and alert.agent_id == agent_id) or (not agent_id and not alert.agent_id)
                and period_start <= alert.triggered_at <= period_end
            ]

            return PerformanceReport(
                report_id=report_id,
                agent_id=agent_id,
                report_type=report_type,
                period_start=period_start,
                period_end=period_end,
                metrics=metrics_data,
                insights=insights,
                recommendations=recommendations,
                trends=trends,
                alerts=relevant_alerts,
                generated_at=datetime.utcnow()
            )

        except Exception as e:
            self.logger.error(f"Failed to create performance report: {e}")
            raise

    async def create_alert(
        self,
        agent_id: Optional[UUID],
        metric_name: str,
        condition: str,
        threshold: float,
        severity: AlertSeverity,
        message: str,
        notification_channels: Optional[List[str]] = None
    ) -> str:
        """
        Create a new performance alert.

        Args:
            agent_id: Optional agent ID
            metric_name: The metric to monitor
            condition: The condition to check (>, <, ==, !=, contains)
            threshold: The threshold value
            severity: Alert severity
            message: Alert message
            notification_channels: Optional notification channels

        Returns:
            Alert ID
        """
        try:
            alert_id = f"alert_{uuid4().hex[:8]}"

            alert = PerformanceAlert(
                alert_id=alert_id,
                agent_id=agent_id,
                metric_name=metric_name,
                condition=condition,
                threshold=threshold,
                severity=severity,
                message=message,
                triggered_at=datetime.utcnow(),
                notification_channels=notification_channels or []
            )

            self._alerts[alert_id] = alert

            # Store in Redis
            await self._store_alert(alert)

            self.logger.info(f"Created alert {alert_id}: {message}")

            return alert_id

        except Exception as e:
            self.logger.error(f"Failed to create alert: {e}")
            raise

    async def get_performance_trends(
        self,
        agent_id: Optional[UUID] = None,
        metric_name: Optional[str] = None,
        hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get performance trends analysis.

        Args:
            agent_id: Optional agent ID
            metric_name: Optional specific metric
            hours: Time period in hours

        Returns:
            Trends analysis data
        """
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=hours)

            if agent_id:
                metrics_data = await self.get_agent_metrics(
                    agent_id, [metric_name] if metric_name else None, start_time, end_time
                )
            else:
                metrics_data = await self._get_system_metrics(start_time, end_time)

            trends = {}
            for metric_name, metric_list in metrics_data.items():
                if metric_list:
                    trends[metric_name] = await self._analyze_metric_trend(metric_list)

            return {
                "period_start": start_time.isoformat(),
                "period_end": end_time.isoformat(),
                "trends": trends,
                "summary": await self._summarize_trends(trends)
            }

        except Exception as e:
            self.logger.error(f"Failed to get performance trends: {e}")
            return {"error": str(e)}

    async def _initialize_metric_definitions(self) -> Dict[str, Dict[str, Any]]:
        """Initialize predefined metric definitions."""
        return {
            "task_execution_time": {
                "type": MetricType.TIMER,
                "unit": "milliseconds",
                "aggregations": [AggregationType.AVERAGE, AggregationType.PERCENTILE],
                "description": "Time taken to execute tasks"
            },
            "task_success_rate": {
                "type": MetricType.GAUGE,
                "unit": "percent",
                "aggregations": [AggregationType.AVERAGE],
                "description": "Percentage of successful tasks"
            },
            "tasks_completed": {
                "type": MetricType.COUNTER,
                "unit": "count",
                "aggregations": [AggregationType.SUM, AggregationType.RATE],
                "description": "Number of completed tasks"
            },
            "agent_healthy": {
                "type": MetricType.GAUGE,
                "unit": "boolean",
                "aggregations": [AggregationType.AVERAGE],
                "description": "Agent health status"
            },
            "cpu_usage_percent": {
                "type": MetricType.GAUGE,
                "unit": "percent",
                "aggregations": [AggregationType.AVERAGE, AggregationType.MAX],
                "description": "CPU usage percentage"
            },
            "memory_usage_percent": {
                "type": MetricType.GAUGE,
                "unit": "percent",
                "aggregations": [AggregationType.AVERAGE, AggregationType.MAX],
                "description": "Memory usage percentage"
            },
            "active_connections": {
                "type": MetricType.GAUGE,
                "unit": "count",
                "aggregations": [AggregationType.AVERAGE, AggregationType.MAX],
                "description": "Number of active connections"
            }
        }

    async def _update_real_time_analytics(self, metric: PerformanceMetric):
        """Update real-time analytics for incoming metric."""
        try:
            agent_id = metric.agent_id
            metric_name = metric.metric_name

            # Update agent performance tracking
            if agent_id not in self._agent_performance:
                self._agent_performance[agent_id] = {}

            if metric_name not in self._agent_performance[agent_id]:
                self._agent_performance[agent_id][metric_name] = {
                    "current_value": metric.value,
                    "last_updated": metric.timestamp,
                    "count": 1,
                    "sum": metric.value,
                    "values": deque(maxlen=100)
                }

            perf_data = self._agent_performance[agent_id][metric_name]
            perf_data["current_value"] = metric.value
            perf_data["last_updated"] = metric.timestamp
            perf_data["count"] += 1
            perf_data["sum"] += metric.value
            perf_data["values"].append(metric.value)

            # Calculate moving average
            if len(perf_data["values"]) > 0:
                perf_data["moving_avg"] = mean(perf_data["values"])

            # Update system metrics
            self._system_metrics[metric_name].append(metric)

        except Exception as e:
            self.logger.error(f"Failed to update real-time analytics: {e}")

    async def _update_agent_task_performance(
        self,
        agent_id: UUID,
        task_type: str,
        success: bool,
        execution_time_ms: float
    ):
        """Update agent task performance tracking."""
        try:
            if agent_id not in self._agent_performance:
                self._agent_performance[agent_id] = {}

            task_key = f"task_{task_type}"
            if task_key not in self._agent_performance[agent_id]:
                self._agent_performance[agent_id][task_key] = {
                    "total_tasks": 0,
                    "successful_tasks": 0,
                    "failed_tasks": 0,
                    "total_execution_time": 0.0,
                    "min_execution_time": float('inf'),
                    "max_execution_time": 0.0,
                    "recent_times": deque(maxlen=50)
                }

            task_perf = self._agent_performance[agent_id][task_key]
            task_perf["total_tasks"] += 1
            task_perf["total_execution_time"] += execution_time_ms
            task_perf["recent_times"].append(execution_time_ms)

            if success:
                task_perf["successful_tasks"] += 1
            else:
                task_perf["failed_tasks"] += 1

            # Update min/max execution times
            task_perf["min_execution_time"] = min(task_perf["min_execution_time"], execution_time_ms)
            task_perf["max_execution_time"] = max(task_perf["max_execution_time"], execution_time_ms)

            # Calculate success rate
            task_perf["success_rate"] = task_perf["successful_tasks"] / task_perf["total_tasks"]

            # Calculate average execution time
            task_perf["avg_execution_time"] = task_perf["total_execution_time"] / task_perf["total_tasks"]

        except Exception as e:
            self.logger.error(f"Failed to update agent task performance: {e}")

    def _classify_error(self, error_message: str) -> str:
        """Classify error type from error message."""
        error_lower = error_message.lower()

        if "timeout" in error_lower:
            return "timeout"
        elif "connection" in error_lower or "network" in error_lower:
            return "connection"
        elif "permission" in error_lower or "unauthorized" in error_lower:
            return "permission"
        elif "not found" in error_lower or "missing" in error_lower:
            return "not_found"
        elif "validation" in error_lower or "invalid" in error_lower:
            return "validation"
        else:
            return "unknown"

    async def _metrics_collection_loop(self):
        """Background loop for collecting system metrics."""
        while True:
            try:
                # Collect system-wide metrics
                await self._collect_system_metrics()

                # Wait for next collection
                await asyncio.sleep(self._buffer_flush_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Metrics collection loop error: {e}")
                await asyncio.sleep(5)

    async def _aggregation_loop(self):
        """Background loop for computing metric aggregations."""
        while True:
            try:
                # Flush metrics buffer to storage
                await self._flush_metrics_buffer()

                # Compute aggregations for different intervals
                for interval in self._aggregation_intervals:
                    await self._compute_interval_aggregations(interval)

                # Wait for next aggregation cycle
                await asyncio.sleep(60)  # Run every minute

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Aggregation loop error: {e}")
                await asyncio.sleep(30)

    async def _alert_evaluation_loop(self):
        """Background loop for evaluating alerts."""
        while True:
            try:
                # Evaluate all active alerts
                for alert in self._alerts.values():
                    if alert.is_active:
                        await self._evaluate_alert(alert)

                # Wait for next evaluation cycle
                await asyncio.sleep(self._alert_evaluation_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Alert evaluation loop error: {e}")
                await asyncio.sleep(30)

    async def _cleanup_loop(self):
        """Background loop for cleanup operations."""
        while True:
            try:
                # Clean up old metrics
                cutoff_time = datetime.utcnow() - timedelta(hours=self._metric_retention_hours)
                await self._cleanup_old_metrics(cutoff_time)

                # Clean up resolved alerts older than 24 hours
                alert_cutoff = datetime.utcnow() - timedelta(hours=24)
                await self._cleanup_old_alerts(alert_cutoff)

                # Wait for next cleanup cycle
                await asyncio.sleep(3600)  # Run every hour

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(300)

    async def _flush_metrics_buffer(self):
        """Flush metrics buffer to persistent storage."""
        try:
            if not self._metrics_buffer:
                return

            # Collect all metrics from buffer
            all_metrics = []
            for buffer_key, metric_deque in self._metrics_buffer.items():
                while metric_deque:
                    all_metrics.append(metric_deque.popleft())

            if all_metrics:
                # Store in Redis (time series)
                await self._store_metrics_batch(all_metrics)

                # Also store in database for long-term storage
                await self._store_metrics_in_db(all_metrics)

            self.logger.debug(f"Flushed {len(all_metrics)} metrics to storage")

        except Exception as e:
            self.logger.error(f"Failed to flush metrics buffer: {e}")

    async def _store_metrics_batch(self, metrics: List[PerformanceMetric]):
        """Store a batch of metrics in Redis."""
        try:
            pipe = redis_client.pipeline()

            for metric in metrics:
                # Store in time series
                key = f"metrics:{metric.metric_name}"
                timestamp = int(metric.timestamp.timestamp())
                value = metric.value

                # Store as sorted set for time series queries
                await redis_client.zadd(
                    key,
                    {json.dumps(metric.to_dict()): timestamp}
                )

                # Set expiration for time series data
                await redis_client.expire(key, timedelta(hours=self._metric_retention_hours))

            # Execute pipeline
            await pipe.execute()

        except Exception as e:
            self.logger.error(f"Failed to store metrics batch in Redis: {e}")

    async def _store_metrics_in_db(self, metrics: List[PerformanceMetric]):
        """Store metrics in database for long-term storage."""
        # Implementation would depend on your database schema
        # This is a placeholder for the database storage logic
        pass

    async def _collect_system_metrics(self):
        """Collect system-wide performance metrics."""
        try:
            # Collect metrics about the performance service itself
            total_metrics = sum(len(deque) for deque in self._metrics_buffer.values())
            total_agents = len(self._agent_performance)
            active_alerts = len([a for a in self._alerts.values() if a.is_active])

            await self.record_metric(
                agent_id=UUID('00000000-0000-0000-0000-000000000000'),  # System ID
                metric_name="system_metrics_buffer_size",
                value=total_metrics,
                metric_type=MetricType.GAUGE,
                tags={"service": "performance_analytics"}
            )

            await self.record_metric(
                agent_id=UUID('00000000-0000-0000-0000-000000000000'),
                metric_name="active_monitored_agents",
                value=total_agents,
                metric_type=MetricType.GAUGE,
                tags={"service": "performance_analytics"}
            )

            await self.record_metric(
                agent_id=UUID('00000000-0000-0000-0000-000000000000'),
                metric_name="active_performance_alerts",
                value=active_alerts,
                metric_type=MetricType.GAUGE,
                tags={"service": "performance_analytics"}
            )

        except Exception as e:
            self.logger.error(f"Failed to collect system metrics: {e}")

    # Additional helper methods would be implemented here
    # For brevity, I'll include key method signatures

    async def _evaluate_alert(self, alert: PerformanceAlert):
        """Evaluate if an alert condition is met."""
        pass

    async def _retrieve_agent_metrics(
        self,
        agent_id: UUID,
        metric_names: Optional[List[str]],
        start_time: datetime,
        end_time: datetime
    ) -> List[PerformanceMetric]:
        """Retrieve metrics for an agent from storage."""
        return []

    async def _compute_aggregations(
        self,
        metrics: List[PerformanceMetric],
        aggregation_types: List[AggregationType],
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, List[MetricAggregation]]:
        """Compute metric aggregations."""
        return {}

    async def _group_metrics_by_name(
        self,
        metrics: List[PerformanceMetric]
    ) -> Dict[str, List[MetricAggregation]]:
        """Group metrics by name."""
        return {}

    async def _compute_interval_aggregations(self, interval_seconds: int):
        """Compute aggregations for a specific time interval."""
        pass

    async def _cleanup_old_metrics(self, cutoff_time: datetime):
        """Clean up metrics older than cutoff time."""
        pass

    async def _cleanup_old_alerts(self, cutoff_time: datetime):
        """Clean up old resolved alerts."""
        pass

    async def _store_alert(self, alert: PerformanceAlert):
        """Store alert in Redis."""
        try:
            key = f"alert:{alert.alert_id}"
            await redis_client.setex(
                key,
                timedelta(days=7),
                json.dumps(alert.to_dict())
            )
        except Exception as e:
            self.logger.error(f"Failed to store alert: {e}")

    async def _generate_insights(
        self,
        metrics_data: Dict[str, Any],
        agent_id: Optional[UUID]
    ) -> List[str]:
        """Generate insights from metrics data."""
        return []

    async def _generate_recommendations(
        self,
        metrics_data: Dict[str, Any],
        insights: List[str],
        agent_id: Optional[UUID]
    ) -> List[str]:
        """Generate recommendations based on metrics and insights."""
        return []

    async def _identify_trends(self, metrics_data: Dict[str, Any]) -> Dict[str, str]:
        """Identify trends in metrics data."""
        return {}

    async def _get_system_metrics(self, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
        """Get system-wide metrics for a time period."""
        return {}

    async def _analyze_metric_trend(self, metric_list: List[MetricAggregation]) -> Dict[str, Any]:
        """Analyze trend for a specific metric."""
        return {}

    async def _summarize_trends(self, trends: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize overall trends."""
        return {}


# Global performance analytics service instance
performance_analytics = PerformanceAnalyticsService()


def get_performance_analytics() -> PerformanceAnalyticsService:
    """Get the global performance analytics service instance."""
    return performance_analytics