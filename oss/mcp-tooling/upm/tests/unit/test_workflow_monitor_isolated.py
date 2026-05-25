"""
Isolated unit tests for workflow monitoring functionality.
Tests only the monitor service without complex database dependencies.
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis


# Mock the problematic imports to avoid circular dependencies
import sys
from unittest.mock import MagicMock

# Mock the entire models module hierarchy
sys.modules["src.udp.core.models.workflow_state"] = MagicMock()
sys.modules["src.udp.core.models.workflow"] = MagicMock()

# Import the monitoring service with mocked dependencies
from src.udp.monitoring.workflow_monitor import (
    WorkflowMonitorService,
    WorkflowHealthStatus,
    AlertSeverity,
    WorkflowMetrics,
    SystemHealthMetrics,
    Alert,
)


@pytest.mark.unit
class TestWorkflowMonitorIsolated:
    """Isolated test suite for WorkflowMonitorService."""

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        return AsyncMock(spec=Redis)

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def workflow_monitor(self, mock_redis, mock_db_session):
        """Create workflow monitor service instance."""
        return WorkflowMonitorService(mock_db_session, mock_redis)

    @pytest.fixture
    def sample_workflow_metrics(self):
        """Create sample workflow metrics."""
        return WorkflowMetrics(
            workflow_id=str(uuid4()),
            workflow_type="dependency_analysis",
            project_id=str(uuid4()),
            total_duration_ms=300000,
            steps_executed=10,
            steps_failed=1,
            started_at=datetime.utcnow() - timedelta(minutes=30),
        )

    @pytest.fixture
    def sample_health_metrics(self):
        """Create sample health metrics."""
        return SystemHealthMetrics(
            total_workflows=15,
            active_workflows=5,
            completed_workflows=8,
            failed_workflows=2,
            average_workflow_duration_ms=180000,
            workflow_throughput_per_hour=2.5,
            redis_memory_usage_mb=512,
            database_connections=20,
            overall_error_rate=0.05,
            timeout_rate=0.02,
            health_status=WorkflowHealthStatus.HEALTHY,
            last_updated=datetime.utcnow(),
        )

    @pytest.fixture
    def sample_alert(self):
        """Create sample alert."""
        return Alert(
            id=str(uuid4()),
            severity=AlertSeverity.HIGH,
            title="High Error Rate Detected",
            description="System error rate has exceeded threshold",
            workflow_id=str(uuid4()),
            workflow_type="dependency_analysis",
            metric_name="overall_error_rate",
            current_value=0.15,
            threshold_value=0.1,
            triggered_at=datetime.utcnow() - timedelta(minutes=15),
        )

    def test_workflow_monitor_initialization(self, workflow_monitor):
        """Test workflow monitor initialization."""
        assert workflow_monitor is not None
        assert workflow_monitor._alert_thresholds is not None
        assert workflow_monitor._metrics_cache is not None
        assert workflow_monitor._monitoring_active is False
        assert workflow_monitor._monitoring_task is None

    def test_workflow_metrics_dataclass(self):
        """Test WorkflowMetrics dataclass functionality."""
        metrics = WorkflowMetrics(
            workflow_id=str(uuid4()),
            workflow_type="security_scan",
            project_id=str(uuid4()),
            total_duration_ms=450000,
            cpu_usage=0.75,
            memory_usage_mb=1024,
            steps_executed=15,
            steps_failed=2,
            steps_retried=1,
        )

        assert metrics.workflow_id is not None
        assert metrics.workflow_type == "security_scan"
        assert metrics.total_duration_ms == 450000
        assert metrics.cpu_usage == 0.75
        assert metrics.memory_usage_mb == 1024
        assert metrics.steps_executed == 15
        assert metrics.steps_failed == 2
        assert metrics.steps_retried == 1

        # Test calculated metrics
        assert metrics.error_rate == 2 / 15  # steps_failed / steps_executed
        assert metrics.retry_rate == 1 / 15  # steps_retried / steps_executed

    def test_system_health_metrics_dataclass(self):
        """Test SystemHealthMetrics dataclass functionality."""
        metrics = SystemHealthMetrics(
            total_workflows=100,
            active_workflows=20,
            completed_workflows=75,
            failed_workflows=5,
            average_workflow_duration_ms=180000,
            workflow_throughput_per_hour=4.2,
            redis_memory_usage_mb=1024,
            database_connections=50,
            overall_error_rate=0.05,
            health_status=WorkflowHealthStatus.HEALTHY,
        )

        assert metrics.total_workflows == 100
        assert metrics.active_workflows == 20
        assert metrics.completed_workflows == 75
        assert metrics.failed_workflows == 5
        assert metrics.average_workflow_duration_ms == 180000
        assert metrics.workflow_throughput_per_hour == 4.2
        assert metrics.redis_memory_usage_mb == 1024
        assert metrics.database_connections == 50
        assert metrics.overall_error_rate == 0.05
        assert metrics.health_status == WorkflowHealthStatus.HEALTHY
        assert metrics.last_updated is not None
        assert metrics.active_alerts == []  # Default empty list

    def test_alert_dataclass(self):
        """Test Alert dataclass functionality."""
        alert_id = str(uuid4())
        workflow_id = str(uuid4())

        alert = Alert(
            id=alert_id,
            severity=AlertSeverity.CRITICAL,
            title="Critical System Error",
            description="Database connection pool exhausted",
            workflow_id=workflow_id,
            workflow_type="dependency_analysis",
            metric_name="database_connections",
            current_value=95,
            threshold_value=80,
            triggered_at=datetime.utcnow(),
        )

        assert alert.id == alert_id
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.title == "Critical System Error"
        assert alert.description == "Database connection pool exhausted"
        assert alert.workflow_id == workflow_id
        assert alert.workflow_type == "dependency_analysis"
        assert alert.metric_name == "database_connections"
        assert alert.current_value == 95
        assert alert.threshold_value == 80
        assert alert.triggered_at is not None
        assert alert.resolved_at is None
        assert alert.metadata == {}  # Default empty dict

    async def test_start_stop_monitoring(self, workflow_monitor):
        """Test starting and stopping monitoring."""
        assert not workflow_monitor._monitoring_active

        # Test monitoring start
        await workflow_monitor.start_monitoring(interval_seconds=30)

        assert workflow_monitor._monitoring_active is True
        assert workflow_monitor._monitoring_task is not None

        # Test monitoring stop
        await workflow_monitor.stop_monitoring()

        assert not workflow_monitor._monitoring_active
        # Task should be cancelled after stop

    async def test_monitoring_loop_mock(self, workflow_monitor):
        """Test monitoring loop with mocked collection."""
        collection_call_count = 0

        async def mock_collect():
            nonlocal collection_call_count
            collection_call_count += 1

        workflow_monitor._collect_and_process_metrics = mock_collect

        # Start monitoring
        await workflow_monitor.start_monitoring(interval_seconds=1)

        # Let it run for a short time
        await asyncio.sleep(0.1)

        # Stop monitoring
        await workflow_monitor.stop_monitoring()

        # Verify collection was called multiple times
        assert collection_call_count >= 3

    def test_metrics_caching(self, workflow_monitor):
        """Test metrics caching functionality."""

        # Test caching
        cache_key = "test_metrics"
        test_data = {"test": "data", "timestamp": datetime.utcnow().isoformat()}

        workflow_monitor._cache_metrics(cache_key, test_data)

        # Test retrieval from cache
        cached_result = workflow_monitor._get_cached_metrics(cache_key)
        assert cached_result is not None
        assert cached_result["test"] == "data"

        # Test cache miss
        miss_result = workflow_monitor._get_cached_metrics("nonexistent_key")
        assert miss_result is None

    def test_metrics_cache_expiration(self, workflow_monitor):
        """Test metrics cache expiration."""

        # Add expired entry
        old_cache_key = "old_metrics"
        old_cache_data = {
            "data": {"old": "data"},
            "timestamp": datetime.utcnow() - timedelta(minutes=10),
        }
        workflow_monitor._metrics_cache[old_cache_key] = old_cache_data

        # Add fresh entry
        fresh_cache_key = "fresh_metrics"
        fresh_cache_data = {
            "data": {"fresh": "data"},
            "timestamp": datetime.utcnow(),
        }
        workflow_monitor._metrics_cache[fresh_cache_key] = fresh_cache_data

        # Test cache hit for fresh entry
        fresh_result = workflow_monitor._get_cached_metrics(fresh_cache_key)
        assert fresh_result is not None
        assert fresh_result["data"]["fresh"] == "data"

        # Test cache miss for expired entry
        expired_result = workflow_monitor._get_cached_metrics(old_cache_key)
        assert expired_result is None

        # Verify expired entry was cleaned up
        assert old_cache_key not in workflow_monitor._metrics_cache

    def test_metrics_cache_cleanup(self, workflow_monitor):
        """Test metrics cache cleanup."""

        # Add multiple entries with different ages
        entries = {}
        for i in range(5):
            key = f"test_key_{i}"
            age_minutes = i * 2  # 0, 2, 4, 6, 8 minutes old

            cache_data = {
                "data": {"key": i, "age": age_minutes},
                "timestamp": datetime.utcnow() - timedelta(minutes=age_minutes),
            }
            workflow_monitor._metrics_cache[key] = cache_data
            entries[key] = cache_data

        # Verify initial state
        assert len(workflow_monitor._metrics_cache) == 5

        # Test cleanup (should remove entries older than TTL)
        workflow_monitor._clean_metrics_cache()

        # Verify expired entries were removed
        # TTL is 5 minutes (300 seconds), so entries 6+ minutes old should be removed
        remaining_keys = [
            k
            for k in workflow_monitor._metrics_cache.keys()
            if k.startswith("test_key_")
        ]
        assert len(remaining_keys) <= 3  # Should keep 0, 2, 4 minute entries

    def test_health_status_calculation(self, workflow_monitor):
        """Test health status calculation."""

        # Test healthy metrics
        healthy_counts = {"total": 50, "active": 10, "failed": 2}
        healthy_performance = {"avg_duration": 120000}
        healthy_errors = {"overall_error_rate": 0.04}

        status = workflow_monitor._calculate_health_status(
            healthy_counts, healthy_performance, healthy_errors
        )
        assert status == WorkflowHealthStatus.HEALTHY

        # Test degraded metrics
        degraded_counts = {"total": 50, "active": 100, "failed": 5}
        degraded_performance = {"avg_duration": 600000}  # 10 minutes
        degraded_errors = {"overall_error_rate": 0.12}

        status = workflow_monitor._calculate_health_status(
            degraded_counts, degraded_performance, degraded_errors
        )
        assert status == WorkflowHealthStatus.DEGRADED

        # Test unhealthy metrics
        unhealthy_counts = {"total": 50, "active": 50, "failed": 15}
        unhealthy_performance = {"avg_duration": 900000}
        unhealthy_errors = {"overall_error_rate": 0.30}

        status = workflow_monitor._calculate_health_status(
            unhealthy_counts, unhealthy_performance, unhealthy_errors
        )
        assert status == WorkflowHealthStatus.UNHEALTHY

    async def test_alert_creation(self, workflow_monitor):
        """Test alert creation."""

        # Mock Redis operations
        workflow_monitor.redis.setex.return_value = True
        workflow_monitor.redis.sadd.return_value = True

        alert = await workflow_monitor._create_alert(
            severity=AlertSeverity.HIGH,
            title="Test Alert",
            description="This is a test alert",
            metric_name="test_metric",
            current_value=100,
            threshold_value=50,
            workflow_id=str(uuid4()),
        )

        # Verify alert properties
        assert alert.severity == AlertSeverity.HIGH
        assert alert.title == "Test Alert"
        assert alert.description == "This is a test alert"
        assert alert.metric_name == "test_metric"
        assert alert.current_value == 100
        assert alert.threshold_value == 50
        assert alert.triggered_at is not None
        assert alert.resolved_at is None

        # Verify Redis operations
        workflow_monitor.redis.setex.assert_called_once()
        workflow_monitor.redis.sadd.assert_called_once()

    async def test_alert_resolution(self, workflow_monitor):
        """Test alert resolution."""
        alert_id = str(uuid4())

        # Mock alert data
        alert_data = {
            "id": alert_id,
            "severity": "high",
            "title": "Test Alert",
            "description": "Test description",
            "triggered_at": datetime.utcnow().isoformat(),
        }

        workflow_monitor.redis.get.return_value = json.dumps(alert_data)
        workflow_monitor.redis.setex.return_value = True
        workflow_monitor.redis.srem.return_value = True

        # Test alert resolution
        result = await workflow_monitor.resolve_alert(alert_id)

        assert result is True

        # Verify Redis operations
        workflow_monitor.redis.get.assert_called_once_with(f"alert:{alert_id}")
        workflow_monitor.redis.setex.assert_called_once()
        workflow_monitor.redis.srem.assert_called_once_with("active_alerts", alert_id)

    async def test_resolve_nonexistent_alert(self, workflow_monitor):
        """Test resolving non-existent alert."""
        alert_id = str(uuid4())

        workflow_monitor.redis.get.return_value = None

        # Test alert resolution
        result = await workflow_monitor.resolve_alert(alert_id)

        assert result is False

    def test_alert_handler_management(self, workflow_monitor):
        """Test alert handler management."""
        handler_calls = []

        def test_handler(alert):
            handler_calls.append(alert)

        # Add alert handler
        workflow_monitor.add_alert_handler(test_handler)

        assert len(workflow_monitor._alert_handlers) == 1
        assert workflow_monitor._alert_handlers[0] == test_handler

        # Test handler notification
        sample_alert = Alert(
            id=str(uuid4()),
            severity=AlertSeverity.MEDIUM,
            title="Test Notification",
            description="Test alert notification",
            metric_name="test",
            current_value=10,
            threshold_value=5,
            triggered_at=datetime.utcnow(),
        )

        asyncio.run(workflow_monitor._notify_alert_handlers(sample_alert))

        assert len(handler_calls) == 1
        assert handler_calls[0].title == "Test Notification"

    async def test_get_active_alerts(self, workflow_monitor):
        """Test getting active alerts."""
        alert_ids = [str(uuid4()), str(uuid4())]

        # Mock Redis data
        alert_data = [
            {
                "id": alert_ids[0],
                "severity": "high",
                "title": "Alert 1",
                "description": "Test alert 1",
                "triggered_at": datetime.utcnow().isoformat(),
            },
            {
                "id": alert_ids[1],
                "severity": "medium",
                "title": "Alert 2",
                "description": "Test alert 2",
                "triggered_at": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
            },
        ]

        workflow_monitor.redis.smembers.return_value = alert_ids
        workflow_monitor.redis.get.side_effect = [
            json.dumps(alert_data[0]),
            json.dumps(alert_data[1]),
        ]

        # Test active alerts retrieval
        alerts = await workflow_monitor.get_active_alerts()

        assert len(alerts) == 2
        assert alerts[0].id == alert_ids[0]
        assert alerts[0].severity == AlertSeverity.HIGH
        assert alerts[1].id == alert_ids[1]
        assert alerts[1].severity == AlertSeverity.MEDIUM

    async def test_get_active_alerts_empty(self, workflow_monitor):
        """Test getting active alerts when none exist."""
        workflow_monitor.redis.smembers.return_value = set()

        alerts = await workflow_monitor.get_active_alerts()

        assert len(alerts) == 0

    def test_alert_thresholds_configuration(self, workflow_monitor):
        """Test alert thresholds configuration."""

        thresholds = workflow_monitor._alert_thresholds

        # Verify default thresholds
        assert thresholds["workflow_duration_ms"] == 300000  # 5 minutes
        assert thresholds["error_rate"] == 0.1  # 10%
        assert thresholds["retry_rate"] == 0.2  # 20%
        assert thresholds["memory_usage_mb"] == 1024  # 1GB
        assert thresholds["cpu_usage"] == 0.8  # 80%
        assert thresholds["timeout_rate"] == 0.05  # 5%

    async def test_performance_report_data_structure(self, workflow_monitor):
        """Test performance report data structure."""

        report = await workflow_monitor.get_workflow_performance_report(
            workflow_type="dependency_analysis",
            start_time=datetime.utcnow() - timedelta(days=7),
            end_time=datetime.utcnow(),
        )

        # Verify report structure
        assert "period" in report
        assert "summary" in report
        assert "performance" in report
        assert "resource_usage" in report
        assert "errors" in report

        # Verify period data
        period = report["period"]
        assert "start_time" in period
        assert "end_time" in period
        assert period["workflow_type"] == "dependency_analysis"

        # Verify summary structure
        summary = report["summary"]
        assert "total_workflows" in summary
        assert "completed_workflows" in summary
        assert "failed_workflows" in summary

        # Verify performance structure
        performance = report["performance"]
        assert "average_duration_ms" in performance
        assert "min_duration_ms" in performance
        assert "max_duration_ms" in performance
        assert "average_steps_executed" in performance

    def test_workflow_monitor_error_handling(self, workflow_monitor):
        """Test error handling in workflow monitor."""

        # Test that the service handles exceptions gracefully
        try:
            # This should not raise an exception
            workflow_monitor._get_cached_metrics("nonexistent")
        except Exception as e:
            pytest.fail(f"Unexpected exception raised: {e}")

        # Test cache operations
        try:
            workflow_monitor._cache_metrics("test", {"data": "test"})
            workflow_monitor._clean_metrics_cache()
        except Exception as e:
            pytest.fail(f"Unexpected exception raised: {e}")

    def test_enums_and_constants(self):
        """Test enums and constants."""

        # Test WorkflowHealthStatus enum
        assert WorkflowHealthStatus.HEALTHY == "healthy"
        assert WorkflowHealthStatus.DEGRADED == "degraded"
        assert WorkflowHealthStatus.UNHEALTHY == "unhealthy"
        assert WorkflowHealthStatus.UNKNOWN == "unknown"

        # Test AlertSeverity enum
        assert AlertSeverity.LOW == "low"
        assert AlertSeverity.MEDIUM == "medium"
        assert AlertSeverity.HIGH == "high"
        assert AlertSeverity.CRITICAL == "critical"

    def test_service_configuration(self, workflow_monitor):
        """Test service configuration."""

        # Verify cache TTL
        assert workflow_monitor._cache_ttl == 300  # 5 minutes

        # Verify initial state
        assert workflow_monitor._monitoring_active is False
        assert workflow_monitor._monitoring_task is None
        assert isinstance(workflow_monitor._metrics_cache, dict)
        assert isinstance(workflow_monitor._alert_handlers, list)
        assert len(workflow_monitor._alert_handlers) == 0
