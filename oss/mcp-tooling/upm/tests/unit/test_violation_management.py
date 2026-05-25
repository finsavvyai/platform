"""
Tests for Policy Violation Management and Exception Workflow

Comprehensive test suite covering policy violation detection,
exception request workflows, and remediation management.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from udp.core.models.violation import (
    ExceptionStatus,
    ExceptionType,
    PolicyExceptionRequest,
    PolicyViolation,
    ViolationRemediation,
    ViolationSeverity,
    ViolationStatus,
)
from udp.core.models.policy import Policy, PolicyEvaluation, PolicyEvaluationStatus
from udp.services.violation_service import (
    ExceptionRequestService,
    RemediationService,
    ViolationAnalyticsService,
    ViolationDetectionService,
    ViolationManagementService,
)
from udp.workflows.policy_exception_workflow import (
    ExceptionWorkflowState,
    PolicyExceptionWorkflow,
)


@pytest.fixture
def mock_db():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def sample_policy():
    """Sample policy for testing."""
    return Policy(
        id=uuid4(),
        name="Security Policy",
        rule_type="security",
        severity="high",
        is_active=True,
    )


@pytest.fixture
def sample_policy_evaluation(sample_policy):
    """Sample policy evaluation for testing."""
    return PolicyEvaluation(
        id=uuid4(),
        project_id=uuid4(),
        policy_id=sample_policy.id,
        status=PolicyEvaluationStatus.FAIL,
        violation_detected=True,
        violation_severity="high",
        result_message="Security policy violation detected",
    )


@pytest.fixture
def sample_violation(sample_policy, sample_policy_evaluation):
    """Sample policy violation for testing."""
    return PolicyViolation(
        id=uuid4(),
        project_id=uuid4(),
        policy_id=sample_policy.id,
        policy_evaluation_id=sample_policy_evaluation.id,
        violation_key="security_violation_001",
        title="Security Policy Violation",
        description="Package has critical vulnerability",
        severity=ViolationSeverity.HIGH,
        status=ViolationStatus.OPEN,
        detected_at=datetime.utcnow(),
        risk_score=8.5,
        remediation_required=True,
        remediation_type="manual",
    )


@pytest.fixture
def sample_exception_request():
    """Sample exception request for testing."""
    return PolicyExceptionRequest(
        id=uuid4(),
        project_id=uuid4(),
        policy_id=uuid4(),
        requester_id=uuid4(),
        exception_key="exception_001",
        title="Exception for Security Policy",
        description="Request exception for required package",
        exception_type=ExceptionType.TEMPORARY,
        justification="Business critical component",
        status=ExceptionStatus.PENDING,
        submitted_at=datetime.utcnow(),
        duration_days=30,
        approval_required=True,
    )


class TestViolationDetectionService:
    """Test cases for ViolationDetectionService."""

    @pytest.mark.asyncio
    async def test_create_violation_from_evaluation_new_violation(
        self, mock_db, sample_policy_evaluation
    ):
        """Test creating a new violation from policy evaluation."""

        service = ViolationDetectionService()
        violation_details = {
            "violation_key": "test_violation_001",
            "title": "Test Violation",
            "description": "Test violation description",
            "severity": ViolationSeverity.HIGH,
            "risk_score": 8.0,
        }

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None  # No existing violation
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch.object(service, "_log_violation_activity", AsyncMock()):
            violation = await service.create_violation_from_evaluation(
                mock_db, sample_policy_evaluation, violation_details
            )

        # Verify violation was created
        assert violation.violation_key == "test_violation_001"
        assert violation.title == "Test Violation"
        assert violation.severity == ViolationSeverity.HIGH
        assert violation.risk_score == 8.0
        assert violation.status == ViolationStatus.OPEN
        assert violation.recurrence_count == 1

        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_violation_from_evaluation_existing_violation(
        self, mock_db, sample_policy_evaluation, sample_violation
    ):
        """Test updating existing violation from policy evaluation."""

        service = ViolationDetectionService()
        violation_details = {
            "violation_key": sample_violation.violation_key,
            "title": "Updated Violation",
            "description": "Updated description",
        }

        # Mock database operations - find existing violation
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = sample_violation
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        with patch.object(service, "_log_violation_activity", AsyncMock()):
            violation = await service.create_violation_from_evaluation(
                mock_db, sample_policy_evaluation, violation_details
            )

        # Verify existing violation was updated
        assert violation.recurrence_count == 2  # Should be incremented
        assert violation.status == ViolationStatus.OPEN

        # Verify database operations
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_find_similar_violation(self, mock_db, sample_violation):
        """Test finding similar violations."""

        service = ViolationDetectionService()

        # Mock database query
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = sample_violation
        mock_db.execute.return_value = mock_result

        violation = await service._find_similar_violation(
            mock_db,
            sample_violation.policy_evaluation,
            {"violation_key": sample_violation.violation_key},
        )

        assert violation == sample_violation
        mock_db.execute.assert_called_once()


class TestViolationManagementService:
    """Test cases for ViolationManagementService."""

    @pytest.mark.asyncio
    async def test_acknowledge_violation(self, mock_db, sample_violation):
        """Test acknowledging a violation."""

        service = ViolationManagementService()
        user_id = uuid4()

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalar_one.return_value = sample_violation
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        with patch.object(service, "_create_activity", AsyncMock()):
            violation = await service.acknowledge_violation(
                mock_db, sample_violation.id, user_id, "Acknowledged violation"
            )

        assert violation.status == ViolationStatus.ACKNOWLEDGED
        assert violation.acknowledged_by == user_id
        assert violation.acknowledged_at is not None

    @pytest.mark.asyncio
    async def test_resolve_violation(self, mock_db, sample_violation):
        """Test resolving a violation."""

        service = ViolationManagementService()
        user_id = uuid4()

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalar_one.return_value = sample_violation
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        with patch.object(service, "_create_activity", AsyncMock()):
            violation = await service.resolve_violation(
                mock_db,
                sample_violation.id,
                user_id,
                "package_update",
                "Updated package",
            )

        assert violation.status == ViolationStatus.RESOLVED
        assert violation.resolved_by == user_id
        assert violation.resolved_at is not None

    @pytest.mark.asyncio
    async def test_mark_false_positive(self, mock_db, sample_violation):
        """Test marking violation as false positive."""

        service = ViolationManagementService()
        user_id = uuid4()
        reason = "Scanner misconfiguration"

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalar_one.return_value = sample_violation
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        with patch.object(service, "_create_activity", AsyncMock()):
            violation = await service.mark_false_positive(
                mock_db, sample_violation.id, user_id, reason
            )

        assert violation.status == ViolationStatus.FALSE_POSITIVE
        assert violation.false_positive_indicator is True
        assert violation.resolved_by == user_id
        assert violation.resolved_at is not None

    @pytest.mark.asyncio
    async def test_get_violations_for_project(self, mock_db, sample_violation):
        """Test getting violations for a project."""

        service = ViolationManagementService()
        project_id = sample_violation.project_id

        # Mock database operations
        mock_violations_result = AsyncMock()
        mock_violations_result.scalars.return_value.all.return_value = [
            sample_violation
        ]

        mock_count_result = AsyncMock()
        mock_count_result.scalar.return_value = 1

        mock_db.execute.side_effect = [mock_violations_result, mock_count_result]

        violations, total_count = await service.get_violations_for_project(
            mock_db, project_id
        )

        assert len(violations) == 1
        assert violations[0] == sample_violation
        assert total_count == 1

    @pytest.mark.asyncio
    async def test_get_overdue_violations(self, mock_db):
        """Test getting overdue violations."""

        service = ViolationManagementService()

        # Create overdue violation (older than SLA)
        overdue_violation = PolicyViolation(
            id=uuid4(),
            project_id=uuid4(),
            policy_id=uuid4(),
            violation_key="overdue_001",
            title="Overdue Violation",
            description="This violation is overdue",
            severity=ViolationSeverity.CRITICAL,
            status=ViolationStatus.OPEN,
            detected_at=datetime.utcnow()
            - timedelta(days=2),  # 2 days ago (critical SLA is 24h)
            risk_score=9.0,
        )

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [overdue_violation]
        mock_db.execute.return_value = mock_result

        overdue_violations = await service.get_overdue_violations(mock_db)

        assert len(overdue_violations) == 1
        assert overdue_violations[0].severity == ViolationSeverity.CRITICAL
        assert overdue_violations[0].sla_breached is True


class TestExceptionRequestService:
    """Test cases for ExceptionRequestService."""

    @pytest.mark.asyncio
    async def test_create_exception_request(self, mock_db):
        """Test creating an exception request."""

        service = ExceptionRequestService()
        project_id = uuid4()
        policy_id = uuid4()
        requester_id = uuid4()

        exception_data = {
            "exception_key": "exception_001",
            "title": "Test Exception",
            "description": "Test exception description",
            "exception_type": ExceptionType.TEMPORARY,
            "justification": "Business requirement",
            "duration_days": 30,
            "approval_required": True,
        }

        # Mock database operations
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with (
            patch.object(service, "_create_exception_activity", AsyncMock()),
            patch.object(
                service, "_initiate_approval_workflow", AsyncMock(return_value=uuid4())
            ),
        ):
            exception = await service.create_exception_request(
                mock_db, project_id, policy_id, requester_id, exception_data
            )

        # Verify exception was created
        assert exception.project_id == project_id
        assert exception.policy_id == policy_id
        assert exception.requester_id == requester_id
        assert exception.exception_type == ExceptionType.TEMPORARY
        assert exception.justification == "Business requirement"
        assert exception.duration_days == 30
        assert exception.approval_required is True
        assert exception.status == ExceptionStatus.PENDING

        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_exception_status_approve(
        self, mock_db, sample_exception_request
    ):
        """Test updating exception status to approved."""

        service = ExceptionRequestService()
        user_id = uuid4()
        reason = "Business justification approved"

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = sample_exception_request
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        with (
            patch.object(service, "_create_exception_activity", AsyncMock()),
            patch.object(service, "_update_violation_for_exception", AsyncMock()),
        ):
            exception = await service.update_exception_status(
                mock_db,
                sample_exception_request.id,
                ExceptionStatus.APPROVED,
                user_id,
                reason,
                [{"type": "monitoring", "frequency": "weekly"}],
            )

        assert exception.status == ExceptionStatus.APPROVED
        assert exception.decision == "approved"
        assert exception.decision_reason == reason
        assert exception.approver_id == user_id
        assert exception.decided_at is not None
        assert len(exception.approval_conditions) == 1

    @pytest.mark.asyncio
    async def test_get_active_exceptions(self, mock_db):
        """Test getting active exceptions."""

        service = ExceptionRequestService()

        # Create active exception
        active_exception = PolicyExceptionRequest(
            id=uuid4(),
            project_id=uuid4(),
            policy_id=uuid4(),
            requester_id=uuid4(),
            status=ExceptionStatus.APPROVED,
            end_date=datetime.utcnow() + timedelta(days=30),  # Expires in future
        )

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [active_exception]
        mock_db.execute.return_value = mock_result

        active_exceptions = await service.get_active_exceptions(mock_db)

        assert len(active_exceptions) == 1
        assert active_exceptions[0].status == ExceptionStatus.APPROVED
        assert active_exceptions[0].is_active is True

    @pytest.mark.asyncio
    async def test_get_exceptions_expiring_soon(self, mock_db):
        """Test getting exceptions expiring soon."""

        service = ExceptionRequestService()

        # Create exception expiring in 15 days
        expiring_exception = PolicyExceptionRequest(
            id=uuid4(),
            project_id=uuid4(),
            policy_id=uuid4(),
            requester_id=uuid4(),
            status=ExceptionStatus.APPROVED,
            end_date=datetime.utcnow() + timedelta(days=15),
        )

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [expiring_exception]
        mock_db.execute.return_value = mock_result

        expiring_exceptions = await service.get_exceptions_expiring_soon(
            mock_db, days_ahead=30
        )

        assert len(expiring_exceptions) == 1
        assert expiring_exceptions[0].days_until_expiry == 15

    @pytest.mark.asyncio
    async def test_cancel_exception_request(self, mock_db, sample_exception_request):
        """Test cancelling an exception request."""

        service = ExceptionRequestService()
        user_id = uuid4()
        reason = "No longer needed"

        # Mock that user can cancel
        sample_exception_request.requester_id = user_id
        sample_exception_request.status = ExceptionStatus.PENDING

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = sample_exception_request
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        with patch.object(service, "_create_exception_activity", AsyncMock()):
            exception = await service.cancel_exception_request(
                mock_db, sample_exception_request.id, user_id, reason
            )

        assert exception.status == ExceptionStatus.CANCELLED


class TestRemediationService:
    """Test cases for RemediationService."""

    @pytest.mark.asyncio
    async def test_create_remediation_plan(self, mock_db):
        """Test creating a remediation plan."""

        service = RemediationService()
        violation_id = uuid4()
        assigned_to_id = uuid4()

        remediation_data = {
            "remediation_type": "manual",
            "title": "Security Vulnerability Remediation",
            "description": "Update package to fixed version",
            "estimated_hours": 4.0,
            "steps_performed": [],
            "follow_up_required": True,
        }

        # Mock database operations
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch.object(service, "_update_violation_for_remediation", AsyncMock()):
            remediation = await service.create_remediation_plan(
                mock_db, violation_id, remediation_data, assigned_to_id
            )

        # Verify remediation was created
        assert remediation.violation_id == violation_id
        assert remediation.assigned_to_id == assigned_to_id
        assert remediation.remediation_type == "manual"
        assert remediation.title == "Security Vulnerability Remediation"
        assert remediation.estimated_hours == 4.0
        assert remediation.status == "in_progress"
        assert remediation.progress_percentage == 0
        assert remediation.follow_up_required is True

        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_remediation_progress_complete(self, mock_db):
        """Test updating remediation progress to completion."""

        service = RemediationService()
        remediation_id = uuid4()
        completed_by_id = uuid4()

        # Create remediation in progress
        remediation = ViolationRemediation(
            id=remediation_id,
            violation_id=uuid4(),
            status="in_progress",
            progress_percentage=50,
        )

        steps_completed = [
            {"step": "analyze_vulnerability", "completed_at": datetime.utcnow()},
            {"step": "test_fix", "completed_at": datetime.utcnow()},
            {"step": "deploy_fix", "completed_at": datetime.utcnow()},
        ]

        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = remediation
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch.object(service, "_update_violation_for_remediation", AsyncMock()):
            updated_remediation = await service.update_remediation_progress(
                mock_db, remediation_id, 100, steps_completed, completed_by_id
            )

        # Verify remediation was updated
        assert updated_remediation.progress_percentage == 100
        assert updated_remediation.status == "completed"
        assert updated_remediation.completed_by_id == completed_by_id
        assert updated_remediation.completed_at is not None
        assert len(updated_remediation.steps_performed) == 3


class TestViolationAnalyticsService:
    """Test cases for ViolationAnalyticsService."""

    @pytest.mark.asyncio
    async def test_get_violation_metrics(self, mock_db):
        """Test getting violation metrics."""

        service = ViolationAnalyticsService()
        project_id = uuid4()
        days_back = 30

        # Mock database queries
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = 25

        mock_status_result = AsyncMock()
        mock_status_result.all.return_value = [
            ("open", 10),
            ("resolved", 12),
            ("acknowledged", 3),
        ]

        mock_severity_result = AsyncMock()
        mock_severity_result.all.return_value = [
            ("critical", 2),
            ("high", 8),
            ("medium", 10),
            ("low", 5),
        ]

        mock_resolution_result = AsyncMock()
        mock_resolution_result.scalar.return_value = 48.5  # hours

        mock_exception_result = AsyncMock()
        mock_exception_result.all.return_value = [
            ("pending", 3),
            ("approved", 2),
            ("rejected", 1),
        ]

        mock_db.execute.side_effect = [
            mock_total_result,  # total violations
            mock_status_result,  # by status
            mock_severity_result,  # by severity
            mock_resolution_result,  # avg resolution time
            mock_exception_result,  # exceptions by status
        ]

        with patch.object(
            service, "get_overdue_violations", AsyncMock(return_value=[])
        ):
            metrics = await service.get_violation_metrics(
                mock_db, project_id, days_back
            )

        # Verify metrics
        assert metrics["period_days"] == days_back
        assert metrics["total_violations"] == 25
        assert metrics["violations_by_status"]["open"] == 10
        assert metrics["violations_by_status"]["resolved"] == 12
        assert metrics["violations_by_severity"]["critical"] == 2
        assert metrics["violations_by_severity"]["high"] == 8
        assert metrics["average_resolution_time_hours"] == 48.5
        assert metrics["overdue_violations_count"] == 0
        assert metrics["active_exception_requests"] == 3  # pending + under_review

    @pytest.mark.asyncio
    async def test_get_violation_trends(self, mock_db):
        """Test getting violation trends over time."""

        service = ViolationAnalyticsService()
        project_id = uuid4()
        days_back = 90

        # Mock database query result
        mock_result = AsyncMock()
        mock_result.all.return_value = [
            (datetime(2025, 1, 1), 5, "high"),
            (datetime(2025, 1, 1), 3, "medium"),
            (datetime(2025, 1, 8), 7, "high"),
            (datetime(2025, 1, 8), 4, "medium"),
            (datetime(2025, 1, 8), 2, "critical"),
        ]

        mock_db.execute.return_value = mock_result

        trends = await service.get_violation_trends(mock_db, project_id, days_back)

        # Verify trends
        assert len(trends) == 2  # Two weeks of data
        assert trends[0]["week"] == "2025-01-01T00:00:00"
        assert trends[0]["total"] == 8  # 5 + 3
        assert trends[0]["high"] == 5
        assert trends[0]["medium"] == 3

        assert trends[1]["week"] == "2025-01-08T00:00:00"
        assert trends[1]["total"] == 13  # 7 + 4 + 2
        assert trends[1]["critical"] == 2
        assert trends[1]["high"] == 7
        assert trends[1]["medium"] == 4

    @pytest.mark.asyncio
    async def test_get_top_violating_policies(self, mock_db):
        """Test getting policies with most violations."""

        service = ViolationAnalyticsService()
        project_id = uuid4()
        limit = 10

        # Create sample policies
        policy1 = Policy(id=uuid4(), name="Security Policy", rule_type="security")
        policy2 = Policy(id=uuid4(), name="License Policy", rule_type="license")

        # Mock database query result
        mock_result = AsyncMock()
        mock_result.all.return_value = [
            (PolicyViolation(id=uuid4()), policy1, 15),
            (PolicyViolation(id=uuid4()), policy2, 8),
        ]

        mock_db.execute.return_value = mock_result

        top_policies = await service.get_top_violating_policies(
            mock_db, project_id, limit, 30
        )

        # Verify results
        assert len(top_policies) == 2
        assert top_policies[0]["policy_name"] == "Security Policy"
        assert top_policies[0]["violation_count"] == 15
        assert top_policies[1]["policy_name"] == "License Policy"
        assert top_policies[1]["violation_count"] == 8


class TestPolicyExceptionWorkflow:
    """Test cases for PolicyExceptionWorkflow."""

    @pytest.fixture
    def workflow(self):
        """Create workflow instance for testing."""
        organization_id = uuid4()
        return PolicyExceptionWorkflow(organization_id)

    @pytest.fixture
    def workflow_state(self):
        """Create workflow state for testing."""
        return ExceptionWorkflowState(
            exception_request_id=uuid4(),
            project_id=uuid4(),
            policy_id=uuid4(),
            requester_id=uuid4(),
            exception_type=ExceptionType.TEMPORARY,
            justification="Business requirement",
            business_risk="Low risk",
        )

    @pytest.mark.asyncio
    async def test_workflow_auto_approval_low_risk(self, workflow, workflow_state):
        """Test workflow auto-approval for low risk exceptions."""

        # Set up low risk conditions
        workflow_state.exception_type = ExceptionType.ONE_TIME
        workflow_state.exception_data = {"duration_days": 1}

        # Mock services
        with (
            patch.object(workflow, "_validate_exception_request") as mock_validate,
            patch.object(workflow, "_is_low_risk_exception", return_value=True),
            patch.object(workflow, "_evaluate_auto_approval") as mock_auto_approval,
            patch.object(workflow, "_update_exception_request", AsyncMock()),
            patch.object(workflow, "_send_notifications", AsyncMock()),
        ):
            mock_validate.return_value = {"valid": True}
            mock_auto_approval.return_value = {
                "eligible": True,
                "reason": "Low risk one-time exception",
                "conditions": [{"type": "monitoring"}],
            }

            # Execute workflow
            result = await workflow.execute(
                workflow_state.exception_request_id, workflow_state.exception_data, {}
            )

        # Verify auto-approval
        assert result["final_decision"] == "approved"
        assert result["auto_approval_eligible"] is True
        assert "Low risk" in result["decision_reason"]

    @pytest.mark.asyncio
    async def test_workflow_risk_assessment_required(self, workflow, workflow_state):
        """Test workflow requiring risk assessment."""

        # Set up conditions requiring risk assessment
        workflow_state.exception_type = ExceptionType.PERMANENT

        # Mock services
        with (
            patch.object(workflow, "_validate_exception_request") as mock_validate,
            patch.object(workflow, "_is_low_risk_exception", return_value=False),
            patch.object(workflow, "_requires_risk_assessment", return_value=True),
            patch.object(workflow, "_calculate_risk_score", return_value=7.5),
            patch.object(workflow, "_initiate_approval_workflow", AsyncMock()),
            patch.object(workflow.approval_workflow, "execute") as mock_approval,
        ):
            mock_validate.return_value = {"valid": True}
            mock_approval.return_value = {
                "workflow_id": uuid4(),
                "status": "pending_approval",
            }

            # Execute workflow
            result = await workflow.execute(
                workflow_state.exception_request_id, workflow_state.exception_data, {}
            )

        # Verify risk assessment was performed
        assert result["risk_score"] == 7.5
        assert result["risk_level"] == "high"
        assert "approval_workflow_id" in result

    @pytest.mark.asyncio
    async def test_workflow_validation_failure(self, workflow, workflow_state):
        """Test workflow failure due to validation."""

        # Remove required field
        workflow_state.justification = None

        # Mock validation to fail
        with patch.object(workflow, "_validate_exception_request") as mock_validate:
            mock_validate.return_value = {
                "valid": False,
                "reason": "Justification is required",
            }

            # Execute workflow
            result = await workflow.execute(
                workflow_state.exception_request_id, workflow_state.exception_data, {}
            )

        # Verify rejection
        assert result["final_decision"] == "rejected"
        assert "Justification is required" in result["decision_reason"]

    @pytest.mark.asyncio
    async def test_calculate_risk_score(self, workflow, workflow_state):
        """Test risk score calculation."""

        # Set up different exception types
        test_cases = [
            {
                "exception_type": ExceptionType.ONE_TIME,
                "business_risk": None,
                "duration_days": None,
                "expected_score": 1.0,  # Base score for one-time
            },
            {
                "exception_type": ExceptionType.TEMPORARY,
                "business_risk": "Medium risk",
                "duration_days": 15,
                "expected_score": 4.0,  # Base 2 + duration 1 + business risk 2
            },
            {
                "exception_type": ExceptionType.PERMANENT,
                "business_risk": "Critical risk",
                "duration_days": None,
                "expected_score": 10.0,  # Base 6 + business risk 4 (capped at 10)
            },
        ]

        for case in test_cases:
            workflow_state.exception_type = case["exception_type"]
            workflow_state.business_risk = case["business_risk"]
            workflow_state.exception_data = {"duration_days": case["duration_days"]}

            risk_score = await workflow._calculate_risk_score(workflow_state)

            # Verify risk score (within small margin due to policy severity addition)
            assert abs(risk_score - case["expected_score"]) <= 2.0

    def test_route_after_initialization(self, workflow):
        """Test workflow routing after initialization."""

        # Test auto-approval route
        state = ExceptionWorkflowState(
            exception_type=ExceptionType.ONE_TIME, final_decision=None
        )

        with patch.object(workflow, "_is_low_risk_exception", return_value=True):
            route = workflow._route_after_initialization(state)
            assert route == "auto_approval"

        # Test rejection route
        state.final_decision = "rejected"
        route = workflow._route_after_initialization(state)
        assert route == "reject"

        # Test risk assessment route
        state.final_decision = None
        with (
            patch.object(workflow, "_is_low_risk_exception", return_value=False),
            patch.object(workflow, "_requires_risk_assessment", return_value=True),
        ):
            route = workflow._route_after_initialization(state)
            assert route == "risk_assessment"

    def test_is_low_risk_exception(self, workflow):
        """Test low risk exception detection."""

        # Test one-time exception (low risk)
        state = ExceptionWorkflowState(
            exception_type=ExceptionType.ONE_TIME, exception_data={}
        )
        assert workflow._is_low_risk_exception(state) is True

        # Test short temporary exception (low risk)
        state.exception_type = ExceptionType.TEMPORARY
        state.exception_data = {"duration_days": 5}
        assert workflow._is_low_risk_exception(state) is True

        # Test long temporary exception (not low risk)
        state.exception_data = {"duration_days": 45}
        assert workflow._is_low_risk_exception(state) is False

        # Test permanent exception (not low risk)
        state.exception_type = ExceptionType.PERMANENT
        assert workflow._is_low_risk_exception(state) is False
