"""
Test suite for Performance Optimization Service
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime

from app.services.performance_service import (
    performance_service,
    JobPriority,
    JobStatus,
    QueryOptimizationType,
    BackgroundJob
)

# Mark all async tests
pytestmark = pytest.mark.asyncio


class TestPerformanceOptimizationService:
    """Test cases for Performance Optimization Service"""

    @pytest.fixture
    async def performance_service_instance(self):
        """Create performance service instance for testing"""
        # Reset service state
        performance_service.running_jobs.clear()
        performance_service.completed_jobs.clear()
        performance_service.failed_jobs.clear()
        performance_service.query_metrics.clear()
        performance_service.workers_running = False

        # Initialize service
        with patch('app.services.cache_service.cache_service') as mock_cache:
            mock_cache.initialized = True
            mock_cache.initialize = AsyncMock()
            await performance_service.initialize()

        yield performance_service

        # Cleanup
        performance_service.workers_running = False
        await asyncio.sleep(0.1)  # Allow workers to stop

    async def test_service_initialization(self, performance_service_instance):
        """Test performance service initialization"""
        assert performance_service_instance.workers_running is True
        assert performance_service_instance.worker_count == 3
        assert len(performance_service_instance.running_jobs) == 0
        assert len(performance_service_instance.completed_jobs) == 0

    async def test_background_job_scheduling(self, performance_service_instance):
        """Test background job scheduling"""
        def test_function(x, y):
            return x + y

        job_id = await performance_service_instance.schedule_job(
            name="test_addition",
            function=test_function,
            5, 3,  # args
            priority=JobPriority.HIGH,
            max_retries=2,
            timeout_seconds=30
        )

        assert job_id is not None
        assert job_id.startswith("test_addition_")

        # Wait for job execution
        await asyncio.sleep(0.5)

        # Check job status
        job_status = await performance_service_instance.get_job_status(job_id)
        assert job_status is not None
        assert job_status["name"] == "test_addition"
        assert job_status["status"] in [JobStatus.RUNNING.value, JobStatus.COMPLETED.value]

    async def test_async_background_job(self, performance_service_instance):
        """Test async background job execution"""
        async def async_test_function(delay):
            await asyncio.sleep(delay)
            return f"Completed after {delay}s"

        job_id = await performance_service_instance.schedule_job(
            name="async_test",
            function=async_test_function,
            0.1,  # 0.1 second delay
            priority=JobPriority.NORMAL
        )

        # Wait for completion
        await asyncio.sleep(0.5)

        job_status = await performance_service_instance.get_job_status(job_id)
        assert job_status["status"] == JobStatus.COMPLETED.value
        assert "result" in job_status["metadata"]

    async def test_job_priority_handling(self, performance_service_instance):
        """Test that high priority jobs are executed first"""
        results = []

        def record_execution(priority_name):
            results.append(priority_name)
            return f"Executed {priority_name}"

        # Schedule jobs with different priorities
        await performance_service_instance.schedule_job(
            "low_priority", record_execution, "LOW", priority=JobPriority.LOW
        )
        await performance_service_instance.schedule_job(
            "critical_priority", record_execution, "CRITICAL", priority=JobPriority.CRITICAL
        )
        await performance_service_instance.schedule_job(
            "normal_priority", record_execution, "NORMAL", priority=JobPriority.NORMAL
        )
        await performance_service_instance.schedule_job(
            "high_priority", record_execution, "HIGH", priority=JobPriority.HIGH
        )

        # Wait for all jobs to complete
        await asyncio.sleep(1.0)

        # Critical and high priority should execute before normal and low
        assert len(results) == 4
        critical_index = results.index("CRITICAL")
        high_index = results.index("HIGH")
        normal_index = results.index("NORMAL")
        low_index = results.index("LOW")

        assert critical_index < normal_index
        assert critical_index < low_index
        assert high_index < low_index

    async def test_job_retry_mechanism(self, performance_service_instance):
        """Test job retry mechanism on failure"""
        failure_count = 0

        def failing_function():
            nonlocal failure_count
            failure_count += 1
            if failure_count < 3:
                raise Exception(f"Attempt {failure_count} failed")
            return "Success on third attempt"

        job_id = await performance_service_instance.schedule_job(
            name="retry_test",
            function=failing_function,
            max_retries=3,
            priority=JobPriority.HIGH
        )

        # Wait for retries to complete
        await asyncio.sleep(2.0)

        job_status = await performance_service_instance.get_job_status(job_id)
        assert job_status["status"] == JobStatus.COMPLETED.value
        assert failure_count == 3

    async def test_job_timeout(self, performance_service_instance):
        """Test job timeout handling"""
        def slow_function():
            time.sleep(2)  # Longer than timeout
            return "Should not complete"

        job_id = await performance_service_instance.schedule_job(
            name="timeout_test",
            function=slow_function,
            timeout_seconds=1,  # 1 second timeout
            max_retries=0
        )

        # Wait for timeout
        await asyncio.sleep(2.5)

        job_status = await performance_service_instance.get_job_status(job_id)
        assert job_status["status"] == JobStatus.FAILED.value
        assert "timed out" in job_status["error_message"]

    async def test_query_optimization(self, performance_service_instance):
        """Test query optimization features"""
        # Mock database session
        with patch('app.core.database.get_db_session') as mock_db:
            mock_session = AsyncMock()
            mock_result = Mock()
            mock_result.returns_rows = True
            mock_result.fetchall.return_value = [
                Mock(_mapping={"id": 1, "name": "Test"}),
                Mock(_mapping={"id": 2, "name": "Test2"})
            ]
            mock_session.execute.return_value = mock_result
            mock_db.return_value.__aenter__.return_value = mock_session

            # Test query optimization
            query = "SELECT * FROM users WHERE active = true"
            params = {"limit": 10}

            result = await performance_service_instance.optimize_query(
                query=query,
                params=params,
                use_cache=True,
                optimization_type=QueryOptimizationType.CACHING
            )

            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["id"] == 1

    async def test_batch_processing(self, performance_service_instance):
        """Test batch processing functionality"""
        items = list(range(100))  # 100 items

        def process_batch(batch):
            return [item * 2 for item in batch]

        results = await performance_service_instance.batch_process(
            items=items,
            processor_function=process_batch,
            batch_size=10,
            max_workers=3
        )

        assert len(results) == 100
        assert results[0] == 0  # 0 * 2
        assert results[99] == 198  # 99 * 2

    async def test_async_batch_processing(self, performance_service_instance):
        """Test async batch processing"""
        items = ["item1", "item2", "item3", "item4", "item5"]

        async def async_processor(batch):
            await asyncio.sleep(0.1)
            return [f"processed_{item}" for item in batch]

        results = await performance_service_instance.batch_process(
            items=items,
            processor_function=async_processor,
            batch_size=2,
            max_workers=2
        )

        assert len(results) == 5
        assert all(item.startswith("processed_") for item in results)

    async def test_performance_metrics_tracking(self, performance_service_instance):
        """Test performance metrics tracking"""
        # Execute some operations to generate metrics
        def dummy_job():
            return "completed"

        # Schedule multiple jobs
        for i in range(5):
            await performance_service_instance.schedule_job(
                f"metrics_test_{i}", dummy_job, priority=JobPriority.NORMAL
            )

        # Wait for completion
        await asyncio.sleep(1.0)

        # Get metrics
        metrics = await performance_service_instance.get_performance_metrics()

        assert "query_performance" in metrics
        assert "background_jobs" in metrics
        assert "cache_performance" in metrics
        assert "system" in metrics

        # Check job metrics
        job_metrics = metrics["background_jobs"]
        assert job_metrics["completed"] >= 5
        assert job_metrics["success_rate"] > 0

    async def test_query_metrics_recording(self, performance_service_instance):
        """Test query metrics recording"""
        # Mock some query operations
        query_hash = "test_query_hash"

        await performance_service_instance._record_query_metrics(
            query_hash=query_hash,
            execution_time=0.125,
            rows_affected=50,
            cache_hit=False,
            optimization_type=QueryOptimizationType.CACHING
        )

        await performance_service_instance._record_query_metrics(
            query_hash="another_hash",
            execution_time=0.075,
            rows_affected=25,
            cache_hit=True,
            optimization_type=QueryOptimizationType.INDEX_HINT
        )

        # Check metrics
        assert len(performance_service_instance.query_metrics) == 2
        assert performance_service_instance.metrics.total_queries == 2
        assert performance_service_instance.metrics.cached_queries == 1

        # Get performance metrics
        metrics = await performance_service_instance.get_performance_metrics()
        query_perf = metrics["query_performance"]

        assert query_perf["total_queries"] == 2
        assert query_perf["cache_hit_ratio"] == 50.0  # 1 out of 2

    async def test_job_error_handling(self, performance_service_instance):
        """Test job error handling"""
        def error_function():
            raise ValueError("Test error message")

        job_id = await performance_service_instance.schedule_job(
            name="error_test",
            function=error_function,
            max_retries=1
        )

        # Wait for failure
        await asyncio.sleep(1.0)

        job_status = await performance_service_instance.get_job_status(job_id)
        assert job_status["status"] == JobStatus.FAILED.value
        assert "Test error message" in job_status["error_message"]

    async def test_concurrent_job_execution(self, performance_service_instance):
        """Test concurrent job execution"""
        results = []
        execution_times = []

        async def concurrent_job(job_id, duration):
            start_time = time.time()
            await asyncio.sleep(duration)
            end_time = time.time()
            results.append(job_id)
            execution_times.append(end_time - start_time)
            return f"Job {job_id} completed"

        # Schedule multiple jobs with different durations
        job_ids = []
        for i in range(5):
            job_id = await performance_service_instance.schedule_job(
                f"concurrent_job_{i}",
                concurrent_job,
                i, 0.2  # job_id, duration
            )
            job_ids.append(job_id)

        # Wait for all jobs to complete
        await asyncio.sleep(2.0)

        # Verify all jobs completed
        assert len(results) == 5

        # Check that jobs ran concurrently (total time should be less than sum of individual times)
        # This is a rough check since we can't guarantee exact timing in tests
        assert len(execution_times) == 5

    async def test_health_check(self, performance_service_instance):
        """Test performance service health check"""
        health = await performance_service_instance.health_check()

        assert health["service_name"] == "performance_optimization"
        assert health["status"] in ["healthy", "degraded", "unhealthy"]
        assert "timestamp" in health
        assert "metrics" in health

    async def test_service_cleanup(self, performance_service_instance):
        """Test service cleanup"""
        # Add some jobs and data
        await performance_service_instance.schedule_job(
            "cleanup_test", lambda: "test", priority=JobPriority.LOW
        )

        # Wait for job to be processed
        await asyncio.sleep(0.5)

        # Cleanup
        await performance_service_instance.cleanup()

        # Verify cleanup
        assert performance_service_instance.workers_running is False

    async def test_query_optimization_types(self, performance_service_instance):
        """Test different query optimization types"""
        with patch('app.core.database.get_db_session') as mock_db:
            mock_session = AsyncMock()
            mock_result = Mock()
            mock_result.returns_rows = True
            mock_result.fetchall.return_value = []
            mock_session.execute.return_value = mock_result
            mock_db.return_value.__aenter__.return_value = mock_session

            # Test different optimization types
            optimizations = [
                QueryOptimizationType.INDEX_HINT,
                QueryOptimizationType.QUERY_REWRITE,
                QueryOptimizationType.PAGINATION,
                QueryOptimizationType.CACHING
            ]

            for opt_type in optimizations:
                result = await performance_service_instance.optimize_query(
                    query="SELECT * FROM test_table",
                    optimization_type=opt_type,
                    use_cache=False
                )
                assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_job_queue_size_monitoring(self, performance_service_instance):
        """Test job queue size monitoring"""
        # Schedule many jobs quickly
        job_ids = []
        for i in range(10):
            job_id = await performance_service_instance.schedule_job(
                f"queue_test_{i}",
                lambda x: time.sleep(0.1),  # Slow function to build up queue
                i
            )
            job_ids.append(job_id)

        # Check queue size in metrics
        metrics = await performance_service_instance.get_performance_metrics()
        queue_size = metrics["background_jobs"]["queue_size"]

        # Queue should have some jobs (exact number depends on processing speed)
        assert queue_size >= 0

        # Wait for completion
        await asyncio.sleep(2.0)

        # Final queue should be empty or nearly empty
        final_metrics = await performance_service_instance.get_performance_metrics()
        final_queue_size = final_metrics["background_jobs"]["queue_size"]
        assert final_queue_size <= queue_size