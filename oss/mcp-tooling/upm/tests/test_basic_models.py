"""
Basic test to verify UPM database models work correctly.

This test file validates that all models can be imported
and instantiated without errors, providing a basic sanity check
for the database schema implementation.
"""

import sys
import os

# Add src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from uuid import uuid4
from datetime import datetime


def test_model_imports():
    """Test that all model classes can be imported successfully."""
    print("Testing model imports...")

    try:
        # Import all model classes
        from udp.core.models.base import (
            BaseModel,
            UUIDMixin,
            TimestampMixin,
            SoftDeleteMixin,
        )
        from udp.core.models.user import User, UserStatus
        from udp.core.models.organization import (
            Organization,
            OrganizationMember,
            OrganizationRole,
        )
        from udp.core.models.project import Project, ProjectStatus, ProjectType
        from udp.core.models.package import Package, PackageVersion
        from udp.core.models.dependency import (
            Dependency,
            DependencyResolution,
            DependencyScope,
            DependencyStatus,
        )
        from udp.core.models.vulnerability import (
            Vulnerability,
            VulnerabilitySeverity,
            VulnerabilityStatus,
            PackageVulnerability,
            ProjectVulnerability,
        )
        from udp.core.models.policy import (
            Policy,
            PolicyFramework,
            PolicyRuleType,
            PolicyStatus,
            PolicyEvaluation,
            PolicyEvaluationStatus,
        )
        from udp.core.models.workflow import (
            Workflow,
            WorkflowType,
            WorkflowStatus,
            WorkflowExecution,
            AnalysisSession,
        )

        print("✅ All model imports successful")
        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during imports: {e}")
        return False


def test_model_instantiation():
    """Test that model classes can be instantiated with basic data."""
    print("Testing model instantiation...")

    try:
        # Test User model
        user = User(email="test@example.com", username="testuser", name="Test User")
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.name == "Test User"
        assert user.status == UserStatus.ACTIVE

        # Test Organization model
        org = Organization(
            name="Test Organization", slug="test-org", description="A test organization"
        )
        assert org.name == "Test Organization"
        assert org.slug == "test-org"
        assert org.status == "active"

        # Test Project model
        project = Project(
            organization_id=org.id,
            name="Test Project",
            slug="test-project",
            primary_language="Python",
            ecosystem="pypi",
        )
        assert project.name == "Test Project"
        assert project.slug == "test-project"
        assert project.organization_id == org.id
        assert project.status == ProjectStatus.ACTIVE

        # Test Package model
        package = Package(
            name="test-package",
            ecosystem="pypi",
            description="A test package",
            license="MIT",
            latest_version="1.0.0",
        )
        assert package.name == "test-package"
        assert package.ecosystem == "pypi"
        assert package.latest_version == "1.0.0"

        # Test Vulnerability model
        vulnerability = Vulnerability(
            cve_id="CVE-2021-1234",
            source="NVD",
            title="Test Vulnerability",
            description="A test vulnerability",
            severity=VulnerabilitySeverity.HIGH,
            cvss_score=7.5,
        )
        assert vulnerability.cve_id == "CVE-2021-1234"
        assert vulnerability.severity == VulnerabilitySeverity.HIGH
        assert vulnerability.cvss_score == 7.5

        # Test Dependency model
        dependency = Dependency(
            project_id=project.id,
            package_id=package.id,
            version_constraint=">=1.0.0",
            ecosystem="pypi",
        )
        assert dependency.project_id == project.id
        assert dependency.package_id == package.id
        assert dependency.version_constraint == ">=1.0.0"
        assert dependency.is_direct is True

        # Test Workflow model
        workflow = Workflow(
            name="Test Workflow",
            workflow_type=WorkflowType.DEPENDENCY_ANALYSIS,
            description="A test workflow",
        )
        assert workflow.name == "Test Workflow"
        assert workflow.workflow_type == WorkflowType.DEPENDENCY_ANALYSIS

        # Test Policy model
        policy = Policy(
            name="Test Policy",
            rule_type=PolicyRuleType.SECURITY,
            description="A test policy",
            severity="medium",
        )
        assert policy.name == "Test Policy"
        assert policy.rule_type == PolicyRuleType.SECURITY

        print("✅ All model instantiations successful")
        return True

    except Exception as e:
        print(f"❌ Model instantiation error: {e}")
        return False


