"""
Unit tests for workflow monitoring service.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.udp.monitoring.workflow_monitor import (
    WorkflowMonitorService,
    WorkflowHealthStatus,
    AlertSeverity,
    WorkflowMetrics,
    SystemHealthMetrics,
    Alert,
)


@pytest.mark.unit
class TestWorkflowMonitorService:
    """Test suite for WorkflowMonitorService."""

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        return AsyncMock()

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

    async def test_get_workflow_metrics(self, workflow_monitor):
        """Test getting workflow metrics."""
        workflow_id = str(uuid4())

        # Mock cache miss
        workflow_monitor._get_cached_metrics.return_value = None

        # Mock database query
        state = MagicMock()
        state.workflow_id = workflow_id
        state.workflow_type = "dependency_analysis"
        state.project_id = str(uuid4())

        metrics = MagicMock()
        metrics.total_duration_ms = 300000
        metrics.steps_executed = 10
        metrics.steps_failed = 1
        metrics.cpu_usage = 0.75
        metrics.memory_usage = 512
        metrics.started_at = datetime.utcnow() - timedelta(minutes=30)

        mock_result = AsyncMock()
        mock_result.scalar.return_value = state
        workflow_monitor.db_session.execute.return_value = mock_result

        metrics_query = MagicMock()
        metrics_query.scalar_one_or_none.return_value = metrics
        workflow_monitor.db_session.execute.return_value = metrics_query

        # Test metrics retrieval
        result = await workflow_monitor.get_workflow_metrics(workflow_id)

        assert result.workflow_id == workflow_id
        assert result.workflow_type == "dependency_analysis"
        assert result.project_id == str(uuid4())
        assert result.total_duration_ms == 300000
        assert result.steps_executed == 10
        assert result.steps_failed == 1
        assert result.cpu_usage == 0.75
        assert result.memory_usage == 512
        assert result.started_at is not None

        # Verify caching
        workflow_monitor._cache_metrics.assert_called_once()

    async def test_get_workflow_metrics_cached(self, workflow_monitor):
        """Test getting workflow metrics from cache."""
        workflow_id = str(uuid4())
        cache_key = f"workflow_metrics:{workflow_id}"
        cached_data = {
            "workflow_id": workflow_id,
            "workflow_type": "security_scan",
            "total_duration_ms": 180000,
            "timestamp": datetime.utcnow(),
        }

        # Mock cache hit
        workflow_monitor._get_cached_metrics.return_value = cached_data

        # Test metrics retrieval from cache
        result = await workflow_monitor.get_workflow_metrics(workflow_id)

        assert result.workflow_id == workflow_id
        assert result.workflow_type == "security_scan"
        assert result.total_duration_ms == 180000

        # Verify database was not called
        workflow_monitor.db_session.execute.assert_not_called()

    async def test_get_workflow_metrics_not_found(self, workflow_monitor):
        """Test getting workflow metrics when workflow not found."""
        workflow_id = str(uuid4())

        # Mock cache miss
        workflow_monitor._get_cached_metrics.return_value = None

        # Mock database query returning None
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        workflow_monitor.db_session.execute.return_value = mock_result

        # Test metrics retrieval
        result = await workflow_monitor.get_workflow_metrics(workflow_id)

        assert result.workflow_id == workflow_id
        assert result.workflow_type == "unknown"
        assert result.project_id == "unknown"
        assert result.total_duration_ms is None
        assert result.steps_executed == 0

    async def test_get_system_health_metrics(self, workflow_monitor):
        """Test getting system health metrics."""

        # Mock workflow counts
        workflow_count_results = [
            ("total", 15),
            ("active", 5),
            ("completed", 8),
            ("failed", 2),
        ]

        mock_result = MagicMock()
        mock_result.all.return_value = workflow_count_results
        workflow_monitor.db_session.execute.return_value = mock_result

        # Mock performance metrics
        perf_metrics = {"avg_duration": 180000, "throughput": 2.5}
        workflow_monitor._get_performance_metrics.return_value = perf_metrics

        # Mock resource metrics
        resource_metrics = {"redis_memory": 512}
        workflow_monitor._get_resource_metrics.return_value = resource_metrics

        # Mock error metrics
        error_metrics = {"overall_error_rate": 0.05, "timeout_rate": 0.02}
        workflow_monitor._get_error_metrics.return_value = error_metrics

        # Test health metrics retrieval
        result = await workflow_monitor.get_system_health_metrics()

        assert result.total_workflows == 15
        assert result.active_workflows == 5
        assert result.completed_workflows == 8
        assert result.failed_workflows == 2
        assert result.average_workflow_duration_ms == 180000
        assert result.workflow_throughput_per_hour == 2.5
        assert result.redis_memory_usage_mb == 512
        assert result.database_connections == 0  # Default from mock
        assert result.overall_error_rate == 0.05
        assert result.timeout_rate == 0.02
        assert result.health_status == WorkflowHealthStatus.HEALTHY
        assert result.last_updated is not None

    async def test_check_and_create_alerts_error_rate(self, workflow_monitor):
        """Test alert creation for high error rate."""

        health_metrics = self.sample_health_metrics()
        health_metrics.overall_error_rate = 0.15  # Above threshold

        # Test alert creation
        await workflow_monitor._check_and_create_alerts(health_metrics)

        # Verify alert was created
        workflow_monitor._create_alert.assert_called_once()

        alert_call = workflow_monitor._create_alert.call_args
        assert alert_call[0]["severity"] == AlertSeverity.HIGH
        assert "error rate" in alert_call[0]["title"]
        assert alert_call[0]["metric_name"] == "overall_error_rate"
        assert alert_call[0]["current_value"] == 0.15
        assert alert_call[0]["threshold_value"] == 0.1

    async def test_check_and_create_alerts_multiple_alerts(self, workflow_monitor):
        """Test multiple alert creation."""

        health_metrics = self.sample_health_metrics()
        health_metrics.failed_workflows = 15  # Above threshold
        health_metrics.active_workflows = 1000  # Above threshold

        # Test multiple alerts creation
        await workflow_monitor._check_and_create_alerts(health_metrics)

        # Verify multiple alerts were created
        assert workflow_monitor._create_alert.call_count == 2

        # Check alert types
        alert_calls = workflow_monitor._create_alert.call_args_list

        high_error_alert = next(
            (call for call in alert_calls if call[0]["severity"] == AlertSeverity.HIGH),
            None,
        )
        medium_queue_alert = next(
            (
                call
                for call in alert_calls
                if call[0]["severity"] == AlertSeverity.MEDIUM
            ),
            None,
        )

        assert high_error_alert is not None
        assert medium_queue_alert is not None
        assert "Error Rate" in high_error_alert[0]["title"]
        assert "Workflow Queue" in medium_queue_alert[0]["title"]

    async def test_check_and_create_alerts_no_alerts(self, workflow_monitor):
        """Test no alerts when metrics are healthy."""

        health_metrics = self.sample_health_metrics()
        health_metrics.overall_error_rate = 0.01  # Below threshold

        # Test no alerts created
        await workflow_monitor._check_and_create_alerts(health_metrics)

        # Verify no alerts were created
        workflow_monitor._create_alert.assert_not_called()

    async def test_get_active_alerts(self, workflow_monitor):
        """Test getting active alerts."""

        # Mock Redis data
        alert_ids = [str(uuid4()), str(uuid4())]
        alert_data = [
            {
                "id": alert_ids[0],
                "severity": "high",
                "title": "Test Alert 1",
                "description": "Test description",
                "workflow_id": str(uuid4()),
                "triggered_at": datetime.utcnow().isoformat(),
            },
            {
                "id": alert_ids[1],
                "severity": "medium",
                "title": "Test Alert 2",
                "description": "Test description",
                "workflow_id": str(uuid4()),
                "triggered_at": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
            },
        ]

        workflow_monitor.redis.smembers.return_value = alert_ids
        alert_get_results = []
        for alert_id in alert_ids:
            workflow_monitor.redis.get.return_value = json.dumps(alert_data[0])
            alert_get_results.append(json.dumps(alert_data[0]))

        # Test active alerts retrieval
        result = await workflow_monitor.get_active_alerts()

        assert len(result) == 2
        assert result[0].id == alert_ids[0]
        assert result[0].severity == AlertSeverity.HIGH
        assert result[1].id == alert_ids[1]
        assert result[1].severity == AlertSeverity.MEDIUM
        assert result[0].workflow_id is not None
        assert result[1].workflow_id is not None

    async def test_resolve_alert(self, workflow_monitor):
        """Test alert resolution."""
        alert_id = str(uuid4())

        # Mock alert data in Redis
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
        workflow_monitor.redis.setex.assert_called_once_with(
            f"alert:{alert_id}", 86400, json.dumps(alert_data)
        )
        workflow_monitor.redis.srem.assert_called_once_with("active_alerts", alert_id)

    async def test_resolve_nonexistent_alert(self, workflow_monitor):
        """Test resolving non-existent alert."""
        alert_id = str(uuid4())

        workflow_monitor.redis.get.return_value = None

        # Test alert resolution
        result = await workflow_monitor.resolve_alert(alert_id)

        assert result is False

    async def test_add_alert_handler(self, workflow_monitor):
        """Test adding alert handler."""
        handler_called = False

        def test_handler(alert):
            nonlocal handler_called
            handler_called = True

        workflow_monitor.add_alert_handler(test_handler)

        # Verify handler was added
        assert len(workflow_monitor._alert_handlers) == 1
        assert workflow_monitor._alert_handlers[0] == test_handler

    async def test_alert_handler_notification(self, workflow_monitor):
        """Test alert handler notification."""
        notification_received = False

        async def test_handler(alert):
            nonlocal notification_received
            notification_received = True

        workflow_monitor.add_alert_handler(test_handler)

        # Create alert
        alert = self.sample_alert()

        # Mock the internal notification call
        workflow_monitor._notify_alert_handlers(alert)

        assert notification_received is True

    async def test_start_monitoring(self, workflow_monitor):
        """Test starting workflow monitoring."""
        assert not workflow_monitor._monitoring_active

        # Test monitoring start
        await workflow_monitor.start_monitoring(interval_seconds=30)

        assert workflow_monitor._monitoring_active is True
        assert workflow_monitor._monitoring_task is not None

    async def test_stop_monitoring(self, workflow_monitor):
        """Test stopping workflow monitoring."""

        # Start monitoring first
        await workflow_monitor.start_monitoring(interval_seconds=30)
        assert workflow_monitor._monitoring_active is True

        # Test monitoring stop
        await workflow_monitor.stop_monitoring()

        assert not workflow_monitor._monitoring_active
        assert workflow_monitor._monitoring_task.cancelled is True

    async def test_monitoring_loop_execution(self, workflow_monitor):
        """Test the main monitoring loop execution."""

        loop_iterations = 0
        collection_count = 0

        def mock_collect_and_process():
            nonlocal loop_iterations, collection_count
            loop_iterations += 1
            collection_count += 1

        # Replace the monitoring loop with a mock
        workflow_monitor._collect_and_process_metrics = mock_collect_and_process

        # Start monitoring
        await workflow_monitor.start_monitoring(interval_seconds=1)

        # Let it run for a few iterations
        await asyncio.sleep(0.1)

        # Stop monitoring
        await workflow_monitor.stop_monitoring()

        # Verify loop executed multiple times
        assert loop_iterations >= 3
        assert collection_count >= 3

        # Verify metrics collection was called
        workflow_monitor._collect_and_process_metrics.assert_called()

    async def test_metrics_caching(self, workflow_monitor):
        """Test metrics caching functionality."""

        # Test caching
        metrics = self.sample_workflow_metrics()
        cache_key = f"workflow_metrics:{metrics.workflow_id}"

        workflow_monitor._cache_metrics(cache_key, asdict(metrics))

        # Test retrieval from cache
        cached_result = workflow_monitor._get_cached_metrics(cache_key)
        assert cached_result is not None
        assert cached_result["workflow_id"] == metrics.workflow_id

        # Test cache expiration
        workflow_monitor._metrics_cache[cache_key]["timestamp"] = (
            datetime.utcnow() - timedelta(minutes=10)
        )

        expired_result = workflow_monitor._get_cached_metrics(cache_key)
        assert expired_result is None
        assert workflow_monitor._metrics_cache == {}

    async def test_metrics_cache_cleanup(self, workflow_monitor):
        """Test metrics cache cleanup."""

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

        # Test cleanup
        workflow_monitor._clean_metrics_cache()

        # Verify expired entry was removed
        assert old_cache_key not in workflow_monitor._metrics_cache
        assert fresh_cache_key in workflow_monitor._metrics_cache

    async def test_calculate_health_status_healthy(self, workflow_monitor):
        """Test health status calculation for healthy system."""

        counts = {"total": 20, "active": 5, "failed": 0}
        performance = {"avg_duration": 120000}
        errors = {"overall_error_rate": 0.02}

        status = workflow_monitor._calculate_health_status(
            workflow_counts=counts,
            performance_metrics=performance,
            error_metrics=errors,
        )

        assert status == WorkflowHealthStatus.HEALTHY

    async def test_calculate_health_status_degraded(self, workflow_monitor):
        """Test health status calculation for degraded system."""

        counts = {"total": 20, "active": 15, "failed": 2}
        performance = {"avg_duration": 600000}  # 10 minutes
        errors = {"overall_error_rate": 0.15}

        status = workflow_monitor._calculate_health_status(
            workflow_counts=counts,
            performance_metrics=performance,
            error_metrics=errors,
        )

        assert status == WorkflowHealthStatus.DEGRADED

    async def test_calculate_health_status_unhealthy(self, workflow_monitor):
        """Test health status calculation for unhealthy system."""

        counts = {"total": 20, "active": 1000, "failed": 5}
        performance = {"avg_duration": 600000}
        errors = {"overall_error_rate": 0.25}

        status = workflow_monitor._calculate_health_status(
            workflow_counts=counts,
            performance_metrics=performance,
            error_metrics=errors,
        )

        assert status == WorkflowHealthStatus.UNHEALTHY

    async def test_get_workflow_performance_report(self, workflow_monitor):
        """Test workflow performance report generation."""

        workflow_id = str(uuid4())

        # Mock metrics data
        metrics_data = [
            {
                "workflow_id": workflow_id,
                "total_duration_ms": 300000,
                "steps_executed": 15,
                "steps_failed": 1,
                "started_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                "completed_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
            },
            {
                "workflow_id": str(uuid4()),
                "total_duration_ms": 180000,
                "steps_executed": 10,
                "started_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                "completed_at": None,  # Still running
            },
        ]

        # Mock database queries
        def mock_execute(query):
            result = MagicMock()
            result.scalars.return_value.all.return_value = metrics_data
            return result

        workflow_monitor.db_session.execute.side_effect = mock_execute

        # Test report generation
        report = await workflow_monitor.get_workflow_performance_report(
            start_time=datetime.utcnow() - timedelta(days=7),
            end_time=datetime.utcnow(),
        )

        # Verify report structure
        assert "period" in report
        assert "summary" in report
        assert "performance" in report
        assert "resource_usage" in report

        # Verify summary data
        assert report["summary"]["total_workflows"] == 2
        assert report["summary"]["completed_workflows"] == 1

        # Verify performance data
        assert "average_duration_ms" in report["performance"]
        assert report["performance"]["average_steps_executed"] == 12.5
        assert report["performance"]["average_steps_failed"] == 0.5

    async def test_workflow_monitor_configuration(self, workflow_monitor):
        """Test workflow monitor configuration."""

        # Verify default alert thresholds
        assert workflow_monitor._alert_thresholds["workflow_duration_ms"] == 300000
        assert workflow_monitor._alert_thresholds["error_rate"] == 0.1
        assert workflow_monitor._alert_thresholds["memory_usage_mb"] == 1024
        assert workflow_monitor._alert_thresholds["cpu_usage"] == 0.8
        assert workflow_monitor._alert_thresholds["timeout_rate"] == 0.05

        # Verify cache TTL
        assert workflow_monitor._cache_ttl == 300  # 5 minutes

    async def test_get_step_details(self, workflow_monitor):
        """Test getting detailed step metrics."""

        workflow_id = str(uuid4())

        # Mock workflow events
        events = [
            {
                "step": "dependency_scan",
                "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
            },
            {
                "step": "vulnerability_scan",
                "timestamp": (datetime.utcnow() - timedelta(minutes=3)).isoformat(),
            },
        ]

        def mock_execute(query):
            result = MagicMock()
            result.scalars.return_value.all.return_value = events
            return result

        workflow_monitor.db_session.execute.side_effect = mock_execute

        # Test step details retrieval
        step_details = await workflow_monitor._get_step_details(workflow_id)

        assert "dependency_scan" in step_details
        assert "vulnerability_scan" in step_details

        # Verify step data structure
        scan_step = step_details["dependency_scan"]
        assert "start_time" in scan_step
        assert scan_step["status"] == "unknown"
        assert scan_step["events"] == []

        # Verify events were assigned to correct steps
        assert len(scan_step["events"]) == 0
        vuln_step = step_details["vulnerability_scan"]
        assert len(vuln_step["events"]) == 0

    async def test_error_handling_in_metrics_collection(self, workflow_monitor):
        """Test error handling in metrics collection."""

        # Mock Redis error
        workflow_monitor.redis.info.side_effect = Exception("Redis connection failed")

        # Test error handling
        health_metrics = await workflow_monitor.get_system_health_metrics()

        # Verify graceful degradation
        assert health_metrics.health_status == WorkflowHealthStatus.DEGRADED
        assert health_metrics.redis_memory_usage_mb == 0  # Default value
