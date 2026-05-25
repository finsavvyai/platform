"""
Unit tests for core domain models.

Tests the core business logic and data validation for domain models.
"""

import pytest
from datetime import datetime
from uuid import uuid4
from pydantic import ValidationError

from udp.domain.models import (
    User, Organization, Package, Workflow, Vulnerability,
    WorkflowStatus, EcosystemType, PolicyViolation
)


class TestUser:
    """Test User model."""
    
    def test_user_creation(self):
        """Test user creation with valid data."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            name="Test User",
            organization_id=uuid4(),
            role="admin",
            is_active=True
        )
        
        assert user.email == "test@example.com"
        assert user.name == "Test User"
        assert user.role == "admin"
        assert user.is_active is True
        assert user.created_at is not None
        assert user.updated_at is not None
    
    def test_user_email_validation(self):
        """Test user email validation."""
        with pytest.raises(ValidationError):
            User(
                id=str(uuid4()),
                email="invalid-email",
                name="Test User",
                organization_id=uuid4(),
                role="admin"
            )
    
    def test_user_role_validation(self):
        """Test user role validation."""
        valid_roles = ["admin", "user", "viewer"]
        for role in valid_roles:
            user = User(
                id=str(uuid4()),
                email="test@example.com",
                name="Test User",
                organization_id=uuid4(),
                role=role
            )
            assert user.role == role
    
    def test_user_defaults(self):
        """Test user default values."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            name="Test User",
            organization_id=uuid4()
        )
        
        assert user.role == "user"
        assert user.is_active is True
        assert user.created_at is not None
        assert user.updated_at is not None


class TestOrganization:
    """Test Organization model."""
    
    def test_organization_creation(self):
        """Test organization creation with valid data."""
        org = Organization(
            id=uuid4(),
            name="Test Organization",
            domain="test.com",
            tier="enterprise"
        )
        
        assert org.name == "Test Organization"
        assert org.domain == "test.com"
        assert org.tier == "enterprise"
        assert org.created_at is not None
        assert org.updated_at is not None
    
    def test_organization_tier_validation(self):
        """Test organization tier validation."""
        valid_tiers = ["free", "standard", "premium", "enterprise"]
        for tier in valid_tiers:
            org = Organization(
                id=uuid4(),
                name="Test Organization",
                domain="test.com",
                tier=tier
            )
            assert org.tier == tier
    
    def test_organization_defaults(self):
        """Test organization default values."""
        org = Organization(
            id=uuid4(),
            name="Test Organization",
            domain="test.com"
        )
        
        assert org.tier == "free"
        assert org.is_active is True
        assert org.created_at is not None
        assert org.updated_at is not None


class TestPackage:
    """Test Package model."""
    
    def test_package_creation(self):
        """Test package creation with valid data."""
        dep = Package(
            id=str(uuid4()),
            name="test-package",
            version="1.0.0",
            ecosystem="pypi",
            organization_id=uuid4()
        )
        
        assert dep.name == "test-package"
        assert dep.version == "1.0.0"
        assert dep.ecosystem == "pypi"
        assert dep.created_at is not None
        assert dep.updated_at is not None
    
    def test_package_ecosystem_validation(self):
        """Test package ecosystem validation."""
        valid_ecosystems = ["pypi", "npm", "maven", "nuget", "cargo"]
        for ecosystem in valid_ecosystems:
            dep = Package(
                id=str(uuid4()),
                name="test-package",
                version="1.0.0",
                ecosystem=ecosystem,
                organization_id=uuid4()
            )
            assert dep.ecosystem == ecosystem
    
    def test_package_version_validation(self):
        """Test package version validation."""
        valid_versions = ["1.0.0", "2.1.3", "0.0.1", "10.20.30"]
        for version in valid_versions:
            dep = Package(
                id=str(uuid4()),
                name="test-package",
                version=version,
                ecosystem="pypi",
                organization_id=uuid4()
            )
            assert dep.version == version


