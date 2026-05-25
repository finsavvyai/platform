"""
Basic tests for database models.

Tests core model functionality including creation, relationships,
and basic operations.
"""

import pytest
from datetime import datetime, timedelta
import uuid

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
    Vulnerability,
    PackageVulnerability,
    ProjectVulnerability,
    OrganizationRole,
    UserStatus,
    ProjectStatus,
    DependencyScope,
    VulnerabilitySeverity,
    VulnerabilityStatus,
)


@pytest.fixture
def in_memory_db():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(in_memory_db):
    """Create a database session for testing."""
    Session = sessionmaker(bind=in_memory_db)
    session = Session()
    yield session
    session.close()


class TestBaseModel:
    """Test BaseModel functionality."""

    def test_uuid_generation(self, db_session):
        """Test that UUIDs are generated automatically."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        assert org.id is not None
        assert isinstance(org.id, uuid.UUID)

    def test_timestamps(self, db_session):
        """Test that timestamps are set automatically."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        assert org.created_at is not None
        assert org.updated_at is not None
        assert isinstance(org.created_at, datetime)
        assert isinstance(org.updated_at, datetime)

    def test_soft_delete(self, db_session):
        """Test soft delete functionality."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        # Should not be deleted initially
        assert not org.is_deleted

        # Soft delete
        org.soft_delete()
        db_session.commit()

        assert org.is_deleted
        assert org.deleted_at is not None

    def test_metadata_operations(self, db_session):
        """Test metadata operations."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        # Test setting and getting metadata
        org.set_metadata("key1", "value1")
        org.add_metadata("key2", "value2")
        db_session.commit()

        metadata = org.get_metadata()
        assert metadata["key1"] == "value1"
        assert metadata["key2"] == "value2"

        # Test removing metadata
        org.remove_metadata("key1")
        db_session.commit()

        metadata = org.get_metadata()
        assert "key1" not in metadata
        assert "key2" in metadata


class TestUserModel:
    """Test User model functionality."""

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
        assert user.email_verified is False

    def test_password_management(self, db_session):
        """Test password hashing and verification."""
        user = User(email="test@example.com", username="testuser")
        user.set_password("securepassword123")
        db_session.add(user)
        db_session.commit()

        # Password should be hashed
        assert user.password_hash is not None
        assert user.password_hash != "securepassword123"

        # Should verify correct password
        assert user.check_password("securepassword123") is True

        # Should reject incorrect password
        assert user.check_password("wrongpassword") is False

    def test_mfa_functionality(self, db_session):
        """Test MFA functionality."""
        user = User(email="test@example.com", username="testuser")
        db_session.add(user)
        db_session.commit()

        # Initially MFA should be disabled
        assert user.mfa_enabled is False
        assert user.mfa_secret is None

        # Enable MFA
        secret = user.enable_mfa()
        db_session.commit()

        assert user.mfa_enabled is True
        assert user.mfa_secret is not None
        assert secret is not None

        # Generate backup codes
        backup_codes = user.generate_backup_codes()
        db_session.commit()

        assert len(backup_codes) == 10
        assert len(user.backup_codes) == 10

        # Verify backup code
        test_code = backup_codes[0]
        assert user.verify_backup_code(test_code) is True
        assert test_code not in user.backup_codes  # Should be consumed

    def test_login_attempt_tracking(self, db_session):
        """Test login attempt tracking."""
        user = User(email="test@example.com", username="testuser")
        user.set_password("password123")
        db_session.add(user)
        db_session.commit()

        # Successful login
        user.record_login_attempt(success=True, ip_address="192.168.1.1")
        db_session.commit()

        assert user.last_login_at is not None
        assert user.last_login_ip == "192.168.1.1"
        assert user.failed_login_attempts == "0"

        # Failed login
        user.record_login_attempt(success=False)
        db_session.commit()

        assert user.failed_login_attempts == "1"

        # Multiple failed attempts should lock account
        for _ in range(5):
            user.record_login_attempt(success=False)
        db_session.commit()

        assert user.is_locked() is True


