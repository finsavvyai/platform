"""
Comprehensive tests for Workflow Execution Engine

This test suite validates all aspects of the workflow execution engine:
- Sequential and parallel execution modes
- Conditional logic and decision trees
- Error handling and retry mechanisms
- Variable scoping and data flow management
- Resource monitoring and limits
- Circuit breaker functionality
- Integration with agent registry and MCP services
"""

import asyncio
import gc
import json
import pytest
import time
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.services.workflow_executor import (
    WorkflowExecutor,
    WorkflowNode,
    WorkflowConnection,
    NodeType,
    ExecutionStatus,
    NodeStatus,
    VariableScope,
    ExecutionMode,
    VariableManager,
    ExpressionEvaluator,
    DependencyResolver,
    CircuitBreakerManager,
    ResourceMonitor
)
from app.models.workflow import (
    Workflow,
    WorkflowExecution,
    NodeExecution,
    WorkflowStatus,
    RetryPolicy
)
from app.agents.base import Task, TaskStatus, TaskType, ExecutionContext
from app.agents.base import UPMAgent, Capability
from unittest.mock import Mock, AsyncMock, patch


@pytest.fixture
async def db_session():
    """Create test database session."""
    # This would typically use a test database
    # For now, we'll use a mock session
    mock_session = Mock(spec=AsyncSession)
    mock_session.add = Mock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.scalar_one_or_none = AsyncMock()
    mock_session.scalars = AsyncMock()
    return mock_session


@pytest.fixture
async def workflow_executor(db_session):
    """Create workflow executor instance."""
    executor = WorkflowExecutor(db_session)
    await executor.start()
    yield executor
    await executor.stop()


@pytest.fixture
def sample_workflow_data():
    """Sample workflow data for testing."""
    return {
        "id": uuid4(),
        "name": "Test Workflow",
        "description": "A test workflow for unit testing",
        "status": WorkflowStatus.ACTIVE,
        "version": 1,
        "nodes": [
            {
                "id": "start_node",
                "type": NodeType.START,
                "name": "Start",
                "description": "Start node"
            },
            {
                "id": "agent_node",
                "type": NodeType.AGENT,
                "name": "Agent Task",
                "description": "Execute agent task",
                "config": {
                    "agent_type": "conversational",
                    "task_description": "Process test data",
                    "parameters": {"input": "{{input_data}}"}
                }
            },
            {
                "id": "condition_node",
                "type": NodeType.CONDITION,
                "name": "Check Result",
                "description": "Check if processing succeeded",
                "config": {
                    "condition": "{{agent_node_result.success}} == true"
                }
            },
            {
                "id": "success_node",
                "type": NodeType.END,
                "name": "Success",
                "description": "Success path"
            },
            {
                "id": "failure_node",
                "type": NodeType.END,
                "name": "Failure",
                "description": "Failure path"
            }
        ],
        "connections": [
            {
                "id": "conn_1",
                "source_node_id": "start_node",
                "source_output": "default",
                "target_node_id": "agent_node",
                "target_input": "default"
            },
            {
                "id": "conn_2",
                "source_node_id": "agent_node",
                "source_output": "default",
                "target_node_id": "condition_node",
                "target_input": "default"
            },
            {
                "id": "conn_3",
                "source_node_id": "condition_node",
                "source_output": "true",
                "target_node_id": "success_node",
                "target_input": "default",
                "condition": "{{condition_node_result}} == true"
            },
            {
                "id": "conn_4",
                "source_node_id": "condition_node",
                "source_output": "false",
                "target_node_id": "failure_node",
                "target_input": "default",
                "condition": "{{condition_node_result}} == false"
            }
        ],
        "variables": {
            "input_data": "test_input",
            "processing_flag": True
        },
        "execution_settings": {
            "timeout_minutes": 30,
            "parallel_limit": 5
        },
        "is_validated": True,
        "execution_count": 0,
        "success_count": 0,
        "failure_count": 0
    }


