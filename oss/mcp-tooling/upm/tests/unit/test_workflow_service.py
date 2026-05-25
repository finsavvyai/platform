"""
Unit tests for Workflow Execution Service.

Tests LangGraph integration, workflow orchestration, state management,
error handling, and retry mechanisms.
"""

import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.udp.services.workflow_service import (
    WorkflowExecutionService,
    WorkflowType,
    WorkflowStatus,
)
from src.udp.core.models.workflow import WorkflowExecution, WorkflowStep
from src.udp.core.models.project import ProjectModel


@pytest.fixture
async def test_db():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield async_session

    # Cleanup
    await engine.dispose()


@pytest.fixture
async def workflow_service(test_db):
    """Create workflow service instance with mocked dependencies."""
    service = WorkflowExecutionService(test_db)
    return service


@pytest.fixture
def mock_project():
    """Mock project data."""
    return ProjectModel(
        id=uuid4(),
        name="Test Project",
        description="Test project for workflow testing",
        created_at=datetime.utcnow(),
    )


class TestWorkflowExecution:
    """Test workflow execution functionality."""

    @pytest.mark.asyncio
    async def test_execute_dependency_analysis_workflow(
        self, workflow_service, test_db, mock_project
    ):
        """Test successful dependency analysis workflow execution."""
        project_id = str(mock_project.id)
        configuration = {"force_rescan": False, "severity_threshold": "medium"}
        triggered_by = uuid4()

        with patch.object(workflow_service, "_get_dependency") as mock_dep:
            # Mock dependency service
            mock_dep.return_value = MagicMock()

            # Mock workflow graph creation
            with patch.object(
                workflow_service, "_create_workflow_graph"
            ) as mock_create_graph:
                mock_graph = AsyncMock()
                mock_graph.ainvoke.return_value = {
                    "step_status": {
                        "parse_dependencies": "completed",
                        "resolve_dependencies": "completed",
                        "security_scan": "completed",
                    },
                    "results": {
                        "dependencies_found": 25,
                        "vulnerabilities": 2,
                    },
                    "errors": [],
                }

                mock_create_graph.return_value = mock_graph

                # Execute workflow
                execution = await workflow_service.execute_workflow(
                    WorkflowType.DEPENDENCY_ANALYSIS,
                    project_id,
                    configuration,
                    triggered_by,
                )

                # Verify execution record was created
                assert execution is not None
                assert execution.workflow_type == WorkflowType.DEPENDENCY_ANALYSIS.value
                assert execution.project_id == project_id
                assert execution.configuration == configuration
                assert execution.triggered_by == str(triggered_by)

                # Verify workflow graph was created
                mock_create_graph.assert_called_once()

                # Verify workflow was invoked
                mock_graph.ainvoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_security_scan_workflow(
        self, workflow_service, test_db, mock_project
    ):
        """Test security scan workflow execution."""
        project_id = str(mock_project.id)
        configuration = {"severity_threshold": "high"}

        with patch.object(workflow_service, "_get_dependency") as mock_dep:
            # Mock security service
            mock_security_service = AsyncMock()
            mock_security_service.scan_project_vulnerabilities.return_value = {
                "project_id": project_id,
                "total_dependencies": 15,
                "vulnerabilities": [{"severity": "critical", "id": "CVE-2023-12345"}],
                "summary": {"total": 1, "critical": 1},
            }
            mock_dep.return_value = mock_security_service

            # Execute security scan workflow
            execution = await workflow_service.execute_workflow(
                WorkflowType.SECURITY_SCAN,
                project_id,
                configuration,
            )

            # Verify security service was called
            mock_security_service.scan_project_vulnerabilities.assert_called_once_with(
                project_id,
                force_rescan=False,
                severity_threshold="high",
            )

            # Verify execution record
            assert execution.workflow_type == WorkflowType.SECURITY_SCAN.value
            assert execution.status == WorkflowStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_workflow_execution_with_force_rerun(
        self, workflow_service, test_db, mock_project
    ):
        """Test workflow execution with force rerun."""
        project_id = str(mock_project.id)

        with patch.object(workflow_service, "_get_recent_execution") as mock_recent:
            # Mock recent execution exists
            mock_execution = MagicMock()
            mock_execution.status = "completed"
            mock_execution.completed_at = datetime.utcnow()
            mock_recent.return_value = mock_execution

            # Execute without force_rerun
            execution1 = await workflow_service.execute_workflow(
                WorkflowType.DEPENDENCY_ANALYSIS,
                project_id,
                force_rerun=False,
            )

            # Should return recent execution
            assert execution1 == mock_execution
            mock_recent.assert_called_once()

            # Reset mock
            mock_recent.reset_mock()

            # Execute with force_rerun
            with patch.object(
                workflow_service, "_create_workflow_graph"
            ) as mock_create_graph:
                mock_graph = AsyncMock()
                mock_graph.ainvoke.return_value = {"results": {}}
                mock_create_graph.return_value = mock_graph

                execution2 = await workflow_service.execute_workflow(
                    WorkflowType.DEPENDENCY_ANALYSIS,
                    project_id,
                    force_rerun=True,
                )

                # Should create new execution
                assert execution2 != mock_execution
                mock_recent.assert_not_called()  # Should bypass recent check

    @pytest.mark.asyncio
    async def test_workflow_execution_timeout(
        self, workflow_service, test_db, mock_project
    ):
        """Test workflow execution timeout handling."""
        project_id = str(mock_project.id)

        with patch.object(
            workflow_service, "_create_workflow_graph"
        ) as mock_create_graph:
            # Mock workflow that times out
            mock_graph = AsyncMock()
            mock_graph.ainvoke.side_effect = asyncio.TimeoutError("Workflow timeout")
            mock_create_graph.return_value = mock_graph

            # Should raise timeout error
            with pytest.raises(Exception):
                await workflow_service.execute_workflow(
                    WorkflowType.DEPENDENCY_ANALYSIS,
                    project_id,
                )

            # Verify execution was marked as failed
            executions = await workflow_service.list_workflow_executions(
                project_id=project_id,
                status=WorkflowStatus.FAILED,
                limit=1,
            )

            assert len(executions) == 1
            assert executions[0].status == WorkflowStatus.FAILED.value
            assert "timed out" in executions[0].error_message.lower()


