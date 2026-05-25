"""
Unit tests for domain models.
"""
import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from src.udp.domain.models import (
    Package,
    Vulnerability,
    License,
    Organization,
    Policy,
    DependencyGraph,
    Workflow,
    PackageMetadata,
    DependencyRelationship,
    WorkflowState,
    PolicyRule,
    SecurityLevel
)


class TestPackage:
    """Test Package domain model."""
    
    def test_package_creation_with_valid_data(self, sample_package_data):
        """Test creating a package with valid data."""
        package = Package(**sample_package_data)
        
        assert package.name == "express"
        assert package.version == "4.18.2"
        assert package.ecosystem == "npm"
        assert package.description == "Fast, unopinionated, minimalist web framework"
        assert package.license == "MIT"
        assert len(package.dependencies) == 3
        assert package.dependencies["accepts"] == "~1.3.8"
    
    def test_package_creation_with_minimal_data(self):
        """Test creating a package with minimal required data."""
        package = Package(
            name="test-package",
            version="1.0.0",
            ecosystem="npm"
        )
        
        assert package.name == "test-package"
        assert package.version == "1.0.0"
        assert package.ecosystem == "npm"
        assert package.description is None
        assert package.dependencies == {}
    
    def test_package_validation_errors(self):
        """Test package validation with invalid data."""
        with pytest.raises(ValidationError):
            Package(name="", version="1.0.0", ecosystem="npm")
        
        with pytest.raises(ValidationError):
            Package(name="test", version="", ecosystem="npm")
        
        with pytest.raises(ValidationError):
            Package(name="test", version="1.0.0", ecosystem="invalid")
    
    def test_package_ecosystem_validation(self):
        """Test package ecosystem validation."""
        valid_ecosystems = ["npm", "pip", "maven", "cargo", "nuget", "composer", "bundler"]
        
        for ecosystem in valid_ecosystems:
            package = Package(name="test", version="1.0.0", ecosystem=ecosystem)
            assert package.ecosystem == ecosystem
    
    def test_package_metadata_creation(self):
        """Test PackageMetadata creation."""
        metadata = PackageMetadata(
            name="test-package",
            version="1.0.0",
            ecosystem="npm",
            description="Test package",
            homepage="https://example.com",
            repository="https://github.com/example/test-package",
            license="MIT",
            author="Test Author",
            keywords=["test", "package"],
            dependencies={"dep1": "^1.0.0", "dep2": "~2.0.0"}
        )
        
        assert metadata.name == "test-package"
        assert metadata.version == "1.0.0"
        assert metadata.ecosystem == "npm"
        assert len(metadata.keywords) == 2
        assert len(metadata.dependencies) == 2


class TestVulnerability:
    """Test Vulnerability domain model."""
    
    def test_vulnerability_creation_with_valid_data(self, sample_vulnerability_data):
        """Test creating a vulnerability with valid data."""
        vuln = Vulnerability(**sample_vulnerability_data)
        
        assert vuln.cve_id == "CVE-2022-24999"
        assert vuln.package_name == "express"
        assert vuln.package_version == "4.17.0"
        assert vuln.ecosystem == "npm"
        assert vuln.severity == SecurityLevel.HIGH
        assert vuln.cvss_score == 7.5
        assert len(vuln.references) == 1
    
    def test_vulnerability_severity_validation(self):
        """Test vulnerability severity validation."""
        valid_severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        
        for severity in valid_severities:
            vuln = Vulnerability(
                cve_id="CVE-2022-00001",
                package_name="test",
                package_version="1.0.0",
                ecosystem="npm",
                severity=severity,
                description="Test vulnerability",
                cvss_score=5.0
            )
            assert vuln.severity == SecurityLevel(severity)
    
    def test_vulnerability_cvss_score_validation(self):
        """Test CVSS score validation."""
        # Valid scores
        for score in [0.0, 5.5, 10.0]:
            vuln = Vulnerability(
                cve_id="CVE-2022-00001",
                package_name="test",
                package_version="1.0.0",
                ecosystem="npm",
                severity="MEDIUM",
                description="Test vulnerability",
                cvss_score=score
            )
            assert vuln.cvss_score == score
        
        # Invalid scores
        with pytest.raises(ValidationError):
            Vulnerability(
                cve_id="CVE-2022-00001",
                package_name="test",
                package_version="1.0.0",
                ecosystem="npm",
                severity="MEDIUM",
                description="Test vulnerability",
                cvss_score=-1.0
            )
        
        with pytest.raises(ValidationError):
            Vulnerability(
                cve_id="CVE-2022-00001",
                package_name="test",
                package_version="1.0.0",
                ecosystem="npm",
                severity="MEDIUM",
                description="Test vulnerability",
                cvss_score=11.0
            )