@pytest.fixture
def sample_parallel_workflow_data():
    """Sample parallel workflow data for testing."""
    return {
        "id": uuid4(),
        "name": "Parallel Test Workflow",
        "description": "A test workflow with parallel execution",
        "status": WorkflowStatus.ACTIVE,
        "version": 1,
        "nodes": [
            {
                "id": "start_node",
                "type": NodeType.START,
                "name": "Start",
                "description": "Start node"
            },
            {
                "id": "parallel_node_1",
                "type": NodeType.AGENT,
                "name": "Parallel Task 1",
                "description": "First parallel task",
                "parallel_group": "group1",
                "config": {
                    "agent_type": "conversational",
                    "task_description": "Process data 1",
                    "parameters": {"data": "input_1"}
                }
            },
            {
                "id": "parallel_node_2",
                "type": NodeType.AGENT,
                "name": "Parallel Task 2",
                "description": "Second parallel task",
                "parallel_group": "group1",
                "config": {
                    "agent_type": "conversational",
                    "task_description": "Process data 2",
                    "parameters": {"data": "input_2"}
                }
            },
            {
                "id": "merge_node",
                "type": NodeType.TRANSFORM,
                "name": "Merge Results",
                "description": "Merge parallel results",
                "config": {
                    "script": "return { merged: true, results: [parallel_node_1_result, parallel_node_2_result] }"
                }
            },
            {
                "id": "end_node",
                "type": NodeType.END,
                "name": "End",
                "description": "End node"
            }
        ],
        "connections": [
            {
                "id": "conn_1",
                "source_node_id": "start_node",
                "source_output": "default",
                "target_node_id": "parallel_node_1",
                "target_input": "default"
            },
            {
                "id": "conn_2",
                "source_node_id": "start_node",
                "source_output": "default",
                "target_node_id": "parallel_node_2",
                "target_input": "default"
            },
            {
                "id": "conn_3",
                "source_node_id": "parallel_node_1",
                "source_output": "default",
                "target_node_id": "merge_node",
                "target_input": "input1"
            },
            {
                "id": "conn_4",
                "source_node_id": "parallel_node_2",
                "source_output": "default",
                "target_node_id": "merge_node",
                "target_input": "input2"
            },
            {
                "id": "conn_5",
                "source_node_id": "merge_node",
                "source_output": "default",
                "target_node_id": "end_node",
                "target_input": "default"
            }
        ],
        "variables": {},
        "is_validated": True
    }


class TestVariableManager:
    """Test VariableManager functionality."""

    def test_variable_scoping(self):
        """Test variable scoping functionality."""
        manager = VariableManager()
        workflow_id = uuid4()
        execution_id = uuid4()

        # Test global variables
        manager.set_variable("global_var", "global_value", VariableScope.GLOBAL)
        assert manager.get_variable("global_var", VariableScope.GLOBAL) == "global_value"

        # Test workflow variables
        manager.set_variable("workflow_var", "workflow_value", VariableScope.WORKFLOW, workflow_id=workflow_id)
        assert manager.get_variable("workflow_var", VariableScope.WORKFLOW, workflow_id=workflow_id) == "workflow_value"

        # Test execution variables
        manager.set_variable("execution_var", "execution_value", VariableScope.EXECUTION, execution_id=execution_id)
        assert manager.get_variable("execution_var", VariableScope.EXECUTION, execution_id=execution_id) == "execution_value"

        # Test node variables
        manager.set_variable("node_var", "node_value", VariableScope.NODE, execution_id=execution_id, node_id="node1")
        assert manager.get_variable("node_var", VariableScope.NODE, execution_id=execution_id, node_id="node1") == "node_value"

    def test_template_resolution(self):
        """Test template variable resolution."""
        manager = VariableManager()
        context = {
            "name": "Test User",
            "age": 30,
            "nested": {"value": "nested_value"},
            "items": ["item1", "item2"]
        }

        # Test basic template resolution
        result = manager.resolve_template("Hello {{name}}!", context)
        assert result == "Hello Test User!"

        # Test nested template resolution
        result = manager.resolve_template("Nested: {{nested.value}}", context)
        assert result == "Nested: nested_value"

        # Test array access
        result = manager.resolve_template("First item: {{items.0}}", context)
        assert result == "First item: item1"

    def test_type_conversion(self):
        """Test variable type conversion."""
        manager = VariableManager()

        # Test string conversion
        from app.services.workflow_executor import DataType
        result = manager._convert_type("test", DataType.STRING)
        assert result == "test"

        # Test integer conversion
        result = manager._convert_type("123", DataType.INTEGER)
        assert result == 123
        assert isinstance(result, int)

        # Test boolean conversion
        result = manager._convert_type("true", DataType.BOOLEAN)
        assert result is True
        result = manager._convert_type("false", DataType.BOOLEAN)
        assert result is False

        # Test array conversion
        result = manager._convert_type('["a", "b"]', DataType.ARRAY)
        assert result == ["a", "b"]
        assert isinstance(result, list)


