"""
Escalation service for approval workflows.

Provides comprehensive escalation management with SLA tracking,
automatic escalation, and notification integration.
"""

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from udp.domain.models import ApprovalRequirement

logger = logging.getLogger(__name__)


class EscalationSeverity(str, Enum):
    """Escalation severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationChannel(str, Enum):
    """Available notification channels."""
    EMAIL = "email"
    SLACK = "slack"
    SMS = "sms"
    WEBHOOK = "webhook"
    IN_APP = "in_app"


class EscalationService:
    """
    Comprehensive escalation service for approval workflows.

    Manages SLA tracking, automatic escalation, notification delivery,
    and escalation policy enforcement for enterprise approval systems.
    """

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.notification_service = NotificationService()
        self.sla_tracker = SLATracker()

    async def check_and_process_escalations(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Check for required escalations and process them automatically.

        Monitors SLA deadlines, identifies overdue approvals, and triggers
        escalations according to organizational policies.
        """

        escalation_results = {
            "escalations_processed": 0,
            "notifications_sent": 0,
            "sla_violations": 0,
            "escalation_events": [],
            "errors": []
        }

        try:
            current_time = datetime.utcnow()

            # Check each approval requirement for escalation needs
            for req_data in state["approval_requirements"]:
                if req_data["approval_status"] != "pending":
                    continue

                requirement = ApprovalRequirement(**req_data)
                escalation_needed = await self._assess_escalation_need(requirement, current_time)

                if escalation_needed["required"]:
                    escalation_result = await self._process_escalation(
                        state, requirement, escalation_needed, current_time
                    )

                    if escalation_result["success"]:
                        escalation_results["escalations_processed"] += 1
                        escalation_results["escalation_events"].append(escalation_result["event"])

                        # Send escalation notifications
                        notification_result = await self._send_escalation_notifications(
                            state, escalation_result["event"]
                        )
                        escalation_results["notifications_sent"] += notification_result["sent_count"]
                    else:
                        escalation_results["errors"].append(escalation_result["error"])

                # Track SLA violations
                if requirement.is_expired:
                    escalation_results["sla_violations"] += 1

            # Update overall workflow SLA status
            await self._update_workflow_sla_status(state, escalation_results)

            return escalation_results

        except Exception as e:
            logger.error(f"Escalation processing failed: {e}")
            escalation_results["errors"].append(f"Escalation processing error: {str(e)}")
            return escalation_results

    async def _assess_escalation_need(
        self,
        requirement: ApprovalRequirement,
        current_time: datetime
    ) -> dict[str, Any]:
        """Assess whether an approval requirement needs escalation."""

        assessment = {
            "required": False,
            "reason": None,
            "severity": EscalationSeverity.LOW,
            "target": None,
            "urgency_score": 0.0
        }

        # Check if escalation is enabled
        if not requirement.escalation_policy.get("auto_escalate", False):
            return assessment

        # Check if maximum escalations reached
        max_escalations = requirement.escalation_policy.get("max_escalations", 3)
        if requirement.escalation_count >= max_escalations:
            return assessment

        # Check escalation threshold
        escalation_threshold_hours = requirement.escalation_policy.get("escalation_threshold_hours", 24)
        time_since_created = (current_time - requirement.created_at).total_seconds() / 3600

        if time_since_created >= escalation_threshold_hours:
            assessment["required"] = True
            assessment["reason"] = f"Escalation threshold exceeded ({escalation_threshold_hours}h)"

            # Determine severity based on how overdue
            if requirement.is_expired:
                overdue_hours = (current_time - requirement.deadline).total_seconds() / 3600
                if overdue_hours >= 48:
                    assessment["severity"] = EscalationSeverity.CRITICAL
                elif overdue_hours >= 24:
                    assessment["severity"] = EscalationSeverity.HIGH
                elif overdue_hours >= 8:
                    assessment["severity"] = EscalationSeverity.MEDIUM
                else:
                    assessment["severity"] = EscalationSeverity.LOW
            else:
                # Not yet expired but approaching deadline
                time_remaining = (requirement.deadline - current_time).total_seconds() / 3600
                if time_remaining <= 2:
                    assessment["severity"] = EscalationSeverity.HIGH
                elif time_remaining <= 8:
                    assessment["severity"] = EscalationSeverity.MEDIUM
                else:
                    assessment["severity"] = EscalationSeverity.LOW

            # Calculate urgency score (0-1 scale)
            if requirement.is_expired:
                overdue_ratio = min(1.0, overdue_hours / 72)  # Cap at 72 hours
                assessment["urgency_score"] = 0.5 + (overdue_ratio * 0.5)
            else:
                time_remaining_ratio = max(0.0, time_remaining / 24)  # 24 hour baseline
                assessment["urgency_score"] = 1.0 - time_remaining_ratio

            # Determine escalation target
            assessment["target"] = requirement.next_escalation_target

        return assessment

    async def _process_escalation(
        self,
        state: dict[str, Any],
        requirement: ApprovalRequirement,
        escalation_assessment: dict[str, Any],
        current_time: datetime
    ) -> dict[str, Any]:
        """Process an escalation for a specific requirement."""

        try:
            escalation_target = escalation_assessment["target"]
            if not escalation_target:
                return {
                    "success": False,
                    "error": f"No escalation target available for requirement {requirement.id}"
                }

            # Create escalation event
            escalation_event = {
                "escalation_id": str(uuid4()),
                "requirement_id": str(requirement.id),
                "workflow_id": requirement.workflow_id,
                "escalated_at": current_time.isoformat(),
                "escalated_from": {
                    "role": requirement.approver_role,
                    "email": requirement.approver_email,
                    "user_id": str(requirement.approver_user_id) if requirement.approver_user_id else None
                },
                "escalated_to": escalation_target,
                "escalation_level": requirement.escalation_count + 1,
                "reason": escalation_assessment["reason"],
                "severity": escalation_assessment["severity"],
                "urgency_score": escalation_assessment["urgency_score"],
                "auto_escalated": True,
                "sla_violation": requirement.is_expired,
                "overdue_hours": (
                    (current_time - requirement.deadline).total_seconds() / 3600
                    if requirement.is_expired else 0
                )
            }

            # Update requirement in state
            for req_data in state["approval_requirements"]:
                if req_data["id"] == str(requirement.id):
                    req_data["escalation_count"] += 1
                    req_data["last_escalated_at"] = current_time.isoformat()
                    req_data["approval_status"] = "escalated"
                    req_data["escalated_to"] = escalation_target
                    break

            # Add to escalation history
            state["escalation_history"].append(escalation_event)

            # Update workflow escalation level
            state["escalation_level"] = max(
                state["escalation_level"],
                escalation_event["escalation_level"]
            )

            # Add to enhanced audit trail
            state["audit_trail_enhanced"].append({
                "event": "automatic_escalation",
                "timestamp": current_time.isoformat(),
                "escalation_id": escalation_event["escalation_id"],
                "requirement_id": str(requirement.id),
                "escalation_level": escalation_event["escalation_level"],
                "severity": escalation_assessment["severity"],
                "reason": escalation_assessment["reason"],
                "target_role": escalation_target["role"]
            })

            logger.info(
                f"Escalation processed: requirement {requirement.id} "
                f"escalated to {escalation_target['role']} (level {escalation_event['escalation_level']})"
            )

            return {
                "success": True,
                "event": escalation_event
            }

        except Exception as e:
            logger.error(f"Failed to process escalation for requirement {requirement.id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _send_escalation_notifications(
        self,
        state: dict[str, Any],
        escalation_event: dict[str, Any]
    ) -> dict[str, Any]:
        """Send notifications for escalation events."""

        notification_result = {
            "sent_count": 0,
            "failed_count": 0,
            "notifications": []
        }

        try:
            escalation_target = escalation_event["escalated_to"]
            severity = escalation_event["severity"]

            # Determine notification channels based on severity
            channels = self._get_notification_channels_for_severity(severity)

            # Prepare notification content
            notification_content = {
                "subject": f"Approval Escalation - {state['request_type'].replace('_', ' ').title()}",
                "message": self._build_escalation_message(state, escalation_event),
                "priority": severity,
                "workflow_id": state["workflow_id"],
                "escalation_id": escalation_event["escalation_id"],
                "recipient": escalation_target,
                "metadata": {
                    "escalation_level": escalation_event["escalation_level"],
                    "urgency_score": escalation_event["urgency_score"],
                    "sla_violation": escalation_event["sla_violation"]
                }
            }

            # Send notifications through each channel
            for channel in channels:
                try:
                    notification_id = await self.notification_service.send_notification(
                        channel, notification_content
                    )

                    notification_result["notifications"].append({
                        "id": notification_id,
                        "channel": channel,
                        "recipient": escalation_target,
                        "status": "sent",
                        "sent_at": datetime.utcnow().isoformat()
                    })
                    notification_result["sent_count"] += 1

                except Exception as e:
                    logger.error(f"Failed to send {channel} notification: {e}")
                    notification_result["notifications"].append({
                        "channel": channel,
                        "recipient": escalation_target,
                        "status": "failed",
                        "error": str(e),
                        "failed_at": datetime.utcnow().isoformat()
                    })
                    notification_result["failed_count"] += 1

            # Update state with notification records
            state["notifications_sent"].extend(notification_result["notifications"])

            return notification_result

        except Exception as e:
            logger.error(f"Failed to send escalation notifications: {e}")
            notification_result["failed_count"] += 1
            return notification_result

    def _get_notification_channels_for_severity(self, severity: EscalationSeverity) -> list[NotificationChannel]:
        """Get appropriate notification channels based on escalation severity."""

        channel_map = {
            EscalationSeverity.LOW: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
            EscalationSeverity.MEDIUM: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.IN_APP],
            EscalationSeverity.HIGH: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.SMS, NotificationChannel.IN_APP],
            EscalationSeverity.CRITICAL: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.SMS, NotificationChannel.WEBHOOK, NotificationChannel.IN_APP]
        }

        return channel_map.get(severity, [NotificationChannel.EMAIL])

    def _build_escalation_message(self, state: dict[str, Any], escalation_event: dict[str, Any]) -> str:
        """Build escalation notification message."""

        escalated_from = escalation_event["escalated_from"]
        escalated_to = escalation_event["escalated_to"]
        severity = escalation_event["severity"]
        reason = escalation_event["reason"]

        message = f"""
APPROVAL ESCALATION - {severity.upper()} PRIORITY

Workflow: {state['workflow_id']}
Request Type: {state['request_type'].replace('_', ' ').title()}
Escalation Level: {escalation_event['escalation_level']}

ESCALATION DETAILS:
- Escalated From: {escalated_from['role']} ({escalated_from.get('email', 'N/A')})
- Escalated To: {escalated_to['role']} ({escalated_to.get('email', 'N/A')})
- Reason: {reason}
- Urgency Score: {escalation_event['urgency_score']:.2f}/1.0

REQUEST SUMMARY:
- Requester: {state['requester_role']}
- Started: {state['started_at']}
- SLA Deadline: {state.get('sla_deadline', 'N/A')}
- Current Status: {state['sla_status']}
"""

        if escalation_event["sla_violation"]:
            message += f"\n⚠️  SLA VIOLATION: This request is {escalation_event['overdue_hours']:.1f} hours overdue."

        message += f"""

REQUIRED ACTION:
Please review and approve/reject this request as soon as possible.
Access the approval dashboard to take action.

Escalation ID: {escalation_event['escalation_id']}
"""

        return message.strip()

    async def _update_workflow_sla_status(
        self,
        state: dict[str, Any],
        escalation_results: dict[str, Any]
    ) -> None:
        """Update overall workflow SLA status based on escalation results."""

        current_time = datetime.utcnow()
        sla_deadline = state.get("sla_deadline")

        if not sla_deadline:
            return

        deadline_dt = datetime.fromisoformat(sla_deadline.replace("Z", "+00:00")).replace(tzinfo=None)

        # Calculate time remaining
        time_remaining_hours = (deadline_dt - current_time).total_seconds() / 3600

        # Update SLA status based on current situation
        if time_remaining_hours < 0:
            state["sla_status"] = "overdue"
        elif escalation_results["sla_violations"] > 0:
            state["sla_status"] = "overdue"
        elif escalation_results["escalations_processed"] > 0:
            state["sla_status"] = "at_risk"
        elif time_remaining_hours <= 4:  # Less than 4 hours remaining
            state["sla_status"] = "at_risk"
        else:
            state["sla_status"] = "on_time"

    async def get_escalation_metrics(self, state: dict[str, Any]) -> dict[str, Any]:
        """Get comprehensive escalation metrics for monitoring and reporting."""

        metrics = {
            "workflow_id": state["workflow_id"],
            "current_escalation_level": state["escalation_level"],
            "total_escalations": len(state["escalation_history"]),
            "sla_status": state["sla_status"],
            "escalation_breakdown": {
                "automatic": 0,
                "manual": 0,
                "by_severity": {
                    "low": 0,
                    "medium": 0,
                    "high": 0,
                    "critical": 0
                }
            },
            "notification_metrics": {
                "total_sent": len(state["notifications_sent"]),
                "by_channel": {},
                "success_rate": 0.0
            },
            "sla_metrics": {
                "deadline": state.get("sla_deadline"),
                "status": state["sla_status"],
                "violations": 0,
                "at_risk_count": 0
            }
        }

        # Analyze escalation history
        for escalation in state["escalation_history"]:
            if escalation.get("auto_escalated", False):
                metrics["escalation_breakdown"]["automatic"] += 1
            else:
                metrics["escalation_breakdown"]["manual"] += 1

            severity = escalation.get("severity", "medium")
            if severity in metrics["escalation_breakdown"]["by_severity"]:
                metrics["escalation_breakdown"]["by_severity"][severity] += 1

        # Analyze notification metrics
        successful_notifications = 0
        for notification in state["notifications_sent"]:
            channel = notification.get("channel", "unknown")
            if channel not in metrics["notification_metrics"]["by_channel"]:
                metrics["notification_metrics"]["by_channel"][channel] = {"sent": 0, "failed": 0}

            if notification.get("status") == "sent":
                metrics["notification_metrics"]["by_channel"][channel]["sent"] += 1
                successful_notifications += 1
            else:
                metrics["notification_metrics"]["by_channel"][channel]["failed"] += 1

        if len(state["notifications_sent"]) > 0:
            metrics["notification_metrics"]["success_rate"] = (
                successful_notifications / len(state["notifications_sent"])
            )

        # Analyze SLA metrics
        current_time = datetime.utcnow()
        for req_data in state["approval_requirements"]:
            if req_data["approval_status"] == "pending":
                deadline = datetime.fromisoformat(req_data["deadline"].replace("Z", "+00:00")).replace(tzinfo=None)
                if current_time > deadline:
                    metrics["sla_metrics"]["violations"] += 1
                elif (deadline - current_time).total_seconds() / 3600 <= 4:
                    metrics["sla_metrics"]["at_risk_count"] += 1

        return metrics


