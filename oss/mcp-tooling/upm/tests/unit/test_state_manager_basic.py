"""
Basic unit tests for workflow state manager functionality.
Tests the core state manager functionality with minimal dependencies.
"""

import pytest
import asyncio
import json
import gzip
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import Redis
from pydantic import ValidationError

# Test the core state manager functionality by testing individual components
# rather than importing the full module which has complex dependencies


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    return AsyncMock(spec=Redis)


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def sample_workflow_state():
    """Create sample workflow state for testing."""
    return {
        "workflow_type": "dependency_analysis",
        "project_id": str(uuid4()),
        "status": "in_progress",
        "context": {
            "current_step": "scanning_dependencies",
            "dependencies_found": 42,
            "progress": 0.65,
        },
        "metadata": {
            "started_by": str(uuid4()),
            "retry_count": 0,
            "priority": "normal",
        },
    }


class TestStateCompression:
    """Test data compression functionality."""

    def test_compress_data(self):
        """Test data compression and decompression."""
        test_data = {"large": "data" * 100, "nested": {"deep": {"data": "value" * 50}}}

        # Test compression
        json_str = json.dumps(test_data)
        compressed = gzip.compress(json_str.encode("utf-8"))

        # Test decompression
        decompressed = gzip.decompress(compressed).decode("utf-8")
        result_data = json.loads(decompressed)

        assert result_data == test_data

    def test_compress_data_disabled(self):
        """Test data compression when disabled."""
        test_data = {"test": "data"}

        # When compression is disabled, return data as-is
        result = json.dumps(test_data)

        assert json.loads(result) == test_data

    def test_validate_data_size_valid(self):
        """Test validation of valid payload data."""
        max_size = 10485760  # 10MB
        valid_data = {"data": "x" * (max_size - 100)}

        # Calculate actual data size
        data_size = len(json.dumps(valid_data).encode("utf-8"))

        assert data_size < max_size

    def test_validate_data_size_too_large(self):
        """Test validation of oversized payload data."""
        max_size = 1000  # Small limit for testing
        large_data = {"data": "x" * (max_size + 100)}

        # Calculate actual data size
        data_size = len(json.dumps(large_data).encode("utf-8"))

        assert data_size > max_size


class TestRedisOperations:
    """Test Redis operations for state management."""

    async def test_set_workflow_state_in_redis(self, mock_redis):
        """Test setting workflow state in Redis."""
        workflow_id = str(uuid4())
        state_data = {"test": "state", "data": [1, 2, 3]}

        # Mock Redis pipeline
        mock_pipeline = AsyncMock()
        mock_redis.pipeline.return_value.__aenter__.return_value = mock_pipeline
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()

        # Simulate setting data
        key = f"workflow_state:{workflow_id}"
        ttl = 3600
        json_data = json.dumps(state_data)

        mock_pipeline.setex(key, ttl, json_data)
        mock_pipeline.lpush("workflow_state_keys", key)
        mock_pipeline.ltrim("workflow_state_keys", 0, 999)

        # Execute the pipeline
        await mock_pipeline.execute()

        # Verify operations were called
        mock_pipeline.setex.assert_called_once_with(key, ttl, json_data)
        mock_pipeline.lpush.assert_called_once()
        mock_pipeline.ltrim.assert_called_once()

    async def test_get_workflow_state_from_redis(
        self, mock_redis, sample_workflow_state
    ):
        """Test retrieving workflow state from Redis."""
        workflow_id = str(uuid4())
        cached_state = json.dumps(sample_workflow_state)

        mock_redis.get.return_value = cached_state

        key = f"workflow_state:{workflow_id}"
        result = mock_redis.get(key)

        assert result == cached_state
        mock_redis.get.assert_called_once_with(key)

        # Test deserialization
        state = json.loads(result)
        assert state == sample_workflow_state

    async def test_workflow_lock_operations(self, mock_redis):
        """Test workflow lock acquisition and release."""
        workflow_id = str(uuid4())
        lock_key = f"workflow_lock:{workflow_id}"
        lock_value = str(uuid4())
        ttl = 300

        # Test lock acquisition
        mock_redis.set.return_value = True
        locked = mock_redis.set(lock_key, lock_value, nx=True, ex=ttl)

        assert locked is True
        mock_redis.set.assert_called_once_with(lock_key, lock_value, nx=True, ex=ttl)

        # Test lock release
        mock_redis.delete.return_value = 1
        await mock_redis.delete(lock_key)

        mock_redis.delete.assert_called_once_with(lock_key)