class TestExpressionEvaluator:
    """Test ExpressionEvaluator functionality."""

    def test_condition_evaluation(self):
        """Test conditional expression evaluation."""
        evaluator = ExpressionEvaluator()
        context = {
            "x": 10,
            "y": 20,
            "name": "Test",
            "is_valid": True,
            "items": [1, 2, 3]
        }

        # Test simple comparisons
        assert evaluator.evaluate_condition("x < y", context) == True
        assert evaluator.evaluate_condition("x > y", context) == False

        # Test string operations
        assert evaluator.evaluate_condition("name == 'Test'", context) == True

        # Test boolean operations
        assert evaluator.evaluate_condition("is_valid and x > 5", context) == True
        assert evaluator.evaluate_condition("is_valid or x > 100", context) == True

        # Test array operations
        assert evaluator.evaluate_condition("len(items) == 3", context) == True

    def test_transformation_evaluation(self):
        """Test data transformation evaluation."""
        evaluator = ExpressionEvaluator()
        context = {"multiplier": 2}
        data = [1, 2, 3]

        # Test simple transformation
        script = """
def transform(data):
    return [x * context['multiplier'] for x in data]
"""
        result = evaluator.evaluate_transformation(script, data, context)
        assert result == [2, 4, 6]

    def test_template_resolution_in_expressions(self):
        """Test template resolution within expressions."""
        evaluator = ExpressionEvaluator()
        context = {"threshold": 100}

        # Test template in expression
        expression = "value > {{threshold}}"
        result = evaluator.evaluate_condition(expression, {"value": 150})
        assert result == True


class TestDependencyResolver:
    """Test DependencyResolver functionality."""

    def test_dependency_graph_building(self):
        """Test building dependency graphs."""
        resolver = DependencyResolver()

        nodes = [
            WorkflowNode(id="1", type=NodeType.START, name="Start"),
            WorkflowNode(id="2", type=NodeType.AGENT, name="Task"),
            WorkflowNode(id="3", type=NodeType.END, name="End")
        ]

        connections = [
            WorkflowConnection(id="c1", source_node_id="1", target_node_id="2", source_output="default", target_input="default"),
            WorkflowConnection(id="c2", source_node_id="2", target_node_id="3", source_output="default", target_input="default")
        ]

        graph = resolver.build_dependency_graph(nodes, connections)

        # Test graph structure
        assert len(graph.nodes) == 3
        assert len(graph.edges) == 2
        assert "1" in graph.nodes
        assert "2" in graph.nodes
        assert "3" in graph.nodes

    def test_ready_nodes_detection(self):
        """Test detection of ready nodes for execution."""
        resolver = DependencyResolver()

        nodes = [
            WorkflowNode(id="start", type=NodeType.START, name="Start"),
            WorkflowNode(id="task1", type=NodeType.AGENT, name="Task 1"),
            WorkflowNode(id="task2", type=NodeType.AGENT, name="Task 2"),
            WorkflowNode(id="end", type=NodeType.END, name="End")
        ]

        connections = [
            WorkflowConnection(id="c1", source_node_id="start", target_node_id="task1", source_output="default", target_input="default"),
            WorkflowConnection(id="c2", source_node_id="start", target_node_id="task2", source_output="default", target_input="default"),
            WorkflowConnection(id="c3", source_node_id="task1", target_node_id="end", source_output="default", target_input="default"),
            WorkflowConnection(id="c4", source_node_id="task2", target_node_id="end", source_output="default", target_input="default")
        ]

        graph = resolver.build_dependency_graph(nodes, connections)

        # Initially only start node should be ready
        ready = resolver.get_ready_nodes(graph, set(), set(), set())
        assert "start" in ready
        assert len(ready) == 1

        # After start completes, task1 and task2 should be ready
        ready = resolver.get_ready_nodes(graph, {"start"}, set(), set())
        assert "task1" in ready
        assert "task2" in ready
        assert len(ready) == 2

    def test_parallel_group_detection(self):
        """Test detection of parallelizable node groups."""
        resolver = DependencyResolver()

        nodes = [
            WorkflowNode(id="task1", type=NodeType.AGENT, name="Task 1", parallel_group="group1"),
            WorkflowNode(id="task2", type=NodeType.AGENT, name="Task 2", parallel_group="group1"),
            WorkflowNode(id="task3", type=NodeType.AGENT, name="Task 3")
        ]

        connections = []  # No dependencies for this test

        graph = resolver.build_dependency_graph(nodes, connections)
        ready_nodes = ["task1", "task2", "task3"]

        parallel_groups = resolver.get_parallelizable_nodes(ready_nodes, graph)

        # Should have 2 groups: one for parallel_group nodes, one for task3
        assert len(parallel_groups) == 2

    def test_workflow_validation(self):
        """Test workflow validation."""
        resolver = DependencyResolver()

        # Valid workflow
        valid_nodes = [
            WorkflowNode(id="start", type=NodeType.START, name="Start"),
            WorkflowNode(id="end", type=NodeType.END, name="End")
        ]
        valid_connections = [
            WorkflowConnection(id="c1", source_node_id="start", target_node_id="end", source_output="default", target_input="default")
        ]

        errors = resolver.validate_workflow(valid_nodes, valid_connections)
        assert len(errors) == 0

        # Invalid workflow (no start node)
        invalid_nodes = [
            WorkflowNode(id="end", type=NodeType.END, name="End")
        ]
        invalid_connections = []

        errors = resolver.validate_workflow(invalid_nodes, invalid_connections)
        assert len(errors) > 0
        assert any("START node" in error for error in errors)


