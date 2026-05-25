"""
Advanced Workflow Engine for UPM.Plus

Provides visual workflow building, execution, monitoring, and optimization
capabilities with support for MCP tools, agent coordination, and AI-driven
workflow generation.
"""

import asyncio
import json
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
import networkx as nx

from app.services.mcp_integration import mcp_service
from app.services.task_executor import task_executor
from app.services.llm import llm_service
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class NodeType(str, Enum):
    """Workflow node types."""
    START = "start"
    END = "end"
    AGENT = "agent"
    MCP_TOOL = "mcp_tool"
    CONDITION = "condition"
    LOOP = "loop"
    PARALLEL = "parallel"
    HUMAN_INPUT = "human_input"
    DELAY = "delay"
    HTTP_REQUEST = "http_request"
    TRANSFORM = "transform"
    TRIGGER = "trigger"


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    DRAFT = "draft"
    ACTIVE = "active"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NodeStatus(str, Enum):
    """Node execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ConnectionPoint(BaseModel):
    """Workflow node connection point."""
    id: str
    name: str
    type: str = "default"  # success, error, condition
    label: Optional[str] = None


class WorkflowNode(BaseModel):
    """Workflow node definition."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: NodeType
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    position: Dict[str, float] = Field(default_factory=dict)  # x, y coordinates
    inputs: List[ConnectionPoint] = Field(default_factory=list)
    outputs: List[ConnectionPoint] = Field(default_factory=list)
    status: NodeStatus = NodeStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class WorkflowConnection(BaseModel):
    """Connection between workflow nodes."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    source_node_id: str
    source_output: str
    target_node_id: str
    target_input: str
    condition: Optional[str] = None  # JavaScript-like condition
    label: Optional[str] = None


class WorkflowDefinition(BaseModel):
    """Complete workflow definition."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    version: int = 1
    nodes: List[WorkflowNode] = Field(default_factory=list)
    connections: List[WorkflowConnection] = Field(default_factory=list)
    variables: Dict[str, Any] = Field(default_factory=dict)
    triggers: List[Dict[str, Any]] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)
    created_by: Optional[UUID] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WorkflowExecution(BaseModel):
    """Workflow execution instance."""
    id: UUID = Field(default_factory=uuid4)
    workflow_id: UUID
    workflow_version: int
    status: WorkflowStatus = WorkflowStatus.RUNNING
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Optional[Dict[str, Any]] = None
    current_nodes: List[str] = Field(default_factory=list)
    completed_nodes: List[str] = Field(default_factory=list)
    failed_nodes: List[str] = Field(default_factory=list)
    execution_context: Dict[str, Any] = Field(default_factory=dict)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    started_by: Optional[UUID] = None
    error: Optional[str] = None