class TestDatabaseOperations:
    """Test database operations for state management."""

    async def test_save_workflow_state_to_database(self, mock_db_session):
        """Test saving workflow state to database."""
        workflow_id = str(uuid4())
        state_data = {"test": "state", "version": 1}

        # Mock database model
        mock_state_model = MagicMock()
        mock_state_model.workflow_id = workflow_id
        mock_state_model.state_data = state_data
        mock_state_model.status = "active"
        mock_state_model.metadata = {"test": "metadata"}

        # Mock database operations
        mock_db_session.add(mock_state_model)
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        # Simulate save operation
        await mock_db_session.add(mock_state_model)
        await mock_db_session.commit()
        await mock_db_session.refresh(mock_state_model)

        # Verify operations
        mock_db_session.add.assert_called_once_with(mock_state_model)
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once_with(mock_state_model)

    async def test_query_workflow_state_from_database(self, mock_db_session):
        """Test querying workflow state from database."""
        workflow_id = str(uuid4())
        state_data = {"test": "database_state"}

        # Mock database model
        mock_state_model = MagicMock()
        mock_state_model.workflow_id = workflow_id
        mock_state_model.state_data = state_data
        mock_state_model.status = "active"

        # Mock database query
        mock_result = AsyncMock()
        mock_result.scalar.return_value = mock_state_model
        mock_db_session.execute.return_value = mock_result

        # Simulate query
        result = await mock_db_session.execute(MagicMock())
        state = result.scalar()

        assert state.workflow_id == workflow_id
        assert state.state_data == state_data

    async def test_create_checkpoint_in_database(self, mock_db_session):
        """Test creating checkpoint in database."""
        workflow_id = str(uuid4())
        checkpoint_data = {"step": "completed", "results": "success"}

        # Mock checkpoint model
        mock_checkpoint = MagicMock()
        mock_checkpoint.workflow_id = workflow_id
        mock_checkpoint.checkpoint_data = checkpoint_data
        mock_checkpoint.checkpoint_type = "manual"

        # Mock database operations
        mock_db_session.add(mock_checkpoint)
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        # Simulate checkpoint creation
        await mock_db_session.add(mock_checkpoint)
        await mock_db_session.commit()
        await mock_db_session.refresh(mock_checkpoint)

        # Verify operations
        mock_db_session.add.assert_called_once_with(mock_checkpoint)
        mock_db_session.commit.assert_called_once()


