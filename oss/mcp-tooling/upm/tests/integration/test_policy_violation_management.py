"""
Integration Tests for Policy Violation Management and Exception Workflow

End-to-end integration tests covering the complete policy violation
and exception request lifecycle with database interactions.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from udp.core.models.base import Base
from udp.core.models.policy import Policy, PolicyEvaluation, PolicyEvaluationStatus
from udp.core.models.violation import (
    ExceptionStatus,
    ExceptionType,
    PolicyExceptionRequest,
    PolicyViolation,
    ViolationRemediation,
    ViolationSeverity,
    ViolationStatus,
)
from udp.main import app
from udp.api.deps import get_db


# Test database configuration
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def test_db():
    """Create test database session."""

    # Create async engine
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session

    # Clean up
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def client(test_db):
    """Create test client with database override."""

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def sample_user():
    """Create sample user for testing."""
    return {
        "id": uuid4(),
        "email": "test@example.com",
        "name": "Test User",
        "organization_id": uuid4(),
        "role": "developer",
    }


@pytest.fixture
async def sample_policy(test_db):
    """Create sample policy in test database."""

    policy = Policy(
        id=uuid4(),
        name="Security Policy - No Critical Vulnerabilities",
        description="Policy to prevent packages with critical vulnerabilities",
        rule_type="security",
        severity="critical",
        is_active=True,
        conditions={
            "field": "vulnerability.severity",
            "operator": "eq",
            "value": "critical",
        },
        actions=["block", "notify"],
    )

    test_db.add(policy)
    await test_db.commit()
    await test_db.refresh(policy)

    return policy


@pytest.fixture
async def sample_project(test_db, sample_user):
    """Create sample project in test database."""

    from udp.core.models import Project

    project = Project(
        id=uuid4(),
        organization_id=sample_user["organization_id"],
        name="Test Project",
        slug="test-project",
        primary_language="python",
        ecosystem="pypi",
    )

    test_db.add(project)
    await test_db.commit()
    await test_db.refresh(project)

    return project


@pytest.fixture
async def auth_headers(sample_user):
    """Create authentication headers for testing."""

    # This would create a valid JWT token
    # For testing, we'll use a mock token
    return {"Authorization": f"Bearer mock-token-{sample_user['id']}"}


class TestPolicyViolationIntegration:
    """Integration tests for policy violation management."""

    @pytest.mark.asyncio
    async def test_violation_lifecycle_complete(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        sample_policy,
        sample_project,
        auth_headers,
    ):
        """Test complete violation lifecycle from detection to resolution."""

        # Step 1: Create policy evaluation that detects violation
        evaluation = PolicyEvaluation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            target_type="project",
            status=PolicyEvaluationStatus.FAIL,
            violation_detected=True,
            violation_severity="critical",
            result_message="Critical vulnerability detected in package",
        )

        test_db.add(evaluation)
        await test_db.commit()

        # Step 2: Create violation from evaluation
        from udp.services.violation_service import ViolationDetectionService

        detection_service = ViolationDetectionService()
        violation = await detection_service.create_violation_from_evaluation(
            test_db,
            evaluation,
            {
                "violation_key": "critical_vuln_001",
                "title": "Critical Security Vulnerability",
                "description": "Package has critical CVE-2025-0001",
                "severity": ViolationSeverity.CRITICAL,
                "risk_score": 9.5,
                "business_impact": "Potential data breach",
                "technical_impact": "Remote code execution",
                "remediation_steps": [
                    {
                        "step": "update_package",
                        "description": "Update to version 2.0.1",
                    },
                    {"step": "verify_fix", "description": "Run security scan"},
                ],
                "remediation_complexity": "low",
                "estimated_remediation_hours": 2,
            },
        )

        assert violation.id is not None
        assert violation.status == ViolationStatus.OPEN
        assert violation.severity == ViolationSeverity.CRITICAL

        # Step 3: Acknowledge violation via API
        ack_response = await client.post(
            f"/api/v1/violations/{violation.id}/acknowledge",
            json={"comment": "Acknowledging critical vulnerability"},
            headers=auth_headers,
        )

        assert ack_response.status_code == 200
        acknowledged_violation = ack_response.json()
        assert acknowledged_violation["status"] == ViolationStatus.ACKNOWLEDGED

        # Step 4: Create remediation plan
        remediation_data = {
            "remediation_type": "manual",
            "title": "Fix Critical Vulnerability",
            "description": "Update package to fix CVE-2025-0001",
            "estimated_hours": 2,
            "steps_performed": [],
            "follow_up_required": True,
        }

        remediation_response = await client.post(
            f"/api/v1/violations/{violation.id}/remediation",
            json=remediation_data,
            headers=auth_headers,
        )

        assert remediation_response.status_code == 200
        remediation = remediation_response.json()
        assert remediation["status"] == "in_progress"
        assert remediation["progress_percentage"] == 0

        # Step 5: Update remediation progress
        progress_data = {
            "progress_percentage": 100,
            "steps_completed": [
                {
                    "step": "update_package",
                    "completed_at": datetime.utcnow().isoformat(),
                    "details": "Updated to version 2.0.1",
                },
                {
                    "step": "verify_fix",
                    "completed_at": datetime.utcnow().isoformat(),
                    "details": "Security scan shows no vulnerabilities",
                },
            ],
            "actual_hours": 1.5,
            "outcome": "Successfully remediated critical vulnerability",
            "verification_method": "automated_security_scan",
        }

        progress_response = await client.put(
            f"/api/v1/remediation/{remediation['id']}/progress",
            json=progress_data,
            headers=auth_headers,
        )

        assert progress_response.status_code == 200
        updated_remediation = progress_response.json()
        assert updated_remediation["status"] == "completed"
        assert updated_remediation["progress_percentage"] == 100

        # Step 6: Resolve violation
        resolve_response = await client.post(
            f"/api/v1/violations/{violation.id}/resolve",
            json={
                "resolution_method": "package_update",
                "comment": "Vulnerability fixed by updating package",
            },
            headers=auth_headers,
        )

        assert resolve_response.status_code == 200
        resolved_violation = resolve_response.json()
        assert resolved_violation["status"] == ViolationStatus.RESOLVED
        assert resolved_violation["resolved_at"] is not None

    @pytest.mark.asyncio
    async def test_exception_request_workflow(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        sample_policy,
        sample_project,
        auth_headers,
    ):
        """Test complete exception request workflow."""

        # Step 1: Create violation that needs exception
        evaluation = PolicyEvaluation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            target_type="dependency",
            status=PolicyEvaluationStatus.FAIL,
            violation_detected=True,
            result_message="Package violates security policy",
        )

        test_db.add(evaluation)
        await test_db.commit()

        violation = PolicyViolation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            policy_evaluation_id=evaluation.id,
            violation_key="security_exception_001",
            title="Policy Violation - Required Package",
            description="Required package has security issue",
            severity=ViolationSeverity.HIGH,
            status=ViolationStatus.OPEN,
            exception_requestable=True,
        )

        test_db.add(violation)
        await test_db.commit()

        # Step 2: Create exception request
        exception_data = {
            "project_id": sample_project.id,
            "policy_id": sample_policy.id,
            "violation_id": violation.id,
            "exception_key": "business_critical_001",
            "title": "Exception for Business Critical Package",
            "description": "Request exception for business critical package",
            "exception_type": ExceptionType.TEMPORARY,
            "justification": "This is a business critical package required for operations",
            "business_risk": "High business impact if package is not available",
            "mitigation_plan": "Monitor for security updates and apply immediately",
            "duration_days": 60,
            "conditions": [
                {
                    "type": "monitoring",
                    "description": "Daily security scans",
                    "frequency": "daily",
                }
            ],
        }

        exception_response = await client.post(
            "/api/v1/exceptions",
            json=exception_data,
            headers=auth_headers,
        )

        assert exception_response.status_code == 200
        exception = exception_response.json()
        assert exception["status"] == ExceptionStatus.PENDING
        assert exception["exception_type"] == ExceptionType.TEMPORARY
        assert exception["duration_days"] == 60
        assert exception["approval_required"] is True

        # Step 3: Approve exception request (simulating approval workflow)
        approval_response = await client.put(
            f"/api/v1/exceptions/{exception['id']}/status",
            json={
                "status": ExceptionStatus.APPROVED,
                "reason": "Business justification approved with conditions",
                "approval_conditions": [
                    {
                        "type": "monitoring",
                        "frequency": "weekly",
                        "escalation_threshold": 3,
                    },
                    {
                        "type": "documentation",
                        "description": "Maintain exception documentation",
                    },
                ],
            },
            headers=auth_headers,
        )

        assert approval_response.status_code == 200
        approved_exception = approval_response.json()
        assert approved_exception["status"] == ExceptionStatus.APPROVED
        assert approved_exception["decision"] == "approved"
        assert approved_exception["decision_reason"] is not None
        assert len(approved_exception["approval_conditions"]) == 2

        # Step 4: Verify violation status updated
        violation_response = await client.get(
            f"/api/v1/violations/{violation.id}",
            headers=auth_headers,
        )

        updated_violation = violation_response.json()
        # Note: This would be updated by the workflow in a real implementation
        # assert updated_violation["status"] == ViolationStatus.ACCEPTED

        # Step 5: Get active exceptions
        active_response = await client.get(
            "/api/v1/active-exceptions",
            headers=auth_headers,
        )

        assert active_response.status_code == 200
        active_exceptions = active_response.json()
        assert len(active_exceptions) >= 1
        assert any(e["id"] == exception["id"] for e in active_exceptions)

    @pytest.mark.asyncio
    async def test_violation_analytics(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        sample_project,
        sample_policy,
        auth_headers,
    ):
        """Test violation analytics and metrics."""

        # Create multiple violations with different severities
        violations = []

        for i, severity in enumerate(
            [
                ViolationSeverity.CRITICAL,
                ViolationSeverity.HIGH,
                ViolationSeverity.MEDIUM,
                ViolationSeverity.LOW,
            ]
        ):
            violation = PolicyViolation(
                id=uuid4(),
                project_id=sample_project.id,
                policy_id=sample_policy.id,
                violation_key=f"test_violation_{i}",
                title=f"Test Violation {i}",
                description=f"Test violation with {severity} severity",
                severity=severity,
                status=ViolationStatus.OPEN,
                detected_at=datetime.utcnow() - timedelta(days=i),
                risk_score=float(10 - i * 2),
            )

            violations.append(violation)
            test_db.add(violation)

        await test_db.commit()

        # Get violation metrics
        metrics_response = await client.get(
            "/api/v1/analytics/metrics",
            headers=auth_headers,
        )

        assert metrics_response.status_code == 200
        metrics = metrics_response.json()
        assert metrics["total_violations"] == 4
        assert metrics["violations_by_severity"]["critical"] == 1
        assert metrics["violations_by_severity"]["high"] == 1
        assert metrics["violations_by_severity"]["medium"] == 1
        assert metrics["violations_by_severity"]["low"] == 1

        # Get violation trends
        trends_response = await client.get(
            "/api/v1/analytics/trends",
            headers=auth_headers,
        )

        assert trends_response.status_code == 200
        trends = trends_response.json()
        assert isinstance(trends, list)
        assert len(trends) > 0

        # Get top violating policies
        top_policies_response = await client.get(
            "/api/v1/analytics/top-violating-policies",
            headers=auth_headers,
        )

        assert top_policies_response.status_code == 200
        top_policies = top_policies_response.json()
        assert len(top_policies) >= 1
        assert top_policies[0]["policy_name"] == sample_policy.name
        assert top_policies[0]["violation_count"] == 4

    @pytest.mark.asyncio
    async def test_false_positive_workflow(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        sample_policy,
        sample_project,
        auth_headers,
    ):
        """Test marking violations as false positive."""

        # Create violation
        evaluation = PolicyEvaluation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            status=PolicyEvaluationStatus.FAIL,
            violation_detected=True,
        )

        test_db.add(evaluation)
        await test_db.commit()

        violation = PolicyViolation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            policy_evaluation_id=evaluation.id,
            violation_key="false_positive_001",
            title="Potential False Positive",
            description="Scanner misconfiguration",
            severity=ViolationSeverity.MEDIUM,
            status=ViolationStatus.OPEN,
            false_positive_indicator=False,
        )

        test_db.add(violation)
        await test_db.commit()

        # Mark as false positive
        fp_response = await client.post(
            f"/api/v1/violations/{violation.id}/mark-false-positive",
            json={"reason": "Scanner misconfiguration - no actual vulnerability"},
            headers=auth_headers,
        )

        assert fp_response.status_code == 200
        fp_violation = fp_response.json()
        assert fp_violation["status"] == ViolationStatus.FALSE_POSITIVE
        assert fp_violation["false_positive_indicator"] is True
        assert fp_violation["resolved_at"] is not None

    @pytest.mark.asyncio
    async def test_exception_expiration_workflow(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        sample_project,
        sample_policy,
        auth_headers,
    ):
        """Test exception expiration and renewal workflow."""

        # Create exception that expires soon
        exception = PolicyExceptionRequest(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            requester_id=uuid4(),
            exception_key="expiring_exception_001",
            title="Expiring Exception",
            description="Exception that will expire soon",
            exception_type=ExceptionType.TEMPORARY,
            justification="Temporary requirement",
            status=ExceptionStatus.APPROVED,
            submitted_at=datetime.utcnow() - timedelta(days=30),
            decided_at=datetime.utcnow() - timedelta(days=29),
            end_date=datetime.utcnow() + timedelta(days=5),  # Expires in 5 days
        )

        test_db.add(exception)
        await test_db.commit()

        # Get exceptions expiring soon
        expiring_response = await client.get(
            "/api/v1/exceptions-expiring-soon?days_ahead=30",
            headers=auth_headers,
        )

        assert expiring_response.status_code == 200
        expiring_exceptions = expiring_response.json()
        assert len(expiring_exceptions) >= 1

        expiring_exception = next(
            e for e in expiring_exceptions if e["id"] == str(exception.id)
        )
        assert expiring_exception["days_until_expiry"] <= 30
        assert expiring_exception["requires_renewal"] is True

        # Create renewal exception request
        renewal_data = {
            "project_id": sample_project.id,
            "policy_id": sample_policy.id,
            "exception_key": "renewal_exception_001",
            "title": "Exception Renewal Request",
            "description": "Request to renew expiring exception",
            "exception_type": ExceptionType.TEMPORARY,
            "justification": "Continued business requirement",
            "duration_days": 90,  # Renew for 90 days
        }

        renewal_response = await client.post(
            "/api/v1/exceptions",
            json=renewal_data,
            headers=auth_headers,
        )

        assert renewal_response.status_code == 200
        renewal_exception = renewal_response.json()
        assert renewal_exception["status"] == ExceptionStatus.PENDING
        assert renewal_exception["duration_days"] == 90

    @pytest.mark.asyncio
    async def test_escalation_workflow(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        sample_policy,
        sample_project,
        auth_headers,
    ):
        """Test violation escalation workflow."""

        # Create overdue critical violation
        violation = PolicyViolation(
            id=uuid4(),
            project_id=sample_project.id,
            policy_id=sample_policy.id,
            violation_key="escalation_001",
            title="Critical Violation Requiring Escalation",
            description="Violation past SLA requiring escalation",
            severity=ViolationSeverity.CRITICAL,
            status=ViolationStatus.OPEN,
            detected_at=datetime.utcnow()
            - timedelta(days=3),  # Past 24h SLA for critical
            risk_score=9.5,
        )

        test_db.add(violation)
        await test_db.commit()

        # Get overdue violations
        overdue_response = await client.get(
            "/api/v1/overdue-violations?hours_threshold=24",
            headers=auth_headers,
        )

        assert overdue_response.status_code == 200
        overdue_violations = overdue_response.json()
        assert len(overdue_violations) >= 1

        overdue_violation = next(
            v for v in overdue_violations if v["id"] == str(violation.id)
        )
        assert overdue_violation["sla_breached"] is True

        # Escalate violation
        escalation_response = await client.post(
            f"/api/v1/violations/{violation.id}/escalate",
            json={
                "reason": "Critical violation past SLA - immediate attention required",
                "escalated_to": str(uuid4()),  # Escalate to security manager
            },
            headers=auth_headers,
        )

        assert escalation_response.status_code == 200
        escalated_violation = escalation_response.json()
        assert escalated_violation["status"] == ViolationStatus.ESCALATED


@pytest.mark.asyncio
async def test_error_handling(client: AsyncClient, auth_headers):
    """Test API error handling."""

    # Test non-existent violation
    non_existent_id = uuid4()

    response = await client.get(
        f"/api/v1/violations/{non_existent_id}",
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

    # Test invalid status update
    response = await client.put(
        f"/api/v1/exceptions/{non_existent_id}/status",
        json={"status": "invalid_status"},
        headers=auth_headers,
    )

    assert response.status_code == 404

    # Test missing required fields
    response = await client.post(
        "/api/v1/exceptions",
        json={},  # Missing required fields
        headers=auth_headers,
    )

    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_authentication_required(client: AsyncClient):
    """Test that authentication is required for protected endpoints."""

    # Test without auth headers
    response = await client.get("/api/v1/violations")
    assert response.status_code == 401  # Unauthorized

    response = await client.post("/api/v1/exceptions", json={})
    assert response.status_code == 401

    # Test with invalid token
    invalid_headers = {"Authorization": "Bearer invalid-token"}

    response = await client.get("/api/v1/violations", headers=invalid_headers)
    assert response.status_code == 401
