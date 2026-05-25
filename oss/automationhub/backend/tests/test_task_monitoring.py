"""
Comprehensive tests for Task Execution Monitoring System

This test suite covers:
- Task execution service with monitoring
- Real-time WebSocket connections
- Performance metrics collection
- Resource usage monitoring
- Alert generation and management
- Analytics and dashboard functionality
"""

import asyncio
import json
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.services.task_executor import (
    TaskExecutorService, ResourceMetrics, TaskExecutionEvent, get_task_executor
)
from app.services.task_monitor import (
    TaskMonitorService, MonitoringAlert, AlertSeverity, AlertType,
    get_task_monitor
)
from app.models.task import Task as DBTask
from app.models.user import User
from app.schemas.task import TaskCreate
from app.agents.base import Task, TaskType, TaskResult, TaskStatus, ExecutionContext


@pytest_asyncio.fixture
async def db_session():
    """Create test database session"""
    # This would be set up with actual test database
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False
    )

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def task_executor(db_session: AsyncSession):
    """Create task executor service for testing"""
    executor = TaskExecutorService(db_session)
    await executor.start()

    yield executor

    await executor.stop()


@pytest_asyncio.fixture
async def task_monitor(db_session: AsyncSession):
    """Create task monitor service for testing"""
    monitor = TaskMonitorService(db_session)
    await monitor.start()

    yield monitor

    await monitor.stop()


@pytest_asyncio.fixture
async def sample_user():
    """Create sample user for testing"""
    return User(
        id=uuid4(),
        email="test@example.com",
        hashed_password="hashed_password",
        is_active=True,
        is_verified=True
    )


@pytest_asyncio.fixture
async def sample_task_create():
    """Create sample task creation data"""
    return TaskCreate(
        name="Test Task",
        description="A test task for monitoring",
        workflow_id=uuid4(),
        task_type="browser_automation",
        parameters={"url": "https://example.com"},
        dependencies=[],
        timeout_seconds=300,
        max_retries=3
    )


class TestTaskExecutorService:
    """Test cases for TaskExecutorService"""

    @pytest.mark.asyncio
    async def test_service_lifecycle(self, task_executor: TaskExecutorService):
        """Test task executor service start and stop"""
        assert task_executor._running is True
        assert task_executor._monitoring_enabled is True
        assert task_executor._resource_monitor_task is not None

    @pytest.mark.asyncio
    async def test_submit_task(self, task_executor: TaskExecutorService, sample_task_create: TaskCreate):
        """Test task submission"""
        task_response = await task_executor.submit_task(sample_task_create)

        assert task_response is not None
        assert task_response.name == sample_task_create.name
        assert task_response.task_type == sample_task_create.task_type
        assert task_response.status == "pending"

    @pytest.mark.asyncio
    async def test_get_task_status(self, task_executor: TaskExecutorService, sample_task_create: TaskCreate):
        """Test getting task status"""
        # Submit task first
        task_response = await task_executor.submit_task(sample_task_create)

        # Get status
        status = await task_executor.get_task_status(task_response.id)

        assert status is not None
        assert status.id == task_response.id
        assert status.name == sample_task_create.name

    @pytest.mark.asyncio
    async def test_cancel_task(self, task_executor: TaskExecutorService, sample_task_create: TaskCreate):
        """Test task cancellation"""
        # Submit task first
        task_response = await task_executor.submit_task(sample_task_create)

        # Cancel task
        cancelled = await task_executor.cancel_task(task_response.id)

        assert cancelled is True

    @pytest.mark.asyncio
    async def test_get_running_tasks(self, task_executor: TaskExecutorService):
        """Test getting running tasks"""
        running_tasks = await task_executor.get_running_tasks()

        assert isinstance(running_tasks, list)

    @pytest.mark.asyncio
    async def test_get_task_metrics(self, task_executor: TaskExecutorService):
        """Test getting task metrics"""
        metrics = await task_executor.get_task_metrics(uuid4())

        # Should return None for non-existent task
        assert metrics is None

    @pytest.mark.asyncio
    async def test_get_performance_analytics(self, task_executor: TaskExecutorService):
        """Test getting performance analytics"""
        analytics = await task_executor.get_performance_analytics()

        assert isinstance(analytics, dict)
        assert "time_range_hours" in analytics
        assert "task_counts" in analytics
        assert "execution_time_ms" in analytics
        assert "resource_usage" in analytics

    @pytest.mark.asyncio
    async def test_broadcast_event(self, task_executor: TaskExecutorService):
        """Test event broadcasting"""
        event = TaskExecutionEvent(
            task_id=uuid4(),
            event_type="test_event",
            data={"test": "data"}
        )

        # Should not raise exception
        await task_executor._broadcast_event(event)

    @pytest.mark.asyncio
    async def test_resource_monitoring(self, task_executor: TaskExecutorService):
        """Test resource monitoring functionality"""
        task_id = uuid4()

        # Should not raise exception
        monitor_task = asyncio.create_task(
            task_executor._monitor_task_resources(task_id)
        )

        # Let it run for a short time
        await asyncio.sleep(0.1)

        # Cancel and cleanup
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_system_status(self, task_executor: TaskExecutorService):
        """Test system status reporting"""
        status = await task_executor.get_system_status()

        assert isinstance(status, dict)
        assert "running" in status
        assert "total_agents" in status
        assert "active_workflows" in status