class TestOrganizationModel:
    """Test Organization model functionality."""

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
        assert org.description == "A test organization"
        assert org.subscription_tier == "free"
        assert org.is_active is True

    def test_organization_membership(self, db_session):
        """Test organization membership functionality."""
        # Create organization and user
        org = Organization(name="Test Org", slug="test-org")
        user = User(email="test@example.com", username="testuser")

        db_session.add(org)
        db_session.add(user)
        db_session.commit()

        # Add member
        member = org.add_member(user.id, OrganizationRole.ADMIN)
        db_session.commit()

        assert member.id is not None
        assert member.role == OrganizationRole.ADMIN
        assert member.is_active is True
        assert member.joined_at is None  # Not accepted yet

        # Accept invitation
        member.accept_invitation()
        db_session.commit()

        assert member.joined_at is not None
        assert member.is_active is True

        # Test organization membership checking
        assert org.is_member(user.id) is True
        assert org.get_role(user.id) == OrganizationRole.ADMIN

    def test_organization_permissions(self, db_session):
        """Test organization permission checking."""
        org = Organization(name="Test Org", slug="test-org")
        owner_user = User(email="owner@example.com", username="owner")
        member_user = User(email="member@example.com", username="member")

        db_session.add_all([org, owner_user, member_user])
        db_session.commit()

        # Add owner and member
        org.add_member(owner_user.id, OrganizationRole.OWNER)
        org.add_member(member_user.id, OrganizationRole.MEMBER)
        db_session.commit()

        # Test permissions
        assert org.has_permission(owner_user.id, "project:create") is True
        assert (
            org.has_permission(owner_user.id, "any:permission") is True
        )  # Owner has all

        assert org.has_permission(member_user.id, "project:create") is True
        assert org.has_permission(member_user.id, "project:delete") is False
        assert org.has_permission(member_user.id, "nonexistent:permission") is False