class TestRetryMechanisms:
    """Test workflow retry mechanisms."""

    @pytest.mark.asyncio
    async def test_workflow_retry_on_failure(
        self, workflow_service, test_db, mock_project
    ):
        """Test workflow retry mechanism on failure."""
        project_id = str(mock_project.id)

        with patch.object(
            workflow_service, "_create_workflow_graph"
        ) as mock_create_graph:
            # Mock workflow that fails first time, succeeds second time
            mock_graph = AsyncMock()
            call_count = 0

            async def mock_ainvoke(state):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    raise ValueError("Simulated workflow failure")
                return {"results": {"success": True}}

            mock_graph.ainvoke.side_effect = mock_ainvoke
            mock_create_graph.return_value = mock_graph

            # Execute workflow - should succeed after retry
            execution = await workflow_service.execute_workflow(
                WorkflowType.DEPENDENCY_ANALYSIS,
                project_id,
            )

            # Verify workflow was called twice (original + retry)
            assert mock_graph.ainvoke.call_count == 2
            assert execution.status == WorkflowStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_workflow_retry_exhaustion(
        self, workflow_service, test_db, mock_project
    ):
        """Test workflow retry exhaustion when max retries reached."""
        project_id = str(mock_project.id)

        # Override retry config for testing
        original_config = workflow_service.retry_config
        workflow_service.retry_config = {
            "max_retries": 2,
            "retry_delay": 0.1,
            "backoff_factor": 1.5,
        }

        try:
            with patch.object(
                workflow_service, "_create_workflow_graph"
            ) as mock_create_graph:
                # Mock workflow that always fails
                mock_graph = AsyncMock()
                mock_graph.ainvoke.side_effect = ValueError("Persistent failure")
                mock_create_graph.return_value = mock_graph

                # Should fail after exhausting retries
                with pytest.raises(ValueError):
                    await workflow_service.execute_workflow(
                        WorkflowType.DEPENDENCY_ANALYSIS,
                        project_id,
                    )

                # Verify workflow was called max_retries + 1 times
                assert mock_graph.ainvoke.call_count == 3  # original + 2 retries

        finally:
            # Restore original config
            workflow_service.retry_config = original_config