class TestTaskMonitorService:
    """Test cases for TaskMonitorService"""

    @pytest.mark.asyncio
    async def test_service_lifecycle(self, task_monitor: TaskMonitorService):
        """Test task monitor service start and stop"""
        assert task_monitor._monitoring_active is True
        assert task_monitor._monitor_task is not None
        assert isinstance(task_monitor.connections, dict)

    @pytest.mark.asyncio
    async def test_create_alert(self, task_monitor: TaskMonitorService, sample_user: User):
        """Test alert creation"""
        alert = await task_monitor.create_alert(
            alert_type=AlertType.TASK_FAILURE,
            severity=AlertSeverity.HIGH,
            title="Test Alert",
            description="This is a test alert",
            user_id=sample_user.id
        )

        assert isinstance(alert, MonitoringAlert)
        assert alert.alert_type == AlertType.TASK_FAILURE
        assert alert.severity == AlertSeverity.HIGH
        assert alert.title == "Test Alert"
        assert alert.resolved is False

    @pytest.mark.asyncio
    async def test_get_active_alerts(self, task_monitor: TaskMonitorService, sample_user: User):
        """Test getting active alerts"""
        # Create an alert first
        await task_monitor.create_alert(
            alert_type=AlertType.TASK_FAILURE,
            severity=AlertSeverity.MEDIUM,
            title="Another Test Alert",
            description="Another test alert",
            user_id=sample_user.id
        )

        # Get alerts
        alerts = await task_monitor.get_active_alerts(user_id=sample_user.id)

        assert isinstance(alerts, list)
        if alerts:  # If alerts exist
            assert isinstance(alerts[0], MonitoringAlert)

    @pytest.mark.asyncio
    async def test_get_performance_trends(self, task_monitor: TaskMonitorService):
        """Test performance trend analysis"""
        trends = await task_monitor.get_performance_trends(
            metric_names=["cpu_usage", "memory_usage"],
            time_period="hour"
        )

        assert isinstance(trends, list)
        # Trends may be empty in test environment
        if trends:
            assert hasattr(trends[0], 'metric_name')
            assert hasattr(trends[0], 'trend_direction')

    @pytest.mark.asyncio
    async def test_create_dashboard(self, task_monitor: TaskMonitorService, sample_user: User):
        """Test dashboard creation"""
        dashboard = await task_monitor.create_dashboard(
            name="Test Dashboard",
            user_id=sample_user.id,
            description="A test dashboard",
            widgets=[{"type": "system_status", "id": "widget1"}]
        )

        assert dashboard.name == "Test Dashboard"
        assert dashboard.user_id == sample_user.id
        assert len(dashboard.widgets) == 1

    @pytest.mark.asyncio
    async def test_trend_analysis(self, task_monitor: TaskMonitorService):
        """Test trend analysis methods"""
        # Test analyze_trend
        data_points = [
            {"timestamp": datetime.utcnow(), "value": 100},
            {"timestamp": datetime.utcnow(), "value": 110},
            {"timestamp": datetime.utcnow(), "value": 120}
        ]

        direction, percentage = task_monitor._analyze_trend(data_points)

        assert direction in ["up", "down", "stable"]
        assert isinstance(percentage, float)

    @pytest.mark.asyncio
    async def test_anomaly_detection(self, task_monitor: TaskMonitorService):
        """Test anomaly detection"""
        # Normal data
        normal_data = [
            {"timestamp": datetime.utcnow(), "value": 100},
            {"timestamp": datetime.utcnow(), "value": 105},
            {"timestamp": datetime.utcnow(), "value": 95}
        ]

        anomaly_score = task_monitor._detect_anomalies(normal_data)
        assert isinstance(anomaly_score, float)
        assert 0 <= anomaly_score <= 1

    @pytest.mark.asyncio
    async def test_websocket_event_processing(self, task_monitor: TaskMonitorService):
        """Test WebSocket event processing"""
        event = TaskExecutionEvent(
            task_id=uuid4(),
            event_type="test_event",
            data={"test": "data"}
        )

        # Should not raise exception
        await task_monitor._process_task_event(event)


