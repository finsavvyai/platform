"""
Unit tests for monitoring system.

Tests for SystemMonitor, DependencyMonitor, SecurityMonitor, PerformanceMonitor,
AlertManager, MetricsCollector, DashboardManager, and ObservabilityManager.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock

from udp.monitoring.monitor import (
    SystemMonitor, DependencyMonitor, SecurityMonitor, PerformanceMonitor,
    HealthChecker, MonitoringConfig, MetricData, HealthStatus
)
from udp.monitoring.alerts import (
    AlertManager, AlertRule, AlertChannel, Alert, AlertSeverity, AlertStatus,
    AlertChannelType, AlertProcessor
)
from udp.monitoring.metrics import (
    MetricsCollector, PrometheusExporter, CustomMetrics, MetricsAggregator
)
from udp.monitoring.dashboards import (
    DashboardManager, Dashboard, DashboardWidget, WidgetType
)
from udp.monitoring.observability import (
    ObservabilityManager, DistributedTracing, LogAggregator, APMTracer
)


class TestMonitoringConfig:
    """Test MonitoringConfig."""
    
    def test_config_creation(self):
        """Test monitoring configuration creation."""
        config = MonitoringConfig()
        
        assert config.collection_interval == 1.0
        assert config.retention_period == 3600
        assert config.max_history_size == 1000
        assert len(config.enabled_monitors) == 4
        assert "system" in config.enabled_monitors
        assert "dependency" in config.enabled_monitors
        assert "security" in config.enabled_monitors
        assert "performance" in config.enabled_monitors
    
    def test_config_custom_values(self):
        """Test monitoring configuration with custom values."""
        config = MonitoringConfig(
            collection_interval=5.0,
            retention_period=7200,
            max_history_size=2000,
            enabled_monitors=["system", "dependency"]
        )
        
        assert config.collection_interval == 5.0
        assert config.retention_period == 7200
        assert config.max_history_size == 2000
        assert len(config.enabled_monitors) == 2


class TestSystemMonitor:
    """Test SystemMonitor."""
    
    def test_system_monitor_initialization(self):
        """Test system monitor initialization."""
        config = MonitoringConfig()
        monitor = SystemMonitor(config)
        
        assert monitor.name == "system"
        assert monitor.config == config
        assert monitor.is_running is False
        assert len(monitor.metrics_history) == 0
        assert len(monitor.callbacks) == 0
    
    @pytest.mark.asyncio
    async def test_collect_metrics(self):
        """Test system metrics collection."""
        config = MonitoringConfig()
        monitor = SystemMonitor(config)
        
        metrics = await monitor.collect_metrics()
        
        assert len(metrics) > 0
        assert all(isinstance(metric, MetricData) for metric in metrics)
        assert any(metric.name.startswith("system.cpu") for metric in metrics)
        assert any(metric.name.startswith("system.memory") for metric in metrics)
        assert any(metric.name.startswith("system.disk") for metric in metrics)
    
    @pytest.mark.asyncio
    async def test_check_health(self):
        """Test system health check."""
        config = MonitoringConfig()
        monitor = SystemMonitor(config)
        
        health = await monitor.check_health()
        
        assert isinstance(health, HealthStatus)
        assert health.service == "system"
        assert health.status in ["healthy", "degraded", "unhealthy"]
        assert health.timestamp is not None
        assert isinstance(health.metrics, dict)
        assert "cpu_percent" in health.metrics
        assert "memory_percent" in health.metrics
        assert "disk_percent" in health.metrics


class TestDependencyMonitor:
    """Test DependencyMonitor."""
    
    def test_dependency_monitor_initialization(self):
        """Test dependency monitor initialization."""
        config = MonitoringConfig()
        monitor = DependencyMonitor(config)
        
        assert monitor.name == "dependency"
        assert monitor.config == config
        assert monitor.is_running is False
    
    @pytest.mark.asyncio
    async def test_collect_metrics(self):
        """Test dependency metrics collection."""
        config = MonitoringConfig()
        monitor = DependencyMonitor(config)
        
        metrics = await monitor.collect_metrics()
        
        assert len(metrics) > 0
        assert all(isinstance(metric, MetricData) for metric in metrics)
        assert any(metric.name == "dependency.total" for metric in metrics)
        assert any(metric.name == "dependency.vulnerable" for metric in metrics)
        assert any(metric.name == "dependency.outdated" for metric in metrics)
    
    @pytest.mark.asyncio
    async def test_check_health(self):
        """Test dependency health check."""
        config = MonitoringConfig()
        monitor = DependencyMonitor(config)
        
        health = await monitor.check_health()
        
        assert isinstance(health, HealthStatus)
        assert health.service == "dependency"
        assert health.status in ["healthy", "degraded", "unhealthy"]
        assert "total_dependencies" in health.metrics
        assert "vulnerable_dependencies" in health.metrics


class TestSecurityMonitor:
    """Test SecurityMonitor."""
    
    def test_security_monitor_initialization(self):
        """Test security monitor initialization."""
        config = MonitoringConfig()
        monitor = SecurityMonitor(config)
        
        assert monitor.name == "security"
        assert monitor.config == config
        assert monitor.is_running is False
    
    @pytest.mark.asyncio
    async def test_collect_metrics(self):
        """Test security metrics collection."""
        config = MonitoringConfig()
        monitor = SecurityMonitor(config)
        
        metrics = await monitor.collect_metrics()
        
        assert len(metrics) > 0
        assert all(isinstance(metric, MetricData) for metric in metrics)
        assert any(metric.name == "security.vulnerabilities" for metric in metrics)
        assert any(metric.name == "security.events" for metric in metrics)
        assert any(metric.name == "security.policy_violations" for metric in metrics)
    
    @pytest.mark.asyncio
    async def test_check_health(self):
        """Test security health check."""
        config = MonitoringConfig()
        monitor = SecurityMonitor(config)
        
        health = await monitor.check_health()
        
        assert isinstance(health, HealthStatus)
        assert health.service == "security"
        assert health.status in ["healthy", "degraded", "unhealthy"]
        assert "critical_vulnerabilities" in health.metrics
        assert "compliance_score" in health.metrics


class TestPerformanceMonitor:
    """Test PerformanceMonitor."""
    
    def test_performance_monitor_initialization(self):
        """Test performance monitor initialization."""
        config = MonitoringConfig()
        monitor = PerformanceMonitor(config)
        
        assert monitor.name == "performance"
        assert monitor.config == config
        assert monitor.is_running is False
    
    @pytest.mark.asyncio
    async def test_collect_metrics(self):
        """Test performance metrics collection."""
        config = MonitoringConfig()
        monitor = PerformanceMonitor(config)
        
        metrics = await monitor.collect_metrics()
        
        assert len(metrics) > 0
        assert all(isinstance(metric, MetricData) for metric in metrics)
        assert any(metric.name == "performance.response_time" for metric in metrics)
        assert any(metric.name == "performance.throughput" for metric in metrics)
        assert any(metric.name == "performance.error_rate" for metric in metrics)
    
    @pytest.mark.asyncio
    async def test_check_health(self):
        """Test performance health check."""
        config = MonitoringConfig()
        monitor = PerformanceMonitor(config)
        
        health = await monitor.check_health()
        
        assert isinstance(health, HealthStatus)
        assert health.service == "performance"
        assert health.status in ["healthy", "degraded", "unhealthy"]
        assert "avg_response_time" in health.metrics
        assert "throughput" in health.metrics
        assert "error_rate" in health.metrics


class TestHealthChecker:
    """Test HealthChecker."""
    
    def test_health_checker_initialization(self):
        """Test health checker initialization."""
        config = MonitoringConfig()
        monitors = [
            SystemMonitor(config),
            DependencyMonitor(config),
            SecurityMonitor(config),
            PerformanceMonitor(config)
        ]
        health_checker = HealthChecker(monitors)
        
        assert len(health_checker.monitors) == 4
        assert "system" in health_checker.monitors
        assert "dependency" in health_checker.monitors
        assert "security" in health_checker.monitors
        assert "performance" in health_checker.monitors
        assert health_checker.overall_health == "unknown"
    
    @pytest.mark.asyncio
    async def test_check_all_health(self):
        """Test checking health of all services."""
        config = MonitoringConfig()
        monitors = [
            SystemMonitor(config),
            DependencyMonitor(config),
            SecurityMonitor(config),
            PerformanceMonitor(config)
        ]
        health_checker = HealthChecker(monitors)
        
        health_statuses = await health_checker.check_all_health()
        
        assert len(health_statuses) == 4
        assert "system" in health_statuses
        assert "dependency" in health_statuses
        assert "security" in health_statuses
        assert "performance" in health_statuses
        
        for name, health in health_statuses.items():
            assert isinstance(health, HealthStatus)
            assert health.service == name
            assert health.status in ["healthy", "degraded", "unhealthy"]
    
    def test_get_health_summary(self):
        """Test getting health summary."""
        config = MonitoringConfig()
        monitors = [
            SystemMonitor(config),
            DependencyMonitor(config),
            SecurityMonitor(config),
            PerformanceMonitor(config)
        ]
        health_checker = HealthChecker(monitors)
        
        summary = health_checker.get_health_summary()
        
        assert "overall_health" in summary
        assert "services" in summary
        assert summary["overall_health"] in ["unknown", "healthy", "degraded", "unhealthy"]


class TestAlertManager:
    """Test AlertManager."""
    
    def test_alert_manager_initialization(self):
        """Test alert manager initialization."""
        manager = AlertManager()
        
        assert manager.processor is not None
        assert len(manager.channels) == 0
        assert len(manager.notification_services) == 0
        assert manager.is_running is False
    
    def test_add_rule(self):
        """Test adding alert rule."""
        manager = AlertManager()
        
        rule = AlertRule(
            id="test-rule",
            name="Test Rule",
            description="A test rule",
            metric_name="test.metric",
            condition=">",
            threshold=90.0,
            severity=AlertSeverity.HIGH
        )
        
        manager.add_rule(rule)
        
        assert "test-rule" in manager.processor.rules
        assert manager.processor.rules["test-rule"] == rule
    
    def test_add_channel(self):
        """Test adding alert channel."""
        manager = AlertManager()
        
        channel = AlertChannel(
            id="test-channel",
            name="Test Channel",
            type=AlertChannelType.EMAIL,
            config={"to_email": "test@example.com"}
        )
        
        manager.add_channel(channel)
        
        assert "test-channel" in manager.channels
        assert manager.channels["test-channel"] == channel
    
    def test_get_active_alerts(self):
        """Test getting active alerts."""
        manager = AlertManager()
        
        alerts = manager.get_active_alerts()
        
        assert isinstance(alerts, list)
        assert len(alerts) == 0  # No active alerts initially
    
    def test_get_alert_summary(self):
        """Test getting alert summary."""
        manager = AlertManager()
        
        summary = manager.get_alert_summary()
        
        assert "active_alerts" in summary
        assert "alerts_last_hour" in summary
        assert "severity_breakdown" in summary
        assert "total_rules" in summary
        assert "enabled_rules" in summary
        assert "notification_channels" in summary
        assert "enabled_channels" in summary


class TestMetricsCollector:
    """Test MetricsCollector."""
    
    def test_metrics_collector_initialization(self):
        """Test metrics collector initialization."""
        collector = MetricsCollector()
        
        assert len(collector.metrics) == 0
        assert len(collector.counters) == 0
        assert len(collector.gauges) == 0
        assert len(collector.histograms) == 0
        assert len(collector.timers) == 0
    
    def test_increment_counter(self):
        """Test incrementing counter."""
        collector = MetricsCollector()
        
        collector.increment_counter("test.counter", 5.0)
        
        assert collector.counters["test.counter"] == 5.0
        
        collector.increment_counter("test.counter", 3.0)
        
        assert collector.counters["test.counter"] == 8.0
    
    def test_set_gauge(self):
        """Test setting gauge."""
        collector = MetricsCollector()
        
        collector.set_gauge("test.gauge", 42.5)
        
        assert collector.gauges["test.gauge"] == 42.5
    
    def test_record_histogram(self):
        """Test recording histogram."""
        collector = MetricsCollector()
        
        collector.record_histogram("test.histogram", 10.0)
        collector.record_histogram("test.histogram", 20.0)
        collector.record_histogram("test.histogram", 30.0)
        
        stats = collector.get_histogram_stats("test.histogram")
        
        assert stats["count"] == 3
        assert stats["min"] == 10.0
        assert stats["max"] == 30.0
        assert stats["avg"] == 20.0
    
    def test_record_timer(self):
        """Test recording timer."""
        collector = MetricsCollector()
        
        collector.record_timer("test.timer", 0.1)
        collector.record_timer("test.timer", 0.2)
        collector.record_timer("test.timer", 0.3)
        
        stats = collector.get_timer_stats("test.timer")
        
        assert stats["count"] == 3
        assert stats["min"] == 0.1
        assert stats["max"] == 0.3
        assert stats["avg"] == 0.2
    
    def test_get_metric(self):
        """Test getting metric data."""
        collector = MetricsCollector()
        
        collector.record_custom_metric("test.metric", 100.0, "gauge")
        
        metrics = collector.get_metric("test.metric", 300)
        
        assert len(metrics) == 1
        assert metrics[0].name == "test.metric"
        assert metrics[0].value == 100.0


class TestPrometheusExporter:
    """Test PrometheusExporter."""
    
    def test_prometheus_export(self):
        """Test Prometheus metrics export."""
        collector = MetricsCollector()
        exporter = PrometheusExporter(collector)
        
        # Add some metrics
        collector.increment_counter("test.counter", 100.0)
        collector.set_gauge("test.gauge", 50.0)
        collector.record_histogram("test.histogram", 10.0)
        collector.record_timer("test.timer", 0.1)
        
        # Export metrics
        prometheus_data = exporter.export_metrics()
        
        assert isinstance(prometheus_data, str)
        assert "test.counter" in prometheus_data
        assert "test.gauge" in prometheus_data
        assert "test.histogram_count" in prometheus_data
        assert "test.timer_duration_count" in prometheus_data


class TestCustomMetrics:
    """Test CustomMetrics."""
    
    def test_custom_metrics_initialization(self):
        """Test custom metrics initialization."""
        collector = MetricsCollector()
        custom_metrics = CustomMetrics(collector)
        
        assert custom_metrics.collector == collector
    
    def test_record_api_request(self):
        """Test recording API request metrics."""
        collector = MetricsCollector()
        custom_metrics = CustomMetrics(collector)
        
        custom_metrics.record_api_request("/api/test", "GET", 200, 0.1)
        
        # Check that metrics were recorded
        assert collector.counters["udp_api_requests_total"] > 0
        assert len(collector.timers["udp_api_request_duration"]) > 0
    
    def test_record_dependency_scan(self):
        """Test recording dependency scan metrics."""
        collector = MetricsCollector()
        custom_metrics = CustomMetrics(collector)
        
        custom_metrics.record_dependency_scan("pypi", 1000, 50, 200)
        
        # Check that metrics were recorded
        assert collector.gauges["udp_dependencies_total"] == 1000
        assert collector.gauges["udp_dependencies_vulnerable"] == 50
        assert collector.gauges["udp_dependencies_outdated"] == 200
    
    def test_record_security_event(self):
        """Test recording security event metrics."""
        collector = MetricsCollector()
        custom_metrics = CustomMetrics(collector)
        
        custom_metrics.record_security_event("vulnerability", "high")
        
        # Check that metrics were recorded
        assert collector.counters["udp_security_events_total"] > 0
        assert collector.counters["udp_security_vulnerabilities_total"] > 0
    
    def test_record_ml_prediction(self):
        """Test recording ML prediction metrics."""
        collector = MetricsCollector()
        custom_metrics = CustomMetrics(collector)
        
        custom_metrics.record_ml_prediction("risk_model", "risk_prediction", 0.92, 0.05)
        
        # Check that metrics were recorded
        assert collector.counters["udp_ml_predictions_total"] > 0
        assert collector.gauges["udp_ml_model_accuracy"] == 0.92
        assert len(collector.timers["udp_ml_prediction_duration"]) > 0


class TestDashboardManager:
    """Test DashboardManager."""
    
    def test_dashboard_manager_initialization(self):
        """Test dashboard manager initialization."""
        manager = DashboardManager()
        
        assert len(manager.dashboards) == 0
        assert len(manager.widgets) == 0
        assert manager.is_running is False
        assert len(manager._update_tasks) == 0
    
    def test_create_dashboard(self):
        """Test creating dashboard."""
        manager = DashboardManager()
        
        dashboard = manager.create_dashboard("Test Dashboard", "A test dashboard")
        
        assert dashboard.id is not None
        assert dashboard.name == "Test Dashboard"
        assert dashboard.description == "A test dashboard"
        assert dashboard.id in manager.dashboards
    
    def test_add_widget(self):
        """Test adding widget to dashboard."""
        manager = DashboardManager()
        
        dashboard = manager.create_dashboard("Test Dashboard")
        
        widget = DashboardWidget(
            id="test-widget",
            title="Test Widget",
            widget_type=WidgetType.METRIC,
            position={"x": 0, "y": 0, "width": 3, "height": 2}
        )
        
        success = manager.add_widget(dashboard.id, widget)
        
        assert success is True
        assert widget in dashboard.widgets
        assert widget.id in manager.widgets
    
    def test_get_dashboard_list(self):
        """Test getting dashboard list."""
        manager = DashboardManager()
        
        manager.create_dashboard("Dashboard 1")
        manager.create_dashboard("Dashboard 2")
        
        dashboards = manager.get_dashboard_list()
        
        assert len(dashboards) == 2
        assert dashboards[0]["name"] == "Dashboard 1"
        assert dashboards[1]["name"] == "Dashboard 2"
    
    def test_get_dashboard(self):
        """Test getting dashboard data."""
        manager = DashboardManager()
        
        dashboard = manager.create_dashboard("Test Dashboard")
        
        dashboard_data = manager.get_dashboard(dashboard.id)
        
        assert dashboard_data is not None
        assert dashboard_data["id"] == dashboard.id
        assert dashboard_data["name"] == "Test Dashboard"
    
    def test_create_default_dashboards(self):
        """Test creating default dashboards."""
        manager = DashboardManager()
        
        manager.create_default_dashboards()
        
        dashboards = manager.get_dashboard_list()
        
        assert len(dashboards) >= 3
        dashboard_names = [d["name"] for d in dashboards]
        assert "System Overview" in dashboard_names
        assert "Dependencies" in dashboard_names
        assert "Alerts" in dashboard_names


class TestObservabilityManager:
    """Test ObservabilityManager."""
    
    def test_observability_manager_initialization(self):
        """Test observability manager initialization."""
        manager = ObservabilityManager()
        
        assert manager.tracing is not None
        assert manager.log_aggregator is not None
        assert manager.apm_tracer is not None
        assert manager.is_running is False
    
    def test_get_observability_summary(self):
        """Test getting observability summary."""
        manager = ObservabilityManager()
        
        summary = manager.get_observability_summary()
        
        assert "tracing" in summary
        assert "logging" in summary
        assert "performance" in summary
        assert "system_status" in summary
    
    def test_get_service_health(self):
        """Test getting service health."""
        manager = ObservabilityManager()
        
        health = manager.get_service_health("test-service")
        
        assert "service" in health
        assert "status" in health
        assert "error_count" in health
        assert "active_operations" in health
        assert "performance" in health
        assert "recent_errors" in health
        assert health["service"] == "test-service"
    
    def test_get_trace_analysis(self):
        """Test getting trace analysis."""
        manager = ObservabilityManager()
        
        # Create a test trace
        trace_id = manager.tracing.start_span("test-operation")
        manager.tracing.finish_span(trace_id)
        
        analysis = manager.get_trace_analysis(trace_id)
        
        assert "trace_id" in analysis
        assert "total_duration" in analysis
        assert "span_count" in analysis
        assert "error_count" in analysis
        assert "status" in analysis
        assert "spans" in analysis
        assert analysis["trace_id"] == trace_id


class TestDistributedTracing:
    """Test DistributedTracing."""
    
    def test_tracing_initialization(self):
        """Test distributed tracing initialization."""
        tracing = DistributedTracing()
        
        assert len(tracing.active_spans) == 0
        assert len(tracing.completed_spans) == 0
        assert len(tracing.traces) == 0
    
    def test_start_span(self):
        """Test starting a span."""
        tracing = DistributedTracing()
        
        span_id = tracing.start_span("test-operation")
        
        assert span_id is not None
        assert span_id in tracing.active_spans
        assert span_id in tracing.traces[tracing.active_spans[span_id].trace_id]
    
    def test_finish_span(self):
        """Test finishing a span."""
        tracing = DistributedTracing()
        
        span_id = tracing.start_span("test-operation")
        tracing.finish_span(span_id)
        
        assert span_id not in tracing.active_spans
        assert span_id in [span.id for span in tracing.completed_spans]
    
    def test_add_span_log(self):
        """Test adding log to span."""
        tracing = DistributedTracing()
        
        span_id = tracing.start_span("test-operation")
        tracing.add_span_log(span_id, "Test log message", "info")
        
        span = tracing.get_span(span_id)
        assert len(span.logs) == 1
        assert span.logs[0]["message"] == "Test log message"
        assert span.logs[0]["level"] == "info"
    
    def test_add_span_tag(self):
        """Test adding tag to span."""
        tracing = DistributedTracing()
        
        span_id = tracing.start_span("test-operation")
        tracing.add_span_tag(span_id, "service", "api")
        
        span = tracing.get_span(span_id)
        assert span.tags["service"] == "api"
    
    def test_get_trace(self):
        """Test getting trace."""
        tracing = DistributedTracing()
        
        span_id = tracing.start_span("test-operation")
        trace_id = tracing.active_spans[span_id].trace_id
        tracing.finish_span(span_id)
        
        trace = tracing.get_trace(trace_id)
        
        assert len(trace) == 1
        assert trace[0].id == span_id
        assert trace[0].operation_name == "test-operation"
    
    def test_get_trace_statistics(self):
        """Test getting trace statistics."""
        tracing = DistributedTracing()
        
        # Create some spans
        span1 = tracing.start_span("operation1")
        span2 = tracing.start_span("operation2")
        tracing.finish_span(span1)
        tracing.finish_span(span2)
        
        stats = tracing.get_trace_statistics()
        
        assert "active_spans" in stats
        assert "completed_spans" in stats
        assert "total_traces" in stats
        assert "average_duration" in stats
        assert "status_breakdown" in stats
        assert stats["completed_spans"] == 2


class TestLogAggregator:
    """Test LogAggregator."""
    
    def test_log_aggregator_initialization(self):
        """Test log aggregator initialization."""
        aggregator = LogAggregator()
        
        assert len(aggregator.logs) == 0
        assert len(aggregator.log_levels) == 5
        assert len(aggregator.services) == 0
    
    def test_add_log(self):
        """Test adding log entry."""
        aggregator = LogAggregator()
        
        aggregator.add_log("INFO", "Test log message", "test-service")
        
        assert len(aggregator.logs) == 1
        assert "test-service" in aggregator.services
        assert aggregator.logs[0].level == "INFO"
        assert aggregator.logs[0].message == "Test log message"
        assert aggregator.logs[0].service == "test-service"
    
    def test_get_logs(self):
        """Test getting filtered logs."""
        aggregator = LogAggregator()
        
        # Add some logs
        aggregator.add_log("INFO", "Info message", "service1")
        aggregator.add_log("ERROR", "Error message", "service1")
        aggregator.add_log("INFO", "Another info", "service2")
        
        # Get logs for service1
        logs = aggregator.get_logs(service="service1")
        assert len(logs) == 2
        
        # Get ERROR logs
        logs = aggregator.get_logs(level="ERROR")
        assert len(logs) == 1
        assert logs[0].message == "Error message"
    
    def test_get_log_statistics(self):
        """Test getting log statistics."""
        aggregator = LogAggregator()
        
        # Add some logs
        aggregator.add_log("INFO", "Info message", "service1")
        aggregator.add_log("ERROR", "Error message", "service1")
        aggregator.add_log("WARNING", "Warning message", "service2")
        
        stats = aggregator.get_log_statistics()
        
        assert "total_logs" in stats
        assert "level_breakdown" in stats
        assert "service_breakdown" in stats
        assert "services" in stats
        assert stats["total_logs"] == 3
        assert stats["level_breakdown"]["INFO"] == 1
        assert stats["level_breakdown"]["ERROR"] == 1
        assert stats["level_breakdown"]["WARNING"] == 1
        assert stats["service_breakdown"]["service1"] == 2
        assert stats["service_breakdown"]["service2"] == 1
    
    def test_search_logs(self):
        """Test searching logs."""
        aggregator = LogAggregator()
        
        # Add some logs
        aggregator.add_log("INFO", "User login successful", "auth-service")
        aggregator.add_log("ERROR", "Database connection failed", "db-service")
        aggregator.add_log("INFO", "User logout", "auth-service")
        
        # Search for "login"
        logs = aggregator.search_logs("login")
        assert len(logs) == 1
        assert logs[0].message == "User login successful"
        
        # Search for "User"
        logs = aggregator.search_logs("User")
        assert len(logs) == 2


class TestAPMTracer:
    """Test APMTracer."""
    
    def test_apm_tracer_initialization(self):
        """Test APM tracer initialization."""
        tracing = DistributedTracing()
        log_aggregator = LogAggregator()
        tracer = APMTracer(tracing, log_aggregator)
        
        assert tracer.tracing == tracing
        assert tracer.log_aggregator == log_aggregator
        assert len(tracer.performance_metrics) == 0
    
    def test_trace_function_decorator(self):
        """Test function tracing decorator."""
        tracing = DistributedTracing()
        log_aggregator = LogAggregator()
        tracer = APMTracer(tracing, log_aggregator)
        
        @tracer.trace_function("test-operation", "test-service")
        def test_function():
            return "success"
        
        result = test_function()
        
        assert result == "success"
        assert len(tracer.performance_metrics) == 1
        assert tracer.performance_metrics[0].operation == "test-operation"
        assert tracer.performance_metrics[0].service == "test-service"
    
    def test_trace_async_function_decorator(self):
        """Test async function tracing decorator."""
        tracing = DistributedTracing()
        log_aggregator = LogAggregator()
        tracer = APMTracer(tracing, log_aggregator)
        
        @tracer.trace_async_function("async-test-operation", "test-service")
        async def async_test_function():
            return "async-success"
        
        async def run_test():
            result = await async_test_function()
            return result
        
        result = asyncio.run(run_test())
        
        assert result == "async-success"
        assert len(tracer.performance_metrics) == 1
        assert tracer.performance_metrics[0].operation == "async-test-operation"
        assert tracer.performance_metrics[0].service == "test-service"
    
    def test_get_performance_metrics(self):
        """Test getting performance metrics."""
        tracing = DistributedTracing()
        log_aggregator = LogAggregator()
        tracer = APMTracer(tracing, log_aggregator)
        
        # Add some performance metrics
        tracer._record_performance_metric("test.metric", 0.1, "service1", "operation1")
        tracer._record_performance_metric("test.metric", 0.2, "service1", "operation1")
        tracer._record_performance_metric("test.metric", 0.15, "service2", "operation2")
        
        # Get metrics for service1
        metrics = tracer.get_performance_metrics(service="service1")
        assert len(metrics) == 2
        
        # Get metrics for operation1
        metrics = tracer.get_performance_metrics(operation="operation1")
        assert len(metrics) == 2
    
    def test_get_performance_summary(self):
        """Test getting performance summary."""
        tracing = DistributedTracing()
        log_aggregator = LogAggregator()
        tracer = APMTracer(tracing, log_aggregator)
        
        # Add some performance metrics
        tracer._record_performance_metric("test.metric", 0.1, "service1", "operation1")
        tracer._record_performance_metric("test.metric", 0.2, "service1", "operation1")
        tracer._record_performance_metric("test.metric", 0.15, "service1", "operation1")
        
        summary = tracer.get_performance_summary(service="service1", operation="operation1")
        
        assert "count" in summary
        assert "min" in summary
        assert "max" in summary
        assert "avg" in summary
        assert "p95" in summary
        assert "p99" in summary
        assert summary["count"] == 3
        assert summary["min"] == 0.1
        assert summary["max"] == 0.2
        assert summary["avg"] == 0.15