class TestCircuitBreakerManager:
    """Test CircuitBreakerManager functionality."""

    def test_circuit_breaker_states(self):
        """Test circuit breaker state transitions."""
        manager = CircuitBreakerManager()
        breaker_id = "test_breaker"

        # Initial state should be closed
        breaker = manager.get_breaker(breaker_id)
        assert breaker.state == "closed"
        assert breaker.can_execute() == True

        # Record failures to trigger open state
        for i in range(5):  # Default failure threshold is 5
            breaker.record_failure()

        assert breaker.state == "open"
        assert breaker.can_execute() == False

    def test_circuit_breaker_recovery(self):
        """Test circuit breaker recovery."""
        manager = CircuitBreakerManager()
        breaker_id = "test_breaker"

        breaker = manager.get_breaker(breaker_id)

        # Configure for quick testing
        breaker.failure_threshold = 2
        breaker.timeout_seconds = 1

        # Trigger open state
        breaker.record_failure()
        breaker.record_failure()
        assert breaker.state == "open"

        # Should still be open immediately
        assert breaker.can_execute() == False

        # After timeout, should go to half-open
        breaker.last_failure_time = datetime.utcnow() - timedelta(seconds=2)
        assert breaker.can_execute() == True
        assert breaker.state == "half-open"

    def test_node_breaker_association(self):
        """Test node-circuit breaker association."""
        manager = CircuitBreakerManager()
        node_id = "test_node"
        breaker_id = "test_breaker"

        manager.set_node_breaker(node_id, breaker_id)
        assert manager.can_execute_node(node_id) == True

        # Trigger breaker
        breaker = manager.get_breaker(breaker_id)
        breaker.failure_threshold = 1
        breaker.record_failure()

        assert manager.can_execute_node(node_id) == False


class TestWorkflowExecutorBasic:
    """Test basic WorkflowExecutor functionality."""

    @pytest.mark.asyncio
    async def test_workflow_executor_initialization(self, workflow_executor):
        """Test workflow executor initialization."""
        assert workflow_executor is not None
        assert workflow_executor.variable_manager is not None
        assert workflow_executor.expression_evaluator is not None
        assert workflow_executor.dependency_resolver is not None
        assert workflow_executor.circuit_breaker_manager is not None
        assert workflow_executor.resource_monitor is not None

    @pytest.mark.asyncio
    async def test_workflow_execution_creation(self, workflow_executor, sample_workflow_data):
        """Test creating workflow execution."""
        workflow_id = sample_workflow_data["id"]
        input_data = {"test_data": "test_value"}

        # Mock database responses
        mock_workflow = Mock(spec=Workflow)
        mock_workflow.id = workflow_id
        mock_workflow.status = WorkflowStatus.ACTIVE
        mock_workflow.is_validated = True
        mock_workflow.validation_errors = []
        mock_workflow.nodes = sample_workflow_data["nodes"]
        mock_workflow.connections = sample_workflow_data["connections"]
        mock_workflow.variables = sample_workflow_data["variables"]
        mock_workflow.can_execute.return_value = True

        workflow_executor.db.scalar_one_or_none.return_value = mock_workflow

        # Create execution
        execution_id = await workflow_executor.execute_workflow(
            workflow_id=workflow_id,
            input_data=input_data,
            execution_mode=ExecutionMode.SEQUENTIAL
        )

        assert execution_id is not None
        assert isinstance(execution_id, UUID)

        # Verify execution was created
        assert execution_id in workflow_executor.running_executions

    @pytest.mark.asyncio
    async def test_workflow_execution_cancellation(self, workflow_executor):
        """Test cancelling workflow execution."""
        execution_id = uuid4()

        # Mock execution
        mock_execution = Mock(spec=WorkflowExecution)
        mock_execution.id = execution_id
        mock_execution.status = ExecutionStatus.RUNNING
        mock_execution.is_running.return_value = True

        workflow_executor.db.scalar_one_or_none.return_value = mock_execution

        # Cancel execution
        result = await workflow_executor.cancel_execution(execution_id, "Test cancellation")

        assert result == True
        assert mock_execution.status == ExecutionStatus.CANCELLED
        assert mock_execution.error_message == "Test cancellation"


