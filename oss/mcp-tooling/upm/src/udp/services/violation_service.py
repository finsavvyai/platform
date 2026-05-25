"""
Policy Violation Service for UPM - Enterprise Violation Management

This module provides comprehensive policy violation management capabilities:
- Violation detection and creation
- Violation tracking and lifecycle management
- Exception request processing
- Remediation tracking and management
- Violation analytics and reporting
"""

from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.models.policy import PolicyEvaluation
from udp.core.models.violation import (
    ExceptionActivity,
    ExceptionStatus,
    ExceptionType,
    PolicyExceptionRequest,
    PolicyViolation,
    RemediationType,
    ViolationRemediation,
    ViolationSeverity,
    ViolationStatus,
)
from udp.services.base import BaseService


class ViolationDetectionService(BaseService):
    """Service for detecting and creating policy violations."""

    async def create_violation_from_evaluation(
        self,
        db: AsyncSession,
        evaluation: PolicyEvaluation,
        violation_details: dict[str, Any],
        **kwargs,
    ) -> PolicyViolation:
        """Create a policy violation from a policy evaluation."""

        # Check if similar violation already exists
        existing_violation = await self._find_similar_violation(
            db, evaluation, violation_details
        )

        if existing_violation:
            # Update existing violation
            existing_violation.recurrence_count += 1
            existing_violation.last_seen_at = datetime.utcnow()
            existing_violation.status = ViolationStatus.OPEN

            await db.commit()
            return existing_violation

        # Create new violation
        violation = PolicyViolation(
            project_id=evaluation.project_id,
            analysis_id=evaluation.analysis_id,
            policy_id=evaluation.policy_id,
            policy_evaluation_id=evaluation.id,
            violation_key=violation_details.get(
                "violation_key", f"violation_{uuid4().hex[:8]}"
            ),
            title=violation_details.get(
                "title", f"Policy Violation: {evaluation.policy.name}"
            ),
            description=violation_details.get("description", evaluation.result_message),
            severity=violation_details.get("severity", ViolationSeverity.MEDIUM),
            category=violation_details.get("category", "policy"),
            tags=violation_details.get("tags", []),
            violation_details=violation_details.get("details", {}),
            detected_at=datetime.utcnow(),
            first_detected_at=datetime.utcnow(),
            risk_score=violation_details.get("risk_score"),
            business_impact=violation_details.get("business_impact"),
            technical_impact=violation_details.get("technical_impact"),
            affected_components=violation_details.get("affected_components", []),
            affected_versions=violation_details.get("affected_versions", {}),
            remediation_required=violation_details.get("remediation_required", True),
            remediation_type=violation_details.get("remediation_type"),
            remediation_steps=violation_details.get("remediation_steps", []),
            remediation_complexity=violation_details.get(
                "remediation_complexity", "medium"
            ),
            estimated_remediation_time=violation_details.get(
                "estimated_remediation_hours"
            ),
            exception_requestable=violation_details.get("exception_requestable", True),
            auto_exception_eligible=violation_details.get(
                "auto_exception_eligible", False
            ),
            detection_source=violation_details.get(
                "detection_source", "automated_scan"
            ),
            false_positive_indicator=violation_details.get("false_positive", False),
            dependency_id=kwargs.get("dependency_id"),
            package_id=kwargs.get("package_id"),
        )

        db.add(violation)
        await db.commit()
        await db.refresh(violation)

        # Log violation creation
        await self._log_violation_activity(
            db,
            violation,
            "violation_created",
            f"Policy violation detected: {violation.title}",
        )

        return violation

    async def _find_similar_violation(
        self,
        db: AsyncSession,
        evaluation: PolicyEvaluation,
        violation_details: dict[str, Any],
    ) -> Optional[PolicyViolation]:
        """Find existing similar violation for the same policy and project."""

        query = select(PolicyViolation).where(
            and_(
                PolicyViolation.project_id == evaluation.project_id,
                PolicyViolation.policy_id == evaluation.policy_id,
                PolicyViolation.violation_key == violation_details.get("violation_key"),
                PolicyViolation.status.in_(
                    [
                        ViolationStatus.OPEN,
                        ViolationStatus.IN_PROGRESS,
                        ViolationStatus.ACKNOWLEDGED,
                    ]
                ),
            )
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def _log_violation_activity(
        self,
        db: AsyncSession,
        violation: PolicyViolation,
        activity_type: str,
        description: str,
        user_id: Optional[UUID] = None,
        **kwargs,
    ) -> None:
        """Log activity for a violation (would use a separate activity model in production)."""
        # This would integrate with a general activity logging system
        pass


class ViolationManagementService(BaseService):
    """Service for managing policy violations throughout their lifecycle."""

    async def acknowledge_violation(
        self,
        db: AsyncSession,
        violation_id: UUID,
        user_id: UUID,
        comment: Optional[str] = None,
    ) -> PolicyViolation:
        """Acknowledge a policy violation."""

        stmt = (
            update(PolicyViolation)
            .where(PolicyViolation.id == violation_id)
            .values(
                status=ViolationStatus.ACKNOWLEDGED,
                acknowledged_at=datetime.utcnow(),
                acknowledged_by=user_id,
            )
        )

        await db.execute(stmt)
        await db.commit()

        # Get updated violation
        query = select(PolicyViolation).where(PolicyViolation.id == violation_id)
        result = await db.execute(query)
        violation = result.scalar_one()

        # Log acknowledgment
        await self._create_activity(
            db,
            violation,
            "violation_acknowledged",
            f"Violation acknowledged by user {user_id}",
            user_id=user_id,
        )

        return violation

    async def resolve_violation(
        self,
        db: AsyncSession,
        violation_id: UUID,
        user_id: UUID,
        resolution_method: str,
        comment: Optional[str] = None,
    ) -> PolicyViolation:
        """Mark a policy violation as resolved."""

        stmt = (
            update(PolicyViolation)
            .where(PolicyViolation.id == violation_id)
            .values(
                status=ViolationStatus.RESOLVED,
                resolved_at=datetime.utcnow(),
                resolved_by=user_id,
            )
        )

        await db.execute(stmt)
        await db.commit()

        # Get updated violation
        query = select(PolicyViolation).where(PolicyViolation.id == violation_id)
        result = await db.execute(query)
        violation = result.scalar_one()

        # Log resolution
        await self._create_activity(
            db,
            violation,
            "violation_resolved",
            f"Violation resolved using {resolution_method} by user {user_id}",
            user_id=user_id,
            resolution_method=resolution_method,
            comment=comment,
        )

        return violation

    async def mark_false_positive(
        self, db: AsyncSession, violation_id: UUID, user_id: UUID, reason: str
    ) -> PolicyViolation:
        """Mark a violation as a false positive."""

        stmt = (
            update(PolicyViolation)
            .where(PolicyViolation.id == violation_id)
            .values(
                status=ViolationStatus.FALSE_POSITIVE,
                resolved_at=datetime.utcnow(),
                resolved_by=user_id,
                false_positive_indicator=True,
            )
        )

        await db.execute(stmt)
        await db.commit()

        # Get updated violation
        query = select(PolicyViolation).where(PolicyViolation.id == violation_id)
        result = await db.execute(query)
        violation = result.scalar_one()

        # Log false positive marking
        await self._create_activity(
            db,
            violation,
            "violation_false_positive",
            f"Violation marked as false positive: {reason}",
            user_id=user_id,
            reason=reason,
        )

        return violation

    async def escalate_violation(
        self,
        db: AsyncSession,
        violation_id: UUID,
        escalation_reason: str,
        escalated_to: Optional[UUID] = None,
    ) -> PolicyViolation:
        """Escalate a policy violation."""

        stmt = (
            update(PolicyViolation)
            .where(PolicyViolation.id == violation_id)
            .values(status=ViolationStatus.ESCALATED)
        )

        await db.execute(stmt)
        await db.commit()

        # Get updated violation
        query = select(PolicyViolation).where(PolicyViolation.id == violation_id)
        result = await db.execute(query)
        violation = result.scalar_one()

        # Log escalation
        await self._create_activity(
            db,
            violation,
            "violation_escalated",
            f"Violation escalated: {escalation_reason}",
            escalated_to=escalated_to,
            reason=escalation_reason,
        )

        return violation

    async def get_violations_for_project(
        self,
        db: AsyncSession,
        project_id: UUID,
        status: Optional[list[str]] = None,
        severity: Optional[list[str]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[PolicyViolation], int]:
        """Get violations for a project with filtering."""

        query = select(PolicyViolation).where(PolicyViolation.project_id == project_id)

        # Apply filters
        if status:
            query = query.where(PolicyViolation.status.in_(status))
        if severity:
            query = query.where(PolicyViolation.severity.in_(severity))

        # Get total count
        count_query = select(func.count(PolicyViolation.id)).where(
            PolicyViolation.project_id == project_id
        )
        if status:
            count_query = count_query.where(PolicyViolation.status.in_(status))
        if severity:
            count_query = count_query.where(PolicyViolation.severity.in_(severity))

        # Apply ordering and pagination
        query = (
            query.order_by(
                desc(PolicyViolation.severity), desc(PolicyViolation.detected_at)
            )
            .offset(offset)
            .limit(limit)
        )

        # Execute queries
        result = await db.execute(query)
        violations = result.scalars().all()

        count_result = await db.execute(count_query)
        total_count = count_result.scalar()

        return violations, total_count

    async def get_overdue_violations(
        self, db: AsyncSession, hours_threshold: int = 24
    ) -> list[PolicyViolation]:
        """Get violations that are overdue for resolution."""

        threshold_time = datetime.utcnow() - timedelta(hours=hours_threshold)

        # Define SLA thresholds by severity
        sla_thresholds = {
            ViolationSeverity.CRITICAL: 24,
            ViolationSeverity.HIGH: 72,
            ViolationSeverity.MEDIUM: 168,  # 1 week
            ViolationSeverity.LOW: 720,  # 30 days
        }

        conditions = []
        for severity, sla_hours in sla_thresholds.items():
            sla_threshold = datetime.utcnow() - timedelta(hours=sla_hours)
            conditions.append(
                and_(
                    PolicyViolation.severity == severity,
                    PolicyViolation.detected_at <= sla_threshold,
                    PolicyViolation.status.in_(
                        [
                            ViolationStatus.OPEN,
                            ViolationStatus.IN_PROGRESS,
                            ViolationStatus.ACKNOWLEDGED,
                        ]
                    ),
                )
            )

        query = select(PolicyViolation).where(or_(*conditions))
        result = await db.execute(query)
        return result.scalars().all()

    async def _create_activity(
        self,
        db: AsyncSession,
        violation: PolicyViolation,
        activity_type: str,
        description: str,
        **kwargs,
    ) -> None:
        """Create an activity record for the violation."""
        # This would create an activity record in a separate activity table
        # For now, just log the activity
        pass


class ExceptionRequestService(BaseService):
    """Service for managing policy exception requests."""

    async def create_exception_request(
        self,
        db: AsyncSession,
        project_id: UUID,
        policy_id: UUID,
        requester_id: UUID,
        exception_data: dict[str, Any],
        violation_id: Optional[UUID] = None,
    ) -> PolicyExceptionRequest:
        """Create a new policy exception request."""

        exception = PolicyExceptionRequest(
            project_id=project_id,
            violation_id=violation_id,
            policy_id=policy_id,
            requester_id=requester_id,
            exception_key=exception_data.get(
                "exception_key", f"exception_{uuid4().hex[:8]}"
            ),
            title=exception_data.get("title", "Policy Exception Request"),
            description=exception_data.get("description", ""),
            exception_type=exception_data.get(
                "exception_type", ExceptionType.TEMPORARY
            ),
            category=exception_data.get("category"),
            priority=exception_data.get("priority", "medium"),
            justification=exception_data.get("justification", ""),
            business_risk=exception_data.get("business_risk"),
            mitigation_plan=exception_data.get("mitigation_plan"),
            scope=exception_data.get("scope", {}),
            conditions=exception_data.get("conditions", []),
            start_date=exception_data.get("start_date"),
            end_date=exception_data.get("end_date"),
            duration_days=exception_data.get("duration_days"),
            review_required=exception_data.get("review_required", True),
            approval_required=exception_data.get("approval_required", True),
            required_approvers=exception_data.get("required_approvers", []),
            monitoring_required=exception_data.get("monitoring_required", True),
            compliance_checks=exception_data.get("compliance_checks", []),
            risk_assessment=exception_data.get("risk_assessment", {}),
            risk_score=exception_data.get("risk_score"),
            tags=exception_data.get("tags", []),
            metadata=exception_data.get("metadata", {}),
        )

        db.add(exception)
        await db.commit()
        await db.refresh(exception)

        # Create initial activity
        await self._create_exception_activity(
            db,
            exception,
            "exception_created",
            f"Exception request created by user {requester_id}",
            user_id=requester_id,
        )

        # If approval is required, initiate approval workflow
        if exception.approval_required:
            await self._initiate_approval_workflow(db, exception)

        return exception

    async def update_exception_status(
        self,
        db: AsyncSession,
        exception_id: UUID,
        new_status: ExceptionStatus,
        user_id: UUID,
        reason: Optional[str] = None,
        approval_conditions: Optional[list[dict[str, Any]]] = None,
    ) -> PolicyExceptionRequest:
        """Update the status of an exception request."""

        # Get the exception
        query = select(PolicyExceptionRequest).where(
            PolicyExceptionRequest.id == exception_id
        )
        result = await db.execute(query)
        exception = result.scalar_one_or_none()

        if not exception:
            raise ValueError(f"Exception request {exception_id} not found")

        # Update status and related fields
        old_status = exception.status
        exception.status = new_status

        if new_status in [ExceptionStatus.APPROVED, ExceptionStatus.REJECTED]:
            exception.decided_at = datetime.utcnow()
            exception.approver_id = user_id
            exception.decision = (
                "approved" if new_status == ExceptionStatus.APPROVED else "rejected"
            )
            exception.decision_reason = reason

            if approval_conditions:
                exception.approval_conditions = approval_conditions

        if new_status == ExceptionStatus.IMPLEMENTED:
            exception.implemented_at = datetime.utcnow()

        await db.commit()

        # Log status change
        await self._create_exception_activity(
            db,
            exception,
            "status_changed",
            f"Status changed from {old_status} to {new_status}: {reason or 'No reason provided'}",
            user_id=user_id,
            old_status=old_status,
            new_status=new_status,
            reason=reason,
        )

        # If approved and has associated violation, update violation status
        if new_status == ExceptionStatus.APPROVED and exception.violation_id:
            await self._update_violation_for_exception(db, exception)

        return exception

    async def get_active_exceptions(
        self, db: AsyncSession, project_id: Optional[UUID] = None
    ) -> list[PolicyExceptionRequest]:
        """Get all currently active exception requests."""

        query = select(PolicyExceptionRequest).where(
            PolicyExceptionRequest.status == ExceptionStatus.APPROVED
        )

        if project_id:
            query = query.where(PolicyExceptionRequest.project_id == project_id)

        # Filter for active (not expired) exceptions
        now = datetime.utcnow()
        query = query.where(
            or_(
                PolicyExceptionRequest.end_date.is_(None),
                PolicyExceptionRequest.end_date > now,
            )
        )

        result = await db.execute(query)
        return result.scalars().all()

    async def get_exceptions_expiring_soon(
        self, db: AsyncSession, days_ahead: int = 30
    ) -> list[PolicyExceptionRequest]:
        """Get exceptions that will expire soon."""

        future_date = datetime.utcnow() + timedelta(days=days_ahead)

        query = select(PolicyExceptionRequest).where(
            and_(
                PolicyExceptionRequest.status == ExceptionStatus.APPROVED,
                PolicyExceptionRequest.end_date.isnot(None),
                PolicyExceptionRequest.end_date <= future_date,
                PolicyExceptionRequest.end_date > datetime.utcnow(),
            )
        )

        result = await db.execute(query)
        return result.scalars().all()

    async def cancel_exception_request(
        self, db: AsyncSession, exception_id: UUID, user_id: UUID, reason: str
    ) -> PolicyExceptionRequest:
        """Cancel an exception request."""

        query = select(PolicyExceptionRequest).where(
            PolicyExceptionRequest.id == exception_id
        )
        result = await db.execute(query)
        exception = result.scalar_one_or_none()

        if not exception:
            raise ValueError(f"Exception request {exception_id} not found")

        if not exception.can_be_cancelled(user_id):
            raise ValueError("Exception request cannot be cancelled")

        exception.status = ExceptionStatus.CANCELLED

        await db.commit()

        # Log cancellation
        await self._create_exception_activity(
            db,
            exception,
            "exception_cancelled",
            f"Exception request cancelled: {reason}",
            user_id=user_id,
            reason=reason,
        )

        return exception

    async def _initiate_approval_workflow(
        self, db: AsyncSession, exception: PolicyExceptionRequest
    ) -> UUID:
        """Initiate approval workflow for an exception request."""

        # This would integrate with the existing approval workflow system
        # For now, return a mock workflow ID
        workflow_id = uuid4()

        # Update exception with workflow ID
        exception.workflow_id = workflow_id
        await db.commit()

        # Create activity
        await self._create_exception_activity(
            db,
            exception,
            "approval_workflow_initiated",
            f"Approval workflow initiated: {workflow_id}",
        )

        return workflow_id

    async def _update_violation_for_exception(
        self, db: AsyncSession, exception: PolicyExceptionRequest
    ) -> None:
        """Update associated violation when exception is approved."""

        if not exception.violation_id:
            return

        stmt = (
            update(PolicyViolation)
            .where(PolicyViolation.id == exception.violation_id)
            .values(status=ViolationStatus.ACCEPTED)
        )

        await db.execute(stmt)
        await db.commit()

    async def _create_exception_activity(
        self,
        db: AsyncSession,
        exception: PolicyExceptionRequest,
        activity_type: str,
        description: str,
        **kwargs,
    ) -> ExceptionActivity:
        """Create an activity record for the exception request."""

        activity = ExceptionActivity(
            exception_request_id=exception.id,
            user_id=kwargs.get("user_id"),
            activity_type=activity_type,
            title=activity_type.replace("_", " ").title(),
            description=description,
            old_values=kwargs.get("old_values", {}),
            new_values=kwargs.get("new_values", {}),
            activity_data=kwargs,
            ip_address=kwargs.get("ip_address"),
            user_agent=kwargs.get("user_agent"),
        )

        db.add(activity)
        await db.commit()
        await db.refresh(activity)

        return activity


class RemediationService(BaseService):
    """Service for managing violation remediation activities."""

    async def create_remediation_plan(
        self,
        db: AsyncSession,
        violation_id: UUID,
        remediation_data: dict[str, Any],
        assigned_to_id: Optional[UUID] = None,
    ) -> ViolationRemediation:
        """Create a remediation plan for a violation."""

        remediation = ViolationRemediation(
            violation_id=violation_id,
            assigned_to_id=assigned_to_id,
            remediation_type=remediation_data.get(
                "remediation_type", RemediationType.MANUAL
            ),
            title=remediation_data.get("title", "Violation Remediation"),
            description=remediation_data.get("description", ""),
            status="in_progress",
            progress_percentage=0,
            estimated_hours=remediation_data.get("estimated_hours"),
            steps_performed=remediation_data.get("steps_performed", []),
            follow_up_required=remediation_data.get("follow_up_required", False),
            follow_up_actions=remediation_data.get("follow_up_actions", []),
            next_review_date=remediation_data.get("next_review_date"),
            metadata=remediation_data.get("metadata", {}),
        )

        db.add(remediation)
        await db.commit()
        await db.refresh(remediation)

        # Update violation status
        await self._update_violation_for_remediation(
            db, violation_id, ViolationStatus.IN_PROGRESS
        )

        return remediation

    async def update_remediation_progress(
        self,
        db: AsyncSession,
        remediation_id: UUID,
        progress_percentage: int,
        steps_completed: list[dict[str, Any]],
        completed_by_id: UUID,
    ) -> ViolationRemediation:
        """Update remediation progress."""

        query = select(ViolationRemediation).where(
            ViolationRemediation.id == remediation_id
        )
        result = await db.execute(query)
        remediation = result.scalar_one_or_none()

        if not remediation:
            raise ValueError(f"Remediation {remediation_id} not found")

        remediation.progress_percentage = min(100, max(0, progress_percentage))
        remediation.steps_performed = steps_completed
        remediation.completed_by_id = completed_by_id

        # Mark as completed if 100%
        if remediation.progress_percentage >= 100:
            remediation.status = "completed"
            remediation.completed_at = datetime.utcnow()

            # Update violation status
            await self._update_violation_for_remediation(
                db, remediation.violation_id, ViolationStatus.RESOLVED, completed_by_id
            )

        await db.commit()
        await db.refresh(remediation)

        return remediation

    async def _update_violation_for_remediation(
        self,
        db: AsyncSession,
        violation_id: UUID,
        status: ViolationStatus,
        resolved_by: Optional[UUID] = None,
    ) -> None:
        """Update violation status based on remediation."""

        update_data = {"status": status}

        if status == ViolationStatus.RESOLVED and resolved_by:
            update_data.update(
                {"resolved_at": datetime.utcnow(), "resolved_by": resolved_by}
            )

        stmt = (
            update(PolicyViolation)
            .where(PolicyViolation.id == violation_id)
            .values(**update_data)
        )
        await db.execute(stmt)
        await db.commit()


class ViolationAnalyticsService(BaseService):
    """Service for providing analytics and insights on policy violations."""

    async def get_violation_metrics(
        self, db: AsyncSession, project_id: Optional[UUID] = None, days_back: int = 30
    ) -> dict[str, Any]:
        """Get violation metrics for analytics dashboard."""

        start_date = datetime.utcnow() - timedelta(days=days_back)

        # Base query with optional project filter
        base_filter = [PolicyViolation.detected_at >= start_date]
        if project_id:
            base_filter.append(PolicyViolation.project_id == project_id)

        # Total violations
        total_query = select(func.count(PolicyViolation.id)).where(and_(*base_filter))
        total_result = await db.execute(total_query)
        total_violations = total_result.scalar()

        # Violations by status
        status_query = (
            select(PolicyViolation.status, func.count(PolicyViolation.id))
            .where(and_(*base_filter))
            .group_by(PolicyViolation.status)
        )

        status_result = await db.execute(status_query)
        violations_by_status = dict(status_result.all())

        # Violations by severity
        severity_query = (
            select(PolicyViolation.severity, func.count(PolicyViolation.id))
            .where(and_(*base_filter))
            .group_by(PolicyViolation.severity)
        )

        severity_result = await db.execute(severity_query)
        violations_by_severity = dict(severity_result.all())

        # Average resolution time
        resolved_filter = base_filter + [
            PolicyViolation.status == ViolationStatus.RESOLVED
        ]

        if resolved_filter:
            resolution_time_query = select(
                func.avg(
                    func.extract(
                        "epoch",
                        PolicyViolation.resolved_at - PolicyViolation.detected_at,
                    )
                )
            ).where(and_(*resolved_filter))

            resolution_result = await db.execute(resolution_time_query)
            avg_resolution_seconds = resolution_result.scalar()
            avg_resolution_hours = (avg_resolution_seconds or 0) / 3600
        else:
            avg_resolution_hours = 0

        # Overdue violations
        overdue_violations = await self.get_overdue_violations(db)
        if project_id:
            overdue_violations = [
                v for v in overdue_violations if v.project_id == project_id
            ]

        # Exception requests metrics
        exception_filter = [PolicyExceptionRequest.submitted_at >= start_date]
        if project_id:
            exception_filter.append(PolicyExceptionRequest.project_id == project_id)

        exception_query = (
            select(PolicyExceptionRequest.status, func.count(PolicyExceptionRequest.id))
            .where(and_(*exception_filter))
            .group_by(PolicyExceptionRequest.status)
        )

        exception_result = await db.execute(exception_query)
        exceptions_by_status = dict(exception_result.all())

        return {
            "period_days": days_back,
            "total_violations": total_violations,
            "violations_by_status": violations_by_status,
            "violations_by_severity": violations_by_severity,
            "average_resolution_time_hours": round(avg_resolution_hours, 2),
            "overdue_violations_count": len(overdue_violations),
            "active_exception_requests": exceptions_by_status.get(
                ExceptionStatus.PENDING, 0
            )
            + exceptions_by_status.get(ExceptionStatus.UNDER_REVIEW, 0),
            "exceptions_by_status": exceptions_by_status,
        }

    async def get_violation_trends(
        self, db: AsyncSession, project_id: Optional[UUID] = None, days_back: int = 90
    ) -> list[dict[str, Any]]:
        """Get violation trends over time."""

        start_date = datetime.utcnow() - timedelta(days=days_back)

        # Group by week
        query = (
            select(
                func.date_trunc("week", PolicyViolation.detected_at).label("week"),
                func.count(PolicyViolation.id).label("count"),
                PolicyViolation.severity,
            )
            .where(
                and_(
                    PolicyViolation.detected_at >= start_date,
                    *(
                        []
                        if not project_id
                        else [PolicyViolation.project_id == project_id]
                    ),
                )
            )
            .group_by(
                func.date_trunc("week", PolicyViolation.detected_at),
                PolicyViolation.severity,
            )
            .order_by("week")
        )

        result = await db.execute(query)

        # Process results
        trends = {}
        for row in result.all():
            week_str = row.week.isoformat()
            if week_str not in trends:
                trends[week_str] = {"week": week_str, "total": 0}

            trends[week_str][row.severity] = row.count
            trends[week_str]["total"] += row.count

        return list(trends.values())

    async def get_top_violating_policies(
        self,
        db: AsyncSession,
        project_id: Optional[UUID] = None,
        limit: int = 10,
        days_back: int = 30,
    ) -> list[dict[str, Any]]:
        """Get policies with the most violations."""

        start_date = datetime.utcnow() - timedelta(days=days_back)

        # Query with policy join

        query = (
            select(PolicyViolation, Policy)
            .join(Policy)
            .where(PolicyViolation.detected_at >= start_date)
        )

        if project_id:
            query = query.where(PolicyViolation.project_id == project_id)

        # Count violations per policy
        query = (
            query.add_columns(func.count(PolicyViolation.id).label("violation_count"))
            .group_by(Policy.id)
            .order_by(desc("violation_count"))
            .limit(limit)
        )

        result = await db.execute(query)

        top_policies = []
        for row in result.all():
            violation, policy, count = row
            top_policies.append(
                {
                    "policy_id": str(policy.id),
                    "policy_name": policy.name,
                    "policy_type": policy.rule_type,
                    "violation_count": count,
                    "severity_distribution": {},  # Would need additional query
                }
            )

        return top_policies
