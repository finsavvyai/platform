"""
Policy Violation Management API Routes

This module provides REST API endpoints for managing policy violations,
exception requests, and remediation activities.
"""

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from udp.api.deps import get_current_user, get_db
from udp.core.models.violation import (
    ExceptionStatus,
    PolicyExceptionRequest,
    PolicyViolation,
)
from udp.core.schemas import (
    ExceptionRequestCreate,
    ExceptionRequestResponse,
    ExceptionRequestUpdate,
    PolicyViolationResponse,
    RemediationPlanCreate,
    RemediationPlanResponse,
    ViolationAcknowledgmentRequest,
    ViolationResolutionRequest,
)
from udp.services.violation_service import (
    ExceptionRequestService,
    RemediationService,
    ViolationAnalyticsService,
    ViolationManagementService,
)
from udp.workflows.policy_exception_workflow import PolicyExceptionWorkflow

router = APIRouter()


# Policy Violation Endpoints
@router.get("/violations", response_model=list[PolicyViolationResponse])
async def get_violations(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    status: Optional[list[str]] = Query(None, description="Filter by status"),
    severity: Optional[list[str]] = Query(None, description="Filter by severity"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[PolicyViolationResponse]:
    """
    Get policy violations with optional filtering.

    Supports filtering by project, status, and severity.
    Includes pagination for large result sets.
    """
    service = ViolationManagementService()

    violations, _ = await service.get_violations_for_project(
        db=db,
        project_id=project_id,
        status=status,
        severity=severity,
        limit=limit,
        offset=offset,
    )

    return [PolicyViolationResponse.from_orm(v) for v in violations]


@router.get("/violations/{violation_id}", response_model=PolicyViolationResponse)
async def get_violation(
    violation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> PolicyViolationResponse:
    """Get a specific policy violation by ID."""

    query = select(PolicyViolation).where(PolicyViolation.id == violation_id)
    result = await db.execute(query)
    violation = result.scalar_one_or_none()

    if not violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation {violation_id} not found",
        )

    return PolicyViolationResponse.from_orm(violation)


@router.post("/violations/{violation_id}/acknowledge")
async def acknowledge_violation(
    violation_id: UUID,
    acknowledgment: ViolationAcknowledgmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> PolicyViolationResponse:
    """Acknowledge a policy violation."""

    service = ViolationManagementService()

    try:
        violation = await service.acknowledge_violation(
            db=db,
            violation_id=violation_id,
            user_id=current_user.id,
            comment=acknowledgment.comment,
        )

        return PolicyViolationResponse.from_orm(violation)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/violations/{violation_id}/resolve")
async def resolve_violation(
    violation_id: UUID,
    resolution: ViolationResolutionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> PolicyViolationResponse:
    """Resolve a policy violation."""

    service = ViolationManagementService()

    try:
        violation = await service.resolve_violation(
            db=db,
            violation_id=violation_id,
            user_id=current_user.id,
            resolution_method=resolution.resolution_method,
            comment=resolution.comment,
        )

        return PolicyViolationResponse.from_orm(violation)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/violations/{violation_id}/mark-false-positive")
async def mark_false_positive(
    violation_id: UUID,
    request_data: dict[str, str],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> PolicyViolationResponse:
    """Mark a violation as a false positive."""

    if "reason" not in request_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Reason is required"
        )

    service = ViolationManagementService()

    try:
        violation = await service.mark_false_positive(
            db=db,
            violation_id=violation_id,
            user_id=current_user.id,
            reason=request_data["reason"],
        )

        return PolicyViolationResponse.from_orm(violation)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/violations/{violation_id}/escalate")
async def escalate_violation(
    violation_id: UUID,
    escalation_data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> PolicyViolationResponse:
    """Escalate a policy violation."""

    if "reason" not in escalation_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escalation reason is required",
        )

    service = ViolationManagementService()

    try:
        violation = await service.escalate_violation(
            db=db,
            violation_id=violation_id,
            escalation_reason=escalation_data["reason"],
            escalated_to=escalation_data.get("escalated_to"),
        )

        return PolicyViolationResponse.from_orm(violation)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Exception Request Endpoints
@router.post("/exceptions", response_model=ExceptionRequestResponse)
async def create_exception_request(
    exception_data: ExceptionRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExceptionRequestResponse:
    """Create a new policy exception request."""

    service = ExceptionRequestService()

    try:
        exception = await service.create_exception_request(
            db=db,
            project_id=exception_data.project_id,
            policy_id=exception_data.policy_id,
            requester_id=current_user.id,
            exception_data=exception_data.dict(),
            violation_id=exception_data.violation_id,
        )

        # Initiate workflow if approval is required
        if exception.approval_required:
            workflow = PolicyExceptionWorkflow(current_user.organization_id)
            await workflow.execute(
                exception_request_id=exception.id,
                exception_data={
                    "project_id": exception.project_id,
                    "policy_id": exception.policy_id,
                    "violation_id": exception.violation_id,
                    "requester_id": current_user.id,
                    "exception_type": exception.exception_type,
                    "justification": exception.justification,
                    "business_risk": exception.business_risk,
                },
                context={},
            )

        return ExceptionRequestResponse.from_orm(exception)

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/exceptions", response_model=list[ExceptionRequestResponse])
async def get_exception_requests(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    status: Optional[list[str]] = Query(None, description="Filter by status"),
    exception_type: Optional[list[str]] = Query(
        None, description="Filter by exception type"
    ),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[ExceptionRequestResponse]:
    """Get policy exception requests with filtering."""

    # Build query
    query = select(PolicyExceptionRequest)

    # Apply filters
    if project_id:
        query = query.where(PolicyExceptionRequest.project_id == project_id)
    if status:
        query = query.where(PolicyExceptionRequest.status.in_(status))
    if exception_type:
        query = query.where(PolicyExceptionRequest.exception_type.in_(exception_type))

    # Apply ordering and pagination
    query = (
        query.order_by(desc(PolicyExceptionRequest.submitted_at))
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    exceptions = result.scalars().all()

    return [ExceptionRequestResponse.from_orm(e) for e in exceptions]


@router.get("/exceptions/{exception_id}", response_model=ExceptionRequestResponse)
async def get_exception_request(
    exception_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExceptionRequestResponse:
    """Get a specific exception request by ID."""

    query = select(PolicyExceptionRequest).where(
        PolicyExceptionRequest.id == exception_id
    )
    result = await db.execute(query)
    exception = result.scalar_one_or_none()

    if not exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exception request {exception_id} not found",
        )

    return ExceptionRequestResponse.from_orm(exception)


@router.put("/exceptions/{exception_id}/status")
async def update_exception_status(
    exception_id: UUID,
    status_update: ExceptionRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExceptionRequestResponse:
    """Update the status of an exception request."""

    service = ExceptionRequestService()

    try:
        exception = await service.update_exception_status(
            db=db,
            exception_id=exception_id,
            new_status=ExceptionStatus(status_update.status),
            user_id=current_user.id,
            reason=status_update.reason,
            approval_conditions=status_update.approval_conditions,
        )

        return ExceptionRequestResponse.from_orm(exception)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/exceptions/{exception_id}/cancel")
async def cancel_exception_request(
    exception_id: UUID,
    cancellation_data: dict[str, str],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExceptionRequestResponse:
    """Cancel an exception request."""

    if "reason" not in cancellation_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancellation reason is required",
        )

    service = ExceptionRequestService()

    try:
        exception = await service.cancel_exception_request(
            db=db,
            exception_id=exception_id,
            user_id=current_user.id,
            reason=cancellation_data["reason"],
        )

        return ExceptionRequestResponse.from_orm(exception)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Remediation Endpoints
@router.post(
    "/violations/{violation_id}/remediation", response_model=RemediationPlanResponse
)
async def create_remediation_plan(
    violation_id: UUID,
    remediation_data: RemediationPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> RemediationPlanResponse:
    """Create a remediation plan for a violation."""

    service = RemediationService()

    try:
        remediation = await service.create_remediation_plan(
            db=db,
            violation_id=violation_id,
            remediation_data=remediation_data.dict(),
            assigned_to_id=remediation_data.assigned_to_id or current_user.id,
        )

        return RemediationPlanResponse.from_orm(remediation)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/remediation/{remediation_id}/progress")
async def update_remediation_progress(
    remediation_id: UUID,
    progress_data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> RemediationPlanResponse:
    """Update remediation progress."""

    if "progress_percentage" not in progress_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Progress percentage is required",
        )

    if "steps_completed" not in progress_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Steps completed list is required",
        )

    service = RemediationService()

    try:
        remediation = await service.update_remediation_progress(
            db=db,
            remediation_id=remediation_id,
            progress_percentage=progress_data["progress_percentage"],
            steps_completed=progress_data["steps_completed"],
            completed_by_id=current_user.id,
        )

        return RemediationPlanResponse.from_orm(remediation)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Analytics and Metrics Endpoints
@router.get("/analytics/metrics")
async def get_violation_metrics(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    days_back: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Get violation metrics and analytics."""

    service = ViolationAnalyticsService()

    metrics = await service.get_violation_metrics(
        db=db, project_id=project_id, days_back=days_back
    )

    return metrics


@router.get("/analytics/trends")
async def get_violation_trends(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    days_back: int = Query(90, ge=7, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get violation trends over time."""

    service = ViolationAnalyticsService()

    trends = await service.get_violation_trends(
        db=db, project_id=project_id, days_back=days_back
    )

    return trends


@router.get("/analytics/top-violating-policies")
async def get_top_violating_policies(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    limit: int = Query(10, ge=1, le=50, description="Number of policies to return"),
    days_back: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get policies with the most violations."""

    service = ViolationAnalyticsService()

    top_policies = await service.get_top_violating_policies(
        db=db, project_id=project_id, limit=limit, days_back=days_back
    )

    return top_policies


@router.get("/overdue-violations")
async def get_overdue_violations(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    hours_threshold: int = Query(
        24, ge=1, le=720, description="Hours threshold for overdue"
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[PolicyViolationResponse]:
    """Get violations that are overdue for resolution."""

    service = ViolationManagementService()

    violations = await service.get_overdue_violations(
        db=db, hours_threshold=hours_threshold
    )

    # Filter by project if specified
    if project_id:
        violations = [v for v in violations if v.project_id == project_id]

    return [PolicyViolationResponse.from_orm(v) for v in violations]


@router.get("/active-exceptions")
async def get_active_exceptions(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[ExceptionRequestResponse]:
    """Get all currently active exception requests."""

    service = ExceptionRequestService()

    exceptions = await service.get_active_exceptions(db=db, project_id=project_id)

    return [ExceptionRequestResponse.from_orm(e) for e in exceptions]


@router.get("/exceptions-expiring-soon")
async def get_exceptions_expiring_soon(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    days_ahead: int = Query(30, ge=1, le=365, description="Days ahead to check"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[ExceptionRequestResponse]:
    """Get exceptions that will expire soon."""

    service = ExceptionRequestService()

    exceptions = await service.get_exceptions_expiring_soon(
        db=db, days_ahead=days_ahead
    )

    # Filter by project if specified
    if project_id:
        exceptions = [e for e in exceptions if e.project_id == project_id]

    return [ExceptionRequestResponse.from_orm(e) for e in exceptions]