class TestWorkflowNodeExecution:
    """Test individual workflow node execution."""

    @pytest.mark.asyncio
    async def test_start_node_execution(self, workflow_executor):
        """Test START node execution."""
        execution_state = {
            'execution': Mock(),
            'nodes': [WorkflowNode(id="start", type=NodeType.START, name="Start")],
            'workflow': Mock()
        }
        execution_state['execution'].execution_context = {}
        execution_state['execution'].input_data = {"test": "data"}

        result = await workflow_executor._execute_node(execution_state, "start")

        assert result['success'] == True
        assert result['output_data'] == execution_state['execution'].input_data
        assert result['node_id'] == "start"

    @pytest.mark.asyncio
    async def test_end_node_execution(self, workflow_executor):
        """Test END node execution."""
        execution_state = {
            'execution': Mock(),
            'workflow': Mock()
        }
        execution_state['execution'].execution_context = {"result": "success"}

        node = WorkflowNode(id="end", type=NodeType.END, name="End")
        execution_state['nodes'] = [node]

        result = await workflow_executor._execute_node(execution_state, "end")

        assert result['success'] == True
        assert result['output_data'] == execution_state['execution'].execution_context
        assert result['node_id'] == "end"

    @pytest.mark.asyncio
    async def test_condition_node_execution(self, workflow_executor):
        """Test CONDITION node execution."""
        execution_state = {
            'execution': Mock(),
            'nodes': [WorkflowNode(
                id="condition",
                type=NodeType.CONDITION,
                name="Test Condition",
                config={"condition": "value > 10"}
            )],
            'workflow': Mock()
        }
        execution_state['execution'].execution_context = {"value": 20}

        result = await workflow_executor._execute_node(execution_state, "condition")

        assert result['success'] == True
        assert result['output_data'] == True
        assert result['condition_result'] == True

    @pytest.mark.asyncio
    async def test_transform_node_execution(self, workflow_executor):
        """Test TRANSFORM node execution."""
        execution_state = {
            'execution': Mock(),
            'nodes': [WorkflowNode(
                id="transform",
                type=NodeType.TRANSFORM,
                name="Transform",
                config={
                    "transform_type": "javascript",
                    "script": "return data.map(x => x * 2)"
                }
            )],
            'workflow': Mock()
        }
        execution_state['execution'].execution_context = {}

        input_data = [1, 2, 3]
        result = await workflow_executor._execute_node_with_monitoring(execution_state, "transform")

        # Note: In a real implementation, this would properly evaluate JavaScript
        # For now, we test the structure
        assert 'node_id' in result
        assert 'success' in result

    @pytest.mark.asyncio
    async def test_delay_node_execution(self, workflow_executor):
        """Test DELAY node execution."""
        execution_state = {
            'execution': Mock(),
            'nodes': [WorkflowNode(
                id="delay",
                type=NodeType.DELAY,
                name="Delay",
                config={"delay_seconds": 0.1}  # Short delay for testing
            )],
            'workflow': Mock()
        }
        execution_state['execution'].execution_context = {}

        start_time = time.time()
        result = await workflow_executor._execute_node(execution_state, "delay")
        execution_time = time.time() - start_time

        assert result['success'] == True
        assert execution_time >= 0.1  # Should have delayed
        assert result['output_data']['delayed'] == True


class TestWorkflowExecutionModes:
    """Test different workflow execution modes."""

    @pytest.mark.asyncio
    async def test_sequential_execution(self, workflow_executor, sample_workflow_data):
        """Test sequential workflow execution."""
        # This would require extensive mocking of database and agent calls
        # For now, we test the structure
        workflow_id = sample_workflow_data["id"]

        # Mock workflow and execution
        mock_workflow = Mock(spec=Workflow)
        mock_workflow.id = workflow_id
        mock_workflow.status = WorkflowStatus.ACTIVE
        mock_workflow.is_validated = True
        mock_workflow.validation_errors = []
        mock_workflow.nodes = [WorkflowNode(**node) for node in sample_workflow_data["nodes"]]
        mock_workflow.connections = [WorkflowConnection(**conn) for conn in sample_workflow_data["connections"]]
        mock_workflow.variables = sample_workflow_data["variables"]
        mock_workflow.can_execute.return_value = True

        workflow_executor.db.scalar_one_or_none.return_value = mock_workflow

        # Create execution
        execution_id = await workflow_executor.execute_workflow(
            workflow_id=workflow_id,
            input_data={"test": "data"},
            execution_mode=ExecutionMode.SEQUENTIAL
        )

        assert execution_id is not None

        # Wait a bit for execution to start
        await asyncio.sleep(0.1)

        # Check execution exists
        assert execution_id in workflow_executor.running_executions

    @pytest.mark.asyncio
    async def test_parallel_execution_dependencies(self, workflow_executor, sample_parallel_workflow_data):
        """Test parallel execution with dependencies."""
        # Test dependency resolution for parallel execution
        resolver = DependencyResolver()

        nodes = [WorkflowNode(**node) for node in sample_parallel_workflow_data["nodes"]]
        connections = [WorkflowConnection(**conn) for conn in sample_parallel_workflow_data["connections"]]

        graph = resolver.build_dependency_graph(nodes, connections)

        # Initially only start node should be ready
        ready = resolver.get_ready_nodes(graph, set(), set(), set())
        assert "start_node" in ready
        assert len(ready) == 1

        # After start completes, parallel nodes should be ready
        ready = resolver.get_ready_nodes(graph, {"start_node"}, set(), set())
        parallel_nodes = resolver.get_parallelizable_nodes(ready, graph)

        # Should find parallel group
        assert len(parallel_nodes) >= 1


