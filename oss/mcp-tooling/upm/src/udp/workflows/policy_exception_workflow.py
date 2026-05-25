"""
Policy Exception Workflow with LangGraph Integration

This module implements intelligent policy exception request workflows using LangGraph
for automated routing, decision making, and approval processes.
"""

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.pydantic_v1 import BaseModel, Field
from langgraph.graph import END, StateGraph
from udp.core.models.violation import (
    ExceptionType,
)
from udp.services.violation_service import ExceptionRequestService
from udp.workflows.approval_workflow import ApprovalType, ApprovalWorkflow

logger = logging.getLogger(__name__)


class ExceptionWorkflowState(BaseModel):
    """State for policy exception workflow."""

    # Request information
    exception_request_id: Optional[UUID] = Field(default=None)
    project_id: Optional[UUID] = Field(default=None)
    policy_id: Optional[UUID] = Field(default=None)
    violation_id: Optional[UUID] = Field(default=None)
    requester_id: Optional[UUID] = Field(default=None)

    # Exception details
    exception_data: dict[str, Any] = Field(default_factory=dict)
    exception_type: Optional[str] = Field(default=None)
    justification: Optional[str] = Field(default=None)
    business_risk: Optional[str] = Field(default=None)

    # Workflow state
    current_step: str = Field(default="initialize")
    status: str = Field(default="pending")
    messages: list[BaseMessage] = Field(default_factory=list)

    # Risk assessment
    risk_score: Optional[float] = Field(default=None)
    risk_level: Optional[str] = Field(default=None)

    # Decision making
    requires_approval: bool = Field(default=True)
    approval_workflow_id: Optional[UUID] = Field(default=None)
    auto_approval_eligible: bool = Field(default=False)

    # Compliance checks
    compliance_checks: list[dict[str, Any]] = Field(default_factory=list)

    # Results
    final_decision: Optional[str] = Field(default=None)
    decision_reason: Optional[str] = Field(default=None)
    approval_conditions: list[dict[str, Any]] = Field(default_factory=list)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        arbitrary_types_allowed = True


