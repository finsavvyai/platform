"""
Task Monitoring Service with WebSocket Support

This service provides real-time task monitoring capabilities with WebSocket connections
for live updates, comprehensive performance analytics, and intelligent alerting.

Key Features:
- Real-time WebSocket connections for live task monitoring
- Performance metrics aggregation and analytics
- Intelligent alerting and anomaly detection
- Historical data analysis and trend reporting
- Custom dashboard creation and sharing
- Integration with the task execution service
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
from uuid import UUID, uuid4

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

from app.core.logging import LoggerMixin
from app.core.redis import redis_client
from app.models.task import Task as DBTask
from app.services.task_executor import (
    TaskExecutionEvent, ResourceMetrics, get_task_executor
)


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertType(str, Enum):
    """Types of monitoring alerts"""
    TASK_FAILURE = "task_failure"
    TASK_TIMEOUT = "task_timeout"
    RESOURCE_HIGH = "resource_high"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    AGENT_UNAVAILABLE = "agent_unavailable"
    SYSTEM_LOAD = "system_load"
    ANOMALY_DETECTED = "anomaly_detected"


class MonitoringAlert(BaseModel):
    """Monitoring alert definition"""
    id: UUID = Field(default_factory=uuid4)
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    description: str
    task_id: Optional[UUID] = None
    agent_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    resolved: bool = False


class PerformanceTrend(BaseModel):
    """Performance trend data"""
    metric_name: str
    time_period: str  # hour, day, week, month
    data_points: List[Dict[str, Any]]
    trend_direction: str  # up, down, stable
    trend_percentage: float
    anomaly_score: float


class DashboardConfig(BaseModel):
    """Dashboard configuration"""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    user_id: UUID
    widgets: List[Dict[str, Any]] = Field(default_factory=list)
    filters: Dict[str, Any] = Field(default_factory=dict)
    refresh_interval: int = 30  # seconds
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_public: bool = False


class WebSocketConnection(BaseModel):
    """WebSocket connection information"""
    websocket: WebSocket
    connection_id: UUID = Field(default_factory=uuid4)
    user_id: Optional[UUID] = None
    subscribed_tasks: Set[UUID] = Field(default_factory=set)
    subscribed_alerts: bool = False
    last_ping: datetime = Field(default_factory=datetime.utcnow)
    filters: Dict[str, Any] = Field(default_factory=dict)


class TaskMonitorService(LoggerMixin):
    """
    Comprehensive task monitoring service with real-time WebSocket support.

    Provides:
    - Real-time task status updates via WebSocket
    - Performance metrics collection and analysis
    - Intelligent alerting and anomaly detection
    - Historical data analysis and trend reporting
    - Custom dashboard configurations
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.redis = redis_client

        # WebSocket connections
        self.connections: Dict[UUID, WebSocketConnection] = {}
        self._connection_lock = asyncio.Lock()

        # Monitoring state
        self._monitoring_active = False
        self._monitor_task: Optional[asyncio.Task] = None
        self._alert_processors: Dict[AlertType, callable] = {}

        # Performance data cache
        self._performance_cache: Dict[str, Any] = {}
        self._cache_expiry: Dict[str, datetime] = {}

        # Alert management
        self._active_alerts: Dict[UUID, MonitoringAlert] = {}
        self._alert_rules: List[Dict[str, Any]] = []

        self.logger = logging.getLogger(self.__class__.__name__)

        # Initialize alert processors
        self._initialize_alert_processors()

    async def start(self):
        """Start the monitoring service"""
        self.log_event("Starting TaskMonitorService")

        self._monitoring_active = True
        self._monitor_task = asyncio.create_task(self._monitoring_loop())

        # Start Redis event listener
        asyncio.create_task(self._redis_event_listener())

        self.log_event("TaskMonitorService started successfully")

    async def stop(self):
        """Stop the monitoring service"""
        self.log_event("Stopping TaskMonitorService")

        self._monitoring_active = False

        # Cancel monitoring task
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

        # Close all WebSocket connections
        for connection in list(self.connections.values()):
            try:
                await connection.websocket.close()
            except Exception:
                pass
        self.connections.clear()

        self.log_event("TaskMonitorService stopped")

    async def connect_websocket(
        self,
        websocket: WebSocket,
        user_id: Optional[UUID] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> UUID:
        """
        Accept a WebSocket connection for real-time monitoring.

        Args:
            websocket: WebSocket connection
            user_id: User ID for authentication
            filters: Optional filters for events

        Returns:
            Connection ID
        """
        await websocket.accept()

        connection = WebSocketConnection(
            websocket=websocket,
            user_id=user_id,
            filters=filters or {}
        )

        async with self._connection_lock:
            self.connections[connection.connection_id] = connection

        self.log_event("WebSocket connected", connection_id=connection.connection_id)

        # Send initial data
        await self._send_initial_data(connection)

        return connection.connection_id

    async def disconnect_websocket(self, connection_id: UUID):
        """Disconnect a WebSocket connection"""
        async with self._connection_lock:
            if connection_id in self.connections:
                connection = self.connections[connection_id]
                try:
                    await connection.websocket.close()
                except Exception:
                    pass
                del self.connections[connection_id]

        self.log_event("WebSocket disconnected", connection_id=connection_id)

    async def subscribe_to_task(
        self,
        connection_id: UUID,
        task_id: UUID
    ):
        """Subscribe a connection to specific task updates"""
        async with self._connection_lock:
            if connection_id in self.connections:
                self.connections[connection_id].subscribed_tasks.add(task_id)

        self.log_event("Subscribed to task", connection_id=connection_id, task_id=task_id)

    async def subscribe_to_alerts(
        self,
        connection_id: UUID,
        subscribe: bool = True
    ):
        """Subscribe/unsubscribe a connection to alert updates"""
        async with self._connection_lock:
            if connection_id in self.connections:
                self.connections[connection_id].subscribed_alerts = subscribe

        self.log_event("Alert subscription updated", connection_id=connection_id, subscribe=subscribe)

    async def create_alert(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        description: str,
        task_id: Optional[UUID] = None,
        agent_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> MonitoringAlert:
        """
        Create a new monitoring alert.

        Args:
            alert_type: Type of alert
            severity: Alert severity
            title: Alert title
            description: Alert description
            task_id: Related task ID
            agent_id: Related agent ID
            user_id: User ID to notify
            data: Additional alert data

        Returns:
            Created alert
        """
        alert = MonitoringAlert(
            alert_type=alert_type,
            severity=severity,
            title=title,
            description=description,
            task_id=task_id,
            agent_id=agent_id,
            user_id=user_id,
            data=data or {}
        )

        # Store alert
        self._active_alerts[alert.id] = alert

        # Cache in Redis
        await self.redis.set(
            f"alert:{alert.id}",
            alert.dict(),
            expire=3600  # 1 hour
        )

        # Broadcast to relevant connections
        await self._broadcast_alert(alert)

        # Process alert based on type
        if alert_type in self._alert_processors:
            try:
                await self._alert_processors[alert_type](alert)
            except Exception as e:
                self.log_error("Alert processor failed", alert_type=alert_type, error=str(e))

        self.log_event("Alert created", alert_id=alert.id, alert_type=alert_type)

        return alert

    async def get_active_alerts(
        self,
        user_id: Optional[UUID] = None,
        severity: Optional[AlertSeverity] = None,
        limit: int = 100
    ) -> List[MonitoringAlert]:
        """Get active alerts with optional filtering"""
        alerts = list(self._active_alerts.values())

        # Apply filters
        if user_id:
            alerts = [a for a in alerts if a.user_id == user_id]

        if severity:
            alerts = [a for a in alerts if a.severity == severity]

        # Sort by creation time (newest first)
        alerts.sort(key=lambda a: a.created_at, reverse=True)

        return alerts[:limit]

    async def get_performance_trends(
        self,
        metric_names: List[str],
        time_period: str = "hour",
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[PerformanceTrend]:
        """
        Get performance trends for specified metrics.

        Args:
            metric_names: List of metric names to analyze
            time_period: Time period for trend analysis (hour, day, week, month)
            start_time: Start time for analysis
            end_time: End time for analysis

        Returns:
            List of performance trends
        """
        if not start_time:
            if time_period == "hour":
                start_time = datetime.utcnow() - timedelta(hours=1)
            elif time_period == "day":
                start_time = datetime.utcnow() - timedelta(days=1)
            elif time_period == "week":
                start_time = datetime.utcnow() - timedelta(weeks=1)
            else:  # month
                start_time = datetime.utcnow() - timedelta(days=30)

        if not end_time:
            end_time = datetime.utcnow()

        trends = []

        for metric_name in metric_names:
            try:
                # Get metric data from database or cache
                data_points = await self._get_metric_data(
                    metric_name, start_time, end_time
                )

                # Analyze trend
                trend_direction, trend_percentage = self._analyze_trend(data_points)

                # Detect anomalies
                anomaly_score = self._detect_anomalies(data_points)

                trend = PerformanceTrend(
                    metric_name=metric_name,
                    time_period=time_period,
                    data_points=data_points,
                    trend_direction=trend_direction,
                    trend_percentage=trend_percentage,
                    anomaly_score=anomaly_score
                )

                trends.append(trend)

            except Exception as e:
                self.log_error("Failed to analyze trend", metric=metric_name, error=str(e))

        return trends

    async def create_dashboard(
        self,
        name: str,
        user_id: UUID,
        description: Optional[str] = None,
        widgets: Optional[List[Dict[str, Any]]] = None,
        filters: Optional[Dict[str, Any]] = None,
        refresh_interval: int = 30
    ) -> DashboardConfig:
        """
        Create a custom monitoring dashboard.

        Args:
            name: Dashboard name
            user_id: User ID creating the dashboard
            description: Dashboard description
            widgets: List of dashboard widgets
            filters: Dashboard filters
            refresh_interval: Refresh interval in seconds

        Returns:
            Created dashboard configuration
        """
        dashboard = DashboardConfig(
            name=name,
            description=description,
            user_id=user_id,
            widgets=widgets or [],
            filters=filters or {},
            refresh_interval=refresh_interval
        )

        # Cache dashboard configuration
        await self.redis.set(
            f"dashboard:{dashboard.id}",
            dashboard.dict(),
            expire=86400  # 24 hours
        )

        self.log_event("Dashboard created", dashboard_id=dashboard.id, user_id=user_id)

        return dashboard

    async def get_dashboard_data(
        self,
        dashboard_id: UUID,
        user_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get data for a specific dashboard.

        Args:
            dashboard_id: Dashboard ID
            user_id: User ID requesting the data

        Returns:
            Dashboard data or None if not found/authorized
        """
        # Get dashboard configuration
        dashboard_data = await self.redis.get(f"dashboard:{dashboard_id}")
        if not dashboard_data:
            return None

        dashboard = DashboardConfig(**dashboard_data)

        # Check authorization
        if dashboard.user_id != user_id and not dashboard.is_public:
            return None

        # Collect data for each widget
        widget_data = []
        for widget in dashboard.widgets:
            try:
                data = await self._get_widget_data(widget, dashboard.filters)
                widget_data.append({
                    "widget_id": widget.get("id"),
                    "data": data
                })
            except Exception as e:
                self.log_error("Failed to get widget data", widget_id=widget.get("id"), error=str(e))

        return {
            "dashboard": dashboard.dict(),
            "widget_data": widget_data,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def _monitoring_loop(self):
        """Main monitoring loop for data collection and analysis"""
        while self._monitoring_active:
            try:
                # Collect system metrics
                await self._collect_system_metrics()

                # Analyze performance data
                await self._analyze_performance_data()

                # Check alert conditions
                await self._check_alert_conditions()

                # Clean up expired data
                await self._cleanup_expired_data()

                # Sleep before next iteration
                await asyncio.sleep(30)  # Monitor every 30 seconds

            except Exception as e:
                self.log_error("Monitoring loop error", error=str(e))
                await asyncio.sleep(5)

    async def _redis_event_listener(self):
        """Listen for task execution events from Redis"""
        try:
            while self._monitoring_active:
                # Get next event from Redis list
                event_data = await self.redis.rpop("task_events")
                if event_data:
                    try:
                        event = TaskExecutionEvent(**event_data)
                        await self._process_task_event(event)
                    except Exception as e:
                        self.log_error("Failed to process task event", error=str(e))

                await asyncio.sleep(1)  # Check every second

        except Exception as e:
            self.log_error("Redis event listener error", error=str(e))

    async def _process_task_event(self, event: TaskExecutionEvent):
        """Process a task execution event"""
        # Broadcast to relevant WebSocket connections
        await self._broadcast_task_event(event)

        # Check for alert conditions
        await self._check_task_alerts(event)

        # Update performance metrics
        await self._update_performance_metrics(event)

    async def _broadcast_task_event(self, event: TaskExecutionEvent):
        """Broadcast task event to subscribed WebSocket connections"""
        for connection in list(self.connections.values()):
            try:
                # Check if connection is interested in this event
                if self._should_send_event(connection, event):
                    message = {
                        "type": "task_event",
                        "data": event.dict()
                    }
                    await connection.websocket.send_text(json.dumps(message))

                    # Update last ping
                    connection.last_ping = datetime.utcnow()

            except Exception as e:
                self.log_error("Failed to broadcast event", connection_id=connection.connection_id, error=str(e))

    async def _broadcast_alert(self, alert: MonitoringAlert):
        """Broadcast alert to relevant WebSocket connections"""
        for connection in list(self.connections.values()):
            try:
                # Send to users subscribed to alerts or specific user
                if connection.subscribed_alerts or connection.user_id == alert.user_id:
                    message = {
                        "type": "alert",
                        "data": alert.dict()
                    }
                    await connection.websocket.send_text(json.dumps(message))

            except Exception as e:
                self.log_error("Failed to broadcast alert", connection_id=connection.connection_id, error=str(e))

    def _should_send_event(self, connection: WebSocketConnection, event: TaskExecutionEvent) -> bool:
        """Check if a connection should receive a specific event"""
        # Check if subscribed to specific task
        if event.task_id in connection.subscribed_tasks:
            return True

        # Check filters
        filters = connection.filters

        # Task type filter
        if "task_types" in filters:
            task_type = event.data.get("task_type")
            if task_type and task_type not in filters["task_types"]:
                return False

        # User filter
        if "user_id" in filters:
            if event.user_id != UUID(filters["user_id"]):
                return False

        return True

    async def _send_initial_data(self, connection: WebSocketConnection):
        """Send initial data to a new WebSocket connection"""
        try:
            # Send system status
            system_status = await self._get_system_status()
            await connection.websocket.send_text(json.dumps({
                "type": "system_status",
                "data": system_status
            }))

            # Send active alerts if subscribed
            if connection.subscribed_alerts:
                alerts = await self.get_active_alerts(user_id=connection.user_id)
                await connection.websocket.send_text(json.dumps({
                    "type": "active_alerts",
                    "data": [alert.dict() for alert in alerts]
                }))

        except Exception as e:
            self.log_error("Failed to send initial data", connection_id=connection.connection_id, error=str(e))

    async def _collect_system_metrics(self):
        """Collect system-wide metrics"""
        try:
            # Get system metrics from Redis (cached by task executor)
            system_metrics = await self.redis.get("system_metrics")
            if system_metrics:
                # Cache for dashboard access
                self._performance_cache["system_metrics"] = system_metrics
                self._cache_expiry["system_metrics"] = datetime.utcnow() + timedelta(minutes=1)

        except Exception as e:
            self.log_error("Failed to collect system metrics", error=str(e))

    async def _analyze_performance_data(self):
        """Analyze performance data for trends and anomalies"""
        try:
            # Analyze task execution times
            await self._analyze_execution_times()

            # Analyze resource usage
            await self._analyze_resource_usage()

            # Analyze agent performance
            await self._analyze_agent_performance()

        except Exception as e:
            self.log_error("Failed to analyze performance data", error=str(e))

    async def _check_alert_conditions(self):
        """Check for alert conditions"""
        try:
            # Check system resource alerts
            await self._check_system_alerts()

            # Check performance degradation alerts
            await self._check_performance_alerts()

            # Check agent availability alerts
            await self._check_agent_alerts()

        except Exception as e:
            self.log_error("Failed to check alert conditions", error=str(e))

    async def _cleanup_expired_data(self):
        """Clean up expired monitoring data"""
        try:
            # Clean up expired performance cache entries
            now = datetime.utcnow()
            expired_keys = [
                key for key, expiry in self._cache_expiry.items()
                if expiry < now
            ]

            for key in expired_keys:
                del self._performance_cache[key]
                del self._cache_expiry[key]

            # Clean up resolved alerts older than 24 hours
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            expired_alerts = [
                alert_id for alert_id, alert in self._active_alerts.items()
                if alert.resolved and alert.resolved_at and alert.resolved_at < cutoff_time
            ]

            for alert_id in expired_alerts:
                del self._active_alerts[alert_id]

        except Exception as e:
            self.log_error("Failed to cleanup expired data", error=str(e))

    def _initialize_alert_processors(self):
        """Initialize alert processors for different alert types"""
        self._alert_processors = {
            AlertType.TASK_FAILURE: self._process_task_failure_alert,
            AlertType.TASK_TIMEOUT: self._process_task_timeout_alert,
            AlertType.RESOURCE_HIGH: self._process_resource_alert,
            AlertType.PERFORMANCE_DEGRADATION: self._process_performance_alert,
            AlertType.AGENT_UNAVAILABLE: self._process_agent_alert,
            AlertType.SYSTEM_LOAD: self._process_system_alert,
            AlertType.ANOMALY_DETECTED: self._process_anomaly_alert
        }

    # Alert processors
    async def _process_task_failure_alert(self, alert: MonitoringAlert):
        """Process task failure alert"""
        self.log_warning("Task failure alert", alert_id=alert.id, task_id=alert.task_id)

    async def _process_task_timeout_alert(self, alert: MonitoringAlert):
        """Process task timeout alert"""
        self.log_warning("Task timeout alert", alert_id=alert.id, task_id=alert.task_id)

    async def _process_resource_alert(self, alert: MonitoringAlert):
        """Process high resource usage alert"""
        self.log_warning("Resource alert", alert_id=alert.id, data=alert.data)

    async def _process_performance_alert(self, alert: MonitoringAlert):
        """Process performance degradation alert"""
        self.log_warning("Performance alert", alert_id=alert.id, data=alert.data)

    async def _process_agent_alert(self, alert: MonitoringAlert):
        """Process agent availability alert"""
        self.log_warning("Agent alert", alert_id=alert.id, agent_id=alert.agent_id)

    async def _process_system_alert(self, alert: MonitoringAlert):
        """Process system load alert"""
        self.log_warning("System alert", alert_id=alert.id, data=alert.data)

    async def _process_anomaly_alert(self, alert: MonitoringAlert):
        """Process anomaly detection alert"""
        self.log_warning("Anomaly alert", alert_id=alert.id, data=alert.data)

    # Helper methods for analytics and data processing
    async def _get_system_status(self) -> Dict[str, Any]:
        """Get current system status"""
        try:
            # Get task executor status
            task_executor = await get_task_executor(self.db)
            executor_status = await task_executor.get_system_status()

            # Add monitoring service status
            executor_status["monitoring_active"] = self._monitoring_active
            executor_status["active_connections"] = len(self.connections)
            executor_status["active_alerts"] = len(self._active_alerts)

            return executor_status

        except Exception as e:
            self.log_error("Failed to get system status", error=str(e))
            return {
                "monitoring_active": self._monitoring_active,
                "active_connections": len(self.connections),
                "active_alerts": len(self._active_alerts),
                "error": str(e)
            }

    async def _get_metric_data(
        self,
        metric_name: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """Get metric data for analysis"""
        # This would typically query a time-series database
        # For now, return mock data
        return []

    def _analyze_trend(self, data_points: List[Dict[str, Any]]) -> tuple[str, float]:
        """Analyze trend direction and percentage"""
        # Simplified trend analysis
        if len(data_points) < 2:
            return "stable", 0.0

        first_value = data_points[0].get("value", 0)
        last_value = data_points[-1].get("value", 0)

        if first_value == 0:
            return "stable", 0.0

        change_percent = ((last_value - first_value) / first_value) * 100

        if abs(change_percent) < 5:
            return "stable", change_percent
        elif change_percent > 0:
            return "up", change_percent
        else:
            return "down", change_percent

    def _detect_anomalies(self, data_points: List[Dict[str, Any]]) -> float:
        """Detect anomalies in metric data"""
        # Simplified anomaly detection
        if len(data_points) < 3:
            return 0.0

        values = [point.get("value", 0) for point in data_points]
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        std_dev = variance ** 0.5

        # Calculate anomaly score based on standard deviations
        max_deviation = max(abs(x - mean) / std_dev if std_dev > 0 else 0 for x in values)

        # Normalize to 0-1 scale
        return min(max_deviation / 3.0, 1.0)

    async def _get_widget_data(self, widget: Dict[str, Any], filters: Dict[str, Any]) -> Dict[str, Any]:
        """Get data for a dashboard widget"""
        widget_type = widget.get("type")

        if widget_type == "task_status":
            return await self._get_task_status_widget_data(widget, filters)
        elif widget_type == "performance_metrics":
            return await self._get_performance_widget_data(widget, filters)
        elif widget_type == "resource_usage":
            return await self._get_resource_widget_data(widget, filters)
        elif widget_type == "alerts":
            return await self._get_alerts_widget_data(widget, filters)
        else:
            return {"error": f"Unknown widget type: {widget_type}"}

    # Widget data providers (comprehensive implementations)
    async def _get_task_status_widget_data(self, widget: Dict[str, Any], filters: Dict[str, Any]) -> Dict[str, Any]:
        """Get data for task status widget"""
        try:
            executor = await get_task_executor(self.db)

            # Get task counts by status
            running_tasks = await executor.get_running_tasks()
            pending_tasks = await executor.get_pending_tasks()
            completed_tasks = await executor.get_completed_tasks(hours=24)
            failed_tasks = await executor.get_failed_tasks(hours=24)

            # Calculate success rate
            total_recent_tasks = len(completed_tasks) + len(failed_tasks)
            success_rate = (len(completed_tasks) / total_recent_tasks * 100) if total_recent_tasks > 0 else 100

            # Get recent task trends
            current_time = datetime.utcnow()
            task_trends = []
            for hours_ago in range(24, 0, -2):  # Last 24 hours in 2-hour intervals
                time_point = current_time - timedelta(hours=hours_ago)
                tasks_in_window = await executor.get_tasks_in_time_range(
                    time_point - timedelta(hours=2),
                    time_point
                )
                task_trends.append({
                    "timestamp": time_point.isoformat(),
                    "completed": len([t for t in tasks_in_window if t.status == "completed"]),
                    "failed": len([t for t in tasks_in_window if t.status == "failed"]),
                    "running": len([t for t in tasks_in_window if t.status == "running"])
                })

            # Agent performance breakdown
            agent_performance = {}
            for task in running_tasks + completed_tasks + failed_tasks:
                if hasattr(task, 'agent_id') and task.agent_id:
                    agent_id = str(task.agent_id)
                    if agent_id not in agent_performance:
                        agent_performance[agent_id] = {
                            "running": 0,
                            "completed": 0,
                            "failed": 0,
                            "total_time": 0
                        }

                    if task.status == "running":
                        agent_performance[agent_id]["running"] += 1
                    elif task.status == "completed":
                        agent_performance[agent_id]["completed"] += 1
                        if hasattr(task, 'execution_time_ms'):
                            agent_performance[agent_id]["total_time"] += task.execution_time_ms
                    elif task.status == "failed":
                        agent_performance[agent_id]["failed"] += 1

            return {
                "summary": {
                    "running": len(running_tasks),
                    "pending": len(pending_tasks),
                    "completed_24h": len(completed_tasks),
                    "failed_24h": len(failed_tasks),
                    "success_rate": round(success_rate, 2)
                },
                "trends": task_trends,
                "agent_performance": agent_performance,
                "recent_tasks": [
                    {
                        "id": str(task.id),
                        "name": task.name,
                        "status": task.status,
                        "created_at": task.created_at.isoformat(),
                        "agent_id": str(task.agent_id) if hasattr(task, 'agent_id') and task.agent_id else None
                    }
                    for task in (running_tasks + completed_tasks + failed_tasks)[:10]
                ]
            }

        except Exception as e:
            self.logger.error(f"Error getting task status widget data: {e}")
            return {"error": str(e), "summary": {}, "trends": [], "agent_performance": {}}

    async def _get_performance_widget_data(self, widget: Dict[str, Any], filters: Dict[str, Any]) -> Dict[str, Any]:
        """Get data for performance widget"""
        try:
            executor = await get_task_executor(self.db)

            # Get performance metrics
            time_range = widget.get("time_range", "hour")  # hour, day, week

            # Performance trends over time
            performance_trends = await executor.get_performance_trends(time_range=time_range)

            # Get system metrics from cache or calculate
            system_metrics = await self.redis.get("system_metrics") or {}

            # Task execution time analysis
            execution_times = await executor.get_execution_time_analysis(time_range=time_range)

            # Agent response times
            agent_response_times = await executor.get_agent_response_times(time_range=time_range)

            # Calculate performance score
            performance_score = self._calculate_performance_score({
                "avg_execution_time": execution_times.get("average_ms", 0),
                "success_rate": execution_times.get("success_rate", 100),
                "agent_response_time": agent_response_times.get("average_ms", 0),
                "system_load": system_metrics.get("cpu", 0)
            })

            return {
                "performance_score": performance_score,
                "execution_times": execution_times,
                "agent_response_times": agent_response_times,
                "system_metrics": {
                    "cpu_usage": system_metrics.get("cpu", 0),
                    "memory_usage": system_metrics.get("memory", 0),
                    "disk_usage": system_metrics.get("disk", 0),
                    "network_io": system_metrics.get("network", {"in": 0, "out": 0})
                },
                "trends": performance_trends,
                "time_range": time_range
            }

        except Exception as e:
            self.logger.error(f"Error getting performance widget data: {e}")
            return {"error": str(e), "performance_score": 0, "execution_times": {}, "trends": []}

    async def _get_resource_widget_data(self, widget: Dict[str, Any], filters: Dict[str, Any]) -> Dict[str, Any]:
        """Get data for resource usage widget"""
        try:
            executor = await get_task_executor(self.db)

            # Get current resource metrics
            current_metrics = await executor.get_system_resources()

            # Get historical resource data
            time_range = widget.get("time_range", "hour")
            resource_history = await executor.get_resource_history(time_range=time_range)

            # Calculate resource efficiency
            resource_efficiency = {
                "cpu_efficiency": self._calculate_resource_efficiency(
                    resource_history, "cpu", target_utilization=70
                ),
                "memory_efficiency": self._calculate_resource_efficiency(
                    resource_history, "memory", target_utilization=75
                ),
                "disk_efficiency": self._calculate_resource_efficiency(
                    resource_history, "disk", target_utilization=80
                )
            }

            # Resource predictions
            resource_predictions = self._predict_resource_usage(resource_history)

            # Identify resource bottlenecks
            bottlenecks = self._identify_resource_bottlenecks(current_metrics, resource_history)

            return {
                "current": current_metrics,
                "history": resource_history,
                "efficiency": resource_efficiency,
                "predictions": resource_predictions,
                "bottlenecks": bottlenecks,
                "alerts": self._generate_resource_alerts(current_metrics, bottlenecks)
            }

        except Exception as e:
            self.logger.error(f"Error getting resource widget data: {e}")
            return {"error": str(e), "current": {}, "history": [], "efficiency": {}}

    async def _get_alerts_widget_data(self, widget: Dict[str, Any], filters: Dict[str, Any]) -> Dict[str, Any]:
        """Get data for alerts widget"""
        try:
            # Filter settings
            severity_filter = widget.get("severity_filter")
            alert_type_filter = widget.get("type_filter")
            limit = widget.get("limit", 50)

            # Get recent alerts
            time_range = widget.get("time_range", "day")
            recent_alerts = await self.get_recent_alerts(
                time_range=time_range,
                severity=severity_filter,
                alert_type=alert_type_filter,
                limit=limit
            )

            # Alert statistics
            alert_stats = {
                "total": len(recent_alerts),
                "by_severity": {},
                "by_type": {},
                "resolved": len([a for a in recent_alerts if a.resolved]),
                "unresolved": len([a for a in recent_alerts if not a.resolved])
            }

            for alert in recent_alerts:
                # Count by severity
                severity_key = alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity)
                alert_stats["by_severity"][severity_key] = alert_stats["by_severity"].get(severity_key, 0) + 1

                # Count by type
                type_key = alert.alert_type.value if hasattr(alert.alert_type, 'value') else str(alert.alert_type)
                alert_stats["by_type"][type_key] = alert_stats["by_type"].get(type_key, 0) + 1

            # Alert trends
            alert_trends = await self.get_alert_trends(time_range=time_range)

            # Critical alerts requiring attention
            critical_alerts = [
                alert for alert in recent_alerts
                if (hasattr(alert, 'severity') and alert.severity == AlertSeverity.CRITICAL) or
                   (str(alert.severity).lower() == 'critical')
            ]

            return {
                "summary": alert_stats,
                "recent_alerts": [
                    {
                        "id": str(alert.id),
                        "title": alert.title,
                        "description": alert.description,
                        "severity": alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity),
                        "type": alert.alert_type.value if hasattr(alert.alert_type, 'value') else str(alert.alert_type),
                        "created_at": alert.created_at.isoformat(),
                        "resolved": alert.resolved,
                        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
                        "task_id": str(alert.task_id) if alert.task_id else None,
                        "agent_id": str(alert.agent_id) if alert.agent_id else None
                    }
                    for alert in recent_alerts
                ],
                "critical_alerts": [
                    {
                        "id": str(alert.id),
                        "title": alert.title,
                        "description": alert.description,
                        "created_at": alert.created_at.isoformat()
                    }
                    for alert in critical_alerts
                ],
                "trends": alert_trends,
                "time_range": time_range
            }

        except Exception as e:
            self.logger.error(f"Error getting alerts widget data: {e}")
            return {"error": str(e), "summary": {}, "recent_alerts": [], "trends": []}

    # Helper methods for comprehensive widget implementations
    def _calculate_performance_score(self, metrics: Dict[str, Any]) -> float:
        """Calculate overall performance score (0-100)"""
        score = 100.0

        # Deduct points for high execution times
        avg_time = metrics.get("avg_execution_time", 0)
        if avg_time > 10000:  # > 10 seconds
            score -= min(30, avg_time / 1000)
        elif avg_time > 5000:  # > 5 seconds
            score -= min(15, avg_time / 500)

        # Deduct points for low success rates
        success_rate = metrics.get("success_rate", 100)
        if success_rate < 90:
            score -= (90 - success_rate) * 0.5

        # Deduct points for slow agent responses
        agent_response = metrics.get("agent_response_time", 0)
        if agent_response > 2000:  # > 2 seconds
            score -= min(20, agent_response / 200)
        elif agent_response > 1000:  # > 1 second
            score -= min(10, agent_response / 200)

        # Deduct points for high system load
        system_load = metrics.get("system_load", 0)
        if system_load > 80:
            score -= (system_load - 80) * 0.5

        return max(0, min(100, round(score, 2)))

    def _calculate_resource_efficiency(
        self,
        resource_history: List[Dict[str, Any]],
        resource_type: str,
        target_utilization: float
    ) -> float:
        """Calculate resource efficiency score"""
        if not resource_history:
            return 0.0

        recent_values = [
            point.get(resource_type, 0)
            for point in resource_history[-10:]  # Last 10 data points
        ]

        if not recent_values:
            return 0.0

        avg_utilization = sum(recent_values) / len(recent_values)

        # Calculate efficiency based on how close to target utilization
        efficiency = 100 - abs(avg_utilization - target_utilization)

        # Bonus for stable utilization (low variance)
        if len(recent_values) > 1:
            variance = sum((x - avg_utilization) ** 2 for x in recent_values) / len(recent_values)
            stability_bonus = max(0, 10 - variance * 0.1)
            efficiency += stability_bonus

        return max(0, min(100, round(efficiency, 2)))

    def _predict_resource_usage(self, resource_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Simple resource usage prediction based on trends"""
        if len(resource_history) < 3:
            return {"trend": "stable", "prediction_1h": 0, "prediction_24h": 0}

        predictions = {}

        for resource_type in ["cpu", "memory", "disk"]:
            values = [point.get(resource_type, 0) for point in resource_history[-10:]]

            if len(values) >= 3:
                # Simple linear trend prediction
                recent_trend = (values[-1] - values[-3]) / 3  # Rate of change
                prediction_1h = max(0, min(100, values[-1] + recent_trend * 6))
                prediction_24h = max(0, min(100, values[-1] + recent_trend * 144))

                predictions[resource_type] = {
                    "trend": "increasing" if recent_trend > 1 else "decreasing" if recent_trend < -1 else "stable",
                    "current": values[-1],
                    "prediction_1h": round(prediction_1h, 2),
                    "prediction_24h": round(prediction_24h, 2),
                    "confidence": max(0, min(100, 100 - abs(recent_trend) * 10))
                }
            else:
                predictions[resource_type] = {
                    "trend": "stable",
                    "current": values[-1] if values else 0,
                    "prediction_1h": values[-1] if values else 0,
                    "prediction_24h": values[-1] if values else 0,
                    "confidence": 50
                }

        return predictions

    def _identify_resource_bottlenecks(
        self,
        current_metrics: Dict[str, Any],
        resource_history: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Identify current and potential resource bottlenecks"""
        bottlenecks = []

        # Check current utilization
        for resource_type in ["cpu", "memory", "disk"]:
            current_value = current_metrics.get(resource_type, 0)

            if current_value > 90:
                bottlenecks.append({
                    "type": resource_type,
                    "severity": "critical",
                    "current_value": current_value,
                    "threshold": 90,
                    "description": f"{resource_type.upper()} usage is critically high"
                })
            elif current_value > 80:
                bottlenecks.append({
                    "type": resource_type,
                    "severity": "warning",
                    "current_value": current_value,
                    "threshold": 80,
                    "description": f"{resource_type.upper()} usage is high"
                })

        # Check for rapid growth
        if len(resource_history) >= 5:
            for resource_type in ["cpu", "memory", "disk"]:
                recent_values = [point.get(resource_type, 0) for point in resource_history[-5:]]
                growth_rate = (recent_values[-1] - recent_values[0]) / max(1, recent_values[0]) * 100

                if growth_rate > 50:  # > 50% growth in recent period
                    bottlenecks.append({
                        "type": resource_type,
                        "severity": "warning",
                        "current_value": recent_values[-1],
                        "growth_rate": round(growth_rate, 2),
                        "description": f"{resource_type.upper()} usage is growing rapidly ({growth_rate:.1f}%)"
                    })

        return bottlenecks

    def _generate_resource_alerts(
        self,
        current_metrics: Dict[str, Any],
        bottlenecks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate alerts based on resource metrics and bottlenecks"""
        alerts = []

        for bottleneck in bottlenecks:
            alerts.append({
                "id": str(uuid4()),
                "type": "resource_alert",
                "severity": bottleneck["severity"],
                "title": f"{bottleneck['type'].upper()} Usage Alert",
                "description": bottleneck["description"],
                "current_value": bottleneck.get("current_value", 0),
                "threshold": bottleneck.get("threshold", 0),
                "growth_rate": bottleneck.get("growth_rate"),
                "recommendations": self._get_resource_recommendations(bottleneck)
            })

        return alerts

    def _get_resource_recommendations(self, bottleneck: Dict[str, Any]) -> List[str]:
        """Get recommendations for resource bottlenecks"""
        recommendations = []

        resource_type = bottleneck["type"]
        severity = bottleneck["severity"]

        if resource_type == "cpu":
            recommendations.extend([
                "Optimize task execution to reduce CPU usage",
                "Consider scaling to additional compute resources",
                "Review task parallelization and resource allocation"
            ])
        elif resource_type == "memory":
            recommendations.extend([
                "Monitor for memory leaks in long-running tasks",
                "Optimize data processing and caching strategies",
                "Consider increasing available memory"
            ])
        elif resource_type == "disk":
            recommendations.extend([
                "Implement log rotation and cleanup policies",
                "Archive old data and temporary files",
                "Monitor storage growth trends"
            ])

        if severity == "critical":
            recommendations.append("Immediate action required to prevent system degradation")

        return recommendations

    async def get_recent_alerts(
        self,
        time_range: str = "day",
        severity: Optional[AlertSeverity] = None,
        alert_type: Optional[AlertType] = None,
        limit: int = 50
    ) -> List[MonitoringAlert]:
        """Get recent alerts with optional filtering"""
        try:
            # Calculate time cutoff
            if time_range == "hour":
                cutoff = datetime.utcnow() - timedelta(hours=1)
            elif time_range == "day":
                cutoff = datetime.utcnow() - timedelta(days=1)
            elif time_range == "week":
                cutoff = datetime.utcnow() - timedelta(weeks=1)
            else:  # month
                cutoff = datetime.utcnow() - timedelta(days=30)

            # Get alerts from Redis cache
            alerts = []
            alert_keys = await self.redis.keys("alert:*")

            for alert_key in alert_keys[:limit * 2]:  # Get more than needed for filtering
                try:
                    alert_data = await self.redis.get(alert_key)
                    if alert_data:
                        alert = MonitoringAlert(**alert_data)

                        # Time filter
                        if alert.created_at < cutoff:
                            continue

                        # Severity filter
                        if severity and alert.severity != severity:
                            continue

                        # Type filter
                        if alert_type and alert.alert_type != alert_type:
                            continue

                        alerts.append(alert)

                        if len(alerts) >= limit:
                            break

                except Exception as e:
                    self.logger.warning(f"Error parsing alert {alert_key}: {e}")
                    continue

            # Sort by creation time (newest first)
            alerts.sort(key=lambda x: x.created_at, reverse=True)

            return alerts[:limit]

        except Exception as e:
            self.logger.error(f"Error getting recent alerts: {e}")
            return []

    async def get_alert_trends(self, time_range: str = "day") -> Dict[str, Any]:
        """Get alert trends over time"""
        try:
            # Calculate time cutoff
            if time_range == "hour":
                cutoff = datetime.utcnow() - timedelta(hours=1)
                interval_minutes = 5
            elif time_range == "day":
                cutoff = datetime.utcnow() - timedelta(days=1)
                interval_minutes = 60
            elif time_range == "week":
                cutoff = datetime.utcnow() - timedelta(weeks=1)
                interval_minutes = 360  # 6 hours
            else:  # month
                cutoff = datetime.utcnow() - timedelta(days=30)
                interval_minutes = 1440  # 1 day

            alerts = await self.get_recent_alerts(time_range=time_range, limit=1000)

            # Group alerts by time intervals
            time_buckets = {}
            current_time = datetime.utcnow()

            for i in range(0, int((current_time - cutoff).total_seconds() / 60), interval_minutes):
                bucket_time = cutoff + timedelta(minutes=i)
                bucket_key = bucket_time.replace(second=0, microsecond=0).isoformat()
                time_buckets[bucket_key] = {
                    "timestamp": bucket_key,
                    "total": 0,
                    "by_severity": {severity.value: 0 for severity in AlertSeverity},
                    "by_type": {alert_type.value: 0 for alert_type in AlertType}
                }

            # Fill buckets with alert data
            for alert in alerts:
                # Find appropriate time bucket
                for bucket_key, bucket_data in time_buckets.items():
                    bucket_time = datetime.fromisoformat(bucket_key.replace('Z', '+00:00'))
                    next_bucket_time = bucket_time + timedelta(minutes=interval_minutes)

                    if bucket_time <= alert.created_at < next_bucket_time:
                        bucket_data["total"] += 1
                        bucket_data["by_severity"][alert.severity.value] += 1
                        bucket_data["by_type"][alert.alert_type.value] += 1
                        break

            return {
                "time_buckets": list(time_buckets.values()),
                "total_alerts": len(alerts),
                "time_range": time_range,
                "interval_minutes": interval_minutes
            }

        except Exception as e:
            self.logger.error(f"Error getting alert trends: {e}")
            return {"time_buckets": [], "total_alerts": 0, "time_range": time_range}

    # Additional monitoring methods would be implemented here
    async def _check_task_alerts(self, event: TaskExecutionEvent):
        """Check for task-related alerts"""
        # Implementation for task alert checking
        pass

    async def _update_performance_metrics(self, event: TaskExecutionEvent):
        """Update performance metrics based on events"""
        # Implementation for performance metric updates
        pass

    async def _analyze_execution_times(self):
        """Analyze task execution times"""
        # Implementation for execution time analysis
        pass

    async def _analyze_resource_usage(self):
        """Analyze resource usage patterns"""
        # Implementation for resource usage analysis
        pass

    async def _analyze_agent_performance(self):
        """Analyze agent performance metrics"""
        # Implementation for agent performance analysis
        pass

    async def _check_system_alerts(self):
        """Check for system-level alerts"""
        # Implementation for system alert checking
        pass

    async def _check_performance_alerts(self):
        """Check for performance-related alerts"""
        # Implementation for performance alert checking
        pass

    async def _check_agent_alerts(self):
        """Check for agent-related alerts"""
        # Implementation for agent alert checking
        pass


# Global task monitor instance
task_monitor: Optional[TaskMonitorService] = None


async def get_task_monitor(db: AsyncSession) -> TaskMonitorService:
    """Get or create the global task monitor instance"""
    global task_monitor

    if task_monitor is None:
        task_monitor = TaskMonitorService(db)
        await task_monitor.start()

    return task_monitor


async def shutdown_task_monitor():
    """Shutdown the global task monitor instance"""
    global task_monitor

    if task_monitor:
        await task_monitor.stop()
        task_monitor = None