"""
Real-Time Monitoring and Alerting API Routes.

Provides endpoints for monitoring system health, metrics collection,
alerting, and observability in the Universal Dependency Platform.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.monitoring.alerts import (
    AlertChannel,
    AlertChannelType,
    AlertManager,
    AlertRule,
    AlertSeverity,
)
from udp.monitoring.dashboards import (
    DashboardManager,
    DashboardWidget,
    WidgetType,
)
from udp.monitoring.metrics import (
    CustomMetrics,
    MetricsCollector,
    PrometheusExporter,
)
from udp.monitoring.monitor import (
    DependencyMonitor,
    HealthChecker,
    MonitoringConfig,
    PerformanceMonitor,
    SecurityMonitor,
    SystemMonitor,
)
from udp.monitoring.observability import (
    ObservabilityManager,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize monitoring components
monitoring_config = MonitoringConfig()
system_monitor = SystemMonitor(monitoring_config)
dependency_monitor = DependencyMonitor(monitoring_config)
security_monitor = SecurityMonitor(monitoring_config)
performance_monitor = PerformanceMonitor(monitoring_config)
health_checker = HealthChecker([system_monitor, dependency_monitor, security_monitor, performance_monitor])

alert_manager = AlertManager()
metrics_collector = MetricsCollector()
custom_metrics = CustomMetrics(metrics_collector)
prometheus_exporter = PrometheusExporter(metrics_collector)
dashboard_manager = DashboardManager()
observability_manager = ObservabilityManager()

# Initialize monitoring systems (will be started when FastAPI starts)
monitoring_systems_initialized = False

# Create default dashboards
dashboard_manager.create_default_dashboards()


async def start_monitoring_systems():
    """Start all monitoring systems."""
    global monitoring_systems_initialized

    if not monitoring_systems_initialized:
        try:
            # Start monitoring systems
            asyncio.create_task(system_monitor.start_monitoring())
            asyncio.create_task(dependency_monitor.start_monitoring())
            asyncio.create_task(security_monitor.start_monitoring())
            asyncio.create_task(performance_monitor.start_monitoring())
            asyncio.create_task(alert_manager.start())
            asyncio.create_task(observability_manager.start())

            monitoring_systems_initialized = True
            logger.info("All monitoring systems started successfully")

        except Exception as e:
            logger.error(f"Failed to start monitoring systems: {e}", exc_info=True)


# Pydantic models for API requests/responses
class HealthCheckResponse(BaseModel):
    """Health check response."""
    overall_health: str
    timestamp: datetime
    services: dict[str, dict[str, Any]]


class MetricData(BaseModel):
    """Metric data response."""
    name: str
    value: float
    timestamp: datetime
    tags: dict[str, str] = {}


class AlertRuleRequest(BaseModel):
    """Alert rule creation request."""
    name: str = Field(..., description="Alert rule name")
    description: str = Field(..., description="Alert rule description")
    metric_name: str = Field(..., description="Metric to monitor")
    condition: str = Field(..., description="Alert condition (>, <, ==, !=)")
    threshold: float = Field(..., description="Alert threshold")
    severity: AlertSeverity = Field(..., description="Alert severity")
    cooldown_period: int = Field(300, description="Cooldown period in seconds")
    evaluation_interval: int = Field(60, description="Evaluation interval in seconds")
    tags: dict[str, str] = Field(default_factory=dict, description="Alert tags")


class AlertChannelRequest(BaseModel):
    """Alert channel creation request."""
    name: str = Field(..., description="Channel name")
    type: AlertChannelType = Field(..., description="Channel type")
    config: dict[str, Any] = Field(..., description="Channel configuration")
    severity_filter: list[AlertSeverity] = Field(default_factory=list, description="Severity filter")
    tags_filter: dict[str, str] = Field(default_factory=dict, description="Tags filter")


class DashboardRequest(BaseModel):
    """Dashboard creation request."""
    name: str = Field(..., description="Dashboard name")
    description: str = Field(..., description="Dashboard description")
    auto_refresh: bool = Field(True, description="Enable auto refresh")
    refresh_interval: int = Field(30, description="Refresh interval in seconds")
    tags: dict[str, str] = Field(default_factory=dict, description="Dashboard tags")


class WidgetRequest(BaseModel):
    """Widget creation request."""
    title: str = Field(..., description="Widget title")
    widget_type: WidgetType = Field(..., description="Widget type")
    position: dict[str, int] = Field(..., description="Widget position (x, y, width, height)")
    config: dict[str, Any] = Field(..., description="Widget configuration")
    refresh_interval: int = Field(30, description="Widget refresh interval")


class MonitoringSummary(BaseModel):
    """Monitoring summary response."""
    system_health: str
    active_alerts: int
    total_metrics: int
    dashboard_count: int
    services_monitored: int
    uptime: float


@router.get("/health", response_model=HealthCheckResponse)
async def get_system_health(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get comprehensive system health status."""
    try:
        logger.info(f"Getting system health for organization {current_org['id']}")

        # Check health of all services
        health_statuses = await health_checker.check_all_health()

        # Convert to response format
        services = {}
        for name, health in health_statuses.items():
            services[name] = {
                "status": health.status,
                "timestamp": health.timestamp.isoformat(),
                "details": health.details,
                "metrics": health.metrics
            }

        return HealthCheckResponse(
            overall_health=health_checker.overall_health,
            timestamp=datetime.utcnow(),
            services=services
        )

    except Exception as e:
        logger.error(f"Failed to get system health: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get system health: {str(e)}")


