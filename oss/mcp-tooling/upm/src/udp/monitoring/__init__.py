"""
Real-Time Monitoring and Alerting Module.

Comprehensive monitoring, alerting, and observability system for the
Universal Dependency Platform with real-time metrics, health checks,
and intelligent alerting.
"""

from .alerts import AlertChannel, AlertManager, AlertProcessor, AlertRule
from .dashboards import DashboardManager, RealTimeDashboard
from .metrics import (
    CustomMetrics,
    MetricsAggregator,
    MetricsCollector,
    PrometheusExporter,
    TimeSeriesDB,
)
from .monitor import (
    DependencyMonitor,
    HealthChecker,
    PerformanceMonitor,
    SecurityMonitor,
    SystemMonitor,
)
from .observability import (
    APMTracer,
    DistributedTracing,
    LogAggregator,
    ObservabilityManager,
)

__all__ = [
    "SystemMonitor",
    "DependencyMonitor",
    "SecurityMonitor",
    "PerformanceMonitor",
    "HealthChecker",
    "AlertManager",
    "AlertRule",
    "AlertChannel",
    "AlertProcessor",
    "MetricsCollector",
    "PrometheusExporter",
    "CustomMetrics",
    "MetricsAggregator",
    "TimeSeriesDB",
    "DashboardManager",
    "RealTimeDashboard",
    "DistributedTracing",
    "LogAggregator",
    "APMTracer",
    "ObservabilityManager"
]