class TestWorkflowStateManagement:
    """Test workflow state management and persistence."""

    @pytest.mark.asyncio
    async def test_workflow_state_persistence(
        self, workflow_service, test_db, mock_project
    ):
        """Test workflow state persistence."""
        project_id = str(mock_project.id)

        with patch.object(workflow_service, "_get_dependency") as mock_dep:
            # Mock dependency service
            mock_dep.return_value = MagicMock()

            with patch.object(
                workflow_service, "_create_workflow_graph"
            ) as mock_create_graph:
                # Mock workflow with state updates
                mock_graph = AsyncMock()

                async def mock_ainvoke(state):
                    # Simulate state updates during workflow
                    return {
                        "workflow_id": state["workflow_id"],
                        "project_id": state["project_id"],
                        "step_status": {
                            "parse_dependencies": "completed",
                            "resolve_dependencies": "completed",
                            "security_scan": "in_progress",
                        },
                        "results": {"dependencies_count": 25},
                        "errors": [],
                    }

                mock_graph.ainvoke.side_effect = mock_ainvoke
                mock_create_graph.return_value = mock_graph

                # Execute workflow
                execution = await workflow_service.execute_workflow(
                    WorkflowType.DEPENDENCY_ANALYSIS,
                    project_id,
                )

                # Verify state was persisted
                assert execution.results is not None
                assert "step_status" in execution.results
                assert "results" in execution.results

    @pytest.mark.asyncio
    async def test_workflow_checkpointer_creation(self, workflow_service):
        """Test workflow checkpointer creation."""
        checkpointer = workflow_service._create_checkpointer()

        # Verify checkpointer was created
        assert checkpointer is not None

        # Test that it's a MemorySaver (for now)
        # In production, this would be a PostgreSQL checkpointer
        from langgraph.checkpoint.memory import MemorySaver

        assert isinstance(checkpointer, MemorySaver)


class TestWorkflowRetrieval:
    """Test workflow execution retrieval and listing."""

    @pytest.mark.asyncio
    async def test_get_workflow_execution(
        self, workflow_service, test_db, mock_project
    ):
        """Test retrieving a specific workflow execution."""
        # Create a mock execution
        execution = WorkflowExecution(
            id=uuid4(),
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
            project_id=str(mock_project.id),
            status=WorkflowStatus.COMPLETED.value,
            results={"test": "result"},
            created_at=datetime.utcnow(),
        )

        workflow_service.db_session.add(execution)
        await workflow_service.db_session.commit()

        # Retrieve execution
        retrieved = await workflow_service.get_workflow_execution(str(execution.id))

        assert retrieved is not None
        assert retrieved.id == execution.id
        assert retrieved.workflow_type == execution.workflow_type
        assert retrieved.results == execution.results

    @pytest.mark.asyncio
    async def test_list_workflow_executions(
        self, workflow_service, test_db, mock_project
    ):
        """Test listing workflow executions with filters."""
        # Create multiple executions
        executions = [
            WorkflowExecution(
                id=uuid4(),
                workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
                project_id=str(mock_project.id),
                status=WorkflowStatus.COMPLETED.value,
                created_at=datetime.utcnow() - timedelta(hours=2),
            ),
            WorkflowExecution(
                id=uuid4(),
                workflow_type=WorkflowType.SECURITY_SCAN.value,
                project_id=str(mock_project.id),
                status=WorkflowStatus.FAILED.value,
                created_at=datetime.utcnow() - timedelta(hours=1),
            ),
            WorkflowExecution(
                id=uuid4(),
                workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
                project_id=str(uuid4()),  # Different project
                status=WorkflowStatus.RUNNING.value,
                created_at=datetime.utcnow(),
            ),
        ]

        for execution in executions:
            workflow_service.db_session.add(execution)
        await workflow_service.db_session.commit()

        # Test listing without filters
        all_executions = await workflow_service.list_workflow_executions(limit=10)
        assert len(all_executions) == 3

        # Test filtering by project
        project_executions = await workflow_service.list_workflow_executions(
            project_id=str(mock_project.id)
        )
        assert len(project_executions) == 2

        # Test filtering by status
        completed_executions = await workflow_service.list_workflow_executions(
            status=WorkflowStatus.COMPLETED
        )
        assert len(completed_executions) == 1
        assert completed_executions[0].status == WorkflowStatus.COMPLETED.value

        # Test filtering by workflow type
        dependency_executions = await workflow_service.list_workflow_executions(
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS
        )
        assert len(dependency_executions) == 2