class PolicyExceptionWorkflow:
    """
    Intelligent policy exception workflow using LangGraph.

    Provides automated decision making, risk assessment, and approval
    routing for policy exception requests.
    """

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.exception_service = ExceptionRequestService()
        self.approval_workflow = ApprovalWorkflow(organization_id)

        # Build the workflow graph
        self.workflow = self._build_workflow()

    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow for policy exceptions."""

        workflow = StateGraph(ExceptionWorkflowState)

        # Add nodes
        workflow.add_node("initialize", self._initialize_exception)
        workflow.add_node("risk_assessment", self._assess_risk)
        workflow.add_node("compliance_check", self._check_compliance)
        workflow.add_node("auto_approval_check", self._check_auto_approval)
        workflow.add_node("initiate_approval", self._initiate_approval_workflow)
        workflow.add_node("monitor_approval", self._monitor_approval)
        workflow.add_node("finalize_decision", self._finalize_decision)
        workflow.add_node("notify_stakeholders", self._notify_stakeholders)

        # Add conditional edges
        workflow.add_conditional_edges(
            "initialize",
            self._route_after_initialization,
            {
                "risk_assessment": "risk_assessment",
                "auto_approval": "auto_approval_check",
                "reject": "finalize_decision",
            },
        )

        workflow.add_conditional_edges(
            "risk_assessment",
            self._route_after_risk_assessment,
            {
                "compliance_check": "compliance_check",
                "auto_approval": "auto_approval_check",
                "initiate_approval": "initiate_approval",
                "reject": "finalize_decision",
            },
        )

        workflow.add_conditional_edges(
            "compliance_check",
            self._route_after_compliance_check,
            {
                "auto_approval": "auto_approval_check",
                "initiate_approval": "initiate_approval",
                "reject": "finalize_decision",
            },
        )

        workflow.add_conditional_edges(
            "auto_approval_check",
            self._route_after_auto_approval_check,
            {
                "approve": "finalize_decision",
                "initiate_approval": "initiate_approval",
                "reject": "finalize_decision",
            },
        )

        workflow.add_conditional_edges(
            "initiate_approval",
            self._route_after_approval_initiation,
            {
                "monitor": "monitor_approval",
                "approve": "finalize_decision",
                "reject": "finalize_decision",
            },
        )

        workflow.add_conditional_edges(
            "monitor_approval",
            self._check_approval_status,
            {
                "approved": "finalize_decision",
                "rejected": "finalize_decision",
                "monitor": "monitor_approval",
            },
        )

        # Final edges
        workflow.add_edge("finalize_decision", "notify_stakeholders")
        workflow.add_edge("notify_stakeholders", END)

        # Set entry point
        workflow.set_entry_point("initialize")

        return workflow.compile()

    async def execute(
        self,
        exception_request_id: UUID,
        exception_data: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute the policy exception workflow."""

        initial_state = ExceptionWorkflowState(
            exception_request_id=exception_request_id,
            project_id=exception_data.get("project_id"),
            policy_id=exception_data.get("policy_id"),
            violation_id=exception_data.get("violation_id"),
            requester_id=exception_data.get("requester_id"),
            exception_data=exception_data,
            exception_type=exception_data.get("exception_type"),
            justification=exception_data.get("justification"),
            business_risk=exception_data.get("business_risk"),
        )

        # Add initial message
        initial_state.messages.append(
            HumanMessage(
                content=f"Processing policy exception request: {exception_data.get('title', 'Untitled')}"
            )
        )

        # Execute workflow
        logger.info(
            f"Starting policy exception workflow for request {exception_request_id}"
        )

        try:
            result = await self.workflow.ainvoke(initial_state)

            logger.info(
                f"Policy exception workflow completed for request {exception_request_id}. "
                f"Final decision: {result.final_decision}"
            )

            return result.dict()

        except Exception as e:
            logger.error(
                f"Policy exception workflow failed for request {exception_request_id}: {e}"
            )
            raise

    async def _initialize_exception(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Initialize the exception workflow."""

        logger.info(
            f"Initializing exception workflow for request {state.exception_request_id}"
        )

        state.current_step = "initialize"
        state.updated_at = datetime.utcnow()

        # Add system message
        state.messages.append(
            AIMessage(
                content="Exception request initialized. Performing validation and preliminary checks."
            )
        )

        # Validate exception request
        validation_result = await self._validate_exception_request(state)

        if not validation_result["valid"]:
            state.final_decision = "rejected"
            state.decision_reason = validation_result["reason"]
            state.messages.append(
                AIMessage(
                    content=f"Exception request validation failed: {validation_result['reason']}"
                )
            )
            return state

        # Determine if detailed assessment is needed
        if (
            state.exception_type == ExceptionType.ONE_TIME
            and self._is_low_risk_exception(state)
        ):
            return state  # Route to auto-approval

        # Determine next routing
        if self._requires_risk_assessment(state):
            state.messages.append(AIMessage(content="Routing to risk assessment..."))
            return state

        return state

    async def _assess_risk(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Perform risk assessment for the exception request."""

        logger.info(
            f"Assessing risk for exception request {state.exception_request_id}"
        )

        state.current_step = "risk_assessment"
        state.updated_at = datetime.utcnow()

        # Calculate risk score
        risk_score = await self._calculate_risk_score(state)
        state.risk_score = risk_score

        # Determine risk level
        if risk_score >= 8.0:
            state.risk_level = "critical"
        elif risk_score >= 6.0:
            state.risk_level = "high"
        elif risk_score >= 4.0:
            state.risk_level = "medium"
        else:
            state.risk_level = "low"

        # Add AI message with risk assessment
        state.messages.append(
            AIMessage(
                content=f"Risk assessment complete. Risk score: {risk_score:.1f}/10 "
                f"({state.risk_level} risk)"
            )
        )

        return state

    async def _check_compliance(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Perform compliance checks for the exception request."""

        logger.info(
            f"Checking compliance for exception request {state.exception_request_id}"
        )

        state.current_step = "compliance_check"
        state.updated_at = datetime.utcnow()

        # Perform compliance checks
        compliance_results = await self._perform_compliance_checks(state)
        state.compliance_checks = compliance_results

        # Check if any compliance issues
        critical_issues = [
            check
            for check in compliance_results
            if check.get("severity") == "critical" and not check.get("passed", False)
        ]

        if critical_issues:
            state.final_decision = "rejected"
            state.decision_reason = f"Critical compliance issues: {[issue['description'] for issue in critical_issues]}"
            state.messages.append(
                AIMessage(
                    content="Exception request rejected due to critical compliance issues"
                )
            )

        state.messages.append(
            AIMessage(
                content=f"Compliance checks completed. {len(compliance_results)} checks performed"
            )
        )

        return state

    async def _check_auto_approval(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Check if exception is eligible for automatic approval."""

        logger.info(
            f"Checking auto-approval eligibility for request {state.exception_request_id}"
        )

        state.current_step = "auto_approval_check"
        state.updated_at = datetime.utcnow()

        # Check auto-approval conditions
        auto_approval_result = await self._evaluate_auto_approval(state)
        state.auto_approval_eligible = auto_approval_result["eligible"]

        if auto_approval_result["eligible"]:
            state.final_decision = "approved"
            state.decision_reason = auto_approval_result["reason"]
            state.approval_conditions = auto_approval_result.get("conditions", [])

            state.messages.append(
                AIMessage(
                    content=f"Exception auto-approved: {auto_approval_result['reason']}"
                )
            )
        else:
            state.messages.append(
                AIMessage(
                    content=f"Auto-approval not eligible: {auto_approval_result['reason']}"
                )
            )

        return state

    async def _initiate_approval_workflow(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Initiate formal approval workflow."""

        logger.info(
            f"Initiating approval workflow for request {state.exception_request_id}"
        )

        state.current_step = "initiate_approval"
        state.updated_at = datetime.utcnow()

        # Prepare approval request data with enhanced context for policy exceptions
        approval_data = {
            "project_id": state.project_id,
            "request_type": ApprovalType.POLICY_EXCEPTION,
            "request_data": {
                "exception_request_id": state.exception_request_id,
                "policy_id": state.policy_id,
                "violation_id": state.violation_id,
                "exception_type": state.exception_type,
                "justification": state.justification,
                "business_risk": state.business_risk,
                "risk_score": state.risk_score,
                "risk_level": state.risk_level,
                "compliance_checks": state.compliance_checks,
                "policy_violations": state.exception_data.get("policy_violations", []),
                "license_violations": state.exception_data.get(
                    "license_violations", []
                ),
                "dependency_count": state.exception_data.get("dependency_count", 0),
                "affected_components": state.exception_data.get(
                    "affected_components", []
                ),
                "exception_conditions": state.exception_data.get("conditions", []),
                "mitigation_plan": state.exception_data.get("mitigation_plan", ""),
            },
            "requester_id": state.requester_id,
            "requester_role": await self._get_requester_role(state.requester_id),
        }

        # Add policy-specific context
        if state.policy_id:
            policy_context = await self._get_policy_context(state.policy_id)
            approval_data["request_data"]["policy_context"] = policy_context

        # Execute approval workflow
        approval_state = await self.approval_workflow.execute(**approval_data)

        state.approval_workflow_id = approval_state.get("workflow_id")

        # Check if workflow completed immediately
        if approval_state.get("status") == "completed":
            state.final_decision = approval_state.get("final_decision")
            state.decision_reason = approval_state.get("decision_rationale")
            state.approval_conditions = approval_state.get("approval_conditions", [])

            # Extract policy-specific approval conditions
            if state.approval_conditions:
                state.approval_conditions = self._process_policy_approval_conditions(
                    state.approval_conditions
                )

            state.messages.append(
                AIMessage(
                    content=f"Approval workflow completed: {state.final_decision}"
                )
            )
        else:
            state.messages.append(
                AIMessage(
                    content=f"Approval workflow initiated: {state.approval_workflow_id}"
                )
            )

        return state

    async def _monitor_approval(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Monitor approval workflow progress."""

        logger.info(
            f"Monitoring approval workflow for request {state.exception_request_id}"
        )

        state.current_step = "monitor_approval"
        state.updated_at = datetime.utcnow()

        # Check approval status (would integrate with workflow service)
        approval_status = await self._get_approval_status(state.approval_workflow_id)

        if approval_status["completed"]:
            state.final_decision = approval_status["decision"]
            state.decision_reason = approval_status.get("reason")
            state.approval_conditions = approval_status.get("conditions", [])

            state.messages.append(
                AIMessage(
                    content=f"Approval workflow completed with decision: {state.final_decision}"
                )
            )
        else:
            state.messages.append(
                AIMessage(
                    content=f"Approval workflow in progress: {approval_status['current_status']}"
                )
            )

        return state

    async def _finalize_decision(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Finalize the exception request decision."""

        logger.info(
            f"Finalizing decision for exception request {state.exception_request_id}: "
            f"{state.final_decision}"
        )

        state.current_step = "finalize_decision"
        state.updated_at = datetime.utcnow()

        # Update exception request in database
        await self._update_exception_request(state)

        # Add final message
        decision_text = "approved" if state.final_decision == "approved" else "rejected"
        state.messages.append(
            AIMessage(
                content=f"Exception request {decision_text}. Reason: {state.decision_reason}"
            )
        )

        return state

    async def _notify_stakeholders(
        self, state: ExceptionWorkflowState
    ) -> ExceptionWorkflowState:
        """Notify stakeholders of the decision."""

        logger.info(
            f"Notifying stakeholders for exception request {state.exception_request_id}"
        )

        state.current_step = "notify_stakeholders"
        state.updated_at = datetime.utcnow()

        # Send notifications (would integrate with notification service)
        await self._send_notifications(state)

        state.messages.append(
            AIMessage(content="Stakeholders notified of the decision")
        )

        return state

    # Routing methods
    def _route_after_initialization(self, state: ExceptionWorkflowState) -> str:
        """Determine next step after initialization."""

        if state.final_decision == "rejected":
            return "reject"

        if (
            self._is_low_risk_exception(state)
            and state.exception_type == ExceptionType.ONE_TIME
        ):
            return "auto_approval"

        if self._requires_risk_assessment(state):
            return "risk_assessment"

        return "compliance_check"

    def _route_after_risk_assessment(self, state: ExceptionWorkflowState) -> str:
        """Determine next step after risk assessment."""

        if state.final_decision == "rejected":
            return "reject"

        if state.risk_level == "low" and state.exception_type in [
            ExceptionType.ONE_TIME,
            ExceptionType.TEMPORARY,
        ]:
            return "auto_approval"

        if self._requires_compliance_check(state):
            return "compliance_check"

        return "initiate_approval"

    def _route_after_compliance_check(self, state: ExceptionWorkflowState) -> str:
        """Determine next step after compliance check."""

        if state.final_decision == "rejected":
            return "reject"

        if state.risk_level in ["low", "medium"] and not state.compliance_checks:
            return "auto_approval"

        return "initiate_approval"

    def _route_after_auto_approval_check(self, state: ExceptionWorkflowState) -> str:
        """Determine next step after auto-approval check."""

        if state.final_decision == "approved":
            return "approve"

        if state.final_decision == "rejected":
            return "reject"

        return "initiate_approval"

    def _route_after_approval_initiation(self, state: ExceptionWorkflowState) -> str:
        """Determine next step after approval initiation."""

        if state.final_decision in ["approved", "rejected"]:
            return state.final_decision

        return "monitor"

    async def _check_approval_status(self, state: ExceptionWorkflowState) -> str:
        """Check approval workflow status."""

        # Would integrate with workflow service to check status
        approval_status = await self._get_approval_status(state.approval_workflow_id)

        if approval_status["completed"]:
            return approval_status["decision"]

        return "monitor"

    # Helper methods
    async def _validate_exception_request(
        self, state: ExceptionWorkflowState
    ) -> dict[str, Any]:
        """Validate the exception request."""

        # Check required fields
        if not state.project_id:
            return {"valid": False, "reason": "Project ID is required"}

        if not state.policy_id:
            return {"valid": False, "reason": "Policy ID is required"}

        if not state.requester_id:
            return {"valid": False, "reason": "Requester ID is required"}

        if not state.justification:
            return {"valid": False, "reason": "Justification is required"}

        # Validate exception type
        if state.exception_type not in [e.value for e in ExceptionType]:
            return {"valid": False, "reason": "Invalid exception type"}

        # Additional business validation would go here

        return {"valid": True, "reason": None}

    def _requires_risk_assessment(self, state: ExceptionWorkflowState) -> bool:
        """Determine if risk assessment is required."""

        # High-risk exception types require assessment
        if state.exception_type in [ExceptionType.PERMANENT, ExceptionType.CONDITIONAL]:
            return True

        # Exceptions with business risk require assessment
        if state.business_risk:
            return True

        # Long duration temporary exceptions require assessment
        if state.exception_type == ExceptionType.TEMPORARY:
            duration = state.exception_data.get("duration_days", 0)
            if duration > 30:  # More than 30 days requires assessment
                return True

        return False

    def _requires_compliance_check(self, state: ExceptionWorkflowState) -> bool:
        """Determine if compliance checks are required."""

        # High risk requires compliance check
        if state.risk_level in ["high", "critical"]:
            return True

        # Certain exception types require compliance check
        if state.exception_type in [ExceptionType.PERMANENT, ExceptionType.CONDITIONAL]:
            return True

        # Policies tagged as compliance-related require check
        # This would check policy tags/categories

        return False

    def _is_low_risk_exception(self, state: ExceptionWorkflowState) -> bool:
        """Check if this is a low-risk exception."""

        # One-time exceptions are typically low risk
        if state.exception_type == ExceptionType.ONE_TIME:
            return True

        # Short duration temporary exceptions
        if state.exception_type == ExceptionType.TEMPORARY:
            duration = state.exception_data.get("duration_days", 0)
            if duration <= 7:  # 7 days or less
                return True

        # Check if policy is low severity
        # This would check policy severity level

        return False

    async def _calculate_risk_score(self, state: ExceptionWorkflowState) -> float:
        """Calculate risk score for the exception request."""

        score = 0.0

        # Base score by exception type
        type_scores = {
            ExceptionType.ONE_TIME: 1.0,
            ExceptionType.TEMPORARY: 2.0,
            ExceptionType.CONDITIONAL: 4.0,
            ExceptionType.PERMANENT: 6.0,
        }
        score += type_scores.get(state.exception_type, 3.0)

        # Duration factor
        if state.exception_type == ExceptionType.TEMPORARY:
            duration = state.exception_data.get("duration_days", 0)
            if duration > 365:
                score += 3.0
            elif duration > 90:
                score += 2.0
            elif duration > 30:
                score += 1.0

        # Business risk factor
        if state.business_risk:
            if "critical" in state.business_risk.lower():
                score += 4.0
            elif "high" in state.business_risk.lower():
                score += 3.0
            elif "medium" in state.business_risk.lower():
                score += 2.0
            else:
                score += 1.0

        # Policy severity factor (would fetch from policy)
        # For now, assume medium risk
        score += 2.0

        # Cap score at 10
        return min(10.0, score)

    async def _perform_compliance_checks(
        self, state: ExceptionWorkflowState
    ) -> list[dict[str, Any]]:
        """Perform compliance checks for the exception."""

        checks = []

        # Check if exception conflicts with regulatory requirements
        # This would integrate with compliance service

        # Check if exception affects audit requirements
        checks.append(
            {
                "type": "audit_impact",
                "description": "Check if exception affects audit requirements",
                "severity": "medium",
                "passed": True,  # Would perform actual check
                "details": {},
            }
        )

        # Check if exception requires documentation
        checks.append(
            {
                "type": "documentation_required",
                "description": "Check if exception requires special documentation",
                "severity": "low",
                "passed": True,
                "details": {},
            }
        )

        # Check if exception affects reporting requirements
        checks.append(
            {
                "type": "reporting_impact",
                "description": "Check if exception affects regulatory reporting",
                "severity": "high",
                "passed": True,
                "details": {},
            }
        )

        return checks

    async def _evaluate_auto_approval(
        self, state: ExceptionWorkflowState
    ) -> dict[str, Any]:
        """Evaluate if exception is eligible for automatic approval."""

        # Auto-approval conditions
        conditions = {
            "low_risk": state.risk_level == "low",
            "one_time_exception": state.exception_type == ExceptionType.ONE_TIME,
            "short_duration": (
                state.exception_type == ExceptionType.TEMPORARY
                and state.exception_data.get("duration_days", 0) <= 7
            ),
            "no_compliance_issues": all(
                check.get("passed", False) for check in state.compliance_checks
            ),
            "trusted_requester": await self._is_trusted_requester(state.requester_id),
        }

        # Check if all conditions are met
        all_conditions_met = all(conditions.values())

        if all_conditions_met:
            return {
                "eligible": True,
                "reason": "Low-risk exception meeting all auto-approval criteria",
                "conditions": [
                    {
                        "type": "monitoring",
                        "description": "Monitor exception compliance throughout its duration",
                    }
                ],
            }
        else:
            failed_conditions = [name for name, met in conditions.items() if not met]

            return {
                "eligible": False,
                "reason": f"Auto-approval criteria not met: {', '.join(failed_conditions)}",
            }

    async def _is_trusted_requester(self, requester_id: UUID) -> bool:
        """Check if requester is trusted for auto-approval."""

        # This would check user's role, history, and trust score
        # For now, return False to be conservative
        return False

    async def _get_approval_status(self, workflow_id: UUID) -> dict[str, Any]:
        """Get approval workflow status."""

        # This would integrate with workflow service
        # For now, return mock status
        return {
            "workflow_id": workflow_id,
            "completed": False,
            "current_status": "pending_approval",
            "decision": None,
            "reason": None,
            "conditions": [],
        }

    async def _update_exception_request(self, state: ExceptionWorkflowState) -> None:
        """Update exception request with final decision."""

        # This would update the exception request in the database
        # using the exception service

        logger.info(
            f"Updating exception request {state.exception_request_id} "
            f"with decision: {state.final_decision}"
        )

    async def _send_notifications(self, state: ExceptionWorkflowState) -> None:
        """Send notifications to stakeholders."""

        # This would integrate with notification service
        logger.info(
            f"Sending notifications for exception request {state.exception_request_id}"
        )

    async def _get_requester_role(self, requester_id: UUID) -> str:
        """Get the role of the requester for approval workflow."""

        # This would integrate with user service to get user role
        # For now, return a default role
        return "project_member"

    async def _get_policy_context(self, policy_id: UUID) -> dict[str, Any]:
        """Get policy context for approval workflow."""

        # This would fetch policy details from the database
        # For now, return mock context
        return {
            "policy_name": "Security Policy",
            "policy_type": "security",
            "policy_severity": "high",
            "policy_category": "vulnerability_management",
        }

    def _process_policy_approval_conditions(
        self, conditions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Process and enhance policy-specific approval conditions."""

        processed_conditions = []

        for condition in conditions:
            # Add policy-specific conditions
            if condition.get("type") == "monitoring":
                condition.update(
                    {
                        "monitoring_type": "policy_compliance",
                        "monitoring_frequency": "weekly",
                        "escalation_threshold": 3,
                    }
                )
            elif condition.get("type") == "documentation":
                condition.update(
                    {
                        "documentation_required": [
                            "exception_justification",
                            "risk_assessment",
                            "mitigation_plan",
                            "review_board_approval",
                        ]
                    }
                )
            elif condition.get("type") == "review":
                condition.update(
                    {
                        "review_frequency": "quarterly",
                        "review_criteria": [
                            "compliance_status",
                            "risk_impact",
                            "business_necessity",
                        ],
                    }
                )

            processed_conditions.append(condition)

        return processed_conditions
