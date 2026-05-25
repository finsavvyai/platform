"""
Approval Service for Universal Dependency Platform.

Provides comprehensive human-in-the-loop workflow management with
multi-level approvals, escalation paths, deadline tracking, and audit trails.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from udp.core.models.approval import ApprovalWorkflow as ApprovalWorkflowModel
from udp.core.schemas.approval import (
    ApprovalRequestCreate,
    ApprovalResponseCreate,
)
from udp.domain.models import (
    ApprovalResponse,
    WorkflowStatus,
)
from udp.infrastructure.notifications import NotificationService
from udp.services.escalation_service import EscalationService
from udp.workflows.approval_workflow import (
    ApprovalState,
    ApprovalType,
    ApprovalWorkflow,
    EscalationManager,
    RoutingStrategy,
)

logger = logging.getLogger(__name__)


class ApprovalStatus(str, Enum):
    """Approval status enumeration."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONDITIONAL = "conditional"
    DELEGATED = "delegated"
    ESCALATED = "escalated"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class ReminderType(str, Enum):
    """Types of approval reminders."""

    DEADLINE_APPROACHING = "deadline_approaching"
    DEADLINE_MISSED = "deadline_missed"
    ESCALATION_TRIGGERED = "escalation_triggered"
    FOLLOWUP_REQUIRED = "followup_required"