class TestWorkflowCancellation:
    """Test workflow cancellation functionality."""

    @pytest.mark.asyncio
    async def test_cancel_running_workflow(
        self, workflow_service, test_db, mock_project
    ):
        """Test cancelling a running workflow."""
        project_id = str(mock_project.id)

        # Create a running execution
        execution = WorkflowExecution(
            id=uuid4(),
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
            project_id=project_id,
            status=WorkflowStatus.RUNNING.value,
            created_at=datetime.utcnow(),
        )

        workflow_service.db_session.add(execution)
        await workflow_service.db_session.commit()

        # Cancel the workflow
        success = await workflow_service.cancel_workflow_execution(str(execution.id))

        assert success is True

        # Verify status was updated
        updated_execution = await workflow_service.get_workflow_execution(
            str(execution.id)
        )
        assert updated_execution.status == WorkflowStatus.CANCELLED.value
        assert updated_execution.completed_at is not None
        assert "User requested cancellation" in updated_execution.cancellation_reason

    @pytest.mark.asyncio
    async def test_cancel_completed_workflow_fails(
        self, workflow_service, test_db, mock_project
    ):
        """Test that cancelling completed workflow fails."""
        project_id = str(mock_project.id)

        # Create a completed execution
        execution = WorkflowExecution(
            id=uuid4(),
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
            project_id=project_id,
            status=WorkflowStatus.COMPLETED.value,
            completed_at=datetime.utcnow(),
        )

        workflow_service.db_session.add(execution)
        await workflow_service.db_session.commit()

        # Should fail to cancel completed workflow
        with pytest.raises(Exception):  # ValidationError
            await workflow_service.cancel_workflow_execution(str(execution.id))


class TestWorkflowRetry:
    """Test workflow retry functionality."""

    @pytest.mark.asyncio
    async def test_retry_failed_workflow(self, workflow_service, test_db, mock_project):
        """Test retrying a failed workflow."""
        project_id = str(mock_project.id)

        # Create a failed execution
        failed_execution = WorkflowExecution(
            id=uuid4(),
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
            project_id=project_id,
            status=WorkflowStatus.FAILED.value,
            error_message="Simulated failure",
            configuration={},
            created_at=datetime.utcnow(),
        )

        workflow_service.db_session.add(failed_execution)
        await workflow_service.db_session.commit()

        with patch.object(workflow_service, "_get_dependency") as mock_dep:
            # Mock dependency service
            mock_dep.return_value = MagicMock()

            with patch.object(
                workflow_service, "_create_workflow_graph"
            ) as mock_create_graph:
                # Mock successful retry execution
                mock_graph = AsyncMock()
                mock_graph.ainvoke.return_value = {"results": {"success": True}}
                mock_create_graph.return_value = mock_graph

                # Retry the workflow
                retry_execution = await workflow_service.retry_workflow_execution(
                    str(failed_execution.id)
                )

                # Verify new execution was created
                assert retry_execution is not None
                assert retry_execution.status == WorkflowStatus.COMPLETED.value
                assert retry_execution.project_id == project_id
                assert retry_execution.configuration["retry_count"] == 1
                assert retry_execution.configuration["original_execution_id"] == str(
                    failed_execution.id
                )


