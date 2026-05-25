"""
Unit tests for Compliance Service.

Tests comprehensive compliance management functionality including package
assessments, project evaluations, dashboard generation, and custom
framework creation.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.udp.services.compliance_service import ComplianceService
from src.udp.security.compliance_framework_registry import (
    ComplianceFramework,
    ComplianceViolation,
    ComplianceValidationResult,
    ComplianceStatus as FrameworkComplianceStatus,
    SecurityLevel,
)
from src.udp.core.models.compliance import (
    ComplianceRule as DBComplianceRule,
    ComplianceCheck as DBComplianceCheck,
    ComplianceReport as DBComplianceReport,
    ComplianceStatus,
    ViolationSeverity,
)
from src.udp.core.models.organizations import Organization
from src.udp.core.models.projects import Project
from src.udp.core.models.dependencies import Dependency
from src.udp.core.exceptions import ComplianceError, ValidationError


class TestComplianceService:
    """Test ComplianceService implementation."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        db = AsyncMock(spec=AsyncSession)
        db.add = Mock()
        db.commit = AsyncMock()
        db.rollback = AsyncMock()
        db.get = AsyncMock()
        db.execute = AsyncMock()
        return db

    @pytest.fixture
    def compliance_service(self, mock_db):
        """Create compliance service instance."""
        return ComplianceService(mock_db)

    @pytest.fixture
    def sample_package_id(self):
        """Create sample package ID."""
        return uuid4()

    @pytest.fixture
    def sample_project_id(self):
        """Create sample project ID."""
        return uuid4()

    @pytest.fixture
    def sample_organization_id(self):
        """Create sample organization ID."""
        return uuid4()

    @pytest.mark.asyncio
    async def test_assess_package_compliance_success(
        self, compliance_service, mock_db, sample_package_id, sample_organization_id
    ):
        """Test successful package compliance assessment."""
        # Mock package data
        package_data = {
            "package_id": str(sample_package_id),
            "name": "test-package",
            "version": "1.0.0",
            "organization_id": sample_organization_id,
            "processes_personal_data": False,
            "handles_phi": False,
            "handles_cardholder_data": False,
            "affects_financial_reporting": False,
            "has_approval": True,
            "has_documentation": True,
            "critical_vulnerabilities": 0,
            "high_vulnerabilities": 0,
            "supports_encryption": True,
            "has_security_measures": True,
        }

        with patch.object(
            compliance_service,
            "_get_package_assessment_data",
            return_value=package_data,
        ):
            with patch.object(
                compliance_service, "_store_compliance_checks", new_callable=AsyncMock
            ):
                result = await compliance_service.assess_package_compliance(
                    sample_package_id
                )

        # Verify assessment result structure
        assert "package_id" in result
        assert "frameworks_assessed" in result
        assert "total_violations" in result
        assert "is_compliant" in result
        assert "risk_score" in result
        assert "recommendations" in result

        # Verify compliant package
        assert result["is_compliant"] is True
        assert result["total_violations"] == 0
        assert result["risk_score"] == 0.0

    @pytest.mark.asyncio
    async def test_assess_package_compliance_with_violations(
        self, compliance_service, mock_db, sample_package_id, sample_organization_id
    ):
        """Test package compliance assessment with violations."""
        # Mock non-compliant package data
        package_data = {
            "package_id": str(sample_package_id),
            "name": "non-compliant-package",
            "version": "1.0.0",
            "organization_id": sample_organization_id,
            "processes_personal_data": True,
            "handles_phi": True,
            "has_legal_basis": False,
            "has_security_measures": False,
            "critical_vulnerabilities": 2,
        }

        with patch.object(
            compliance_service,
            "_get_package_assessment_data",
            return_value=package_data,
        ):
            with patch.object(
                compliance_service, "_store_compliance_checks", new_callable=AsyncMock
            ):
                result = await compliance_service.assess_package_compliance(
                    sample_package_id
                )

        # Verify violations detected
        assert result["is_compliant"] is False
        assert result["total_violations"] > 0
        assert result["critical_violations"] > 0
        assert result["risk_score"] > 0.0
        assert len(result["violations"]) > 0

    @pytest.mark.asyncio
    async def test_assess_package_compliance_caching(
        self, compliance_service, mock_db, sample_package_id
    ):
        """Test package compliance assessment caching."""
        package_data = {
            "package_id": str(sample_package_id),
            "name": "cached-package",
            "organization_id": uuid4(),
            "processes_personal_data": False,
        }

        with patch.object(
            compliance_service,
            "_get_package_assessment_data",
            return_value=package_data,
        ):
            with patch.object(
                compliance_service, "_store_compliance_checks", new_callable=AsyncMock
            ):
                # First assessment
                result1 = await compliance_service.assess_package_compliance(
                    sample_package_id
                )

                # Second assessment (should use cache)
                result2 = await compliance_service.assess_package_compliance(
                    sample_package_id
                )

                # Results should be identical (from cache)
                assert result1["assessed_at"] == result2["assessed_at"]

    @pytest.mark.asyncio
    async def test_assess_project_compliance_success(
        self, compliance_service, mock_db, sample_project_id, sample_organization_id
    ):
        """Test successful project compliance assessment."""
        # Mock project
        mock_project = Mock(spec=Project)
        mock_project.id = sample_project_id
        mock_project.name = "test-project"
        mock_project.organization_id = sample_organization_id

        mock_db.get.return_value = mock_project

        # Mock dependencies
        mock_dependency = Mock(spec=Dependency)
        mock_dependency.id = uuid4()
        mock_dependency.package_id = uuid4()
        mock_dependency.version_constraint = ">=1.0.0"

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [mock_dependency]
        mock_db.execute.return_value = mock_result

        # Mock organization data
        org_data = {
            "organization_id": sample_organization_id,
            "privileged_users_count": 3,
            "mfa_enabled": True,
            "workforce_training_completed": True,
            "encryption_implemented": True,
            "dpo_appointed": True,
        }

        with patch.object(
            compliance_service,
            "_get_organization_assessment_data",
            return_value=org_data,
        ):
            with patch.object(
                compliance_service, "assess_package_compliance", new_callable=AsyncMock
            ) as mock_assess:
                mock_assess.return_value = {
                    "is_compliant": True,
                    "total_violations": 0,
                    "critical_violations": 0,
                    "risk_score": 0.0,
                }
                with patch.object(
                    compliance_service,
                    "_store_compliance_report",
                    new_callable=AsyncMock,
                ):
                    result = await compliance_service.assess_project_compliance(
                        sample_project_id
                    )

        # Verify project assessment result
        assert result["project_id"] == str(sample_project_id)
        assert result["project_name"] == "test-project"
        assert result["organization_id"] == str(sample_organization_id)
        assert result["total_dependencies"] == 1
        assert "dependency_assessments" in result
        assert "organization_compliance" in result
        assert "overall_risk_score" in result
        assert "recommendations" in result

    @pytest.mark.asyncio
    async def test_assess_project_not_found(
        self, compliance_service, mock_db, sample_project_id
    ):
        """Test project compliance assessment with non-existent project."""
        mock_db.get.return_value = None

        with pytest.raises(ValidationError, match="Project .* not found"):
            await compliance_service.assess_project_compliance(sample_project_id)

    @pytest.mark.asyncio
    async def test_get_compliance_dashboard(
        self, compliance_service, mock_db, sample_organization_id
    ):
        """Test compliance dashboard generation."""
        # Mock projects
        mock_project1 = Mock(spec=Project)
        mock_project1.id = uuid4()
        mock_project1.name = "project-1"
        mock_project1.organization_id = sample_organization_id

        mock_project2 = Mock(spec=Project)
        mock_project2.id = uuid4()
        mock_project2.name = "project-2"
        mock_project2.organization_id = sample_organization_id

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [
            mock_project1,
            mock_project2,
        ]
        mock_db.execute.return_value = mock_result

        # Mock compliance report
        mock_report = Mock(spec=DBComplianceReport)
        mock_report.compliance_score = 95
        mock_report.non_compliant_checks = 1
        mock_report.created_at = datetime.utcnow()

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_report
        mock_db.execute.return_value = mock_result

        with patch.object(
            compliance_service, "_get_framework_compliance", new_callable=AsyncMock
        ) as mock_framework:
            mock_framework.return_value = [
                {
                    "assessment_id": str(uuid4()),
                    "compliance_percentage": 90.0,
                    "violations": 2,
                    "assessed_at": datetime.utcnow() - timedelta(days=5),
                }
            ]

            dashboard = await compliance_service.get_compliance_dashboard(
                sample_organization_id
            )

        # Verify dashboard structure
        assert dashboard["organization_id"] == str(sample_organization_id)
        assert "generated_at" in dashboard
        assert "summary" in dashboard
        assert "framework_compliance" in dashboard
        assert "recommendations" in dashboard

        # Verify summary metrics
        summary = dashboard["summary"]
        assert summary["total_projects"] == 2
        assert "compliant_projects" in summary
        assert "non_compliant_projects" in summary
        assert "total_violations" in summary
        assert "overall_compliance_percentage" in summary

    @pytest.mark.asyncio
    async def test_create_custom_framework_success(
        self, compliance_service, mock_db, sample_organization_id
    ):
        """Test successful custom framework creation."""
        # Mock organization
        mock_org = Mock(spec=Organization)
        mock_org.id = sample_organization_id
        mock_org.settings = {}

        mock_db.get.return_value = mock_org

        framework_name = "Custom Compliance Framework"
        rules = [
            {
                "title": "Custom Rule 1",
                "description": "First custom rule",
                "severity": "high",
                "conditions": {"requires_approval": True},
                "control_objective": "Ensure proper approval",
            },
            {
                "title": "Custom Rule 2",
                "description": "Second custom rule",
                "severity": "critical",
                "conditions": {"requires_encryption": True},
                "control_objective": "Ensure data encryption",
            },
        ]

        result = await compliance_service.create_custom_framework(
            organization_id=sample_organization_id,
            framework_name=framework_name,
            rules=rules,
        )

        # Verify custom framework result
        assert result["framework_name"] == framework_name
        assert result["organization_id"] == str(sample_organization_id)
        assert result["total_rules"] == 2
        assert "rules" in result
        assert "created_at" in result

        # Verify rules structure
        assert len(result["rules"]) == 2
        for rule in result["rules"]:
            assert "rule_id" in rule
            assert "title" in rule
            assert "severity" in rule
            assert "category" in rule

    @pytest.mark.asyncio
    async def test_create_custom_framework_invalid_rules(
        self, compliance_service, mock_db, sample_organization_id
    ):
        """Test custom framework creation with invalid rules."""
        mock_org = Mock(spec=Organization)
        mock_org.id = sample_organization_id

        mock_db.get.return_value = mock_org

        # Invalid rules (missing required fields)
        rules = [
            {"title": "Invalid Rule", "description": "Missing severity and conditions"}
        ]

        with pytest.raises(ValidationError, match="Rule must include"):
            await compliance_service.create_custom_framework(
                organization_id=sample_organization_id,
                framework_name="Invalid Framework",
                rules=rules,
            )

    @pytest.mark.asyncio
    async def test_create_custom_framework_org_not_found(
        self, compliance_service, mock_db, sample_organization_id
    ):
        """Test custom framework creation with non-existent organization."""
        mock_db.get.return_value = None

        with pytest.raises(ValidationError, match="Organization .* not found"):
            await compliance_service.create_custom_framework(
                organization_id=sample_organization_id,
                framework_name="Test Framework",
                rules=[
                    {
                        "title": "Test Rule",
                        "description": "Test rule",
                        "severity": "medium",
                        "conditions": {},
                    }
                ],
            )

    @pytest.mark.asyncio
    async def test_track_violation_remediation_success(
        self, compliance_service, mock_db, sample_organization_id
    ):
        """Test successful violation remediation tracking."""
        # Mock compliance check
        mock_check = Mock(spec=DBComplianceCheck)
        mock_check.id = uuid4()
        mock_check.check_metadata = {
            "violation_tracking": {"remediation_status": "open"}
        }

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_check
        mock_db.execute.return_value = mock_result

        violation_id = str(uuid4())
        remediation_status = "in_progress"
        notes = "Working on fix"
        assigned_to = "developer@example.com"

        result = await compliance_service.track_violation_remediation(
            violation_id=violation_id,
            remediation_status=remediation_status,
            notes=notes,
            assigned_to=assigned_to,
        )

        # Verify tracking result
        assert result["violation_id"] == violation_id
        assert result["remediation_status"] == remediation_status
        assert result["notes"] == notes
        assert result["assigned_to"] == assigned_to
        assert "updated_at" in result
        assert result["is_resolved"] is False

    @pytest.mark.asyncio
    async def test_track_violation_remediation_not_found(
        self, compliance_service, mock_db
    ):
        """Test violation remediation tracking with non-existent violation."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(ValidationError, match="Violation .* not found"):
            await compliance_service.track_violation_remediation(
                violation_id=str(uuid4()), remediation_status="resolved"
            )

    @pytest.mark.asyncio
    async def test_track_violation_remediation_resolved(
        self, compliance_service, mock_db
    ):
        """Test violation remediation tracking with resolved status."""
        mock_check = Mock(spec=DBComplianceCheck)
        mock_check.id = uuid4()
        mock_check.check_metadata = {}

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_check
        mock_db.execute.return_value = mock_result

        result = await compliance_service.track_violation_remediation(
            violation_id=str(uuid4()), remediation_status="resolved"
        )

        # Verify compliance check status is updated
        assert mock_check.status == ComplianceStatus.COMPLIANT
        assert mock_check.violation_count == 0
        assert result["is_resolved"] is True

    def test_generate_package_recommendations(self, compliance_service):
        """Test package-specific recommendation generation."""
        # Create mock violations
        violations = [
            Mock(
                framework=ComplianceFramework.GDPR,
                violation_type="missing_legal_basis",
                severity=SecurityLevel.CRITICAL,
            ),
            Mock(
                framework=ComplianceFramework.HIPAA,
                violation_type="missing_encryption",
                severity=SecurityLevel.CRITICAL,
            ),
            Mock(
                framework=ComplianceFramework.SOX,
                violation_type="missing_approval",
                severity=SecurityLevel.HIGH,
            ),
        ]

        frameworks = [
            ComplianceFramework.GDPR,
            ComplianceFramework.HIPAA,
            ComplianceFramework.SOX,
        ]

        recommendations = compliance_service._generate_package_recommendations(
            violations, frameworks
        )

        # Verify recommendations are generated
        assert len(recommendations) > 0

        # Check for framework-specific recommendations
        rec_text = " ".join(recommendations).lower()
        assert "legal basis" in rec_text  # GDPR
        assert "encryption" in rec_text  # HIPAA
        assert "immediately" in rec_text  # Critical violations

    def test_generate_project_recommendations(self, compliance_service):
        """Test project-specific recommendation generation."""
        # Create mock dependency assessments
        dependency_assessments = [
            {
                "assessment": {
                    "critical_violations": 2,
                    "total_violations": 5,
                    "risk_score": 8.5,
                }
            },
            {
                "assessment": {
                    "critical_violations": 0,
                    "total_violations": 1,
                    "risk_score": 3.0,
                }
            },
        ]

        # Create mock organization validation results
        org_validation_results = {
            ComplianceFramework.GDPR: Mock(
                recommendations=["Update privacy notices"],
                status=FrameworkComplianceStatus.PARTIALLY_COMPLIANT,
            ),
            ComplianceFramework.HIPAA: Mock(
                recommendations=["Implement encryption"],
                status=FrameworkComplianceStatus.NON_COMPLIANT,
            ),
        }

        recommendations = compliance_service._generate_project_recommendations(
            dependency_assessments, org_validation_results
        )

        # Verify recommendations are generated
        assert len(recommendations) > 0

        # Check for dependency-specific recommendations
        rec_text = " ".join(recommendations).lower()
        assert "dependencies" in rec_text
        assert "non-compliant" in rec_text

        # Check for organization-level recommendations
        assert "privacy notices" in rec_text
        assert "encryption" in rec_text

    def test_calculate_package_risk_score(self, compliance_service):
        """Test package risk score calculation."""
        # Test with no violations
        risk_score = compliance_service._calculate_package_risk_score([])
        assert risk_score == 0.0

        # Test with mixed severity violations
        violations = [
            Mock(severity=SecurityLevel.CRITICAL),
            Mock(severity=SecurityLevel.HIGH),
            Mock(severity=SecurityLevel.MEDIUM),
            Mock(severity=SecurityLevel.LOW),
        ]

        risk_score = compliance_service._calculate_package_risk_score(violations)

        # Verify score is calculated and capped at 10
        assert 0.0 <= risk_score <= 10.0
        assert risk_score > 0.0

    def test_calculate_project_risk_score(self, compliance_service):
        """Test project risk score calculation."""
        # Create mock dependency assessments
        dependency_assessments = [
            {"assessment": {"risk_score": 8.0}},
            {"assessment": {"risk_score": 6.0}},
            {"assessment": {"risk_score": 4.0}},
        ]

        # Create mock organization validation results
        org_validation_results = {
            ComplianceFramework.GDPR: Mock(risk_score=5.0),
            ComplianceFramework.HIPAA: Mock(risk_score=3.0),
        }

        risk_score = compliance_service._calculate_project_risk_score(
            dependency_assessments, org_validation_results
        )

        # Verify weighted calculation (70% dependencies, 30% organization)
        expected_dependency_avg = (8.0 + 6.0 + 4.0) / 3
        expected_org_avg = (5.0 + 3.0) / 2
        expected_score = (expected_dependency_avg * 0.7) + (expected_org_avg * 0.3)

        assert abs(risk_score - expected_score) < 0.01


if __name__ == "__main__":
    pytest.main([__file__])
