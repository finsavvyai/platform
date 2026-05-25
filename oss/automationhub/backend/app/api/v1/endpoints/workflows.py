"""
Workflow API endpoints for visual workflow building and execution.

Provides comprehensive workflow management including creation, execution,
monitoring, and AI-powered workflow generation.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field

from app.services.workflow_engine import (
    workflow_engine,
    WorkflowDefinition,
    WorkflowExecution,
    WorkflowStatus,
    NodeType,
    WorkflowNode,
    WorkflowConnection
)
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


class WorkflowCreateRequest(BaseModel):
    """Request model for creating workflow."""
    name: str
    description: Optional[str] = None
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    connections: List[Dict[str, Any]] = Field(default_factory=list)
    variables: Dict[str, Any] = Field(default_factory=dict)
    triggers: List[Dict[str, Any]] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)


class WorkflowExecuteRequest(BaseModel):
    """Request model for executing workflow."""
    input_data: Dict[str, Any] = Field(default_factory=dict)
    settings: Dict[str, Any] = Field(default_factory=dict)


class WorkflowGenerateRequest(BaseModel):
    """Request model for AI workflow generation."""
    description: str
    requirements: List[str] = Field(default_factory=list)
    preferences: Dict[str, Any] = Field(default_factory=dict)


class NodeCreateRequest(BaseModel):
    """Request model for creating workflow node."""
    type: NodeType
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    position: Dict[str, float] = Field(default_factory=dict)


class ConnectionCreateRequest(BaseModel):
    """Request model for creating workflow connection."""
    source_node_id: str
    source_output: str = "default"
    target_node_id: str
    target_input: str = "default"
    condition: Optional[str] = None
    label: Optional[str] = None


class WorkflowResponse(BaseModel):
    """Response model for workflow."""
    id: UUID
    name: str
    description: Optional[str]
    version: int
    nodes: List[Dict[str, Any]]
    connections: List[Dict[str, Any]]
    variables: Dict[str, Any]
    triggers: List[Dict[str, Any]]
    settings: Dict[str, Any]
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class ExecutionResponse(BaseModel):
    """Response model for workflow execution."""
    id: UUID
    workflow_id: UUID
    workflow_version: int
    status: WorkflowStatus
    input_data: Dict[str, Any]
    output_data: Optional[Dict[str, Any]]
    current_nodes: List[str]
    completed_nodes: List[str]
    failed_nodes: List[str]
    execution_context: Dict[str, Any]
    started_at: datetime
    completed_at: Optional[datetime]
    started_by: Optional[UUID]
    error: Optional[str]


@router.get("/", response_model=List[WorkflowResponse])
async def list_workflows(
    current_user: User = Depends(get_current_user)
):
    """List all workflows created by the current user."""
    try:
        workflows = await workflow_engine.list_workflows(created_by=current_user.id)

        return [
            WorkflowResponse(
                id=w.id,
                name=w.name,
                description=w.description,
                version=w.version,
                nodes=[node.dict() for node in w.nodes],
                connections=[conn.dict() for conn in w.connections],
                variables=w.variables,
                triggers=w.triggers,
                settings=w.settings,
                created_by=w.created_by,
                created_at=w.created_at,
                updated_at=w.updated_at
            )
            for w in workflows
        ]

    except Exception as e:
        logger.error(f"Failed to list workflows: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflows")


@router.post("/", response_model=Dict[str, UUID])
async def create_workflow(
    request: WorkflowCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow."""
    try:
        workflow_data = request.dict()
        workflow_data["created_by"] = current_user.id

        workflow_id = await workflow_engine.create_workflow(workflow_data)
        return {"workflow_id": workflow_id}

    except Exception as e:
        logger.error(f"Failed to create workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create workflow: {str(e)}")


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get workflow by ID."""
    try:
        workflow = await workflow_engine.get_workflow(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Check permissions (basic check)
        if workflow.created_by and workflow.created_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        return WorkflowResponse(
            id=workflow.id,
            name=workflow.name,
            description=workflow.description,
            version=workflow.version,
            nodes=[node.dict() for node in workflow.nodes],
            connections=[conn.dict() for conn in workflow.connections],
            variables=workflow.variables,
            triggers=workflow.triggers,
            settings=workflow.settings,
            created_by=workflow.created_by,
            created_at=workflow.created_at,
            updated_at=workflow.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow")


@router.post("/{workflow_id}/execute", response_model=Dict[str, UUID])
async def execute_workflow(
    workflow_id: UUID,
    request: WorkflowExecuteRequest,
    current_user: User = Depends(get_current_user)
):
    """Execute a workflow."""
    try:
        execution_id = await workflow_engine.execute_workflow(
            workflow_id=workflow_id,
            input_data=request.input_data,
            user_id=current_user.id
        )

        return {"execution_id": execution_id}

    except Exception as e:
        logger.error(f"Failed to execute workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to execute workflow: {str(e)}")


@router.get("/{workflow_id}/executions", response_model=List[ExecutionResponse])
async def list_workflow_executions(
    workflow_id: UUID,
    status: Optional[WorkflowStatus] = Query(None, description="Filter by execution status"),
    current_user: User = Depends(get_current_user)
):
    """List executions for a workflow."""
    try:
        executions = await workflow_engine.list_executions(
            workflow_id=workflow_id,
            status=status
        )

        # Filter by user permissions
        filtered_executions = [
            e for e in executions
            if e.started_by == current_user.id or current_user.is_superuser
        ]

        return [
            ExecutionResponse(
                id=e.id,
                workflow_id=e.workflow_id,
                workflow_version=e.workflow_version,
                status=e.status,
                input_data=e.input_data,
                output_data=e.output_data,
                current_nodes=e.current_nodes,
                completed_nodes=e.completed_nodes,
                failed_nodes=e.failed_nodes,
                execution_context=e.execution_context,
                started_at=e.started_at,
                completed_at=e.completed_at,
                started_by=e.started_by,
                error=e.error
            )
            for e in filtered_executions
        ]

    except Exception as e:
        logger.error(f"Failed to list executions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve executions")


@router.get("/executions/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get workflow execution by ID."""
    try:
        execution = await workflow_engine.get_execution(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        # Check permissions
        if execution.started_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        return ExecutionResponse(
            id=execution.id,
            workflow_id=execution.workflow_id,
            workflow_version=execution.workflow_version,
            status=execution.status,
            input_data=execution.input_data,
            output_data=execution.output_data,
            current_nodes=execution.current_nodes,
            completed_nodes=execution.completed_nodes,
            failed_nodes=execution.failed_nodes,
            execution_context=execution.execution_context,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            started_by=execution.started_by,
            error=execution.error
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve execution")


@router.post("/executions/{execution_id}/pause")
async def pause_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Pause workflow execution."""
    try:
        execution = await workflow_engine.get_execution(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        # Check permissions
        if execution.started_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        success = await workflow_engine.pause_workflow(execution_id)
        if not success:
            raise HTTPException(status_code=400, detail="Cannot pause execution")

        return {"status": "paused"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to pause execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to pause execution")


@router.post("/executions/{execution_id}/resume")
async def resume_execution(
    execution_id: UUID,
    human_input: Dict[str, Any] = Body(None),
    current_user: User = Depends(get_current_user)
):
    """Resume paused workflow execution."""
    try:
        execution = await workflow_engine.get_execution(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        # Check permissions
        if execution.started_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        success = await workflow_engine.resume_workflow(execution_id, human_input)
        if not success:
            raise HTTPException(status_code=400, detail="Cannot resume execution")

        return {"status": "resumed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resume execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to resume execution")


@router.post("/executions/{execution_id}/cancel")
async def cancel_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Cancel workflow execution."""
    try:
        execution = await workflow_engine.get_execution(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        # Check permissions
        if execution.started_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        success = await workflow_engine.cancel_workflow(execution_id)
        if not success:
            raise HTTPException(status_code=400, detail="Cannot cancel execution")

        return {"status": "cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel execution")


@router.post("/generate", response_model=Dict[str, UUID])
async def generate_workflow_from_description(
    request: WorkflowGenerateRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate workflow from natural language description using AI."""
    try:
        workflow_id = await workflow_engine.generate_workflow_from_description(
            description=request.description,
            user_id=current_user.id
        )

        return {"workflow_id": workflow_id}

    except Exception as e:
        logger.error(f"Failed to generate workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to generate workflow: {str(e)}")


@router.get("/templates/node-types")
async def get_node_types(
    current_user: User = Depends(get_current_user)
):
    """Get available workflow node types and their configurations."""
    try:
        node_types = [
            {
                "type": NodeType.START,
                "name": "Start",
                "description": "Workflow entry point",
                "category": "control",
                "icon": "play_arrow",
                "inputs": [],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {}
            },
            {
                "type": NodeType.END,
                "name": "End",
                "description": "Workflow exit point",
                "category": "control",
                "icon": "stop",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [],
                "config_schema": {}
            },
            {
                "type": NodeType.AGENT,
                "name": "AI Agent",
                "description": "Execute task using AI agent",
                "category": "ai",
                "icon": "smart_toy",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "agent_type": {"type": "string", "enum": ["browser", "conversational", "infrastructure", "data"]},
                    "task_description": {"type": "string"},
                    "parameters": {"type": "object"}
                }
            },
            {
                "type": NodeType.MCP_TOOL,
                "name": "MCP Tool",
                "description": "Execute MCP tool",
                "category": "tools",
                "icon": "build",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "tool_name": {"type": "string"},
                    "parameters": {"type": "object"}
                }
            },
            {
                "type": NodeType.CONDITION,
                "name": "Condition",
                "description": "Conditional branching",
                "category": "logic",
                "icon": "call_split",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [
                    {"id": "true", "name": "True", "type": "boolean"},
                    {"id": "false", "name": "False", "type": "boolean"}
                ],
                "config_schema": {
                    "condition": {"type": "string"}
                }
            },
            {
                "type": NodeType.HTTP_REQUEST,
                "name": "HTTP Request",
                "description": "Make HTTP API request",
                "category": "integration",
                "icon": "http",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]},
                    "url": {"type": "string"},
                    "headers": {"type": "object"},
                    "data": {"type": "object"}
                }
            },
            {
                "type": NodeType.TRANSFORM,
                "name": "Transform",
                "description": "Transform data",
                "category": "data",
                "icon": "transform",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "transform_type": {"type": "string", "enum": ["javascript", "python"]},
                    "script": {"type": "string"}
                }
            },
            {
                "type": NodeType.DELAY,
                "name": "Delay",
                "description": "Wait for specified time",
                "category": "utility",
                "icon": "schedule",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "delay_seconds": {"type": "number", "minimum": 0}
                }
            },
            {
                "type": NodeType.HUMAN_INPUT,
                "name": "Human Input",
                "description": "Wait for human input",
                "category": "control",
                "icon": "person",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "prompt": {"type": "string"},
                    "input_type": {"type": "string", "enum": ["text", "number", "boolean", "json"]}
                }
            }
        ]

        return {"node_types": node_types}

    except Exception as e:
        logger.error(f"Failed to get node types: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve node types")


@router.get("/stats")
async def get_workflow_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get workflow usage statistics."""
    try:
        user_workflows = await workflow_engine.list_workflows(created_by=current_user.id)
        all_executions = await workflow_engine.list_executions()

        user_executions = [
            e for e in all_executions
            if e.started_by == current_user.id
        ]

        # Calculate statistics
        total_workflows = len(user_workflows)
        total_executions = len(user_executions)
        successful_executions = len([e for e in user_executions if e.status == WorkflowStatus.COMPLETED])
        failed_executions = len([e for e in user_executions if e.status == WorkflowStatus.FAILED])
        running_executions = len([e for e in user_executions if e.status == WorkflowStatus.RUNNING])

        # Calculate average execution time
        completed_executions = [e for e in user_executions if e.completed_at and e.started_at]
        avg_execution_time = 0
        if completed_executions:
            execution_times = [
                (e.completed_at - e.started_at).total_seconds()
                for e in completed_executions
            ]
            avg_execution_time = sum(execution_times) / len(execution_times)

        return {
            "workflows": {
                "total": total_workflows,
                "active": len([w for w in user_workflows if any(
                    e.workflow_id == w.id and e.status in [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED]
                    for e in user_executions
                )])
            },
            "executions": {
                "total": total_executions,
                "successful": successful_executions,
                "failed": failed_executions,
                "running": running_executions,
                "success_rate": successful_executions / total_executions if total_executions > 0 else 0
            },
            "performance": {
                "average_execution_time_seconds": round(avg_execution_time, 2)
            },
            "most_used_node_types": []  # Could be enhanced with actual usage tracking
        }

    except Exception as e:
        logger.error(f"Failed to get workflow statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")