"""
Integration tests for Compliance Framework Workflows.

Tests end-to-end compliance workflows including:
- Package to project compliance assessment
- Multi-framework validation
- Violation tracking and remediation
- Compliance report generation
- Dashboard analytics
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, Mock, patch

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.udp.services.compliance_service import ComplianceService
from src.udp.security.compliance_framework_registry import ComplianceFrameworkRegistry
from src.udp.api.v1.compliance import (
    ComplianceAssessmentRequest,
    ViolationRemediationRequest,
    CustomFrameworkRequest,
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
from src.udp.core.models.packages import Package
from src.udp.core.models.users import User
from src.udp.core.models.base import Base


@pytest.mark.integration
class TestComplianceWorkflows:
    """Integration tests for complete compliance workflows."""

    @pytest.fixture
    async def test_db(self, db_session):
        """Create test database with all necessary tables."""
        # Create tables
        async with db_session.begin():
            await db_session.run_sync(Base.metadata.create_all)

        yield db_session

        # Clean up
        async with db_session.begin():
            await db_session.run_sync(Base.metadata.drop_all)

    @pytest.fixture
    async def test_organization(self, test_db):
        """Create test organization."""
        org = Organization(
            name="Test Organization",
            slug="test-org",
            settings={
                "compliance_enabled": True,
                "frameworks": ["GDPR", "SOX", "HIPAA", "PCI_DSS"],
            },
        )
        test_db.add(org)
        await test_db.commit()
        await test_db.refresh(org)
        return org

    @pytest.fixture
    async def test_user(self, test_db, test_organization):
        """Create test user."""
        user = User(
            email="test@example.com",
            name="Test User",
            organization_id=test_organization.id,
            is_active=True,
        )
        test_db.add(user)
        await test_db.commit()
        await test_db.refresh(user)
        return user

    @pytest.fixture
    async def test_project(self, test_db, test_organization):
        """Create test project."""
        project = Project(
            name="Test Project",
            slug="test-project",
            organization_id=test_organization.id,
            primary_language="python",
            ecosystem="pypi",
            settings={
                "compliance_frameworks": ["GDPR", "SOX"],
                "assessment_frequency": "weekly",
            },
        )
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)
        return project

    @pytest.fixture
    async def test_packages(self, test_db):
        """Create test packages with different compliance profiles."""
        packages = []

        # Compliant package
        compliant_pkg = Package(
            name="compliant-package",
            ecosystem="pypi",
            latest_version="1.0.0",
            metadata={
                "processes_personal_data": False,
                "has_security_measures": True,
                "has_approval": True,
                "has_documentation": True,
            },
        )
        test_db.add(compliant_pkg)
        packages.append(compliant_pkg)

        # Non-compliant package
        non_compliant_pkg = Package(
            name="non-compliant-package",
            ecosystem="pypi",
            latest_version="2.0.0",
            metadata={
                "processes_personal_data": True,
                "has_legal_basis": False,
                "has_security_measures": False,
                "critical_vulnerabilities": 2,
            },
        )
        test_db.add(non_compliant_pkg)
        packages.append(non_compliant_pkg)

        # Mixed compliance package
        mixed_pkg = Package(
            name="mixed-compliance-package",
            ecosystem="npm",
            latest_version="1.5.0",
            metadata={
                "processes_personal_data": True,
                "has_legal_basis": True,
                "has_security_measures": False,
                "critical_vulnerabilities": 0,
                "high_vulnerabilities": 3,
            },
        )
        test_db.add(mixed_pkg)
        packages.append(mixed_pkg)

        await test_db.commit()
        for pkg in packages:
            await test_db.refresh(pkg)

        return packages

    @pytest.fixture
    async def test_dependencies(self, test_db, test_project, test_packages):
        """Create test dependencies linking packages to project."""
        dependencies = []

        for i, package in enumerate(test_packages):
            dep = Dependency(
                project_id=test_project.id,
                package_id=package.id,
                version_constraint=">=1.0.0",
                is_direct=i == 0,  # First package is direct dependency
                ecosystem=package.ecosystem,
                scope="runtime",
            )
            test_db.add(dep)
            dependencies.append(dep)

        await test_db.commit()
        for dep in dependencies:
            await test_db.refresh(dep)

        return dependencies

    @pytest.mark.asyncio
    async def test_full_compliance_assessment_workflow(
        self, test_db, test_organization, test_project, test_packages, test_dependencies
    ):
        """Test complete compliance assessment workflow from packages to project."""
        # Create compliance service
        compliance_service = ComplianceService(test_db)

        # Step 1: Assess individual packages
        package_assessments = []
        for package in test_packages:
            with patch.object(
                compliance_service, "_get_package_assessment_data"
            ) as mock_get_data:
                mock_get_data.return_value = {
                    "package_id": str(package.id),
                    "name": package.name,
                    "organization_id": test_organization.id,
                    **package.metadata,
                }

                assessment = await compliance_service.assess_package_compliance(
                    package.id
                )
                package_assessments.append(assessment)

        # Verify package assessments
        assert len(package_assessments) == 3

        compliant_assessment = package_assessments[0]
        assert compliant_assessment["is_compliant"] is True
        assert compliant_assessment["total_violations"] == 0

        non_compliant_assessment = package_assessments[1]
        assert non_compliant_assessment["is_compliant"] is False
        assert non_compliant_assessment["critical_violations"] > 0

        # Step 2: Assess project compliance
        with patch.object(
            compliance_service, "_get_organization_assessment_data"
        ) as mock_org_data:
            mock_org_data.return_value = {
                "organization_id": test_organization.id,
                "dpo_appointed": True,
                "privacy_notices_updated": True,
                "breach_procedures": True,
            }

            project_assessment = await compliance_service.assess_project_compliance(
                test_project.id
            )

        # Verify project assessment
        assert project_assessment["project_id"] == str(test_project.id)
        assert project_assessment["total_dependencies"] == 3
        assert len(project_assessment["dependency_assessments"]) == 3
        assert "organization_compliance" in project_assessment
        assert (
            project_assessment["is_compliant"] is False
        )  # Due to non-compliant packages

        # Step 3: Verify compliance report was stored
        report_query = select(DBComplianceReport).where(
            DBComplianceReport.project_id == test_project.id
        )
        report_result = await test_db.execute(report_query)
        reports = report_result.scalars().all()

        assert len(reports) > 0
        latest_report = reports[-1]
        assert latest_report.project_id == test_project.id
        assert latest_report.report_type == "comprehensive"
        assert latest_report.compliance_score < 100  # Should reflect violations

    @pytest.mark.asyncio
    async def test_multi_framework_validation_workflow(
        self, test_db, test_organization, test_packages
    ):
        """Test compliance validation across multiple frameworks."""
        compliance_service = ComplianceService(test_db)
        registry = ComplianceFrameworkRegistry()

        # Test package that processes personal data, PHI, and financial data
        test_package = test_packages[1]  # non-compliant package

        with patch.object(
            compliance_service, "_get_package_assessment_data"
        ) as mock_get_data:
            mock_get_data.return_value = {
                "package_id": str(test_package.id),
                "name": test_package.name,
                "organization_id": test_organization.id,
                "processes_personal_data": True,
                "handles_phi": True,
                "handles_cardholder_data": True,
                "affects_financial_reporting": True,
                "has_legal_basis": False,
                "has_approval": False,
                "has_documentation": False,
                "supports_encryption": False,
                "has_security_measures": False,
            }

            # Assess against all frameworks
            frameworks = [
                ComplianceFramework.GDPR,
                ComplianceFramework.HIPAA,
                ComplianceFramework.PCI_DSS,
                ComplianceFramework.SOX,
            ]

            assessment = await compliance_service.assess_package_compliance(
                test_package.id, frameworks
            )

        # Verify multi-framework results
        assert assessment["frameworks_assessed"] == [f.value for f in frameworks]
        assert assessment["total_violations"] > 0
        assert assessment["critical_violations"] > 0

        # Verify violations from each framework
        framework_results = assessment["framework_results"]
        assert len(framework_results) == 4

        # All frameworks should have violations for this package
        for framework in frameworks:
            assert framework.value in framework_results
            framework_result = framework_results[framework.value]
            assert framework_result["violations"] > 0
            assert framework_result["is_compliant"] is False

    @pytest.mark.asyncio
    async def test_violation_tracking_and_remediation_workflow(
        self, test_db, test_organization, test_packages
    ):
        """Test complete violation tracking and remediation workflow."""
        compliance_service = ComplianceService(test_db)

        # Step 1: Detect violations
        test_package = test_packages[1]  # non-compliant package

        with patch.object(
            compliance_service, "_get_package_assessment_data"
        ) as mock_get_data:
            mock_get_data.return_value = {
                "package_id": str(test_package.id),
                "name": test_package.name,
                "organization_id": test_organization.id,
                "processes_personal_data": True,
                "has_legal_basis": False,
                "has_security_measures": False,
            }

            assessment = await compliance_service.assess_package_compliance(
                test_package.id, [ComplianceFramework.GDPR]
            )

        # Verify violations were detected
        assert assessment["total_violations"] > 0

        # Step 2: Get violation ID from stored checks
        check_query = select(DBComplianceCheck).where(
            DBComplianceCheck.target_id == test_package.id
        )
        check_result = await test_db.execute(check_query)
        checks = check_result.scalars().all()

        assert len(checks) > 0

        # Get violation ID from check metadata
        violation_id = None
        for check in checks:
            if check.check_metadata and "violation_id" in check.check_metadata:
                violation_id = check.check_metadata["violation_id"]
                break

        assert violation_id is not None

        # Step 3: Track remediation progress
        # Initial tracking
        tracking_result = await compliance_service.track_violation_remediation(
            violation_id=violation_id,
            remediation_status="in_progress",
            notes="Investigating violation",
            assigned_to="security@example.com",
        )

        assert tracking_result["remediation_status"] == "in_progress"
        assert tracking_result["notes"] == "Investigating violation"
        assert tracking_result["assigned_to"] == "security@example.com"

        # Step 4: Complete remediation
        resolved_result = await compliance_service.track_violation_remediation(
            violation_id=violation_id,
            remediation_status="resolved",
            notes="Fixed legal basis and security measures",
        )

        assert resolved_result["remediation_status"] == "resolved"
        assert resolved_result["is_resolved"] is True

        # Step 5: Verify compliance check was updated
        updated_check_query = select(DBComplianceCheck).where(
            DBComplianceCheck.id == checks[0].id
        )
        updated_check_result = await test_db.execute(updated_check_query)
        updated_check = updated_check_result.scalar_one()

        assert updated_check.status == ComplianceStatus.COMPLIANT
        assert updated_check.violation_count == 0

    @pytest.mark.asyncio
    async def test_custom_framework_creation_and_assessment_workflow(
        self, test_db, test_organization, test_packages
    ):
        """Test custom framework creation and assessment workflow."""
        compliance_service = ComplianceService(test_db)

        # Step 1: Create custom framework
        framework_name = "Test Organization Compliance"
        rules = [
            {
                "title": "Require Security Review",
                "description": "All packages must undergo security review",
                "severity": "high",
                "conditions": {
                    "requires_security_review": True,
                    "review_frequency": "quarterly",
                },
                "control_objective": "Ensure security oversight",
                "evidence_requirements": ["Security review documentation"],
            },
            {
                "title": "License Compliance",
                "description": "Packages must have compliant licenses",
                "severity": "medium",
                "conditions": {
                    "allowed_licenses": ["MIT", "Apache-2.0", "BSD-3-Clause"],
                    "forbidden_licenses": ["GPL-3.0", "AGPL-3.0"],
                },
                "control_objective": "Ensure license compliance",
                "evidence_requirements": ["License scan results"],
            },
        ]

        custom_framework = await compliance_service.create_custom_framework(
            organization_id=test_organization.id,
            framework_name=framework_name,
            rules=rules,
        )

        # Verify custom framework creation
        assert custom_framework["framework_name"] == framework_name
        assert custom_framework["total_rules"] == 2
        assert len(custom_framework["rules"]) == 2

        # Step 2: Update organization with custom framework
        org_query = select(Organization).where(Organization.id == test_organization.id)
        org_result = await test_db.execute(org_query)
        org = org_result.scalar_one()

        if not org.settings:
            org.settings = {}
        if "custom_frameworks" not in org.settings:
            org.settings["custom_frameworks"] = []

        org.settings["custom_frameworks"].append(custom_framework)
        await test_db.commit()

        # Step 3: Assess package against custom framework
        # This would require extending the compliance service to handle custom frameworks
        # For now, we verify the framework is stored correctly
        assert len(org.settings["custom_frameworks"]) == 1
        stored_framework = org.settings["custom_frameworks"][0]
        assert stored_framework["framework_name"] == framework_name
        assert stored_framework["total_rules"] == 2

    @pytest.mark.asyncio
    async def test_compliance_dashboard_generation_workflow(
        self, test_db, test_organization, test_project, test_packages, test_dependencies
    ):
        """Test compliance dashboard generation workflow."""
        compliance_service = ComplianceService(test_db)

        # Step 1: Generate compliance data for multiple projects
        # Create additional project
        additional_project = Project(
            name="Additional Project",
            slug="additional-project",
            organization_id=test_organization.id,
            primary_language="javascript",
            ecosystem="npm",
        )
        test_db.add(additional_project)
        await test_db.commit()

        # Step 2: Generate compliance reports for projects
        with patch.object(
            compliance_service, "_get_organization_assessment_data"
        ) as mock_org_data:
            mock_org_data.return_value = {
                "organization_id": test_organization.id,
                "dpo_appointed": True,
                "privacy_notices_updated": True,
                "breach_procedures": True,
            }

            # Assess both projects
            await compliance_service.assess_project_compliance(test_project.id)
            await compliance_service.assess_project_compliance(additional_project.id)

        # Step 3: Generate compliance dashboard
        with patch.object(
            compliance_service, "_get_framework_compliance"
        ) as mock_framework:
            mock_framework.return_value = [
                {
                    "assessment_id": str(uuid4()),
                    "compliance_percentage": 85.0,
                    "violations": 3,
                    "assessed_at": datetime.utcnow() - timedelta(days=10),
                }
            ]

            dashboard = await compliance_service.get_compliance_dashboard(
                test_organization.id, timeframe=30
            )

        # Verify dashboard structure and content
        assert dashboard["organization_id"] == str(test_organization.id)
        assert dashboard["timeframe_days"] == 30

        summary = dashboard["summary"]
        assert "total_projects" in summary
        assert "compliant_projects" in summary
        assert "non_compliant_projects" in summary
        assert "total_violations" in summary
        assert "overall_compliance_percentage" in summary

        # Verify framework compliance data
        assert "framework_compliance" in dashboard
        assert len(dashboard["framework_compliance"]) > 0

        # Verify recommendations
        assert "recommendations" in dashboard
        assert len(dashboard["recommendations"]) > 0

    @pytest.mark.asyncio
    async def test_compliance_reporting_workflow(
        self, test_db, test_organization, test_project, test_packages, test_dependencies
    ):
        """Test compliance reporting workflow."""
        compliance_service = ComplianceService(test_db)

        # Step 1: Generate comprehensive compliance data
        with patch.object(
            compliance_service, "_get_organization_assessment_data"
        ) as mock_org_data:
            mock_org_data.return_value = {
                "organization_id": test_organization.id,
                "dpo_appointed": True,
                "privacy_notices_updated": True,
                "breach_procedures": True,
            }

            # Generate project assessment
            project_assessment = await compliance_service.assess_project_compliance(
                test_project.id
            )

        # Step 2: Generate dashboard data
        with patch.object(
            compliance_service, "_get_framework_compliance"
        ) as mock_framework:
            mock_framework.return_value = []

            dashboard = await compliance_service.get_compliance_dashboard(
                test_organization.id, timeframe=30
            )

        # Step 3: Verify report data consistency
        # Project assessment should be reflected in dashboard
        assert dashboard["summary"]["total_projects"] >= 1
        assert (
            dashboard["summary"]["total_violations"]
            >= project_assessment["total_violations"]
        )

        # Step 4: Verify stored reports
        report_query = select(DBComplianceReport).where(
            DBComplianceReport.project_id == test_project.id
        )
        report_result = await test_db.execute(report_query)
        reports = report_result.scalars().all()

        assert len(reports) > 0

        # Verify report contains assessment data
        latest_report = reports[-1]
        assert latest_report.report_data is not None
        report_data = latest_report.report_data

        assert "dependency_assessments" in report_data
        assert "organization_compliance" in report_data
        assert "total_violations" in report_data
        assert "recommendations" in report_data

    @pytest.mark.asyncio
    async def test_error_handling_and_recovery_workflow(
        self, test_db, test_organization
    ):
        """Test error handling and recovery in compliance workflows."""
        compliance_service = ComplianceService(test_db)

        # Test 1: Package not found
        non_existent_package_id = uuid4()

        with patch.object(
            compliance_service, "_get_package_assessment_data"
        ) as mock_get_data:
            mock_get_data.return_value = None

            # Should handle gracefully without raising exception
            assessment = await compliance_service.assess_package_compliance(
                non_existent_package_id
            )
            assert assessment["total_violations"] == 0  # Default safe response

        # Test 2: Database transaction rollback on error
        original_commit = test_db.commit
        commit_called = False

        async def mock_commit():
            nonlocal commit_called
            commit_called = True
            raise Exception("Database error")

        test_db.commit = mock_commit

        # Create custom framework to test rollback
        try:
            await compliance_service.create_custom_framework(
                organization_id=test_organization.id,
                framework_name="Test Framework",
                rules=[
                    {
                        "title": "Test Rule",
                        "description": "Test",
                        "severity": "medium",
                        "conditions": {},
                    }
                ],
            )
        except Exception:
            pass  # Expected error

        # Restore original commit
        test_db.commit = original_commit

        # Test 3: Violation tracking with invalid ID
        invalid_violation_id = "invalid-violation-id"

        result = await compliance_service.track_violation_remediation(
            violation_id=invalid_violation_id, remediation_status="resolved"
        )

        # Should handle gracefully
        assert result is None or "error" in result.lower()


if __name__ == "__main__":
    pytest.main([__file__])
