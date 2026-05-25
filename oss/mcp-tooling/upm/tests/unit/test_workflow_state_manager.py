"""
Unit tests for workflow state management functionality.
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import Redis
from pydantic import ValidationError

from src.udp.workflows.state_manager import (
    WorkflowStateManager,
    StateStorageError,
    StateLockError,
    StateRecoveryError,
)
from src.udp.core.models.workflow_state import (
    WorkflowStateModel,
    WorkflowCheckpointModel,
    WorkflowEventModel,
    WorkflowLockModel,
    WorkflowStateStatus,
    StateStorageBackend,
    CompressionAlgorithm,
)
from src.udp.core.models.workflow import (
    WorkflowExecution,
    WorkflowType,
    WorkflowStatus,
)
from src.udp.core.config import Settings


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    return AsyncMock(spec=Redis)


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_settings():
    """Mock application settings."""
    return Settings(
        REDIS_URL="redis://localhost:6379",
        REDIS_WORKFLOW_STATE_TTL=3600,
        REDIS_WORKFLOW_LOCK_TTL=300,
        WORKFLOW_STATE_COMRESSION_ENABLED=True,
        WORKFLOW_STATE_MAX_PAYLOAD_SIZE=10485760,
        WORKFLOW_STATE_RETENTION_DAYS=90,
        WORKFLOW_CHECKPOINT_RETENTION_DAYS=30,
    )


@pytest.fixture
def state_manager(mock_redis, mock_db_session, mock_settings):
    """Create WorkflowStateManager instance with mocked dependencies."""
    with (
        patch(
            "src.udp.workflows.state_manager.get_redis_session", return_value=mock_redis
        ),
        patch(
            "src.udp.workflows.state_manager.get_async_session",
            return_value=mock_db_session,
        ),
    ):
        return WorkflowStateManager(settings=mock_settings)


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


@pytest.fixture
def sample_workflow_execution():
    """Create sample workflow execution."""
    return WorkflowExecution(
        workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
        project_id=str(uuid4()),
        triggered_by=uuid4(),
        configuration={"scan_depth": "full"},
    )


class TestWorkflowStateManager:
    """Test suite for WorkflowStateManager."""

    async def test_init_default_settings(self, mock_redis, mock_db_session):
        """Test initialization with default settings."""
        with (
            patch(
                "src.udp.workflows.state_manager.get_redis_session",
                return_value=mock_redis,
            ),
            patch(
                "src.udp.workflows.state_manager.get_async_session",
                return_value=mock_db_session,
            ),
        ):
            manager = WorkflowStateManager()

            assert manager.redis is mock_redis
            assert manager.settings is not None
            assert manager.settings.REDIS_WORKFLOW_STATE_TTL == 3600
            assert manager.lock_timeout == 300
            assert manager.compression_enabled is True

    async def test_init_custom_settings(
        self, mock_redis, mock_db_session, mock_settings
    ):
        """Test initialization with custom settings."""
        mock_settings.REDIS_WORKFLOW_STATE_TTL = 7200
        mock_settings.WORKFLOW_STATE_COMRESSION_ENABLED = False

        with (
            patch(
                "src.udp.workflows.state_manager.get_redis_session",
                return_value=mock_redis,
            ),
            patch(
                "src.udp.workflows.state_manager.get_async_session",
                return_value=mock_db_session,
            ),
        ):
            manager = WorkflowStateManager(settings=mock_settings)

            assert manager.redis is mock_redis
            assert manager.settings.REDIS_WORKFLOW_STATE_TTL == 7200
            assert manager.compression_enabled is False

    async def test_save_workflow_state_success(
        self, state_manager, mock_db_session, mock_redis, sample_workflow_state
    ):
        """Test successful workflow state saving."""
        workflow_id = str(uuid4())

        # Mock Redis operations
        mock_redis.pipeline.return_value.__aenter__.return_value = AsyncMock()
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()
        mock_redis.setex.return_value = True
        mock_redis.lpush.return_value = 1
        mock_redis.ltrim.return_value = True

        # Mock database operations
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        # Mock database query result
        mock_result = AsyncMock()
        mock_result.scalar.return_value = None
        mock_db_session.execute.return_value = mock_result

        state = await state_manager.save_workflow_state(
            workflow_id=workflow_id,
            state=sample_workflow_state,
            metadata={"test": "value"},
        )

        assert state.workflow_id == workflow_id
        assert state.status == WorkflowStateStatus.ACTIVE
        assert state.state_data == sample_workflow_state
        assert state.metadata["test"] == "value"

        # Verify Redis operations
        mock_redis.setex.assert_called_once()
        mock_redis.lpush.assert_called_once()

        # Verify database operations
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()

    async def test_save_workflow_state_update_existing(
        self, state_manager, mock_db_session, mock_redis
    ):
        """Test updating existing workflow state."""
        workflow_id = str(uuid4())

        existing_state = WorkflowStateModel(
            workflow_id=workflow_id,
            state_data={"old": "state"},
            status=WorkflowStateStatus.ACTIVE,
        )

        # Mock existing state query
        mock_result = AsyncMock()
        mock_result.scalar.return_value = existing_state
        mock_db_session.execute.return_value = mock_result

        # Mock Redis operations
        mock_redis.pipeline.return_value.__aenter__.return_value = AsyncMock()
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()
        mock_redis.setex.return_value = True
        mock_redis.lpush.return_value = 1
        mock_redis.ltrim.return_value = True

        # Mock database operations
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        new_state = {"updated": "state"}
        await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=new_state, metadata={"test": "update"}
        )

        assert existing_state.state_data == new_state
        assert existing_state.metadata["test"] == "update"
        assert existing_state.updated_at is not None

    async def test_get_workflow_state_from_cache(self, state_manager, mock_redis):
        """Test retrieving workflow state from Redis cache."""
        workflow_id = str(uuid4())
        cached_state = json.dumps(sample_workflow_state)

        mock_redis.get.return_value = cached_state

        state = await state_manager.get_workflow_state(workflow_id)

        assert state == sample_workflow_state
        mock_redis.get.assert_called_once_with(f"workflow_state:{workflow_id}")

    async def test_get_workflow_state_from_database(
        self, state_manager, mock_db_session, mock_redis
    ):
        """Test retrieving workflow state from database when cache miss."""
        workflow_id = str(uuid4())
        state_data = {"test": "database_state"}

        # Mock cache miss
        mock_redis.get.return_value = None

        # Mock database query
        mock_state = WorkflowStateModel(
            workflow_id=workflow_id,
            state_data=state_data,
            status=WorkflowStateStatus.ACTIVE,
        )
        mock_result = AsyncMock()
        mock_result.scalar.return_value = mock_state
        mock_db_session.execute.return_value = mock_result

        # Mock cache set
        mock_redis.setex.return_value = True

        state = await state_manager.get_workflow_state(workflow_id)

        assert state == state_data
        mock_redis.get.assert_called_once_with(f"workflow_state:{workflow_id}")
        mock_redis.setex.assert_called_once()

    async def test_get_workflow_state_not_found(
        self, state_manager, mock_redis, mock_db_session
    ):
        """Test retrieving workflow state when not found."""
        workflow_id = str(uuid4())

        mock_redis.get.return_value = None

        mock_result = AsyncMock()
        mock_result.scalar.return_value = None
        mock_db_session.execute.return_value = mock_result

        state = await state_manager.get_workflow_state(workflow_id)

        assert state is None

    async def test_create_checkpoint(self, state_manager, mock_redis, mock_db_session):
        """Test creating workflow checkpoint."""
        workflow_id = str(uuid4())
        checkpoint_data = {"step": "completed", "results": "success"}

        # Mock Redis operations
        mock_redis.pipeline.return_value.__aenter__.return_value = AsyncMock()
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()
        mock_redis.setex.return_value = True
        mock_redis.lpush.return_value = 1
        mock_redis.ltrim.return_value = True

        # Mock database operations
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        checkpoint = await state_manager.create_checkpoint(
            workflow_id=workflow_id,
            checkpoint_data=checkpoint_data,
            metadata={"type": "milestone"},
        )

        assert checkpoint.workflow_id == workflow_id
        assert checkpoint.checkpoint_data == checkpoint_data
        assert checkpoint.metadata["type"] == "milestone"
        assert checkpoint.checkpoint_type == "manual"

    async def test_restore_checkpoint(self, state_manager, mock_redis, mock_db_session):
        """Test restoring from checkpoint."""
        workflow_id = str(uuid4())
        checkpoint_data = {"step": "restored", "context": "checkpoint"}

        # Mock checkpoint retrieval
        mock_checkpoint = WorkflowCheckpointModel(
            workflow_id=workflow_id,
            checkpoint_data=checkpoint_data,
            checkpoint_type="manual",
        )

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_checkpoint
        mock_db_session.execute.return_value = mock_result

        # Mock state update
        mock_redis.setex.return_value = True

        restored_state = await state_manager.restore_checkpoint(workflow_id)

        assert restored_state == checkpoint_data
        mock_redis.setex.assert_called_once()

    async def test_restore_checkpoint_not_found(self, state_manager, mock_db_session):
        """Test restoring from non-existent checkpoint."""
        workflow_id = str(uuid4())

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        with pytest.raises(StateRecoveryError, match="Checkpoint not found"):
            await state_manager.restore_checkpoint(workflow_id)

    async def test_acquire_lock_success(self, state_manager, mock_redis):
        """Test successful workflow lock acquisition."""
        workflow_id = str(uuid4())

        mock_redis.set.return_value = True

        locked = await state_manager.acquire_workflow_lock(workflow_id)

        assert locked is True
        mock_redis.set.assert_called_once()

    async def test_acquire_lock_already_locked(self, state_manager, mock_redis):
        """Test lock acquisition when already locked."""
        workflow_id = str(uuid4())

        mock_redis.set.return_value = None

        locked = await state_manager.acquire_workflow_lock(workflow_id)

        assert locked is False

    async def test_release_lock(self, state_manager, mock_redis):
        """Test workflow lock release."""
        workflow_id = str(uuid4())

        mock_redis.delete.return_value = 1

        await state_manager.release_workflow_lock(workflow_id)

        mock_redis.delete.assert_called_once_with(f"workflow_lock:{workflow_id}")

    async def test_add_workflow_event(self, state_manager, mock_redis, mock_db_session):
        """Test adding workflow event."""
        workflow_id = str(uuid4())

        # Mock Redis operations
        mock_redis.pipeline.return_value.__aenter__.return_value = AsyncMock()
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()
        mock_redis.setex.return_value = True
        mock_redis.lpush.return_value = 1
        mock_redis.ltrim.return_value = True

        # Mock database operations
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None

        event = await state_manager.add_workflow_event(
            workflow_id=workflow_id,
            event_type="STEP_STARTED",
            event_data={"step": "dependency_scan"},
            metadata={"priority": "high"},
        )

        assert event.workflow_id == workflow_id
        assert event.event_type == "STEP_STARTED"
        assert event.event_data["step"] == "dependency_scan"
        assert event.metadata["priority"] == "high"

    async def test_get_workflow_events(self, state_manager, mock_db_session):
        """Test retrieving workflow events."""
        workflow_id = str(uuid4())

        events = [
            WorkflowEventModel(
                workflow_id=workflow_id,
                event_type="STEP_STARTED",
                event_data={"step": "scan"},
                sequence_number=1,
            ),
            WorkflowEventModel(
                workflow_id=workflow_id,
                event_type="STEP_COMPLETED",
                event_data={"step": "scan"},
                sequence_number=2,
            ),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = events
        mock_db_session.execute.return_value = mock_result

        retrieved_events = await state_manager.get_workflow_events(workflow_id)

        assert len(retrieved_events) == 2
        assert retrieved_events[0].event_type == "STEP_STARTED"
        assert retrieved_events[1].event_type == "STEP_COMPLETED"

    async def test_archive_workflow_state(
        self, state_manager, mock_redis, mock_db_session
    ):
        """Test archiving workflow state."""
        workflow_id = str(uuid4())

        # Mock existing state
        existing_state = WorkflowStateModel(
            workflow_id=workflow_id,
            state_data={"test": "state"},
            status=WorkflowStateStatus.ACTIVE,
        )

        mock_result = AsyncMock()
        mock_result.scalar.return_value = existing_state
        mock_db_session.execute.return_value = mock_result

        # Mock operations
        mock_redis.delete.return_value = 1
        mock_db_session.commit.return_value = None

        await state_manager.archive_workflow_state(workflow_id)

        assert existing_state.status == WorkflowStateStatus.ARCHIVED
        assert existing_state.archived_at is not None
        mock_redis.delete.assert_called_once()

    async def test_cleanup_expired_states(self, state_manager, mock_db_session):
        """Test cleanup of expired workflow states."""
        expired_states = [
            WorkflowStateModel(
                workflow_id=str(uuid4()),
                state_data={"test": "expired"},
                status=WorkflowStateStatus.ACTIVE,
                created_at=datetime.utcnow() - timedelta(days=100),
            )
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = expired_states
        mock_db_session.execute.return_value = mock_result

        deleted_count = await state_manager.cleanup_expired_states()

        assert deleted_count == 1
        for state in expired_states:
            assert state.status == WorkflowStateStatus.ARCHIVED

    async def test_compression_decompression(self, state_manager):
        """Test data compression and decompression."""
        test_data = {
            "large": "data" * 1000,
            "nested": {"deep": {"data": "value" * 100}},
        }

        compressed = state_manager._compress_data(test_data)
        decompressed = state_manager._decompress_data(compressed)

        assert decompressed == test_data

    async def test_data_size_validation_large_payload(
        self, state_manager, mock_settings
    ):
        """Test validation of large payload data."""
        large_data = {"data": "x" * (mock_settings.WORKFLOW_STATE_MAX_PAYLOAD_SIZE + 1)}

        with pytest.raises(StateStorageError, match="State data too large"):
            state_manager._validate_data_size(large_data)

    async def test_data_size_validation_valid_payload(
        self, state_manager, mock_settings
    ):
        """Test validation of valid payload data."""
        valid_data = {"data": "x" * (mock_settings.WORKFLOW_STATE_MAX_PAYLOAD_SIZE - 1)}

        # Should not raise exception
        state_manager._validate_data_size(valid_data)

    async def test_redis_connection_error_handling(self, state_manager, mock_redis):
        """Test handling of Redis connection errors."""
        mock_redis.get.side_effect = Exception("Connection failed")

        workflow_id = str(uuid4())

        with pytest.raises(StateStorageError, match="Redis operation failed"):
            await state_manager.get_workflow_state(workflow_id)

    async def test_database_error_handling(self, state_manager, mock_db_session):
        """Test handling of database errors."""
        mock_db_session.execute.side_effect = SQLAlchemyError("Database error")

        workflow_id = str(uuid4())
        state_data = {"test": "state"}

        with pytest.raises(StateStorageError, match="Database operation failed"):
            await state_manager.save_workflow_state(workflow_id, state_data)

    async def test_concurrent_lock_acquisition(self, state_manager, mock_redis):
        """Test concurrent lock acquisition behavior."""
        workflow_id = str(uuid4())

        # Simulate lock held by another process
        mock_redis.set.return_value = None

        first_lock = await state_manager.acquire_workflow_lock(workflow_id)
        assert first_lock is False

        # Verify lock key was attempted
        mock_redis.set.assert_called_once()

    async def test_workflow_state_metrics(self, state_manager):
        """Test workflow state metrics tracking."""
        workflow_id = str(uuid4())

        metrics = await state_manager.get_workflow_state_metrics(workflow_id)

        assert "storage_backend" in metrics
        assert "compression_enabled" in metrics
        assert "cache_hit" in metrics
        assert "database_access" in metrics

    async def test_state_persistence_with_large_data(
        self, state_manager, mock_db_session, mock_redis
    ):
        """Test state persistence with large datasets."""
        workflow_id = str(uuid4())

        large_state = {
            "dependencies": [
                {"name": f"pkg_{i}", "version": f"1.0.{i}"} for i in range(1000)
            ],
            "results": {
                "scans": [{"id": i, "status": "completed"} for i in range(500)]
            },
        }

        # Mock compression and storage
        mock_redis.pipeline.return_value.__aenter__.return_value = AsyncMock()
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()
        mock_redis.setex.return_value = True
        mock_redis.lpush.return_value = 1
        mock_redis.ltrim.return_value = True

        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_result = AsyncMock()
        mock_result.scalar.return_value = None
        mock_db_session.execute.return_value = mock_result

        state = await state_manager.save_workflow_state(workflow_id, large_state)

        assert state.workflow_id == workflow_id
        assert len(state.state_data["dependencies"]) == 1000

    async def test_state_recovery_after_failure(
        self, state_manager, mock_redis, mock_db_session
    ):
        """Test state recovery after system failure."""
        workflow_id = str(uuid4())

        # Create a checkpoint
        checkpoint_data = {"recovery_point": "pre_failure", "context": "recovery"}

        mock_checkpoint = WorkflowCheckpointModel(
            workflow_id=workflow_id,
            checkpoint_data=checkpoint_data,
            checkpoint_type="automatic",
        )

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_checkpoint
        mock_db_session.execute.return_value = mock_result

        mock_redis.setex.return_value = True

        recovered_state = await state_manager.restore_checkpoint(workflow_id)

        assert recovered_state == checkpoint_data
        assert "recovery_point" in recovered_state

    async def test_audit_trail_completeness(self, state_manager, mock_db_session):
        """Test audit trail completeness and ordering."""
        workflow_id = str(uuid4())

        events = []
        for i in range(5):
            event = WorkflowEventModel(
                workflow_id=workflow_id,
                event_type="TEST_EVENT",
                event_data={"iteration": i},
                sequence_number=i + 1,
            )
            events.append(event)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = events
        mock_db_session.execute.return_value = mock_result

        retrieved_events = await state_manager.get_workflow_state_audit_trail(
            workflow_id
        )

        assert len(retrieved_events) == 5
        for i, event in enumerate(retrieved_events):
            assert event.sequence_number == i + 1
            assert event.event_data["iteration"] == i

    async def test_cleanup_stale_locks(self, state_manager, mock_redis):
        """Test cleanup of stale workflow locks."""
        # Mock scan for keys
        mock_redis.scan.return_value = (
            0,
            [f"workflow_lock:{uuid4()}", f"workflow_lock:{uuid4()}"],
        )
        mock_redis.ttl.side_effect = [3600, -1]  # One active, one expired
        mock_redis.delete.return_value = 1

        cleaned_count = await state_manager.cleanup_stale_locks()

        assert cleaned_count == 1
        mock_redis.delete.assert_called_once()

    async def test_state_versioning(self, state_manager, mock_db_session):
        """Test state versioning and history tracking."""
        workflow_id = str(uuid4())

        # Create multiple state versions
        states = [
            WorkflowStateModel(
                workflow_id=workflow_id,
                state_data={"version": i, "data": f"state_{i}"},
                status=WorkflowStateStatus.ACTIVE
                if i == 2
                else WorkflowStateStatus.HISTORICAL,
                version_number=i + 1,
            )
            for i in range(3)
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = states
        mock_db_session.execute.return_value = mock_result

        state_history = await state_manager.get_workflow_state_history(workflow_id)

        assert len(state_history) == 3
        assert state_history[0].version_number == 3  # Most recent first
        assert state_history[-1].version_number == 1  # Oldest last

    async def test_error_handling_corrupted_data(self, state_manager, mock_redis):
        """Test handling of corrupted cached data."""
        workflow_id = str(uuid4())

        # Mock corrupted JSON data
        mock_redis.get.return_value = b"corrupted\x00\x00data"

        with pytest.raises(StateStorageError, match="Failed to deserialize state data"):
            await state_manager.get_workflow_state(workflow_id)

    async def test_workflow_state_statistics(self, state_manager, mock_db_session):
        """Test workflow state statistics generation."""
        mock_stats = [("active", 5), ("completed", 10), ("failed", 2), ("archived", 3)]

        mock_result = MagicMock()
        mock_result.all.return_value = mock_stats
        mock_db_session.execute.return_value = mock_result

        stats = await state_manager.get_workflow_state_statistics()

        assert stats["active"] == 5
        assert stats["completed"] == 10
        assert stats["failed"] == 2
        assert stats["archived"] == 3
