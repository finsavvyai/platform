"""
Real-Time Dashboard System.

Comprehensive dashboard system for monitoring, alerting, and visualization
of the Universal Dependency Platform with real-time updates and custom widgets.
"""

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class WidgetType(str, Enum):
    """Dashboard widget types."""
    METRIC = "metric"
    CHART = "chart"
    TABLE = "table"
    ALERT = "alert"
    HEALTH = "health"
    CUSTOM = "custom"


class ChartType(str, Enum):
    """Chart types."""
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    AREA = "area"
    GAUGE = "gauge"
    HEATMAP = "heatmap"


@dataclass
class DashboardWidget:
    """Dashboard widget definition."""
    id: str
    title: str
    widget_type: WidgetType
    position: dict[str, int]  # x, y, width, height
    config: dict[str, Any] = field(default_factory=dict)
    refresh_interval: int = 30  # seconds
    enabled: bool = True
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class Dashboard:
    """Dashboard definition."""
    id: str
    name: str
    description: str
    widgets: list[DashboardWidget] = field(default_factory=list)
    layout: dict[str, Any] = field(default_factory=dict)
    refresh_interval: int = 30  # seconds
    auto_refresh: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    tags: dict[str, str] = field(default_factory=dict)


class BaseWidget(ABC):
    """Base class for dashboard widgets."""

    def __init__(self, widget: DashboardWidget):
        self.widget = widget
        self.data = {}
        self.last_update = None

    @abstractmethod
    async def update_data(self) -> dict[str, Any]:
        """Update widget data."""
        pass

    @abstractmethod
    def render(self) -> dict[str, Any]:
        """Render widget for display."""
        pass


