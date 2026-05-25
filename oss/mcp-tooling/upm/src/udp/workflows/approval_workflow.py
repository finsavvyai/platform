"""
Multi-stakeholder approval workflow for Universal Dependency Platform.

Enhanced enterprise approval workflow with intelligent routing,
stakeholder hierarchy management, and AI-powered decision making.
"""

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from udp.domain.models import (
    ApprovalRequirement,
    ApprovalResponse,
    WorkflowStatus,
)
from udp.services.escalation_service import EscalationService
from udp.workflows.state import ApprovalState

logger = logging.getLogger(__name__)


class ApprovalType(str, Enum):
    """Types of approval requests."""
    DEPENDENCY_UPDATE = "dependency_update"
    POLICY_EXCEPTION = "policy_exception"
    SECURITY_OVERRIDE = "security_override"
    COMPLIANCE_EXCEPTION = "compliance_exception"
    EMERGENCY_OVERRIDE = "emergency_override"


class RoutingStrategy(str, Enum):
    """Approval routing strategies."""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"
    RISK_BASED = "risk_based"
    AI_OPTIMIZED = "ai_optimized"


class ApprovalWorkflow:
    """
    Enhanced multi-stakeholder approval workflow orchestration.

    Provides intelligent routing, stakeholder hierarchy management,
    and enterprise-grade approval processes with AI-powered optimization.
    """

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.workflow_id = str(uuid4())
        self.routing_engine = IntelligentRoutingEngine(organization_id)
        self.stakeholder_manager = StakeholderHierarchyManager(organization_id)
        self.escalation_manager = EscalationManager(organization_id)
        self.escalation_service = EscalationService(organization_id)

    async def execute(
        self,
        request_type: ApprovalType,
        request_data: dict[str, Any],
        requester_id: UUID,
        requester_role: str,
        routing_strategy: Optional[RoutingStrategy] = None
    ) -> ApprovalState:
        """Execute the enhanced approval workflow with intelligent routing."""

        # Initialize enhanced approval state
        state: ApprovalState = {
            # Base workflow state
            "workflow_id": self.workflow_id,
            "workflow_type": "approval_workflow",
            "organization_id": self.organization_id,
            "project_id": request_data.get("project_id"),
            "status": WorkflowStatus.PENDING,
            "current_step": "initialize",
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "error_message": None,
            "retry_count": 0,
            "max_retries": 3,
            "audit_log": [],
            "performance_metrics": {},
            "requires_human_approval": True,
            "approval_requests": [],
            "approval_responses": [],
            "metadata": {},

            # Universal Package Manager support
            "polyglot_project": None,
            "universal_packages": [],
            "cross_ecosystem_resolution": {},
            "universal_audit_trail": [],

            # Enhanced approval workflow fields
            "request_type": request_type.value,
            "request_data": request_data,
            "requester_id": requester_id,
            "requester_role": requester_role,
            "approval_workflow": [],
            "current_approver": None,
            "approval_history": [],
            "approval_requirements": [],
            "approval_dependency_graph": {},

            # Enhanced stakeholder management
            "stakeholders": [],
            "stakeholder_hierarchy": {},
            "stakeholder_responses": {},
            "stakeholder_availability": {},

            # Enhanced SLA and escalation
            "sla_deadline": None,
            "sla_status": "on_time",
            "escalation_level": 0,
            "escalation_history": [],
            "escalation_policies": {},
            "auto_escalation_enabled": True,

            # Intelligent decision making
            "auto_approval_eligible": False,
            "auto_approval_reason": None,
            "auto_approval_conditions": {},
            "risk_based_routing": {},
            "ai_routing_recommendations": [],
            "final_decision": None,
            "decision_rationale": None,
            "decision_confidence": None,

            # Enhanced notifications
            "notifications_sent": [],
            "notification_responses": [],
            "notification_preferences": {},
            "communication_channels": {},

            # Approval routing intelligence
            "routing_strategy": routing_strategy.value if routing_strategy else RoutingStrategy.RISK_BASED.value,
            "routing_rules": [],
            "approval_path_optimization": {},

            # Enterprise compliance
            "compliance_requirements": [],
            "audit_trail_enhanced": [],
            "regulatory_approvals": {},

            # Performance analytics
            "approval_metrics": {},
            "bottleneck_analysis": {},
            "stakeholder_performance": {}
        }

        try:
            # Step 1: Analyze request and determine routing strategy
            state["status"] = WorkflowStatus.IN_PROGRESS
            state["current_step"] = "analyze_request"

            routing_analysis = await self.routing_engine.analyze_request(
                request_type, request_data, requester_role
            )
            state["risk_based_routing"] = routing_analysis

            # Step 2: Determine stakeholder hierarchy and approval requirements
            state["current_step"] = "determine_stakeholders"

            stakeholder_config = await self.stakeholder_manager.determine_stakeholders(
                request_type, request_data, routing_analysis
            )
            state["stakeholders"] = stakeholder_config["stakeholders"]
            state["stakeholder_hierarchy"] = stakeholder_config["hierarchy"]
            state["escalation_policies"] = stakeholder_config["escalation_policies"]

            # Step 3: Generate approval requirements with dependencies
            state["current_step"] = "generate_requirements"

            approval_requirements = await self._generate_approval_requirements(
                state, routing_analysis, stakeholder_config
            )
            state["approval_requirements"] = [req.dict() for req in approval_requirements]
            state["approval_dependency_graph"] = self._build_dependency_graph(approval_requirements)

            # Step 4: Check for auto-approval eligibility
            state["current_step"] = "check_auto_approval"

            auto_approval_result = await self._check_auto_approval_eligibility(
                request_type, request_data, routing_analysis
            )
            state["auto_approval_eligible"] = auto_approval_result["eligible"]
            state["auto_approval_reason"] = auto_approval_result["reason"]

            if auto_approval_result["eligible"]:
                state["final_decision"] = "auto_approved"
                state["decision_rationale"] = auto_approval_result["reason"]
                state["decision_confidence"] = auto_approval_result["confidence"]
                state["status"] = WorkflowStatus.COMPLETED
                state["completed_at"] = datetime.utcnow()

                # Log auto-approval in audit trail
                state["audit_trail_enhanced"].append({
                    "event": "auto_approval",
                    "timestamp": datetime.utcnow().isoformat(),
                    "reason": auto_approval_result["reason"],
                    "confidence": auto_approval_result["confidence"],
                    "routing_analysis": routing_analysis
                })

                return state

            # Step 5: Initialize approval workflow execution
            state["current_step"] = "initialize_approvals"
            state["status"] = WorkflowStatus.WAITING_FOR_APPROVAL

            # Set SLA deadline based on request type and risk level
            sla_hours = self._calculate_sla_deadline(request_type, routing_analysis)
            state["sla_deadline"] = datetime.utcnow() + timedelta(hours=sla_hours)

            # Initialize approval workflow based on routing strategy
            await self._initialize_approval_workflow(state, approval_requirements)

            # Log workflow initialization
            state["audit_trail_enhanced"].append({
                "event": "workflow_initialized",
                "timestamp": datetime.utcnow().isoformat(),
                "routing_strategy": state["routing_strategy"],
                "stakeholder_count": len(state["stakeholders"]),
                "approval_requirements_count": len(state["approval_requirements"]),
                "sla_deadline": state["sla_deadline"].isoformat() if state["sla_deadline"] else None
            })

            return state

        except Exception as e:
            logger.error(f"Enhanced approval workflow execution failed: {e}")
            state["status"] = WorkflowStatus.FAILED
            state["error_message"] = str(e)
            state["completed_at"] = datetime.utcnow()

            # Log error in enhanced audit trail
            state["audit_trail_enhanced"].append({
                "event": "workflow_failed",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "current_step": state["current_step"]
            })

            return state

    async def _generate_approval_requirements(
        self,
        state: ApprovalState,
        routing_analysis: dict[str, Any],
        stakeholder_config: dict[str, Any]
    ) -> list[ApprovalRequirement]:
        """Generate approval requirements based on routing analysis and stakeholder configuration."""

        requirements = []
        risk_level = routing_analysis.get("risk_level", "medium")

        # Generate requirements for each stakeholder role
        for stakeholder in stakeholder_config["stakeholders"]:
            role = stakeholder["role"]

            # Determine approval type and priority based on role and risk
            approval_type = self._determine_approval_type(role, state["request_type"], risk_level)
            priority = self._calculate_approval_priority(role, risk_level)

            # Calculate deadline based on role and SLA policies
            deadline_hours = stakeholder_config["escalation_policies"].get(role, {}).get("sla_hours", 24)
            deadline = datetime.utcnow() + timedelta(hours=deadline_hours)

            # Create approval requirement
            requirement = ApprovalRequirement(
                workflow_id=state["workflow_id"],
                approver_role=role,
                approver_email=stakeholder.get("email"),
                approver_user_id=stakeholder.get("user_id"),
                approval_type=approval_type,
                priority=priority,
                deadline=deadline,
                context={
                    "request_type": state["request_type"],
                    "request_data": state["request_data"],
                    "risk_analysis": routing_analysis,
                    "stakeholder_info": stakeholder
                },
                escalation_policy=stakeholder_config["escalation_policies"].get(role, {}),
                stakeholder_hierarchy=stakeholder_config["hierarchy"].get(role, []),
                auto_approval_conditions=self._get_auto_approval_conditions(role, risk_level)
            )

            requirements.append(requirement)

        return requirements

    def _build_dependency_graph(self, requirements: list[ApprovalRequirement]) -> dict[str, list[str]]:
        """Build dependency graph for approval requirements."""

        dependency_graph = {}

        # Create role-based dependencies
        role_priorities = {
            "security_officer": 1,
            "compliance_manager": 2,
            "team_lead": 3,
            "developer": 4,
            "architect": 2,
            "manager": 3
        }

        # Sort requirements by priority
        sorted_requirements = sorted(requirements, key=lambda r: role_priorities.get(r.approver_role, 5))

        for i, req in enumerate(sorted_requirements):
            req_id = str(req.id)
            dependency_graph[req_id] = []

            # Add dependencies based on role hierarchy
            for j in range(i):
                dep_req = sorted_requirements[j]
                if self._should_depend_on(req, dep_req):
                    dependency_graph[req_id].append(str(dep_req.id))

        return dependency_graph

    def _should_depend_on(self, req: ApprovalRequirement, dep_req: ApprovalRequirement) -> bool:
        """Determine if one approval requirement should depend on another."""

        # Security and compliance approvals typically come first
        high_priority_roles = ["security_officer", "compliance_manager"]

        if dep_req.approver_role in high_priority_roles and req.approver_role not in high_priority_roles:
            return True

        # Same role type dependencies
        if req.approver_role == dep_req.approver_role and req.priority > dep_req.priority:
            return True

        return False

    async def _check_auto_approval_eligibility(
        self,
        request_type: ApprovalType,
        request_data: dict[str, Any],
        routing_analysis: dict[str, Any]
    ) -> dict[str, Any]:
        """Check if request is eligible for automatic approval."""

        risk_level = routing_analysis.get("risk_level", "medium")
        confidence_score = routing_analysis.get("confidence_score", 0.5)

        # Auto-approval conditions
        auto_approval_conditions = {
            "low_risk_threshold": risk_level == "low",
            "high_confidence": confidence_score >= 0.9,
            "trusted_requester": routing_analysis.get("requester_trust_score", 0.5) >= 0.8,
            "no_security_issues": not routing_analysis.get("has_security_issues", False),
            "no_compliance_issues": not routing_analysis.get("has_compliance_issues", False)
        }

        # Check if all conditions are met
        eligible = all(auto_approval_conditions.values())

        if eligible:
            reason = "Low risk request from trusted source with high confidence analysis"
            confidence = min(confidence_score, 0.95)  # Cap confidence for auto-approval
        else:
            reason = f"Manual approval required: {[k for k, v in auto_approval_conditions.items() if not v]}"
            confidence = 0.0

        return {
            "eligible": eligible,
            "reason": reason,
            "confidence": confidence,
            "conditions": auto_approval_conditions
        }

    def _calculate_sla_deadline(self, request_type: ApprovalType, routing_analysis: dict[str, Any]) -> int:
        """Calculate SLA deadline in hours based on request type and risk level."""

        base_sla_hours = {
            ApprovalType.DEPENDENCY_UPDATE: 24,
            ApprovalType.POLICY_EXCEPTION: 48,
            ApprovalType.SECURITY_OVERRIDE: 12,
            ApprovalType.COMPLIANCE_EXCEPTION: 72,
            ApprovalType.EMERGENCY_OVERRIDE: 4
        }

        risk_multipliers = {
            "low": 1.0,
            "medium": 1.5,
            "high": 2.0,
            "critical": 0.5  # Critical issues need faster resolution
        }

        base_hours = base_sla_hours.get(request_type, 24)
        risk_level = routing_analysis.get("risk_level", "medium")
        multiplier = risk_multipliers.get(risk_level, 1.0)

        return int(base_hours * multiplier)

    def _determine_approval_type(self, role: str, request_type: str, risk_level: str) -> str:
        """Determine specific approval type based on role, request type, and risk level."""

        return f"{role}_{request_type}_{risk_level}"

    def _calculate_approval_priority(self, role: str, risk_level: str) -> int:
        """Calculate approval priority based on role and risk level."""

        role_priorities = {
            "security_officer": 10,
            "compliance_manager": 20,
            "architect": 30,
            "team_lead": 40,
            "manager": 50,
            "developer": 60
        }

        risk_adjustments = {
            "critical": -20,
            "high": -10,
            "medium": 0,
            "low": 10
        }

        base_priority = role_priorities.get(role, 100)
        risk_adjustment = risk_adjustments.get(risk_level, 0)

        return max(1, base_priority + risk_adjustment)

    def _get_auto_approval_conditions(self, role: str, risk_level: str) -> Optional[dict[str, Any]]:
        """Get auto-approval conditions for specific role and risk level."""

        if risk_level == "low" and role in ["developer", "team_lead"]:
            return {
                "max_risk_score": 3.0,
                "trusted_source": True,
                "no_policy_violations": True
            }

        return None

    async def _initialize_approval_workflow(
        self,
        state: ApprovalState,
        requirements: list[ApprovalRequirement]
    ) -> None:
        """Initialize the approval workflow based on routing strategy."""

        routing_strategy = RoutingStrategy(state["routing_strategy"])

        if routing_strategy == RoutingStrategy.SEQUENTIAL:
            await self._initialize_sequential_workflow(state, requirements)
        elif routing_strategy == RoutingStrategy.PARALLEL:
            await self._initialize_parallel_workflow(state, requirements)
        elif routing_strategy == RoutingStrategy.RISK_BASED:
            await self._initialize_risk_based_workflow(state, requirements)
        else:
            # Default to risk-based routing
            await self._initialize_risk_based_workflow(state, requirements)

    async def _initialize_sequential_workflow(
        self,
        state: ApprovalState,
        requirements: list[ApprovalRequirement]
    ) -> None:
        """Initialize sequential approval workflow."""

        # Sort by priority (lower number = higher priority)
        sorted_requirements = sorted(requirements, key=lambda r: r.priority)

        workflow_steps = []
        for i, req in enumerate(sorted_requirements):
            step = {
                "step_id": f"approval_{i+1}",
                "requirement_id": str(req.id),
                "approver_role": req.approver_role,
                "status": "pending" if i == 0 else "waiting",
                "depends_on": [f"approval_{i}"] if i > 0 else []
            }
            workflow_steps.append(step)

        state["approval_workflow"] = workflow_steps

        # Set current approver to first in sequence
        if workflow_steps:
            first_req = sorted_requirements[0]
            state["current_approver"] = {
                "requirement_id": str(first_req.id),
                "role": first_req.approver_role,
                "email": first_req.approver_email,
                "deadline": first_req.deadline.isoformat()
            }

    async def _initialize_parallel_workflow(
        self,
        state: ApprovalState,
        requirements: list[ApprovalRequirement]
    ) -> None:
        """Initialize parallel approval workflow."""

        workflow_steps = []
        for i, req in enumerate(requirements):
            step = {
                "step_id": f"approval_{i+1}",
                "requirement_id": str(req.id),
                "approver_role": req.approver_role,
                "status": "pending",
                "depends_on": []
            }
            workflow_steps.append(step)

        state["approval_workflow"] = workflow_steps

        # All approvers are current approvers in parallel mode
        state["current_approver"] = {
            "mode": "parallel",
            "active_approvers": [
                {
                    "requirement_id": str(req.id),
                    "role": req.approver_role,
                    "email": req.approver_email,
                    "deadline": req.deadline.isoformat()
                }
                for req in requirements
            ]
        }

    async def _initialize_risk_based_workflow(
        self,
        state: ApprovalState,
        requirements: list[ApprovalRequirement]
    ) -> None:
        """Initialize risk-based approval workflow with intelligent routing."""

        # Group requirements by risk level and role importance
        high_priority_roles = ["security_officer", "compliance_manager"]
        medium_priority_roles = ["architect", "team_lead"]
        low_priority_roles = ["manager", "developer"]

        high_priority_reqs = [r for r in requirements if r.approver_role in high_priority_roles]
        medium_priority_reqs = [r for r in requirements if r.approver_role in medium_priority_roles]
        low_priority_reqs = [r for r in requirements if r.approver_role in low_priority_roles]

        workflow_steps = []
        step_counter = 1

        # High priority approvals first (parallel within group)
        for req in high_priority_reqs:
            step = {
                "step_id": f"approval_{step_counter}",
                "requirement_id": str(req.id),
                "approver_role": req.approver_role,
                "status": "pending",
                "depends_on": [],
                "priority_group": "high"
            }
            workflow_steps.append(step)
            step_counter += 1

        # Medium priority approvals (depend on high priority completion)
        high_priority_steps = [s["step_id"] for s in workflow_steps if s["priority_group"] == "high"]

        for req in medium_priority_reqs:
            step = {
                "step_id": f"approval_{step_counter}",
                "requirement_id": str(req.id),
                "approver_role": req.approver_role,
                "status": "waiting",
                "depends_on": high_priority_steps,
                "priority_group": "medium"
            }
            workflow_steps.append(step)
            step_counter += 1

        # Low priority approvals (depend on medium priority completion)
        medium_priority_steps = [s["step_id"] for s in workflow_steps if s["priority_group"] == "medium"]

        for req in low_priority_reqs:
            step = {
                "step_id": f"approval_{step_counter}",
                "requirement_id": str(req.id),
                "approver_role": req.approver_role,
                "status": "waiting",
                "depends_on": medium_priority_steps if medium_priority_steps else high_priority_steps,
                "priority_group": "low"
            }
            workflow_steps.append(step)
            step_counter += 1

        state["approval_workflow"] = workflow_steps

        # Set current approvers to high priority group
        if high_priority_reqs:
            state["current_approver"] = {
                "mode": "risk_based",
                "current_group": "high",
                "active_approvers": [
                    {
                        "requirement_id": str(req.id),
                        "role": req.approver_role,
                        "email": req.approver_email,
                        "deadline": req.deadline.isoformat()
                    }
                    for req in high_priority_reqs
                ]
            }
        elif medium_priority_reqs:
            # If no high priority, start with medium
            state["current_approver"] = {
                "mode": "risk_based",
                "current_group": "medium",
                "active_approvers": [
                    {
                        "requirement_id": str(req.id),
                        "role": req.approver_role,
                        "email": req.approver_email,
                        "deadline": req.deadline.isoformat()
                    }
                    for req in medium_priority_reqs
                ]
            }


