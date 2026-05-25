"""
Dependency analysis API endpoints.

REST API endpoints for triggering and monitoring
the LangGraph dependency analysis workflow.
"""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.database import get_async_session
from udp.infrastructure.monitoring import record_workflow_execution, timer
from udp.workflows.dependency_analysis import dependency_analysis_workflow

logger = structlog.get_logger()
router = APIRouter()


@router.post("/analyze")
async def analyze_dependencies_workflow(
    organization_id: UUID,
    manifest_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Trigger dependency analysis workflow.

    Executes the complete LangGraph workflow for dependency analysis
    including security scanning, license compliance, and risk assessment.

    Args:
        organization_id: Organization ID
        manifest_file: Manifest file (package.json, requirements.txt, etc.)

    Returns:
        Workflow execution result with analysis details
    """
    request_id = str(uuid4())

    try:
        logger.info(
            "Starting dependency analysis workflow",
            request_id=request_id,
            organization_id=str(organization_id),
            filename=manifest_file.filename
        )

        # Read manifest content
        content = await manifest_file.read()
        manifest_content = content.decode('utf-8')

        # Prepare initial workflow state
        initial_state = {
            "request_id": request_id,
            "organization_id": str(organization_id),
            "initiator_id": "api_user",  # Would come from authentication
            "manifest_content": manifest_content,
            "manifest_filename": manifest_file.filename,
            "created_at": datetime.utcnow()
        }

        # Execute workflow with metrics
        with timer(
            record_workflow_execution,
            "dependency_analysis",
            str(organization_id),
            "completed"
        ):
            result = await dependency_analysis_workflow.execute(initial_state)

        # Log workflow completion
        logger.info(
            "Dependency analysis workflow completed",
            request_id=request_id,
            status=result.get("workflow_status"),
            risk_level=result.get("risk_level"),
            requires_approval=result.get("requires_approval", False),
            total_dependencies=result.get("total_dependencies", 0)
        )

        # Prepare API response
        response = {
            "request_id": request_id,
            "status": result.get("workflow_status"),
            "analysis_complete": result.get("analysis_complete", False),
            "project_info": {
                "name": result.get("project_name"),
                "version": result.get("project_version"),
                "ecosystem": result.get("ecosystem").value if hasattr(result.get("ecosystem"), 'value') else result.get("ecosystem"),
                "total_dependencies": result.get("total_dependencies", 0)
            },
            "risk_assessment": {
                "overall_score": result.get("overall_risk_score", 0),
                "risk_level": result.get("risk_level", "unknown"),
                "risk_factors": result.get("risk_factors", [])
            },
            "security_analysis": {
                "vulnerability_count": result.get("vulnerability_count", 0),
                "critical_vulnerabilities": result.get("critical_vulnerabilities", 0),
                "high_vulnerabilities": result.get("high_vulnerabilities", 0),
                "security_score": result.get("security_score", 10)
            },
            "compliance": {
                "license_compliance": result.get("license_compliance", True),
                "license_issues": len(result.get("license_issues", [])),
                "policy_violations": len(result.get("policy_violations", [])),
                "blocking_violations": len(result.get("blocking_violations", []))
            },
            "workflow_details": {
                "requires_approval": result.get("requires_approval", False),
                "approval_reasons": result.get("approval_reasons", []),
                "awaiting_approval_from": result.get("awaiting_approval_from", []),
                "human_input_required": result.get("human_input_required", False)
            },
            "recommendations": result.get("recommendations", []),
            "performance": {
                "completed_steps": len(result.get("completed_steps", [])),
                "total_steps": len(result.get("completed_steps", []) + result.get("failed_steps", [])),
                "execution_metrics": result.get("performance_metrics", {})
            }
        }

        # Include full analysis result if completed
        if result.get("analysis_complete"):
            response["full_analysis"] = result.get("analysis_result", {})

        return response

    except Exception as e:
        logger.error(
            "Dependency analysis workflow failed",
            request_id=request_id,
            error=str(e),
            exc_info=True
        )

        # Record failed workflow
        record_workflow_execution("dependency_analysis", str(organization_id), "failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "request_id": request_id,
                "error": "Workflow execution failed",
                "message": str(e)
            }
        )


@router.get("/status/{request_id}")
async def get_analysis_status(
    request_id: str,
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Get workflow execution status.

    Args:
        request_id: Workflow request ID

    Returns:
        Current workflow status and progress
    """
    try:
        # In a real implementation, this would query the database
        # for workflow status using the request_id

        # For now, return a mock status
        return {
            "request_id": request_id,
            "status": "completed",  # Would come from database
            "message": "Analysis workflow status endpoint - implementation pending",
            "progress": {
                "current_step": "finalize_analysis",
                "completed_steps": 9,
                "total_steps": 10,
                "percentage": 90
            }
        }

    except Exception as e:
        logger.error(
            "Failed to get workflow status",
            request_id=request_id,
            error=str(e)
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get workflow status: {str(e)}"
        )


@router.post("/approve/{request_id}")
async def approve_analysis(
    request_id: str,
    approval_data: dict[str, Any],
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Approve pending analysis workflow.

    Args:
        request_id: Workflow request ID
        approval_data: Approval decision and context

    Returns:
        Approval result
    """
    try:
        approver_id = approval_data.get("approver_id")
        decision = approval_data.get("decision")  # approved, rejected
        comments = approval_data.get("comments", "")

        logger.info(
            "Processing workflow approval",
            request_id=request_id,
            approver_id=approver_id,
            decision=decision
        )

        # In a real implementation, this would:
        # 1. Update workflow state in database
        # 2. Continue workflow execution if approved
        # 3. Send notifications to stakeholders

        return {
            "request_id": request_id,
            "approval_status": decision,
            "approver_id": approver_id,
            "approved_at": datetime.utcnow().isoformat(),
            "message": f"Analysis {decision} by {approver_id}",
            "next_steps": [
                "Workflow will continue execution",
                "Implementation team will be notified"
            ] if decision == "approved" else [
                "Workflow has been terminated",
                "Requestor will be notified"
            ]
        }

    except Exception as e:
        logger.error(
            "Failed to process approval",
            request_id=request_id,
            error=str(e)
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process approval: {str(e)}"
        )
