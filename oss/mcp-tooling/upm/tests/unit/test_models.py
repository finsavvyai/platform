"""
Unit tests for core models.

Tests for User, Organization, Project, Dependency, and other core models.
"""

import pytest
from datetime import datetime, timedelta
from pydantic import ValidationError

from udp.core.models import (
    User,
    Organization,
    Project,
    Dependency,
    Vulnerability,
    Workflow,
    Policy,
    Analysis,
    Package,
    License,
)


class TestUser:
    """Test User model."""

    def test_user_creation(self):
        """Test user creation with valid data."""
        user_data = {
            "id": "user-123",
            "username": "testuser",
            "email": "test@example.com",
            "full_name": "Test User",
            "is_active": True,
            "is_admin": False,
            "organization_id": "org-123",
        }

        user = User(**user_data)

        assert user.id == "user-123"
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.is_active is True
        assert user.is_admin is False
        assert user.organization_id == "org-123"
        assert user.created_at is not None
        assert user.updated_at is not None

    def test_user_creation_with_defaults(self):
        """Test user creation with default values."""
        user_data = {
            "id": "user-123",
            "username": "testuser",
            "email": "test@example.com",
            "full_name": "Test User",
        }

        user = User(**user_data)

        assert user.is_active is True
        assert user.is_admin is False
        assert user.organization_id is None
        assert user.created_at is not None
        assert user.updated_at is not None

    def test_user_invalid_email(self):
        """Test user creation with invalid email."""
        user_data = {
            "id": "user-123",
            "username": "testuser",
            "email": "invalid-email",
            "full_name": "Test User",
        }

        with pytest.raises(ValidationError):
            User(**user_data)

    def test_user_username_validation(self):
        """Test username validation."""
        user_data = {
            "id": "user-123",
            "username": "",  # Empty username
            "email": "test@example.com",
            "full_name": "Test User",
        }

        with pytest.raises(ValidationError):
            User(**user_data)

    def test_user_update_timestamp(self):
        """Test that updated_at is set on model update."""
        user = User(
            id="user-123",
            username="testuser",
            email="test@example.com",
            full_name="Test User",
        )

        original_updated_at = user.updated_at

        # Simulate update
        user.full_name = "Updated Name"
        user.updated_at = datetime.utcnow()

        assert user.updated_at > original_updated_at


class TestOrganization:
    """Test Organization model."""

    def test_organization_creation(self):
        """Test organization creation with valid data."""
        org_data = {
            "id": "org-123",
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "enterprise",
            "is_active": True,
            "settings": {
                "max_projects": 100,
                "max_dependencies": 10000,
                "features": ["advanced_analytics", "ml_models"],
            },
        }

        org = Organization(**org_data)

        assert org.id == "org-123"
        assert org.name == "Test Organization"
        assert org.slug == "test-org"
        assert org.plan == "enterprise"
        assert org.is_active is True
        assert org.settings["max_projects"] == 100
        assert org.settings["max_dependencies"] == 10000
        assert "advanced_analytics" in org.settings["features"]

    def test_organization_slug_validation(self):
        """Test organization slug validation."""
        org_data = {
            "id": "org-123",
            "name": "Test Organization",
            "slug": "invalid slug!",  # Invalid slug
            "plan": "enterprise",
        }

        with pytest.raises(ValidationError):
            Organization(**org_data)

    def test_organization_plan_validation(self):
        """Test organization plan validation."""
        org_data = {
            "id": "org-123",
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "invalid-plan",  # Invalid plan
        }

        with pytest.raises(ValidationError):
            Organization(**org_data)

    def test_organization_default_settings(self):
        """Test organization default settings."""
        org_data = {
            "id": "org-123",
            "name": "Test Organization",
            "slug": "test-org",
            "plan": "free",
        }

        org = Organization(**org_data)

        assert org.settings is not None
        assert "max_projects" in org.settings
        assert "max_dependencies" in org.settings
        assert "features" in org.settings


class TestProject:
    """Test Project model."""

    def test_project_creation(self):
        """Test project creation with valid data."""
        project_data = {
            "id": "project-123",
            "name": "Test Project",
            "description": "A test project",
            "organization_id": "org-123",
            "ecosystem": "pypi",
            "package_manager": "pip",
            "is_active": True,
        }

        project = Project(**project_data)

        assert project.id == "project-123"
        assert project.name == "Test Project"
        assert project.description == "A test project"
        assert project.organization_id == "org-123"
        assert project.ecosystem == "pypi"
        assert project.package_manager == "pip"
        assert project.is_active is True

    def test_project_ecosystem_validation(self):
        """Test project ecosystem validation."""
        project_data = {
            "id": "project-123",
            "name": "Test Project",
            "organization_id": "org-123",
            "ecosystem": "invalid-ecosystem",  # Invalid ecosystem
        }

        with pytest.raises(ValidationError):
            Project(**project_data)

    def test_project_package_manager_validation(self):
        """Test project package manager validation."""
        project_data = {
            "id": "project-123",
            "name": "Test Project",
            "organization_id": "org-123",
            "ecosystem": "pypi",
            "package_manager": "invalid-manager",  # Invalid package manager
        }

        with pytest.raises(ValidationError):
            Project(**project_data)


