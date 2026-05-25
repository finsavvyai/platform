"""
Unit tests for Approval Service.

Comprehensive test suite for human-in-the-loop approval workflows
including multi-level approvals, escalations, and audit trails.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, call
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from udp.services.approval_service import ApprovalService, ApprovalStatus, ReminderType
from udp.services.escalation_service import EscalationService
from udp.infrastructure.notifications import NotificationService
from udp.domain.models import ApprovalRequirement, ApprovalResponse, WorkflowStatus
from udp.core.schemas.approval import ApprovalRequestCreate, ApprovalResponseCreate
from udp.workflows.approval_workflow import ApprovalType, RoutingStrategy


@pytest.fixture
def mock_db():
    """Mock database session."""
    return Mock(spec=AsyncSession)


@pytest.fixture
def organization_id():
    """Test organization ID."""
    return uuid4()


@pytest.fixture
def approval_service(mock_db, organization_id):
    """Create approval service instance with mocked dependencies."""
    service = ApprovalService(mock_db, organization_id)

    # Mock dependencies
    service.escalation_service = Mock(spec=EscalationService)
    service.notification_service = Mock(spec=NotificationService)

    return service


@pytest.fixture
def sample_requester():
    """Sample requester information."""
    return {"id": uuid4(), "role": "team_lead"}


@pytest.fixture
def sample_approval_request():
    """Sample approval request data."""
    return ApprovalRequestCreate(
        request_type=ApprovalType.DEPENDENCY_UPDATE,
        request_data={
            "project_id": uuid4(),
            "dependencies": [
                {"name": "react", "version": "18.2.0", "ecosystem": "npm"},
                {"name": "fastapi", "version": "0.104.0", "ecosystem": "pypi"},
            ],
            "vulnerabilities": [],
            "policy_violations": [],
            "license_violations": [],
            "ecosystems": ["npm", "pypi"],
        },
        routing_strategy=RoutingStrategy.RISK_BASED,
    )


@pytest.fixture
def sample_approval_response():
    """Sample approval response data."""
    return ApprovalResponseCreate(
        requirement_id=uuid4(),
        approver_email="approver@example.com",
        approver_role="security_officer",
        status=ApprovalStatus.APPROVED,
        comments="Approved after security review",
        confidence_level="high",
    )


class TestApprovalService:
    """Test cases for ApprovalService."""

    @pytest.mark.asyncio
    async def test_create_approval_request_success(
        self, approval_service, sample_approval_request, sample_requester
    ):
        """Test successful approval request creation."""
        # Arrange
        requester_id, requester_role = sample_requester["id"], sample_requester["role"]

        # Mock workflow execution
        mock_workflow_state = {
            "workflow_id": str(uuid4()),
            "status": WorkflowStatus.WAITING_FOR_APPROVAL,
            "request_type": sample_approval_request.request_type,
            "approval_requirements": [
                {
                    "id": str(uuid4()),
                    "approver_role": "security_officer",
                    "status": ApprovalStatus.PENDING,
                }
            ],
            "sla_deadline": datetime.utcnow() + timedelta(hours=24),
            "risk_based_routing": {"estimated_approval_time_hours": 12.0},
        }

        with patch("udp.services.approval_service.ApprovalWorkflow") as MockWorkflow:
            mock_workflow_instance = Mock()
            mock_workflow_instance.execute = AsyncMock(return_value=mock_workflow_state)
            MockWorkflow.return_value = mock_workflow_instance

            # Mock database operations
            approval_service.db.add = Mock()
            approval_service.db.commit = AsyncMock()
            approval_service.db.refresh = AsyncMock()

            # Act
            result = await approval_service.create_approval_request(
                sample_approval_request, requester_id, requester_role
            )

            # Assert
            assert result["workflow_id"] is not None
            assert result["status"] == WorkflowStatus.WAITING_FOR_APPROVAL
            assert result["request_type"] == sample_approval_request.request_type
            assert result["approval_requirements"] == 1
            assert result["sla_deadline"] is not None
            assert result["estimated_completion_time"] == 12.0

            # Verify workflow was executed
            MockWorkflow.assert_called_once_with(approval_service.organization_id)
            mock_workflow_instance.execute.assert_called_once()

            # Verify notifications were sent
            approval_service.notification_service.send_approval_request.assert_called()

    @pytest.mark.asyncio
    async def test_submit_approval_response_success(
        self, approval_service, sample_approval_response, sample_requester
    ):
        """Test successful approval response submission."""
        # Arrange
        workflow_id = uuid4()
        requirement_id = sample_approval_response.requirement_id
        responder_id = uuid4()

        # Mock workflow state
        mock_workflow_state = {
            "workflow_id": str(workflow_id),
            "status": WorkflowStatus.WAITING_FOR_APPROVAL,
            "approval_requirements": [
                {
                    "id": str(requirement_id),
                    "approver_role": "security_officer",
                    "approval_status": "pending",
                }
            ],
            "approval_responses": {},
            "stakeholder_responses": {},
        }

        approval_service._load_workflow_state = AsyncMock(
            return_value=mock_workflow_state
        )
        approval_service._update_workflow_state = AsyncMock()

        # Mock escalation manager
        mock_escalation_manager = Mock()
        mock_escalation_manager.validate_stakeholder_response = AsyncMock(
            return_value={"valid": True, "errors": [], "warnings": []}
        )
        mock_escalation_manager.process_approval_response = AsyncMock(
            return_value={
                "success": True,
                "workflow_progression": {
                    "workflow_complete": False,
                    "next_actions": [],
                },
            }
        )

        with patch("udp.services.approval_service.EscalationManager") as MockEscalation:
            MockEscalation.return_value = mock_escalation_manager

            # Mock escalation service
            approval_service.escalation_service.check_and_process_escalations = (
                AsyncMock(return_value={"escalations_processed": 0})
            )

            # Act
            result = await approval_service.submit_approval_response(
                workflow_id, sample_approval_response, responder_id
            )

            # Assert
            assert result["success"] is True
            assert result["workflow_id"] == str(workflow_id)
            assert result["response_processed"] is True
            assert result["workflow_complete"] is False

            # Verify response was validated
            mock_escalation_manager.validate_stakeholder_response.assert_called_once()
            mock_escalation_manager.process_approval_response.assert_called_once()

    @pytest.mark.asyncio
    async def test_submit_approval_response_validation_error(
        self, approval_service, sample_approval_response, sample_requester
    ):
        """Test approval response submission with validation errors."""
        # Arrange
        workflow_id = uuid4()
        responder_id = uuid4()

        # Mock workflow state
        mock_workflow_state = {
            "workflow_id": str(workflow_id),
            "approval_requirements": [],
            "stakeholder_responses": {},
        }

        approval_service._load_workflow_state = AsyncMock(
            return_value=mock_workflow_state
        )

        # Mock escalation manager with validation error
        mock_escalation_manager = Mock()
        mock_escalation_manager.validate_stakeholder_response = AsyncMock(
            return_value={
                "valid": False,
                "errors": ["Approver role mismatch"],
                "warnings": ["Response received after deadline"],
            }
        )

        with patch("udp.services.approval_service.EscalationManager") as MockEscalation:
            MockEscalation.return_value = mock_escalation_manager

            # Act
            result = await approval_service.submit_approval_response(
                workflow_id, sample_approval_response, responder_id
            )

            # Assert
            assert result["success"] is False
            assert "Approver role mismatch" in result["errors"]
            assert "Response received after deadline" in result["warnings"]

    @pytest.mark.asyncio
    async def test_escalate_approval_success(self, approval_service, sample_requester):
        """Test successful approval escalation."""
        # Arrange
        workflow_id = uuid4()
        requirement_id = uuid4()
        escalated_by = uuid4()
        escalation_reason = "SLA deadline exceeded"

        # Mock workflow state
        mock_workflow_state = {
            "workflow_id": str(workflow_id),
            "approval_requirements": [
                {
                    "id": str(requirement_id),
                    "approver_role": "security_officer",
                    "approval_status": "pending",
                    "escalation_count": 0,
                    "stakeholder_hierarchy": [
                        {
                            "role": "security_manager",
                            "email": "security.manager@example.com",
                        }
                    ],
                }
            ],
        }

        approval_service._load_workflow_state = AsyncMock(
            return_value=mock_workflow_state
        )
        approval_service._update_workflow_state = AsyncMock()
        approval_service._send_escalation_notifications = AsyncMock()
        approval_service._log_manual_escalation = AsyncMock()

        # Act
        result = await approval_service.escalate_approval(
            workflow_id, requirement_id, escalation_reason, escalated_by
        )

        # Assert
        assert result["success"] is True
        assert result["workflow_id"] == str(workflow_id)
        assert result["requirement_id"] == str(requirement_id)
        assert result["escalation_target"]["role"] == "security_manager"
        assert result["escalation_level"] == 1

        # Verify escalation was logged and notifications sent
        approval_service._send_escalation_notifications.assert_called_once()
        approval_service._log_manual_escalation.assert_called_once()

    @pytest.mark.asyncio
    async def test_escalate_approval_no_targets(
        self, approval_service, sample_requester
    ):
        """Test escalation with no available targets."""
        # Arrange
        workflow_id = uuid4()
        requirement_id = uuid4()
        escalated_by = uuid4()

        # Mock workflow state with no escalation targets
        mock_workflow_state = {
            "workflow_id": str(workflow_id),
            "approval_requirements": [
                {
                    "id": str(requirement_id),
                    "approver_role": "security_officer",
                    "approval_status": "pending",
                    "escalation_count": 2,
                    "stakeholder_hierarchy": [],  # No more escalation targets
                }
            ],
        }

        approval_service._load_workflow_state = AsyncMock(
            return_value=mock_workflow_state
        )

        # Act
        result = await approval_service.escalate_approval(
            workflow_id, requirement_id, "Escalation attempt", escalated_by
        )

        # Assert
        assert result["success"] is False
        assert "No further escalation targets available" in result["error"]

    @pytest.mark.asyncio
    async def test_get_approval_status_success(self, approval_service):
        """Test getting approval workflow status."""
        # Arrange
        workflow_id = uuid4()

        # Mock workflow state
        mock_workflow_state = {
            "workflow_id": str(workflow_id),
            "status": WorkflowStatus.WAITING_FOR_APPROVAL,
            "request_type": ApprovalType.DEPENDENCY_UPDATE,
            "sla_deadline": datetime.utcnow() + timedelta(hours=12),
            "sla_status": "on_time",
            "escalation_level": 0,
            "approval_requirements": [],
            "approval_workflow": [],
            "stakeholder_responses": {},
            "audit_trail_enhanced": [],
        }

        approval_service._load_workflow_state = AsyncMock(
            return_value=mock_workflow_state
        )

        # Mock escalation manager
        mock_escalation_manager = Mock()
        mock_escalation_manager.get_approval_status_summary = AsyncMock(
            return_value={
                "workflow_id": str(workflow_id),
                "workflow_status": WorkflowStatus.WAITING_FOR_APPROVAL,
                "total_requirements": 2,
                "completed": 1,
                "pending": 1,
            }
        )
        mock_escalation_manager.assess_approval_risk = AsyncMock(
            return_value={"overall_risk": "low", "factors": []}
        )

        with patch("udp.services.approval_service.EscalationManager") as MockEscalation:
            MockEscalation.return_value = mock_escalation_manager

            # Act
            result = await approval_service.get_approval_status(
                workflow_id, include_details=True
            )

            # Assert
            assert result["workflow_id"] == str(workflow_id)
            assert result["workflow_status"] == WorkflowStatus.WAITING_FOR_APPROVAL
            assert result["request_type"] == ApprovalType.DEPENDENCY_UPDATE
            assert result["total_requirements"] == 2
            assert result["completed"] == 1
            assert result["pending"] == 1
            assert "risk_indicators" in result
            assert result["risk_indicators"]["overall_risk"] == "low"

    @pytest.mark.asyncio
    async def test_get_pending_approvals_success(
        self, approval_service, sample_requester
    ):
        """Test getting pending approvals for a user."""
        # Arrange
        user_id = uuid4()
        user_role = "security_officer"

        # Mock database query result
        mock_workflow = Mock()
        mock_workflow.id = uuid4()
        mock_workflow.request_type = ApprovalType.DEPENDENCY_UPDATE
        mock_workflow.request_data = {"project_name": "test-project"}
        mock_workflow.created_at = datetime.utcnow() - timedelta(hours=2)
        mock_workflow.current_approvers = [{"user_id": str(user_id), "role": user_role}]

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [mock_workflow]
        approval_service.db.execute = AsyncMock(return_value=mock_result)

        # Mock workflow state loading
        approval_service._load_workflow_state = AsyncMock(
            return_value={
                "sla_deadline": datetime.utcnow() + timedelta(hours=22),
                "approval_responses": {"security_officer_123": {"response": {}}},
                "approval_requirements": [{"id": "req1"}, {"id": "req2"}],
            }
        )

        # Act
        result = await approval_service.get_pending_approvals(
            user_id=user_id, user_role=user_role, limit=10, offset=0
        )

        # Assert
        assert len(result["pending_approvals"]) == 1
        assert result["total_count"] == 1
        assert result["limit"] == 10
        assert result["offset"] == 0

        pending_approval = result["pending_approvals"][0]
        assert pending_approval["request_type"] == ApprovalType.DEPENDENCY_UPDATE
        assert pending_approval["current_approver_role"] == user_role
        assert pending_approval["urgency"] in ["low", "medium", "high", "critical"]

    @pytest.mark.asyncio
    async def test_cancel_approval_request_success(
        self, approval_service, sample_requester
    ):
        """Test successful approval request cancellation."""
        # Arrange
        workflow_id = uuid4()
        cancelled_by = uuid4()
        cancellation_reason = "Project requirements changed"

        # Mock workflow state
        mock_workflow_state = {
            "workflow_id": str(workflow_id),
            "status": WorkflowStatus.WAITING_FOR_APPROVAL,
            "audit_trail_enhanced": [],
        }

        approval_service._load_workflow_state = AsyncMock(
            return_value=mock_workflow_state
        )
        approval_service._update_workflow_state = AsyncMock()
        approval_service._cancel_reminder_tasks = AsyncMock()
        approval_service._send_cancellation_notifications = AsyncMock()
        approval_service._log_workflow_cancellation = AsyncMock()

        # Act
        result = await approval_service.cancel_approval_request(
            workflow_id, cancellation_reason, cancelled_by
        )

        # Assert
        assert result["success"] is True
        assert result["workflow_id"] == str(workflow_id)
        assert result["status"] == WorkflowStatus.CANCELLED
        assert result["cancelled_at"] is not None

        # Verify cancellation was logged
        approval_service._log_workflow_cancellation.assert_called_once_with(
            workflow_id, cancellation_reason, cancelled_by
        )

    @pytest.mark.asyncio
    async def test_cancel_approval_request_already_completed(
        self, approval_service, sample_requester
    ):
        """Test cancelling an already completed workflow."""
        # Arrange
        workflow_id = uuid4()
        cancelled_by = uuid4()

        # Mock workflow state as already completed
        mock_workflow_state = {
            "workflow_id": str(workflow_id),
            "status": WorkflowStatus.COMPLETED,
        }

        approval_service._load_workflow_state = AsyncMock(
            return_value=mock_workflow_state
        )

        # Act
        result = await approval_service.cancel_approval_request(
            workflow_id, "Test cancellation", cancelled_by
        )

        # Assert
        assert result["success"] is False
        assert "Cannot cancel workflow" in result["error"]
        assert WorkflowStatus.COMPLETED.value in result["error"]

    def test_extract_current_approvers_single(self, approval_service):
        """Test extracting single current approver."""
        # Arrange
        workflow_state = {
            "current_approver": {
                "requirement_id": str(uuid4()),
                "role": "security_officer",
                "email": "security@example.com",
            }
        }

        # Act
        approvers = approval_service._extract_current_approvers(workflow_state)

        # Assert
        assert len(approvers) == 1
        assert approvers[0]["role"] == "security_officer"
        assert approvers[0]["email"] == "security@example.com"

    def test_extract_current_approvers_multiple(self, approval_service):
        """Test extracting multiple current approvers."""
        # Arrange
        workflow_state = {
            "current_approver": {
                "active_approvers": [
                    {
                        "requirement_id": str(uuid4()),
                        "role": "security_officer",
                        "email": "security@example.com",
                    },
                    {
                        "requirement_id": str(uuid4()),
                        "role": "team_lead",
                        "email": "lead@example.com",
                    },
                ]
            }
        }

        # Act
        approvers = approval_service._extract_current_approvers(workflow_state)

        # Assert
        assert len(approvers) == 2
        roles = [a["role"] for a in approvers]
        assert "security_officer" in roles
        assert "team_lead" in roles

    def test_calculate_urgency_overdue(self, approval_service):
        """Test urgency calculation for overdue deadline."""
        # Arrange
        past_deadline = datetime.utcnow() - timedelta(hours=2)
        workflow_state = {"sla_deadline": past_deadline}

        # Act
        urgency = approval_service._calculate_urgency(workflow_state)

        # Assert
        assert urgency == "overdue"

    def test_calculate_urgency_critical(self, approval_service):
        """Test urgency calculation for critical deadline."""
        # Arrange
        near_deadline = datetime.utcnow() + timedelta(hours=1)
        workflow_state = {"sla_deadline": near_deadline}

        # Act
        urgency = approval_service._calculate_urgency(workflow_state)

        # Assert
        assert urgency == "critical"

    def test_calculate_urgency_normal(self, approval_service):
        """Test urgency calculation for normal deadline."""
        # Arrange
        future_deadline = datetime.utcnow() + timedelta(hours=48)
        workflow_state = {"sla_deadline": future_deadline}

        # Act
        urgency = approval_service._calculate_urgency(workflow_state)

        # Assert
        assert urgency == "low"

    @pytest.mark.asyncio
    async def test_schedule_deadline_reminders(self, approval_service):
        """Test scheduling deadline reminders."""
        # Arrange
        workflow_id = uuid4()
        deadline = datetime.utcnow() + timedelta(hours=25)

        workflow_state = {
            "workflow_id": str(workflow_id),
            "sla_deadline": deadline,
            "current_approvers": [
                {"role": "security_officer", "email": "security@example.com"}
            ],
        }

        # Mock asyncio.create_task
        with patch("asyncio.create_task") as mock_create_task:
            mock_task = Mock()
            mock_create_task.return_value = mock_task

            # Act
            await approval_service._schedule_deadline_reminders(
                workflow_id, workflow_state
            )

            # Assert
            # Should create tasks for reminders that are in the future
            assert mock_create_task.call_count >= 1

            # Verify tasks are stored
            assert str(workflow_id) in approval_service.reminder_tasks
            assert len(approval_service.reminder_tasks[str(workflow_id)]) >= 1

    @pytest.mark.asyncio
    async def test_cancel_reminder_tasks(self, approval_service):
        """Test cancelling reminder tasks."""
        # Arrange
        workflow_id = uuid4()
        workflow_id_str = str(workflow_id)

        # Create mock tasks
        mock_task1 = Mock()
        mock_task1.done.return_value = False
        mock_task2 = Mock()
        mock_task2.done.return_value = False

        approval_service.reminder_tasks[workflow_id_str] = [mock_task1, mock_task2]

        # Act
        await approval_service._cancel_reminder_tasks(workflow_id)

        # Assert
        mock_task1.cancel.assert_called_once()
        mock_task2.cancel.assert_called_once()
        assert workflow_id_str not in approval_service.reminder_tasks


class TestApprovalServiceIntegration:
    """Integration tests for ApprovalService with real dependencies."""

    @pytest.mark.asyncio
    async def test_end_to_end_approval_workflow(self):
        """Test complete approval workflow from creation to completion."""
        # This would be an integration test with real database and services
        # Implementation would involve setting up test database, real services,
        # and testing the complete flow

        # Placeholder for integration test
        pass

    @pytest.mark.asyncio
    async def test_multi_level_approval_workflow(self):
        """Test workflow with multiple approval levels."""
        # Placeholder for multi-level approval test
        pass

    @pytest.mark.asyncio
    async def test_escalation_workflow(self):
        """Test automatic escalation workflow."""
        # Placeholder for escalation test
        pass