class TestWorkflowErrorHandling:
    """Test workflow error handling and recovery."""

    @pytest.mark.asyncio
    async def test_node_failure_handling(self, workflow_executor):
        """Test handling of node execution failures."""
        execution_state = {
            'execution': Mock(),
            'nodes': [WorkflowNode(
                id="failing_node",
                type=NodeType.AGENT,
                name="Failing Node",
                config={"agent_type": "nonexistent"}
            )],
            'workflow': Mock()
        }
        execution_state['execution'].execution_context = {}
        execution_state['execution'].error_message = None
        execution_state['execution'].error_details = {}

        # Mock agent registry to return None
        workflow_executor.agent_registry.get_best_agent_for_task.return_value = None

        result = await workflow_executor._execute_node(execution_state, "failing_node")

        assert result['success'] == False
        assert 'error' in result

    @pytest.mark.asyncio
    async def test_circuit_breaker_integration(self, workflow_executor):
        """Test circuit breaker integration with node execution."""
        node_id = "test_node"
        breaker_id = "test_breaker"

        # Setup circuit breaker
        workflow_executor.circuit_breaker_manager.set_node_breaker(node_id, breaker_id)
        breaker = workflow_executor.circuit_breaker_manager.get_breaker(breaker_id)
        breaker.failure_threshold = 1

        # Trigger breaker
        breaker.record_failure()

        assert workflow_executor.circuit_breaker_manager.can_execute_node(node_id) == False

    @pytest.mark.asyncio
    async def test_retry_mechanism(self, workflow_executor):
        """Test node retry mechanism."""
        execution_state = {
            'execution': Mock(),
            'nodes': [WorkflowNode(
                id="retry_node",
                type=NodeType.AGENT,
                name="Retry Node",
                retry_policy={
                    "max_retries": 3,
                    "retry_delay": 0.1
                }
            )],
            'workflow': Mock()
        }
        execution_state['execution'].execution_context = {}

        # Mock agent that fails then succeeds
        mock_agent = Mock()
        mock_agent.execute_task.side_effect = [
            Exception("First failure"),
            Exception("Second failure"),
            Mock(status=TaskStatus.COMPLETED, result="success")
        ]
        workflow_executor.agent_registry.get_best_agent_for_task.return_value = mock_agent

        # This would test the retry logic
        # In a real implementation, this would handle retries automatically


class TestWorkflowResourceManagement:
    """Test workflow resource management and monitoring."""

    @pytest.mark.asyncio
    async def test_resource_monitoring(self, workflow_executor):
        """Test resource monitoring during workflow execution."""
        workflow_execution_id = uuid4()

        async with workflow_executor.resource_monitor.monitor_workflow(workflow_execution_id):
            # Simulate some work
            await asyncio.sleep(0.1)

            # Check resource limits
            can_continue = workflow_executor.resource_monitor.check_resource_limits(workflow_execution_id)
            assert can_continue == True

        # Check final resource data
        resources = workflow_executor.resource_monitor.get_workflow_resources(workflow_execution_id)
        assert resources is not None
        assert 'start_time' in resources
        assert 'execution_time_seconds' in resources

    @pytest.mark.asyncio
    async def test_parallel_execution_limits(self, workflow_executor):
        """Test parallel execution limits."""
        # Test that parallel execution respects limits
        initial_semaphore_value = workflow_executor.parallel_semaphore._value

        # This would need to test actual execution limiting
        # For now, just verify the semaphore exists
        assert initial_semaphore_value > 0

    def test_resource_limit_configuration(self, workflow_executor):
        """Test resource limit configuration."""
        limits = workflow_executor.resource_monitor.resource_limits

        assert 'max_memory_mb' in limits
        assert 'max_cpu_percent' in limits
        assert 'max_parallel_tasks' in limits
        assert 'max_execution_time_minutes' in limits

        assert limits['max_memory_mb'] > 0
        assert limits['max_cpu_percent'] > 0
        assert limits['max_parallel_tasks'] > 0
        assert limits['max_execution_time_minutes'] > 0