class TestLicense:
    """Test License domain model."""
    
    def test_license_creation(self):
        """Test license creation."""
        license_obj = License(
            name="MIT",
            identifier="MIT",
            description="MIT License",
            is_osi_approved=True,
            is_fsf_approved=True,
            is_deprecated=False,
            reference="https://opensource.org/licenses/MIT"
        )
        
        assert license_obj.name == "MIT"
        assert license_obj.identifier == "MIT"
        assert license_obj.is_osi_approved is True
        assert license_obj.is_fsf_approved is True
        assert license_obj.is_deprecated is False


class TestOrganization:
    """Test Organization domain model."""
    
    def test_organization_creation_with_valid_data(self, sample_organization_data):
        """Test creating an organization with valid data."""
        org = Organization(**sample_organization_data)
        
        assert org.name == "Acme Corporation"
        assert org.domain == "acme.com"
        assert org.industry == "Technology"
        assert org.size == "Enterprise"
        assert len(org.compliance_requirements) == 2
        assert "SOX" in org.compliance_requirements
        assert "HIPAA" in org.compliance_requirements
        assert org.settings["auto_approve_low_risk"] is True
    
    def test_organization_size_validation(self):
        """Test organization size validation."""
        valid_sizes = ["Startup", "Small", "Medium", "Enterprise", "Fortune 500"]
        
        for size in valid_sizes:
            org = Organization(
                name="Test Org",
                domain="test.com",
                industry="Technology",
                size=size,
                compliance_requirements=[],
                contact_email="test@test.com"
            )
            assert org.size == size


class TestPolicy:
    """Test Policy domain model."""
    
    def test_policy_creation_with_valid_data(self, sample_policy_data):
        """Test creating a policy with valid data."""
        policy = Policy(**sample_policy_data)
        
        assert policy.name == "Security Policy"
        assert policy.type == "security"
        assert policy.description == "Security vulnerability policy"
        assert len(policy.rules) == 2
        assert policy.is_active is True
        assert policy.organization_id == 1
    
    def test_policy_rule_creation(self):
        """Test PolicyRule creation."""
        rule = PolicyRule(
            condition="severity >= HIGH",
            action="require_approval",
            approver="security_team",
            reason="High severity vulnerability detected"
        )
        
        assert rule.condition == "severity >= HIGH"
        assert rule.action == "require_approval"
        assert rule.approver == "security_team"
        assert rule.reason == "High severity vulnerability detected"
    
    def test_policy_type_validation(self):
        """Test policy type validation."""
        valid_types = ["security", "license", "version", "organizational"]
        
        for policy_type in valid_types:
            policy = Policy(
                name="Test Policy",
                type=policy_type,
                description="Test policy",
                rules=[],
                is_active=True,
                organization_id=1
            )
            assert policy.type == policy_type