def test_relationship_methods():
    """Test that model relationship methods work correctly."""
    print("Testing model relationship methods...")

    try:
        # Test User password methods
        user = User(email="test@example.com", username="testuser")

        # Test password operations
        user.set_password("securepassword123")
        assert user.check_password("securepassword123") is True
        assert user.check_password("wrongpassword") is False
        assert user.password_hash is not None
        assert user.password_changed_at is not None

        # Test failed login tracking
        user.record_failed_login()
        assert user.failed_login_attempts == "1"

        user.reset_failed_logins()
        assert user.failed_login_attempts == "0"
        assert user.account_locked_until is None

        # Test Organization settings
        org = Organization(name="Test Org", slug="test-org")

        org.set_setting("auto_scan", True)
        org.set_setting("max_projects", 100)

        settings = org.get_metadata()
        assert settings["auto_scan"] is True
        assert settings["max_projects"] == 100

        # Test Project metadata
        project = Project(name="Test Project", slug="test-project")

        project.set_metadata("analysis_config", {"deep": True})
        project.add_metadata("tags", ["security", "performance"])

        metadata = project.get_metadata()
        assert metadata["analysis_config"]["deep"] is True
        assert "security" in metadata["tags"]

        # Test Package vulnerability info
        package = Package(name="test-package", ecosystem="pypi")
        package.vulnerabilities = [
            PackageVulnerability(
                vulnerability=Vulnerability(
                    title="Test Vuln", severity=VulnerabilitySeverity.MEDIUM
                ),
                affected_versions=["1.0.0"],
            )
        ]

        assert package.has_vulnerabilities is True
        assert package.critical_vulnerability_count == 0

        print("✅ All model relationship methods work correctly")
        return True

    except Exception as e:
        print(f"❌ Relationship methods error: {e}")
        return False


def test_enums():
    """Test that all enum values are valid."""
    print("Testing enum values...")

    try:
        # Test UserStatus enum
        assert UserStatus.ACTIVE == "active"
        assert UserStatus.INACTIVE == "inactive"

        # Test ProjectType enum
        assert ProjectType.MAVEN == "maven"
        assert ProjectType.POLYGLOT == "polyglot"

        # Test VulnerabilitySeverity enum
        assert VulnerabilitySeverity.CRITICAL == "critical"
        assert VulnerabilitySeverity.HIGH == "high"

        # Test DependencyScope enum
        assert DependencyScope.COMPILE == "compile"
        assert DependencyScope.RUNTIME == "runtime"

        # Test WorkflowType enum
        assert WorkflowType.DEPENDENCY_ANALYSIS == "dependency_analysis"
        assert WorkflowType.SECURITY_SCAN == "security_scan"

        print("✅ All enum values are valid")
        return True

    except Exception as e:
        print(f"❌ Enum test error: {e}")
        return False


def main():
    """Run all basic model tests."""
    print("🔍 Running basic UPM database model tests...\n")

    tests = [
        ("Model Imports", test_model_imports),
        ("Model Instantiation", test_model_instantiation),
        ("Relationship Methods", test_relationship_methods),
        ("Enum Values", test_enums),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n📋 Testing: {test_name}")
        if test_func():
            print(f"✅ {test_name}: PASSED")
            passed += 1
        else:
            print(f"❌ {test_name}: FAILED")

    print(f"\n📊 Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All basic model tests PASSED!")
        return 0
    else:
        print("💥 Some basic model tests FAILED!")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
