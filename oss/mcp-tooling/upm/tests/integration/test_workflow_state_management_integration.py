"""
Integration tests for workflow state management system.
Tests the interaction between workflow state manager, services, and database.
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

from src.udp.workflows.state_manager import (
    WorkflowStateManager,
    StateStorageError,
    StateLockError,
    StateRecoveryError,
)
from src.udp.services.workflow_service import WorkflowService
from src.udp.services.dependency_service import DependencyService
from src.udp.services.security_service import SecurityService
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
from src.udp.core.models.dependency import (
    DependencyModel,
    AnalysisResultModel,
)
from src.udp.core.models.vulnerability import (
    VulnerabilityModel,
    ProjectVulnerabilityModel,
)


@pytest.mark.integration
@pytest.mark.asyncio
class TestWorkflowStateManagerIntegration:
    """Integration tests for workflow state management."""

    @pytest.fixture
    async def workflow_service(self, db_session, redis_client):
        """Create workflow service instance."""
        return WorkflowService(db_session, redis_client)

    @pytest.fixture
    async def dependency_service(self, db_session, redis_client):
        """Create dependency service instance."""
        return DependencyService(db_session, redis_client)

    @pytest.fixture
    async def security_service(self, db_session, redis_client):
        """Create security service instance."""
        return SecurityService(db_session, redis_client)

    @pytest.fixture
    async def state_manager(self, db_session, redis_client):
        """Create workflow state manager instance."""
        return WorkflowStateManager(db_session, redis_client)

    @pytest.fixture
    async def sample_project(self, db_session):
        """Create a sample project for testing."""
        from src.udp.core.models.project import ProjectModel

        project = ProjectModel(
            name="Test Project",
            description="Integration test project",
            repository_url="https://github.com/test/project",
            organization_id=uuid4(),
            created_by=uuid4(),
        )

        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        return project

    @pytest.fixture
    async def sample_dependencies(self, db_session, sample_project):
        """Create sample dependencies for testing."""
        dependencies = []

        for i in range(5):
            dep = DependencyModel(
                project_id=sample_project.id,
                name=f"test-package-{i}",
                version=f"1.{i}.0",
                ecosystem="npm",
                package_url=f"pkg:npm/test-package-{i}@1.{i}.0",
                license="MIT",
                is_direct=True,
                metadata={
                    "description": f"Test package {i}",
                    "author": f"Author {i}",
                },
            )
            dependencies.append(dep)
            db_session.add(dep)

        await db_session.commit()

        for dep in dependencies:
            await db_session.refresh(dep)

        return dependencies

    async def test_workflow_state_persistence_integration(
        self, state_manager, workflow_service, sample_project
    ):
        """Test integration between workflow state manager and workflow service."""

        # Start a workflow execution
        workflow_execution = await workflow_service.execute_workflow(
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
            project_id=str(sample_project.id),
            configuration={"scan_depth": "full"},
            triggered_by=uuid4(),
        )

        # Save intermediate state
        intermediate_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "status": "scanning_dependencies",
            "context": {
                "current_step": "package_resolution",
                "packages_found": 5,
                "progress": 0.3,
            },
            "metadata": {
                "workflow_execution_id": str(workflow_execution.id),
                "retry_count": 0,
                "priority": "normal",
            },
        }

        state = await state_manager.save_workflow_state(
            workflow_id=str(workflow_execution.id),
            state=intermediate_state,
            metadata={"step": "package_resolution"},
        )

        assert state.workflow_id == str(workflow_execution.id)
        assert state.status == WorkflowStateStatus.ACTIVE

        # Retrieve state from cache
        cached_state = await state_manager.get_workflow_state(
            str(workflow_execution.id)
        )
        assert cached_state == intermediate_state

        # Update workflow execution status
        workflow_execution.status = WorkflowStatus.COMPLETED
        workflow_execution.completed_at = datetime.utcnow()

        # Save final state
        final_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "status": "completed",
            "context": {
                "current_step": "completed",
                "packages_found": 5,
                "progress": 1.0,
                "results": {"total_dependencies": 5},
            },
            "metadata": {
                "workflow_execution_id": str(workflow_execution.id),
                "retry_count": 0,
                "priority": "normal",
                "completed_at": workflow_execution.completed_at.isoformat(),
            },
        }

        await state_manager.save_workflow_state(
            workflow_id=str(workflow_execution.id),
            state=final_state,
            metadata={"step": "completed", "final": True},
        )

        # Verify state was updated
        updated_state = await state_manager.get_workflow_state(
            str(workflow_execution.id)
        )
        assert updated_state["status"] == "completed"
        assert updated_state["context"]["progress"] == 1.0

    async def test_checkpoint_and_recovery_integration(
        self, state_manager, workflow_service, sample_project, sample_dependencies
    ):
        """Test checkpoint creation and recovery integration."""

        # Start dependency analysis workflow
        workflow_execution = await workflow_service.execute_workflow(
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
            project_id=str(sample_project.id),
            configuration={"include_transitive": True},
            triggered_by=uuid4(),
        )

        # Simulate workflow progress and create checkpoints
        checkpoints = []

        # Checkpoint 1: Dependency scanning started
        checkpoint1_data = {
            "step": "dependency_scanning",
            "context": {
                "scanned_files": ["package.json"],
                "dependencies_found": len(sample_dependencies),
                "progress": 0.2,
            },
        }

        checkpoint1 = await state_manager.create_checkpoint(
            workflow_id=str(workflow_execution.id),
            checkpoint_data=checkpoint1_data,
            metadata={"type": "milestone", "name": "scanning_started"},
        )
        checkpoints.append(checkpoint1)

        # Checkpoint 2: Analysis completed
        checkpoint2_data = {
            "step": "analysis_completed",
            "context": {
                "dependencies_analyzed": len(sample_dependencies),
                "vulnerabilities_found": 0,
                "progress": 0.8,
            },
        }

        checkpoint2 = await state_manager.create_checkpoint(
            workflow_id=str(workflow_execution.id),
            checkpoint_data=checkpoint2_data,
            metadata={"type": "milestone", "name": "analysis_completed"},
        )
        checkpoints.append(checkpoint2)

        # Verify checkpoints were created
        assert len(checkpoints) == 2
        assert checkpoint1.checkpoint_type == "manual"
        assert checkpoint2.checkpoint_type == "manual"

        # Test recovery from checkpoint
        recovered_state = await state_manager.restore_checkpoint(
            str(workflow_execution.id), checkpoint_id=checkpoint2.id
        )

        assert recovered_state["step"] == "analysis_completed"
        assert recovered_state["context"]["dependencies_analyzed"] == len(
            sample_dependencies
        )

        # Test getting all checkpoints for workflow
        all_checkpoints = await state_manager.get_workflow_checkpoints(
            str(workflow_execution.id)
        )

        assert len(all_checkpoints) == 2
        assert all_checkpoints[0].checkpoint_data["step"] == "analysis_completed"

    async def test_dependency_analysis_workflow_state_integration(
        self, state_manager, dependency_service, sample_project, sample_dependencies
    ):
        """Test state management during dependency analysis workflow."""

        # Start dependency analysis
        analysis_result = await dependency_service.analyze_project_dependencies(
            project_id=str(sample_project.id),
            manifest_files=["package.json"],
            include_transitive=True,
            analyzed_by=uuid4(),
        )

        # Create workflow state for analysis
        workflow_id = str(uuid4())

        # State 1: Analysis started
        initial_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "analysis_id": str(analysis_result.id),
            "status": "started",
            "context": {
                "manifest_files": ["package.json"],
                "include_transitive": True,
                "progress": 0.1,
            },
            "metadata": {
                "service": "dependency_service",
                "method": "analyze_project_dependencies",
                "started_at": datetime.utcnow().isoformat(),
            },
        }

        await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=initial_state
        )

        # State 2: Dependencies discovered
        discovery_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "analysis_id": str(analysis_result.id),
            "status": "discovering_dependencies",
            "context": {
                "dependencies_found": len(sample_dependencies),
                "direct_dependencies": 5,
                "transitive_dependencies": 0,
                "progress": 0.5,
            },
            "metadata": {
                "service": "dependency_service",
                "method": "extract_dependencies",
                "discovered_at": datetime.utcnow().isoformat(),
            },
        }

        await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=discovery_state
        )

        # Add workflow events
        await state_manager.add_workflow_event(
            workflow_id=workflow_id,
            event_type="DEPENDENCY_DISCOVERED",
            event_data={
                "dependency_count": len(sample_dependencies),
                "ecosystem": "npm",
            },
            metadata={"source": "dependency_extraction"},
        )

        await state_manager.add_workflow_event(
            workflow_id=workflow_id,
            event_type="ANALYSIS_STEP_COMPLETED",
            event_data={
                "step": "dependency_discovery",
                "result": "success",
                "dependencies_processed": len(sample_dependencies),
            },
            metadata={"source": "dependency_service"},
        )

        # State 3: Analysis completed
        completion_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "analysis_id": str(analysis_result.id),
            "status": "completed",
            "context": {
                "total_dependencies": len(sample_dependencies),
                "direct_dependencies": 5,
                "transitive_dependencies": 0,
                "analysis_time": 2.5,
                "progress": 1.0,
            },
            "metadata": {
                "service": "dependency_service",
                "method": "analyze_project_dependencies",
                "completed_at": datetime.utcnow().isoformat(),
                "analysis_result_id": str(analysis_result.id),
            },
        }

        final_state = await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=completion_state
        )

        # Verify final state
        retrieved_state = await state_manager.get_workflow_state(workflow_id)
        assert retrieved_state["status"] == "completed"
        assert retrieved_state["context"]["total_dependencies"] == len(
            sample_dependencies
        )
        assert retrieved_state["metadata"]["analysis_result_id"] == str(
            analysis_result.id
        )

        # Verify events were recorded
        events = await state_manager.get_workflow_events(workflow_id)
        assert len(events) == 2
        assert events[0].event_type == "DEPENDENCY_DISCOVERED"
        assert events[1].event_type == "ANALYSIS_STEP_COMPLETED"

    async def test_security_scan_workflow_state_integration(
        self, state_manager, security_service, sample_project, sample_dependencies
    ):
        """Test state management during security scan workflow."""

        # Start security scan
        scan_result = await security_service.scan_project_vulnerabilities(
            project_id=str(sample_project.id),
            include_transitive=True,
            severity_threshold="low",
            scanned_by=uuid4(),
        )

        # Create workflow state for security scan
        workflow_id = str(uuid4())

        # State 1: Scan started
        initial_state = {
            "workflow_type": "security_scan",
            "project_id": str(sample_project.id),
            "scan_id": str(scan_result["scan_id"]),
            "status": "started",
            "context": {
                "include_transitive": True,
                "severity_threshold": "low",
                "dependencies_to_scan": len(sample_dependencies),
                "progress": 0.1,
            },
            "metadata": {
                "service": "security_service",
                "method": "scan_project_vulnerabilities",
                "started_at": datetime.utcnow().isoformat(),
            },
        }

        await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=initial_state
        )

        # Simulate vulnerability findings
        vulnerability_count = 2

        # State 2: Vulnerabilities discovered
        discovery_state = {
            "workflow_type": "security_scan",
            "project_id": str(sample_project.id),
            "scan_id": str(scan_result["scan_id"]),
            "status": "vulnerabilities_found",
            "context": {
                "dependencies_scanned": len(sample_dependencies),
                "vulnerabilities_found": vulnerability_count,
                "critical_vulnerabilities": 0,
                "high_vulnerabilities": 1,
                "progress": 0.7,
            },
            "metadata": {
                "service": "security_service",
                "method": "check_vulnerabilities",
                "discovered_at": datetime.utcnow().isoformat(),
            },
        }

        await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=discovery_state
        )

        # Add vulnerability events
        await state_manager.add_workflow_event(
            workflow_id=workflow_id,
            event_type="VULNERABILITY_DETECTED",
            event_data={
                "vulnerability_count": vulnerability_count,
                "severity_distribution": {"high": 1, "medium": 1},
                "affected_packages": ["test-package-1", "test-package-2"],
            },
            metadata={"source": "nvd_database"},
        )

        # State 3: Scan completed
        completion_state = {
            "workflow_type": "security_scan",
            "project_id": str(sample_project.id),
            "scan_id": str(scan_result["scan_id"]),
            "status": "completed",
            "context": {
                "dependencies_scanned": len(sample_dependencies),
                "vulnerabilities_found": vulnerability_count,
                "scan_duration": 5.2,
                "progress": 1.0,
            },
            "metadata": {
                "service": "security_service",
                "method": "scan_project_vulnerabilities",
                "completed_at": datetime.utcnow().isoformat(),
                "scan_result_id": str(scan_result["scan_id"]),
            },
        }

        final_state = await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=completion_state
        )

        # Verify final state
        retrieved_state = await state_manager.get_workflow_state(workflow_id)
        assert retrieved_state["status"] == "completed"
        assert (
            retrieved_state["context"]["vulnerabilities_found"] == vulnerability_count
        )

    async def test_workflow_locking_integration(
        self, state_manager, workflow_service, sample_project
    ):
        """Test workflow locking mechanism integration."""

        # Start workflow
        workflow_execution = await workflow_service.execute_workflow(
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
            project_id=str(sample_project.id),
            triggered_by=uuid4(),
        )

        workflow_id = str(workflow_execution.id)

        # Acquire lock
        lock_acquired = await state_manager.acquire_workflow_lock(workflow_id)
        assert lock_acquired is True

        # Try to acquire lock again (should fail)
        lock_acquired_again = await state_manager.acquire_workflow_lock(workflow_id)
        assert lock_acquired_again is False

        # Save state while lock is held
        state_data = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "status": "processing",
            "context": {"step": "locked_processing"},
            "metadata": {"locked": True},
        }

        state = await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=state_data
        )

        assert state.workflow_id == workflow_id

        # Release lock
        await state_manager.release_workflow_lock(workflow_id)

        # Try to acquire lock again (should succeed)
        lock_acquired_third = await state_manager.acquire_workflow_lock(workflow_id)
        assert lock_acquired_third is True

        # Clean up
        await state_manager.release_workflow_lock(workflow_id)

    async def test_workflow_error_recovery_integration(
        self, state_manager, workflow_service, sample_project
    ):
        """Test workflow error recovery integration."""

        # Start workflow
        workflow_execution = await workflow_service.execute_workflow(
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
            project_id=str(sample_project.id),
            triggered_by=uuid4(),
        )

        workflow_id = str(workflow_execution.id)

        # Create initial state
        initial_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "status": "processing",
            "context": {"step": "dependency_resolution"},
            "metadata": {"attempt": 1},
        }

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
                "error_message": "Failed to resolve package dependencies",
                "step": "dependency_resolution",
            },
            metadata={"retry_count": 1},
        )

        # Save error state
        error_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "status": "error",
            "context": {
                "step": "dependency_resolution",
                "error": "NetworkTimeout",
                "retry_count": 1,
            },
            "metadata": {
                "last_error": "Failed to resolve package dependencies",
                "failed_at": datetime.utcnow().isoformat(),
            },
        }

        await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=error_state
        )

        # Test recovery from checkpoint
        recovered_state = await state_manager.restore_checkpoint(
            workflow_id=workflow_id
        )

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

        # Resume workflow with recovered state
        resumed_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "status": "resumed",
            "context": {
                "step": "dependency_resolution",
                "progress": 0.5,
                "packages_processed": 10,
                "retry_count": 2,
            },
            "metadata": {
                "recovered_at": datetime.utcnow().isoformat(),
                "recovery_method": "checkpoint_restoration",
            },
        }

        await state_manager.save_workflow_state(
            workflow_id=workflow_id, state=resumed_state
        )

        # Verify recovery
        final_state = await state_manager.get_workflow_state(workflow_id)
        assert final_state["status"] == "resumed"
        assert final_state["context"]["retry_count"] == 2

        # Verify events were recorded
        events = await state_manager.get_workflow_events(workflow_id)
        assert len(events) == 2
        assert events[0].event_type == "WORKFLOW_ERROR"
        assert events[1].event_type == "WORKFLOW_RECOVERED"

    async def test_workflow_state_cleanup_integration(
        self, state_manager, workflow_service, sample_project
    ):
        """Test workflow state cleanup integration."""

        # Create multiple workflow executions
        workflow_ids = []

        for i in range(3):
            workflow_execution = await workflow_service.execute_workflow(
                workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
                project_id=str(sample_project.id),
                triggered_by=uuid4(),
            )

            workflow_ids.append(str(workflow_execution.id))

            # Create state for each workflow
            state_data = {
                "workflow_type": "dependency_analysis",
                "project_id": str(sample_project.id),
                "status": "completed" if i < 2 else "active",
                "context": {"workflow_index": i},
                "metadata": {"created_at": datetime.utcnow().isoformat()},
            }

            await state_manager.save_workflow_state(
                workflow_id=workflow_ids[i], state=state_data
            )

        # Create expired states for cleanup testing
        expired_workflow_id = str(uuid4())
        expired_state = {
            "workflow_type": "dependency_analysis",
            "project_id": str(sample_project.id),
            "status": "completed",
            "context": {"expired": True},
            "metadata": {
                "created_at": (datetime.utcnow() - timedelta(days=100)).isoformat()
            },
        }

        # Manually create expired state in database
        expired_model = WorkflowStateModel(
            workflow_id=expired_workflow_id,
            state_data=expired_state,
            status=WorkflowStateStatus.ACTIVE,
            created_at=datetime.utcnow() - timedelta(days=100),
            updated_at=datetime.utcnow() - timedelta(days=95),
        )

        state_manager.db_session.add(expired_model)
        await state_manager.db_session.commit()

        # Test cleanup
        deleted_count = await state_manager.cleanup_expired_states()
        assert deleted_count >= 1

        # Verify expired state was archived
        expired_check = await state_manager.db_session.execute(
            select(WorkflowStateModel).where(
                WorkflowStateModel.workflow_id == expired_workflow_id
            )
        )
        archived_state = expired_check.scalar_one_or_none()

        assert archived_state is not None
        assert archived_state.status == WorkflowStateStatus.ARCHIVED

    async def test_workflow_state_metrics_integration(
        self, state_manager, workflow_service, sample_project
    ):
        """Test workflow state metrics collection integration."""

        # Start workflow
        workflow_execution = await workflow_service.execute_workflow(
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
            project_id=str(sample_project.id),
            triggered_by=uuid4(),
        )

        workflow_id = str(workflow_execution.id)

        # Create multiple states and events
        for i in range(5):
            state_data = {
                "workflow_type": "dependency_analysis",
                "project_id": str(sample_project.id),
                "status": f"step_{i}",
                "context": {"progress": i * 0.2},
                "metadata": {"step_index": i},
            }

            await state_manager.save_workflow_state(
                workflow_id=workflow_id, state=state_data
            )

            await state_manager.add_workflow_event(
                workflow_id=workflow_id,
                event_type=f"STEP_{i}_COMPLETED",
                event_data={"step": i, "progress": i * 0.2},
                metadata={"sequence": i},
            )

        # Get metrics
        metrics = await state_manager.get_workflow_state_metrics(workflow_id)

        assert "storage_backend" in metrics
        assert "compression_enabled" in metrics
        assert "cache_hit" in metrics
        assert "database_access" in metrics

        # Get workflow statistics
        stats = await state_manager.get_workflow_state_statistics()

        assert "active" in stats
        assert "completed" in stats
        assert "failed" in stats
        assert "archived" in stats

        # Get audit trail
        audit_trail = await state_manager.get_workflow_state_audit_trail(workflow_id)

        assert len(audit_trail) == 5
        for i, event in enumerate(audit_trail):
            assert event.event_type == f"STEP_{i}_COMPLETED"
            assert event.sequence_number == i + 1

    async def test_concurrent_workflow_state_management(
        self, state_manager, workflow_service, sample_project
    ):
        """Test concurrent workflow state management."""

        # Create multiple workflow executions
        workflow_executions = []

        for i in range(3):
            workflow_execution = await workflow_service.execute_workflow(
                workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
                project_id=str(sample_project.id),
                triggered_by=uuid4(),
            )
            workflow_executions.append(workflow_execution)

        # Simultaneously update states for all workflows
        async def update_workflow_state(workflow_exec, index):
            workflow_id = str(workflow_exec.id)

            # Acquire lock
            if await state_manager.acquire_workflow_lock(workflow_id):
                try:
                    # Update state
                    state_data = {
                        "workflow_type": "dependency_analysis",
                        "project_id": str(sample_project.id),
                        "status": f"concurrent_step_{index}",
                        "context": {"worker_index": index},
                        "metadata": {"concurrent": True},
                    }

                    await state_manager.save_workflow_state(
                        workflow_id=workflow_id, state=state_data
                    )

                    # Add event
                    await state_manager.add_workflow_event(
                        workflow_id=workflow_id,
                        event_type="CONCURRENT_UPDATE",
                        event_data={"worker_index": index},
                        metadata={"concurrent": True},
                    )

                finally:
                    # Release lock
                    await state_manager.release_workflow_lock(workflow_id)

        # Run concurrent updates
        tasks = [
            update_workflow_state(workflow_exec, i)
            for i, workflow_exec in enumerate(workflow_executions)
        ]

        await asyncio.gather(*tasks)

        # Verify all workflows were updated
        for i, workflow_exec in enumerate(workflow_executions):
            workflow_id = str(workflow_exec.id)

            retrieved_state = await state_manager.get_workflow_state(workflow_id)
            assert retrieved_state["status"] == f"concurrent_step_{i}"
            assert retrieved_state["context"]["worker_index"] == i

            events = await state_manager.get_workflow_events(workflow_id)
            assert len(events) == 1
            assert events[0].event_type == "CONCURRENT_UPDATE"