class MetricWidget(BaseWidget):
    """Metric display widget."""

    async def update_data(self) -> dict[str, Any]:
        """Update metric data."""
        try:
            config = self.widget.config
            metric_name = config.get("metric_name")

            if not metric_name:
                return {"error": "No metric name specified"}

            # Simulate metric data collection
            # In production, this would query the actual metrics system

            value = 125.5  # Simulated value
            unit = config.get("unit", "")
            format_type = config.get("format", "number")

            # Format value
            if format_type == "percentage":
                formatted_value = f"{value:.1f}%"
            elif format_type == "bytes":
                formatted_value = self._format_bytes(value)
            elif format_type == "duration":
                formatted_value = self._format_duration(value)
            else:
                formatted_value = f"{value:.2f}"

            self.data = {
                "value": value,
                "formatted_value": formatted_value,
                "unit": unit,
                "trend": "up",  # Simulated trend
                "trend_value": 5.2,  # Simulated trend value
                "status": "healthy"  # Simulated status
            }

            self.last_update = datetime.utcnow()
            return self.data

        except Exception as e:
            logger.error(f"Error updating metric widget: {e}")
            return {"error": str(e)}

    def render(self) -> dict[str, Any]:
        """Render metric widget."""
        return {
            "id": self.widget.id,
            "title": self.widget.title,
            "type": "metric",
            "data": self.data,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "config": self.widget.config
        }

    def _format_bytes(self, bytes_value: float) -> str:
        """Format bytes value."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_value < 1024.0:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024.0
        return f"{bytes_value:.1f} PB"

    def _format_duration(self, seconds: float) -> str:
        """Format duration value."""
        if seconds < 60:
            return f"{seconds:.1f}s"
        elif seconds < 3600:
            return f"{seconds/60:.1f}m"
        else:
            return f"{seconds/3600:.1f}h"


class ChartWidget(BaseWidget):
    """Chart display widget."""

    async def update_data(self) -> dict[str, Any]:
        """Update chart data."""
        try:
            config = self.widget.config
            chart_type = config.get("chart_type", "line")
            metric_names = config.get("metric_names", [])
            time_range = config.get("time_range", 3600)  # seconds

            # Simulate chart data
            # In production, this would query the actual metrics system

            data_points = []
            now = datetime.utcnow()

            for i in range(60):  # 60 data points
                timestamp = now - timedelta(seconds=(60 - i) * (time_range // 60))

                point = {
                    "timestamp": timestamp.isoformat(),
                    "values": {}
                }

                for metric_name in metric_names:
                    # Simulate metric values
                    base_value = 100 + (i * 2) + (hash(metric_name) % 50)
                    point["values"][metric_name] = base_value

                data_points.append(point)

            self.data = {
                "chart_type": chart_type,
                "data_points": data_points,
                "series": metric_names,
                "time_range": time_range
            }

            self.last_update = datetime.utcnow()
            return self.data

        except Exception as e:
            logger.error(f"Error updating chart widget: {e}")
            return {"error": str(e)}

    def render(self) -> dict[str, Any]:
        """Render chart widget."""
        return {
            "id": self.widget.id,
            "title": self.widget.title,
            "type": "chart",
            "data": self.data,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "config": self.widget.config
        }


class TableWidget(BaseWidget):
    """Table display widget."""

    async def update_data(self) -> dict[str, Any]:
        """Update table data."""
        try:
            config = self.widget.config
            data_source = config.get("data_source", "dependencies")

            # Simulate table data
            # In production, this would query the actual data source

            if data_source == "dependencies":
                rows = [
                    {"name": "react", "version": "18.2.0", "ecosystem": "npm", "vulnerabilities": 0, "status": "healthy"},
                    {"name": "lodash", "version": "4.17.21", "ecosystem": "npm", "vulnerabilities": 2, "status": "warning"},
                    {"name": "requests", "version": "2.28.1", "ecosystem": "pypi", "vulnerabilities": 1, "status": "warning"},
                    {"name": "spring-boot", "version": "2.7.0", "ecosystem": "maven", "vulnerabilities": 0, "status": "healthy"},
                    {"name": "express", "version": "4.18.1", "ecosystem": "npm", "vulnerabilities": 3, "status": "critical"}
                ]
            elif data_source == "alerts":
                rows = [
                    {"id": "alert-001", "title": "High CPU Usage", "severity": "high", "status": "active", "timestamp": "2025-01-07T10:30:00Z"},
                    {"id": "alert-002", "title": "Memory Usage Critical", "severity": "critical", "status": "active", "timestamp": "2025-01-07T10:25:00Z"},
                    {"id": "alert-003", "title": "Dependency Vulnerability", "severity": "medium", "status": "acknowledged", "timestamp": "2025-01-07T10:20:00Z"}
                ]
            else:
                rows = []

            self.data = {
                "columns": list(rows[0].keys()) if rows else [],
                "rows": rows,
                "total_rows": len(rows)
            }

            self.last_update = datetime.utcnow()
            return self.data

        except Exception as e:
            logger.error(f"Error updating table widget: {e}")
            return {"error": str(e)}

    def render(self) -> dict[str, Any]:
        """Render table widget."""
        return {
            "id": self.widget.id,
            "title": self.widget.title,
            "type": "table",
            "data": self.data,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "config": self.widget.config
        }


class AlertWidget(BaseWidget):
    """Alert display widget."""

    async def update_data(self) -> dict[str, Any]:
        """Update alert data."""
        try:
            config = self.widget.config
            severity_filter = config.get("severity_filter", [])
            status_filter = config.get("status_filter", ["active"])

            # Simulate alert data
            # In production, this would query the actual alert system

            alerts = [
                {
                    "id": "alert-001",
                    "title": "High CPU Usage",
                    "description": "CPU usage has exceeded 90% for 5 minutes",
                    "severity": "high",
                    "status": "active",
                    "timestamp": "2025-01-07T10:30:00Z",
                    "metric_name": "system.cpu.percent",
                    "metric_value": 92.5,
                    "threshold": 90.0
                },
                {
                    "id": "alert-002",
                    "title": "Memory Usage Critical",
                    "description": "Memory usage has exceeded 95%",
                    "severity": "critical",
                    "status": "active",
                    "timestamp": "2025-01-07T10:25:00Z",
                    "metric_name": "system.memory.percent",
                    "metric_value": 96.2,
                    "threshold": 95.0
                },
                {
                    "id": "alert-003",
                    "title": "Dependency Vulnerability",
                    "description": "Critical vulnerability detected in lodash package",
                    "severity": "medium",
                    "status": "acknowledged",
                    "timestamp": "2025-01-07T10:20:00Z",
                    "metric_name": "dependency.vulnerable",
                    "metric_value": 1,
                    "threshold": 0
                }
            ]

            # Filter alerts
            filtered_alerts = []
            for alert in alerts:
                if severity_filter and alert["severity"] not in severity_filter:
                    continue
                if status_filter and alert["status"] not in status_filter:
                    continue
                filtered_alerts.append(alert)

            # Calculate summary
            summary = {
                "total": len(filtered_alerts),
                "by_severity": {
                    "critical": len([a for a in filtered_alerts if a["severity"] == "critical"]),
                    "high": len([a for a in filtered_alerts if a["severity"] == "high"]),
                    "medium": len([a for a in filtered_alerts if a["severity"] == "medium"]),
                    "low": len([a for a in filtered_alerts if a["severity"] == "low"])
                },
                "by_status": {
                    "active": len([a for a in filtered_alerts if a["status"] == "active"]),
                    "acknowledged": len([a for a in filtered_alerts if a["status"] == "acknowledged"]),
                    "resolved": len([a for a in filtered_alerts if a["status"] == "resolved"])
                }
            }

            self.data = {
                "alerts": filtered_alerts,
                "summary": summary
            }

            self.last_update = datetime.utcnow()
            return self.data

        except Exception as e:
            logger.error(f"Error updating alert widget: {e}")
            return {"error": str(e)}

    def render(self) -> dict[str, Any]:
        """Render alert widget."""
        return {
            "id": self.widget.id,
            "title": self.widget.title,
            "type": "alert",
            "data": self.data,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "config": self.widget.config
        }


class HealthWidget(BaseWidget):
    """Health status widget."""

    async def update_data(self) -> dict[str, Any]:
        """Update health data."""
        try:
            # Simulate health data
            # In production, this would query the actual health checker

            services = {
                "api": {"status": "healthy", "response_time": 45.2, "uptime": 99.9},
                "database": {"status": "healthy", "response_time": 12.5, "uptime": 99.8},
                "cache": {"status": "degraded", "response_time": 150.3, "uptime": 98.5},
                "ml_models": {"status": "healthy", "response_time": 89.7, "uptime": 99.7},
                "monitoring": {"status": "healthy", "response_time": 23.1, "uptime": 99.9}
            }

            # Calculate overall health
            statuses = [service["status"] for service in services.values()]
            if "unhealthy" in statuses:
                overall_status = "unhealthy"
            elif "degraded" in statuses:
                overall_status = "degraded"
            else:
                overall_status = "healthy"

            self.data = {
                "overall_status": overall_status,
                "services": services,
                "summary": {
                    "total_services": len(services),
                    "healthy": len([s for s in services.values() if s["status"] == "healthy"]),
                    "degraded": len([s for s in services.values() if s["status"] == "degraded"]),
                    "unhealthy": len([s for s in services.values() if s["status"] == "unhealthy"])
                }
            }

            self.last_update = datetime.utcnow()
            return self.data

        except Exception as e:
            logger.error(f"Error updating health widget: {e}")
            return {"error": str(e)}

    def render(self) -> dict[str, Any]:
        """Render health widget."""
        return {
            "id": self.widget.id,
            "title": self.widget.title,
            "type": "health",
            "data": self.data,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "config": self.widget.config
        }


class DashboardManager:
    """Dashboard management system."""

    def __init__(self):
        self.dashboards: dict[str, Dashboard] = {}
        self.widgets: dict[str, BaseWidget] = {}
        self.is_running = False
        self._update_tasks = {}

    def create_dashboard(self, name: str, description: str = "") -> Dashboard:
        """Create a new dashboard."""
        dashboard = Dashboard(
            id=str(uuid.uuid4()),
            name=name,
            description=description
        )

        self.dashboards[dashboard.id] = dashboard
        logger.info(f"Created dashboard: {name}")
        return dashboard

    def add_widget(self, dashboard_id: str, widget: DashboardWidget) -> bool:
        """Add a widget to a dashboard."""
        if dashboard_id not in self.dashboards:
            return False

        dashboard = self.dashboards[dashboard_id]
        dashboard.widgets.append(widget)
        dashboard.updated_at = datetime.utcnow()

        # Create widget instance
        widget_instance = self._create_widget(widget)
        if widget_instance:
            self.widgets[widget.id] = widget_instance

        logger.info(f"Added widget {widget.title} to dashboard {dashboard.name}")
        return True

    def _create_widget(self, widget: DashboardWidget) -> Optional[BaseWidget]:
        """Create widget instance."""
        try:
            if widget.widget_type == WidgetType.METRIC:
                return MetricWidget(widget)
            elif widget.widget_type == WidgetType.CHART:
                return ChartWidget(widget)
            elif widget.widget_type == WidgetType.TABLE:
                return TableWidget(widget)
            elif widget.widget_type == WidgetType.ALERT:
                return AlertWidget(widget)
            elif widget.widget_type == WidgetType.HEALTH:
                return HealthWidget(widget)
            else:
                logger.error(f"Unknown widget type: {widget.widget_type}")
                return None
        except Exception as e:
            logger.error(f"Failed to create widget: {e}")
            return None

    async def start_dashboard_updates(self):
        """Start dashboard update tasks."""
        self.is_running = True
        logger.info("Starting dashboard updates")

        for dashboard_id, dashboard in self.dashboards.items():
            if dashboard.auto_refresh:
                task = asyncio.create_task(self._update_dashboard(dashboard_id))
                self._update_tasks[dashboard_id] = task

    async def stop_dashboard_updates(self):
        """Stop dashboard update tasks."""
        self.is_running = False

        for task in self._update_tasks.values():
            task.cancel()

        self._update_tasks.clear()
        logger.info("Stopped dashboard updates")

    async def _update_dashboard(self, dashboard_id: str):
        """Update dashboard widgets."""
        if dashboard_id not in self.dashboards:
            return

        dashboard = self.dashboards[dashboard_id]

        while self.is_running:
            try:
                for widget in dashboard.widgets:
                    if widget.enabled and widget.id in self.widgets:
                        widget_instance = self.widgets[widget.id]
                        await widget_instance.update_data()

                await asyncio.sleep(dashboard.refresh_interval)

            except Exception as e:
                logger.error(f"Error updating dashboard {dashboard_id}: {e}")
                await asyncio.sleep(dashboard.refresh_interval)

    def get_dashboard(self, dashboard_id: str) -> Optional[dict[str, Any]]:
        """Get dashboard data."""
        if dashboard_id not in self.dashboards:
            return None

        dashboard = self.dashboards[dashboard_id]

        # Get widget data
        widgets_data = []
        for widget in dashboard.widgets:
            if widget.id in self.widgets:
                widget_instance = self.widgets[widget.id]
                widgets_data.append(widget_instance.render())

        return {
            "id": dashboard.id,
            "name": dashboard.name,
            "description": dashboard.description,
            "widgets": widgets_data,
            "layout": dashboard.layout,
            "refresh_interval": dashboard.refresh_interval,
            "auto_refresh": dashboard.auto_refresh,
            "created_at": dashboard.created_at.isoformat(),
            "updated_at": dashboard.updated_at.isoformat(),
            "tags": dashboard.tags
        }

    def get_dashboard_list(self) -> list[dict[str, Any]]:
        """Get list of all dashboards."""
        return [
            {
                "id": dashboard.id,
                "name": dashboard.name,
                "description": dashboard.description,
                "widget_count": len(dashboard.widgets),
                "created_at": dashboard.created_at.isoformat(),
                "updated_at": dashboard.updated_at.isoformat(),
                "tags": dashboard.tags
            }
            for dashboard in self.dashboards.values()
        ]

    def create_default_dashboards(self):
        """Create default dashboards."""
        # System Overview Dashboard
        system_dashboard = self.create_dashboard(
            "System Overview",
            "Real-time system metrics and health status"
        )

        # Add system widgets
        self.add_widget(system_dashboard.id, DashboardWidget(
            id=str(uuid.uuid4()),
            title="CPU Usage",
            widget_type=WidgetType.METRIC,
            position={"x": 0, "y": 0, "width": 3, "height": 2},
            config={"metric_name": "system.cpu.percent", "unit": "%", "format": "percentage"}
        ))

        self.add_widget(system_dashboard.id, DashboardWidget(
            id=str(uuid.uuid4()),
            title="Memory Usage",
            widget_type=WidgetType.METRIC,
            position={"x": 3, "y": 0, "width": 3, "height": 2},
            config={"metric_name": "system.memory.percent", "unit": "%", "format": "percentage"}
        ))

        self.add_widget(system_dashboard.id, DashboardWidget(
            id=str(uuid.uuid4()),
            title="System Health",
            widget_type=WidgetType.HEALTH,
            position={"x": 6, "y": 0, "width": 6, "height": 4},
            config={}
        ))

        # Dependencies Dashboard
        deps_dashboard = self.create_dashboard(
            "Dependencies",
            "Dependency management metrics and alerts"
        )

        self.add_widget(deps_dashboard.id, DashboardWidget(
            id=str(uuid.uuid4()),
            title="Dependency Status",
            widget_type=WidgetType.TABLE,
            position={"x": 0, "y": 0, "width": 12, "height": 6},
            config={"data_source": "dependencies"}
        ))

        # Alerts Dashboard
        alerts_dashboard = self.create_dashboard(
            "Alerts",
            "Active alerts and notifications"
        )

        self.add_widget(alerts_dashboard.id, DashboardWidget(
            id=str(uuid.uuid4()),
            title="Active Alerts",
            widget_type=WidgetType.ALERT,
            position={"x": 0, "y": 0, "width": 12, "height": 8},
            config={"severity_filter": ["critical", "high", "medium"], "status_filter": ["active"]}
        ))

        logger.info("Created default dashboards")


class RealTimeDashboard:
    """Real-time dashboard with WebSocket support."""

    def __init__(self, dashboard_manager: DashboardManager):
        self.dashboard_manager = dashboard_manager
        self.connected_clients = set()
        self.is_running = False

    async def start(self):
        """Start real-time dashboard."""
        self.is_running = True
        logger.info("Started real-time dashboard")

    async def stop(self):
        """Stop real-time dashboard."""
        self.is_running = False
        logger.info("Stopped real-time dashboard")

    def add_client(self, client_id: str):
        """Add a connected client."""
        self.connected_clients.add(client_id)
        logger.info(f"Client {client_id} connected to real-time dashboard")

    def remove_client(self, client_id: str):
        """Remove a connected client."""
        self.connected_clients.discard(client_id)
        logger.info(f"Client {client_id} disconnected from real-time dashboard")

    async def broadcast_update(self, dashboard_id: str, data: dict[str, Any]):
        """Broadcast dashboard update to connected clients."""
        if not self.connected_clients:
            return

        message = {
            "type": "dashboard_update",
            "dashboard_id": dashboard_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }

        # In production, this would send via WebSocket
        logger.info(f"Broadcasting update for dashboard {dashboard_id} to {len(self.connected_clients)} clients")

    def get_connected_clients_count(self) -> int:
        """Get number of connected clients."""
        return len(self.connected_clients)
