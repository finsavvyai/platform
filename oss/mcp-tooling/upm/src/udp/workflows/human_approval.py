"""
Human-in-the-Loop Approval Workflow with LangGraph Integration.

Implements sophisticated approval workflows with human decision points,
intelligent routing, and comprehensive audit trails for enterprise governance.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Annotated, Any, Optional, TypedDict
from uuid import UUID, uuid4

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.graph import CompiledGraph
from udp.domain.models import ApprovalResponse, WorkflowStatus
from udp.infrastructure.notifications import NotificationService
from udp.services.approval_service import ApprovalService, ApprovalStatus
from udp.services.escalation_service import EscalationService

logger = logging.getLogger(__name__)


class HumanApprovalNode(str, Enum):
    """Human approval workflow nodes."""

    INITIALIZE = "initialize"
    ANALYZE_REQUEST = "analyze_request"
    DETERMINE_STAKEHOLDERS = "determine_stakeholders"
    GENERATE_REQUIREMENTS = "generate_requirements"
    CHECK_AUTO_APPROVAL = "check_auto_approval"
    INITIATE_APPROVALS = "initiate_approvals"
    WAIT_FOR_RESPONSES = "wait_for_responses"
    PROCESS_RESPONSE = "process_response"
    CHECK_COMPLETION = "check_completion"
    ESCALATE_IF_NEEDED = "escalate_if_needed"
    COMPLETE_WORKFLOW = "complete_workflow"
    HANDLE_REJECTION = "handle_rejection"
    HANDLE_TIMEOUT = "handle_timeout"


class ApprovalWorkflowState(TypedDict):
    """Typed state for approval workflow."""

    # Base workflow state
    workflow_id: str
    workflow_type: str
    organization_id: str
    project_id: Optional[str]
    status: str
    current_step: str
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    retry_count: int
    max_retries: int
    audit_log: list[dict[str, Any]]
    performance_metrics: dict[str, Any]

    # Approval-specific state
    request_type: str
    request_data: dict[str, Any]
    requester_id: str
    requester_role: str
    approval_requirements: list[dict[str, Any]]
    approval_responses: dict[str, Any]
    current_approvers: list[dict[str, Any]]
    stakeholder_hierarchy: dict[str, Any]

    # SLA and escalation
    sla_deadline: Optional[datetime]
    sla_status: str
    escalation_level: int
    escalation_policies: dict[str, Any]

    # Decision making
    final_decision: Optional[str]
    decision_rationale: Optional[str]
    decision_confidence: Optional[float]

    # LangGraph state annotations
    messages: Annotated[list[str], "Workflow messages"]
    next_step: Optional[str]


class HumanApprovalWorkflow:
    """
    Comprehensive human-in-the-loop approval workflow using LangGraph.

    Provides intelligent routing, stakeholder management, SLA tracking,
    and comprehensive audit trails for enterprise approval processes.
    """

    def __init__(self, organization_id: UUID, approval_service: ApprovalService):
        self.organization_id = organization_id
        self.approval_service = approval_service
        self.escalation_service = EscalationService(organization_id)
        self.notification_service = NotificationService(organization_id)
        self.checkpoint_saver = MemorySaver()
        self.workflow_graph: Optional[CompiledGraph] = None
        self._build_workflow_graph()

    def _build_workflow_graph(self) -> None:
        """Build the LangGraph workflow graph."""

        # Create workflow graph
        workflow = StateGraph(ApprovalWorkflowState)

        # Add nodes
        workflow.add_node(HumanApprovalNode.INITIALIZE, self._initialize_workflow)
        workflow.add_node(HumanApprovalNode.ANALYZE_REQUEST, self._analyze_request)
        workflow.add_node(
            HumanApprovalNode.DETERMINE_STAKEHOLDERS, self._determine_stakeholders
        )
        workflow.add_node(
            HumanApprovalNode.GENERATE_REQUIREMENTS, self._generate_requirements
        )
        workflow.add_node(
            HumanApprovalNode.CHECK_AUTO_APPROVAL, self._check_auto_approval
        )
        workflow.add_node(
            HumanApprovalNode.INITIATE_APPROVALS, self._initiate_approvals
        )
        workflow.add_node(
            HumanApprovalNode.WAIT_FOR_RESPONSES, self._wait_for_responses
        )
        workflow.add_node(HumanApprovalNode.PROCESS_RESPONSE, self._process_response)
        workflow.add_node(HumanApprovalNode.CHECK_COMPLETION, self._check_completion)
        workflow.add_node(
            HumanApprovalNode.ESCALATE_IF_NEEDED, self._escalate_if_needed
        )
        workflow.add_node(HumanApprovalNode.COMPLETE_WORKFLOW, self._complete_workflow)
        workflow.add_node(HumanApprovalNode.HANDLE_REJECTION, self._handle_rejection)
        workflow.add_node(HumanApprovalNode.HANDLE_TIMEOUT, self._handle_timeout)

        # Set entry point
        workflow.set_entry_point(HumanApprovalNode.INITIALIZE)

        # Add edges - Define the flow
        workflow.add_edge(
            HumanApprovalNode.INITIALIZE, HumanApprovalNode.ANALYZE_REQUEST
        )
        workflow.add_edge(
            HumanApprovalNode.ANALYZE_REQUEST, HumanApprovalNode.DETERMINE_STAKEHOLDERS
        )
        workflow.add_edge(
            HumanApprovalNode.DETERMINE_STAKEHOLDERS,
            HumanApprovalNode.GENERATE_REQUIREMENTS,
        )
        workflow.add_edge(
            HumanApprovalNode.GENERATE_REQUIREMENTS,
            HumanApprovalNode.CHECK_AUTO_APPROVAL,
        )

        # Conditional edge for auto-approval
        workflow.add_conditional_edges(
            HumanApprovalNode.CHECK_AUTO_APPROVAL,
            self._route_after_auto_approval_check,
            {
                "auto_approved": HumanApprovalNode.COMPLETE_WORKFLOW,
                "requires_approval": HumanApprovalNode.INITIATE_APPROVALS,
            },
        )

        workflow.add_edge(
            HumanApprovalNode.INITIATE_APPROVALS, HumanApprovalNode.WAIT_FOR_RESPONSES
        )

        # Conditional edge for response handling
        workflow.add_conditional_edges(
            HumanApprovalNode.WAIT_FOR_RESPONSES,
            self._check_response_status,
            {
                "response_received": HumanApprovalNode.PROCESS_RESPONSE,
                "timeout": HumanApprovalNode.HANDLE_TIMEOUT,
                "waiting": HumanApprovalNode.WAIT_FOR_RESPONSES,
            },
        )

        workflow.add_edge(
            HumanApprovalNode.PROCESS_RESPONSE, HumanApprovalNode.CHECK_COMPLETION
        )

        # Conditional edge for completion check
        workflow.add_conditional_edges(
            HumanApprovalNode.CHECK_COMPLETION,
            self._route_after_completion_check,
            {
                "completed": HumanApprovalNode.COMPLETE_WORKFLOW,
                "rejected": HumanApprovalNode.HANDLE_REJECTION,
                "needs_escalation": HumanApprovalNode.ESCALATE_IF_NEEDED,
                "waiting": HumanApprovalNode.WAIT_FOR_RESPONSES,
            },
        )

        workflow.add_edge(
            HumanApprovalNode.ESCALATE_IF_NEEDED, HumanApprovalNode.WAIT_FOR_RESPONSES
        )
        workflow.add_edge(
            HumanApprovalNode.HANDLE_REJECTION, HumanApprovalNode.COMPLETE_WORKFLOW
        )
        workflow.add_edge(
            HumanApprovalNode.HANDLE_TIMEOUT, HumanApprovalNode.ESCALATE_IF_NEEDED
        )
        workflow.add_edge(HumanApprovalNode.COMPLETE_WORKFLOW, END)

        # Compile the graph with checkpointing
        self.workflow_graph = workflow.compile(checkpointer=self.checkpoint_saver)

    async def execute_workflow(
        self,
        request_type: str,
        request_data: dict[str, Any],
        requester_id: UUID,
        requester_role: str,
        workflow_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Execute the human approval workflow.

        Initiates and manages the complete approval workflow with intelligent
        routing, stakeholder management, and comprehensive tracking.
        """

        # Generate workflow ID if not provided
        if not workflow_id:
            workflow_id = str(uuid4())

        # Initialize workflow state
        initial_state: ApprovalWorkflowState = {
            "workflow_id": workflow_id,
            "workflow_type": "human_approval",
            "organization_id": str(self.organization_id),
            "project_id": request_data.get("project_id"),
            "status": WorkflowStatus.PENDING.value,
            "current_step": HumanApprovalNode.INITIALIZE,
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "error_message": None,
            "retry_count": 0,
            "max_retries": 3,
            "audit_log": [],
            "performance_metrics": {},
            # Approval-specific
            "request_type": request_type,
            "request_data": request_data,
            "requester_id": str(requester_id),
            "requester_role": requester_role,
            "approval_requirements": [],
            "approval_responses": {},
            "current_approvers": [],
            "stakeholder_hierarchy": {},
            # SLA and escalation
            "sla_deadline": None,
            "sla_status": "on_time",
            "escalation_level": 0,
            "escalation_policies": {},
            # Decision making
            "final_decision": None,
            "decision_rationale": None,
            "decision_confidence": None,
            # LangGraph state
            "messages": [f"Starting approval workflow for {request_type}"],
            "next_step": None,
        }

        try:
            # Execute workflow
            if not self.workflow_graph:
                raise RuntimeError("Workflow graph not initialized")

            # Configure execution config
            config = {
                "configurable": {
                    "thread_id": workflow_id,
                    "thread_ts": datetime.utcnow().isoformat(),
                }
            }

            # Run workflow asynchronously
            result = await self.workflow_graph.ainvoke(initial_state, config=config)

            logger.info(
                f"Completed approval workflow {workflow_id} with status: {result['status']}"
            )

            return {
                "workflow_id": workflow_id,
                "status": result["status"],
                "final_decision": result.get("final_decision"),
                "decision_rationale": result.get("decision_rationale"),
                "completed_at": result.get("completed_at"),
                "approval_responses": result.get("approval_responses", {}),
                "escalation_level": result.get("escalation_level", 0),
                "sla_status": result.get("sla_status", "on_time"),
                "audit_log": result.get("audit_log", []),
            }

        except Exception as e:
            logger.error(f"Approval workflow {workflow_id} failed: {e}")

            # Update state with error
            error_state = initial_state.copy()
            error_state["status"] = WorkflowStatus.FAILED.value
            error_state["error_message"] = str(e)
            error_state["completed_at"] = datetime.utcnow()

            error_state["audit_log"].append(
                {
                    "event": "workflow_failed",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": str(e),
                    "step": error_state["current_step"],
                }
            )

            return {
                "workflow_id": workflow_id,
                "status": WorkflowStatus.FAILED.value,
                "error": str(e),
                "completed_at": error_state["completed_at"],
                "audit_log": error_state["audit_log"],
            }

    async def submit_approval_response(
        self, workflow_id: str, response: ApprovalResponse
    ) -> dict[str, Any]:
        """
        Submit an approval response to an active workflow.

        Routes the response through the LangGraph workflow for processing
        and continuation based on business rules and dependencies.
        """

        try:
            # Load current workflow state
            config = {
                "configurable": {
                    "thread_id": workflow_id,
                    "thread_ts": datetime.utcnow().isoformat(),
                }
            }

            # Get current state
            current_state = await self.workflow_graph.get_state(config)
            if not current_state:
                raise ValueError(f"Workflow {workflow_id} not found or not active")

            # Add response to state
            updated_state = current_state.values.copy()
            approver_key = f"{response.approver_role}_{response.approver_id}"
            updated_state["approval_responses"][approver_key] = {
                "response": response.dict(),
                "timestamp": datetime.utcnow().isoformat(),
            }
            updated_state["messages"].append(
                f"Received approval response from {response.approver_role}: {response.status}"
            )

            # Update state and trigger next step
            await self.workflow_graph.aupdate_state(
                config, updated_state, as_node=HumanApprovalNode.PROCESS_RESPONSE
            )

            # Continue workflow execution
            result = await self.workflow_graph.ainvoke(updated_state, config=config)

            logger.info(
                f"Processed approval response for workflow {workflow_id} "
                f"from {response.approver_role}: {response.status}"
            )

            return {
                "workflow_id": workflow_id,
                "status": result["status"],
                "response_processed": True,
                "next_approvers": result.get("current_approvers", []),
                "workflow_complete": result.get("status")
                == WorkflowStatus.COMPLETED.value,
                "final_decision": result.get("final_decision"),
            }

        except Exception as e:
            logger.error(f"Failed to submit approval response: {e}")
            raise

    # Workflow node implementations

    async def _initialize_workflow(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Initialize the approval workflow."""

        logger.info(f"Initializing approval workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.INITIALIZE
        state["status"] = WorkflowStatus.IN_PROGRESS.value
        state["messages"].append("Workflow initialized")

        # Add audit log entry
        state["audit_log"].append(
            {
                "event": "workflow_initialized",
                "timestamp": datetime.utcnow().isoformat(),
                "workflow_id": state["workflow_id"],
                "request_type": state["request_type"],
                "requester_id": state["requester_id"],
                "requester_role": state["requester_role"],
            }
        )

        return state

    async def _analyze_request(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Analyze the approval request to determine complexity and routing."""

        logger.info(f"Analyzing approval request for workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.ANALYZE_REQUEST

        # Analyze request complexity and risk
        risk_factors = {
            "security_vulnerabilities": len(
                state["request_data"].get("vulnerabilities", [])
            ),
            "license_issues": len(state["request_data"].get("license_violations", [])),
            "policy_violations": len(
                state["request_data"].get("policy_violations", [])
            ),
            "dependency_count": len(state["request_data"].get("dependencies", [])),
            "ecosystem_diversity": len(
                set(state["request_data"].get("ecosystems", []))
            ),
        }

        # Calculate risk score
        risk_score = min(
            10.0,
            sum(
                [
                    risk_factors["security_vulnerabilities"] * 2.0,
                    risk_factors["license_issues"] * 1.5,
                    risk_factors["policy_violations"] * 2.5,
                    risk_factors["dependency_count"] * 0.1,
                    risk_factors["ecosystem_diversity"] * 0.5,
                ]
            ),
        )

        # Determine risk level
        if risk_score >= 8.0:
            risk_level = "critical"
        elif risk_score >= 6.0:
            risk_level = "high"
        elif risk_score >= 3.0:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Store analysis in state
        state["performance_metrics"]["risk_analysis"] = {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "analysis_timestamp": datetime.utcnow().isoformat(),
        }

        state["messages"].append(f"Request analyzed - Risk level: {risk_level}")

        return state

    async def _determine_stakeholders(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Determine required stakeholders based on request analysis."""

        logger.info(f"Determining stakeholders for workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.DETERMINE_STAKEHOLDERS

        request_type = state["request_type"]
        risk_level = state["performance_metrics"]["risk_analysis"]["risk_level"]

        # Determine stakeholders based on request type and risk
        stakeholders = []

        # Always include team lead
        stakeholders.append(
            {"role": "team_lead", "required": True, "approval_type": "mandatory"}
        )

        # Security officer for security-related or high-risk requests
        if request_type in [
            "security_override",
            "dependency_update",
        ] and risk_level in ["high", "critical"]:
            stakeholders.append(
                {
                    "role": "security_officer",
                    "required": True,
                    "approval_type": "mandatory",
                }
            )

        # Compliance manager for compliance exceptions
        if request_type == "compliance_exception":
            stakeholders.append(
                {
                    "role": "compliance_manager",
                    "required": True,
                    "approval_type": "mandatory",
                }
            )

        # Architect for complex changes
        if state["request_data"].get("ecosystem_diversity", 0) > 2:
            stakeholders.append(
                {"role": "architect", "required": False, "approval_type": "advisory"}
            )

        # Manager for critical requests
        if risk_level == "critical":
            stakeholders.append(
                {"role": "manager", "required": True, "approval_type": "mandatory"}
            )

        state["stakeholder_hierarchy"] = {
            "team_lead": ["manager", "director"],
            "security_officer": ["security_manager", "ciso"],
            "compliance_manager": ["compliance_director", "cco"],
            "architect": ["principal_architect", "cto"],
            "manager": ["director", "vp"],
        }

        state["messages"].append(f"Determined {len(stakeholders)} stakeholders")

        return state

    async def _generate_requirements(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Generate approval requirements for each stakeholder."""

        logger.info(
            f"Generating approval requirements for workflow {state['workflow_id']}"
        )

        state["current_step"] = HumanApprovalNode.GENERATE_REQUIREMENTS

        risk_level = state["performance_metrics"]["risk_analysis"]["risk_level"]
        stakeholders = state["stakeholder_hierarchy"]

        # Calculate SLA deadline based on request type and risk
        base_hours = {
            "dependency_update": 24,
            "policy_exception": 48,
            "security_override": 12,
            "compliance_exception": 72,
            "emergency_override": 4,
        }

        risk_multipliers = {
            "critical": 0.5,  # Faster for critical
            "high": 0.8,
            "medium": 1.0,
            "low": 1.5,
        }

        base_time = base_hours.get(state["request_type"], 24)
        multiplier = risk_multipliers.get(risk_level, 1.0)
        sla_hours = int(base_time * multiplier)

        state["sla_deadline"] = datetime.utcnow() + timedelta(hours=sla_hours)

        # Generate requirements for each stakeholder role
        requirements = []
        for role in stakeholders.keys():
            requirement = {
                "id": str(uuid4()),
                "workflow_id": state["workflow_id"],
                "approver_role": role,
                "approval_type": f"{role}_{state['request_type']}",
                "priority": self._calculate_priority(role, risk_level),
                "deadline": state["sla_deadline"].isoformat(),
                "status": ApprovalStatus.PENDING.value,
                "required": True,
                "escalation_policy": {
                    "sla_hours": sla_hours,
                    "escalation_threshold_hours": int(sla_hours * 0.75),
                    "auto_escalate": True,
                },
            }
            requirements.append(requirement)

        state["approval_requirements"] = requirements
        state["messages"].append(f"Generated {len(requirements)} approval requirements")

        return state

    async def _check_auto_approval(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Check if request is eligible for automatic approval."""

        logger.info(
            f"Checking auto-approval eligibility for workflow {state['workflow_id']}"
        )

        state["current_step"] = HumanApprovalNode.CHECK_AUTO_APPROVAL

        risk_level = state["performance_metrics"]["risk_analysis"]["risk_level"]
        auto_approval_eligible = False
        auto_approval_reason = None

        # Auto-approval conditions
        if (
            risk_level == "low"
            and state["requester_role"] in ["team_lead", "architect"]
            and len(state["request_data"].get("vulnerabilities", [])) == 0
        ):
            auto_approval_eligible = True
            auto_approval_reason = "Low risk request from trusted role"

        if auto_approval_eligible:
            state["final_decision"] = "auto_approved"
            state["decision_rationale"] = auto_approval_reason
            state["decision_confidence"] = 0.9
            state["status"] = WorkflowStatus.COMPLETED.value
            state["completed_at"] = datetime.utcnow()
            state["messages"].append("Request auto-approved")
        else:
            state["messages"].append("Manual approval required")

        return state

    async def _initiate_approvals(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Initiate approval requests to stakeholders."""

        logger.info(f"Initiating approvals for workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.INITIATE_APPROVALS
        state["status"] = WorkflowStatus.WAITING_FOR_APPROVAL.value

        # Set current approvers (first level in parallel)
        state["current_approvers"] = [
            {
                "requirement_id": req["id"],
                "role": req["approver_role"],
                "deadline": req["deadline"],
                "status": req["status"],
            }
            for req in state["approval_requirements"]
        ]

        # Send notifications
        await self._send_approval_notifications(state)

        state["messages"].append(
            f"Approval requests sent to {len(state['current_approvers'])} approvers"
        )

        return state

    async def _wait_for_responses(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Wait for approval responses with timeout handling."""

        state["current_step"] = HumanApprovalNode.WAIT_FOR_RESPONSES

        # Check if deadline has passed
        if state["sla_deadline"] and datetime.utcnow() > state["sla_deadline"]:
            state["messages"].append("SLA deadline exceeded")
            state["sla_status"] = "overdue"
            return state

        # Check for timeout (simplified - would use async waiting in real implementation)
        # This is a placeholder for the actual waiting logic
        await asyncio.sleep(0.1)  # Prevent blocking

        return state

    async def _process_response(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Process an approval response."""

        logger.info(f"Processing approval response for workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.PROCESS_RESPONSE
        state["messages"].append("Processing approval response")

        # Update requirement status based on response
        # This would be implemented based on the specific response received

        return state

    async def _check_completion(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Check if workflow is complete, rejected, or needs escalation."""

        state["current_step"] = HumanApprovalNode.CHECK_COMPLETION

        # Count responses
        total_requirements = len(state["approval_requirements"])
        received_responses = len(state["approval_responses"])

        # Check for rejections
        for response_data in state["approval_responses"].values():
            if response_data["response"]["status"] == "rejected":
                state["final_decision"] = "rejected"
                state["decision_rationale"] = (
                    f"Rejected by {response_data['response']['approver_role']}"
                )
                state["status"] = WorkflowStatus.REJECTED.value
                state["completed_at"] = datetime.utcnow()
                state["messages"].append("Workflow rejected")
                return state

        # Check if all approvals received
        if received_responses >= total_requirements:
            all_approved = all(
                response_data["response"]["status"] in ["approved", "conditional"]
                for response_data in state["approval_responses"].values()
            )

            if all_approved:
                state["final_decision"] = "approved"
                state["decision_rationale"] = "All required approvals received"
                state["decision_confidence"] = 0.85
                state["status"] = WorkflowStatus.COMPLETED.value
                state["completed_at"] = datetime.utcnow()
                state["messages"].append("Workflow completed successfully")
            else:
                state["messages"].append("Waiting for remaining approvals")

        return state

    async def _escalate_if_needed(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Escalate overdue approvals."""

        logger.info(f"Checking escalation for workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.ESCALATE_IF_NEEDED
        state["escalation_level"] += 1

        # Implement escalation logic
        # This would move approvals to the next level in the hierarchy

        state["messages"].append(f"Escalated to level {state['escalation_level']}")

        return state

    async def _complete_workflow(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Complete the workflow."""

        logger.info(f"Completing approval workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.COMPLETE_WORKFLOW

        if not state["completed_at"]:
            state["completed_at"] = datetime.utcnow()

        # Add completion audit entry
        state["audit_log"].append(
            {
                "event": "workflow_completed",
                "timestamp": datetime.utcnow().isoformat(),
                "workflow_id": state["workflow_id"],
                "final_decision": state.get("final_decision"),
                "decision_rationale": state.get("decision_rationale"),
                "total_responses": len(state["approval_responses"]),
                "escalation_level": state["escalation_level"],
            }
        )

        state["messages"].append("Workflow completed")

        return state

    async def _handle_rejection(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Handle workflow rejection."""

        logger.info(f"Handling rejection for workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.HANDLE_REJECTION
        state["status"] = WorkflowStatus.REJECTED.value

        if not state["completed_at"]:
            state["completed_at"] = datetime.utcnow()

        # Send rejection notifications
        await self._send_rejection_notifications(state)

        state["messages"].append("Workflow rejected")

        return state

    async def _handle_timeout(
        self, state: ApprovalWorkflowState
    ) -> ApprovalWorkflowState:
        """Handle workflow timeout."""

        logger.info(f"Handling timeout for workflow {state['workflow_id']}")

        state["current_step"] = HumanApprovalNode.HANDLE_TIMEOUT
        state["sla_status"] = "overdue"

        # Check if we can escalate further
        max_escalation_level = 3
        if state["escalation_level"] < max_escalation_level:
            state["messages"].append("Timeout - escalating")
        else:
            # Max escalation reached - mark as failed
            state["status"] = WorkflowStatus.FAILED.value
            state["error_message"] = (
                "Maximum escalation level reached without resolution"
            )
            state["final_decision"] = "timeout"
            state["decision_rationale"] = "Workflow timed out after maximum escalations"
            state["completed_at"] = datetime.utcnow()
            state["messages"].append("Workflow failed due to timeout")

        return state

    # Routing functions

    def _route_after_auto_approval_check(self, state: ApprovalWorkflowState) -> str:
        """Route workflow after auto-approval check."""

        if state.get("final_decision") == "auto_approved":
            return "auto_approved"
        else:
            return "requires_approval"

    def _check_response_status(self, state: ApprovalWorkflowState) -> str:
        """Check if responses are received, waiting, or timeout."""

        if state.get("sla_status") == "overdue":
            return "timeout"
        elif len(state["approval_responses"]) > 0:
            return "response_received"
        else:
            return "waiting"

    def _route_after_completion_check(self, state: ApprovalWorkflowState) -> str:
        """Route workflow after completion check."""

        if state.get("status") == WorkflowStatus.COMPLETED.value:
            return "completed"
        elif state.get("status") == WorkflowStatus.REJECTED.value:
            return "rejected"
        elif state.get("sla_status") == "overdue":
            return "needs_escalation"
        else:
            return "waiting"

    # Helper functions

    def _calculate_priority(self, role: str, risk_level: str) -> int:
        """Calculate approval priority based on role and risk level."""

        role_priorities = {
            "security_officer": 10,
            "compliance_manager": 20,
            "architect": 30,
            "team_lead": 40,
            "manager": 50,
        }

        risk_adjustments = {"critical": -20, "high": -10, "medium": 0, "low": 10}

        base_priority = role_priorities.get(role, 100)
        risk_adjustment = risk_adjustments.get(risk_level, 0)

        return max(1, base_priority + risk_adjustment)

    async def _send_approval_notifications(self, state: ApprovalWorkflowState) -> None:
        """Send approval request notifications."""

        for approver in state["current_approvers"]:
            notification_data = {
                "type": "approval_request",
                "workflow_id": state["workflow_id"],
                "request_type": state["request_type"],
                "approver_role": approver["role"],
                "deadline": approver["deadline"],
                "request_data": state["request_data"],
            }

            # Send notification (would use actual notification service)
            logger.info(f"Sending approval notification to {approver['role']}")

    async def _send_rejection_notifications(self, state: ApprovalWorkflowState) -> None:
        """Send rejection notifications."""

        notification_data = {
            "type": "workflow_rejected",
            "workflow_id": state["workflow_id"],
            "reason": state.get("decision_rationale"),
            "requester_id": state["requester_id"],
        }

        logger.info(
            f"Sending rejection notification for workflow {state['workflow_id']}"
        )