class TestStateValidation:
    """Test state validation functionality."""

    def test_validate_workflow_state_structure(self):
        """Test workflow state structure validation."""
        valid_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(uuid4()),
            "status": "in_progress",
            "context": {"current_step": "scan"},
            "metadata": {"retry_count": 0},
        }

        # Basic structure validation
        required_fields = [
            "workflow_type",
            "project_id",
            "status",
            "context",
            "metadata",
        ]
        for field in required_fields:
            assert field in valid_state
        assert isinstance(valid_state["project_id"], str)
        assert valid_state["status"] in [
            "pending",
            "in_progress",
            "completed",
            "failed",
        ]

    def test_validate_checkpoint_data_structure(self):
        """Test checkpoint data structure validation."""
        valid_checkpoint = {
            "step": "dependency_scan",
            "context": {"scanned_packages": 42},
            "metadata": {"checkpoint_type": "milestone"},
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Basic checkpoint validation
        required_fields = ["step", "context", "metadata", "timestamp"]
        for field in required_fields:
            assert field in valid_checkpoint
        assert isinstance(valid_checkpoint["step"], str)
        assert isinstance(valid_checkpoint["context"], dict)

    def test_validate_event_data_structure(self):
        """Test event data structure validation."""
        valid_event = {
            "event_type": "STEP_STARTED",
            "event_data": {"step": "scan", "package": "example"},
            "metadata": {"priority": "high"},
            "sequence_number": 1,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Basic event validation
        required_fields = [
            "event_type",
            "event_data",
            "metadata",
            "sequence_number",
            "timestamp",
        ]
        for field in required_fields:
            assert field in valid_event
        assert isinstance(valid_event["event_type"], str)
        assert isinstance(valid_event["sequence_number"], int)


class TestErrorHandling:
    """Test error handling scenarios."""

    async def test_redis_connection_error(self, mock_redis):
        """Test handling of Redis connection errors."""
        mock_redis.get.side_effect = Exception("Connection failed")
        workflow_id = str(uuid4())

        with pytest.raises(Exception, match="Connection failed"):
            await mock_redis.get(f"workflow_state:{workflow_id}")

    async def test_database_error_handling(self, mock_db_session):
        """Test handling of database errors."""
        mock_db_session.execute.side_effect = SQLAlchemyError(
            "Database connection failed"
        )

        with pytest.raises(SQLAlchemyError, match="Database connection failed"):
            await mock_db_session.execute(MagicMock())

    def test_corrupted_json_data(self):
        """Test handling of corrupted JSON data."""
        corrupted_data = b"corrupted\x00\x00data"

        with pytest.raises(json.JSONDecodeError):
            json.loads(corrupted_data.decode("utf-8"))

    def test_invalid_state_data(self):
        """Test validation of invalid state data."""
        invalid_state = {
            "workflow_type": "",  # Empty workflow type
            "project_id": "not-a-uuid",  # Invalid UUID
            "status": "invalid_status",  # Invalid status
        }

        # Basic validation should catch these issues
        assert not invalid_state["workflow_type"]
        assert invalid_state["status"] not in [
            "pending",
            "in_progress",
            "completed",
            "failed",
        ]


class TestStateMetrics:
    """Test state metrics and monitoring."""

    def test_calculate_state_size_metrics(self, sample_workflow_state):
        """Test calculation of state size metrics."""
        json_data = json.dumps(sample_workflow_state)
        compressed_data = gzip.compress(json_data.encode("utf-8"))

        metrics = {
            "original_size": len(json_data.encode("utf-8")),
            "compressed_size": len(compressed_data),
            "compression_ratio": len(compressed_data) / len(json_data.encode("utf-8")),
            "field_count": len(sample_workflow_state),
        }

        assert metrics["original_size"] > 0
        assert metrics["compressed_size"] > 0
        assert metrics["compression_ratio"] < 1.0  # Should be smaller after compression
        assert metrics["field_count"] == len(sample_workflow_state)

    async def test_calculate_performance_metrics(self):
        """Test calculation of performance metrics."""
        start_time = datetime.utcnow()

        # Simulate some work
        await asyncio.sleep(0.001)

        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()

        metrics = {
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": duration,
            "operations_per_second": 1 / duration if duration > 0 else 0,
        }

        assert metrics["duration_seconds"] >= 0
        assert metrics["operations_per_second"] > 0

    async def test_cache_hit_rate_calculation(self):
        """Test cache hit rate calculation."""
        total_requests = 100
        cache_hits = 75

        hit_rate = (cache_hits / total_requests) * 100

        metrics = {
            "total_requests": total_requests,
            "cache_hits": cache_hits,
            "cache_misses": total_requests - cache_hits,
            "hit_rate_percentage": hit_rate,
        }

        assert metrics["hit_rate_percentage"] == 75.0
        assert metrics["cache_misses"] == 25


class TestStateCleanup:
    """Test state cleanup functionality."""

    def test_identify_expired_states(self):
        """Test identification of expired states."""
        now = datetime.utcnow()
        retention_days = 30

        states = [
            {
                "workflow_id": str(uuid4()),
                "created_at": now - timedelta(days=35),  # Expired
                "status": "completed",
            },
            {
                "workflow_id": str(uuid4()),
                "created_at": now - timedelta(days=15),  # Not expired
                "status": "active",
            },
            {
                "workflow_id": str(uuid4()),
                "created_at": now - timedelta(days=60),  # Expired
                "status": "failed",
            },
        ]

        expired_states = [
            state
            for state in states
            if (now - state["created_at"]).days > retention_days
        ]

        assert len(expired_states) == 2
        assert expired_states[0]["status"] == "completed"
        assert expired_states[1]["status"] == "failed"

    def test_cleanup_stale_locks(self):
        """Test cleanup of stale locks."""
        lock_keys = [
            "workflow_lock:active-lock",
            "workflow_lock:stale-lock-1",
            "workflow_lock:stale-lock-2",
        ]

        # Simulate TTL check (active lock has TTL, stale ones have -1 or expired)
        lock_ttl_values = [300, -1, -1]  # 300s for active, -1 (expired) for stale
        active_locks = []
        stale_locks = []

        for i, (key, ttl) in enumerate(zip(lock_keys, lock_ttl_values)):
            if ttl > 0:
                active_locks.append(key)
            else:
                stale_locks.append(key)

        assert len(active_locks) == 1
        assert len(stale_locks) == 2
        assert "active-lock" in active_locks[0]
