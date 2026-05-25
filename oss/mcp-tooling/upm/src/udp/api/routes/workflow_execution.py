"""
Workflow execution API endpoints.

REST API for executing LangGraph workflows, monitoring progress,
and managing workflow lifecycle.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from udp.security.permissions import WORKFLOW_EXECUTE, WORKFLOW_READ, WORKFLOW_WRITE
from udp.security.rbac import require_permission
from udp.workflows.dependency_analysis import DependencyAnalysisWorkflow
from udp.workflows.state import DependencyAnalysisState

logger = structlog.get_logger()
router = APIRouter(prefix="/workflows", tags=["workflow-execution"])


# Request/Response Schemas
class WorkflowExecuteRequest(BaseModel):
    """Request to execute a dependency analysis workflow."""

    project_id: UUID = Field(..., description="Project ID to analyze")
    manifest_content: str = Field(..., description="Content of manifest file")
    manifest_filename: str = Field(..., description="Name of manifest file")
    manifest_files: Optional[dict[str, str]] = Field(
        None, description="Additional manifest files for polyglot projects"
    )
    force_reanalysis: bool = Field(
        False, description="Force re-analysis even if recently analyzed"
    )
    workflow_options: Optional[dict[str, Any]] = Field(
        default_factory=dict, description="Workflow execution options"
    )


class WorkflowStatusResponse(BaseModel):
    """Workflow status response."""

    workflow_id: str = Field(..., description="Workflow execution ID")
    status: str = Field(..., description="Current workflow status")
    current_step: str = Field(..., description="Currently executing step")
    progress: float = Field(..., description="Progress percentage (0-100)")
    created_at: str = Field(..., description="Workflow start time")
    updated_at: Optional[str] = Field(None, description="Last update time")
    estimated_completion: Optional[str] = Field(
        None, description="Estimated completion time"
    )
    error_message: Optional[str] = Field(None, description="Error message if failed")


class WorkflowListResponse(BaseModel):
    """Workflow list response."""

    workflows: list[dict[str, Any]] = Field(..., description="List of workflows")
    total: int = Field(..., description="Total number of workflows")
    skip: int = Field(..., description="Number of workflows skipped")
    limit: int = Field(..., description="Maximum number of workflows returned")


class WorkflowResultResponse(BaseModel):
    """Workflow result response."""

    workflow_id: str = Field(..., description="Workflow execution ID")
    status: str = Field(..., description="Final workflow status")
    result: Optional[dict[str, Any]] = Field(
        None, description="Workflow analysis results"
    )
    summary: dict[str, Any] = Field(..., description="Analysis summary")
    recommendations: list[dict[str, Any]] = Field(
        default_factory=list, description="Analysis recommendations"
    )
    vulnerabilities: list[dict[str, Any]] = Field(
        default_factory=list, description="Security vulnerabilities found"
    )
    conflicts: list[dict[str, Any]] = Field(
        default_factory=list, description="Dependency conflicts found"
    )
    license_issues: list[dict[str, Any]] = Field(
        default_factory=list, description="License compliance issues"
    )
    policy_violations: list[dict[str, Any]] = Field(
        default_factory=list, description="Policy violations found"
    )
    execution_time: float = Field(..., description="Total execution time in seconds")
    completed_at: Optional[str] = Field(None, description="Completion timestamp")


# In-memory workflow execution storage (in production would use Redis/Database)
workflow_executions: dict[str, dict[str, Any]] = {}


@router.post(
    "/dependency-analysis",
    response_model=dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
)
async def execute_dependency_analysis_workflow(
    request: WorkflowExecuteRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_permission(WORKFLOW_EXECUTE)),
) -> dict[str, str]:
    """
    Execute dependency analysis workflow using LangGraph.

    Starts a comprehensive dependency analysis including security scanning,
    license compliance, policy evaluation, and AI-powered insights.
    """
    try:
        # Generate unique workflow ID
        workflow_id = str(UUID())

        # Initialize workflow state
        initial_state = DependencyAnalysisState(
            {
                "request_id": workflow_id,
                "organization_id": str(current_user.organization_id)
                if hasattr(current_user, "organization_id")
                else "default",
                "project_id": str(request.project_id),
                "manifest_content": request.manifest_content,
                "manifest_filename": request.manifest_filename,
                "manifest_files": request.manifest_files or {},
                "workflow_options": request.workflow_options or {},
                "force_reanalysis": request.force_reanalysis,
            }
        )

        # Store workflow execution info
        workflow_executions[workflow_id] = {
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "progress": 0.0,
            "current_step": "initialization",
            "user_id": str(current_user.id),
            "project_id": str(request.project_id),
        }

        # Execute workflow in background
        background_tasks.add_task(
            _execute_dependency_analysis_workflow_background,
            workflow_id,
            initial_state,
            str(current_user.id),
        )

        logger.info(
            "Dependency analysis workflow started",
            workflow_id=workflow_id,
            project_id=str(request.project_id),
            user_id=str(current_user.id),
        )

        return {
            "workflow_id": workflow_id,
            "status": "pending",
            "message": "Dependency analysis workflow started successfully",
        }

    except Exception as e:
        logger.error("Failed to start dependency analysis workflow", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start dependency analysis workflow",
        )


async def _execute_dependency_analysis_workflow_background(
    workflow_id: str, initial_state: DependencyAnalysisState, user_id: str
):
    """Background task to execute dependency analysis workflow."""
    try:
        # Update execution status
        workflow_executions[workflow_id].update(
            {
                "status": "running",
                "current_step": "initialization",
                "progress": 5.0,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )

        # Initialize workflow
        workflow_engine = DependencyAnalysisWorkflow(
            organization_id=initial_state.get("organization_id")
        )

        # Update status - workflow initialized
        workflow_executions[workflow_id].update(
            {
                "current_step": "validate_input",
                "progress": 10.0,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )

        # Execute workflow step by step with progress updates
        state = initial_state

        # Step 1: Validate input
        state = await workflow_engine._validate_input(state)
        _update_workflow_progress(workflow_id, "parse_manifest", 20.0)

        # Step 2: Parse manifest
        state = await workflow_engine._parse_manifest(state)
        _update_workflow_progress(workflow_id, "resolve_dependencies", 40.0)

        # Step 3: Resolve dependencies
        state = await workflow_engine._resolve_dependencies(state)
        _update_workflow_progress(workflow_id, "analyze_security", 60.0)

        # Step 4: Security analysis
        state = await workflow_engine._analyze_security(state)
        _update_workflow_progress(workflow_id, "check_licenses", 75.0)

        # Step 5: License checking
        state = await workflow_engine._check_licenses(state)
        _update_workflow_progress(workflow_id, "evaluate_policies", 85.0)

        # Step 6: Policy evaluation
        state = await workflow_engine._evaluate_policies(state)
        _update_workflow_progress(workflow_id, "assess_risk", 90.0)

        # Step 7: Risk assessment
        state = await workflow_engine._assess_risk(state)
        _update_workflow_progress(workflow_id, "finalize_analysis", 95.0)

        # Step 8: Finalize
        state = await workflow_engine._finalize_analysis(state)

        # Mark as completed
        workflow_executions[workflow_id].update(
            {
                "status": "completed",
                "current_step": "completed",
                "progress": 100.0,
                "updated_at": datetime.utcnow().isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
                "result": {
                    "dependencies": state.get("resolved_dependencies", []),
                    "vulnerabilities": state.get("vulnerabilities", []),
                    "conflicts": state.get("conflicts", []),
                    "license_issues": state.get("license_issues", []),
                    "policy_violations": state.get("policy_violations", []),
                    "security_score": state.get("security_score", 10),
                    "license_compliance": state.get("license_compliance", True),
                    "requires_approval": state.get("requires_approval", False),
                    "audit_log": state.get("audit_log", []),
                    "performance_metrics": state.get("performance_metrics", {}),
                    "recommendations": state.get("recommendations", []),
                },
            }
        )

        logger.info(
            "Dependency analysis workflow completed",
            workflow_id=workflow_id,
            final_status=state.get("workflow_status"),
            vulnerabilities_found=len(state.get("vulnerabilities", [])),
            conflicts_found=len(state.get("conflicts", [])),
        )

    except Exception as e:
        logger.error(
            "Dependency analysis workflow failed", workflow_id=workflow_id, error=str(e)
        )
        workflow_executions[workflow_id].update(
            {
                "status": "failed",
                "current_step": "error",
                "error_message": str(e),
                "updated_at": datetime.utcnow().isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
            }
        )


def _update_workflow_progress(workflow_id: str, current_step: str, progress: float):
    """Update workflow execution progress."""
    if workflow_id in workflow_executions:
        workflow_executions[workflow_id].update(
            {
                "current_step": current_step,
                "progress": progress,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )


@router.get("/{workflow_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    workflow_id: str, current_user=Depends(require_permission(WORKFLOW_READ))
) -> WorkflowStatusResponse:
    """
    Get status of a running workflow execution.

    Returns current status, progress, and execution details.
    """
    try:
        if workflow_id not in workflow_executions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow execution not found",
            )

        execution = workflow_executions[workflow_id]

        return WorkflowStatusResponse(
            workflow_id=workflow_id,
            status=execution["status"],
            current_step=execution["current_step"],
            progress=execution["progress"],
            created_at=execution["created_at"],
            updated_at=execution.get("updated_at"),
            estimated_completion=execution.get("estimated_completion"),
            error_message=execution.get("error_message"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get workflow status", workflow_id=workflow_id, error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve workflow status",
        )


@router.get("/{workflow_id}/result", response_model=WorkflowResultResponse)
async def get_workflow_result(
    workflow_id: str, current_user=Depends(require_permission(WORKFLOW_READ))
) -> WorkflowResultResponse:
    """
    Get results of a completed workflow execution.

    Returns comprehensive analysis results including vulnerabilities,
    conflicts, recommendations, and compliance information.
    """
    try:
        if workflow_id not in workflow_executions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow execution not found",
            )

        execution = workflow_executions[workflow_id]

        if execution["status"] not in ["completed", "completed_with_warnings"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow has not completed yet",
            )

        result = execution.get("result", {})

        # Calculate execution time
        created_at = datetime.fromisoformat(execution["created_at"])
        completed_at = (
            datetime.fromisoformat(execution["completed_at"])
            if execution.get("completed_at")
            else datetime.utcnow()
        )
        execution_time = (completed_at - created_at).total_seconds()

        return WorkflowResultResponse(
            workflow_id=workflow_id,
            status=execution["status"],
            result=result,
            summary={
                "total_dependencies": len(result.get("dependencies", [])),
                "vulnerabilities_found": len(result.get("vulnerabilities", [])),
                "conflicts_found": len(result.get("conflicts", [])),
                "license_issues": len(result.get("license_issues", [])),
                "policy_violations": len(result.get("policy_violations", [])),
                "security_score": result.get("security_score", 10),
                "requires_approval": result.get("requires_approval", False),
            },
            recommendations=result.get("recommendations", []),
            vulnerabilities=result.get("vulnerabilities", []),
            conflicts=result.get("conflicts", []),
            license_issues=result.get("license_issues", []),
            policy_violations=result.get("policy_violations", []),
            execution_time=execution_time,
            completed_at=execution.get("completed_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get workflow result", workflow_id=workflow_id, error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve workflow result",
        )


@router.get("/", response_model=WorkflowListResponse)
async def list_workflows(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user=Depends(require_permission(WORKFLOW_READ)),
) -> WorkflowListResponse:
    """
    List workflow executions for the current user.

    Returns paginated list of workflow executions with filtering options.
    """
    try:
        # Filter workflows for current user
        user_workflows = [
            {
                "workflow_id": workflow_id,
                "status": execution["status"],
                "current_step": execution["current_step"],
                "progress": execution["progress"],
                "created_at": execution["created_at"],
                "updated_at": execution.get("updated_at"),
                "completed_at": execution.get("completed_at"),
                "project_id": execution.get("project_id"),
            }
            for workflow_id, execution in workflow_executions.items()
            if execution.get("user_id") == str(current_user.id)
        ]

        # Apply status filter
        if status:
            user_workflows = [w for w in user_workflows if w["status"] == status]

        # Apply pagination
        total = len(user_workflows)
        workflows = user_workflows[skip : skip + limit]

        return WorkflowListResponse(
            workflows=workflows, total=total, skip=skip, limit=limit
        )

    except Exception as e:
        logger.error("Failed to list workflows", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve workflow list",
        )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_workflow(
    workflow_id: str, current_user=Depends(require_permission(WORKFLOW_WRITE))
) -> None:
    """
    Cancel a running workflow execution.

    Cancels a workflow that is currently running or pending.
    """
    try:
        if workflow_id not in workflow_executions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow execution not found",
            )

        execution = workflow_executions[workflow_id]

        if execution["status"] not in ["pending", "running"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel workflow that is not pending or running",
            )

        # Update status to cancelled
        execution.update(
            {
                "status": "cancelled",
                "current_step": "cancelled",
                "progress": execution["progress"],
                "updated_at": datetime.utcnow().isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
            }
        )

        logger.info(
            "Workflow cancelled", workflow_id=workflow_id, user_id=str(current_user.id)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel workflow", workflow_id=workflow_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel workflow",
        )
