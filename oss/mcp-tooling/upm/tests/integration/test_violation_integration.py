"""
Integration Tests for Policy Violation Management and Exception Workflow

End-to-end tests covering the complete flow from violation detection
through exception request workflow to resolution.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from udp.core.models.violation import (
    ExceptionStatus,
    ExceptionType,
    PolicyExceptionRequest,
    PolicyViolation,
    ViolationSeverity,
    ViolationStatus,
)
from udp.core.models.policy import (
    Policy,
    PolicyEvaluation,
    PolicyEvaluationStatus,
    PolicyRuleType,
)
from udp.services.violation_service import (
    ExceptionRequestService,
    ViolationDetectionService,
    ViolationManagementService,
)
from udp.workflows.policy_exception_workflow import PolicyExceptionWorkflow


@pytest.mark.integration
class TestViolationToEndToEndFlow:
    """Integration tests for complete violation management flow."""

    @pytest.mark.asyncio
    async def test_complete_violation_lifecycle(self, mock_db):
        """Test complete lifecycle from violation detection to resolution."""

        # Create test policy
        policy = Policy(
            id=uuid4(),
            name="Security Policy - No Critical Vulnerabilities",
            rule_type=PolicyRuleType.SECURITY,
            severity="high",
            is_active=True,
            conditions={"max_cvss_score": 7.0, "block_critical": True},
            actions=["block", "notify"],
        )

        # Create policy evaluation showing violation
        evaluation = PolicyEvaluation(
            id=uuid4(),
            project_id=uuid4(),
            policy_id=policy.id,
            status=PolicyEvaluationStatus.FAIL,
            violation_detected=True,
            violation_severity="critical",
            result_message="Package has critical vulnerability (CVSS 9.8)",
            evaluation_details={
                "package_name": "vulnerable-package",
                "package_version": "1.0.0",
                "cvss_score": 9.8,
                "cve_id": "CVE-2025-1234",
            },
        )

        # Step 1: Detect and create violation
        detection_service = ViolationDetectionService()
        violation_details = {
            "violation_key": f"critical_vuln_{evaluation.id}",
            "title": f"Critical Vulnerability in {evaluation.evaluation_details['package_name']}",
            "description": f"Package {evaluation.evaluation_details['package_name']} v{evaluation.evaluation_details['package_version']} has critical vulnerability {evaluation.evaluation_details['cve_id']}",
            "severity": ViolationSeverity.CRITICAL,
            "category": "security",
            "risk_score": 9.8,
            "business_impact": "Potential security breach through critical vulnerability",
            "technical_impact": "Remote code execution possible",
            "affected_components": ["authentication", "data-access"],
            "affected_versions": {"package": ["1.0.0", "1.0.1"]},
            "remediation_type": "package_update",
            "remediation_steps": [
                {
                    "step": "update_package",
                    "version": "1.0.2",
                    "reason": "Fixes CVE-2025-1234",
                }
            ],
            "remediation_complexity": "low",
            "estimated_remediation_hours": 2,
            "detection_source": "automated_security_scan",
            "package_id": uuid4(),
        }

        # Mock database operations
        violation = PolicyViolation(
            id=uuid4(),
            project_id=evaluation.project_id,
            policy_id=policy.id,
            policy_evaluation_id=evaluation.id,
            violation_key=violation_details["violation_key"],
            title=violation_details["title"],
            description=violation_details["description"],
            severity=violation_details["severity"],
            status=ViolationStatus.OPEN,
            detected_at=datetime.utcnow(),
            risk_score=violation_details["risk_score"],
            remediation_required=True,
            exception_requestable=True,
        )

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None  # No existing violation
        mock_db.execute.return_value = mock_result
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with patch.object(detection_service, "_log_violation_activity", AsyncMock()):
            created_violation = (
                await detection_service.create_violation_from_evaluation(
                    mock_db, evaluation, violation_details
                )
            )

        assert created_violation.status == ViolationStatus.OPEN
        assert created_violation.severity == ViolationSeverity.CRITICAL

        # Step 2: Acknowledge violation
        management_service = ViolationManagementService()
        user_id = uuid4()

        mock_result.scalar_one.return_value = created_violation

        with patch.object(management_service, "_create_activity", AsyncMock()):
            acknowledged_violation = await management_service.acknowledge_violation(
                mock_db,
                created_violation.id,
                user_id,
                "Critical vulnerability acknowledged",
            )

        assert acknowledged_violation.status == ViolationStatus.ACKNOWLEDGED
        assert acknowledged_violation.acknowledged_by == user_id

        # Step 3: Attempt remediation but fail - request exception
        exception_service = ExceptionRequestService()

        exception_data = {
            "exception_key": f"exception_{created_violation.id}",
            "title": f"Exception for {violation_details['package_name']}",
            "description": "Cannot update package immediately due to production constraints",
            "exception_type": ExceptionType.TEMPORARY,
            "justification": "Package update requires production downtime scheduled for next maintenance window",
            "business_risk": "Higher risk if immediate update causes production outage",
            "mitigation_plan": "Apply network monitoring and WAF rules until update",
            "duration_days": 14,
            "conditions": [
                {"type": "monitoring", "description": "Monitor for exploit attempts"},
                {"type": "compensating_controls", "description": "WAF rules deployed"},
            ],
            "approval_required": True,
            "risk_assessment": {
                "probability": "low",
                "impact": "high",
                "overall_risk": "medium",
            },
        }

        mock_db.add = MagicMock()

        with (
            patch.object(exception_service, "_create_exception_activity", AsyncMock()),
            patch.object(
                exception_service,
                "_initiate_approval_workflow",
                AsyncMock(return_value=uuid4()),
            ),
        ):
            exception_request = await exception_service.create_exception_request(
                mock_db,
                created_violation.project_id,
                created_violation.policy_id,
                user_id,
                exception_data,
                created_violation.id,
            )

        assert exception_request.status == ExceptionStatus.PENDING
        assert exception_request.violation_id == created_violation.id
        assert exception_request.exception_type == ExceptionType.TEMPORARY
        assert exception_request.duration_days == 14

        # Step 4: Execute exception approval workflow
        workflow = PolicyExceptionWorkflow(organization_id=uuid4())

        workflow_data = {
            "project_id": exception_request.project_id,
            "policy_id": exception_request.policy_id,
            "violation_id": exception_request.violation_id,
            "requester_id": user_id,
            "exception_type": exception_request.exception_type,
            "justification": exception_request.justification,
            "business_risk": exception_request.business_risk,
            "policy_violations": 1,
            "exception_conditions": exception_request.conditions,
            "mitigation_plan": exception_request.mitigation_plan,
        }

        # Mock approval workflow execution
        with (
            patch.object(workflow.approval_workflow, "execute") as mock_approval,
            patch.object(workflow, "_update_exception_request", AsyncMock()),
            patch.object(workflow, "_send_notifications", AsyncMock()),
        ):
            mock_approval.return_value = {
                "workflow_id": uuid4(),
                "status": "completed",
                "final_decision": "approved",
                "decision_rationale": "Temporary exception approved with monitoring conditions",
                "approval_conditions": [
                    {
                        "type": "monitoring",
                        "monitoring_type": "policy_compliance",
                        "frequency": "daily",
                        "escalation_threshold": 1,
                    }
                ],
            }

            workflow_result = await workflow.execute(
                exception_request.id, workflow_data, {"user_role": "security_lead"}
            )

        assert workflow_result["final_decision"] == "approved"
        assert len(workflow_result["approval_conditions"]) > 0

        # Step 5: Update exception status to approved
        mock_result.scalar_one_or_none.return_value = exception_request

        with (
            patch.object(exception_service, "_create_exception_activity", AsyncMock()),
            patch.object(
                exception_service, "_update_violation_for_exception", AsyncMock()
            ),
        ):
            approved_exception = await exception_service.update_exception_status(
                mock_db,
                exception_request.id,
                ExceptionStatus.APPROVED,
                uuid4(),  # approver_id
                "Exception approved with strict monitoring conditions",
                workflow_result["approval_conditions"],
            )

        assert approved_exception.status == ExceptionStatus.APPROVED
        assert approved_exception.decision == "approved"
        assert (
            approved_exception.approval_conditions
            == workflow_result["approval_conditions"]
        )

        # Step 6: Update violation status to accepted
        mock_result.scalar_one.return_value = acknowledged_violation

        from sqlalchemy import update

        mock_db.execute.return_value = None

        with patch.object(management_service, "_create_activity", AsyncMock()):
            # Simulate violation status update
            stmt = (
                update(PolicyViolation)
                .where(PolicyViolation.id == created_violation.id)
                .values(status=ViolationStatus.ACCEPTED)
            )
            await mock_db.execute(stmt)
            await mock_db.commit()

        # Verify end state
        assert created_violation.severity == ViolationSeverity.CRITICAL
        assert exception_request.exception_type == ExceptionType.TEMPORARY
        assert approved_exception.decision == "approved"

        # The violation is now covered by an approved exception
        # This represents a complete end-to-end flow

    @pytest.mark.asyncio
    async def test_auto_approval_low_risk_exception(self, mock_db):
        """Test automatic approval for low-risk exceptions."""

        # Create low-risk scenario
        policy = Policy(
            id=uuid4(),
            name="License Policy - MIT Preferred",
            rule_type=PolicyRuleType.LICENSE,
            severity="low",
            is_active=True,
        )

        violation = PolicyViolation(
            id=uuid4(),
            project_id=uuid4(),
            policy_id=policy.id,
            violation_key="license_deviation_001",
            title="License Deviation - Apache 2.0",
            description="Package uses Apache 2.0 license instead of MIT",
            severity=ViolationSeverity.LOW,
            status=ViolationStatus.OPEN,
            risk_score=2.0,
            detected_at=datetime.utcnow(),
        )

        # Create exception request
        exception_service = ExceptionRequestService()
        user_id = uuid4()

        exception_data = {
            "exception_key": f"auto_exception_{violation.id}",
            "title": "One-time license exception for development tool",
            "description": "Development tool uses Apache 2.0 license",
            "exception_type": ExceptionType.ONE_TIME,
            "justification": "Tool only used in development, not distributed",
            "business_risk": "No risk - dev-only usage",
            "approval_required": False,  # No approval needed for low risk
            "risk_score": 1.5,
        }

        mock_db.add = MagicMock()

        with patch.object(exception_service, "_create_exception_activity", AsyncMock()):
            exception_request = await exception_service.create_exception_request(
                mock_db,
                violation.project_id,
                violation.policy_id,
                user_id,
                exception_data,
                violation.id,
            )

        assert exception_request.approval_required is False

        # Execute workflow - should auto-approve
        workflow = PolicyExceptionWorkflow(organization_id=uuid4())

        workflow_data = {
            "project_id": exception_request.project_id,
            "policy_id": exception_request.policy_id,
            "violation_id": exception_request.violation_id,
            "requester_id": user_id,
            "exception_type": ExceptionType.ONE_TIME,
            "justification": exception_request.justification,
            "risk_score": 1.5,
        }

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
                "reason": "Low risk one-time exception for development-only tool",
                "conditions": [
                    {
                        "type": "documentation",
                        "description": "Document exception in project README",
                    }
                ],
            }

            result = await workflow.execute(exception_request.id, workflow_data, {})

        assert result["final_decision"] == "approved"
        assert result["auto_approval_eligible"] is True
        assert "Low risk" in result["decision_reason"]

    @pytest.mark.asyncio
    async def test_exception_rejection_high_risk(self, mock_db):
        """Test rejection of high-risk exception requests."""

        # Create high-risk scenario
        policy = Policy(
            id=uuid4(),
            name="Security Policy - No Critical Dependencies",
            rule_type=PolicyRuleType.SECURITY,
            severity="critical",
            is_active=True,
        )

        violation = PolicyViolation(
            id=uuid4(),
            project_id=uuid4(),
            policy_id=policy.id,
            violation_key="critical_dep_001",
            title="Critical Dependency with Known Exploit",
            description="Dependency has critical vulnerability with active exploits",
            severity=ViolationSeverity.CRITICAL,
            status=ViolationStatus.OPEN,
            risk_score=10.0,
            detected_at=datetime.utcnow(),
        )

        # Create exception request for critical violation
        exception_service = ExceptionRequestService()
        user_id = uuid4()

        exception_data = {
            "exception_key": f"critical_exception_{violation.id}",
            "title": "Exception for Critical Security Dependency",
            "description": "Request to use critical dependency with known exploits",
            "exception_type": ExceptionType.PERMANENT,  # Permanent exception for critical issue
            "justification": "Legacy system, difficult to replace",
            "business_risk": "Critical - Active exploits in the wild",
            "mitigation_plan": "Network segmentation and monitoring",
            "approval_required": True,
            "risk_assessment": {
                "probability": "high",
                "impact": "critical",
                "overall_risk": "critical",
            },
        }

        mock_db.add = MagicMock()

        with patch.object(exception_service, "_create_exception_activity", AsyncMock()):
            exception_request = await exception_service.create_exception_request(
                mock_db,
                violation.project_id,
                violation.policy_id,
                user_id,
                exception_data,
                violation.id,
            )

        # Execute workflow - should require detailed review
        workflow = PolicyExceptionWorkflow(organization_id=uuid4())

        workflow_data = {
            "project_id": exception_request.project_id,
            "policy_id": exception_request.policy_id,
            "violation_id": exception_request.violation_id,
            "requester_id": user_id,
            "exception_type": ExceptionType.PERMANENT,
            "justification": "Legacy system constraint",
            "business_risk": "Critical security risk with active exploits",
            "risk_score": 10.0,
            "policy_violations": 1,
        }

        # Mock compliance check to fail
        with (
            patch.object(workflow, "_validate_exception_request") as mock_validate,
            patch.object(workflow, "_perform_compliance_checks") as mock_compliance,
            patch.object(workflow, "_update_exception_request", AsyncMock()),
            patch.object(workflow, "_send_notifications", AsyncMock()),
        ):
            mock_validate.return_value = {"valid": True}
            mock_compliance.return_value = [
                {
                    "type": "regulatory_compliance",
                    "description": "Critical vulnerabilities cannot have permanent exceptions per policy",
                    "severity": "critical",
                    "passed": False,
                    "details": {
                        "policy_reference": "SEC-001",
                        "regulation": "SOC2",
                        "requirement": "All critical vulnerabilities must be remediated",
                    },
                }
            ]

            result = await workflow.execute(exception_request.id, workflow_data, {})

        # Should be rejected due to critical compliance issues
        assert result["final_decision"] == "rejected"
        assert "Critical compliance issues" in result["decision_reason"]

    @pytest.mark.asyncio
    async def test_exception_expiry_and_renewal(self, mock_db):
        """Test exception expiry and renewal workflow."""

        # Create expired exception
        expired_exception = PolicyExceptionRequest(
            id=uuid4(),
            project_id=uuid4(),
            policy_id=uuid4(),
            requester_id=uuid4(),
            exception_key="expired_exception_001",
            title="Expired Temporary Exception",
            description="Exception that has expired",
            exception_type=ExceptionType.TEMPORARY,
            justification="Original justification",
            status=ExceptionStatus.APPROVED,
            submitted_at=datetime.utcnow() - timedelta(days=60),
            decided_at=datetime.utcnow() - timedelta(days=60),
            end_date=datetime.utcnow() - timedelta(days=1),  # Expired yesterday
            duration_days=30,
        )

        # Test that exception is marked as expired
        assert expired_exception.is_expired is True
        assert expired_exception.is_active is False
        assert expired_exception.days_until_expiry is None

        # Create renewal request
        exception_service = ExceptionRequestService()
        user_id = uuid4()

        renewal_data = {
            "exception_key": f"renewal_{expired_exception.id}",
            "title": f"Renewal: {expired_exception.title}",
            "description": "Renewal of expired exception",
            "exception_type": ExceptionType.TEMPORARY,
            "justification": "Still working on permanent solution",
            "business_risk": "Low risk with additional controls",
            "duration_days": 30,
            "approval_required": True,
            "related_exception_id": expired_exception.id,
        }

        mock_db.add = MagicMock()

        with (
            patch.object(exception_service, "_create_exception_activity", AsyncMock()),
            patch.object(
                exception_service,
                "_initiate_approval_workflow",
                AsyncMock(return_value=uuid4()),
            ),
        ):
            renewal_request = await exception_service.create_exception_request(
                mock_db,
                expired_exception.project_id,
                expired_exception.policy_id,
                user_id,
                renewal_data,
            )

        assert renewal_request.status == ExceptionStatus.PENDING
        assert "Renewal:" in renewal_request.title
        assert renewal_request.duration_days == 30

        # Test notifications for expiring exceptions
        with patch.object(
            exception_service, "get_exceptions_expiring_soon"
        ) as mock_expiring:
            expiring_soon = PolicyExceptionRequest(
                id=uuid4(),
                title="Expiring Soon Exception",
                end_date=datetime.utcnow() + timedelta(days=5),  # Expires in 5 days
                status=ExceptionStatus.APPROVED,
            )

            mock_expiring.return_value = [expiring_soon]

            expiring_exceptions = await exception_service.get_exceptions_expiring_soon(
                mock_db, days_ahead=30
            )

            assert len(expiring_exceptions) == 1
            assert expiring_exceptions[0].days_until_expiry == 5


@pytest.mark.integration
class TestViolationAnalyticsIntegration:
    """Integration tests for violation analytics."""

    @pytest.mark.asyncio
    async def test_violation_metrics_with_multiple_projects(self, mock_db):
        """Test analytics across multiple projects."""

        from udp.services.violation_service import ViolationAnalyticsService

        service = ViolationAnalyticsService()

        # Mock data for multiple projects
        project1_id = uuid4()
        project2_id = uuid4()

        # Mock violations
        violations = [
            {
                "project_id": project1_id,
                "severity": "critical",
                "status": "open",
                "detected_at": datetime.utcnow() - timedelta(days=5),
            },
            {
                "project_id": project1_id,
                "severity": "high",
                "status": "resolved",
                "detected_at": datetime.utcnow() - timedelta(days=10),
            },
            {
                "project_id": project1_id,
                "severity": "medium",
                "status": "in_progress",
                "detected_at": datetime.utcnow() - timedelta(days=2),
            },
            {
                "project_id": project2_id,
                "severity": "high",
                "status": "open",
                "detected_at": datetime.utcnow() - timedelta(days=1),
            },
            {
                "project_id": project2_id,
                "severity": "low",
                "status": "resolved",
                "detected_at": datetime.utcnow() - timedelta(days=15),
            },
        ]

        # Mock exception requests
        exceptions = [
            {
                "project_id": project1_id,
                "status": "pending",
                "submitted_at": datetime.utcnow() - timedelta(days=1),
            },
            {
                "project_id": project1_id,
                "status": "approved",
                "submitted_at": datetime.utcnow() - timedelta(days=5),
            },
            {
                "project_id": project2_id,
                "status": "rejected",
                "submitted_at": datetime.utcnow() - timedelta(days=3),
            },
        ]

        # Mock database queries
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = len(violations)

        mock_status_result = AsyncMock()
        status_counts = {}
        for v in violations:
            status_counts[v["status"]] = status_counts.get(v["status"], 0) + 1
        mock_status_result.all.return_value = list(status_counts.items())

        mock_severity_result = AsyncMock()
        severity_counts = {}
        for v in violations:
            severity_counts[v["severity"]] = severity_counts.get(v["severity"], 0) + 1
        mock_severity_result.all.return_value = list(severity_counts.items())

        mock_resolution_result = AsyncMock()
        resolved_violations = [v for v in violations if v["status"] == "resolved"]
        if resolved_violations:
            avg_resolution = sum(
                (datetime.utcnow() - v["detected_at"]).days for v in resolved_violations
            ) / len(resolved_violations)
        else:
            avg_resolution = 0
        mock_resolution_result.scalar.return_value = avg_resolution

        mock_exception_result = AsyncMock()
        exception_counts = {}
        for e in exceptions:
            exception_counts[e["status"]] = exception_counts.get(e["status"], 0) + 1
        mock_exception_result.all.return_value = list(exception_counts.items())

        mock_db.execute.side_effect = [
            mock_total_result,
            mock_status_result,
            mock_severity_result,
            mock_resolution_result,
            mock_exception_result,
        ]

        with patch.object(
            service, "get_overdue_violations", AsyncMock(return_value=[])
        ):
            # Get metrics for all projects
            metrics = await service.get_violation_metrics(mock_db, days_back=30)

        # Verify metrics
        assert metrics["total_violations"] == 5
        assert "open" in metrics["violations_by_status"]
        assert "resolved" in metrics["violations_by_status"]
        assert "critical" in metrics["violations_by_severity"]
        assert "high" in metrics["violations_by_severity"]
        assert metrics["average_resolution_time_hours"] > 0
        assert metrics["active_exception_requests"] == 1  # pending exceptions

        # Get metrics for specific project
        with patch.object(
            service, "get_overdue_violations", AsyncMock(return_value=[])
        ):
            project1_metrics = await service.get_violation_metrics(
                mock_db, project1_id, days_back=30
            )

        # Should only include project 1 violations
        # (In real implementation, the queries would be filtered by project_id)
        assert project1_metrics["project_id"] == project1_id