@router.get("/metrics", response_model=list[MetricData])
async def get_metrics(
    metric_name: Optional[str] = None,
    duration_seconds: int = 300,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get metrics data."""
    try:
        logger.info(f"Getting metrics for organization {current_org['id']}")

        if metric_name:
            # Get specific metric
            points = metrics_collector.get_metric(metric_name, duration_seconds)
            metrics = [
                MetricData(
                    name=point.name,
                    value=point.value if isinstance(point.value, (int, float)) else 0.0,
                    timestamp=point.timestamp,
                    tags=point.tags
                )
                for point in points
            ]
        else:
            # Get all metrics summary
            all_metrics = metrics_collector.get_all_metrics()
            metrics = []

            # Add counter metrics
            for name, value in all_metrics["counters"].items():
                metrics.append(MetricData(
                    name=name,
                    value=value,
                    timestamp=datetime.utcnow(),
                    tags={"type": "counter"}
                ))

            # Add gauge metrics
            for name, value in all_metrics["gauges"].items():
                metrics.append(MetricData(
                    name=name,
                    value=value,
                    timestamp=datetime.utcnow(),
                    tags={"type": "gauge"}
                ))

        return metrics

    except Exception as e:
        logger.error(f"Failed to get metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")


@router.get("/metrics/prometheus")
async def get_prometheus_metrics(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get metrics in Prometheus format."""
    try:
        logger.info(f"Getting Prometheus metrics for organization {current_org['id']}")

        prometheus_data = prometheus_exporter.export_metrics()

        return {"data": prometheus_data}

    except Exception as e:
        logger.error(f"Failed to get Prometheus metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get Prometheus metrics: {str(e)}")


@router.get("/alerts", response_model=list[dict[str, Any]])
async def get_active_alerts(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get active alerts."""
    try:
        logger.info(f"Getting active alerts for organization {current_org['id']}")

        alerts = alert_manager.get_active_alerts()

        alert_data = []
        for alert in alerts:
            alert_data.append({
                "id": alert.id,
                "rule_id": alert.rule_id,
                "title": alert.title,
                "description": alert.description,
                "severity": alert.severity.value,
                "status": alert.status.value,
                "timestamp": alert.timestamp.isoformat(),
                "metric_name": alert.metric_name,
                "metric_value": alert.metric_value,
                "threshold": alert.threshold,
                "tags": alert.tags,
                "acknowledged_by": alert.acknowledged_by,
                "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None
            })

        return alert_data

    except Exception as e:
        logger.error(f"Failed to get active alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get active alerts: {str(e)}")


@router.post("/alerts/rules")
async def create_alert_rule(
    request: AlertRuleRequest,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Create a new alert rule."""
    try:
        logger.info(f"Creating alert rule {request.name} for organization {current_org['id']}")

        rule = AlertRule(
            id=f"rule_{len(alert_manager.processor.rules) + 1}",
            name=request.name,
            description=request.description,
            metric_name=request.metric_name,
            condition=request.condition,
            threshold=request.threshold,
            severity=request.severity,
            cooldown_period=request.cooldown_period,
            evaluation_interval=request.evaluation_interval,
            tags=request.tags
        )

        alert_manager.add_rule(rule)

        return {
            "id": rule.id,
            "name": rule.name,
            "status": "created",
            "message": f"Alert rule {request.name} created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create alert rule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create alert rule: {str(e)}")


@router.post("/alerts/channels")
async def create_alert_channel(
    request: AlertChannelRequest,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Create a new alert channel."""
    try:
        logger.info(f"Creating alert channel {request.name} for organization {current_org['id']}")

        channel = AlertChannel(
            id=f"channel_{len(alert_manager.channels) + 1}",
            name=request.name,
            type=request.type,
            config=request.config,
            severity_filter=request.severity_filter or list(AlertSeverity),
            tags_filter=request.tags_filter
        )

        alert_manager.add_channel(channel)

        return {
            "id": channel.id,
            "name": channel.name,
            "type": channel.type.value,
            "status": "created",
            "message": f"Alert channel {request.name} created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create alert channel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create alert channel: {str(e)}")


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Acknowledge an alert."""
    try:
        logger.info(f"Acknowledging alert {alert_id} for organization {current_org['id']}")

        success = alert_manager.acknowledge_alert(alert_id, current_user["username"])

        if success:
            return {
                "alert_id": alert_id,
                "status": "acknowledged",
                "acknowledged_by": current_user["username"],
                "acknowledged_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail="Alert not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to acknowledge alert: {str(e)}")


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Resolve an alert."""
    try:
        logger.info(f"Resolving alert {alert_id} for organization {current_org['id']}")

        success = alert_manager.resolve_alert(alert_id)

        if success:
            return {
                "alert_id": alert_id,
                "status": "resolved",
                "resolved_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail="Alert not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}")


@router.get("/dashboards", response_model=list[dict[str, Any]])
async def get_dashboards(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get list of all dashboards."""
    try:
        logger.info(f"Getting dashboards for organization {current_org['id']}")

        dashboards = dashboard_manager.get_dashboard_list()
        return dashboards

    except Exception as e:
        logger.error(f"Failed to get dashboards: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get dashboards: {str(e)}")


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get dashboard data."""
    try:
        logger.info(f"Getting dashboard {dashboard_id} for organization {current_org['id']}")

        dashboard = dashboard_manager.get_dashboard(dashboard_id)

        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        return dashboard

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard: {str(e)}")


@router.post("/dashboards")
async def create_dashboard(
    request: DashboardRequest,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Create a new dashboard."""
    try:
        logger.info(f"Creating dashboard {request.name} for organization {current_org['id']}")

        dashboard = dashboard_manager.create_dashboard(
            name=request.name,
            description=request.description
        )

        # Set additional properties
        dashboard.auto_refresh = request.auto_refresh
        dashboard.refresh_interval = request.refresh_interval
        dashboard.tags = request.tags

        return {
            "id": dashboard.id,
            "name": dashboard.name,
            "status": "created",
            "message": f"Dashboard {request.name} created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create dashboard: {str(e)}")


@router.post("/dashboards/{dashboard_id}/widgets")
async def add_widget(
    dashboard_id: str,
    request: WidgetRequest,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Add a widget to a dashboard."""
    try:
        logger.info(f"Adding widget to dashboard {dashboard_id} for organization {current_org['id']}")

        widget = DashboardWidget(
            id=f"widget_{len(dashboard_manager.widgets) + 1}",
            title=request.title,
            widget_type=request.widget_type,
            position=request.position,
            config=request.config,
            refresh_interval=request.refresh_interval
        )

        success = dashboard_manager.add_widget(dashboard_id, widget)

        if success:
            return {
                "id": widget.id,
                "title": widget.title,
                "status": "added",
                "message": f"Widget {request.title} added successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Dashboard not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add widget: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add widget: {str(e)}")


@router.get("/observability/summary")
async def get_observability_summary(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get observability system summary."""
    try:
        logger.info(f"Getting observability summary for organization {current_org['id']}")

        summary = observability_manager.get_observability_summary()
        return summary

    except Exception as e:
        logger.error(f"Failed to get observability summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get observability summary: {str(e)}")


@router.get("/observability/traces/{trace_id}")
async def get_trace_analysis(
    trace_id: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get detailed trace analysis."""
    try:
        logger.info(f"Getting trace analysis for {trace_id} in organization {current_org['id']}")

        analysis = observability_manager.get_trace_analysis(trace_id)
        return analysis

    except Exception as e:
        logger.error(f"Failed to get trace analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get trace analysis: {str(e)}")


@router.get("/observability/services/{service_name}/health")
async def get_service_health(
    service_name: str,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get health information for a specific service."""
    try:
        logger.info(f"Getting service health for {service_name} in organization {current_org['id']}")

        health = observability_manager.get_service_health(service_name)
        return health

    except Exception as e:
        logger.error(f"Failed to get service health: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get service health: {str(e)}")


@router.get("/summary", response_model=MonitoringSummary)
async def get_monitoring_summary(
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get comprehensive monitoring summary."""
    try:
        logger.info(f"Getting monitoring summary for organization {current_org['id']}")

        # Get system health
        health_statuses = await health_checker.check_all_health()
        overall_health = health_checker.overall_health

        # Get alert summary
        alert_summary = alert_manager.get_alert_summary()

        # Get metrics count
        all_metrics = metrics_collector.get_all_metrics()
        total_metrics = len(all_metrics["counters"]) + len(all_metrics["gauges"])

        # Get dashboard count
        dashboards = dashboard_manager.get_dashboard_list()

        # Get observability summary
        obs_summary = observability_manager.get_observability_summary()

        return MonitoringSummary(
            system_health=overall_health,
            active_alerts=alert_summary["active_alerts"],
            total_metrics=total_metrics,
            dashboard_count=len(dashboards),
            services_monitored=len(health_statuses),
            uptime=all_metrics.get("uptime", 0.0)
        )

    except Exception as e:
        logger.error(f"Failed to get monitoring summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get monitoring summary: {str(e)}")


@router.post("/metrics/record")
async def record_custom_metric(
    metric_name: str,
    value: float,
    metric_type: str = "gauge",
    tags: dict[str, str] = None,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Record a custom metric."""
    try:
        logger.info(f"Recording custom metric {metric_name} for organization {current_org['id']}")

        metrics_collector.record_custom_metric(
            name=metric_name,
            value=value,
            metric_type=metric_type,
            tags=tags or {}
        )

        return {
            "metric_name": metric_name,
            "value": value,
            "status": "recorded",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to record custom metric: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to record custom metric: {str(e)}")


@router.get("/logs")
async def get_logs(
    service: Optional[str] = None,
    level: Optional[str] = None,
    trace_id: Optional[str] = None,
    duration_seconds: int = 3600,
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """Get filtered logs."""
    try:
        logger.info(f"Getting logs for organization {current_org['id']}")

        logs = observability_manager.log_aggregator.get_logs(
            service=service,
            level=level,
            trace_id=trace_id,
            duration_seconds=duration_seconds
        )

        log_data = []
        for log in logs:
            log_data.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "level": log.level,
                "message": log.message,
                "service": log.service,
                "trace_id": log.trace_id,
                "span_id": log.span_id,
                "tags": log.tags,
                "metadata": log.metadata,
                "exception": log.exception
            })

        return {
            "logs": log_data,
            "total_count": len(log_data),
            "filters": {
                "service": service,
                "level": level,
                "trace_id": trace_id,
                "duration_seconds": duration_seconds
            }
        }

    except Exception as e:
        logger.error(f"Failed to get logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")