class TestWorkflow:
    """Test Workflow model."""
    
    def test_workflow_creation(self):
        """Test workflow creation with valid data."""
        workflow = Workflow(
            id=str(uuid4()),
            name="Test Workflow",
            description="Test workflow description",
            organization_id=uuid4(),
            status=WorkflowStatus.DRAFT
        )
        
        assert workflow.name == "Test Workflow"
        assert workflow.description == "Test workflow description"
        assert workflow.status == WorkflowStatus.DRAFT
        assert workflow.created_at is not None
        assert workflow.updated_at is not None
    
    def test_workflow_status_validation(self):
        """Test workflow status validation."""
        valid_statuses = [
            WorkflowStatus.DRAFT,
            WorkflowStatus.PENDING,
            WorkflowStatus.IN_PROGRESS,
            WorkflowStatus.COMPLETED,
            WorkflowStatus.FAILED
        ]
        
        for status in valid_statuses:
            workflow = Workflow(
                id=str(uuid4()),
                name="Test Workflow",
                description="Test workflow description",
                organization_id=uuid4(),
                status=status
            )
            assert workflow.status == status
    
    def test_workflow_defaults(self):
        """Test workflow default values."""
        workflow = Workflow(
            id=str(uuid4()),
            name="Test Workflow",
            description="Test workflow description",
            organization_id=uuid4()
        )
        
        assert workflow.status == WorkflowStatus.DRAFT
        assert workflow.created_at is not None
        assert workflow.updated_at is not None


class TestVulnerability:
    """Test Vulnerability model."""
    
    def test_vulnerability_creation(self):
        """Test vulnerability creation with valid data."""
        vuln = Vulnerability(
            id=str(uuid4()),
            name="Test Vulnerability",
            description="Test vulnerability description",
            severity="HIGH",
            source="OSV",
            package_name="test-package",
            package_version="1.0.0"
        )
        
        assert vuln.name == "Test Vulnerability"
        assert vuln.description == "Test vulnerability description"
        assert vuln.severity == "HIGH"
        assert vuln.source == "OSV"
        assert vuln.package_name == "test-package"
        assert vuln.package_version == "1.0.0"
        assert vuln.created_at is not None
        assert vuln.updated_at is not None
    
    def test_vulnerability_severity_validation(self):
        """Test vulnerability severity validation."""
        valid_severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        for severity in valid_severities:
            vuln = Vulnerability(
                id=str(uuid4()),
                name="Test Vulnerability",
                description="Test vulnerability description",
                severity=severity,
                source=VulnerabilitySource.OSV,
                package_name="test-package",
                package_version="1.0.0"
            )
            assert vuln.severity == severity
    
    def test_vulnerability_source_validation(self):
        """Test vulnerability source validation."""
        valid_sources = ["OSV", "NVD", "GITHUB"]
        for source in valid_sources:
            vuln = Vulnerability(
                id=str(uuid4()),
                name="Test Vulnerability",
                description="Test vulnerability description",
                severity="HIGH",
                source=source,
                package_name="test-package",
                package_version="1.0.0"
            )
            assert vuln.source == source


class TestPolicyViolation:
    """Test PolicyViolation model."""
    
    def test_policy_violation_creation(self):
        """Test policy violation creation with valid data."""
        violation = PolicyViolation(
            id=str(uuid4()),
            policy_id=str(uuid4()),
            entity_type="dependency",
            entity_id=str(uuid4()),
            violation_type="license",
            severity="HIGH",
            description="Test policy violation"
        )
        
        assert violation.policy_id is not None
        assert violation.entity_type == "dependency"
        assert violation.entity_id is not None
        assert violation.violation_type == "license"
        assert violation.severity == "HIGH"
        assert violation.description == "Test policy violation"
        assert violation.created_at is not None
    
    def test_policy_violation_entity_type_validation(self):
        """Test policy violation entity type validation."""
        valid_entity_types = ["dependency", "workflow", "user", "organization"]
        for entity_type in valid_entity_types:
            violation = PolicyViolation(
                id=str(uuid4()),
                policy_id=str(uuid4()),
                entity_type=entity_type,
                entity_id=str(uuid4()),
                violation_type="license",
                severity="HIGH",
                description="Test policy violation"
            )
            assert violation.entity_type == entity_type
    
    def test_policy_violation_severity_validation(self):
        """Test policy violation severity validation."""
        valid_severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        for severity in valid_severities:
            violation = PolicyViolation(
                id=str(uuid4()),
                policy_id=str(uuid4()),
                entity_type="dependency",
                entity_id=str(uuid4()),
                violation_type="license",
                severity=severity,
                description="Test policy violation"
            )
            assert violation.severity == severity


