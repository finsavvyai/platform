"""
Basic integration tests for workflow state management.
Tests the core state manager functionality with minimal dependencies.
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis

# Test only the state manager components directly
from src.udp.core.models.workflow_state import (
    WorkflowStateModel,
    WorkflowCheckpointModel,
    WorkflowEventModel,
    WorkflowLockModel,
    WorkflowStateStatus,
    StateStorageBackend,
    CompressionAlgorithm,
)


@pytest.mark.integration
@pytest.mark.asyncio
class TestWorkflowStateManagerBasicIntegration:
    """Basic integration tests for workflow state management."""

    @pytest.fixture
    async def mock_redis(self):
        """Create mock Redis client."""
        return AsyncMock(spec=Redis)

    @pytest.fixture
    async def mock_db_session(self):
        """Create mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    async def sample_workflow_state_data(self):
        """Create sample workflow state data."""
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
    async def sample_checkpoint_data(self):
        """Create sample checkpoint data."""
        return {
            "step": "dependency_resolution",
            "context": {"resolved_packages": 38, "conflicts_found": 2, "progress": 0.8},
            "metadata": {
                "checkpoint_type": "milestone",
                "name": "resolution_completed",
            },
        }

    async def test_workflow_state_lifecycle_integration(
        self, mock_redis, mock_db_session, sample_workflow_state_data
    ):
        """Test complete workflow state lifecycle."""

        workflow_id = str(uuid4())

        # Mock Redis operations
        mock_redis.pipeline.return_value.__aenter__.return_value = AsyncMock()
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()
        mock_redis.setex.return_value = True
        mock_redis.lpush.return_value = 1
        mock_redis.ltrim.return_value = True
        mock_redis.get.return_value = json.dumps(sample_workflow_state_data)

        # Mock database operations
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        # Mock database query result
        mock_result = AsyncMock()
        mock_result.scalar.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Test state creation
            state = await state_manager.save_workflow_state(
                workflow_id=workflow_id,
                state=sample_workflow_state_data,
                metadata={"test": "lifecycle"},
            )

            assert state.workflow_id == workflow_id
            assert state.status == WorkflowStateStatus.ACTIVE
            assert state.state_data == sample_workflow_state_data

            # Test state retrieval from cache
            retrieved_state = await state_manager.get_workflow_state(workflow_id)
            assert retrieved_state == sample_workflow_state_data

            # Test state update
            updated_data = sample_workflow_state_data.copy()
            updated_data["status"] = "completed"
            updated_data["context"]["progress"] = 1.0

            # Mock existing state for update
            existing_state = WorkflowStateModel(
                workflow_id=workflow_id,
                state_data=sample_workflow_state_data,
                status=WorkflowStateStatus.ACTIVE,
            )
            mock_result.scalar.return_value = existing_state

            updated_state = await state_manager.save_workflow_state(
                workflow_id=workflow_id, state=updated_data, metadata={"final": True}
            )

            assert updated_state.state_data["status"] == "completed"
            assert updated_state.metadata["final"] is True

    async def test_checkpoint_creation_and_restoration_integration(
        self, mock_redis, mock_db_session, sample_checkpoint_data
    ):
        """Test checkpoint creation and restoration integration."""

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

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Create checkpoint
            checkpoint = await state_manager.create_checkpoint(
                workflow_id=workflow_id,
                checkpoint_data=sample_checkpoint_data,
                metadata={"type": "milestone"},
            )

            assert checkpoint.workflow_id == workflow_id
            assert checkpoint.checkpoint_data == sample_checkpoint_data
            assert checkpoint.checkpoint_type == "manual"
            assert checkpoint.metadata["type"] == "milestone"

            # Mock checkpoint retrieval
            mock_checkpoint = WorkflowCheckpointModel(
                workflow_id=workflow_id,
                checkpoint_data=sample_checkpoint_data,
                checkpoint_type="manual",
            )

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_checkpoint
            mock_db_session.execute.return_value = mock_result

            # Mock state update
            mock_redis.setex.return_value = True

            # Restore from checkpoint
            restored_state = await state_manager.restore_checkpoint(workflow_id)

            assert restored_state == sample_checkpoint_data
            assert restored_state["step"] == "dependency_resolution"

    async def test_workflow_event_tracking_integration(
        self, mock_redis, mock_db_session
    ):
        """Test workflow event tracking integration."""

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

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Add multiple events
            events = [
                {
                    "event_type": "STEP_STARTED",
                    "event_data": {"step": "dependency_scan"},
                    "metadata": {"source": "analyzer"},
                },
                {
                    "event_type": "DEPENDENCY_DISCOVERED",
                    "event_data": {"package": "lodash", "version": "4.17.21"},
                    "metadata": {"ecosystem": "npm"},
                },
                {
                    "event_type": "STEP_COMPLETED",
                    "event_data": {"step": "dependency_scan", "count": 42},
                    "metadata": {"source": "analyzer"},
                },
            ]

            created_events = []
            for event_data in events:
                event = await state_manager.add_workflow_event(
                    workflow_id=workflow_id, **event_data
                )
                created_events.append(event)

            # Verify events were created
            assert len(created_events) == 3
            assert created_events[0].event_type == "STEP_STARTED"
            assert created_events[1].event_type == "DEPENDENCY_DISCOVERED"
            assert created_events[2].event_type == "STEP_COMPLETED"

            # Mock event retrieval
            mock_events = [
                WorkflowEventModel(
                    workflow_id=workflow_id,
                    event_type=event["event_type"],
                    event_data=event["event_data"],
                    metadata=event["metadata"],
                    sequence_number=i + 1,
                )
                for i, event in enumerate(events)
            ]

            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = mock_events
            mock_db_session.execute.return_value = mock_result

            # Retrieve events
            retrieved_events = await state_manager.get_workflow_events(workflow_id)

            assert len(retrieved_events) == 3
            assert retrieved_events[0].event_type == "STEP_STARTED"
            assert retrieved_events[1].event_type == "DEPENDENCY_DISCOVERED"
            assert retrieved_events[2].event_type == "STEP_COMPLETED"

    async def test_workflow_locking_integration(self, mock_redis, mock_db_session):
        """Test workflow locking mechanism integration."""

        workflow_id = str(uuid4())

        # Mock Redis operations
        mock_redis.set.return_value = True
        mock_redis.delete.return_value = 1

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Test lock acquisition
            locked = await state_manager.acquire_workflow_lock(workflow_id)
            assert locked is True

            # Test lock acquisition when already locked
            mock_redis.set.return_value = None  # Lock already exists
            locked_again = await state_manager.acquire_workflow_lock(workflow_id)
            assert locked_again is False

            # Test lock release
            await state_manager.release_workflow_lock(workflow_id)
            mock_redis.delete.assert_called_once_with(f"workflow_lock:{workflow_id}")

            # Test lock acquisition after release
            mock_redis.set.return_value = True  # Lock available again
            locked_third = await state_manager.acquire_workflow_lock(workflow_id)
            assert locked_third is True

    async def test_workflow_state_archival_integration(
        self, mock_redis, mock_db_session
    ):
        """Test workflow state archival integration."""

        workflow_id = str(uuid4())
        state_data = {"status": "completed", "data": "test"}

        # Mock existing state
        existing_state = WorkflowStateModel(
            workflow_id=workflow_id,
            state_data=state_data,
            status=WorkflowStateStatus.ACTIVE,
        )

        # Mock database query
        mock_result = AsyncMock()
        mock_result.scalar.return_value = existing_state
        mock_db_session.execute.return_value = mock_result

        # Mock Redis operations
        mock_redis.delete.return_value = 1
        mock_db_session.commit.return_value = None

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Archive workflow state
            await state_manager.archive_workflow_state(workflow_id)

            # Verify state was archived
            assert existing_state.status == WorkflowStateStatus.ARCHIVED
            assert existing_state.archived_at is not None
            mock_redis.delete.assert_called_once()

    async def test_workflow_state_cleanup_integration(
        self, mock_redis, mock_db_session
    ):
        """Test workflow state cleanup integration."""

        # Create expired states
        expired_states = [
            WorkflowStateModel(
                workflow_id=str(uuid4()),
                state_data={"test": "expired"},
                status=WorkflowStateStatus.ACTIVE,
                created_at=datetime.utcnow() - timedelta(days=100),
            ),
            WorkflowStateModel(
                workflow_id=str(uuid4()),
                state_data={"test": "expired"},
                status=WorkflowStateStatus.COMPLETED,
                created_at=datetime.utcnow() - timedelta(days=50),
            ),
        ]

        # Mock database query for expired states
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = expired_states
        mock_db_session.execute.return_value = mock_result

        mock_db_session.commit.return_value = None

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Run cleanup
            deleted_count = await state_manager.cleanup_expired_states()

            # Verify expired states were archived
            assert deleted_count == 2
            for state in expired_states:
                assert state.status == WorkflowStateStatus.ARCHIVED

    async def test_workflow_state_metrics_integration(
        self, mock_redis, mock_db_session
    ):
        """Test workflow state metrics collection integration."""

        workflow_id = str(uuid4())

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Get workflow state metrics
            metrics = await state_manager.get_workflow_state_metrics(workflow_id)

            assert "storage_backend" in metrics
            assert "compression_enabled" in metrics
            assert "cache_hit" in metrics
            assert "database_access" in metrics

    async def test_workflow_state_statistics_integration(
        self, mock_redis, mock_db_session
    ):
        """Test workflow state statistics generation integration."""

        # Mock statistics query
        mock_stats = [("active", 5), ("completed", 10), ("failed", 2), ("archived", 3)]

        mock_result = MagicMock()
        mock_result.all.return_value = mock_stats
        mock_db_session.execute.return_value = mock_result

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Get statistics
            stats = await state_manager.get_workflow_state_statistics()

            assert stats["active"] == 5
            assert stats["completed"] == 10
            assert stats["failed"] == 2
            assert stats["archived"] == 3

    async def test_concurrent_workflow_state_management_integration(
        self, mock_redis, mock_db_session
    ):
        """Test concurrent workflow state management integration."""

        workflow_ids = [str(uuid4()) for _ in range(3)]

        # Mock Redis operations
        mock_redis.set.return_value = True
        mock_redis.delete.return_value = 1

        # Mock Redis pipeline
        mock_pipeline = AsyncMock()
        mock_redis.pipeline.return_value.__aenter__.return_value = mock_pipeline
        mock_redis.pipeline.return_value.__aexit__.return_value = AsyncMock()

        # Mock database operations
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        # Mock database query result (no existing state)
        mock_result = AsyncMock()
        mock_result.scalar.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            async def update_workflow_state(workflow_id, index):
                # Acquire lock
                if await state_manager.acquire_workflow_lock(workflow_id):
                    try:
                        # Update state
                        state_data = {
                            "workflow_type": "dependency_analysis",
                            "status": f"concurrent_step_{index}",
                            "context": {"worker_index": index},
                            "metadata": {"concurrent": True},
                        }

                        state = await state_manager.save_workflow_state(
                            workflow_id=workflow_id, state=state_data
                        )

                        return state

                    finally:
                        # Release lock
                        await state_manager.release_workflow_lock(workflow_id)

                return None

            # Run concurrent updates
            tasks = [
                update_workflow_state(workflow_id, i)
                for i, workflow_id in enumerate(workflow_ids)
            ]

            results = await asyncio.gather(*tasks)

            # Verify all workflows were updated
            assert len(results) == 3
            for i, result in enumerate(results):
                assert result is not None
                assert result.workflow_id == workflow_ids[i]
                assert result.state_data["status"] == f"concurrent_step_{i}"

    async def test_workflow_state_error_recovery_integration(
        self, mock_redis, mock_db_session
    ):
        """Test workflow state error recovery integration."""

        workflow_id = str(uuid4())

        # Create initial state
        initial_state = {
            "workflow_type": "dependency_analysis",
            "status": "processing",
            "context": {"step": "dependency_resolution"},
            "metadata": {"attempt": 1},
        }

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

        # Mock database query result (no existing state)
        mock_result = AsyncMock()
        mock_result.scalar.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Import state manager with mocked dependencies
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
            from src.udp.workflows.state_manager import WorkflowStateManager

            state_manager = WorkflowStateManager()

            # Save initial state
            await state_manager.save_workflow_state(
                workflow_id=workflow_id, state=initial_state
            )

            # Create checkpoint before error
            checkpoint_data = {
                "step": "dependency_resolution",
                "context": {"progress": 0.5, "packages_processed": 10},
            }

            checkpoint = await state_manager.create_checkpoint(
                workflow_id=workflow_id,
                checkpoint_data=checkpoint_data,
                metadata={"type": "error_recovery_checkpoint"},
            )

            # Simulate error
            await state_manager.add_workflow_event(
                workflow_id=workflow_id,
                event_type="WORKFLOW_ERROR",
                event_data={
                    "error_type": "NetworkTimeout",
                    "error_message": "Failed to resolve dependencies",
                },
                metadata={"retry_count": 1},
            )

            # Save error state
            error_state = {
                "workflow_type": "dependency_analysis",
                "status": "error",
                "context": {"step": "dependency_resolution", "error": "NetworkTimeout"},
                "metadata": {
                    "last_error": "Failed to resolve dependencies",
                    "failed_at": datetime.utcnow().isoformat(),
                },
            }

            await state_manager.save_workflow_state(
                workflow_id=workflow_id, state=error_state
            )

            # Mock checkpoint retrieval for recovery
            mock_checkpoint = WorkflowCheckpointModel(
                workflow_id=workflow_id,
                checkpoint_data=checkpoint_data,
                checkpoint_type="manual",
            )

            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = mock_checkpoint
            mock_db_session.execute.return_value = mock_result

            # Test recovery from checkpoint
            recovered_state = await state_manager.restore_checkpoint(workflow_id)

            assert recovered_state["step"] == "dependency_resolution"
            assert recovered_state["context"]["progress"] == 0.5

            # Add recovery event
            await state_manager.add_workflow_event(
                workflow_id=workflow_id,
                event_type="WORKFLOW_RECOVERED",
                event_data={
                    "recovery_method": "checkpoint_restoration",
                    "recovered_from_step": "dependency_resolution",
                },
                metadata={"retry_count": 2},
            )
