"""
API endpoints for Workflow Orchestration Service
"""

from typing import Dict, List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
from datetime import datetime

from app.services.workflow_orchestration import (
    workflow_orchestration_service,
    WorkflowDefinition,
    TaskDefinition,
    WorkflowTemplate,
    WorkflowStatus,
    TaskStatus,
    TaskType,
    ExecutionStrategy,
    RetryStrategy
)
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter()


# Request/Response Models

class TaskDefinitionModel(BaseModel):
    """API model for task definition"""
    name: str = Field(..., description="Task name")
    type: TaskType = Field(..., description="Task type")
    description: str = Field("", description="Task description")
    config: Dict[str, Any] = Field(default_factory=dict, description="Task configuration")
    dependencies: List[UUID] = Field(default_factory=list, description="Task dependencies")
    conditions: List[str] = Field(default_factory=list, description="Execution conditions")
    timeout_seconds: int = Field(300, description="Task timeout in seconds")
    retry_strategy: RetryStrategy = Field(RetryStrategy.EXPONENTIAL_BACKOFF, description="Retry strategy")
    max_retries: int = Field(3, description="Maximum retry attempts")
    priority: int = Field(100, description="Task priority")
    tags: List[str] = Field(default_factory=list, description="Task tags")
    enabled: bool = Field(True, description="Whether task is enabled")


class WorkflowDefinitionModel(BaseModel):
    """API model for workflow definition"""
    name: str = Field(..., description="Workflow name")
    description: str = Field("", description="Workflow description")
    version: str = Field("1.0.0", description="Workflow version")
    tasks: List[TaskDefinitionModel] = Field(..., description="Workflow tasks")
    execution_strategy: ExecutionStrategy = Field(ExecutionStrategy.ADAPTIVE, description="Execution strategy")
    timeout_seconds: int = Field(3600, description="Workflow timeout in seconds")
    max_parallel_tasks: int = Field(5, description="Maximum parallel tasks")
    auto_retry: bool = Field(True, description="Enable automatic retries")
    notifications: Dict[str, Any] = Field(default_factory=dict, description="Notification settings")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    tags: List[str] = Field(default_factory=list, description="Workflow tags")


class WorkflowTemplateModel(BaseModel):
    """API model for workflow template"""
    name: str = Field(..., description="Template name")
    description: str = Field("", description="Template description")
    category: str = Field("", description="Template category")
    workflow_definition: WorkflowDefinitionModel = Field(..., description="Workflow definition")
    parameters: List[Dict[str, Any]] = Field(default_factory=list, description="Template parameters")
    public: bool = Field(False, description="Whether template is public")


class ExecuteWorkflowRequest(BaseModel):
    """Request model for workflow execution"""
    workflow_id: UUID = Field(..., description="Workflow ID to execute")
    context: Dict[str, Any] = Field(default_factory=dict, description="Execution context")


class CreateFromTemplateRequest(BaseModel):
    """Request model for creating workflow from template"""
    template_id: UUID = Field(..., description="Template ID")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Template parameters")


class WorkflowResponseModel(BaseModel):
    """Response model for workflow operations"""
    status: str = Field(..., description="Operation status")
    workflow_id: Optional[str] = Field(None, description="Workflow ID")
    message: Optional[str] = Field(None, description="Response message")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional data")


class ExecutionStatusResponseModel(BaseModel):
    """Response model for execution status"""
    status: str = Field(..., description="Operation status")
    execution_id: Optional[str] = Field(None, description="Execution ID")
    workflow_status: Optional[str] = Field(None, description="Workflow status")
    progress_percent: Optional[float] = Field(None, description="Progress percentage")
    started_at: Optional[str] = Field(None, description="Start time")
    completed_at: Optional[str] = Field(None, description="Completion time")
    duration_seconds: Optional[float] = Field(None, description="Duration in seconds")
    total_tasks: Optional[int] = Field(None, description="Total task count")
    completed_tasks: Optional[int] = Field(None, description="Completed task count")
    failed_tasks: Optional[int] = Field(None, description="Failed task count")
    task_statuses: Optional[List[Dict[str, Any]]] = Field(None, description="Task status details")