class IntelligentRoutingEngine:
    """AI-powered routing engine for approval workflows."""

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id

    async def analyze_request(
        self,
        request_type: ApprovalType,
        request_data: dict[str, Any],
        requester_role: str
    ) -> dict[str, Any]:
        """Analyze approval request and determine routing strategy."""

        # Mock intelligent analysis - in real implementation, this would use ML models
        risk_factors = {
            "security_vulnerabilities": len(request_data.get("vulnerabilities", [])),
            "license_issues": len(request_data.get("license_violations", [])),
            "policy_violations": len(request_data.get("policy_violations", [])),
            "dependency_count": len(request_data.get("dependencies", [])),
            "ecosystem_diversity": len(set(request_data.get("ecosystems", [])))
        }

        # Calculate risk score (0-10 scale)
        risk_score = min(10.0, sum([
            risk_factors["security_vulnerabilities"] * 2.0,
            risk_factors["license_issues"] * 1.5,
            risk_factors["policy_violations"] * 2.5,
            risk_factors["dependency_count"] * 0.1,
            risk_factors["ecosystem_diversity"] * 0.5
        ]))

        # Determine risk level
        if risk_score >= 8.0:
            risk_level = "critical"
        elif risk_score >= 6.0:
            risk_level = "high"
        elif risk_score >= 3.0:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Calculate confidence score based on data completeness
        confidence_factors = {
            "has_security_scan": bool(request_data.get("security_scan_results")),
            "has_license_analysis": bool(request_data.get("license_analysis")),
            "has_dependency_graph": bool(request_data.get("dependency_graph")),
            "requester_verified": requester_role in ["team_lead", "architect", "manager"]
        }

        confidence_score = sum(confidence_factors.values()) / len(confidence_factors)

        # Determine requester trust score
        trusted_roles = ["architect", "team_lead", "manager", "security_officer"]
        requester_trust_score = 0.8 if requester_role in trusted_roles else 0.5

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "confidence_score": confidence_score,
            "requester_trust_score": requester_trust_score,
            "risk_factors": risk_factors,
            "confidence_factors": confidence_factors,
            "has_security_issues": risk_factors["security_vulnerabilities"] > 0,
            "has_compliance_issues": risk_factors["policy_violations"] > 0,
            "recommended_routing": self._recommend_routing_strategy(risk_level, confidence_score),
            "estimated_approval_time_hours": self._estimate_approval_time(risk_level, risk_factors)
        }

    def _recommend_routing_strategy(self, risk_level: str, confidence_score: float) -> str:
        """Recommend optimal routing strategy based on risk and confidence."""

        if risk_level in ["critical", "high"]:
            return RoutingStrategy.RISK_BASED.value
        elif risk_level == "medium" and confidence_score >= 0.8:
            return RoutingStrategy.PARALLEL.value
        elif risk_level == "low" and confidence_score >= 0.9:
            return RoutingStrategy.SEQUENTIAL.value
        else:
            return RoutingStrategy.RISK_BASED.value

    def _estimate_approval_time(self, risk_level: str, risk_factors: dict[str, Any]) -> float:
        """Estimate approval time in hours based on risk factors."""

        base_times = {
            "low": 4.0,
            "medium": 12.0,
            "high": 24.0,
            "critical": 48.0
        }

        base_time = base_times.get(risk_level, 12.0)

        # Adjust based on complexity factors
        complexity_multiplier = 1.0 + (
            risk_factors.get("dependency_count", 0) * 0.01 +
            risk_factors.get("ecosystem_diversity", 0) * 0.1
        )

        return base_time * complexity_multiplier