class ApprovalService:
    """
    Comprehensive approval service for human-in-the-loop workflows.

    Manages multi-level approvals, escalations, deadlines, reminders,
    and audit trails for enterprise governance requirements.
    """

    def __init__(self, db: AsyncSession, organization_id: UUID):
        self.db = db
        self.organization_id = organization_id
        self.escalation_service = EscalationService(organization_id)
        self.notification_service = NotificationService(organization_id)
        self.workflow_cache = {}
        self.reminder_tasks = {}

    async def create_approval_request(
        self,
        request_data: ApprovalRequestCreate,
        requester_id: UUID,
        requester_role: str,
        routing_strategy: Optional[RoutingStrategy] = None,
    ) -> dict[str, Any]:
        """
        Create a new approval request with intelligent routing.

        Initiates a comprehensive approval workflow with stakeholder
        determination, SLA setting, and notification delivery.
        """

        try:
            # Create approval workflow instance
            workflow = ApprovalWorkflow(self.organization_id)

            # Execute approval workflow initialization
            workflow_state = await workflow.execute(
                request_type=ApprovalType(request_data.request_type),
                request_data=request_data.request_data,
                requester_id=requester_id,
                requester_role=requester_role,
                routing_strategy=routing_strategy,
            )

            # Persist workflow state to database
            db_workflow = await self._persist_workflow_state(
                workflow_state, requester_id
            )

            # Schedule deadline reminders
            if workflow_state.get("sla_deadline"):
                await self._schedule_deadline_reminders(db_workflow.id, workflow_state)

            # Send initial notifications to current approvers
            await self._send_approval_notifications(workflow_state)

            # Cache workflow for quick access
            self.workflow_cache[str(db_workflow.id)] = workflow_state

            logger.info(
                f"Created approval request {db_workflow.id} "
                f"for {request_data.request_type} by {requester_role}"
            )

            return {
                "workflow_id": str(db_workflow.id),
                "status": workflow_state["status"],
                "request_type": request_data.request_type,
                "current_approvers": self._extract_current_approvers(workflow_state),
                "sla_deadline": workflow_state.get("sla_deadline"),
                "approval_requirements": len(workflow_state["approval_requirements"]),
                "estimated_completion_time": workflow_state.get(
                    "risk_based_routing", {}
                ).get("estimated_approval_time_hours"),
            }

        except Exception as e:
            logger.error(f"Failed to create approval request: {e}")
            raise

    async def submit_approval_response(
        self,
        workflow_id: UUID,
        response_data: ApprovalResponseCreate,
        responder_id: UUID,
        responder_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Submit an approval response and process workflow progression.

        Handles stakeholder responses with validation, audit logging,
        and automatic workflow progression based on dependencies.
        """

        try:
            # Load workflow state
            workflow_state = await self._load_workflow_state(workflow_id)
            if not workflow_state:
                raise ValueError(f"Workflow {workflow_id} not found")

            # Create approval response object
            approval_response = ApprovalResponse(
                requirement_id=response_data.requirement_id,
                approver_id=responder_id,
                approver_email=response_data.approver_email,
                approver_role=response_data.approver_role,
                status=response_data.status,
                comments=response_data.comments,
                conditions=response_data.conditions or [],
                risk_assessment=response_data.risk_assessment,
                alternative_suggestions=response_data.alternative_suggestions or [],
                confidence_level=response_data.confidence_level,
                ip_address=responder_ip,
                user_agent=user_agent,
                session_id=response_data.session_id,
            )

            # Validate response against business rules
            escalation_manager = EscalationManager(self.organization_id)
            validation_result = await escalation_manager.validate_stakeholder_response(
                workflow_state, approval_response.dict()
            )

            if not validation_result["valid"]:
                return {
                    "success": False,
                    "errors": validation_result["errors"],
                    "warnings": validation_result.get("warnings", []),
                }

            # Process the approval response
            process_result = await escalation_manager.process_approval_response(
                workflow_state, approval_response
            )

            if not process_result["success"]:
                return {
                    "success": False,
                    "error": process_result["error"],
                    "workflow_id": str(workflow_id),
                }

            # Update workflow state in database
            await self._update_workflow_state(workflow_id, workflow_state)

            # Check for escalations needed
            escalation_results = (
                await self.escalation_service.check_and_process_escalations(
                    workflow_state
                )
            )

            # Send notifications for next approvers or completion
            await self._handle_workflow_notifications(workflow_state, process_result)

            # Update cache
            self.workflow_cache[str(workflow_id)] = workflow_state

            # Log response for audit
            await self._log_approval_response(
                workflow_id, approval_response, validation_result
            )

            logger.info(
                f"Processed approval response for workflow {workflow_id} "
                f"from {response_data.approver_role}: {response_data.status}"
            )

            return {
                "success": True,
                "workflow_id": str(workflow_id),
                "workflow_status": workflow_state["status"],
                "response_processed": True,
                "next_approvers": self._extract_current_approvers(workflow_state),
                "workflow_complete": workflow_state["status"]
                == WorkflowStatus.COMPLETED,
                "escalations_triggered": escalation_results["escalations_processed"],
                "warnings": validation_result.get("warnings", []),
            }

        except Exception as e:
            logger.error(f"Failed to submit approval response: {e}")
            raise

    async def escalate_approval(
        self,
        workflow_id: UUID,
        requirement_id: UUID,
        escalation_reason: str,
        escalated_by: UUID,
    ) -> dict[str, Any]:
        """
        Manually escalate an approval to the next level.

        Allows authorized users to trigger escalations outside of
        automatic SLA-based escalation rules.
        """

        try:
            workflow_state = await self._load_workflow_state(workflow_id)
            if not workflow_state:
                raise ValueError(f"Workflow {workflow_id} not found")

            # Find requirement to escalate
            requirement_data = None
            for req in workflow_state["approval_requirements"]:
                if req["id"] == str(requirement_id):
                    requirement_data = req
                    break

            if not requirement_data:
                raise ValueError(f"Approval requirement {requirement_id} not found")

            # Get escalation target from hierarchy
            escalation_target = None
            hierarchy = requirement_data.get("stakeholder_hierarchy", [])
            escalation_count = requirement_data.get("escalation_count", 0)

            if escalation_count < len(hierarchy):
                escalation_target = hierarchy[escalation_count]
            else:
                return {
                    "success": False,
                    "error": "No further escalation targets available",
                }

            # Execute escalation
            escalation_manager = EscalationManager(self.organization_id)
            escalation_event = await escalation_manager.execute_escalation(
                workflow_state, str(requirement_id), escalation_target
            )

            # Update requirement
            requirement_data["escalation_count"] += 1
            requirement_data["approval_status"] = "escalated"
            requirement_data["last_escalated_at"] = datetime.utcnow().isoformat()

            # Add manual escalation metadata
            escalation_event["escalated_by"] = str(escalated_by)
            escalation_event["escalation_reason"] = escalation_reason
            escalation_event["escalation_type"] = "manual"

            # Update workflow state
            await self._update_workflow_state(workflow_id, workflow_state)

            # Send escalation notifications
            await self._send_escalation_notifications(workflow_state, escalation_event)

            # Log manual escalation
            await self._log_manual_escalation(workflow_id, escalation_event)

            logger.info(
                f"Manually escalated requirement {requirement_id} in workflow {workflow_id} "
                f"by {escalated_by}: {escalation_reason}"
            )

            return {
                "success": True,
                "workflow_id": str(workflow_id),
                "requirement_id": str(requirement_id),
                "escalation_target": escalation_target,
                "escalation_level": requirement_data["escalation_count"],
                "escalation_event": escalation_event,
            }

        except Exception as e:
            logger.error(f"Failed to escalate approval: {e}")
            raise

    async def get_approval_status(
        self, workflow_id: UUID, include_details: bool = False
    ) -> dict[str, Any]:
        """
        Get current status of an approval workflow.

        Returns comprehensive status information including progress,
        current approvers, SLA status, and risk indicators.
        """

        try:
            workflow_state = await self._load_workflow_state(workflow_id)
            if not workflow_state:
                raise ValueError(f"Workflow {workflow_id} not found")

            escalation_manager = EscalationManager(self.organization_id)

            # Get basic status summary
            status_summary = await escalation_manager.get_approval_status_summary(
                workflow_state
            )

            # Add additional details if requested
            if include_details:
                status_summary.update(
                    {
                        "approval_requirements": workflow_state[
                            "approval_requirements"
                        ],
                        "approval_workflow": workflow_state["approval_workflow"],
                        "stakeholder_responses": workflow_state[
                            "stakeholder_responses"
                        ],
                        "audit_trail": workflow_state.get("audit_trail_enhanced", []),
                        "risk_indicators": await escalation_manager.assess_approval_risk(
                            workflow_state
                        ),
                    }
                )

            return status_summary

        except Exception as e:
            logger.error(f"Failed to get approval status: {e}")
            raise

    async def get_pending_approvals(
        self,
        user_id: Optional[UUID] = None,
        user_role: Optional[str] = None,
        organization_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        Get pending approvals for a user or role.

        Returns paginated list of pending approvals requiring action
        from the specified user or role.
        """

        try:
            # Query database for pending workflows
            query = select(ApprovalWorkflowModel).where(
                and_(
                    ApprovalWorkflowModel.status == WorkflowStatus.WAITING_FOR_APPROVAL,
                    ApprovalWorkflowModel.organization_id == organization_id
                    or self.organization_id,
                )
            )

            # Add user/role filtering
            if user_id:
                query = query.where(
                    ApprovalWorkflowModel.current_approvers.contains([str(user_id)])
                )
            elif user_role:
                query = query.where(
                    ApprovalWorkflowModel.approver_roles.contains([user_role])
                )

            # Add pagination and ordering
            query = query.order_by(desc(ApprovalWorkflowModel.created_at))
            query = query.offset(offset).limit(limit)

            result = await self.db.execute(query)
            workflows = result.scalars().all()

            # Transform to response format
            pending_approvals = []
            for workflow in workflows:
                # Get current approvers for this workflow
                workflow_state = await self._load_workflow_state(workflow.id)
                current_approvers = self._extract_current_approvers(workflow_state)

                # Check if specific user is a current approver
                is_for_user = False
                if user_id:
                    for approver in current_approvers:
                        if approver.get("user_id") == str(user_id):
                            is_for_user = True
                            break

                if is_for_user or not user_id:
                    pending_approvals.append(
                        {
                            "workflow_id": str(workflow.id),
                            "request_type": workflow.request_type,
                            "request_data": workflow.request_data,
                            "created_at": workflow.created_at,
                            "sla_deadline": workflow_state.get("sla_deadline"),
                            "urgency": self._calculate_urgency(workflow_state),
                            "current_approver_role": current_approvers[0].get("role")
                            if current_approvers
                            else None,
                            "approval_count": len(
                                workflow_state.get("approval_responses", {})
                            ),
                            "total_required": len(
                                workflow_state["approval_requirements"]
                            ),
                        }
                    )

            return {
                "pending_approvals": pending_approvals,
                "total_count": len(pending_approvals),
                "limit": limit,
                "offset": offset,
            }

        except Exception as e:
            logger.error(f"Failed to get pending approvals: {e}")
            raise

    async def cancel_approval_request(
        self, workflow_id: UUID, cancellation_reason: str, cancelled_by: UUID
    ) -> dict[str, Any]:
        """
        Cancel an ongoing approval request.

        Allows authorized users to cancel approval requests when
        they are no longer needed or circumstances change.
        """

        try:
            workflow_state = await self._load_workflow_state(workflow_id)
            if not workflow_state:
                raise ValueError(f"Workflow {workflow_id} not found")

            # Check if workflow can be cancelled
            if workflow_state["status"] in [
                WorkflowStatus.COMPLETED,
                WorkflowStatus.CANCELLED,
            ]:
                return {
                    "success": False,
                    "error": f"Cannot cancel workflow in {workflow_state['status']} status",
                }

            # Update workflow status
            workflow_state["status"] = WorkflowStatus.CANCELLED
            workflow_state["completed_at"] = datetime.utcnow()
            workflow_state["cancellation_reason"] = cancellation_reason
            workflow_state["cancelled_by"] = str(cancelled_by)

            # Add to audit trail
            workflow_state["audit_trail_enhanced"].append(
                {
                    "event": "workflow_cancelled",
                    "timestamp": datetime.utcnow().isoformat(),
                    "cancelled_by": str(cancelled_by),
                    "reason": cancellation_reason,
                    "previous_status": workflow_state.get("status"),
                }
            )

            # Update database
            await self._update_workflow_state(workflow_id, workflow_state)

            # Cancel any pending reminder tasks
            await self._cancel_reminder_tasks(workflow_id)

            # Send cancellation notifications
            await self._send_cancellation_notifications(
                workflow_state, cancellation_reason
            )

            # Log cancellation
            await self._log_workflow_cancellation(
                workflow_id, cancellation_reason, cancelled_by
            )

            logger.info(
                f"Cancelled approval workflow {workflow_id} by {cancelled_by}: "
                f"{cancellation_reason}"
            )

            return {
                "success": True,
                "workflow_id": str(workflow_id),
                "status": WorkflowStatus.CANCELLED,
                "cancelled_at": workflow_state["completed_at"],
            }

        except Exception as e:
            logger.error(f"Failed to cancel approval request: {e}")
            raise

    async def _persist_workflow_state(
        self, workflow_state: ApprovalState, created_by: UUID
    ) -> ApprovalWorkflowModel:
        """Persist workflow state to database."""

        db_workflow = ApprovalWorkflowModel(
            id=UUID(workflow_state["workflow_id"]),
            organization_id=self.organization_id,
            workflow_type=workflow_state["workflow_type"],
            request_type=workflow_state["request_type"],
            request_data=workflow_state["request_data"],
            requester_id=UUID(workflow_state["requester_id"]),
            requester_role=workflow_state["requester_role"],
            status=workflow_state["status"],
            current_step=workflow_state["current_step"],
            approval_requirements=workflow_state["approval_requirements"],
            approval_workflow=workflow_state["approval_workflow"],
            current_approvers=self._extract_current_approvers(workflow_state),
            stakeholder_hierarchy=workflow_state["stakeholder_hierarchy"],
            escalation_policies=workflow_state["escalation_policies"],
            sla_deadline=workflow_state.get("sla_deadline"),
            sla_status=workflow_state.get("sla_status", "on_time"),
            escalation_level=workflow_state.get("escalation_level", 0),
            audit_trail=workflow_state.get("audit_trail_enhanced", []),
            metadata=workflow_state.get("metadata", {}),
            created_by=str(created_by),
            created_at=workflow_state["started_at"],
            updated_at=datetime.utcnow(),
        )

        self.db.add(db_workflow)
        await self.db.commit()
        await self.db.refresh(db_workflow)

        return db_workflow

    async def _load_workflow_state(self, workflow_id: UUID) -> Optional[ApprovalState]:
        """Load workflow state from cache or database."""

        workflow_id_str = str(workflow_id)

        # Check cache first
        if workflow_id_str in self.workflow_cache:
            return self.workflow_cache[workflow_id_str]

        # Load from database
        result = await self.db.execute(
            select(ApprovalWorkflowModel).where(ApprovalWorkflowModel.id == workflow_id)
        )
        db_workflow = result.scalar_one_or_none()

        if not db_workflow:
            return None

        # Reconstruct workflow state
        workflow_state = {
            "workflow_id": workflow_id_str,
            "workflow_type": db_workflow.workflow_type,
            "organization_id": str(db_workflow.organization_id),
            "project_id": db_workflow.request_data.get("project_id"),
            "status": db_workflow.status,
            "current_step": db_workflow.current_step,
            "started_at": db_workflow.created_at,
            "completed_at": db_workflow.updated_at,
            "error_message": None,
            "retry_count": 0,
            "max_retries": 3,
            "audit_log": [],
            "performance_metrics": {},
            "requires_human_approval": True,
            "approval_requests": [],
            "approval_responses": {},
            "metadata": db_workflow.metadata or {},
            # Request-specific data
            "request_type": db_workflow.request_type,
            "request_data": db_workflow.request_data,
            "requester_id": str(db_workflow.requester_id),
            "requester_role": db_workflow.requester_role,
            "approval_workflow": db_workflow.approval_workflow or [],
            "current_approver": None,
            "approval_history": [],
            "approval_requirements": db_workflow.approval_requirements or [],
            "approval_dependency_graph": {},
            # Stakeholder management
            "stakeholders": [],
            "stakeholder_hierarchy": db_workflow.stakeholder_hierarchy or {},
            "stakeholder_responses": {},
            "stakeholder_availability": {},
            # SLA and escalation
            "sla_deadline": db_workflow.sla_deadline,
            "sla_status": db_workflow.sla_status,
            "escalation_level": db_workflow.escalation_level,
            "escalation_history": [],
            "escalation_policies": db_workflow.escalation_policies or {},
            "auto_escalation_enabled": True,
            # Enhanced fields
            "auto_approval_eligible": False,
            "auto_approval_reason": None,
            "auto_approval_conditions": {},
            "risk_based_routing": {},
            "ai_routing_recommendations": [],
            "final_decision": None,
            "decision_rationale": None,
            "decision_confidence": None,
            # Notifications
            "notifications_sent": [],
            "notification_responses": [],
            "notification_preferences": {},
            "communication_channels": {},
            # Routing
            "routing_strategy": "risk_based",
            "routing_rules": [],
            "approval_path_optimization": {},
            # Compliance
            "compliance_requirements": [],
            "audit_trail_enhanced": db_workflow.audit_trail or [],
            "regulatory_approvals": {},
            # Analytics
            "approval_metrics": {},
            "bottleneck_analysis": {},
            "stakeholder_performance": {},
        }

        # Update cache
        self.workflow_cache[workflow_id_str] = workflow_state

        return workflow_state

    async def _update_workflow_state(
        self, workflow_id: UUID, workflow_state: ApprovalState
    ) -> None:
        """Update workflow state in database."""

        result = await self.db.execute(
            select(ApprovalWorkflowModel).where(ApprovalWorkflowModel.id == workflow_id)
        )
        db_workflow = result.scalar_one_or_none()

        if db_workflow:
            db_workflow.status = workflow_state["status"]
            db_workflow.current_step = workflow_state["current_step"]
            db_workflow.approval_requirements = workflow_state["approval_requirements"]
            db_workflow.approval_workflow = workflow_state["approval_workflow"]
            db_workflow.current_approvers = self._extract_current_approvers(
                workflow_state
            )
            db_workflow.sla_status = workflow_state.get("sla_status", "on_time")
            db_workflow.escalation_level = workflow_state.get("escalation_level", 0)
            db_workflow.audit_trail = workflow_state.get("audit_trail_enhanced", [])
            db_workflow.updated_at = datetime.utcnow()

            if workflow_state.get("completed_at"):
                db_workflow.completed_at = workflow_state["completed_at"]

            await self.db.commit()

            # Update cache
            self.workflow_cache[str(workflow_id)] = workflow_state

    def _extract_current_approvers(
        self, workflow_state: ApprovalState
    ) -> list[dict[str, Any]]:
        """Extract current approvers from workflow state."""

        current_approver = workflow_state.get("current_approver")
        if not current_approver:
            return []

        if isinstance(current_approver, dict):
            if "active_approvers" in current_approver:
                return current_approver["active_approvers"]
            else:
                return [current_approver]

        return []

    async def _schedule_deadline_reminders(
        self, workflow_id: UUID, workflow_state: ApprovalState
    ) -> None:
        """Schedule deadline reminder notifications."""

        if not workflow_state.get("sla_deadline"):
            return

        deadline = workflow_state["sla_deadline"]
        workflow_id_str = str(workflow_id)

        # Schedule reminders at different intervals
        reminder_intervals = [
            ("24h", timedelta(hours=24)),
            ("4h", timedelta(hours=4)),
            ("1h", timedelta(hours=1)),
            ("30m", timedelta(minutes=30)),
        ]

        current_time = datetime.utcnow()

        for reminder_name, interval in reminder_intervals:
            reminder_time = deadline - interval

            if reminder_time > current_time:
                delay = (reminder_time - current_time).total_seconds()

                # Create async task for reminder
                task = asyncio.create_task(
                    self._send_deadline_reminder(
                        workflow_id, reminder_name, reminder_time
                    )
                )

                # Store task reference
                if workflow_id_str not in self.reminder_tasks:
                    self.reminder_tasks[workflow_id_str] = []

                self.reminder_tasks[workflow_id_str].append(task)

    async def _send_deadline_reminder(
        self, workflow_id: UUID, reminder_type: str, reminder_time: datetime
    ) -> None:
        """Send deadline reminder notification."""

        try:
            # Check if workflow is still active
            workflow_state = await self._load_workflow_state(workflow_id)
            if (
                not workflow_state
                or workflow_state["status"] != WorkflowStatus.WAITING_FOR_APPROVAL
            ):
                return

            # Prepare reminder message
            current_approvers = self._extract_current_approvers(workflow_state)
            deadline = workflow_state.get("sla_deadline")
            hours_remaining = (
                (deadline - datetime.utcnow()).total_seconds() / 3600 if deadline else 0
            )

            message = {
                "type": "deadline_reminder",
                "reminder_type": reminder_type,
                "workflow_id": str(workflow_id),
                "request_type": workflow_state["request_type"],
                "deadline": deadline.isoformat() if deadline else None,
                "hours_remaining": round(hours_remaining, 1),
                "current_approvers": current_approvers,
                "escalation_level": workflow_state.get("escalation_level", 0),
            }

            # Send reminder notifications
            await self.notification_service.send_approval_reminder(message)

            logger.info(
                f"Sent {reminder_type} deadline reminder for workflow {workflow_id} "
                f"({hours_remaining:.1f}h remaining)"
            )

        except Exception as e:
            logger.error(f"Failed to send deadline reminder: {e}")

    async def _cancel_reminder_tasks(self, workflow_id: UUID) -> None:
        """Cancel pending reminder tasks for a workflow."""

        workflow_id_str = str(workflow_id)

        if workflow_id_str in self.reminder_tasks:
            for task in self.reminder_tasks[workflow_id_str]:
                if not task.done():
                    task.cancel()

            del self.reminder_tasks[workflow_id_str]

    async def _send_approval_notifications(self, workflow_state: ApprovalState) -> None:
        """Send initial approval request notifications."""

        current_approvers = self._extract_current_approvers(workflow_state)

        for approver in current_approvers:
            notification_data = {
                "type": "approval_request",
                "workflow_id": workflow_state["workflow_id"],
                "request_type": workflow_state["request_type"],
                "request_data": workflow_state["request_data"],
                "approver_role": approver.get("role"),
                "approver_email": approver.get("email"),
                "deadline": approver.get("deadline"),
                "sla_deadline": workflow_state.get("sla_deadline"),
                "escalation_policies": workflow_state.get("escalation_policies", {}),
                "requester_role": workflow_state["requester_role"],
                "risk_level": workflow_state.get("risk_based_routing", {}).get(
                    "risk_level", "medium"
                ),
            }

            await self.notification_service.send_approval_request(notification_data)

    async def _send_escalation_notifications(
        self, workflow_state: ApprovalState, escalation_event: dict[str, Any]
    ) -> None:
        """Send escalation notifications."""

        notification_data = {
            "type": "escalation",
            "workflow_id": workflow_state["workflow_id"],
            "escalation_event": escalation_event,
            "escalated_to": escalation_event.get("escalated_to"),
            "escalation_reason": escalation_event.get("reason"),
            "escalation_level": escalation_event.get("escalation_level"),
            "sla_deadline": workflow_state.get("sla_deadline"),
            "request_type": workflow_state["request_type"],
        }

        await self.notification_service.send_escalation_notification(notification_data)

    async def _send_cancellation_notifications(
        self, workflow_state: ApprovalState, cancellation_reason: str
    ) -> None:
        """Send cancellation notifications."""

        notification_data = {
            "type": "cancellation",
            "workflow_id": workflow_state["workflow_id"],
            "cancellation_reason": cancellation_reason,
            "request_type": workflow_state["request_type"],
            "requester_id": workflow_state["requester_id"],
            "current_approvers": self._extract_current_approvers(workflow_state),
        }

        await self.notification_service.send_cancellation_notification(
            notification_data
        )

    async def _handle_workflow_notifications(
        self, workflow_state: ApprovalState, process_result: dict[str, Any]
    ) -> None:
        """Handle notifications based on workflow progression."""

        next_actions = process_result.get("next_actions", [])

        for action in next_actions:
            if action["action"] == "notify_approver":
                # Send notification to next approver
                await self._notify_next_approver(workflow_state, action)
            elif action["action"] == "workflow_completed":
                # Send completion notifications
                await self._notify_workflow_completion(workflow_state)
            elif action["action"] == "workflow_rejected":
                # Send rejection notifications
                await self._notify_workflow_rejection(workflow_state, action["reason"])
            elif action["action"] == "notify_escalation_approver":
                # Send escalation notifications
                await self._send_escalation_notifications(
                    workflow_state, {"escalated_to": action["escalation_target"]}
                )

    async def _notify_next_approver(
        self, workflow_state: ApprovalState, action: dict[str, Any]
    ) -> None:
        """Notify the next approver in the workflow."""

        requirement_id = action["requirement_id"]

        # Find requirement details
        requirement_data = None
        for req in workflow_state["approval_requirements"]:
            if req["id"] == requirement_id:
                requirement_data = req
                break

        if requirement_data:
            notification_data = {
                "type": "approval_request",
                "workflow_id": workflow_state["workflow_id"],
                "requirement_id": requirement_id,
                "approver_role": requirement_data["approver_role"],
                "approver_email": requirement_data.get("approver_email"),
                "deadline": requirement_data.get("deadline"),
                "request_type": workflow_state["request_type"],
                "request_data": workflow_state["request_data"],
            }

            await self.notification_service.send_approval_request(notification_data)

    async def _notify_workflow_completion(self, workflow_state: ApprovalState) -> None:
        """Notify stakeholders of workflow completion."""

        notification_data = {
            "type": "workflow_completed",
            "workflow_id": workflow_state["workflow_id"],
            "final_decision": workflow_state.get("final_decision"),
            "decision_rationale": workflow_state.get("decision_rationale"),
            "request_type": workflow_state["request_type"],
            "requester_id": workflow_state["requester_id"],
            "completion_time": workflow_state.get("completed_at"),
            "total_approvals": len(workflow_state.get("approval_responses", {})),
        }

        await self.notification_service.send_workflow_completion_notification(
            notification_data
        )

    async def _notify_workflow_rejection(
        self, workflow_state: ApprovalState, rejection_reason: str
    ) -> None:
        """Notify stakeholders of workflow rejection."""

        notification_data = {
            "type": "workflow_rejected",
            "workflow_id": workflow_state["workflow_id"],
            "rejection_reason": rejection_reason,
            "request_type": workflow_state["request_type"],
            "requester_id": workflow_state["requester_id"],
            "rejection_time": workflow_state.get("completed_at"),
        }

        await self.notification_service.send_workflow_rejection_notification(
            notification_data
        )

    def _calculate_urgency(self, workflow_state: ApprovalState) -> str:
        """Calculate urgency level for pending approvals."""

        if not workflow_state.get("sla_deadline"):
            return "normal"

        deadline = workflow_state["sla_deadline"]
        current_time = datetime.utcnow()
        hours_remaining = (deadline - current_time).total_seconds() / 3600

        if hours_remaining < 0:
            return "overdue"
        elif hours_remaining < 2:
            return "critical"
        elif hours_remaining < 8:
            return "high"
        elif hours_remaining < 24:
            return "medium"
        else:
            return "low"

    async def _log_approval_response(
        self,
        workflow_id: UUID,
        response: ApprovalResponse,
        validation_result: dict[str, Any],
    ) -> None:
        """Log approval response for audit purposes."""

        audit_log = {
            "workflow_id": str(workflow_id),
            "event_type": "approval_response",
            "timestamp": datetime.utcnow().isoformat(),
            "requirement_id": str(response.requirement_id),
            "approver_id": str(response.approver_id),
            "approver_role": response.approver_role,
            "response_status": response.status,
            "validation_valid": validation_result["valid"],
            "validation_errors": validation_result.get("errors", []),
            "validation_warnings": validation_result.get("warnings", []),
            "ip_address": response.ip_address,
            "user_agent": response.user_agent,
        }

        # This would typically be stored in an audit log table
        logger.info(f"Audit log: {json.dumps(audit_log)}")

    async def _log_manual_escalation(
        self, workflow_id: UUID, escalation_event: dict[str, Any]
    ) -> None:
        """Log manual escalation for audit purposes."""

        audit_log = {
            "workflow_id": str(workflow_id),
            "event_type": "manual_escalation",
            "timestamp": datetime.utcnow().isoformat(),
            "escalation_event": escalation_event,
        }

        logger.info(f"Audit log: {json.dumps(audit_log)}")

    async def _log_workflow_cancellation(
        self, workflow_id: UUID, reason: str, cancelled_by: UUID
    ) -> None:
        """Log workflow cancellation for audit purposes."""

        audit_log = {
            "workflow_id": str(workflow_id),
            "event_type": "workflow_cancellation",
            "timestamp": datetime.utcnow().isoformat(),
            "cancellation_reason": reason,
            "cancelled_by": str(cancelled_by),
        }

        logger.info(f"Audit log: {json.dumps(audit_log)}")