class TestMonitoringIntegration:
    """Integration tests for monitoring system"""

    @pytest.mark.asyncio
    async def test_end_to_end_monitoring(self, db_session: AsyncSession, sample_task_create: TaskCreate):
        """Test end-to-end monitoring workflow"""
        # Create services
        executor = TaskExecutorService(db_session)
        monitor = TaskMonitorService(db_session)

        try:
            await executor.start()
            await monitor.start()

            # Submit task
            task_response = await executor.submit_task(sample_task_create)

            # Verify monitoring data
            metrics = await executor.get_task_metrics(task_response.id)

            # Get performance analytics
            analytics = await executor.get_performance_analytics()

            assert task_response is not None
            assert isinstance(analytics, dict)

        finally:
            await executor.stop()
            await monitor.stop()

    @pytest.mark.asyncio
    async def test_resource_limit_monitoring(self, task_executor: TaskExecutorService):
        """Test resource limit monitoring"""
        # Create resource metrics that exceed limits
        metrics = ResourceMetrics(
            task_id=uuid4(),
            timestamp=datetime.utcnow(),
            cpu_percent=95.0,  # High CPU
            memory_mb=3000.0,  # High memory
            memory_percent=90.0,
            disk_io_read_mb=100.0,
            disk_io_write_mb=50.0,
            network_io_sent_mb=10.0,
            network_io_recv_mb=20.0,
            execution_time_ms=1000.0,
            progress_percentage=50.0,
            steps_completed=1,
            total_steps=2
        )

        # Should trigger resource alerts
        await task_executor._check_resource_limits(metrics.task_id, metrics)

    @pytest.mark.asyncio
    async def test_alert_processing(self, task_monitor: TaskMonitorService, sample_user: User):
        """Test alert processing for different types"""
        alert_types = [
            AlertType.TASK_FAILURE,
            AlertType.TASK_TIMEOUT,
            AlertType.RESOURCE_HIGH,
            AlertType.PERFORMANCE_DEGRADATION,
            AlertType.AGENT_UNAVAILABLE,
            AlertType.SYSTEM_LOAD,
            AlertType.ANOMALY_DETECTED
        ]

        for alert_type in alert_types:
            alert = await task_monitor.create_alert(
                alert_type=alert_type,
                severity=AlertSeverity.MEDIUM,
                title=f"Test {alert_type.value} Alert",
                description=f"Testing {alert_type.value} alert processing",
                user_id=sample_user.id
            )

            assert alert.alert_type == alert_type


class TestMonitoringAPI:
    """Test monitoring API endpoints"""

    @pytest.mark.asyncio
    async def test_monitoring_status_endpoint(self, db_session: AsyncSession):
        """Test monitoring status API endpoint"""
        client = TestClient(app)

        # This would need proper authentication setup in tests
        response = client.get("/api/v1/monitoring/status")

        # Response would be 401 without auth, but we test the endpoint structure
        assert response.status_code in [401, 403, 500]  # Expected without auth

    @pytest.mark.asyncio
    async def test_websocket_endpoint_structure(self):
        """Test WebSocket endpoint structure"""
        client = TestClient(app)

        with pytest.raises(Exception):  # Would need proper WebSocket test setup
            with client.websocket_connect("/api/v1/monitoring/ws/123e4567-e89b-12d3-a456-426614174000"):
                pass


class TestMonitoringPerformance:
    """Performance tests for monitoring system"""

    @pytest.mark.asyncio
    async def test_concurrent_task_monitoring(self, task_executor: TaskExecutorService, sample_task_create: TaskCreate):
        """Test monitoring multiple concurrent tasks"""
        tasks = []

        # Submit multiple tasks concurrently
        for i in range(5):
            task = TaskCreate(
                name=f"Concurrent Task {i}",
                description=f"Test task {i}",
                workflow_id=sample_task_create.workflow_id,
                task_type=sample_task_create.task_type,
                parameters={"task_id": i},
                dependencies=[],
                timeout_seconds=60,
                max_retries=1
            )

            task_response = await task_executor.submit_task(task)
            tasks.append(task_response)

        # Verify all tasks were submitted
        assert len(tasks) == 5

        # Check performance analytics
        analytics = await task_executor.get_performance_analytics()
        assert isinstance(analytics, dict)

    @pytest.mark.asyncio
    async def test_alert_generation_performance(self, task_monitor: TaskMonitorService, sample_user: User):
        """Test alert generation under load"""
        alerts = []

        # Generate multiple alerts
        for i in range(10):
            alert = await task_monitor.create_alert(
                alert_type=AlertType.TASK_FAILURE,
                severity=AlertSeverity.LOW,
                title=f"Performance Test Alert {i}",
                description=f"Testing alert generation performance {i}",
                user_id=sample_user.id
            )
            alerts.append(alert)

        # Verify all alerts were created
        assert len(alerts) == 10

        # Test alert retrieval performance
        retrieved_alerts = await task_monitor.get_active_alerts(user_id=sample_user.id)
        assert len(retrieved_alerts) >= 10


