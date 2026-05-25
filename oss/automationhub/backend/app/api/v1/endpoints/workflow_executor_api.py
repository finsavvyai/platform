"""
Enhanced Workflow Execution API endpoints

Provides comprehensive workflow management and execution using the new
enterprise-grade WorkflowExecutor service with advanced features:
- Sequential and parallel execution modes
- Real-time execution monitoring
- Resource management and limits
- Circuit breaker and error handling
- Comprehensive audit trail
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, Body, BackgroundTasks
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.workflow_executor import (
    get_workflow_executor,
    WorkflowExecutor,
    WorkflowNode,
    WorkflowConnection,
    NodeType,
    ExecutionStatus,
    NodeStatus,
    VariableScope,
    ExecutionMode,
    DataType
)
from app.models.workflow import (
    Workflow,
    WorkflowExecution,
    NodeExecution,
    WorkflowStatus,
    RetryPolicy
)
from app.core.auth import get_current_user
from app.schemas.auth import User
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response Models

class WorkflowCreateRequest(BaseModel):
    """Request model for creating workflow."""
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    connections: List[Dict[str, Any]] = Field(default_factory=list)
    variables: Dict[str, Any] = Field(default_factory=dict)
    triggers: List[Dict[str, Any]] = Field(default_factory=list)

    # Advanced settings
    execution_settings: Dict[str, Any] = Field(default_factory=dict)
    retry_settings: Dict[str, Any] = Field(default_factory=dict)
    notification_settings: Dict[str, Any] = Field(default_factory=dict)
    security_settings: Dict[str, Any] = Field(default_factory=dict)

    # Metadata
    tags: List[str] = Field(default_factory=list)
    category: Optional[str] = Field(None, max_length=100)
    priority: int = Field(5, ge=1, le=10)

    @validator('nodes')
    def validate_nodes(cls, v):
        if not v:
            raise ValueError("Workflow must have at least one node")

        # Check for required start and end nodes
        node_types = [node.get('type') for node in v]
        if NodeType.START not in node_types:
            raise ValueError("Workflow must have at least one START node")
        if NodeType.END not in node_types:
            raise ValueError("Workflow must have at least one END node")

        return v


class WorkflowExecuteRequest(BaseModel):
    """Request model for executing workflow."""
    input_data: Dict[str, Any] = Field(default_factory=dict)
    execution_mode: ExecutionMode = ExecutionMode.MIXED
    session_id: Optional[str] = None
    timeout_minutes: Optional[int] = Field(None, ge=1, le=1440)  # Max 24 hours
    priority: int = Field(5, ge=1, le=10)


class WorkflowUpdateRequest(BaseModel):
    """Request model for updating workflow."""
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    nodes: Optional[List[Dict[str, Any]]] = None
    connections: Optional[List[Dict[str, Any]]] = None
    variables: Optional[Dict[str, Any]] = None
    status: Optional[WorkflowStatus] = None

    # Advanced settings
    execution_settings: Optional[Dict[str, Any]] = None
    retry_settings: Optional[Dict[str, Any]] = None

    # Metadata
    tags: Optional[List[str]] = None
    category: Optional[str] = Field(None, max_length=100)
    priority: Optional[int] = Field(None, ge=1, le=10)


class NodeCreateRequest(BaseModel):
    """Request model for creating workflow node."""
    type: NodeType
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    config: Dict[str, Any] = Field(default_factory=dict)
    parameters: Dict[str, Any] = Field(default_factory=dict)

    # Conditional execution
    condition: Optional[str] = None
    preconditions: List[str] = Field(default_factory=list)

    # Error handling
    error_handler: Optional[str] = None
    retry_policy: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: Optional[int] = Field(None, ge=1, le=3600)

    # Parallel execution
    parallel_group: Optional[str] = None
    parallel_limit: Optional[int] = Field(None, ge=1, le=100)

    # Data flow
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    variable_mappings: Dict[str, str] = Field(default_factory=dict)

    # Metadata
    tags: List[str] = Field(default_factory=list)


class ConnectionCreateRequest(BaseModel):
    """Request model for creating workflow connection."""
    source_node_id: str
    source_output: str = "default"
    target_node_id: str
    target_input: str = "default"

    # Conditional routing
    condition: Optional[str] = None
    priority: int = Field(0, ge=0, le=100)

    # Data transformation
    data_transformer: Optional[str] = None
    filter_condition: Optional[str] = None

    # Metadata
    label: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class ExecutionMetricsRequest(BaseModel):
    """Request model for getting execution metrics."""
    include_node_details: bool = False
    include_resource_usage: bool = False
    include_audit_log: bool = False


class HumanInputRequest(BaseModel):
    """Request model for providing human input."""
    input_data: Dict[str, Any]
    message: Optional[str] = None


# Response Models

class WorkflowResponse(BaseModel):
    """Response model for workflow."""
    id: UUID
    name: str
    description: Optional[str]
    version: int
    status: WorkflowStatus

    # Ownership
    owner_id: UUID
    organization_id: Optional[UUID]

    # Definition
    nodes: List[Dict[str, Any]]
    connections: List[Dict[str, Any]]
    variables: Dict[str, Any]
    triggers: List[Dict[str, Any]]

    # Settings
    execution_settings: Dict[str, Any]
    retry_settings: Dict[str, Any]
    notification_settings: Dict[str, Any]
    security_settings: Dict[str, Any]

    # Metadata
    tags: List[str]
    category: Optional[str]
    priority: int
    is_template: bool
    is_public: bool
    is_validated: bool
    validation_errors: List[str]

    # Performance
    execution_count: int
    success_count: int
    failure_count: int
    average_execution_time_ms: float
    success_rate: float
    last_execution_status: Optional[ExecutionStatus]
    last_execution_at: Optional[datetime]

    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_executed: Optional[datetime]

    class Config:
        from_attributes = True


class ExecutionResponse(BaseModel):
    """Response model for workflow execution."""
    id: UUID
    workflow_id: UUID
    workflow_version: int
    status: ExecutionStatus
    progress_percentage: float

    # Node tracking
    current_nodes: List[str]
    completed_nodes: List[str]
    failed_nodes: List[str]
    skipped_nodes: List[str]

    # Data
    input_data: Dict[str, Any]
    output_data: Optional[Dict[str, Any]]
    execution_context: Dict[str, Any]
    node_results: Dict[str, Any]

    # Error handling
    error_message: Optional[str]
    error_details: Optional[Dict[str, Any]]
    retry_count: int
    max_retries: int
    next_retry_at: Optional[datetime]

    # Performance
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    timeout_at: Optional[datetime]
    execution_time_ms: Optional[float]

    # Resource usage
    resource_usage: Optional[Dict[str, Any]]
    agent_assignments: Dict[str, Any]

    # User tracking
    started_by: Optional[UUID]
    session_id: Optional[str]

    # Audit
    audit_log: List[Dict[str, Any]]
    compliance_flags: Dict[str, Any]

    # External integrations
    external_triggers: List[Dict[str, Any]]
    webhooks_fired: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class NodeExecutionResponse(BaseModel):
    """Response model for node execution."""
    id: UUID
    workflow_execution_id: UUID
    node_id: str
    node_type: str
    node_name: str

    # Status and timing
    status: NodeStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    execution_time_ms: Optional[float]

    # Data
    input_data: Optional[Dict[str, Any]]
    output_data: Optional[Dict[str, Any]]
    transformed_data: Optional[Dict[str, Any]]

    # Error handling
    error_message: Optional[str]
    error_details: Optional[Dict[str, Any]]
    retry_count: int

    # Performance
    resource_usage: Optional[Dict[str, Any]]
    agent_id: Optional[UUID]
    agent_performance: Optional[Dict[str, Any]]

    # Conditional execution
    condition_result: Optional[Dict[str, Any]]
    branch_taken: Optional[str]

    # Audit
    execution_log: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class ExecutionMetricsResponse(BaseModel):
    """Response model for execution metrics."""
    execution_id: UUID
    status: ExecutionStatus
    progress_percentage: float

    # Node statistics
    total_nodes: int
    completed_nodes: int
    failed_nodes: int
    skipped_nodes: int
    running_nodes: int

    # Performance metrics
    execution_time_ms: Optional[float]
    average_node_time_ms: float

    # Timing
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    estimated_completion_at: Optional[datetime]

    # Resource usage
    resource_usage: Optional[Dict[str, Any]]

    # Error analysis
    error_summary: Optional[Dict[str, Any]]

    # Detailed information
    node_details: Optional[List[Dict[str, Any]]]
    audit_log: Optional[List[Dict[str, Any]]]


class WorkflowStatisticsResponse(BaseModel):
    """Response model for workflow statistics."""
    workflow_id: Optional[UUID]

    # Execution counts
    total_executions: int
    successful_executions: int
    failed_executions: int
    cancelled_executions: int
    running_executions: int

    # Performance metrics
    success_rate: float
    average_execution_time_ms: float
    min_execution_time_ms: Optional[float]
    max_execution_time_ms: Optional[float]

    # Resource usage
    average_memory_usage_mb: Optional[float]
    peak_memory_usage_mb: Optional[float]
    average_cpu_usage: Optional[float]

    # Recent activity
    executions_last_24h: int
    executions_last_7d: int
    executions_last_30d: int

    # Error analysis
    common_errors: List[Dict[str, Any]]
    failure_rate_by_node_type: Dict[str, float]


# API Endpoints

@router.get("/", response_model=List[WorkflowResponse])
async def list_workflows(
    status: Optional[WorkflowStatus] = Query(None, description="Filter by workflow status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of workflows to return"),
    offset: int = Query(0, ge=0, description="Number of workflows to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List workflows with filtering and pagination."""
    try:
        # Build query
        query = select(Workflow).where(Workflow.owner_id == current_user.id)

        if status:
            query = query.where(Workflow.status == status)

        if category:
            query = query.where(Workflow.category == category)

        if tags:
            query = query.where(Workflow.tags.contains(tags))

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                (Workflow.name.ilike(search_pattern)) |
                (Workflow.description.ilike(search_pattern))
            )

        # Add ordering and pagination
        query = query.order_by(Workflow.updated_at.desc())
        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        workflows = result.scalars().all()

        return [WorkflowResponse.from_orm(workflow) for workflow in workflows]

    except Exception as e:
        logger.error(f"Failed to list workflows: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflows")