class TestDependency:
    """Test Dependency model."""

    def test_dependency_creation(self):
        """Test dependency creation with valid data."""
        dep_data = {
            "id": "dep-123",
            "name": "requests",
            "version": "2.28.1",
            "ecosystem": "pypi",
            "project_id": "project-123",
            "is_direct": True,
            "license": "Apache-2.0",
            "vulnerabilities": [],
            "metadata": {
                "description": "Python HTTP library",
                "author": "Kenneth Reitz",
            },
        }

        dependency = Dependency(**dep_data)

        assert dependency.id == "dep-123"
        assert dependency.name == "requests"
        assert dependency.version == "2.28.1"
        assert dependency.ecosystem == "pypi"
        assert dependency.project_id == "project-123"
        assert dependency.is_direct is True
        assert dependency.license == "Apache-2.0"
        assert dependency.vulnerabilities == []
        assert dependency.metadata["description"] == "Python HTTP library"

    def test_dependency_version_validation(self):
        """Test dependency version validation."""
        dep_data = {
            "id": "dep-123",
            "name": "requests",
            "version": "",  # Empty version
            "ecosystem": "pypi",
            "project_id": "project-123",
        }

        with pytest.raises(ValidationError):
            Dependency(**dep_data)

    def test_dependency_vulnerabilities(self):
        """Test dependency with vulnerabilities."""
        dep_data = {
            "id": "dep-123",
            "name": "requests",
            "version": "2.28.1",
            "ecosystem": "pypi",
            "project_id": "project-123",
            "vulnerabilities": [
                {"id": "CVE-2023-12345", "severity": "HIGH", "cvss_score": 7.5}
            ],
        }

        dependency = Dependency(**dep_data)

        assert len(dependency.vulnerabilities) == 1
        assert dependency.vulnerabilities[0]["id"] == "CVE-2023-12345"
        assert dependency.vulnerabilities[0]["severity"] == "HIGH"


class TestVulnerability:
    """Test Vulnerability model."""

    def test_vulnerability_creation(self):
        """Test vulnerability creation with valid data."""
        vuln_data = {
            "id": "CVE-2023-12345",
            "title": "Test Vulnerability",
            "description": "A test vulnerability",
            "severity": "HIGH",
            "cvss_score": 7.5,
            "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
            "published_date": datetime.utcnow(),
            "affected_packages": [
                {"name": "requests", "ecosystem": "pypi", "versions": ["<2.28.2"]}
            ],
        }

        vulnerability = Vulnerability(**vuln_data)

        assert vulnerability.id == "CVE-2023-12345"
        assert vulnerability.title == "Test Vulnerability"
        assert vulnerability.severity == "HIGH"
        assert vulnerability.cvss_score == 7.5
        assert len(vulnerability.affected_packages) == 1
        assert vulnerability.affected_packages[0]["name"] == "requests"

    def test_vulnerability_severity_validation(self):
        """Test vulnerability severity validation."""
        vuln_data = {
            "id": "CVE-2023-12345",
            "title": "Test Vulnerability",
            "description": "A test vulnerability",
            "severity": "INVALID",  # Invalid severity
        }

        with pytest.raises(ValidationError):
            Vulnerability(**vuln_data)

    def test_vulnerability_cvss_score_validation(self):
        """Test vulnerability CVSS score validation."""
        vuln_data = {
            "id": "CVE-2023-12345",
            "title": "Test Vulnerability",
            "description": "A test vulnerability",
            "severity": "HIGH",
            "cvss_score": 15.0,  # Invalid CVSS score (max is 10.0)
        }

        with pytest.raises(ValidationError):
            Vulnerability(**vuln_data)