class TestDependencyGraph:
    """Test DependencyGraph domain model."""
    
    def test_dependency_graph_creation(self):
        """Test dependency graph creation."""
        nodes = [
            Package(name="express", version="4.18.2", ecosystem="npm"),
            Package(name="accepts", version="1.3.8", ecosystem="npm"),
            Package(name="array-flatten", version="1.1.1", ecosystem="npm")
        ]
        
        edges = [
            DependencyRelationship(
                source="express",
                target="accepts",
                version_constraint="~1.3.8"
            ),
            DependencyRelationship(
                source="express",
                target="array-flatten",
                version_constraint="1.1.1"
            )
        ]
        
        graph = DependencyGraph(nodes=nodes, edges=edges)
        
        assert len(graph.nodes) == 3
        assert len(graph.edges) == 2
        assert graph.has_dependency("express", "accepts")
        assert graph.has_dependency("express", "array-flatten")
    
    def test_dependency_graph_has_dependency(self):
        """Test dependency graph has_dependency method."""
        nodes = [
            Package(name="express", version="4.18.2", ecosystem="npm"),
            Package(name="accepts", version="1.3.8", ecosystem="npm")
        ]
        
        edges = [
            DependencyRelationship(
                source="express",
                target="accepts",
                version_constraint="~1.3.8"
            )
        ]
        
        graph = DependencyGraph(nodes=nodes, edges=edges)
        
        assert graph.has_dependency("express", "accepts") is True
        assert graph.has_dependency("express", "lodash") is False
        assert graph.has_dependency("lodash", "express") is False


class TestWorkflow:
    """Test Workflow domain model."""
    
    def test_workflow_creation(self):
        """Test workflow creation."""
        workflow = Workflow(
            name="Dependency Update Workflow",
            description="Workflow for updating dependencies",
            current_state=WorkflowState.PENDING,
            steps=[
                "validate_request",
                "analyze_impact",
                "security_review",
                "approval",
                "deploy"
            ],
            assigned_to="security_team@acme.com",
            priority="HIGH",
            metadata={"package": "express", "version": "4.18.2"}
        )
        
        assert workflow.name == "Dependency Update Workflow"
        assert workflow.current_state == WorkflowState.PENDING
        assert len(workflow.steps) == 5
        assert workflow.assigned_to == "security_team@acme.com"
        assert workflow.priority == "HIGH"
    
    def test_workflow_state_validation(self):
        """Test workflow state validation."""
        valid_states = [
            "PENDING",
            "IN_PROGRESS", 
            "PENDING_APPROVAL",
            "APPROVED",
            "REJECTED",
            "COMPLETED",
            "FAILED"
        ]
        
        for state in valid_states:
            workflow = Workflow(
                name="Test Workflow",
                description="Test workflow",
                current_state=state,
                steps=[],
                assigned_to="test@example.com"
            )
            assert workflow.current_state == WorkflowState(state)
    
    def test_workflow_priority_validation(self):
        """Test workflow priority validation."""
        valid_priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        
        for priority in valid_priorities:
            workflow = Workflow(
                name="Test Workflow",
                description="Test workflow",
                current_state="PENDING",
                steps=[],
                assigned_to="test@example.com",
                priority=priority
            )
            assert workflow.priority == priority


class TestDependencyRelationship:
    """Test DependencyRelationship domain model."""
    
    def test_dependency_relationship_creation(self):
        """Test dependency relationship creation."""
        rel = DependencyRelationship(
            source="express",
            target="accepts",
            version_constraint="~1.3.8",
            is_dev_dependency=False,
            is_optional=False
        )
        
        assert rel.source == "express"
        assert rel.target == "accepts"
        assert rel.version_constraint == "~1.3.8"
        assert rel.is_dev_dependency is False
        assert rel.is_optional is False
    
    def test_dependency_relationship_with_dev_dependency(self):
        """Test dependency relationship with dev dependency."""
        rel = DependencyRelationship(
            source="my-package",
            target="jest",
            version_constraint="^29.0.0",
            is_dev_dependency=True,
            is_optional=False
        )
        
        assert rel.is_dev_dependency is True
        assert rel.is_optional is False
    
    def test_dependency_relationship_with_optional_dependency(self):
        """Test dependency relationship with optional dependency."""
        rel = DependencyRelationship(
            source="my-package",
            target="optional-dep",
            version_constraint="^1.0.0",
            is_dev_dependency=False,
            is_optional=True
        )
        
        assert rel.is_dev_dependency is False
        assert rel.is_optional is True