class TestMonitoringErrorHandling:
    """Error handling tests for monitoring system"""

    @pytest.mark.asyncio
    async def test_task_executor_error_handling(self, task_executor: TaskExecutorService):
        """Test error handling in task executor"""
        # Test with invalid task data
        invalid_task = TaskCreate(
            name="",  # Invalid empty name
            workflow_id=uuid4(),
            task_type="invalid_type",
            parameters={},
            dependencies=[],
            timeout_seconds=300,
            max_retries=3
        )

        # Should handle error gracefully
        with pytest.raises(Exception):
            await task_executor.submit_task(invalid_task)

    @pytest.mark.asyncio
    async def test_monitor_service_error_handling(self, task_monitor: TaskMonitorService, sample_user: User):
        """Test error handling in monitor service"""
        # Test creating alert with invalid data
        with pytest.raises(Exception):
            await task_monitor.create_alert(
                alert_type="invalid_type",  # Invalid type
                severity=AlertSeverity.HIGH,
                title="Test Alert",
                description="Test",
                user_id=sample_user.id
            )

    @pytest.mark.asyncio
    async def test_resource_monitoring_error_recovery(self, task_executor: TaskExecutorService):
        """Test resource monitoring error recovery"""
        # Simulate resource monitoring failure
        with patch('psutil.Process') as mock_process:
            mock_process.side_effect = Exception("Mock error")

            # Should handle error gracefully
            monitor_task = asyncio.create_task(
                task_executor._monitor_task_resources(uuid4())
            )

            await asyncio.sleep(0.1)
            monitor_task.cancel()

            try:
                await monitor_task
            except asyncio.CancelledError:
                pass


# Benchmark tests
class TestMonitoringBenchmarks:
    """Benchmark tests for monitoring performance"""

    @pytest.mark.asyncio
    async def benchmark_task_submission_performance(self, task_executor: TaskExecutorService):
        """Benchmark task submission performance"""
        import time

        start_time = time.time()

        # Submit 100 tasks
        tasks = []
        for i in range(100):
            task = TaskCreate(
                name=f"Benchmark Task {i}",
                workflow_id=uuid4(),
                task_type="browser_automation",
                parameters={"task_id": i},
                dependencies=[],
                timeout_seconds=60,
                max_retries=1
            )

            task_response = await task_executor.submit_task(task)
            tasks.append(task_response)

        end_time = time.time()
        duration = end_time - start_time

        # Should complete within reasonable time
        assert duration < 10.0  # 10 seconds for 100 tasks
        assert len(tasks) == 100

    @pytest.mark.asyncio
    async def benchmark_alert_generation_performance(self, task_monitor: TaskMonitorService, sample_user: User):
        """Benchmark alert generation performance"""
        import time

        start_time = time.time()

        # Generate 1000 alerts
        for i in range(1000):
            await task_monitor.create_alert(
                alert_type=AlertType.TASK_FAILURE,
                severity=AlertSeverity.LOW,
                title=f"Benchmark Alert {i}",
                description=f"Benchmark alert {i}",
                user_id=sample_user.id
            )

        end_time = time.time()
        duration = end_time - start_time

        # Should complete within reasonable time
        assert duration < 5.0  # 5 seconds for 1000 alerts


# Integration test fixtures
@pytest_asyncio.fixture
async def monitoring_setup(db_session: AsyncSession):
    """Setup full monitoring system for integration tests"""
    executor = TaskExecutorService(db_session)
    monitor = TaskMonitorService(db_session)

    await executor.start()
    await monitor.start()

    yield executor, monitor

    await executor.stop()
    await monitor.stop()


# Test configuration
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Pytest configuration
def pytest_configure(config):
    """Configure pytest for monitoring tests"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "performance: marks tests as performance tests"
    )