class TestWorkflow:
    """Test Workflow model."""

    def test_workflow_creation(self):
        """Test workflow creation with valid data."""
        workflow_data = {
            "id": "workflow-123",
            "name": "Test Workflow",
            "description": "A test workflow",
            "type": "dependency_scan",
            "status": "active",
            "steps": [
                {
                    "id": "step-1",
                    "name": "Collect Dependencies",
                    "type": "collect_dependencies",
                    "config": {"ecosystem": "pypi"},
                }
            ],
            "triggers": ["manual"],
            "organization_id": "org-123",
        }

        workflow = Workflow(**workflow_data)

        assert workflow.id == "workflow-123"
        assert workflow.name == "Test Workflow"
        assert workflow.type == "dependency_scan"
        assert workflow.status == "active"
        assert len(workflow.steps) == 1
        assert workflow.steps[0]["name"] == "Collect Dependencies"
        assert "manual" in workflow.triggers

    def test_workflow_type_validation(self):
        """Test workflow type validation."""
        workflow_data = {
            "id": "workflow-123",
            "name": "Test Workflow",
            "type": "invalid_type",  # Invalid workflow type
            "status": "active",
            "steps": [],
            "triggers": ["manual"],
        }

        with pytest.raises(ValidationError):
            Workflow(**workflow_data)

    def test_workflow_status_validation(self):
        """Test workflow status validation."""
        workflow_data = {
            "id": "workflow-123",
            "name": "Test Workflow",
            "type": "dependency_scan",
            "status": "invalid_status",  # Invalid status
            "steps": [],
            "triggers": ["manual"],
        }

        with pytest.raises(ValidationError):
            Workflow(**workflow_data)


class TestAlert:
    """Test Alert model."""

    def test_alert_creation(self):
        """Test alert creation with valid data."""
        alert_data = {
            "id": "alert-123",
            "rule_id": "rule-456",
            "title": "High CPU Usage",
            "description": "CPU usage has exceeded 90%",
            "severity": "high",
            "status": "active",
            "timestamp": datetime.utcnow(),
            "metric_name": "system.cpu.percent",
            "metric_value": 92.5,
            "threshold": 90.0,
        }

        alert = Alert(**alert_data)

        assert alert.id == "alert-123"
        assert alert.rule_id == "rule-456"
        assert alert.title == "High CPU Usage"
        assert alert.severity == "high"
        assert alert.status == "active"
        assert alert.metric_name == "system.cpu.percent"
        assert alert.metric_value == 92.5
        assert alert.threshold == 90.0

    def test_alert_severity_validation(self):
        """Test alert severity validation."""
        alert_data = {
            "id": "alert-123",
            "rule_id": "rule-456",
            "title": "Test Alert",
            "description": "A test alert",
            "severity": "invalid",  # Invalid severity
            "status": "active",
            "timestamp": datetime.utcnow(),
            "metric_name": "test.metric",
            "metric_value": 100.0,
            "threshold": 90.0,
        }

        with pytest.raises(ValidationError):
            Alert(**alert_data)


class TestMetric:
    """Test Metric model."""

    def test_metric_creation(self):
        """Test metric creation with valid data."""
        metric_data = {
            "id": "metric-123",
            "name": "system.cpu.percent",
            "value": 45.2,
            "timestamp": datetime.utcnow(),
            "tags": {"service": "api", "environment": "production"},
            "metadata": {"unit": "percent", "type": "gauge"},
        }

        metric = Metric(**metric_data)

        assert metric.id == "metric-123"
        assert metric.name == "system.cpu.percent"
        assert metric.value == 45.2
        assert metric.tags["service"] == "api"
        assert metric.metadata["unit"] == "percent"

    def test_metric_value_types(self):
        """Test metric with different value types."""
        # Test with float value
        metric_float = Metric(
            id="metric-1", name="cpu.percent", value=45.2, timestamp=datetime.utcnow()
        )
        assert metric_float.value == 45.2

        # Test with int value
        metric_int = Metric(
            id="metric-2", name="request.count", value=1000, timestamp=datetime.utcnow()
        )
        assert metric_int.value == 1000

        # Test with string value
        metric_str = Metric(
            id="metric-3",
            name="service.status",
            value="healthy",
            timestamp=datetime.utcnow(),
        )
        assert metric_str.value == "healthy"


class TestDashboard:
    """Test Dashboard model."""

    def test_dashboard_creation(self):
        """Test dashboard creation with valid data."""
        dashboard_data = {
            "id": "dashboard-123",
            "name": "Test Dashboard",
            "description": "A test dashboard",
            "widgets": [
                {
                    "id": "widget-1",
                    "title": "CPU Usage",
                    "type": "metric",
                    "position": {"x": 0, "y": 0, "width": 3, "height": 2},
                    "config": {"metric_name": "system.cpu.percent"},
                }
            ],
            "layout": {"columns": 12, "rows": 8},
            "auto_refresh": True,
            "refresh_interval": 30,
        }

        dashboard = Dashboard(**dashboard_data)

        assert dashboard.id == "dashboard-123"
        assert dashboard.name == "Test Dashboard"
        assert len(dashboard.widgets) == 1
        assert dashboard.widgets[0]["title"] == "CPU Usage"
        assert dashboard.auto_refresh is True
        assert dashboard.refresh_interval == 30

    def test_dashboard_widget_validation(self):
        """Test dashboard widget validation."""
        dashboard_data = {
            "id": "dashboard-123",
            "name": "Test Dashboard",
            "widgets": [
                {
                    "id": "widget-1",
                    "title": "Test Widget",
                    "type": "invalid_type",  # Invalid widget type
                    "position": {"x": 0, "y": 0, "width": 3, "height": 2},
                }
            ],
        }

        with pytest.raises(ValidationError):
            Dashboard(**dashboard_data)