class SLATracker:
    """SLA tracking and monitoring service."""

    def __init__(self):
        self.sla_policies = self._load_default_sla_policies()

    def _load_default_sla_policies(self) -> dict[str, dict[str, Any]]:
        """Load default SLA policies for different request types."""

        return {
            "dependency_update": {
                "default_hours": 24,
                "critical_hours": 8,
                "high_hours": 16,
                "medium_hours": 24,
                "low_hours": 48
            },
            "security_override": {
                "default_hours": 12,
                "critical_hours": 2,
                "high_hours": 6,
                "medium_hours": 12,
                "low_hours": 24
            },
            "policy_exception": {
                "default_hours": 48,
                "critical_hours": 12,
                "high_hours": 24,
                "medium_hours": 48,
                "low_hours": 72
            },
            "compliance_exception": {
                "default_hours": 72,
                "critical_hours": 24,
                "high_hours": 48,
                "medium_hours": 72,
                "low_hours": 120
            },
            "emergency_override": {
                "default_hours": 4,
                "critical_hours": 1,
                "high_hours": 2,
                "medium_hours": 4,
                "low_hours": 8
            }
        }

    def calculate_sla_deadline(
        self,
        request_type: str,
        risk_level: str,
        created_at: datetime
    ) -> datetime:
        """Calculate SLA deadline based on request type and risk level."""

        policy = self.sla_policies.get(request_type, self.sla_policies["dependency_update"])
        hours_key = f"{risk_level}_hours"
        sla_hours = policy.get(hours_key, policy["default_hours"])

        return created_at + timedelta(hours=sla_hours)

    def get_sla_status(
        self,
        deadline: datetime,
        current_time: Optional[datetime] = None
    ) -> tuple[str, float]:
        """Get SLA status and time remaining in hours."""

        if current_time is None:
            current_time = datetime.utcnow()

        time_remaining_hours = (deadline - current_time).total_seconds() / 3600

        if time_remaining_hours < 0:
            return "overdue", time_remaining_hours
        elif time_remaining_hours <= 2:
            return "critical", time_remaining_hours
        elif time_remaining_hours <= 8:
            return "at_risk", time_remaining_hours
        else:
            return "on_time", time_remaining_hours


class NotificationService:
    """Mock notification service for sending escalation alerts."""

    async def send_notification(
        self,
        channel: NotificationChannel,
        content: dict[str, Any]
    ) -> str:
        """Send notification through specified channel."""

        notification_id = str(uuid4())

        # Mock implementation - in real system, this would integrate with
        # actual notification services (email, Slack, SMS, etc.)
        logger.info(
            f"Sending {channel} notification to {content['recipient']['email']}: "
            f"{content['subject']}"
        )

        # Simulate different success rates for different channels
        import random
        if channel == NotificationChannel.EMAIL:
            success_rate = 0.95
        elif channel == NotificationChannel.SLACK:
            success_rate = 0.90
        elif channel == NotificationChannel.SMS:
            success_rate = 0.85
        else:
            success_rate = 0.80

        if random.random() > success_rate:
            raise Exception(f"Failed to send {channel} notification")

        return notification_id
