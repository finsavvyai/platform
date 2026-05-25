"""
Workflow management endpoints for Universal Dependency Platform.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.schemas.workflow import (
    WorkflowCreate,
    WorkflowExecutionCreate,
    WorkflowExecutionResponse,
    WorkflowResponse,
)
from udp.infrastructure.database import get_async_session
from udp.security.auth import get_current_user
from udp.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/", response_model=list[WorkflowResponse])
async def list_workflows(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """List available workflows."""
    workflow_service = WorkflowService(db)

    workflows = await workflow_service.list(skip=skip, limit=limit)
    return workflows


@router.post("/", response_model=WorkflowResponse)
async def create_workflow(
    workflow_data: WorkflowCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Create a new workflow."""
    workflow_service = WorkflowService(db)

    workflow = await workflow_service.create(workflow_data, current_user.id)
    return workflow


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get workflow by ID."""
    workflow_service = WorkflowService(db)

    workflow = await workflow_service.get(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return workflow


@router.post("/{workflow_id}/execute", response_model=WorkflowExecutionResponse)
async def execute_workflow(
    workflow_id: str,
    execution_data: WorkflowExecutionCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Execute a workflow."""
    workflow_service = WorkflowService(db)

    execution = await workflow_service.execute(
        workflow_id, execution_data, current_user.id
    )
    return execution


@router.get("/{workflow_id}/executions", response_model=list[WorkflowExecutionResponse])
async def list_workflow_executions(
    workflow_id: str,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """List workflow executions."""
    workflow_service = WorkflowService(db)

    executions = await workflow_service.list_executions(
        workflow_id, skip=skip, limit=limit
    )
    return executions


@router.get("/executions/{execution_id}", response_model=WorkflowExecutionResponse)
async def get_workflow_execution(
    execution_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get workflow execution by ID."""
    workflow_service = WorkflowService(db)

    execution = await workflow_service.get_execution(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Workflow execution not found")

    return execution
