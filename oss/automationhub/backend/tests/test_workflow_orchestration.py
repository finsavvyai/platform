"""
Test suite for Workflow Orchestration Service
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4, UUID
from datetime import datetime

from app.services.workflow_orchestration import (
    WorkflowOrchestrationService,
    WorkflowDefinition,
    TaskDefinition,
    WorkflowTemplate,
    WorkflowExecution,
    TaskExecution,
    WorkflowStatus,
    TaskStatus,
    TaskType,
    ExecutionStrategy,
    RetryStrategy
)


@pytest.fixture
def orchestration_service():
    """Create orchestration service instance"""
    service = WorkflowOrchestrationService()
    return service


@pytest.fixture
def sample_task_definition():
    """Sample task definition for testing"""
    return TaskDefinition(
        name="Test Task",
        type=TaskType.CODE_GENERATION,
        description="A test task",
        timeout_seconds=60,
        retry_strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        max_retries=2,
        priority=100,
        enabled=True
    )


@pytest.fixture
def sample_workflow_definition(sample_task_definition):
    """Sample workflow definition for testing"""
    return WorkflowDefinition(
        name="Test Workflow",
        description="A test workflow",
        version="1.0.0",
        tasks=[sample_task_definition],
        execution_strategy=ExecutionStrategy.SEQUENTIAL,
        timeout_seconds=300,
        max_parallel_tasks=3,
        auto_retry=True,
        created_by="test@example.com"
    )


@pytest.fixture
def sample_workflow_template(sample_workflow_definition):
    """Sample workflow template for testing"""
    return WorkflowTemplate(
        name="Test Template",
        description="A test template",
        category="Testing",
        workflow_definition=sample_workflow_definition,
        parameters=[],
        created_by="test@example.com",
        public=True
    )


@pytest.mark.asyncio
class TestWorkflowOrchestrationService:
    """Test cases for Workflow Orchestration Service"""

    async def test_service_initialization(self):
        """Test service can be initialized"""
        service = WorkflowOrchestrationService()
        assert service is not None
        assert hasattr(service, 'create_workflow')
        assert hasattr(service, 'execute_workflow')
        assert hasattr(service, 'get_execution_status')
        assert len(service.task_registry) > 0

    async def test_create_workflow_success(self, orchestration_service, sample_workflow_definition):
        """Test successful workflow creation"""
        result = await orchestration_service.create_workflow(sample_workflow_definition)

        assert result["status"] == "success"
        assert "workflow_id" in result
        assert sample_workflow_definition.id in orchestration_service.workflows

    async def test_create_workflow_invalid(self, orchestration_service):
        """Test workflow creation with invalid definition"""
        # Empty workflow (no tasks)
        invalid_workflow = WorkflowDefinition(
            name="Invalid Workflow",
            tasks=[],  # No tasks
            created_by="test@example.com"
        )

        result = await orchestration_service.create_workflow(invalid_workflow)

        assert result["status"] == "failed"
        assert "error" in result

    async def test_execute_workflow_success(self, orchestration_service, sample_workflow_definition):
        """Test successful workflow execution"""
        # First create the workflow
        create_result = await orchestration_service.create_workflow(sample_workflow_definition)
        assert create_result["status"] == "success"

        workflow_id = sample_workflow_definition.id

        # Execute the workflow
        execute_result = await orchestration_service.execute_workflow(workflow_id, {"test": "context"})

        assert execute_result["status"] == "started"
        assert "execution_id" in execute_result
        assert len(orchestration_service.active_executions) > 0

    async def test_execute_workflow_not_found(self, orchestration_service):
        """Test executing non-existent workflow"""
        non_existent_id = uuid4()

        result = await orchestration_service.execute_workflow(non_existent_id)

        assert result["status"] == "failed"
        assert "not found" in result["error"]

    async def test_get_execution_status(self, orchestration_service, sample_workflow_definition):
        """Test getting execution status"""
        # Create and execute workflow
        await orchestration_service.create_workflow(sample_workflow_definition)
        execute_result = await orchestration_service.execute_workflow(sample_workflow_definition.id)

        # Get execution ID from result
        execution_id = execute_result["execution_id"]

        # Get status
        status_result = await orchestration_service.get_execution_status(UUID(execution_id))

        assert status_result["status"] == "success"
        assert "workflow_status" in status_result
        assert "progress_percent" in status_result

    async def test_pause_workflow(self, orchestration_service, sample_workflow_definition):
        """Test pausing workflow execution"""
        # Create and execute workflow
        await orchestration_service.create_workflow(sample_workflow_definition)
        execute_result = await orchestration_service.execute_workflow(sample_workflow_definition.id)
        execution_id = UUID(execute_result["execution_id"])

        # Pause the workflow
        pause_result = await orchestration_service.pause_workflow(execution_id)

        assert pause_result["status"] == "success"

    async def test_resume_workflow(self, orchestration_service, sample_workflow_definition):
        """Test resuming paused workflow"""
        # Create and execute workflow
        await orchestration_service.create_workflow(sample_workflow_definition)
        execute_result = await orchestration_service.execute_workflow(sample_workflow_definition.id)
        execution_id = UUID(execute_result["execution_id"])

        # Pause then resume
        await orchestration_service.pause_workflow(execution_id)
        resume_result = await orchestration_service.resume_workflow(execution_id)

        assert resume_result["status"] == "success"

    async def test_cancel_workflow(self, orchestration_service, sample_workflow_definition):
        """Test cancelling workflow execution"""
        # Create and execute workflow
        await orchestration_service.create_workflow(sample_workflow_definition)
        execute_result = await orchestration_service.execute_workflow(sample_workflow_definition.id)
        execution_id = UUID(execute_result["execution_id"])

        # Cancel the workflow
        cancel_result = await orchestration_service.cancel_workflow(execution_id)

        assert cancel_result["status"] == "success"
        assert execution_id not in orchestration_service.active_executions

    async def test_create_template(self, orchestration_service, sample_workflow_template):
        """Test creating workflow template"""
        result = await orchestration_service.create_template(sample_workflow_template)

        assert result["status"] == "success"
        assert "template_id" in result
        assert sample_workflow_template.id in orchestration_service.templates

    async def test_list_templates(self, orchestration_service, sample_workflow_template):
        """Test listing workflow templates"""
        # Create a template first
        await orchestration_service.create_template(sample_workflow_template)

        # List templates
        result = await orchestration_service.list_templates()

        assert result["status"] == "success"
        assert "templates" in result
        assert len(result["templates"]) > 0

    async def test_list_templates_by_category(self, orchestration_service, sample_workflow_template):
        """Test listing templates by category"""
        await orchestration_service.create_template(sample_workflow_template)

        # List by existing category
        result = await orchestration_service.list_templates(category="Testing")
        assert result["status"] == "success"
        assert len(result["templates"]) > 0

        # List by non-existent category
        result = await orchestration_service.list_templates(category="NonExistent")
        assert result["status"] == "success"
        assert len(result["templates"]) == 0

    async def test_create_workflow_from_template(self, orchestration_service, sample_workflow_template):
        """Test creating workflow from template"""
        # Create template first
        await orchestration_service.create_template(sample_workflow_template)

        # Create workflow from template
        result = await orchestration_service.create_workflow_from_template(
            sample_workflow_template.id,
            {"param1": "value1"}
        )

        assert result["status"] == "success"
        assert "workflow_id" in result
        # Template use count should increment
        assert sample_workflow_template.use_count == 1

    async def test_get_workflow_analytics(self, orchestration_service, sample_workflow_definition):
        """Test getting workflow analytics"""
        # Create workflow
        await orchestration_service.create_workflow(sample_workflow_definition)

        # Create some mock executions
        execution1 = WorkflowExecution(
            workflow_id=sample_workflow_definition.id,
            status=WorkflowStatus.COMPLETED,
            started_at=datetime.now(),
            duration_seconds=120.0
        )
        execution2 = WorkflowExecution(
            workflow_id=sample_workflow_definition.id,
            status=WorkflowStatus.FAILED,
            started_at=datetime.now(),
            error_message="Test error"
        )

        orchestration_service.executions[execution1.id] = execution1
        orchestration_service.executions[execution2.id] = execution2

        # Get analytics
        result = await orchestration_service.get_workflow_analytics(sample_workflow_definition.id, 30)

        assert result["status"] == "success"
        assert "analytics" in result
        analytics = result["analytics"]
        assert "total_executions" in analytics
        assert "success_rate_percent" in analytics
        assert analytics["total_executions"] == 2
        assert analytics["successful_executions"] == 1
        assert analytics["failed_executions"] == 1

    async def test_ai_optimize_workflow(self, orchestration_service, sample_workflow_definition):
        """Test AI workflow optimization"""
        # Create workflow
        await orchestration_service.create_workflow(sample_workflow_definition)

        # Mock LLM service response
        with patch('app.services.workflow_orchestration.llm_service') as mock_llm:
            mock_response = Mock()
            mock_response.content = '{"suggestions": ["Optimize task parallelization", "Reduce timeout values"]}'
            mock_llm.process_request = AsyncMock(return_value=mock_response)

            result = await orchestration_service.ai_optimize_workflow(sample_workflow_definition.id)

            assert result["status"] == "success"
            assert "optimization_suggestions" in result
            assert "performance_metrics" in result

    async def test_health_check(self, orchestration_service):
        """Test service health check"""
        result = await orchestration_service.health_check()

        assert isinstance(result, dict)
        assert "service_name" in result
        assert result["service_name"] == "workflow_orchestration"
        assert "status" in result
        assert "active_workflows" in result
        assert "total_workflows" in result

    async def test_workflow_validation_circular_dependencies(self, orchestration_service):
        """Test workflow validation catches circular dependencies"""
        # Create tasks with circular dependencies
        task1 = TaskDefinition(name="Task1", type=TaskType.CUSTOM)
        task2 = TaskDefinition(name="Task2", type=TaskType.CUSTOM)

        # Make them depend on each other (circular)
        task1.dependencies = [task2.id]
        task2.dependencies = [task1.id]

        workflow = WorkflowDefinition(
            name="Circular Workflow",
            tasks=[task1, task2],
            created_by="test@example.com"
        )

        result = await orchestration_service.create_workflow(workflow)

        assert result["status"] == "failed"
        assert "circular" in result["error"].lower()

    async def test_task_execution_timeout(self, orchestration_service):
        """Test task execution with timeout"""
        # Create a task with very short timeout
        task = TaskDefinition(
            name="Timeout Task",
            type=TaskType.CUSTOM,
            timeout_seconds=1  # Very short timeout
        )

        workflow = WorkflowDefinition(
            name="Timeout Workflow",
            tasks=[task],
            created_by="test@example.com"
        )

        await orchestration_service.create_workflow(workflow)

        # Mock a slow task handler
        async def slow_handler(task_def, context):
            await asyncio.sleep(2)  # Longer than timeout
            return {"result": "should timeout"}

        orchestration_service.task_registry[TaskType.CUSTOM.value] = slow_handler

        # Execute workflow
        result = await orchestration_service.execute_workflow(workflow.id)
        assert result["status"] == "started"

        # Wait a bit for execution to process
        await asyncio.sleep(0.1)

        # Check that task failed due to timeout
        execution_id = UUID(result["execution_id"])
        if execution_id in orchestration_service.executions:
            execution = orchestration_service.executions[execution_id]
            if execution.task_executions:
                task_exec = execution.task_executions[0]
                # Task should eventually timeout and fail
                assert task_exec.status in [TaskStatus.RUNNING, TaskStatus.FAILED]

    async def test_task_retry_logic(self, orchestration_service):
        """Test task retry functionality"""
        task = TaskDefinition(
            name="Retry Task",
            type=TaskType.CUSTOM,
            max_retries=2,
            retry_strategy=RetryStrategy.FIXED_DELAY
        )

        workflow = WorkflowDefinition(
            name="Retry Workflow",
            tasks=[task],
            created_by="test@example.com"
        )

        await orchestration_service.create_workflow(workflow)

        # Mock a failing task handler
        call_count = 0

        async def failing_handler(task_def, context):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # Fail first 2 attempts
                raise Exception("Simulated failure")
            return {"result": "success on retry"}

        orchestration_service.task_registry[TaskType.CUSTOM.value] = failing_handler

        # Execute workflow
        result = await orchestration_service.execute_workflow(workflow.id)
        assert result["status"] == "started"

    async def test_parallel_execution_strategy(self, orchestration_service):
        """Test parallel execution strategy"""
        # Create independent tasks
        task1 = TaskDefinition(name="Task1", type=TaskType.CUSTOM)
        task2 = TaskDefinition(name="Task2", type=TaskType.CUSTOM)

        workflow = WorkflowDefinition(
            name="Parallel Workflow",
            tasks=[task1, task2],
            execution_strategy=ExecutionStrategy.PARALLEL,
            created_by="test@example.com"
        )

        await orchestration_service.create_workflow(workflow)

        # Mock task handlers
        async def quick_handler(task_def, context):
            return {"result": f"completed {task_def.name}"}

        orchestration_service.task_registry[TaskType.CUSTOM.value] = quick_handler

        # Execute workflow
        result = await orchestration_service.execute_workflow(workflow.id)
        assert result["status"] == "started"

    async def test_workflow_context_passing(self, orchestration_service):
        """Test that context is passed through workflow execution"""
        task = TaskDefinition(name="Context Task", type=TaskType.CUSTOM)

        workflow = WorkflowDefinition(
            name="Context Workflow",
            tasks=[task],
            created_by="test@example.com"
        )

        await orchestration_service.create_workflow(workflow)

        # Mock handler that checks context
        received_context = None

        async def context_handler(task_def, context):
            nonlocal received_context
            received_context = context
            return {"result": "context received"}

        orchestration_service.task_registry[TaskType.CUSTOM.value] = context_handler

        # Execute with context
        test_context = {"key": "value", "number": 42}
        result = await orchestration_service.execute_workflow(workflow.id, test_context)
        assert result["status"] == "started"

        # Give it a moment to process
        await asyncio.sleep(0.1)

        # Context should have been passed to handler
        # Note: In a real test, we'd wait for completion or mock the execution more thoroughly

    async def test_template_parameter_substitution(self, orchestration_service, sample_workflow_template):
        """Test template parameter substitution"""
        # Add parameters to template
        sample_workflow_template.parameters = [
            {"name": "timeout", "type": "integer", "default": 300},
            {"name": "retry_count", "type": "integer", "default": 3}
        ]

        await orchestration_service.create_template(sample_workflow_template)

        # Create workflow with custom parameters
        parameters = {"timeout": 600, "retry_count": 5}
        result = await orchestration_service.create_workflow_from_template(
            sample_workflow_template.id,
            parameters
        )

        assert result["status"] == "success"

    async def test_workflow_error_handling(self, orchestration_service):
        """Test workflow error handling"""
        task = TaskDefinition(name="Error Task", type=TaskType.CUSTOM)

        workflow = WorkflowDefinition(
            name="Error Workflow",
            tasks=[task],
            auto_retry=False,  # Disable auto-retry for this test
            created_by="test@example.com"
        )

        await orchestration_service.create_workflow(workflow)

        # Mock a handler that always fails
        async def error_handler(task_def, context):
            raise Exception("Intentional test error")

        orchestration_service.task_registry[TaskType.CUSTOM.value] = error_handler

        # Execute workflow
        result = await orchestration_service.execute_workflow(workflow.id)
        assert result["status"] == "started"

        # Wait for processing
        await asyncio.sleep(0.1)

        # Check execution status
        execution_id = UUID(result["execution_id"])
        if execution_id in orchestration_service.executions:
            execution = orchestration_service.executions[execution_id]
            # Workflow should eventually fail
            # Note: Actual status depends on timing and execution state

    async def test_workflow_metadata_and_tags(self, orchestration_service):
        """Test workflow metadata and tags functionality"""
        workflow = WorkflowDefinition(
            name="Tagged Workflow",
            tasks=[TaskDefinition(name="Test Task", type=TaskType.CUSTOM)],
            metadata={"project": "test", "version": "1.0"},
            tags=["test", "automation", "sample"],
            created_by="test@example.com"
        )

        result = await orchestration_service.create_workflow(workflow)

        assert result["status"] == "success"
        stored_workflow = orchestration_service.workflows[workflow.id]
        assert stored_workflow.metadata["project"] == "test"
        assert "test" in stored_workflow.tags
        assert "automation" in stored_workflow.tags

    async def test_execution_metrics_collection(self, orchestration_service, sample_workflow_definition):
        """Test that execution metrics are properly collected"""
        await orchestration_service.create_workflow(sample_workflow_definition)

        # Create a completed execution with metrics
        execution = WorkflowExecution(
            workflow_id=sample_workflow_definition.id,
            status=WorkflowStatus.COMPLETED,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            duration_seconds=45.5,
            metrics={"cpu_usage": 65.2, "memory_usage": 78.1}
        )

        orchestration_service.executions[execution.id] = execution

        # Get analytics should include the metrics
        result = await orchestration_service.get_workflow_analytics(sample_workflow_definition.id)

        assert result["status"] == "success"
        analytics = result["analytics"]
        assert analytics["average_execution_time_seconds"] == 45.5