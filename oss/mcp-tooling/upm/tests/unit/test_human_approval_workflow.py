"""
Unit tests for Human Approval Workflow with LangGraph integration.

Tests the complete human-in-the-loop workflow including intelligent routing,
multi-level approvals, SLA management, and comprehensive audit trails.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from udp.workflows.human_approval import (
    HumanApprovalWorkflow,
    HumanApprovalNode,
    ApprovalWorkflowState,
)
from udp.domain.models import WorkflowStatus, ApprovalResponse, ApprovalStatus
from udp.services.approval_service import ApprovalService


@pytest.fixture
def organization_id():
    """Test organization ID."""
    return uuid4()


@pytest.fixture
def mock_approval_service():
    """Mock approval service."""
    service = Mock(spec=ApprovalService)
    service.organization_id = uuid4()
    return service


@pytest.fixture
def human_approval_workflow(mock_approval_service, organization_id):
    """Create human approval workflow instance."""
    return HumanApprovalWorkflow(organization_id, mock_approval_service)


@pytest.fixture
def sample_request_data():
    """Sample approval request data."""
    return {
        "project_id": uuid4(),
        "dependencies": [
            {"name": "react", "version": "18.2.0", "ecosystem": "npm"},
            {"name": "fastapi", "version": "0.104.0", "ecosystem": "pypi"},
        ],
        "vulnerabilities": [],
        "policy_violations": [],
        "license_violations": [],
        "ecosystems": ["npm", "pypi"],
    }


@pytest.fixture
def initial_workflow_state():
    """Initial workflow state for testing."""
    return {
        "workflow_id": str(uuid4()),
        "workflow_type": "human_approval",
        "organization_id": str(uuid4()),
        "status": WorkflowStatus.PENDING.value,
        "current_step": HumanApprovalNode.INITIALIZE,
        "started_at": datetime.utcnow(),
        "completed_at": None,
        "error_message": None,
        "retry_count": 0,
        "max_retries": 3,
        "audit_log": [],
        "performance_metrics": {},
        "request_type": "dependency_update",
        "request_data": {},
        "requester_id": str(uuid4()),
        "requester_role": "team_lead",
        "approval_requirements": [],
        "approval_responses": {},
        "current_approvers": [],
        "stakeholder_hierarchy": {},
        "sla_deadline": None,
        "sla_status": "on_time",
        "escalation_level": 0,
        "escalation_policies": {},
        "final_decision": None,
        "decision_rationale": None,
        "decision_confidence": None,
        "messages": [],
        "next_step": None,
    }


class TestHumanApprovalWorkflow:
    """Test cases for HumanApprovalWorkflow."""

    @pytest.mark.asyncio
    async def test_workflow_initialization(
        self, human_approval_workflow, mock_approval_service
    ):
        """Test workflow graph initialization."""
        # Assert
        assert (
            human_approval_workflow.organization_id
            == mock_approval_service.organization_id
        )
        assert human_approval_workflow.workflow_graph is not None
        assert human_approval_workflow.checkpoint_saver is not None

    @pytest.mark.asyncio
    async def test_execute_workflow_success(
        self, human_approval_workflow, sample_request_data, initial_workflow_state
    ):
        """Test successful workflow execution with manual approval."""
        # Arrange
        requester_id = uuid4()
        requester_role = "team_lead"
        request_type = "dependency_update"
        workflow_id = str(uuid4())

        # Mock workflow graph execution
        mock_final_state = initial_workflow_state.copy()
        mock_final_state.update(
            {
                "workflow_id": workflow_id,
                "status": WorkflowStatus.WAITING_FOR_APPROVAL.value,
                "request_type": request_type,
                "request_data": sample_request_data,
                "requester_id": str(requester_id),
                "requester_role": requester_role,
                "approval_requirements": [
                    {
                        "id": str(uuid4()),
                        "approver_role": "security_officer",
                        "status": ApprovalStatus.PENDING.value,
                    }
                ],
                "current_approvers": [
                    {
                        "role": "security_officer",
                        "deadline": (
                            datetime.utcnow() + timedelta(hours=24)
                        ).isoformat(),
                    }
                ],
                "sla_deadline": datetime.utcnow() + timedelta(hours=24),
                "messages": [
                    "Starting approval workflow for dependency_update",
                    "Request analyzed - Risk level: low",
                    "Determined 2 stakeholders",
                    "Generated 2 approval requirements",
                    "Manual approval required",
                    "Approval requests sent to 2 approvers",
                ],
            }
        )

        human_approval_workflow.workflow_graph = Mock()
        human_approval_workflow.workflow_graph.ainvoke = AsyncMock(
            return_value=mock_final_state
        )

        # Act
        result = await human_approval_workflow.execute_workflow(
            request_type, sample_request_data, requester_id, requester_role, workflow_id
        )

        # Assert
        assert result["workflow_id"] == workflow_id
        assert result["status"] == WorkflowStatus.WAITING_FOR_APPROVAL.value
        assert result["final_decision"] is None  # Still waiting for approvals
        assert result["approval_responses"] == {}
        assert result["escalation_level"] == 0
        assert result["sla_status"] == "on_time"
        assert len(result["audit_log"]) > 0

    @pytest.mark.asyncio
    async def test_execute_workflow_auto_approval(
        self, human_approval_workflow, sample_request_data, initial_workflow_state
    ):
        """Test workflow execution with automatic approval."""
        # Arrange
        requester_id = uuid4()
        requester_role = "architect"  # Trusted role
        request_type = "dependency_update"

        # Mock workflow graph execution with auto-approval
        mock_final_state = initial_workflow_state.copy()
        mock_final_state.update(
            {
                "status": WorkflowStatus.COMPLETED.value,
                "request_type": request_type,
                "request_data": sample_request_data,
                "requester_id": str(requester_id),
                "requester_role": requester_role,
                "final_decision": "auto_approved",
                "decision_rationale": "Low risk request from trusted role",
                "decision_confidence": 0.9,
                "completed_at": datetime.utcnow(),
                "messages": [
                    "Starting approval workflow for dependency_update",
                    "Request analyzed - Risk level: low",
                    "Determined 1 stakeholder",
                    "Generated 1 approval requirement",
                    "Request auto-approved",
                ],
            }
        )

        human_approval_workflow.workflow_graph = Mock()
        human_approval_workflow.workflow_graph.ainvoke = AsyncMock(
            return_value=mock_final_state
        )

        # Act
        result = await human_approval_workflow.execute_workflow(
            request_type, sample_request_data, requester_id, requester_role
        )

        # Assert
        assert result["status"] == WorkflowStatus.COMPLETED.value
        assert result["final_decision"] == "auto_approved"
        assert result["decision_rationale"] == "Low risk request from trusted role"
        assert result["decision_confidence"] == 0.9
        assert result["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_submit_approval_response(
        self, human_approval_workflow, initial_workflow_state
    ):
        """Test submitting approval response to active workflow."""
        # Arrange
        workflow_id = str(uuid4())

        # Create approval response
        approval_response = ApprovalResponse(
            requirement_id=uuid4(),
            approver_id=uuid4(),
            approver_email="approver@example.com",
            approver_role="security_officer",
            status=ApprovalStatus.APPROVED,
            comments="Approved after security review",
            confidence_level="high",
        )

        # Mock current workflow state
        mock_current_state = initial_workflow_state.copy()
        mock_current_state.update(
            {
                "workflow_id": workflow_id,
                "status": WorkflowStatus.WAITING_FOR_APPROVAL.value,
                "approval_responses": {},
            }
        )

        # Mock updated state after response
        mock_updated_state = mock_current_state.copy()
        mock_updated_state["approval_responses"] = {
            "security_officer_123": {
                "response": approval_response.dict(),
                "timestamp": datetime.utcnow().isoformat(),
            }
        }
        mock_updated_state["messages"].append(
            "Received approval response from security_officer: approved"
        )

        # Mock final state after processing
        mock_final_state = mock_updated_state.copy()
        mock_final_state["status"] = WorkflowStatus.COMPLETED.value
        mock_final_state["final_decision"] = "approved"
        mock_final_state["decision_rationale"] = "All required approvals received"
        mock_final_state["decision_confidence"] = 0.85
        mock_final_state["completed_at"] = datetime.utcnow()

        # Mock workflow graph methods
        human_approval_workflow.workflow_graph = Mock()
        human_approval_workflow.workflow_graph.get_state = AsyncMock(
            return_value=Mock(values=mock_current_state)
        )
        human_approval_workflow.workflow_graph.aupdate_state = AsyncMock()
        human_approval_workflow.workflow_graph.ainvoke = AsyncMock(
            return_value=mock_final_state
        )

        # Act
        result = await human_approval_workflow.submit_approval_response(
            workflow_id, approval_response
        )

        # Assert
        assert result["workflow_id"] == workflow_id
        assert result["response_processed"] is True
        assert result["workflow_complete"] is True
        assert result["final_decision"] == "approved"
        assert result["status"] == WorkflowStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_workflow_node_initialize(self, human_approval_workflow):
        """Test initialize workflow node."""
        # Arrange
        state = {
            "workflow_id": str(uuid4()),
            "status": WorkflowStatus.PENDING.value,
            "request_type": "dependency_update",
            "requester_id": str(uuid4()),
            "requester_role": "team_lead",
            "messages": ["Starting approval workflow for dependency_update"],
            "audit_log": [],
        }

        # Act
        result = await human_approval_workflow._initialize_workflow(state)

        # Assert
        assert result["current_step"] == HumanApprovalNode.INITIALIZE
        assert result["status"] == WorkflowStatus.IN_PROGRESS.value
        assert len(result["messages"]) > 0
        assert len(result["audit_log"]) == 1
        assert result["audit_log"][0]["event"] == "workflow_initialized"

    @pytest.mark.asyncio
    async def test_workflow_node_analyze_request(self, human_approval_workflow):
        """Test analyze request workflow node."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.ANALYZE_REQUEST,
            "request_data": {
                "vulnerabilities": [],
                "policy_violations": [],
                "dependencies": [{"name": "react"}],
                "ecosystems": ["npm"],
            },
            "messages": ["Workflow initialized"],
        }

        # Act
        result = await human_approval_workflow._analyze_request(state)

        # Assert
        assert result["current_step"] == HumanApprovalNode.ANALYZE_REQUEST
        assert "risk_analysis" in result["performance_metrics"]
        assert result["performance_metrics"]["risk_analysis"]["risk_level"] == "low"
        assert result["performance_metrics"]["risk_analysis"]["risk_score"] >= 0
        assert any("Risk level: low" in msg for msg in result["messages"])

    @pytest.mark.asyncio
    async def test_workflow_node_analyze_high_risk_request(
        self, human_approval_workflow
    ):
        """Test analyze request workflow node with high risk."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.ANALYZE_REQUEST,
            "request_data": {
                "vulnerabilities": [{"severity": "critical"}, {"severity": "high"}],
                "policy_violations": [{"type": "license"}, {"type": "security"}],
                "dependencies": [{"name": "react"}] * 20,  # Many dependencies
                "ecosystems": ["npm", "pypi", "maven", "cargo"],  # Multiple ecosystems
            },
            "messages": ["Workflow initialized"],
        }

        # Act
        result = await human_approval_workflow._analyze_request(state)

        # Assert
        assert result["performance_metrics"]["risk_analysis"]["risk_level"] in [
            "high",
            "critical",
        ]
        assert result["performance_metrics"]["risk_analysis"]["risk_score"] >= 6.0

    @pytest.mark.asyncio
    async def test_workflow_node_determine_stakeholders(self, human_approval_workflow):
        """Test determine stakeholders workflow node."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.DETERMINE_STAKEHOLDERS,
            "request_type": "security_override",
            "performance_metrics": {"risk_analysis": {"risk_level": "high"}},
            "request_data": {"ecosystem_diversity": 3},
            "messages": ["Request analyzed"],
        }

        # Act
        result = await human_approval_workflow._determine_stakeholders(state)

        # Assert
        assert result["current_step"] == HumanApprovalNode.DETERMINE_STAKEHOLDERS
        assert len(result["stakeholder_hierarchy"]) > 0
        assert "team_lead" in result["stakeholder_hierarchy"]
        assert "security_officer" in result["stakeholder_hierarchy"]
        assert "manager" in result["stakeholder_hierarchy"]

    @pytest.mark.asyncio
    async def test_workflow_node_generate_requirements(self, human_approval_workflow):
        """Test generate requirements workflow node."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.GENERATE_REQUIREMENTS,
            "request_type": "dependency_update",
            "stakeholder_hierarchy": {
                "team_lead": ["manager"],
                "security_officer": ["security_manager"],
            },
            "performance_metrics": {"risk_analysis": {"risk_level": "medium"}},
            "messages": ["Determined stakeholders"],
        }

        # Act
        result = await human_approval_workflow._generate_requirements(state)

        # Assert
        assert result["current_step"] == HumanApprovalNode.GENERATE_REQUIREMENTS
        assert result["sla_deadline"] is not None
        assert result["sla_deadline"] > datetime.utcnow()
        assert len(result["approval_requirements"]) > 0
        assert all(
            "deadline" in req and "priority" in req
            for req in result["approval_requirements"]
        )

    @pytest.mark.asyncio
    async def test_workflow_node_check_auto_approval_eligible(
        self, human_approval_workflow
    ):
        """Test check auto-approval workflow node for eligible request."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.CHECK_AUTO_APPROVAL,
            "requester_role": "architect",  # Trusted role
            "performance_metrics": {"risk_analysis": {"risk_level": "low"}},
            "request_data": {"vulnerabilities": []},
            "messages": ["Generated approval requirements"],
        }

        # Act
        result = await human_approval_workflow._check_auto_approval(state)

        # Assert
        assert result["final_decision"] == "auto_approved"
        assert result["decision_rationale"] == "Low risk request from trusted role"
        assert result["decision_confidence"] == 0.9
        assert result["status"] == WorkflowStatus.COMPLETED.value
        assert result["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_workflow_node_check_auto_approval_not_eligible(
        self, human_approval_workflow
    ):
        """Test check auto-approval workflow node for non-eligible request."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.CHECK_AUTO_APPROVAL,
            "requester_role": "developer",  # Not trusted role
            "performance_metrics": {"risk_analysis": {"risk_level": "medium"}},
            "request_data": {"vulnerabilities": [{"severity": "medium"}]},
            "messages": ["Generated approval requirements"],
        }

        # Act
        result = await human_approval_workflow._check_auto_approval(state)

        # Assert
        assert result.get("final_decision") is None
        assert result.get("decision_rationale") is None
        assert result["status"] != WorkflowStatus.COMPLETED.value
        assert any("Manual approval required" in msg for msg in result["messages"])

    @pytest.mark.asyncio
    async def test_workflow_node_initiate_approvals(self, human_approval_workflow):
        """Test initiate approvals workflow node."""
        # Arrange
        requirement_id = uuid4()
        deadline = datetime.utcnow() + timedelta(hours=24)

        state = {
            "current_step": HumanApprovalNode.INITIATE_APPROVALS,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "approval_requirements": [
                {
                    "id": str(requirement_id),
                    "approver_role": "security_officer",
                    "deadline": deadline.isoformat(),
                    "status": ApprovalStatus.PENDING.value,
                }
            ],
            "messages": ["Manual approval required"],
        }

        # Mock notification sending
        human_approval_workflow._send_approval_notifications = AsyncMock()

        # Act
        result = await human_approval_workflow._initiate_approvals(state)

        # Assert
        assert result["current_step"] == HumanApprovalNode.INITIATE_APPROVALS
        assert result["status"] == WorkflowStatus.WAITING_FOR_APPROVAL.value
        assert len(result["current_approvers"]) == 1
        assert result["current_approvers"][0]["role"] == "security_officer"
        assert result["current_approvers"][0]["deadline"] == deadline.isoformat()

        # Verify notifications were sent
        human_approval_workflow._send_approval_notifications.assert_called_once()

    @pytest.mark.asyncio
    async def test_workflow_node_check_completion_approved(
        self, human_approval_workflow
    ):
        """Test check completion workflow node for approved workflow."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.CHECK_COMPLETION,
            "approval_requirements": [{"id": str(uuid4())}, {"id": str(uuid4())}],
            "approval_responses": {
                "security_officer_123": {
                    "response": {"status": ApprovalStatus.APPROVED}
                },
                "team_lead_456": {"response": {"status": ApprovalStatus.APPROVED}},
            },
            "messages": ["Processing approval response"],
        }

        # Act
        result = await human_approval_workflow._check_completion(state)

        # Assert
        assert result["final_decision"] == "approved"
        assert result["decision_rationale"] == "All required approvals received"
        assert result["decision_confidence"] == 0.85
        assert result["status"] == WorkflowStatus.COMPLETED.value
        assert result["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_workflow_node_check_completion_rejected(
        self, human_approval_workflow
    ):
        """Test check completion workflow node for rejected workflow."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.CHECK_COMPLETION,
            "approval_responses": {
                "security_officer_123": {
                    "response": {
                        "status": ApprovalStatus.REJECTED,
                        "approver_role": "security_officer",
                    }
                }
            },
            "messages": ["Processing approval response"],
        }

        # Act
        result = await human_approval_workflow._check_completion(state)

        # Assert
        assert result["final_decision"] == "rejected"
        assert "Rejected by security_officer" in result["decision_rationale"]
        assert result["status"] == WorkflowStatus.REJECTED.value
        assert result["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_workflow_node_handle_timeout(self, human_approval_workflow):
        """Test handle timeout workflow node."""
        # Arrange
        state = {
            "current_step": HumanApprovalNode.HANDLE_TIMEOUT,
            "escalation_level": 2,
            "messages": ["Timeout - escalating"],
        }

        # Act
        result = await human_approval_workflow._handle_timeout(state)

        # Assert
        assert result["sla_status"] == "overdue"
        assert result["escalation_level"] == 3  # Should be incremented

        # With max escalation reached, should fail
        state["escalation_level"] = 3  # Max level
        result = await human_approval_workflow._handle_timeout(state)

        assert result["status"] == WorkflowStatus.FAILED.value
        assert result["final_decision"] == "timeout"
        assert "Maximum escalation level reached" in result["decision_rationale"]

    def test_calculate_priority(self, human_approval_workflow):
        """Test priority calculation for different roles and risk levels."""
        # Test high priority (security officer with critical risk)
        priority = human_approval_workflow._calculate_priority(
            "security_officer", "critical"
        )
        assert priority <= 10  # High priority (low number)

        # Test low priority (developer with low risk)
        priority = human_approval_workflow._calculate_priority("developer", "low")
        assert priority >= 90  # Low priority (high number)

        # Test medium priority
        priority = human_approval_workflow._calculate_priority("team_lead", "medium")
        assert 30 <= priority <= 60

    def test_route_after_auto_approval_check_approved(self, human_approval_workflow):
        """Test routing after auto-approval check for approved request."""
        state = {"final_decision": "auto_approved"}
        route = human_approval_workflow._route_after_auto_approval_check(state)
        assert route == "auto_approved"

    def test_route_after_auto_approval_check_requires_approval(
        self, human_approval_workflow
    ):
        """Test routing after auto-approval check for manual approval."""
        state = {"final_decision": None}
        route = human_approval_workflow._route_after_auto_approval_check(state)
        assert route == "requires_approval"

    def test_check_response_status_timeout(self, human_approval_workflow):
        """Test checking response status for timeout."""
        state = {"sla_status": "overdue"}
        status = human_approval_workflow._check_response_status(state)
        assert status == "timeout"

    def test_check_response_status_received(self, human_approval_workflow):
        """Test checking response status when received."""
        state = {
            "sla_status": "on_time",
            "approval_responses": {"response1": {"data": "test"}},
        }
        status = human_approval_workflow._check_response_status(state)
        assert status == "response_received"

    def test_route_after_completion_check_completed(self, human_approval_workflow):
        """Test routing after completion check for completed workflow."""
        state = {"status": WorkflowStatus.COMPLETED.value}
        route = human_approval_workflow._route_after_completion_check(state)
        assert route == "completed"

    def test_route_after_completion_check_rejected(self, human_approval_workflow):
        """Test routing after completion check for rejected workflow."""
        state = {"status": WorkflowStatus.REJECTED.value}
        route = human_approval_workflow._route_after_completion_check(state)
        assert route == "rejected"

    def test_route_after_completion_check_needs_escalation(
        self, human_approval_workflow
    ):
        """Test routing after completion check for escalation needed."""
        state = {
            "status": WorkflowStatus.WAITING_FOR_APPROVAL.value,
            "sla_status": "overdue",
        }
        route = human_approval_workflow._route_after_completion_check(state)
        assert route == "needs_escalation"


class TestWorkflowRouting:
    """Test workflow routing and conditional logic."""

    @pytest.mark.asyncio
    async def test_critical_security_override_routing(self):
        """Test routing for critical security override requests."""
        # This would test the complete routing flow for critical requests
        pass

    @pytest.mark.asyncio
    async def test_compliance_exception_routing(self):
        """Test routing for compliance exception requests."""
        # This would test the specific routing for compliance workflows
        pass

    @pytest.mark.asyncio
    async def test_emergency_override_expedited_routing(self):
        """Test expedited routing for emergency override requests."""
        # This would test faster SLAs and routing for emergencies
        pass