class TestWidget:
    """Test Widget model."""

    def test_widget_creation(self):
        """Test widget creation with valid data."""
        widget_data = {
            "id": "widget-123",
            "title": "CPU Usage",
            "type": "metric",
            "position": {"x": 0, "y": 0, "width": 3, "height": 2},
            "config": {"metric_name": "system.cpu.percent", "unit": "%"},
            "refresh_interval": 30,
            "enabled": True,
        }

        widget = Widget(**widget_data)

        assert widget.id == "widget-123"
        assert widget.title == "CPU Usage"
        assert widget.type == "metric"
        assert widget.position["x"] == 0
        assert widget.position["width"] == 3
        assert widget.config["metric_name"] == "system.cpu.percent"
        assert widget.enabled is True

    def test_widget_type_validation(self):
        """Test widget type validation."""
        widget_data = {
            "id": "widget-123",
            "title": "Test Widget",
            "type": "invalid_type",  # Invalid widget type
            "position": {"x": 0, "y": 0, "width": 3, "height": 2},
        }

        with pytest.raises(ValidationError):
            Widget(**widget_data)

    def test_widget_position_validation(self):
        """Test widget position validation."""
        widget_data = {
            "id": "widget-123",
            "title": "Test Widget",
            "type": "metric",
            "position": {
                "x": -1,
                "y": 0,
                "width": 3,
                "height": 2,
            },  # Invalid x position
        }

        with pytest.raises(ValidationError):
            Widget(**widget_data)


class TestModelRelationships:
    """Test model relationships and constraints."""

    def test_user_organization_relationship(self):
        """Test user-organization relationship."""
        org = Organization(
            id="org-123", name="Test Organization", slug="test-org", plan="enterprise"
        )

        user = User(
            id="user-123",
            username="testuser",
            email="test@example.com",
            full_name="Test User",
            organization_id=org.id,
        )

        assert user.organization_id == org.id

    def test_project_organization_relationship(self):
        """Test project-organization relationship."""
        org = Organization(
            id="org-123", name="Test Organization", slug="test-org", plan="enterprise"
        )

        project = Project(
            id="project-123",
            name="Test Project",
            organization_id=org.id,
            ecosystem="pypi",
        )

        assert project.organization_id == org.id

    def test_dependency_project_relationship(self):
        """Test dependency-project relationship."""
        project = Project(
            id="project-123",
            name="Test Project",
            organization_id="org-123",
            ecosystem="pypi",
        )

        dependency = Dependency(
            id="dep-123",
            name="requests",
            version="2.28.1",
            ecosystem="pypi",
            project_id=project.id,
        )

        assert dependency.project_id == project.id

    def test_workflow_organization_relationship(self):
        """Test workflow-organization relationship."""
        org = Organization(
            id="org-123", name="Test Organization", slug="test-org", plan="enterprise"
        )

        workflow = Workflow(
            id="workflow-123",
            name="Test Workflow",
            type="dependency_scan",
            status="active",
            steps=[],
            triggers=["manual"],
            organization_id=org.id,
        )

        assert workflow.organization_id == org.id


class TestModelSerialization:
    """Test model serialization and deserialization."""

    def test_user_serialization(self):
        """Test user model serialization."""
        user = User(
            id="user-123",
            username="testuser",
            email="test@example.com",
            full_name="Test User",
        )

        # Test to dict
        user_dict = user.dict()
        assert user_dict["id"] == "user-123"
        assert user_dict["username"] == "testuser"
        assert user_dict["email"] == "test@example.com"

        # Test to JSON
        user_json = user.json()
        assert "user-123" in user_json
        assert "testuser" in user_json

    def test_organization_serialization(self):
        """Test organization model serialization."""
        org = Organization(
            id="org-123", name="Test Organization", slug="test-org", plan="enterprise"
        )

        org_dict = org.dict()
        assert org_dict["id"] == "org-123"
        assert org_dict["name"] == "Test Organization"
        assert org_dict["plan"] == "enterprise"

    def test_dependency_serialization(self):
        """Test dependency model serialization."""
        dependency = Dependency(
            id="dep-123",
            name="requests",
            version="2.28.1",
            ecosystem="pypi",
            project_id="project-123",
        )

        dep_dict = dependency.dict()
        assert dep_dict["id"] == "dep-123"
        assert dep_dict["name"] == "requests"
        assert dep_dict["version"] == "2.28.1"
        assert dep_dict["ecosystem"] == "pypi"