class TestWorkflowStatistics:
    """Test workflow statistics and analytics."""

    @pytest.mark.asyncio
    async def test_get_workflow_statistics(
        self, workflow_service, test_db, mock_project
    ):
        """Test getting workflow execution statistics."""
        project_id = str(mock_project.id)

        # Create executions with different statuses
        executions = [
            WorkflowExecution(
                id=uuid4(),
                workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
                project_id=project_id,
                status=WorkflowStatus.COMPLETED.value,
                duration_seconds=120.5,
                created_at=datetime.utcnow() - timedelta(days=1),
            ),
            WorkflowExecution(
                id=uuid4(),
                workflow_type=WorkflowType.SECURITY_SCAN.value,
                project_id=project_id,
                status=WorkflowStatus.FAILED.value,
                duration_seconds=45.0,
                created_at=datetime.utcnow() - timedelta(days=2),
            ),
            WorkflowExecution(
                id=uuid4(),
                workflow_type=WorkflowType.DEPENDENCY_ANALYSIS.value,
                project_id=project_id,
                status=WorkflowStatus.COMPLETED.value,
                duration_seconds=180.0,
                created_at=datetime.utcnow() - timedelta(days=5),
            ),
        ]

        for execution in executions:
            workflow_service.db_session.add(execution)
        await workflow_service.db_session.commit()

        # Get statistics
        stats = await workflow_service.get_workflow_statistics(
            project_id=project_id, days=7
        )

        assert stats["total_executions"] == 3
        assert stats["successful_executions"] == 2
        assert stats["failed_executions"] == 1
        assert stats["success_rate"] == 66.67  # 2/3 * 100
        assert stats["average_duration_seconds"] == (120.5 + 45.0 + 180.0) / 3
        assert stats["period_days"] == 7


class TestErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_unsupported_workflow_type(
        self, workflow_service, test_db, mock_project
    ):
        """Test handling of unsupported workflow types."""
        project_id = str(mock_project.id)

        # Should raise error for unsupported workflow type
        with pytest.raises(Exception):  # ValidationError
            await workflow_service.execute_workflow(
                "unsupported_workflow_type",  # Invalid type
                project_id,
            )

    @pytest.mark.asyncio
    async def test_workflow_with_invalid_configuration(
        self, workflow_service, test_db, mock_project
    ):
        """Test workflow execution with invalid configuration."""
        project_id = str(mock_project.id)
        configuration = {"invalid_key": "invalid_value"}

        with patch.object(workflow_service, "_get_dependency") as mock_dep:
            # Mock dependency service
            mock_dep.return_value = MagicMock()

            with patch.object(
                workflow_service, "_create_workflow_graph"
            ) as mock_create_graph:
                # Mock workflow that handles invalid configuration gracefully
                mock_graph = AsyncMock()
                mock_graph.ainvoke.return_value = {
                    "errors": ["Invalid configuration parameter"],
                    "step_status": {"parse_dependencies": "failed"},
                }
                mock_create_graph.return_value = mock_graph

                # Should handle invalid configuration gracefully
                execution = await workflow_service.execute_workflow(
                    WorkflowType.DEPENDENCY_ANALYSIS,
                    project_id,
                    configuration,
                )

                # Execution should complete but with errors
                assert execution is not None
                assert execution.results is not None
                assert len(execution.results["errors"]) > 0