class WorkflowEngine:
    """
    Advanced workflow execution engine with visual workflow support.

    Features:
    - Visual workflow builder support
    - AI-driven workflow generation
    - MCP tool integration
    - Multi-agent coordination
    - Real-time execution monitoring
    - Human-in-the-loop workflows
    - Conditional logic and loops
    - Parallel execution
    """

    def __init__(self):
        self.workflows: Dict[UUID, WorkflowDefinition] = {}
        self.executions: Dict[UUID, WorkflowExecution] = {}
        self.running_executions: set = set()

    async def create_workflow(self, workflow_data: Dict[str, Any]) -> UUID:
        """Create a new workflow definition."""
        try:
            workflow = WorkflowDefinition(**workflow_data)

            # Validate workflow structure
            await self._validate_workflow(workflow)

            # Store workflow
            self.workflows[workflow.id] = workflow

            # Cache in Redis
            await redis_client.set(
                f"workflow:{workflow.id}",
                json.dumps(workflow.dict(), default=str),
                expire=3600 * 24  # 24 hours
            )

            logger.info(f"Created workflow: {workflow.name} ({workflow.id})")
            return workflow.id

        except Exception as e:
            logger.error(f"Failed to create workflow: {e}")
            raise

    async def _validate_workflow(self, workflow: WorkflowDefinition) -> bool:
        """Validate workflow structure and dependencies."""
        # Check for required start and end nodes
        start_nodes = [n for n in workflow.nodes if n.type == NodeType.START]
        end_nodes = [n for n in workflow.nodes if n.type == NodeType.END]

        if not start_nodes:
            raise ValueError("Workflow must have at least one START node")
        if not end_nodes:
            raise ValueError("Workflow must have at least one END node")

        # Build graph and check connectivity
        graph = nx.DiGraph()

        # Add nodes
        for node in workflow.nodes:
            graph.add_node(node.id, node=node)

        # Add edges
        for connection in workflow.connections:
            graph.add_edge(connection.source_node_id, connection.target_node_id)

        # Check if all nodes are reachable from start nodes
        for start_node in start_nodes:
            reachable = nx.descendants(graph, start_node.id)
            reachable.add(start_node.id)

            unreachable = set(n.id for n in workflow.nodes) - reachable
            if unreachable:
                logger.warning(f"Unreachable nodes found: {unreachable}")

        # Check for cycles (excluding loop nodes)
        try:
            if nx.is_directed_acyclic_graph(graph):
                pass  # DAG is fine
            else:
                # Check if cycles are only through loop nodes
                cycles = list(nx.simple_cycles(graph))
                for cycle in cycles:
                    cycle_nodes = [graph.nodes[node_id]['node'] for node_id in cycle]
                    if not any(n.type == NodeType.LOOP for n in cycle_nodes):
                        raise ValueError(f"Invalid cycle detected: {cycle}")
        except Exception as e:
            raise ValueError(f"Workflow validation failed: {e}")

        return True

    async def execute_workflow(
        self,
        workflow_id: UUID,
        input_data: Dict[str, Any] = None,
        user_id: Optional[UUID] = None
    ) -> UUID:
        """Start workflow execution."""
        try:
            workflow = self.workflows.get(workflow_id)
            if not workflow:
                raise ValueError(f"Workflow not found: {workflow_id}")

            execution = WorkflowExecution(
                workflow_id=workflow_id,
                workflow_version=workflow.version,
                input_data=input_data or {},
                started_by=user_id
            )

            # Initialize execution context
            execution.execution_context.update(workflow.variables)
            execution.execution_context.update(input_data or {})

            # Store execution
            self.executions[execution.id] = execution
            self.running_executions.add(execution.id)

            # Start execution task
            asyncio.create_task(self._execute_workflow_async(execution, workflow))

            logger.info(f"Started workflow execution: {execution.id}")
            return execution.id

        except Exception as e:
            logger.error(f"Failed to start workflow execution: {e}")
            raise

    async def _execute_workflow_async(
        self,
        execution: WorkflowExecution,
        workflow: WorkflowDefinition
    ):
        """Async workflow execution."""
        try:
            # Find start nodes
            start_nodes = [n for n in workflow.nodes if n.type == NodeType.START]

            # Initialize current nodes
            execution.current_nodes = [n.id for n in start_nodes]

            # Execute workflow
            while execution.current_nodes and execution.status == WorkflowStatus.RUNNING:
                next_nodes = []

                # Execute current nodes in parallel
                tasks = []
                for node_id in execution.current_nodes:
                    node = self._find_node(workflow, node_id)
                    if node:
                        tasks.append(self._execute_node(execution, workflow, node))

                if tasks:
                    results = await asyncio.gather(*tasks, return_exceptions=True)

                    # Process results and determine next nodes
                    for i, result in enumerate(results):
                        node_id = execution.current_nodes[i]
                        node = self._find_node(workflow, node_id)

                        if isinstance(result, Exception):
                            logger.error(f"Node {node_id} failed: {result}")
                            execution.failed_nodes.append(node_id)
                            node.status = NodeStatus.FAILED
                            node.error = str(result)
                        else:
                            execution.completed_nodes.append(node_id)
                            node.status = NodeStatus.COMPLETED
                            node.result = result

                            # Find next nodes
                            next_nodes.extend(await self._get_next_nodes(workflow, node, result, execution))

                # Update current nodes
                execution.current_nodes = list(set(next_nodes))

                # Check for end condition
                end_nodes = [n for n in workflow.nodes if n.type == NodeType.END]
                if any(n.id in execution.completed_nodes for n in end_nodes):
                    execution.status = WorkflowStatus.COMPLETED
                    break

                # Check for failure condition
                if execution.failed_nodes and not execution.current_nodes:
                    execution.status = WorkflowStatus.FAILED
                    execution.error = f"Workflow failed at nodes: {execution.failed_nodes}"
                    break

            # Finalize execution
            execution.completed_at = datetime.utcnow()
            self.running_executions.discard(execution.id)

            # Store final state in Redis
            await redis_client.set(
                f"execution:{execution.id}",
                json.dumps(execution.dict(), default=str),
                expire=3600 * 24 * 7  # 7 days
            )

            logger.info(f"Workflow execution completed: {execution.id} (status: {execution.status})")

        except Exception as e:
            execution.status = WorkflowStatus.FAILED
            execution.error = str(e)
            execution.completed_at = datetime.utcnow()
            self.running_executions.discard(execution.id)
            logger.error(f"Workflow execution failed: {e}")

    def _find_node(self, workflow: WorkflowDefinition, node_id: str) -> Optional[WorkflowNode]:
        """Find node by ID."""
        return next((n for n in workflow.nodes if n.id == node_id), None)

    async def _execute_node(
        self,
        execution: WorkflowExecution,
        workflow: WorkflowDefinition,
        node: WorkflowNode
    ) -> Any:
        """Execute a single workflow node."""
        node.started_at = datetime.utcnow()
        node.status = NodeStatus.RUNNING

        try:
            result = None

            if node.type == NodeType.START:
                result = execution.input_data

            elif node.type == NodeType.END:
                execution.output_data = execution.execution_context
                result = execution.output_data

            elif node.type == NodeType.AGENT:
                result = await self._execute_agent_node(node, execution)

            elif node.type == NodeType.MCP_TOOL:
                result = await self._execute_mcp_tool_node(node, execution)

            elif node.type == NodeType.CONDITION:
                result = await self._execute_condition_node(node, execution)

            elif node.type == NodeType.HTTP_REQUEST:
                result = await self._execute_http_request_node(node, execution)

            elif node.type == NodeType.TRANSFORM:
                result = await self._execute_transform_node(node, execution)

            elif node.type == NodeType.DELAY:
                result = await self._execute_delay_node(node, execution)

            elif node.type == NodeType.HUMAN_INPUT:
                result = await self._execute_human_input_node(node, execution)

            else:
                raise ValueError(f"Unsupported node type: {node.type}")

            # Update execution context
            if result is not None:
                execution.execution_context[f"node_{node.id}_result"] = result

            node.completed_at = datetime.utcnow()
            node.execution_time_ms = int(
                (node.completed_at - node.started_at).total_seconds() * 1000
            )

            return result

        except Exception as e:
            node.completed_at = datetime.utcnow()
            node.execution_time_ms = int(
                (node.completed_at - node.started_at).total_seconds() * 1000
            ) if node.started_at else 0
            raise e

    async def _execute_agent_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Any:
        """Execute agent node."""
        agent_type = node.config.get("agent_type", "conversational")
        task_description = node.config.get("task_description", "")
        parameters = node.config.get("parameters", {})

        # Substitute context variables
        resolved_params = self._resolve_template_variables(parameters, execution.execution_context)

        # Execute through task executor
        result = await task_executor.execute_agent_task(
            agent_type=agent_type,
            task_description=task_description,
            parameters=resolved_params,
            context=execution.execution_context
        )

        return result

    async def _execute_mcp_tool_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Any:
        """Execute MCP tool node."""
        tool_name = node.config.get("tool_name")
        parameters = node.config.get("parameters", {})

        if not tool_name:
            raise ValueError("MCP tool node requires tool_name")

        # Substitute context variables
        resolved_params = self._resolve_template_variables(parameters, execution.execution_context)

        # Execute MCP tool
        tool_execution = await mcp_service.execute_tool(
            tool_name=tool_name,
            parameters=resolved_params,
            workflow_id=execution.workflow_id
        )

        if tool_execution.error:
            raise Exception(f"MCP tool failed: {tool_execution.error}")

        return tool_execution.result

    async def _execute_condition_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Any:
        """Execute condition node."""
        condition = node.config.get("condition", "true")

        # Simple condition evaluation (can be enhanced with safe eval)
        # For now, support basic comparisons
        try:
            # Replace template variables
            resolved_condition = self._resolve_template_string(condition, execution.execution_context)

            # Basic evaluation (should be enhanced with proper expression parser)
            if resolved_condition.lower() in ["true", "yes", "1"]:
                return True
            elif resolved_condition.lower() in ["false", "no", "0"]:
                return False
            else:
                # Try to evaluate as comparison
                return eval(resolved_condition)  # WARNING: This is unsafe, should use safe evaluator

        except Exception as e:
            logger.warning(f"Condition evaluation failed: {e}, defaulting to False")
            return False

    async def _execute_http_request_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Any:
        """Execute HTTP request node."""
        import httpx

        method = node.config.get("method", "GET").upper()
        url = node.config.get("url")
        headers = node.config.get("headers", {})
        data = node.config.get("data")

        if not url:
            raise ValueError("HTTP request node requires URL")

        # Resolve template variables
        url = self._resolve_template_string(url, execution.execution_context)
        headers = self._resolve_template_variables(headers, execution.execution_context)
        if data:
            data = self._resolve_template_variables(data, execution.execution_context)

        async with httpx.AsyncClient() as client:
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = await client.put(url, headers=headers, json=data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            response.raise_for_status()

            try:
                return response.json()
            except:
                return response.text

    async def _execute_transform_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Any:
        """Execute data transformation node."""
        transform_type = node.config.get("transform_type", "javascript")
        script = node.config.get("script", "")

        if transform_type == "javascript":
            # For now, just return the script as-is
            # In production, would use a safe JS evaluator
            return {"transformed": True, "script": script}
        else:
            raise ValueError(f"Unsupported transform type: {transform_type}")

    async def _execute_delay_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Any:
        """Execute delay node."""
        delay_seconds = node.config.get("delay_seconds", 1)
        await asyncio.sleep(delay_seconds)
        return {"delayed": delay_seconds}

    async def _execute_human_input_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Any:
        """Execute human input node (pauses workflow)."""
        # In production, this would integrate with a notification system
        execution.status = WorkflowStatus.PAUSED

        # Store input request
        input_request = {
            "execution_id": execution.id,
            "node_id": node.id,
            "prompt": node.config.get("prompt", "Human input required"),
            "input_type": node.config.get("input_type", "text"),
            "created_at": datetime.utcnow()
        }

        await redis_client.set(
            f"human_input:{execution.id}:{node.id}",
            json.dumps(input_request, default=str),
            expire=3600 * 24  # 24 hours
        )

        # For now, return placeholder
        return {"status": "waiting_for_input", "input_request": input_request}

    async def _get_next_nodes(
        self,
        workflow: WorkflowDefinition,
        current_node: WorkflowNode,
        result: Any,
        execution: WorkflowExecution
    ) -> List[str]:
        """Determine next nodes based on current node result."""
        next_nodes = []

        # Find outgoing connections
        outgoing_connections = [
            c for c in workflow.connections
            if c.source_node_id == current_node.id
        ]

        for connection in outgoing_connections:
            # Check connection condition
            if connection.condition:
                condition_met = await self._evaluate_connection_condition(
                    connection.condition, result, execution
                )
                if not condition_met:
                    continue

            next_nodes.append(connection.target_node_id)

        return next_nodes

    async def _evaluate_connection_condition(
        self,
        condition: str,
        result: Any,
        execution: WorkflowExecution
    ) -> bool:
        """Evaluate connection condition."""
        try:
            # Simple condition evaluation
            context = {
                "result": result,
                "execution": execution.execution_context
            }

            # Replace template variables
            resolved_condition = self._resolve_template_string(condition, context)

            # Basic evaluation
            return eval(resolved_condition)  # WARNING: Unsafe, should use safe evaluator

        except Exception as e:
            logger.warning(f"Connection condition evaluation failed: {e}")
            return False

    def _resolve_template_variables(self, data: Any, context: Dict[str, Any]) -> Any:
        """Resolve template variables in data structure."""
        if isinstance(data, dict):
            return {k: self._resolve_template_variables(v, context) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._resolve_template_variables(item, context) for item in data]
        elif isinstance(data, str):
            return self._resolve_template_string(data, context)
        else:
            return data

    def _resolve_template_string(self, template: str, context: Dict[str, Any]) -> str:
        """Resolve template string with context variables."""
        if not isinstance(template, str):
            return template

        # Simple template variable replacement
        # Format: {{variable_name}}
        import re

        def replace_var(match):
            var_name = match.group(1).strip()
            return str(context.get(var_name, match.group(0)))

        return re.sub(r'\{\{([^}]+)\}\}', replace_var, template)

    async def pause_workflow(self, execution_id: UUID) -> bool:
        """Pause workflow execution."""
        execution = self.executions.get(execution_id)
        if execution and execution.status == WorkflowStatus.RUNNING:
            execution.status = WorkflowStatus.PAUSED
            return True
        return False

    async def resume_workflow(self, execution_id: UUID, human_input: Dict[str, Any] = None) -> bool:
        """Resume paused workflow execution."""
        execution = self.executions.get(execution_id)
        if execution and execution.status == WorkflowStatus.PAUSED:
            if human_input:
                execution.execution_context.update(human_input)

            execution.status = WorkflowStatus.RUNNING

            # Resume execution
            workflow = self.workflows.get(execution.workflow_id)
            if workflow:
                asyncio.create_task(self._execute_workflow_async(execution, workflow))

            return True
        return False

    async def cancel_workflow(self, execution_id: UUID) -> bool:
        """Cancel workflow execution."""
        execution = self.executions.get(execution_id)
        if execution and execution.status in [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED]:
            execution.status = WorkflowStatus.CANCELLED
            execution.completed_at = datetime.utcnow()
            self.running_executions.discard(execution_id)
            return True
        return False

    async def get_workflow(self, workflow_id: UUID) -> Optional[WorkflowDefinition]:
        """Get workflow definition."""
        return self.workflows.get(workflow_id)

    async def get_execution(self, execution_id: UUID) -> Optional[WorkflowExecution]:
        """Get workflow execution."""
        return self.executions.get(execution_id)

    async def list_workflows(self, created_by: Optional[UUID] = None) -> List[WorkflowDefinition]:
        """List workflows."""
        workflows = list(self.workflows.values())
        if created_by:
            workflows = [w for w in workflows if w.created_by == created_by]
        return workflows

    async def list_executions(
        self,
        workflow_id: Optional[UUID] = None,
        status: Optional[WorkflowStatus] = None
    ) -> List[WorkflowExecution]:
        """List workflow executions."""
        executions = list(self.executions.values())

        if workflow_id:
            executions = [e for e in executions if e.workflow_id == workflow_id]

        if status:
            executions = [e for e in executions if e.status == status]

        return executions

    async def generate_workflow_from_description(
        self,
        description: str,
        user_id: Optional[UUID] = None
    ) -> UUID:
        """Generate workflow from natural language description using AI."""
        try:
            # Use LLM to analyze description and generate workflow
            analysis = await llm_service.analyze_task(
                task_description=description,
                context="Generate a workflow structure with nodes and connections"
            )

            # Create basic workflow structure
            workflow_data = {
                "name": f"Generated Workflow - {description[:50]}",
                "description": description,
                "created_by": user_id,
                "nodes": [
                    {
                        "id": "start_1",
                        "type": NodeType.START,
                        "name": "Start",
                        "position": {"x": 100, "y": 100}
                    },
                    {
                        "id": "end_1",
                        "type": NodeType.END,
                        "name": "End",
                        "position": {"x": 500, "y": 100}
                    }
                ],
                "connections": [
                    {
                        "source_node_id": "start_1",
                        "source_output": "default",
                        "target_node_id": "end_1",
                        "target_input": "default"
                    }
                ]
            }

            # Enhance with AI-generated nodes based on analysis
            if "analysis" in analysis:
                # Add suggested nodes (placeholder implementation)
                pass

            return await self.create_workflow(workflow_data)

        except Exception as e:
            logger.error(f"Failed to generate workflow: {e}")
            raise


# Global workflow engine instance
workflow_engine = WorkflowEngine()