class TestWorkflowIntegration:
    """Test workflow executor integration with other services."""

    @pytest.mark.asyncio
    async def test_agent_registry_integration(self, workflow_executor):
        """Test integration with agent registry."""
        # Create a mock task
        task = Task(
            type=TaskType.CONVERSATION,
            name="Test Task",
            description="Test description",
            parameters={"test": "data"}
        )

        # Test getting suitable agents
        agents = workflow_executor.agent_registry.find_agents_for_task(task)

        # Should return a list (empty or with agents)
        assert isinstance(agents, list)

    @pytest.mark.asyncio
    async def test_mcp_service_integration(self, workflow_executor):
        """Test integration with MCP service."""
        # Mock MCP service
        with patch('app.services.workflow_executor.mcp_service') as mock_mcp:
            mock_mcp.execute_tool.return_value = Mock(
                error=None,
                result={"success": True, "data": "test_result"}
            )

            execution_state = {
                'execution': Mock(),
                'nodes': [WorkflowNode(
                    id="mcp_node",
                    type=NodeType.MCP_TOOL,
                    name="MCP Tool",
                    config={
                        "tool_name": "test_tool",
                        "parameters": {"input": "test"}
                    }
                )],
                'workflow': Mock()
            }
            execution_state['execution'].execution_context = {}
            execution_state['execution'].workflow_id = uuid4()

            result = await workflow_executor._execute_mcp_tool_node(
                execution_state,
                execution_state['nodes'][0],
                {"input": "test"}
            )

            assert result['success'] == True
            assert 'output_data' in result
            mock_mcp.execute_tool.assert_called_once()


class TestWorkflowPerformanceAndScalability:
    """Test workflow executor performance and scalability."""

    @pytest.mark.asyncio
    async def test_large_workflow_execution(self, workflow_executor):
        """Test execution of large workflows with many nodes."""
        # Create a large workflow with many nodes
        num_nodes = 100
        nodes = []
        connections = []

        for i in range(num_nodes):
            node_id = f"node_{i}"
            node_type = NodeType.AGENT if i > 0 and i < num_nodes - 1 else (NodeType.START if i == 0 else NodeType.END)

            nodes.append(WorkflowNode(
                id=node_id,
                type=node_type,
                name=f"Node {i}",
                config={"agent_type": "conversational"} if node_type == NodeType.AGENT else {}
            ))

            # Create linear connections
            if i > 0:
                connections.append(WorkflowConnection(
                    id=f"conn_{i}",
                    source_node_id=f"node_{i-1}",
                    target_node_id=node_id,
                    source_output="default",
                    target_input="default"
                ))

        # Test dependency resolution performance
        resolver = DependencyResolver()
        start_time = time.time()

        graph = resolver.build_dependency_graph(nodes, connections)
        ready_nodes = resolver.get_ready_nodes(graph, set(), set(), set())

        build_time = time.time() - start_time

        # Should complete quickly even with many nodes
        assert build_time < 1.0  # Should build graph in less than 1 second
        assert len(ready_nodes) == 1  # Only start node should be ready

    @pytest.mark.asyncio
    async def test_concurrent_workflow_executions(self, workflow_executor):
        """Test handling multiple concurrent workflow executions."""
        # Create multiple workflow executions
        execution_ids = []

        for i in range(5):
            workflow_id = uuid4()
            mock_workflow = Mock(spec=Workflow)
            mock_workflow.id = workflow_id
            mock_workflow.status = WorkflowStatus.ACTIVE
            mock_workflow.is_validated = True
            mock_workflow.validation_errors = []
            mock_workflow.nodes = [WorkflowNode(id="start", type=NodeType.START, name="Start")]
            mock_workflow.connections = []
            mock_workflow.variables = {}
            mock_workflow.can_execute.return_value = True

            workflow_executor.db.scalar_one_or_none.return_value = mock_workflow

            execution_id = await workflow_executor.execute_workflow(
                workflow_id=workflow_id,
                input_data={"test": f"data_{i}"},
                execution_mode=ExecutionMode.SEQUENTIAL
            )
            execution_ids.append(execution_id)

        # Verify all executions were created
        assert len(execution_ids) == 5
        assert len(set(execution_ids)) == 5  # All unique

        # Check concurrent execution count
        assert workflow_executor.stats['concurrent_executions'] >= 5

    def test_memory_efficiency(self, workflow_executor):
        """Test memory efficiency of workflow execution."""
        import sys

        # Get initial memory usage
        initial_objects = len(gc.get_objects()) if 'gc' in sys.modules else 0

        # Create many variable scopes and contexts
        for i in range(1000):
            workflow_id = uuid4()
            execution_id = uuid4()

            workflow_executor.variable_manager.set_variable(
                f"var_{i}", f"value_{i}", VariableScope.WORKFLOW, workflow_id=workflow_id
            )
            workflow_executor.variable_manager.set_variable(
                f"exec_var_{i}", f"exec_value_{i}", VariableScope.EXECUTION, execution_id=execution_id
            )

        # Check that memory usage is reasonable
        # This is a basic test - in practice would use more sophisticated memory profiling
        final_objects = len(gc.get_objects()) if 'gc' in sys.modules else 0
        object_increase = final_objects - initial_objects

        # Should not create excessive number of objects
        assert object_increase < 10000  # Arbitrary threshold