class TestProjectModel:
    """Test Project model functionality."""

    def test_project_creation(self, db_session):
        """Test basic project creation."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        project = Project(
            organization_id=org.id,
            name="Test Project",
            slug="test-project",
            description="A test project",
            primary_language="Python",
            ecosystem="pypi",
        )
        db_session.add(project)
        db_session.commit()

        assert project.id is not None
        assert project.name == "Test Project"
        assert project.organization_id == org.id
        assert project.primary_language == "Python"
        assert project.ecosystem == "pypi"
        assert project.status == ProjectStatus.ACTIVE
        assert project.total_dependencies == 0
        assert project.vulnerability_count == 0

    def test_project_languages_and_frameworks(self, db_session):
        """Test project languages and frameworks management."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        project = Project(
            organization_id=org.id, name="Test Project", slug="test-project"
        )
        db_session.add(project)
        db_session.commit()

        # Add languages
        project.add_language("Python")
        project.add_language("JavaScript")
        db_session.commit()

        assert "Python" in project.languages
        assert "JavaScript" in project.languages
        assert len(project.languages) == 2

        # Remove language
        project.remove_language("JavaScript")
        db_session.commit()

        assert "Python" in project.languages
        assert "JavaScript" not in project.languages
        assert len(project.languages) == 1

        # Add frameworks
        project.add_framework("Django")
        project.add_framework("React")
        db_session.commit()

        assert "Django" in project.frameworks
        assert "React" in project.frameworks

    def test_project_security_metrics(self, db_session):
        """Test project security score calculation."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        project = Project(
            organization_id=org.id, name="Test Project", slug="test-project"
        )
        db_session.add(project)
        db_session.commit()

        # Initially should have perfect score
        assert project.get_security_score() == 100.0
        assert project.get_risk_level() == "low"

        # Update with some vulnerabilities
        project.vulnerability_count = 3
        project.critical_vulnerability_count = 1
        project.total_dependencies = 10
        db_session.commit()

        # Score should be reduced
        score = project.get_security_score()
        assert score < 100.0
        assert project.get_risk_level() == "critical"

    def test_project_analysis_tracking(self, db_session):
        """Test project analysis tracking."""
        org = Organization(name="Test Org", slug="test-org")
        db_session.add(org)
        db_session.commit()

        project = Project(
            organization_id=org.id, name="Test Project", slug="test-project"
        )
        db_session.add(project)
        db_session.commit()

        # Initially needs analysis
        assert project.needs_analysis() is True

        # Update analysis metrics
        analysis_result = {
            "total_dependencies": 15,
            "direct_dependencies": 5,
            "security_metrics": {
                "vulnerability_count": 2,
                "critical_vulnerability_count": 0,
            },
        }
        project.update_analysis_metrics(analysis_result)
        db_session.commit()

        # Should have updated metrics
        assert project.last_analysis_at is not None
        assert project.analysis_count == 1
        assert project.total_dependencies == 15
        assert project.direct_dependencies == 5
        assert project.vulnerability_count == 2
        assert project.critical_vulnerability_count == 0

        # Should not need immediate analysis
        assert project.needs_analysis() is False


class TestPackageModel:
    """Test Package model functionality."""

    def test_package_creation(self, db_session):
        """Test basic package creation."""
        package = Package(
            name="requests",
            ecosystem="pypi",
            description="HTTP library for Python",
            license="Apache-2.0",
        )
        db_session.add(package)
        db_session.commit()

        assert package.id is not None
        assert package.name == "requests"
        assert package.ecosystem == "pypi"
        assert package.description == "HTTP library for Python"
        assert package.license == "Apache-2.0"

    def test_package_versions(self, db_session):
        """Test package version management."""
        package = Package(name="requests", ecosystem="pypi", latest_version="2.28.0")
        db_session.add(package)
        db_session.commit()

        # Add versions
        version1 = PackageVersion(
            package_id=package.id,
            version="2.28.0",
            is_latest=True,
            published_at=datetime.utcnow() - timedelta(days=30),
        )
        version2 = PackageVersion(
            package_id=package.id,
            version="2.27.0",
            is_latest=False,
            published_at=datetime.utcnow() - timedelta(days=90),
        )

        db_session.add_all([version1, version2])
        db_session.commit()

        # Test version retrieval
        assert package.get_latest_version() is not None
        assert package.get_latest_version().version == "2.28.0"
        assert package.get_version("2.27.0") is not None
        assert package.get_version("2.27.0").version == "2.27.0"
        assert package.get_version("nonexistent") is None

    def test_package_vulnerability_checking(self, db_session):
        """Test package vulnerability checking."""
        package = Package(name="vulnerable-package", ecosystem="pypi")
        db_session.add(package)
        db_session.commit()

        # Initially no vulnerabilities
        assert package.has_vulnerabilities() is False
        assert package.get_vulnerability_count() == 0

        # Add a vulnerability
        vulnerability = Vulnerability(
            title="Test Vulnerability",
            severity=VulnerabilitySeverity.HIGH,
            source="test",
        )
        db_session.add(vulnerability)
        db_session.commit()

        package_vuln = PackageVulnerability(
            package_id=package.id, vulnerability_id=vulnerability.id
        )
        db_session.add(package_vuln)
        db_session.commit()

        # Should now have vulnerabilities
        assert package.has_vulnerabilities() is True
        assert package.get_vulnerability_count() == 1


class TestVulnerabilityModel:
    """Test Vulnerability model functionality."""

    def test_vulnerability_creation(self, db_session):
        """Test basic vulnerability creation."""
        vuln = Vulnerability(
            cve_id="CVE-2023-1234",
            title="Test Vulnerability",
            description="A test vulnerability for testing",
            severity=VulnerabilitySeverity.HIGH,
            source="test",
        )
        db_session.add(vuln)
        db_session.commit()

        assert vuln.id is not None
        assert vuln.cve_id == "CVE-2023-1234"
        assert vuln.title == "Test Vulnerability"
        assert vuln.severity == VulnerabilitySeverity.HIGH
        assert vuln.status == VulnerabilityStatus.ACTIVE

    def test_vulnerability_scoring(self, db_session):
        """Test vulnerability scoring calculations."""
        vuln = Vulnerability(
            title="Test Vulnerability",
            severity=VulnerabilitySeverity.MEDIUM,
            source="test",
            cvss_score_v3=6.5,
            exploitability_score=7.0,
            attack_vector="network",
        )
        db_session.add(vuln)
        db_session.commit()

        # Test CVSS score retrieval
        assert vuln.get_cvss_score(3) == 6.5
        assert vuln.get_cvss_score(2) is None

        # Test risk score calculation
        risk_score = vuln.get_risk_score()
        assert risk_score > 0
        assert risk_score <= 10.0

    def test_package_vulnerability_relationship(self, db_session):
        """Test package-vulnerability relationship."""
        package = Package(name="test-package", ecosystem="pypi")
        vuln = Vulnerability(
            title="Test Vulnerability",
            severity=VulnerabilitySeverity.CRITICAL,
            source="test",
        )

        db_session.add_all([package, vuln])
        db_session.commit()

        # Create relationship
        package_vuln = PackageVulnerability(
            package_id=package.id,
            vulnerability_id=vuln.id,
            affected_versions=["1.0.0", "1.1.0"],
            patched_versions=["1.2.0"],
        )
        db_session.add(package_vuln)
        db_session.commit()

        # Test relationship
        assert package_vuln.get_severity() == VulnerabilitySeverity.CRITICAL
        assert package_vuln.is_version_affected("1.0.0") is True
        assert package_vuln.is_version_affected("1.2.0") is False
        assert package_vuln.get_recommended_version() == "1.2.0"


if __name__ == "__main__":
    pytest.main([__file__])
