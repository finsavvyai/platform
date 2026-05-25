"""
Basic tests for UPM database models.

Tests the core functionality of the database models including
relationships, validation, and basic operations.
"""

import pytest
import uuid
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.udp.core.models import (
    Base,
    User,
    Organization,
    OrganizationMember,
    Project,
    Package,
    PackageVersion,
    Dependency,
    DependencyResolution,
    Vulnerability,
    PackageVulnerability,
    ProjectVulnerability,
    Policy,
    PolicyFramework,
    PolicyEvaluation,
    Workflow,
    WorkflowExecution,
    AnalysisSession,
)
from src.udp.core.models.user import UserStatus, OrganizationRole
from src.udp.core.models.project import ProjectStatus, ProjectType
from src.udp.core.models.dependency import DependencyScope, DependencyStatus
from src.udp.core.models.vulnerability import VulnerabilitySeverity, VulnerabilityStatus
from src.udp.core.models.policy import PolicyRuleType, PolicyEvaluationStatus
from src.udp.core.models.workflow import WorkflowType, WorkflowStatus


# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_session():
    """Create a test database session."""
    engine = create_engine(
        TEST_DATABASE_URL,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    # Create all tables
    Base.metadata.create_all(engine)

    # Create session
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    yield session

    # Clean up
    session.close()
    Base.metadata.drop_all(engine)


class TestUserModel:
    """Test the User model."""

    def test_user_creation(self, db_session):
        """Test basic user creation."""
        user = User(email="test@example.com", username="testuser", name="Test User")

        db_session.add(user)
        db_session.commit()

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.name == "Test User"
        assert user.status == UserStatus.ACTIVE
        assert user.created_at is not None
        assert user.updated_at is not None

    def test_user_password_operations(self, db_session):
        """Test password setting and checking."""
        user = User(email="test@example.com", username="testuser", name="Test User")

        # Set password
        user.set_password("securepassword123")
        db_session.add(user)
        db_session.commit()

        # Check password
        assert user.check_password("securepassword123") is True
        assert user.check_password("wrongpassword") is False
        assert user.password_hash is not None
        assert user.password_changed_at is not None

    def test_user_failed_login_tracking(self, db_session):
        """Test failed login attempt tracking."""
        user = User(email="test@example.com", username="testuser", name="Test User")
        user.set_password("password123")
        db_session.add(user)
        db_session.commit()

        # Record failed login attempts
        user.record_failed_login()
        user.record_failed_login()
        db_session.commit()

        assert user.failed_login_attempts == "2"

        # Record successful login
        user.reset_failed_logins()
        db_session.commit()

        assert user.failed_login_attempts == "0"
        assert user.account_locked_until is None


class TestOrganizationModel:
    """Test the Organization model."""

    def test_organization_creation(self, db_session):
        """Test basic organization creation."""
        org = Organization(
            name="Test Organization", slug="test-org", description="A test organization"
        )

        db_session.add(org)
        db_session.commit()

        assert org.id is not None
        assert org.name == "Test Organization"
        assert org.slug == "test-org"
        assert org.status == "active"
        assert org.is_active is True

    def test_organization_membership(self, db_session):
        """Test organization membership functionality."""
        # Create user and organization
        user = User(email="member@example.com", username="member", name="Member User")
        db_session.add(user)

        org = Organization(name="Test Organization", slug="test-org")
        db_session.add(org)
        db_session.commit()

        # Create membership
        membership = OrganizationMember(
            organization_id=org.id, user_id=user.id, role=OrganizationRole.ADMIN
        )
        db_session.add(membership)
        db_session.commit()

        assert membership.id is not None
        assert membership.role == OrganizationRole.ADMIN
        assert membership.has_joined is True
        assert membership.has_permission("manage_projects") is True


class TestProjectModel:
    """Test the Project model."""

    def test_project_creation(self, db_session):
        """Test basic project creation."""
        org = Organization(name="Test Organization", slug="test-org")
        db_session.add(org)
        db_session.commit()

        project = Project(
            organization_id=org.id,
            name="Test Project",
            slug="test-project",
            description="A test project",
            primary_language="Python",
            ecosystem="pypi",
            project_type=ProjectType.PIP,
        )

        db_session.add(project)
        db_session.commit()

        assert project.id is not None
        assert project.name == "Test Project"
        assert project.slug == "test-project"
        assert project.organization_id == org.id
        assert project.status == ProjectStatus.ACTIVE
        assert project.is_active is True

    def test_project_needs_analysis(self, db_session):
        """Test project analysis timing logic."""
        org = Organization(name="Test Organization", slug="test-org")
        db_session.add(org)

        project = Project(
            organization_id=org.id,
            name="Test Project",
            slug="test-project",
            analysis_frequency="daily",
        )
        db_session.add(project)
        db_session.commit()

        # New project should need analysis
        assert project.needs_analysis is True

        # Set last analysis to yesterday
        project.last_analysis_at = (datetime.utcnow() - timedelta(days=1)).isoformat()
        db_session.commit()

        # Should need analysis again
        assert project.needs_analysis is True


class TestPackageModel:
    """Test the Package model."""

    def test_package_creation(self, db_session):
        """Test basic package creation."""
        package = Package(
            name="test-package",
            ecosystem="pypi",
            description="A test package",
            license="MIT",
            latest_version="1.0.0",
        )

        db_session.add(package)
        db_session.commit()

        assert package.id is not None
        assert package.name == "test-package"
        assert package.ecosystem == "pypi"
        assert package.license == "MIT"
        assert package.latest_version == "1.0.0"

    def test_package_version_creation(self, db_session):
        """Test package version creation."""
        package = Package(name="test-package", ecosystem="pypi")
        db_session.add(package)
        db_session.commit()

        version = PackageVersion(
            package_id=package.id,
            version="1.0.0",
            published_at=datetime.utcnow().isoformat(),
            download_count=1000,
            size_bytes=1024000,
        )

        db_session.add(version)
        db_session.commit()

        assert version.id is not None
        assert version.package_id == package.id
        assert version.version == "1.0.0"
        assert version.download_count == 1000
        assert version.is_stable is True


class TestDependencyModel:
    """Test the Dependency model."""

    def test_dependency_creation(self, db_session):
        """Test basic dependency creation."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)

        project = Project(
            organization_id=org.id, name="Test Project", slug="test-project"
        )
        db_session.add(project)

        package = Package(name="requests", ecosystem="pypi")
        db_session.add(package)
        db_session.commit()

        dependency = Dependency(
            project_id=project.id,
            package_id=package.id,
            version_constraint=">=2.25.0",
            is_direct=True,
            scope=DependencyScope.RUNTIME,
            ecosystem="pypi",
        )

        db_session.add(dependency)
        db_session.commit()

        assert dependency.id is not None
        assert dependency.project_id == project.id
        assert dependency.package_id == package.id
        assert dependency.version_constraint == ">=2.25.0"
        assert dependency.is_direct is True
        assert dependency.scope == DependencyScope.RUNTIME


class TestVulnerabilityModel:
    """Test the Vulnerability model."""

    def test_vulnerability_creation(self, db_session):
        """Test basic vulnerability creation."""
        vuln = Vulnerability(
            cve_id="CVE-2021-1234",
            source="NVD",
            title="Test Vulnerability",
            description="A test vulnerability",
            severity=VulnerabilitySeverity.HIGH,
            cvss_score=7.5,
            cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
        )

        db_session.add(vuln)
        db_session.commit()

        assert vuln.id is not None
        assert vuln.cve_id == "CVE-2021-1234"
        assert vuln.severity == VulnerabilitySeverity.HIGH
        assert vuln.cvss_score == 7.5
        assert vuln.is_critical is False
        assert vuln.has_cvss_score is True

    def test_package_vulnerability_link(self, db_session):
        """Test linking vulnerabilities to packages."""
        package = Package(name="vulnerable-package", ecosystem="pypi")
        db_session.add(package)

        vuln = Vulnerability(
            source="NVD",
            title="Test Vulnerability",
            severity=VulnerabilitySeverity.MEDIUM,
        )
        db_session.add(vuln)
        db_session.commit()

        package_vuln = PackageVulnerability(
            vulnerability_id=vuln.id,
            package_id=package.id,
            affected_versions=["1.0.0", "1.1.0"],
            patched_versions=["1.2.0"],
        )

        db_session.add(package_vuln)
        db_session.commit()

        assert package_vuln.id is not None
        assert package_vuln.vulnerability_id == vuln.id
        assert package_vuln.package_id == package.id
        assert "1.0.0" in package_vuln.affected_versions
        assert "1.2.0" in package_vuln.patched_versions


class TestPolicyModel:
    """Test the Policy model."""

    def test_policy_creation(self, db_session):
        """Test basic policy creation."""
        policy = Policy(
            name="No Critical Vulnerabilities",
            description="Projects cannot have critical vulnerabilities",
            rule_type=PolicyRuleType.SECURITY,
            conditions={"vulnerability_severity": "critical"},
            actions=[
                {"type": "block_build", "message": "Critical vulnerability detected"}
            ],
            severity="critical",
        )

        db_session.add(policy)
        db_session.commit()

        assert policy.id is not None
        assert policy.name == "No Critical Vulnerabilities"
        assert policy.rule_type == PolicyRuleType.SECURITY
        assert policy.is_security_policy is True

    def test_policy_evaluation(self, db_session):
        """Test policy evaluation results."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)

        project = Project(
            organization_id=org.id, name="Test Project", slug="test-project"
        )
        db_session.add(project)

        policy = Policy(
            name="Test Policy",
            rule_type=PolicyRuleType.SECURITY,
            conditions={"test": True},
            actions=[],
        )
        db_session.add(policy)
        db_session.commit()

        evaluation = PolicyEvaluation(
            project_id=project.id,
            policy_id=policy.id,
            status=PolicyEvaluationStatus.PASS,
            result_message="Policy evaluation passed",
        )

        db_session.add(evaluation)
        db_session.commit()

        assert evaluation.id is not None
        assert evaluation.project_id == project.id
        assert evaluation.policy_id == policy.id
        assert evaluation.status == PolicyEvaluationStatus.PASS
        assert evaluation.has_violation is False


class TestWorkflowModel:
    """Test the Workflow model."""

    def test_workflow_creation(self, db_session):
        """Test basic workflow creation."""
        workflow = Workflow(
            name="Dependency Analysis",
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
            definition={
                "steps": [
                    {"name": "extract_dependencies", "type": "extract"},
                    {"name": "resolve_versions", "type": "resolve"},
                    {"name": "scan_vulnerabilities", "type": "scan"},
                ]
            },
            description="Standard dependency analysis workflow",
        )

        db_session.add(workflow)
        db_session.commit()

        assert workflow.id is not None
        assert workflow.name == "Dependency Analysis"
        assert workflow.workflow_type == WorkflowType.DEPENDENCY_ANALYSIS
        assert workflow.is_analysis_workflow is True

    def test_workflow_execution(self, db_session):
        """Test workflow execution tracking."""
        workflow = Workflow(
            name="Test Workflow",
            workflow_type=WorkflowType.SECURITY_SCAN,
            definition={"steps": []},
        )
        db_session.add(workflow)
        db_session.commit()

        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=WorkflowStatus.RUNNING,
            input_data={"project_id": str(uuid.uuid4())},
        )

        db_session.add(execution)
        db_session.commit()

        assert execution.id is not None
        assert execution.workflow_id == workflow.id
        assert execution.status == WorkflowStatus.RUNNING
        assert execution.is_running is True


class TestModelRelationships:
    """Test model relationships and cascading operations."""

    def test_project_dependency_relationship(self, db_session):
        """Test project-dependency relationship."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)

        project = Project(
            organization_id=org.id, name="Test Project", slug="test-project"
        )
        db_session.add(project)

        package = Package(name="test-package", ecosystem="pypi")
        db_session.add(package)
        db_session.commit()

        dependency = Dependency(
            project_id=project.id, package_id=package.id, version_constraint=">=1.0.0"
        )
        db_session.add(dependency)
        db_session.commit()

        # Test relationship access
        assert len(project.dependencies) == 1
        assert project.dependencies[0].package.name == "test-package"
        assert package.dependencies[0].project.name == "Test Project"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