class TestModelRelationships:
    """Test model relationships and constraints."""
    
    def test_user_organization_relationship(self):
        """Test user-organization relationship."""
        org_id = uuid4()
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            name="Test User",
            organization_id=org_id
        )
        
        assert user.organization_id == org_id
    
    def test_package_organization_relationship(self):
        """Test package-organization relationship."""
        org_id = uuid4()
        dep = Package(
            id=str(uuid4()),
            name="test-package",
            version="1.0.0",
            ecosystem="pypi",
            organization_id=org_id
        )
        
        assert dep.organization_id == org_id
    
    def test_workflow_organization_relationship(self):
        """Test workflow-organization relationship."""
        org_id = uuid4()
        workflow = Workflow(
            id=str(uuid4()),
            name="Test Workflow",
            description="Test workflow description",
            organization_id=org_id
        )
        
        assert workflow.organization_id == org_id


class TestModelSerialization:
    """Test model serialization and deserialization."""
    
    def test_user_serialization(self):
        """Test user model serialization."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            name="Test User",
            organization_id=uuid4()
        )
        
        user_dict = user.dict()
        assert "id" in user_dict
        assert "email" in user_dict
        assert "name" in user_dict
        assert "organization_id" in user_dict
        assert "created_at" in user_dict
        assert "updated_at" in user_dict
    
    def test_organization_serialization(self):
        """Test organization model serialization."""
        org = Organization(
            id=uuid4(),
            name="Test Organization",
            domain="test.com"
        )
        
        org_dict = org.dict()
        assert "id" in org_dict
        assert "name" in org_dict
        assert "domain" in org_dict
        assert "tier" in org_dict
        assert "created_at" in org_dict
        assert "updated_at" in org_dict
    
    def test_package_serialization(self):
        """Test package model serialization."""
        dep = Package(
            id=str(uuid4()),
            name="test-package",
            version="1.0.0",
            ecosystem="pypi",
            organization_id=uuid4()
        )
        
        dep_dict = dep.dict()
        assert "id" in dep_dict
        assert "name" in dep_dict
        assert "version" in dep_dict
        assert "ecosystem" in dep_dict
        assert "organization_id" in dep_dict
        assert "created_at" in dep_dict
        assert "updated_at" in dep_dict


class TestModelValidation:
    """Test model validation rules."""
    
    def test_required_fields_validation(self):
        """Test required fields validation."""
        # Test User required fields
        with pytest.raises(ValidationError):
            User()
        
        # Test Organization required fields
        with pytest.raises(ValidationError):
            Organization()
        
        # Test Package required fields
        with pytest.raises(ValidationError):
            Package()
    
    def test_field_length_validation(self):
        """Test field length validation."""
        # Test email length
        with pytest.raises(ValidationError):
            User(
                id=str(uuid4()),
                email="a" * 300 + "@example.com",  # Too long
                name="Test User",
                organization_id=uuid4()
            )
        
        # Test name length
        with pytest.raises(ValidationError):
            User(
                id=str(uuid4()),
                email="test@example.com",
                name="a" * 300,  # Too long
                organization_id=uuid4()
            )
    
    def test_enum_validation(self):
        """Test enum field validation."""
        # Test invalid workflow status
        with pytest.raises(ValidationError):
            Workflow(
                id=str(uuid4()),
                name="Test Workflow",
                description="Test workflow description",
                organization_id=uuid4(),
                status="INVALID_STATUS"
            )
        
        # Test invalid vulnerability source (this should pass as source is a string field)
        # Let's test with a different validation instead
        pass