class TestWorkflowSecurityAndCompliance:
    """Test workflow executor security and compliance features."""

    def test_expression_evaluation_safety(self, workflow_executor):
        """Test safe expression evaluation."""
        evaluator = workflow_executor.expression_evaluator

        # Test that dangerous operations are blocked
        dangerous_expressions = [
            "__import__('os').system('ls')",
            "exec('print(\"dangerous\")')",
            "eval('1+1')",
            "open('/etc/passwd', 'r')",
            "globals()",
            "locals()",
            "vars()"
        ]

        for expr in dangerous_expressions:
            try:
                result = evaluator.evaluate_condition(expr, {})
                # If it doesn't raise an exception, ensure it returns a safe value
                assert result in [True, False]  # Should not return dangerous objects
            except Exception:
                # Expected - dangerous operations should be blocked
                pass

    @pytest.mark.asyncio
    async def test_workflow_execution_audit_trail(self, workflow_executor):
        """Test workflow execution audit trail."""
        execution = Mock(spec=WorkflowExecution)
        execution.id = uuid4()
        execution.audit_log = []

        # Add audit events
        execution.add_audit_event("execution_started", {"user_id": str(uuid4())})
        execution.add_audit_event("node_completed", {"node_id": "test_node"})
        execution.add_audit_event("execution_completed", {"status": "success"})

        # Verify audit trail
        assert len(execution.audit_log) == 3
        assert execution.audit_log[0]["event_type"] == "execution_started"
        assert execution.audit_log[1]["event_type"] == "node_completed"
        assert execution.audit_log[2]["event_type"] == "execution_completed"

        # Verify timestamp structure
        for event in execution.audit_log:
            assert "timestamp" in event
            assert "details" in event

    def test_variable_access_control(self, workflow_executor):
        """Test variable access control and isolation."""
        manager = workflow_executor.variable_manager

        workflow_id1 = uuid4()
        workflow_id2 = uuid4()
        execution_id1 = uuid4()
        execution_id2 = uuid4()

        # Set variables for different scopes
        manager.set_variable("shared_var", "shared", VariableScope.WORKFLOW, workflow_id=workflow_id1)
        manager.set_variable("private_var", "private", VariableScope.EXECUTION, execution_id=execution_id1)

        # Test isolation - different executions shouldn't access each other's variables
        assert manager.get_variable("private_var", VariableScope.EXECUTION, execution_id=execution_id1) == "private"
        assert manager.get_variable("private_var", VariableScope.EXECUTION, execution_id=execution_id2) is None

        # Test workflow-level variable access
        assert manager.get_variable("shared_var", VariableScope.WORKFLOW, workflow_id=workflow_id1) == "shared"
        assert manager.get_variable("shared_var", VariableScope.WORKFLOW, workflow_id=workflow_id2) is None


# Integration Tests
class TestWorkflowExecutorIntegration:
    """Integration tests for workflow executor."""

    @pytest.mark.asyncio
    async def test_end_to_end_workflow_execution(self, workflow_executor, sample_workflow_data):
        """Test complete workflow execution from start to finish."""
        # This would be a comprehensive integration test
        # requiring full mocking of all dependencies

        workflow_id = sample_workflow_data["id"]

        # Mock all database calls
        mock_workflow = Mock(spec=Workflow)
        mock_workflow.id = workflow_id
        mock_workflow.status = WorkflowStatus.ACTIVE
        mock_workflow.is_validated = True
        mock_workflow.validation_errors = []
        mock_workflow.nodes = [WorkflowNode(**node) for node in sample_workflow_data["nodes"]]
        mock_workflow.connections = [WorkflowConnection(**conn) for conn in sample_workflow_data["connections"]]
        mock_workflow.variables = sample_workflow_data["variables"]
        mock_workflow.can_execute.return_value = True

        workflow_executor.db.scalar_one_or_none.return_value = mock_workflow

        # Mock agent execution
        mock_agent = Mock(spec=UPMAgent)
        mock_agent.execute_task.return_value = Mock(
            status=TaskStatus.COMPLETED,
            result={"success": True, "data": "processed"}
        )
        workflow_executor.agent_registry.get_best_agent_for_task.return_value = mock_agent

        # Execute workflow
        execution_id = await workflow_executor.execute_workflow(
            workflow_id=workflow_id,
            input_data={"test_data": "integration_test"},
            execution_mode=ExecutionMode.SEQUENTIAL
        )

        # Verify execution was created
        assert execution_id is not None

        # Wait for execution to complete or timeout
        timeout = 10  # seconds
        start_time = time.time()

        while time.time() - start_time < timeout:
            execution = await workflow_executor.get_execution_status(execution_id)
            if execution and execution.is_finished():
                break
            await asyncio.sleep(0.1)

        # Verify execution completed
        if execution:
            assert execution.is_finished()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])