@router.post("/", response_model=WorkflowResponse)
async def create_workflow(
    request: WorkflowCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new workflow with validation."""
    try:
        # Create workflow object
        workflow = Workflow(
            name=request.name,
            description=request.description,
            owner_id=current_user.id,
            organization_id=current_user.organization_id,
            nodes=request.nodes,
            connections=request.connections,
            variables=request.variables,
            triggers=request.triggers,
            execution_settings=request.execution_settings,
            retry_settings=request.retry_settings,
            notification_settings=request.notification_settings,
            security_settings=request.security_settings,
            tags=request.tags,
            category=request.category,
            priority=request.priority,
            status=WorkflowStatus.DRAFT
        )

        # Validate workflow structure
        executor = await get_workflow_executor(db)
        nodes = executor._parse_workflow_nodes(request.nodes)
        connections = executor._parse_workflow_connections(request.connections)

        validation_errors = executor.dependency_resolver.validate_workflow(nodes, connections)

        if validation_errors:
            workflow.validation_errors = validation_errors
        else:
            workflow.is_validated = True

        # Save to database
        db.add(workflow)
        await db.commit()
        await db.refresh(workflow)

        return WorkflowResponse.from_orm(workflow)

    except Exception as e:
        logger.error(f"Failed to create workflow: {e}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create workflow: {str(e)}")


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get workflow by ID with permission checking."""
    try:
        result = await db.execute(
            select(Workflow).where(
                (Workflow.id == workflow_id) &
                (
                    (Workflow.owner_id == current_user.id) |
                    (Workflow.is_public == True) |
                    (current_user.is_superuser == True)
                )
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        return WorkflowResponse.from_orm(workflow)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow")


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    request: WorkflowUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update workflow with validation."""
    try:
        # Get existing workflow
        result = await db.execute(
            select(Workflow).where(
                (Workflow.id == workflow_id) &
                (Workflow.owner_id == current_user.id)
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Update fields
        update_data = request.dict(exclude_unset=True)

        # Re-validate if nodes or connections changed
        if 'nodes' in update_data or 'connections' in update_data:
            nodes = update_data.get('nodes', workflow.nodes)
            connections = update_data.get('connections', workflow.connections)

            executor = await get_workflow_executor(db)
            parsed_nodes = executor._parse_workflow_nodes(nodes)
            parsed_connections = executor._parse_workflow_connections(connections)

            validation_errors = executor.dependency_resolver.validate_workflow(parsed_nodes, parsed_connections)

            update_data['validation_errors'] = validation_errors
            update_data['is_validated'] = len(validation_errors) == 0
            update_data['version'] = workflow.version + 1

        # Apply updates
        for field, value in update_data.items():
            setattr(workflow, field, value)

        workflow.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(workflow)

        return WorkflowResponse.from_orm(workflow)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update workflow: {e}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update workflow: {str(e)}")


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete workflow with permission checking."""
    try:
        result = await db.execute(
            select(Workflow).where(
                (Workflow.id == workflow_id) &
                (Workflow.owner_id == current_user.id)
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Soft delete by archiving
        workflow.status = WorkflowStatus.ARCHIVED
        workflow.archived_at = datetime.utcnow()

        await db.commit()

        return {"message": "Workflow deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete workflow: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete workflow")


# Execution endpoints

@router.post("/{workflow_id}/execute", response_model=Dict[str, UUID])
async def execute_workflow(
    workflow_id: UUID,
    request: WorkflowExecuteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Execute workflow with specified parameters."""
    try:
        # Get workflow
        result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Check permissions and validation
        if workflow.owner_id != current_user.id and not workflow.is_public and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        if not workflow.can_execute():
            raise HTTPException(
                status_code=400,
                detail=f"Workflow cannot be executed: {workflow.validation_errors}"
            )

        # Get workflow executor
        executor = await get_workflow_executor(db)

        # Start execution
        execution_id = await executor.execute_workflow(
            workflow_id=workflow_id,
            input_data=request.input_data,
            user_id=current_user.id,
            execution_mode=request.execution_mode,
            session_id=request.session_id
        )

        # Add background task for monitoring (optional)
        if request.timeout_minutes:
            background_tasks.add_task(
                monitor_execution_timeout,
                execution_id,
                request.timeout_minutes * 60
            )

        return {"execution_id": execution_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to execute workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to execute workflow: {str(e)}")


@router.get("/{workflow_id}/executions", response_model=List[ExecutionResponse])
async def list_workflow_executions(
    workflow_id: UUID,
    status: Optional[ExecutionStatus] = Query(None, description="Filter by execution status"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List executions for a specific workflow."""
    try:
        # Build query
        query = select(WorkflowExecution).where(WorkflowExecution.workflow_id == workflow_id)

        if status:
            query = query.where(WorkflowExecution.status == status)

        # Add permission filtering
        if not current_user.is_superuser:
            query = query.where(WorkflowExecution.started_by == current_user.id)

        # Add ordering and pagination
        query = query.order_by(WorkflowExecution.started_at.desc())
        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        executions = result.scalars().all()

        return [ExecutionResponse.from_orm(execution) for execution in executions]

    except Exception as e:
        logger.error(f"Failed to list executions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve executions")


@router.get("/executions/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get workflow execution by ID."""
    try:
        result = await db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
        )
        execution = result.scalar_one_or_none()

        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        # Check permissions
        if (execution.started_by != current_user.id and
            not current_user.is_superuser):
            raise HTTPException(status_code=403, detail="Access denied")

        return ExecutionResponse.from_orm(execution)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve execution")


@router.get("/executions/{execution_id}/metrics", response_model=ExecutionMetricsResponse)
async def get_execution_metrics(
    execution_id: UUID,
    request: ExecutionMetricsRequest = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed metrics for workflow execution."""
    try:
        executor = await get_workflow_executor(db)

        # Check permissions
        execution = await executor.get_execution_status(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        if (execution.started_by != current_user.id and
            not current_user.is_superuser):
            raise HTTPException(status_code=403, detail="Access denied")

        # Get metrics
        metrics = await executor.get_execution_metrics(execution_id)

        # Build response
        response = ExecutionMetricsResponse(
            execution_id=execution_id,
            status=execution.status,
            progress_percentage=metrics.get('progress_percentage', 0),
            total_nodes=metrics.get('total_nodes', 0),
            completed_nodes=metrics.get('completed_nodes', 0),
            failed_nodes=metrics.get('failed_nodes', 0),
            skipped_nodes=metrics.get('skipped_nodes', 0),
            running_nodes=len(metrics.get('current_nodes', [])),
            execution_time_ms=metrics.get('execution_time_ms'),
            average_node_time_ms=metrics.get('average_node_time_ms', 0),
            started_at=metrics.get('started_at'),
            completed_at=metrics.get('completed_at'),
            resource_usage=metrics.get('resource_usage') if request.include_resource_usage else None,
            error_summary=metrics.get('error_summary')
        )

        # Add detailed information if requested
        if request.include_node_details:
            response.node_details = metrics.get('node_details', [])

        if request.include_audit_log:
            response.audit_log = metrics.get('audit_log', [])

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")


@router.get("/executions/{execution_id}/nodes", response_model=List[NodeExecutionResponse])
async def get_execution_nodes(
    execution_id: UUID,
    status: Optional[NodeStatus] = Query(None, description="Filter by node status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get node executions for a workflow execution."""
    try:
        # Check execution permissions
        execution_result = await db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
        )
        execution = execution_result.scalar_one_or_none()

        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        if (execution.started_by != current_user.id and
            not current_user.is_superuser):
            raise HTTPException(status_code=403, detail="Access denied")

        # Get node executions
        query = select(NodeExecution).where(NodeExecution.workflow_execution_id == execution_id)

        if status:
            query = query.where(NodeExecution.status == status)

        query = query.order_by(NodeExecution.started_at.asc())

        result = await db.execute(query)
        node_executions = result.scalars().all()

        return [NodeExecutionResponse.from_orm(node_execution) for node_execution in node_executions]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution nodes: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve nodes")


# Execution control endpoints

@router.post("/executions/{execution_id}/pause")
async def pause_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pause workflow execution."""
    try:
        executor = await get_workflow_executor(db)

        # Check permissions
        execution = await executor.get_execution_status(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        if (execution.started_by != current_user.id and
            not current_user.is_superuser):
            raise HTTPException(status_code=403, detail="Access denied")

        success = await executor.cancel_execution(execution_id, "User requested pause")

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
    request: HumanInputRequest = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resume paused workflow execution."""
    try:
        executor = await get_workflow_executor(db)

        # Check permissions
        execution = await executor.get_execution_status(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        if (execution.started_by != current_user.id and
            not current_user.is_superuser):
            raise HTTPException(status_code=403, detail="Access denied")

        # Resume with human input if provided
        human_input = None
        if request:
            human_input = request.input_data

        success = await executor.resume_execution(execution_id, human_input)

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
    reason: Optional[str] = Body(None, description="Reason for cancellation"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel workflow execution."""
    try:
        executor = await get_workflow_executor(db)

        # Check permissions
        execution = await executor.get_execution_status(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        if (execution.started_by != current_user.id and
            not current_user.is_superuser):
            raise HTTPException(status_code=403, detail="Access denied")

        cancellation_reason = reason or "User requested cancellation"
        success = await executor.cancel_execution(execution_id, cancellation_reason)

        if not success:
            raise HTTPException(status_code=400, detail="Cannot cancel execution")

        return {"status": "cancelled", "reason": cancellation_reason}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel execution")


# Statistics and analytics endpoints

@router.get("/{workflow_id}/statistics", response_model=WorkflowStatisticsResponse)
async def get_workflow_statistics(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive statistics for a workflow."""
    try:
        executor = await get_workflow_executor(db)

        # Check workflow permissions
        result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        if (workflow.owner_id != current_user.id and
            not workflow.is_public and
            not current_user.is_superuser):
            raise HTTPException(status_code=403, detail="Access denied")

        # Get statistics
        stats = await executor.get_workflow_statistics(workflow_id)

        return WorkflowStatisticsResponse(
            workflow_id=workflow_id,
            **stats
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


@router.get("/statistics", response_model=WorkflowStatisticsResponse)
async def get_user_workflow_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get workflow statistics for the current user."""
    try:
        executor = await get_workflow_executor(db)

        # Get statistics for all user workflows
        stats = await executor.get_workflow_statistics()

        return WorkflowStatisticsResponse(
            workflow_id=None,
            **stats
        )

    except Exception as e:
        logger.error(f"Failed to get user statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


# Utility functions

async def monitor_execution_timeout(execution_id: UUID, timeout_seconds: int):
    """Background task to monitor execution timeout."""
    await asyncio.sleep(timeout_seconds)

    # Check if execution is still running and cancel if needed
    from app.core.database import get_db_session
    async with get_db_session() as db:
        executor = await get_workflow_executor(db)
        execution = await executor.get_execution_status(execution_id)

        if execution and execution.is_running():
            await executor.cancel_execution(execution_id, f"Execution timeout after {timeout_seconds} seconds")


# Node and connection management endpoints

@router.post("/{workflow_id}/nodes", response_model=Dict[str, str])
async def add_workflow_node(
    workflow_id: UUID,
    request: NodeCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a node to existing workflow."""
    try:
        # Get workflow and check permissions
        result = await db.execute(
            select(Workflow).where(
                (Workflow.id == workflow_id) &
                (Workflow.owner_id == current_user.id)
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Create node
        node_data = request.dict()
        node_id = f"node_{uuid4().hex[:8]}"
        node_data['id'] = node_id

        # Add node to workflow
        workflow.nodes.append(node_data)
        workflow.updated_at = datetime.utcnow()
        workflow.is_validated = False  # Re-validation required

        await db.commit()

        return {"node_id": node_id, "message": "Node added successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add node: {e}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to add node: {str(e)}")


@router.post("/{workflow_id}/connections", response_model=Dict[str, str])
async def add_workflow_connection(
    workflow_id: UUID,
    request: ConnectionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a connection to existing workflow."""
    try:
        # Get workflow and check permissions
        result = await db.execute(
            select(Workflow).where(
                (Workflow.id == workflow_id) &
                (Workflow.owner_id == current_user.id)
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Validate nodes exist
        node_ids = [node.get('id') for node in workflow.nodes]
        if request.source_node_id not in node_ids:
            raise HTTPException(status_code=400, detail="Source node not found")
        if request.target_node_id not in node_ids:
            raise HTTPException(status_code=400, detail="Target node not found")

        # Create connection
        connection_data = request.dict()
        connection_id = f"conn_{uuid4().hex[:8]}"
        connection_data['id'] = connection_id

        # Add connection to workflow
        workflow.connections.append(connection_data)
        workflow.updated_at = datetime.utcnow()
        workflow.is_validated = False  # Re-validation required

        await db.commit()

        return {"connection_id": connection_id, "message": "Connection added successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add connection: {e}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to add connection: {str(e)}")


# Node type templates endpoint

@router.get("/templates/node-types")
async def get_node_type_templates(
    current_user: User = Depends(get_current_user)
):
    """Get available workflow node types with configuration templates."""
    try:
        node_types = [
            {
                "type": NodeType.START,
                "name": "Start",
                "description": "Workflow entry point where execution begins",
                "category": "control",
                "icon": "play_arrow",
                "color": "#4CAF50",
                "inputs": [],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {},
                "examples": [
                    {
                        "name": "Basic Start",
                        "config": {}
                    }
                ]
            },
            {
                "type": NodeType.END,
                "name": "End",
                "description": "Workflow exit point where execution terminates",
                "category": "control",
                "icon": "stop",
                "color": "#F44336",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [],
                "config_schema": {},
                "examples": [
                    {
                        "name": "Basic End",
                        "config": {}
                    }
                ]
            },
            {
                "type": NodeType.AGENT,
                "name": "AI Agent",
                "description": "Execute task using specialized AI agent",
                "category": "ai",
                "icon": "smart_toy",
                "color": "#2196F3",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "agent_type": {
                            "type": "string",
                            "enum": ["browser", "conversational", "infrastructure", "data"],
                            "title": "Agent Type",
                            "description": "Type of AI agent to use"
                        },
                        "task_description": {
                            "type": "string",
                            "title": "Task Description",
                            "description": "Description of the task for the agent"
                        },
                        "parameters": {
                            "type": "object",
                            "title": "Parameters",
                            "description": "Additional parameters for the agent"
                        }
                    },
                    "required": ["agent_type", "task_description"]
                },
                "examples": [
                    {
                        "name": "Web Scraping",
                        "config": {
                            "agent_type": "browser",
                            "task_description": "Scrape product information from e-commerce website",
                            "parameters": {"url": "https://example.com/products"}
                        }
                    },
                    {
                        "name": "Data Analysis",
                        "config": {
                            "agent_type": "conversational",
                            "task_description": "Analyze sales data and provide insights",
                            "parameters": {"data_format": "csv", "analysis_type": "trend"}
                        }
                    }
                ]
            },
            {
                "type": NodeType.MCP_TOOL,
                "name": "MCP Tool",
                "description": "Execute Model Context Protocol tool",
                "category": "tools",
                "icon": "build",
                "color": "#FF9800",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "tool_name": {
                            "type": "string",
                            "title": "Tool Name",
                            "description": "Name of the MCP tool to execute"
                        },
                        "parameters": {
                            "type": "object",
                            "title": "Parameters",
                            "description": "Parameters for the MCP tool"
                        }
                    },
                    "required": ["tool_name"]
                },
                "examples": [
                    {
                        "name": "File Processing",
                        "config": {
                            "tool_name": "file_processor",
                            "parameters": {"action": "extract_text", "file_path": "{{input.file_path}}"}
                        }
                    }
                ]
            },
            {
                "type": NodeType.CONDITION,
                "name": "Condition",
                "description": "Conditional branching based on expression evaluation",
                "category": "logic",
                "icon": "call_split",
                "color": "#9C27B0",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [
                    {"id": "true", "name": "True", "type": "any"},
                    {"id": "false", "name": "False", "type": "any"}
                ],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "condition": {
                            "type": "string",
                            "title": "Condition",
                            "description": "JavaScript-like condition to evaluate"
                        }
                    },
                    "required": ["condition"]
                },
                "examples": [
                    {
                        "name": "Check Success",
                        "config": {
                            "condition": "{{prev_node_result.success}} == true"
                        }
                    },
                    {
                        "name": "Value Range",
                        "config": {
                            "condition": "{{input.value}} > 100 && {{input.value}} < 1000"
                        }
                    }
                ]
            },
            {
                "type": NodeType.HTTP_REQUEST,
                "name": "HTTP Request",
                "description": "Make HTTP API requests to external services",
                "category": "integration",
                "icon": "http",
                "color": "#607D8B",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Response", "type": "object"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "method": {
                            "type": "string",
                            "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                            "title": "HTTP Method"
                        },
                        "url": {
                            "type": "string",
                            "title": "URL",
                            "description": "API endpoint URL"
                        },
                        "headers": {
                            "type": "object",
                            "title": "Headers",
                            "description": "HTTP headers"
                        },
                        "data": {
                            "type": "object",
                            "title": "Request Body",
                            "description": "JSON payload for POST/PUT requests"
                        },
                        "timeout": {
                            "type": "integer",
                            "title": "Timeout",
                            "description": "Request timeout in seconds",
                            "default": 30
                        }
                    },
                    "required": ["method", "url"]
                },
                "examples": [
                    {
                        "name": "Get User Data",
                        "config": {
                            "method": "GET",
                            "url": "https://api.example.com/users/{{input.user_id}}",
                            "headers": {"Authorization": "Bearer {{input.token}}"}
                        }
                    },
                    {
                        "name": "Create Record",
                        "config": {
                            "method": "POST",
                            "url": "https://api.example.com/records",
                            "data": {"name": "{{input.name}}", "value": "{{input.value}}"}
                        }
                    }
                ]
            },
            {
                "type": NodeType.TRANSFORM,
                "name": "Transform",
                "description": "Transform and process data using custom scripts",
                "category": "data",
                "icon": "transform",
                "color": "#795548",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "transform_type": {
                            "type": "string",
                            "enum": ["javascript", "python"],
                            "title": "Transform Type",
                            "description": "Scripting language for transformation"
                        },
                        "script": {
                            "type": "string",
                            "title": "Transform Script",
                            "description": "Script to transform the data"
                        }
                    },
                    "required": ["transform_type", "script"]
                },
                "examples": [
                    {
                        "name": "Array Filter",
                        "config": {
                            "transform_type": "javascript",
                            "script": "return data.filter(item => item.active === true)"
                        }
                    },
                    {
                        "name": "Data Mapping",
                        "config": {
                            "transform_type": "javascript",
                            "script": "return data.map(item => ({ id: item.id, name: item.name.toUpperCase() }))"
                        }
                    }
                ]
            },
            {
                "type": NodeType.DELAY,
                "name": "Delay",
                "description": "Wait for specified time before continuing",
                "category": "utility",
                "icon": "schedule",
                "color": "#FFC107",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "delay_seconds": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 3600,
                            "title": "Delay Seconds",
                            "description": "Number of seconds to wait"
                        }
                    },
                    "required": ["delay_seconds"]
                },
                "examples": [
                    {
                        "name": "Wait 5 Seconds",
                        "config": {"delay_seconds": 5}
                    },
                    {
                        "name": "Dynamic Delay",
                        "config": {"delay_seconds": "{{input.delay_time}}"}
                    }
                ]
            },
            {
                "type": NodeType.HUMAN_INPUT,
                "name": "Human Input",
                "description": "Pause workflow and wait for human input",
                "category": "control",
                "icon": "person",
                "color": "#E91E63",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "title": "Prompt",
                            "description": "Message to display to user"
                        },
                        "input_type": {
                            "type": "string",
                            "enum": ["text", "number", "boolean", "json", "file"],
                            "title": "Input Type",
                            "description": "Type of input expected from user"
                        },
                        "options": {
                            "type": "array",
                            "title": "Options",
                            "description": "Predefined options for user to choose from"
                        }
                    },
                    "required": ["prompt"]
                },
                "examples": [
                    {
                        "name": "Approval Required",
                        "config": {
                            "prompt": "Please approve this action",
                            "input_type": "boolean"
                        }
                    },
                    {
                        "name": "Custom Input",
                        "config": {
                            "prompt": "Please provide additional information",
                            "input_type": "text"
                        }
                    }
                ]
            },
            {
                "type": NodeType.WEBHOOK,
                "name": "Webhook",
                "description": "Send webhook notification to external system",
                "category": "integration",
                "icon": "notifications",
                "color": "#00BCD4",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Response", "type": "object"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "webhook_url": {
                            "type": "string",
                            "title": "Webhook URL",
                            "description": "URL to send webhook to"
                        },
                        "method": {
                            "type": "string",
                            "enum": ["POST", "PUT"],
                            "title": "HTTP Method",
                            "default": "POST"
                        },
                        "headers": {
                            "type": "object",
                            "title": "Headers",
                            "description": "HTTP headers for webhook"
                        }
                    },
                    "required": ["webhook_url"]
                },
                "examples": [
                    {
                        "name": "Slack Notification",
                        "config": {
                            "webhook_url": "https://hooks.slack.com/services/...",
                            "method": "POST",
                            "headers": {"Content-Type": "application/json"}
                        }
                    }
                ]
            },
            {
                "type": NodeType.SUB_WORKFLOW,
                "name": "Sub-Workflow",
                "description": "Execute another workflow as a sub-workflow",
                "category": "control",
                "icon": "account_tree",
                "color": "#3F51B5",
                "inputs": [{"id": "default", "name": "Input", "type": "any"}],
                "outputs": [{"id": "default", "name": "Output", "type": "any"}],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "sub_workflow_id": {
                            "type": "string",
                            "title": "Sub-Workflow ID",
                            "description": "ID of the workflow to execute"
                        },
                        "timeout_seconds": {
                            "type": "integer",
                            "title": "Timeout",
                            "description": "Timeout for sub-workflow execution",
                            "default": 300
                        }
                    },
                    "required": ["sub_workflow_id"]
                },
                "examples": [
                    {
                        "name": "Data Processing Pipeline",
                        "config": {
                            "sub_workflow_id": "workflow-data-processing-v2",
                            "timeout_seconds": 600
                        }
                    }
                ]
            }
        ]

        return {"node_types": node_types}

    except Exception as e:
        logger.error(f"Failed to get node types: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve node types")