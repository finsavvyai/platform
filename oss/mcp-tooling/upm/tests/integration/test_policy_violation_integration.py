"""
Integration Tests for Policy Violation Management and Exception Workflow

End-to-end testing of the complete policy violation and exception
request flow with real database interactions.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from udp.core.models.violation import (
    ExceptionStatus,
    ExceptionType,
    PolicyExceptionRequest,
    PolicyViolation,
    ViolationSeverity,
    ViolationStatus,
)
from udp.core.models.policy import Policy, PolicyEvaluation, PolicyEvaluationStatus
from udp.core.models.project import Project
from udp.services.violation_service import (
    ExceptionRequestService,
    ViolationDetectionService,
    ViolationManagementService,
)
from udp.workflows.policy_exception_workflow import PolicyExceptionWorkflow


@pytest.mark.integration
class TestPolicyViolationIntegration:
    """Integration tests for policy violation management."""

    @pytest.fixture(scope="class")
    async def db_session(self):
        """Create database session for integration tests."""
        # This would use test database configuration
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        # Create all tables
        from udp.core.models.base import Base

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Create session
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        yield async_session

        # Cleanup
        await engine.dispose()

    @pytest.fixture
    async def sample_project(self, db_session):
        """Create sample project for testing."""
        project = Project(
            id=uuid4(),
            organization_id=uuid4(),
            name="Test Project",
            slug="test-project",
            primary_language="python",
            ecosystem="pypi",
        )

        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        return project

    @pytest.fixture
    async def sample_policy(self, db_session):
        """Create sample policy for testing."""
        policy = Policy(
            id=uuid4(),
            name="Security Policy",
            description="Policy for security vulnerabilities",
            rule_type="security",
            severity="high",
            is_active=True,
            conditions={
                "field": "vulnerability.severity",
                "operator": "eq",
                "value": "critical",
            },
            actions=[
                {"type": "block", "description": "Block critical vulnerabilities"}
            ],
        )

        db_session.add(policy)
        await db_session.commit()
        await db_session.refresh(policy)

        return policy

    @pytest.fixture
    async def sample_evaluation(self, db_session, sample_project, sample_policy):
        """Create sample policy evaluation."""
        evaluation = PolicyEvaluation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            status=PolicyEvaluationStatus.FAIL,
            violation_detected=True,
            violation_severity="critical",
            result_message="Critical security vulnerability detected",
            evaluation_details={
                "vulnerability": {
                    "cve_id": "CVE-2025-0001",
                    "severity": "critical",
                    "cvss_score": 9.8,
                }
            },
        )

        db_session.add(evaluation)
        await db_session.commit()
        await db_session.refresh(evaluation)

        return evaluation

    @pytest.mark.asyncio
    async def test_complete_violation_lifecycle(
        self, db_session, sample_project, sample_policy, sample_evaluation
    ):
        """Test complete violation lifecycle from detection to resolution."""

        # Step 1: Detect and create violation
        detection_service = ViolationDetectionService()

        violation_details = {
            "violation_key": "cve_2025_0001",
            "title": "Critical Security Vulnerability",
            "description": "Package has critical CVE-2025-0001",
            "severity": ViolationSeverity.CRITICAL,
            "category": "security",
            "risk_score": 9.8,
            "business_impact": "Potential data breach",
            "technical_impact": "Remote code execution",
            "affected_components": ["api-server", "database"],
            "remediation_required": True,
            "remediation_type": "package_update",
            "remediation_steps": [
                {"step": "Update package", "action": "pip install --upgrade"},
                {"step": "Test application", "action": "run tests"},
                {"step": "Deploy fix", "action": "deploy to production"},
            ],
            "remediation_complexity": "medium",
            "estimated_remediation_hours": 8,
            "detection_source": "security_scan",
        }

        violation = await detection_service.create_violation_from_evaluation(
            db_session, sample_evaluation, violation_details
        )

        # Verify violation creation
        assert violation.id is not None
        assert violation.project_id == sample_project.id
        assert violation.policy_id == sample_policy.id
        assert violation.violation_key == "cve_2025_0001"
        assert violation.severity == ViolationSeverity.CRITICAL
        assert violation.status == ViolationStatus.OPEN
        assert violation.risk_score == 9.8
        assert violation.remediation_required is True

        # Step 2: Acknowledge violation
        management_service = ViolationManagementService()
        user_id = uuid4()

        acknowledged_violation = await management_service.acknowledge_violation(
            db_session, violation.id, user_id, "Acknowledged critical vulnerability"
        )

        # Verify acknowledgment
        assert acknowledged_violation.status == ViolationStatus.ACKNOWLEDGED
        assert acknowledged_violation.acknowledged_by == user_id
        assert acknowledged_violation.acknowledged_at is not None

        # Step 3: Request exception (if needed)
        if violation.exception_requestable:
            exception_service = ExceptionRequestService()

            exception_data = {
                "exception_key": "exception_cve_2025_0001",
                "title": "Exception for CVE-2025-0001",
                "description": "Request exception while migration is in progress",
                "exception_type": ExceptionType.TEMPORARY,
                "justification": (
                    "Critical for business operations, fix planned for next release cycle. "
                    "Mitigation measures in place to reduce risk."
                ),
                "business_risk": "High risk to operations if blocked",
                "mitigation_plan": (
                    "Additional monitoring, network segmentation, and access controls "
                    "implemented to mitigate risk until fix is deployed."
                ),
                "duration_days": 30,
                "approval_required": True,
                "risk_assessment": {
                    "probability": "low",
                    "impact": "high",
                    "risk_score": 6.5,
                },
            }

            exception = await exception_service.create_exception_request(
                db_session,
                sample_project.id,
                sample_policy.id,
                user_id,
                exception_data,
                violation.id,
            )

            # Verify exception creation
            assert exception.id is not None
            assert exception.project_id == sample_project.id
            assert exception.policy_id == sample_policy.id
            assert exception.violation_id == violation.id
            assert exception.exception_type == ExceptionType.TEMPORARY
            assert exception.status == ExceptionStatus.PENDING
            assert exception.approval_required is True

            # Step 4: Process exception request through workflow
            workflow = PolicyExceptionWorkflow(sample_project.organization_id)

            # Mock approval workflow for integration test
            with patch.object(workflow.approval_workflow, "execute") as mock_approval:
                mock_approval.return_value = {
                    "workflow_id": uuid4(),
                    "status": "completed",
                    "final_decision": "approved",
                    "decision_rationale": "Business justification approved with conditions",
                    "approval_conditions": [
                        {
                            "type": "monitoring",
                            "description": "Daily security monitoring required",
                        },
                        {
                            "type": "documentation",
                            "description": "Document mitigation measures",
                        },
                    ],
                }

                workflow_result = await workflow.execute(
                    exception.id,
                    {
                        "project_id": sample_project.id,
                        "policy_id": sample_policy.id,
                        "violation_id": violation.id,
                        "requester_id": user_id,
                        "exception_type": exception.exception_type,
                        "justification": exception.justification,
                        "business_risk": exception.business_risk,
                    },
                    {},
                )

                # Verify workflow results
                assert workflow_result["final_decision"] == "approved"
                assert len(workflow_result["approval_conditions"]) == 2

            # Update exception status based on workflow
            approved_exception = await exception_service.update_exception_status(
                db_session,
                exception.id,
                ExceptionStatus.APPROVED,
                user_id,
                "Approved with monitoring conditions",
                workflow_result["approval_conditions"],
            )

            # Verify exception approval
            assert approved_exception.status == ExceptionStatus.APPROVED
            assert approved_exception.decision == "approved"
            assert approved_exception.decision_reason is not None
            assert len(approved_exception.approval_conditions) > 0

        # Step 5: Create remediation plan
        from udp.services.violation_service import RemediationService

        remediation_service = RemediationService()
        assigned_user_id = uuid4()

        remediation_data = {
            "remediation_type": "package_update",
            "title": "Update vulnerable package",
            "description": "Update package to version without CVE-2025-0001",
            "estimated_hours": 8,
            "steps_performed": [],
            "follow_up_required": True,
            "follow_up_actions": [
                {
                    "action": "Verify fix works",
                    "due_date": datetime.utcnow() + timedelta(days=7),
                },
                {
                    "action": "Run security scan",
                    "due_date": datetime.utcnow() + timedelta(days=1),
                },
            ],
            "next_review_date": datetime.utcnow() + timedelta(days=3),
        }

        remediation = await remediation_service.create_remediation_plan(
            db_session, violation.id, remediation_data, assigned_user_id
        )

        # Verify remediation creation
        assert remediation.id is not None
        assert remediation.violation_id == violation.id
        assert remediation.assigned_to_id == assigned_user_id
        assert remediation.remediation_type == "package_update"
        assert remediation.status == "in_progress"
        assert remediation.progress_percentage == 0

        # Step 6: Update remediation progress
        steps_completed = [
            {
                "step": "Update package",
                "completed_at": datetime.utcnow(),
                "details": "Updated package from 1.0.0 to 1.0.1",
            },
            {
                "step": "Run tests",
                "completed_at": datetime.utcnow(),
                "details": "All tests passed successfully",
            },
            {
                "step": "Deploy to staging",
                "completed_at": datetime.utcnow(),
                "details": "Deployed to staging for verification",
            },
        ]

        updated_remediation = await remediation_service.update_remediation_progress(
            db_session,
            remediation.id,
            75,  # 75% complete
            steps_completed,
            assigned_user_id,
        )

        # Verify progress update
        assert updated_remediation.progress_percentage == 75
        assert len(updated_remediation.steps_performed) == 3

        # Step 7: Complete remediation
        final_steps = steps_completed + [
            {
                "step": "Deploy to production",
                "completed_at": datetime.utcnow(),
                "details": "Successfully deployed to production",
            },
            {
                "step": "Verify fix",
                "completed_at": datetime.utcnow(),
                "details": "Security scan confirms vulnerability is resolved",
            },
        ]

        completed_remediation = await remediation_service.update_remediation_progress(
            db_session,
            remediation.id,
            100,  # 100% complete
            final_steps,
            assigned_user_id,
        )

        # Verify completion
        assert completed_remediation.status == "completed"
        assert completed_remediation.progress_percentage == 100
        assert completed_remediation.completed_at is not None
        assert completed_remediation.completed_by_id == assigned_user_id

        # Step 8: Resolve violation
        resolved_violation = await management_service.resolve_violation(
            db_session,
            violation.id,
            user_id,
            "package_update",
            "Successfully updated package and verified fix",
        )

        # Verify resolution
        assert resolved_violation.status == ViolationStatus.RESOLVED
        assert resolved_violation.resolved_by == user_id
        assert resolved_violation.resolved_at is not None

        # Verify complete lifecycle
        assert resolved_violation.age_days >= 0
        assert resolved_violation.is_active is False
        assert (
            resolved_violation.is_critical is True
        )  # Still was critical even if resolved

    @pytest.mark.asyncio
    async def test_violation_with_exception_workflow(
        self, db_session, sample_project, sample_policy
    ):
        """Test violation handling with exception approval workflow."""

        # Create violation that requires exception
        detection_service = ViolationDetectionService()

        violation_details = {
            "violation_key": "license_compliance_001",
            "title": "License Compliance Issue",
            "description": "Package uses non-compliant license",
            "severity": ViolationSeverity.MEDIUM,
            "category": "license",
            "risk_score": 5.5,
            "exception_requestable": True,
            "remediation_required": False,  # Can be handled via exception
        }

        # Create mock evaluation
        evaluation = PolicyEvaluation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            status=PolicyEvaluationStatus.FAIL,
            violation_detected=True,
            violation_severity="medium",
            result_message="License compliance violation",
        )

        db_session.add(evaluation)
        await db_session.commit()

        # Create violation
        violation = await detection_service.create_violation_from_evaluation(
            db_session, evaluation, violation_details
        )

        # Create exception request
        exception_service = ExceptionRequestService()
        user_id = uuid4()

        exception_data = {
            "exception_key": "license_exception_001",
            "title": "License Exception for Open Source Component",
            "description": "Request exception for widely used open source component",
            "exception_type": ExceptionType.PERMANENT,
            "justification": (
                "This is a critical open source component with no suitable alternatives. "
                "The license is permissive for our use case and legal has reviewed."
            ),
            "business_risk": "Low risk, license is compatible with our business model",
            "mitigation_plan": (
                "Document usage, ensure compliance with license terms, and monitor "
                "for any license changes in future versions."
            ),
            "approval_required": True,
            "required_approvers": ["legal_counsel", "security_officer"],
            "risk_assessment": {
                "legal_review": "completed",
                "license_compatibility": "confirmed",
                "risk_score": 3.0,
            },
        }

        exception = await exception_service.create_exception_request(
            db_session,
            sample_project.id,
            sample_policy.id,
            user_id,
            exception_data,
            violation.id,
        )

        # Verify exception was created and requires approval
        assert exception.exception_type == ExceptionType.PERMANENT
        assert exception.approval_required is True
        assert "legal_counsel" in exception.required_approvers
        assert "security_officer" in exception.required_approvers

        # Process through approval workflow
        workflow = PolicyExceptionWorkflow(sample_project.organization_id)

        # Simulate multi-step approval process
        with patch.object(workflow.approval_workflow, "execute") as mock_approval:
            # First return pending approval
            mock_approval.return_value = {
                "workflow_id": uuid4(),
                "status": "pending_approval",
                "current_step": "legal_counsel_review",
            }

            workflow_result = await workflow.execute(
                exception.id,
                {
                    "project_id": sample_project.id,
                    "policy_id": sample_policy.id,
                    "violation_id": violation.id,
                    "requester_id": user_id,
                    "exception_type": exception.exception_type,
                    "justification": exception.justification,
                    "business_risk": exception.business_risk,
                },
                {},
            )

            # Verify workflow is pending
            assert workflow_result["status"] == "pending_approval"
            assert "approval_workflow_id" in workflow_result

    @pytest.mark.asyncio
    async def test_violation_analytics(self, db_session, sample_project, sample_policy):
        """Test violation analytics and reporting."""

        from udp.services.violation_service import ViolationAnalyticsService

        # Create multiple violations for analytics testing
        detection_service = ViolationDetectionService()
        analytics_service = ViolationAnalyticsService()

        violations = []
        severities = [
            (ViolationSeverity.CRITICAL, 2),
            (ViolationSeverity.HIGH, 5),
            (ViolationSeverity.MEDIUM, 8),
            (ViolationSeverity.LOW, 3),
        ]

        for severity, count in severities:
            for i in range(count):
                evaluation = PolicyEvaluation(
                    id=uuid4(),
                    project_id=sample_project.id,
                    policy_id=sample_policy.id,
                    status=PolicyEvaluationStatus.FAIL,
                    violation_detected=True,
                    violation_severity=severity.value,
                    result_message=f"Violation {severity} {i + 1}",
                )

                db_session.add(evaluation)
                await db_session.commit()

                violation_details = {
                    "violation_key": f"{severity}_violation_{i + 1}",
                    "title": f"{severity.title()} Violation {i + 1}",
                    "description": f"Test {severity} violation",
                    "severity": severity,
                    "risk_score": {"critical": 9, "high": 7, "medium": 5, "low": 3}[
                        severity
                    ],
                }

                # Create some as resolved for variety
                if i % 3 == 0:
                    violation_details["status"] = ViolationStatus.RESOLVED
                    violation_details["resolved_at"] = datetime.utcnow() - timedelta(
                        days=i
                    )
                    violation_details["resolved_by"] = uuid4()

                violation = await detection_service.create_violation_from_evaluation(
                    db_session, evaluation, violation_details
                )
                violations.append(violation)

        # Test metrics
        metrics = await analytics_service.get_violation_metrics(
            db_session, sample_project.id, days_back=30
        )

        # Verify metrics
        assert metrics["total_violations"] == len(violations)
        assert metrics["violations_by_severity"]["critical"] == 2
        assert metrics["violations_by_severity"]["high"] == 5
        assert metrics["violations_by_severity"]["medium"] == 8
        assert metrics["violations_by_severity"]["low"] == 3

        # Should have some resolved violations
        assert metrics["violations_by_status"]["resolved"] > 0

        # Test trends
        trends = await analytics_service.get_violation_trends(
            db_session, sample_project.id, days_back=30
        )

        # Verify trends structure
        assert isinstance(trends, list)
        if trends:  # If we have data in the date range
            assert "week" in trends[0]
            assert "total" in trends[0]

        # Test top violating policies
        top_policies = await analytics_service.get_top_violating_policies(
            db_session, sample_project.id, limit=5, days_back=30
        )

        # Verify our policy is top
        assert len(top_policies) > 0
        assert any(p["policy_id"] == str(sample_policy.id) for p in top_policies)
        assert all("violation_count" in p for p in top_policies)