# Workflow Management Endpoints

@router.post("/workflows", response_model=WorkflowResponseModel)
async def create_workflow(
    workflow_data: WorkflowDefinitionModel,
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow definition"""
    try:
        # Convert API model to service model
        tasks = []
        for task_data in workflow_data.tasks:
            task_def = TaskDefinition(
                name=task_data.name,
                type=task_data.type,
                description=task_data.description,
                config=task_data.config,
                dependencies=task_data.dependencies,
                conditions=task_data.conditions,
                timeout_seconds=task_data.timeout_seconds,
                retry_strategy=task_data.retry_strategy,
                max_retries=task_data.max_retries,
                priority=task_data.priority,
                tags=task_data.tags,
                enabled=task_data.enabled
            )
            tasks.append(task_def)

        workflow_def = WorkflowDefinition(
            name=workflow_data.name,
            description=workflow_data.description,
            version=workflow_data.version,
            tasks=tasks,
            execution_strategy=workflow_data.execution_strategy,
            timeout_seconds=workflow_data.timeout_seconds,
            max_parallel_tasks=workflow_data.max_parallel_tasks,
            auto_retry=workflow_data.auto_retry,
            notifications=workflow_data.notifications,
            metadata=workflow_data.metadata,
            created_by=current_user.email,
            tags=workflow_data.tags
        )

        result = await workflow_orchestration_service.create_workflow(workflow_def)

        if result["status"] == "success":
            return WorkflowResponseModel(
                status="success",
                workflow_id=result["workflow_id"],
                message="Workflow created successfully"
            )
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create workflow: {str(e)}")


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get workflow definition by ID"""
    try:
        if workflow_id not in workflow_orchestration_service.workflows:
            raise HTTPException(status_code=404, detail="Workflow not found")

        workflow = workflow_orchestration_service.workflows[workflow_id]

        return {
            "status": "success",
            "workflow": {
                "id": str(workflow.id),
                "name": workflow.name,
                "description": workflow.description,
                "version": workflow.version,
                "task_count": len(workflow.tasks),
                "execution_strategy": workflow.execution_strategy.value,
                "timeout_seconds": workflow.timeout_seconds,
                "max_parallel_tasks": workflow.max_parallel_tasks,
                "auto_retry": workflow.auto_retry,
                "created_at": workflow.created_at.isoformat(),
                "created_by": workflow.created_by,
                "tags": workflow.tags,
                "metadata": workflow.metadata
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow: {str(e)}")


@router.get("/workflows")
async def list_workflows(
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)")
):
    """List all workflows"""
    try:
        workflows = list(workflow_orchestration_service.workflows.values())

        # Filter by tags if provided
        if tags:
            tag_list = [tag.strip() for tag in tags.split(",")]
            workflows = [w for w in workflows if any(tag in w.tags for tag in tag_list)]

        # Apply pagination
        total = len(workflows)
        workflows = workflows[offset:offset + limit]

        return {
            "status": "success",
            "workflows": [
                {
                    "id": str(w.id),
                    "name": w.name,
                    "description": w.description,
                    "version": w.version,
                    "task_count": len(w.tasks),
                    "execution_strategy": w.execution_strategy.value,
                    "created_at": w.created_at.isoformat(),
                    "created_by": w.created_by,
                    "tags": w.tags
                }
                for w in workflows
            ],
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list workflows: {str(e)}")


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Delete a workflow definition"""
    try:
        if workflow_id not in workflow_orchestration_service.workflows:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Check if workflow has active executions
        active_executions = [
            e for e in workflow_orchestration_service.executions.values()
            if e.workflow_id == workflow_id and e.status in [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED]
        ]

        if active_executions:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete workflow with {len(active_executions)} active executions"
            )

        del workflow_orchestration_service.workflows[workflow_id]

        return {
            "status": "success",
            "message": "Workflow deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete workflow: {str(e)}")


# Workflow Execution Endpoints

@router.post("/workflows/{workflow_id}/execute", response_model=WorkflowResponseModel)
async def execute_workflow(
    workflow_id: UUID,
    execution_request: Optional[Dict[str, Any]] = None,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user)
):
    """Execute a workflow"""
    try:
        context = execution_request.get("context", {}) if execution_request else {}

        result = await workflow_orchestration_service.execute_workflow(workflow_id, context)

        if result["status"] == "started":
            return WorkflowResponseModel(
                status="success",
                workflow_id=result["workflow_id"],
                message=f"Workflow execution started: {result['execution_id']}"
            )
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute workflow: {str(e)}")


@router.get("/executions/{execution_id}/status", response_model=ExecutionStatusResponseModel)
async def get_execution_status(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get workflow execution status"""
    try:
        result = await workflow_orchestration_service.get_execution_status(execution_id)

        if result["status"] == "success":
            return ExecutionStatusResponseModel(**result)
        elif result["status"] == "not_found":
            raise HTTPException(status_code=404, detail="Execution not found")
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution status: {str(e)}")


@router.post("/executions/{execution_id}/pause")
async def pause_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Pause workflow execution"""
    try:
        result = await workflow_orchestration_service.pause_workflow(execution_id)

        if result["status"] == "success":
            return {
                "status": "success",
                "message": "Workflow execution paused"
            }
        elif result["status"] == "not_found":
            raise HTTPException(status_code=404, detail="Execution not found")
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pause execution: {str(e)}")


@router.post("/executions/{execution_id}/resume")
async def resume_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Resume paused workflow execution"""
    try:
        result = await workflow_orchestration_service.resume_workflow(execution_id)

        if result["status"] == "success":
            return {
                "status": "success",
                "message": "Workflow execution resumed"
            }
        elif result["status"] == "not_found":
            raise HTTPException(status_code=404, detail="Execution not found")
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume execution: {str(e)}")


@router.post("/executions/{execution_id}/cancel")
async def cancel_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Cancel workflow execution"""
    try:
        result = await workflow_orchestration_service.cancel_workflow(execution_id)

        if result["status"] == "success":
            return {
                "status": "success",
                "message": "Workflow execution cancelled"
            }
        elif result["status"] == "not_found":
            raise HTTPException(status_code=404, detail="Execution not found")
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel execution: {str(e)}")


@router.get("/executions")
async def list_executions(
    current_user: User = Depends(get_current_user),
    workflow_id: Optional[UUID] = Query(None, description="Filter by workflow ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """List workflow executions"""
    try:
        executions = list(workflow_orchestration_service.executions.values())

        # Apply filters
        if workflow_id:
            executions = [e for e in executions if e.workflow_id == workflow_id]

        if status:
            try:
                status_enum = WorkflowStatus(status)
                executions = [e for e in executions if e.status == status_enum]
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

        # Sort by started_at descending
        executions.sort(key=lambda x: x.started_at or datetime.min, reverse=True)

        # Apply pagination
        total = len(executions)
        executions = executions[offset:offset + limit]

        return {
            "status": "success",
            "executions": [
                {
                    "id": str(e.id),
                    "workflow_id": str(e.workflow_id),
                    "status": e.status.value,
                    "started_at": e.started_at.isoformat() if e.started_at else None,
                    "completed_at": e.completed_at.isoformat() if e.completed_at else None,
                    "duration_seconds": e.duration_seconds,
                    "total_tasks": len(e.task_executions),
                    "completed_tasks": len([t for t in e.task_executions if t.status == TaskStatus.COMPLETED]),
                    "failed_tasks": len([t for t in e.task_executions if t.status == TaskStatus.FAILED])
                }
                for e in executions
            ],
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list executions: {str(e)}")


# Template Management Endpoints

@router.post("/templates", response_model=WorkflowResponseModel)
async def create_template(
    template_data: WorkflowTemplateModel,
    current_user: User = Depends(get_current_user)
):
    """Create a workflow template"""
    try:
        # Convert API model to service model
        tasks = []
        for task_data in template_data.workflow_definition.tasks:
            task_def = TaskDefinition(
                name=task_data.name,
                type=task_data.type,
                description=task_data.description,
                config=task_data.config,
                dependencies=task_data.dependencies,
                conditions=task_data.conditions,
                timeout_seconds=task_data.timeout_seconds,
                retry_strategy=task_data.retry_strategy,
                max_retries=task_data.max_retries,
                priority=task_data.priority,
                tags=task_data.tags,
                enabled=task_data.enabled
            )
            tasks.append(task_def)

        workflow_def = WorkflowDefinition(
            name=template_data.workflow_definition.name,
            description=template_data.workflow_definition.description,
            version=template_data.workflow_definition.version,
            tasks=tasks,
            execution_strategy=template_data.workflow_definition.execution_strategy,
            timeout_seconds=template_data.workflow_definition.timeout_seconds,
            max_parallel_tasks=template_data.workflow_definition.max_parallel_tasks,
            auto_retry=template_data.workflow_definition.auto_retry,
            notifications=template_data.workflow_definition.notifications,
            metadata=template_data.workflow_definition.metadata,
            created_by=current_user.email,
            tags=template_data.workflow_definition.tags
        )

        template = WorkflowTemplate(
            name=template_data.name,
            description=template_data.description,
            category=template_data.category,
            workflow_definition=workflow_def,
            parameters=template_data.parameters,
            created_by=current_user.email,
            public=template_data.public
        )

        result = await workflow_orchestration_service.create_template(template)

        if result["status"] == "success":
            return WorkflowResponseModel(
                status="success",
                workflow_id=result["template_id"],
                message="Template created successfully"
            )
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create template: {str(e)}")


@router.get("/templates")
async def list_templates(
    current_user: User = Depends(get_current_user),
    category: Optional[str] = Query(None, description="Filter by category"),
    public_only: bool = Query(False, description="Show only public templates")
):
    """List workflow templates"""
    try:
        result = await workflow_orchestration_service.list_templates(category, public_only)

        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {str(e)}")


@router.post("/templates/{template_id}/create-workflow", response_model=WorkflowResponseModel)
async def create_workflow_from_template(
    template_id: UUID,
    request: CreateFromTemplateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create workflow from template"""
    try:
        result = await workflow_orchestration_service.create_workflow_from_template(
            template_id,
            request.parameters
        )

        if result["status"] == "success":
            return WorkflowResponseModel(
                status="success",
                workflow_id=result["workflow_id"],
                message="Workflow created from template successfully"
            )
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create workflow from template: {str(e)}")


# Analytics and Optimization Endpoints

@router.get("/workflows/{workflow_id}/analytics")
async def get_workflow_analytics(
    workflow_id: UUID,
    days: int = Query(30, ge=1, le=365, description="Analytics period in days"),
    current_user: User = Depends(get_current_user)
):
    """Get workflow execution analytics"""
    try:
        result = await workflow_orchestration_service.get_workflow_analytics(workflow_id, days)

        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@router.get("/analytics")
async def get_global_analytics(
    days: int = Query(30, ge=1, le=365, description="Analytics period in days"),
    current_user: User = Depends(get_current_user)
):
    """Get global workflow analytics"""
    try:
        result = await workflow_orchestration_service.get_workflow_analytics(None, days)

        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get global analytics: {str(e)}")


@router.post("/workflows/{workflow_id}/optimize")
async def optimize_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get AI-powered workflow optimization suggestions"""
    try:
        result = await workflow_orchestration_service.ai_optimize_workflow(workflow_id)

        if result["status"] == "success":
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to optimize workflow: {str(e)}")


# Health and Status Endpoints

@router.get("/health")
async def get_service_health():
    """Get workflow orchestration service health"""
    try:
        result = await workflow_orchestration_service.health_check()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@router.get("/status")
async def get_service_status(
    current_user: User = Depends(get_current_user)
):
    """Get detailed service status"""
    try:
        health = await workflow_orchestration_service.health_check()

        # Add additional status information
        status = {
            **health,
            "service_version": "1.0.0",
            "uptime_seconds": 0,  # Would calculate actual uptime
            "registered_task_types": list(workflow_orchestration_service.task_registry.keys()),
            "recent_executions": len([
                e for e in workflow_orchestration_service.executions.values()
                if e.started_at and e.started_at >= datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            ])
        }

        return status

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get service status: {str(e)}")