class StakeholderHierarchyManager:
    """Manages stakeholder hierarchies and escalation paths."""

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id

    async def determine_stakeholders(
        self,
        request_type: ApprovalType,
        request_data: dict[str, Any],
        routing_analysis: dict[str, Any]
    ) -> dict[str, Any]:
        """Determine required stakeholders based on request analysis."""

        risk_level = routing_analysis["risk_level"]

        # Base stakeholder requirements
        stakeholders = []

        # Always require team lead for dependency updates
        if request_type == ApprovalType.DEPENDENCY_UPDATE:
            stakeholders.append({
                "role": "team_lead",
                "email": "team.lead@example.com",
                "user_id": uuid4(),
                "required": True
            })

        # Security officer for security-related requests or high-risk items
        if (request_type == ApprovalType.SECURITY_OVERRIDE or
            routing_analysis.get("has_security_issues") or
            risk_level in ["high", "critical"]):
            stakeholders.append({
                "role": "security_officer",
                "email": "security@example.com",
                "user_id": uuid4(),
                "required": True
            })

        # Compliance manager for compliance exceptions or policy violations
        if (request_type == ApprovalType.COMPLIANCE_EXCEPTION or
            routing_analysis.get("has_compliance_issues")):
            stakeholders.append({
                "role": "compliance_manager",
                "email": "compliance@example.com",
                "user_id": uuid4(),
                "required": True
            })

        # Architect for complex multi-ecosystem changes
        if routing_analysis["risk_factors"].get("ecosystem_diversity", 0) > 2:
            stakeholders.append({
                "role": "architect",
                "email": "architect@example.com",
                "user_id": uuid4(),
                "required": False
            })

        # Manager for high-risk or critical requests
        if risk_level in ["high", "critical"]:
            stakeholders.append({
                "role": "manager",
                "email": "manager@example.com",
                "user_id": uuid4(),
                "required": True
            })

        # Build stakeholder hierarchy for escalation
        hierarchy = self._build_stakeholder_hierarchy(stakeholders)

        # Define escalation policies
        escalation_policies = self._define_escalation_policies(risk_level)

        return {
            "stakeholders": stakeholders,
            "hierarchy": hierarchy,
            "escalation_policies": escalation_policies
        }

    def _build_stakeholder_hierarchy(self, stakeholders: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
        """Build stakeholder hierarchy for escalation paths."""

        hierarchy = {}

        # Define escalation chains for each role
        escalation_chains = {
            "developer": [
                {"role": "team_lead", "email": "team.lead@example.com"},
                {"role": "manager", "email": "manager@example.com"}
            ],
            "team_lead": [
                {"role": "manager", "email": "manager@example.com"},
                {"role": "director", "email": "director@example.com"}
            ],
            "security_officer": [
                {"role": "security_manager", "email": "security.manager@example.com"},
                {"role": "ciso", "email": "ciso@example.com"}
            ],
            "compliance_manager": [
                {"role": "compliance_director", "email": "compliance.director@example.com"},
                {"role": "cco", "email": "cco@example.com"}
            ],
            "architect": [
                {"role": "principal_architect", "email": "principal.architect@example.com"},
                {"role": "cto", "email": "cto@example.com"}
            ],
            "manager": [
                {"role": "director", "email": "director@example.com"},
                {"role": "vp", "email": "vp@example.com"}
            ]
        }

        for stakeholder in stakeholders:
            role = stakeholder["role"]
            hierarchy[role] = escalation_chains.get(role, [])

        return hierarchy

    def _define_escalation_policies(self, risk_level: str) -> dict[str, dict[str, Any]]:
        """Define escalation policies based on risk level."""

        base_policies = {
            "team_lead": {
                "sla_hours": 8,
                "escalation_threshold_hours": 6,
                "max_escalations": 2,
                "auto_escalate": True
            },
            "security_officer": {
                "sla_hours": 4,
                "escalation_threshold_hours": 3,
                "max_escalations": 3,
                "auto_escalate": True
            },
            "compliance_manager": {
                "sla_hours": 12,
                "escalation_threshold_hours": 8,
                "max_escalations": 2,
                "auto_escalate": True
            },
            "architect": {
                "sla_hours": 16,
                "escalation_threshold_hours": 12,
                "max_escalations": 2,
                "auto_escalate": False
            },
            "manager": {
                "sla_hours": 24,
                "escalation_threshold_hours": 18,
                "max_escalations": 2,
                "auto_escalate": True
            }
        }

        # Adjust policies based on risk level
        risk_multipliers = {
            "low": 1.0,
            "medium": 0.8,
            "high": 0.5,
            "critical": 0.25
        }

        multiplier = risk_multipliers.get(risk_level, 1.0)

        adjusted_policies = {}
        for role, policy in base_policies.items():
            adjusted_policies[role] = {
                "sla_hours": int(policy["sla_hours"] * multiplier),
                "escalation_threshold_hours": int(policy["escalation_threshold_hours"] * multiplier),
                "max_escalations": policy["max_escalations"],
                "auto_escalate": policy["auto_escalate"]
            }

        return adjusted_policies


class EscalationManager:
    """Manages approval escalations and SLA tracking."""

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id

    async def check_escalation_needed(self, state: ApprovalState) -> list[dict[str, Any]]:
        """Check if any approvals need escalation."""

        escalations_needed = []
        current_time = datetime.utcnow()

        for req_data in state["approval_requirements"]:
            requirement = ApprovalRequirement(**req_data)

            if requirement.is_pending and requirement.requires_escalation:
                escalation_info = {
                    "requirement_id": str(requirement.id),
                    "approver_role": requirement.approver_role,
                    "current_approver": requirement.approver_email,
                    "escalation_target": requirement.next_escalation_target,
                    "time_overdue_hours": (current_time - requirement.deadline).total_seconds() / 3600,
                    "escalation_count": requirement.escalation_count
                }
                escalations_needed.append(escalation_info)

        return escalations_needed

    async def execute_escalation(
        self,
        state: ApprovalState,
        requirement_id: str,
        escalation_target: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute escalation for a specific approval requirement."""

        escalation_event = {
            "escalation_id": str(uuid4()),
            "requirement_id": requirement_id,
            "escalated_at": datetime.utcnow().isoformat(),
            "escalated_from": None,
            "escalated_to": escalation_target,
            "reason": "SLA deadline exceeded",
            "escalation_level": 0
        }

        # Update requirement with escalation info
        for req_data in state["approval_requirements"]:
            if req_data["id"] == requirement_id:
                req_data["escalation_count"] += 1
                req_data["last_escalated_at"] = datetime.utcnow().isoformat()
                escalation_event["escalated_from"] = req_data.get("approver_email")
                escalation_event["escalation_level"] = req_data["escalation_count"]
                break

        # Add to escalation history
        state["escalation_history"].append(escalation_event)

        # Update SLA status
        if state["escalation_level"] == 0:
            state["sla_status"] = "at_risk"
        elif state["escalation_level"] >= 2:
            state["sla_status"] = "overdue"

        state["escalation_level"] = max(state["escalation_level"], escalation_event["escalation_level"])

        return escalation_event

    async def process_approval_response(
        self,
        state: ApprovalState,
        approval_response: ApprovalResponse
    ) -> dict[str, Any]:
        """
        Process an approval response and update workflow state.

        Handles multi-stakeholder approval orchestration with dependency tracking
        and automatic workflow progression.
        """

        try:
            # Find the corresponding requirement
            requirement_data = None
            for req_data in state["approval_requirements"]:
                if req_data["id"] == str(approval_response.requirement_id):
                    requirement_data = req_data
                    break

            if not requirement_data:
                raise ValueError(f"Approval requirement {approval_response.requirement_id} not found")

            # Update requirement status based on response
            if approval_response.is_approval:
                requirement_data["approval_status"] = "approved"
                requirement_data["approved_by"] = str(approval_response.approver_id)
                requirement_data["approved_at"] = approval_response.responded_at.isoformat()
            elif approval_response.is_rejection:
                requirement_data["approval_status"] = "rejected"
                requirement_data["rejection_reason"] = approval_response.comments

            # Add response to stakeholder responses
            approver_key = f"{approval_response.approver_role}_{approval_response.approver_id}"
            state["stakeholder_responses"][approver_key] = {
                "response": approval_response.dict(),
                "processed_at": datetime.utcnow().isoformat()
            }

            # Update approval history
            state["approval_history"].append({
                "requirement_id": str(approval_response.requirement_id),
                "approver_id": str(approval_response.approver_id),
                "approver_role": approval_response.approver_role,
                "status": approval_response.status,
                "timestamp": approval_response.responded_at.isoformat(),
                "comments": approval_response.comments,
                "conditions": approval_response.conditions
            })

            # Enhanced audit trail
            state["audit_trail_enhanced"].append({
                "event": "approval_response_processed",
                "timestamp": datetime.utcnow().isoformat(),
                "requirement_id": str(approval_response.requirement_id),
                "approver_id": str(approval_response.approver_id),
                "approver_role": approval_response.approver_role,
                "response_status": approval_response.status,
                "has_conditions": approval_response.has_conditions,
                "digital_signature": bool(approval_response.digital_signature)
            })

            # Check if we can progress the workflow
            progression_result = await self._check_workflow_progression(state)

            return {
                "success": True,
                "requirement_updated": requirement_data,
                "workflow_progression": progression_result,
                "next_actions": progression_result.get("next_actions", [])
            }

        except Exception as e:
            logger.error(f"Failed to process approval response: {e}")

            # Log error in audit trail
            state["audit_trail_enhanced"].append({
                "event": "approval_response_error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "requirement_id": str(approval_response.requirement_id)
            })

            return {
                "success": False,
                "error": str(e),
                "requirement_id": str(approval_response.requirement_id)
            }

    async def _check_workflow_progression(self, state: ApprovalState) -> dict[str, Any]:
        """
        Check if workflow can progress based on approval dependencies.

        Implements intelligent dependency tracking and automatic progression
        for multi-stakeholder approval workflows.
        """

        dependency_graph = state["approval_dependency_graph"]
        completed_requirements = set()
        pending_requirements = set()

        # Identify completed and pending requirements
        for req_data in state["approval_requirements"]:
            req_id = req_data["id"]
            if req_data["approval_status"] in ["approved", "auto_approved"]:
                completed_requirements.add(req_id)
            elif req_data["approval_status"] == "pending":
                pending_requirements.add(req_id)
            elif req_data["approval_status"] == "rejected":
                # Handle rejection - workflow might need to stop or escalate
                return await self._handle_approval_rejection(state, req_data)

        # Check which pending requirements can now be activated
        newly_available = []
        for req_id in pending_requirements:
            dependencies = dependency_graph.get(req_id, [])
            if all(dep_id in completed_requirements for dep_id in dependencies):
                newly_available.append(req_id)

        # Update workflow steps status
        next_actions = []
        for step in state["approval_workflow"]:
            req_id = step["requirement_id"]

            if req_id in completed_requirements and step["status"] != "completed":
                step["status"] = "completed"
                step["completed_at"] = datetime.utcnow().isoformat()
            elif req_id in newly_available and step["status"] == "waiting":
                step["status"] = "pending"
                next_actions.append({
                    "action": "notify_approver",
                    "requirement_id": req_id,
                    "approver_role": step["approver_role"]
                })

        # Check if entire workflow is complete
        all_required_completed = all(
            req_data["approval_status"] in ["approved", "auto_approved"]
            for req_data in state["approval_requirements"]
            if req_data.get("required", True)
        )

        if all_required_completed:
            state["status"] = WorkflowStatus.COMPLETED
            state["completed_at"] = datetime.utcnow()
            state["final_decision"] = "approved"
            state["decision_rationale"] = "All required approvals obtained"

            # Calculate decision confidence based on approval responses
            confidence_scores = []
            for response_data in state["stakeholder_responses"].values():
                response = response_data["response"]
                if response["confidence_level"] == "high":
                    confidence_scores.append(0.9)
                elif response["confidence_level"] == "medium":
                    confidence_scores.append(0.7)
                elif response["confidence_level"] == "low":
                    confidence_scores.append(0.5)
                else:
                    confidence_scores.append(0.6)  # Default

            state["decision_confidence"] = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.8

            next_actions.append({
                "action": "workflow_completed",
                "final_decision": "approved"
            })

        # Update current approver based on newly available requirements
        if newly_available:
            await self._update_current_approver(state, newly_available)

        return {
            "progression_possible": len(newly_available) > 0 or all_required_completed,
            "newly_available_requirements": newly_available,
            "completed_requirements": list(completed_requirements),
            "workflow_complete": all_required_completed,
            "next_actions": next_actions
        }

    async def _handle_approval_rejection(self, state: ApprovalState, rejected_req: dict[str, Any]) -> dict[str, Any]:
        """Handle approval rejection with escalation and alternative paths."""

        rejection_reason = rejected_req.get("rejection_reason", "No reason provided")

        # Check if rejection can be escalated or if alternative approvers exist
        escalation_target = None
        if rejected_req.get("stakeholder_hierarchy"):
            escalation_count = rejected_req.get("escalation_count", 0)
            hierarchy = rejected_req["stakeholder_hierarchy"]
            if escalation_count < len(hierarchy):
                escalation_target = hierarchy[escalation_count]

        if escalation_target:
            # Escalate to next level
            rejected_req["escalation_count"] = rejected_req.get("escalation_count", 0) + 1
            rejected_req["approval_status"] = "escalated"
            rejected_req["escalated_to"] = escalation_target

            state["escalation_history"].append({
                "requirement_id": rejected_req["id"],
                "escalated_at": datetime.utcnow().isoformat(),
                "escalated_to": escalation_target,
                "reason": f"Rejection escalation: {rejection_reason}"
            })

            return {
                "progression_possible": True,
                "escalation_performed": True,
                "escalation_target": escalation_target,
                "next_actions": [{
                    "action": "notify_escalation_approver",
                    "requirement_id": rejected_req["id"],
                    "escalation_target": escalation_target
                }]
            }
        else:
            # No escalation possible - workflow fails
            state["status"] = WorkflowStatus.REJECTED
            state["completed_at"] = datetime.utcnow()
            state["final_decision"] = "rejected"
            state["decision_rationale"] = f"Required approval rejected: {rejection_reason}"

            return {
                "progression_possible": False,
                "workflow_rejected": True,
                "rejection_reason": rejection_reason,
                "next_actions": [{
                    "action": "workflow_rejected",
                    "reason": rejection_reason
                }]
            }

    async def _update_current_approver(self, state: ApprovalState, newly_available: list[str]) -> None:
        """Update current approver based on newly available requirements."""

        if not newly_available:
            return

        # Find requirement data for newly available requirements
        available_reqs = []
        for req_data in state["approval_requirements"]:
            if req_data["id"] in newly_available:
                available_reqs.append(req_data)

        if not available_reqs:
            return

        routing_strategy = RoutingStrategy(state["routing_strategy"])

        if routing_strategy == RoutingStrategy.SEQUENTIAL:
            # In sequential mode, activate the highest priority requirement
            highest_priority_req = min(available_reqs, key=lambda r: r["priority"])
            state["current_approver"] = {
                "requirement_id": highest_priority_req["id"],
                "role": highest_priority_req["approver_role"],
                "email": highest_priority_req.get("approver_email"),
                "deadline": highest_priority_req["deadline"]
            }

        elif routing_strategy in [RoutingStrategy.PARALLEL, RoutingStrategy.RISK_BASED]:
            # In parallel or risk-based mode, activate all available requirements
            active_approvers = []
            for req_data in available_reqs:
                active_approvers.append({
                    "requirement_id": req_data["id"],
                    "role": req_data["approver_role"],
                    "email": req_data.get("approver_email"),
                    "deadline": req_data["deadline"]
                })

            state["current_approver"] = {
                "mode": routing_strategy.value,
                "active_approvers": active_approvers
            }

    async def validate_stakeholder_response(
        self,
        state: ApprovalState,
        response_data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Validate stakeholder response against business rules and policies.

        Provides comprehensive validation for enterprise approval workflows
        including role verification, deadline checking, and condition validation.
        """

        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "metadata": {}
        }

        try:
            # Validate response structure
            required_fields = ["requirement_id", "approver_id", "approver_role", "status"]
            for field in required_fields:
                if field not in response_data:
                    validation_result["errors"].append(f"Missing required field: {field}")

            if validation_result["errors"]:
                validation_result["valid"] = False
                return validation_result

            # Find corresponding requirement
            requirement_data = None
            for req_data in state["approval_requirements"]:
                if req_data["id"] == response_data["requirement_id"]:
                    requirement_data = req_data
                    break

            if not requirement_data:
                validation_result["errors"].append(f"Requirement {response_data['requirement_id']} not found")
                validation_result["valid"] = False
                return validation_result

            # Validate approver role matches requirement
            if requirement_data["approver_role"] != response_data["approver_role"]:
                validation_result["errors"].append(
                    f"Approver role mismatch: expected {requirement_data['approver_role']}, "
                    f"got {response_data['approver_role']}"
                )

            # Validate response is not too late
            deadline = datetime.fromisoformat(requirement_data["deadline"].replace("Z", "+00:00"))
            if datetime.utcnow() > deadline.replace(tzinfo=None):
                validation_result["warnings"].append("Response received after deadline")
                validation_result["metadata"]["overdue_hours"] = (
                    datetime.utcnow() - deadline.replace(tzinfo=None)
                ).total_seconds() / 3600

            # Validate requirement is still pending
            if requirement_data["approval_status"] != "pending":
                validation_result["errors"].append(
                    f"Requirement is no longer pending (status: {requirement_data['approval_status']})"
                )

            # Validate response status
            valid_statuses = ["approved", "rejected", "conditional", "delegated", "escalated"]
            if response_data["status"] not in valid_statuses:
                validation_result["errors"].append(f"Invalid response status: {response_data['status']}")

            # Validate conditional approvals have conditions
            if response_data["status"] == "conditional" and not response_data.get("conditions"):
                validation_result["errors"].append("Conditional approval must include conditions")

            # Validate delegation has target
            if response_data["status"] == "delegated" and not response_data.get("delegated_to"):
                validation_result["errors"].append("Delegated approval must specify delegation target")

            # Check for duplicate responses
            approver_key = f"{response_data['approver_role']}_{response_data['approver_id']}"
            if approver_key in state["stakeholder_responses"]:
                validation_result["warnings"].append("Duplicate response from same approver")

            # Validate business rules based on request type and risk level
            await self._validate_business_rules(state, response_data, requirement_data, validation_result)

            # Set final validation status
            validation_result["valid"] = len(validation_result["errors"]) == 0

            return validation_result

        except Exception as e:
            logger.error(f"Validation error: {e}")
            validation_result["valid"] = False
            validation_result["errors"].append(f"Validation exception: {str(e)}")
            return validation_result

    async def _validate_business_rules(
        self,
        state: ApprovalState,
        response_data: dict[str, Any],
        requirement_data: dict[str, Any],
        validation_result: dict[str, Any]
    ) -> None:
        """Validate response against business rules and organizational policies."""

        request_type = state["request_type"]
        risk_level = state.get("risk_based_routing", {}).get("risk_level", "medium")

        # Security override requires high confidence
        if request_type == "security_override" and response_data["status"] == "approved":
            confidence_level = response_data.get("confidence_level", "medium")
            if confidence_level == "low":
                validation_result["warnings"].append(
                    "Security override approval with low confidence may require additional review"
                )

        # High-risk requests require comments for rejections
        if risk_level in ["high", "critical"] and response_data["status"] == "rejected":
            if not response_data.get("comments"):
                validation_result["errors"].append(
                    "High-risk request rejections must include detailed comments"
                )

        # Compliance exceptions require specific approver roles
        if request_type == "compliance_exception":
            required_roles = ["compliance_manager", "legal_counsel", "ciso"]
            if response_data["approver_role"] not in required_roles:
                validation_result["warnings"].append(
                    f"Compliance exception approval from {response_data['approver_role']} "
                    f"may not be sufficient (recommended: {required_roles})"
                )

        # Emergency overrides have time constraints
        if request_type == "emergency_override":
            response_time_hours = (
                datetime.utcnow() - datetime.fromisoformat(requirement_data["created_at"])
            ).total_seconds() / 3600

            if response_time_hours > 2:  # 2-hour SLA for emergency overrides
                validation_result["warnings"].append(
                    f"Emergency override response time ({response_time_hours:.1f}h) exceeds SLA"
                )

    async def get_approval_status_summary(self, state: ApprovalState) -> dict[str, Any]:
        """
        Get comprehensive approval status summary for monitoring and reporting.

        Provides detailed status information for enterprise approval workflows
        including progress tracking, bottleneck analysis, and performance metrics.
        """

        summary = {
            "workflow_id": state["workflow_id"],
            "workflow_status": state["status"],
            "request_type": state["request_type"],
            "routing_strategy": state["routing_strategy"],
            "created_at": state["started_at"],
            "sla_deadline": state.get("sla_deadline"),
            "sla_status": state["sla_status"],
            "escalation_level": state["escalation_level"]
        }

        # Approval requirements summary
        requirements_summary = {
            "total_requirements": len(state["approval_requirements"]),
            "completed": 0,
            "pending": 0,
            "rejected": 0,
            "escalated": 0
        }

        for req_data in state["approval_requirements"]:
            status = req_data["approval_status"]
            if status in ["approved", "auto_approved"]:
                requirements_summary["completed"] += 1
            elif status == "pending":
                requirements_summary["pending"] += 1
            elif status == "rejected":
                requirements_summary["rejected"] += 1
            elif status == "escalated":
                requirements_summary["escalated"] += 1

        summary["requirements"] = requirements_summary

        # Stakeholder performance
        stakeholder_performance = {}
        for approver_key, response_data in state["stakeholder_responses"].items():
            response = response_data["response"]
            role = response["approver_role"]

            if role not in stakeholder_performance:
                stakeholder_performance[role] = {
                    "responses": 0,
                    "avg_response_time_hours": 0,
                    "approval_rate": 0,
                    "conditions_rate": 0
                }

            perf = stakeholder_performance[role]
            perf["responses"] += 1

            # Calculate response time
            created_at = datetime.fromisoformat(state["started_at"])
            responded_at = datetime.fromisoformat(response["responded_at"])
            response_time_hours = (responded_at - created_at).total_seconds() / 3600

            # Update running average
            current_avg = perf["avg_response_time_hours"]
            perf["avg_response_time_hours"] = (
                (current_avg * (perf["responses"] - 1) + response_time_hours) / perf["responses"]
            )

            # Update rates
            if response["status"] in ["approved", "conditional"]:
                perf["approval_rate"] = (perf["approval_rate"] * (perf["responses"] - 1) + 1) / perf["responses"]

            if response.get("conditions"):
                perf["conditions_rate"] = (perf["conditions_rate"] * (perf["responses"] - 1) + 1) / perf["responses"]

        summary["stakeholder_performance"] = stakeholder_performance

        # Bottleneck analysis
        bottlenecks = []
        current_time = datetime.utcnow()

        for req_data in state["approval_requirements"]:
            if req_data["approval_status"] == "pending":
                deadline = datetime.fromisoformat(req_data["deadline"].replace("Z", "+00:00"))
                time_remaining = (deadline.replace(tzinfo=None) - current_time).total_seconds() / 3600

                if time_remaining < 0:
                    bottlenecks.append({
                        "requirement_id": req_data["id"],
                        "approver_role": req_data["approver_role"],
                        "overdue_hours": abs(time_remaining),
                        "severity": "critical" if abs(time_remaining) > 24 else "high"
                    })
                elif time_remaining < 4:  # Less than 4 hours remaining
                    bottlenecks.append({
                        "requirement_id": req_data["id"],
                        "approver_role": req_data["approver_role"],
                        "time_remaining_hours": time_remaining,
                        "severity": "medium"
                    })

        summary["bottlenecks"] = bottlenecks

        # Overall progress
        if requirements_summary["total_requirements"] > 0:
            progress_percentage = (
                requirements_summary["completed"] / requirements_summary["total_requirements"] * 100
            )
        else:
            progress_percentage = 0

        summary["progress_percentage"] = progress_percentage

        # Estimated completion time
        if requirements_summary["pending"] > 0 and stakeholder_performance:
            avg_response_times = [
                perf["avg_response_time_hours"]
                for perf in stakeholder_performance.values()
                if perf["avg_response_time_hours"] > 0
            ]
            if avg_response_times:
                estimated_completion_hours = max(avg_response_times)
                summary["estimated_completion"] = (
                    current_time + timedelta(hours=estimated_completion_hours)
                ).isoformat()

        return summary

    async def process_periodic_escalation_check(self, state: ApprovalState) -> dict[str, Any]:
        """
        Process periodic escalation checks for the workflow.

        This method should be called periodically (e.g., every hour) to check
        for escalation needs and process them automatically.
        """

        try:
            # Only process escalations for active workflows
            if state["status"] not in [WorkflowStatus.WAITING_FOR_APPROVAL, WorkflowStatus.IN_PROGRESS]:
                return {
                    "processed": False,
                    "reason": f"Workflow status {state['status']} does not require escalation checks"
                }

            # Use the escalation service to check and process escalations
            escalation_results = await self.escalation_service.check_and_process_escalations(state)

            # Log escalation processing results
            if escalation_results["escalations_processed"] > 0:
                logger.info(
                    f"Processed {escalation_results['escalations_processed']} escalations "
                    f"for workflow {state['workflow_id']}"
                )

            # Update workflow audit trail
            state["audit_trail_enhanced"].append({
                "event": "periodic_escalation_check",
                "timestamp": datetime.utcnow().isoformat(),
                "escalations_processed": escalation_results["escalations_processed"],
                "notifications_sent": escalation_results["notifications_sent"],
                "sla_violations": escalation_results["sla_violations"],
                "errors": escalation_results["errors"]
            })

            return {
                "processed": True,
                "escalation_results": escalation_results,
                "workflow_updated": escalation_results["escalations_processed"] > 0
            }

        except Exception as e:
            logger.error(f"Periodic escalation check failed for workflow {state['workflow_id']}: {e}")

            # Log error in audit trail
            state["audit_trail_enhanced"].append({
                "event": "escalation_check_error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            })

            return {
                "processed": False,
                "error": str(e)
            }

    async def get_escalation_dashboard_data(self, state: ApprovalState) -> dict[str, Any]:
        """
        Get comprehensive escalation dashboard data for monitoring.

        Provides detailed escalation metrics, SLA tracking, and notification
        status for enterprise monitoring dashboards.
        """

        try:
            # Get escalation metrics from the escalation service
            escalation_metrics = await self.escalation_service.get_escalation_metrics(state)

            # Get current approval status
            approval_summary = await self.get_approval_status_summary(state)

            # Combine into dashboard data
            dashboard_data = {
                "workflow_overview": {
                    "workflow_id": state["workflow_id"],
                    "request_type": state["request_type"],
                    "status": state["status"],
                    "created_at": state["started_at"],
                    "routing_strategy": state["routing_strategy"]
                },
                "escalation_metrics": escalation_metrics,
                "approval_status": approval_summary,
                "sla_tracking": {
                    "deadline": state.get("sla_deadline"),
                    "status": state["sla_status"],
                    "current_level": state["escalation_level"],
                    "auto_escalation_enabled": state.get("auto_escalation_enabled", True)
                },
                "recent_events": self._get_recent_escalation_events(state, limit=10),
                "notification_status": self._get_notification_status_summary(state),
                "risk_indicators": self._calculate_risk_indicators(state)
            }

            return dashboard_data

        except Exception as e:
            logger.error(f"Failed to get escalation dashboard data: {e}")
            return {
                "error": str(e),
                "workflow_id": state.get("workflow_id", "unknown")
            }

    def _get_recent_escalation_events(self, state: ApprovalState, limit: int = 10) -> list[dict[str, Any]]:
        """Get recent escalation events for dashboard display."""

        events = []

        # Get escalation events from history
        for escalation in state["escalation_history"][-limit:]:
            events.append({
                "type": "escalation",
                "timestamp": escalation["escalated_at"],
                "description": f"Escalated to {escalation['escalated_to']['role']} (Level {escalation['escalation_level']})",
                "severity": escalation.get("severity", "medium"),
                "auto_escalated": escalation.get("auto_escalated", False)
            })

        # Get approval events from audit trail
        for audit_event in state["audit_trail_enhanced"][-limit:]:
            if audit_event["event"] in ["approval_response_processed", "automatic_escalation"]:
                events.append({
                    "type": audit_event["event"],
                    "timestamp": audit_event["timestamp"],
                    "description": self._format_audit_event_description(audit_event),
                    "severity": audit_event.get("severity", "low")
                })

        # Sort by timestamp (most recent first)
        events.sort(key=lambda x: x["timestamp"], reverse=True)

        return events[:limit]

    def _format_audit_event_description(self, audit_event: dict[str, Any]) -> str:
        """Format audit event for dashboard display."""

        event_type = audit_event["event"]

        if event_type == "approval_response_processed":
            role = audit_event.get("approver_role", "Unknown")
            status = audit_event.get("response_status", "unknown")
            return f"{role} {status} the request"
        elif event_type == "automatic_escalation":
            role = audit_event.get("target_role", "Unknown")
            level = audit_event.get("escalation_level", "?")
            return f"Auto-escalated to {role} (Level {level})"
        else:
            return f"{event_type.replace('_', ' ').title()}"

    def _get_notification_status_summary(self, state: ApprovalState) -> dict[str, Any]:
        """Get notification status summary for dashboard."""

        total_notifications = len(state["notifications_sent"])
        successful_notifications = sum(
            1 for notif in state["notifications_sent"]
            if notif.get("status") == "sent"
        )

        return {
            "total_sent": total_notifications,
            "successful": successful_notifications,
            "failed": total_notifications - successful_notifications,
            "success_rate": (
                successful_notifications / total_notifications
                if total_notifications > 0 else 0.0
            ),
            "recent_failures": [
                notif for notif in state["notifications_sent"][-10:]
                if notif.get("status") != "sent"
            ]
        }

    def _calculate_risk_indicators(self, state: ApprovalState) -> dict[str, Any]:
        """Calculate risk indicators for escalation dashboard."""

        current_time = datetime.utcnow()
        risk_indicators = {
            "overall_risk": "low",
            "sla_risk": "low",
            "escalation_risk": "low",
            "factors": []
        }

        # Check SLA risk
        if state["sla_status"] == "overdue":
            risk_indicators["sla_risk"] = "critical"
            risk_indicators["factors"].append("SLA deadline exceeded")
        elif state["sla_status"] == "at_risk":
            risk_indicators["sla_risk"] = "high"
            risk_indicators["factors"].append("Approaching SLA deadline")

        # Check escalation risk
        if state["escalation_level"] >= 3:
            risk_indicators["escalation_risk"] = "critical"
            risk_indicators["factors"].append("Multiple escalation levels reached")
        elif state["escalation_level"] >= 2:
            risk_indicators["escalation_risk"] = "high"
            risk_indicators["factors"].append("Escalation level elevated")

        # Check for stalled approvals
        stalled_count = 0
        for req_data in state["approval_requirements"]:
            if req_data["approval_status"] == "pending":
                created_at = datetime.fromisoformat(req_data["created_at"])
                hours_pending = (current_time - created_at).total_seconds() / 3600
                if hours_pending > 48:  # Stalled for more than 48 hours
                    stalled_count += 1

        if stalled_count > 0:
            risk_indicators["factors"].append(f"{stalled_count} approvals stalled for >48h")

        # Calculate overall risk
        risk_scores = {
            "low": 1,
            "medium": 2,
            "high": 3,
            "critical": 4
        }

        max_risk_score = max([
            risk_scores[risk_indicators["sla_risk"]],
            risk_scores[risk_indicators["escalation_risk"]]
        ])

        for score, level in risk_scores.items():
            if level == max_risk_score:
                risk_indicators["overall_risk"] = score
                break

        return risk_indicators
