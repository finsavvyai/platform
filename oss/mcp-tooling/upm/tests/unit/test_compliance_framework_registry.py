"""
Unit tests for Compliance Framework Registry.

Tests SOX, HIPAA, PCI-DSS compliance frameworks with rule engines,
validation logic, and violation detection.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, patch

from src.udp.security.compliance_framework_registry import (
    ComplianceFramework,
    ComplianceFrameworkRegistry,
    ComplianceRule,
    ComplianceStatus,
    ComplianceValidationResult,
    ComplianceViolation,
    HIPAAComplianceHandler,
    PCIDSSComplianceHandler,
    RuleType,
    SOXComplianceHandler,
)
from src.udp.domain.models import SecurityLevel


class TestComplianceRule:
    """Test ComplianceRule model."""
    
    def test_create_compliance_rule(self):
        """Test creating a compliance rule."""
        rule = ComplianceRule(
            rule_id="TEST-001",
            framework=ComplianceFramework.SOX,
            rule_type=RuleType.ACCESS_CONTROL,
            title="Test Rule",
            description="Test rule description",
            severity=SecurityLevel.HIGH,
            category="Test Category",
            conditions={"test": True},
            regulatory_reference="Test Reference",
            control_objective="Test Objective"
        )
        
        assert rule.rule_id == "TEST-001"
        assert rule.framework == ComplianceFramework.SOX
        assert rule.rule_type == RuleType.ACCESS_CONTROL
        assert rule.title == "Test Rule"
        assert rule.severity == SecurityLevel.HIGH
        assert rule.conditions == {"test": True}
        assert rule.is_active is True
        assert rule.is_expired is False
    
    def test_rule_expiration(self):
        """Test rule expiration logic."""
        # Create expired rule
        expired_rule = ComplianceRule(
            rule_id="EXPIRED-001",
            framework=ComplianceFramework.SOX,
            rule_type=RuleType.ACCESS_CONTROL,
            title="Expired Rule",
            description="Expired rule",
            severity=SecurityLevel.LOW,
            category="Test",
            conditions={"test": True},
            regulatory_reference="Test",
            control_objective="Test",
            expiration_date=datetime.utcnow() - timedelta(days=1)
        )
        
        assert expired_rule.is_expired is True
        
        # Create active rule
        active_rule = ComplianceRule(
            rule_id="ACTIVE-001",
            framework=ComplianceFramework.SOX,
            rule_type=RuleType.ACCESS_CONTROL,
            title="Active Rule",
            description="Active rule",
            severity=SecurityLevel.LOW,
            category="Test",
            conditions={"test": True},
            regulatory_reference="Test",
            control_objective="Test",
            expiration_date=datetime.utcnow() + timedelta(days=30)
        )
        
        assert active_rule.is_expired is False
    
    def test_rule_needs_review(self):
        """Test rule review logic."""
        # Rule that needs review (no last review)
        rule_no_review = ComplianceRule(
            rule_id="NO-REVIEW-001",
            framework=ComplianceFramework.SOX,
            rule_type=RuleType.ACCESS_CONTROL,
            title="No Review Rule",
            description="Rule with no review",
            severity=SecurityLevel.LOW,
            category="Test",
            conditions={"test": True},
            regulatory_reference="Test",
            control_objective="Test",
            review_frequency="monthly"
        )
        
        assert rule_no_review.needs_review is True
        
        # Rule that doesn't need review (recently reviewed)
        rule_recent_review = ComplianceRule(
            rule_id="RECENT-001",
            framework=ComplianceFramework.SOX,
            rule_type=RuleType.ACCESS_CONTROL,
            title="Recent Review Rule",
            description="Recently reviewed rule",
            severity=SecurityLevel.LOW,
            category="Test",
            conditions={"test": True},
            regulatory_reference="Test",
            control_objective="Test",
            review_frequency="monthly",
            last_reviewed=datetime.utcnow() - timedelta(days=15)
        )
        
        assert rule_recent_review.needs_review is False
    
    def test_invalid_conditions(self):
        """Test validation of rule conditions."""
        with pytest.raises(ValueError, match="Rule conditions must be a non-empty dictionary"):
            ComplianceRule(
                rule_id="INVALID-001",
                framework=ComplianceFramework.SOX,
                rule_type=RuleType.ACCESS_CONTROL,
                title="Invalid Rule",
                description="Invalid rule",
                severity=SecurityLevel.LOW,
                category="Test",
                conditions={},  # Empty conditions should fail
                regulatory_reference="Test",
                control_objective="Test"
            )


class TestComplianceViolation:
    """Test ComplianceViolation model."""
    
    def test_create_compliance_violation(self):
        """Test creating a compliance violation."""
        org_id = uuid4()
        violation = ComplianceViolation(
            rule_id="TEST-001",
            framework=ComplianceFramework.SOX,
            organization_id=org_id,
            violation_type="test_violation",
            title="Test Violation",
            description="Test violation description",
            severity=SecurityLevel.HIGH,
            detected_by="test_engine",
            detection_method="automated"
        )
        
        assert violation.rule_id == "TEST-001"
        assert violation.framework == ComplianceFramework.SOX
        assert violation.organization_id == org_id
        assert violation.severity == SecurityLevel.HIGH
        assert violation.remediation_status == "open"
        assert violation.is_critical is False  # HIGH is not CRITICAL
    
    def test_critical_violation(self):
        """Test critical violation detection."""
        violation = ComplianceViolation(
            rule_id="CRITICAL-001",
            framework=ComplianceFramework.HIPAA,
            organization_id=uuid4(),
            violation_type="critical_violation",
            title="Critical Violation",
            description="Critical violation",
            severity=SecurityLevel.CRITICAL,
            detected_by="test_engine",
            detection_method="automated"
        )
        
        assert violation.is_critical is True
    
    def test_overdue_violation(self):
        """Test overdue violation detection."""
        # Create overdue violation
        overdue_violation = ComplianceViolation(
            rule_id="OVERDUE-001",
            framework=ComplianceFramework.PCI_DSS,
            organization_id=uuid4(),
            violation_type="overdue_violation",
            title="Overdue Violation",
            description="Overdue violation",
            severity=SecurityLevel.HIGH,
            detected_by="test_engine",
            detection_method="automated",
            remediation_deadline=datetime.utcnow() - timedelta(days=1),
            remediation_status="in_progress"
        )
        
        assert overdue_violation.is_overdue is True
        assert overdue_violation.days_until_deadline == 0
        
        # Create non-overdue violation
        future_violation = ComplianceViolation(
            rule_id="FUTURE-001",
            framework=ComplianceFramework.PCI_DSS,
            organization_id=uuid4(),
            violation_type="future_violation",
            title="Future Violation",
            description="Future violation",
            severity=SecurityLevel.HIGH,
            detected_by="test_engine",
            detection_method="automated",
            remediation_deadline=datetime.utcnow() + timedelta(days=7),
            remediation_status="open"
        )
        
        assert future_violation.is_overdue is False
        assert future_violation.days_until_deadline == 7
    
    def test_invalid_remediation_status(self):
        """Test validation of remediation status."""
        with pytest.raises(ValueError, match="Invalid remediation status"):
            ComplianceViolation(
                rule_id="INVALID-001",
                framework=ComplianceFramework.SOX,
                organization_id=uuid4(),
                violation_type="invalid_violation",
                title="Invalid Violation",
                description="Invalid violation",
                severity=SecurityLevel.LOW,
                detected_by="test_engine",
                detection_method="automated",
                remediation_status="invalid_status"
            )


class TestSOXComplianceHandler:
    """Test SOX compliance handler."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.handler = SOXComplianceHandler()
        self.org_id = uuid4()
    
    def test_load_sox_rules(self):
        """Test loading SOX rules."""
        rules = self.handler.get_rules()
        
        assert len(rules) >= 3  # Should have at least 3 SOX rules
        assert all(rule.framework == ComplianceFramework.SOX for rule in rules)
        
        # Check specific rules exist
        rule_ids = [rule.rule_id for rule in rules]
        assert "SOX-404-001" in rule_ids  # Change Management
        assert "SOX-404-002" in rule_ids  # Access Control
        assert "SOX-404-003" in rule_ids  # Audit Trail
    
    def test_validate_package_non_financial(self):
        """Test package validation for non-financial system."""
        package_data = {
            "name": "test-package",
            "organization_id": self.org_id,
            "affects_financial_reporting": False
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 0
    
    def test_validate_package_financial_compliant(self):
        """Test package validation for compliant financial system."""
        package_data = {
            "name": "financial-package",
            "organization_id": self.org_id,
            "affects_financial_reporting": True,
            "has_approval": True,
            "has_documentation": True
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 0
    
    def test_validate_package_financial_violations(self):
        """Test package validation with SOX violations."""
        package_data = {
            "name": "financial-package",
            "organization_id": self.org_id,
            "affects_financial_reporting": True,
            "has_approval": False,
            "has_documentation": False
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 2
        
        # Check violation types
        violation_types = [v.violation_type for v in violations]
        assert "missing_approval" in violation_types
        assert "missing_documentation" in violation_types
        
        # Check severities
        approval_violation = next(v for v in violations if v.violation_type == "missing_approval")
        assert approval_violation.severity == SecurityLevel.HIGH
        
        doc_violation = next(v for v in violations if v.violation_type == "missing_documentation")
        assert doc_violation.severity == SecurityLevel.MEDIUM
    
    def test_validate_organization_compliant(self):
        """Test organization validation for SOX compliance."""
        org_data = {
            "organization_id": self.org_id,
            "privileged_users_count": 3,
            "mfa_enabled": True
        }
        
        result = self.handler.validate_organization(org_data)
        
        assert result.framework == ComplianceFramework.SOX
        assert result.organization_id == self.org_id
        assert result.overall_status == ComplianceStatus.COMPLIANT
        assert result.compliance_percentage == 100.0
        assert len(result.violations) == 0
    
    def test_validate_organization_violations(self):
        """Test organization validation with SOX violations."""
        org_data = {
            "organization_id": self.org_id,
            "privileged_users_count": 10,  # Exceeds limit of 5
            "mfa_enabled": False  # MFA required
        }
        
        result = self.handler.validate_organization(org_data)
        
        assert result.framework == ComplianceFramework.SOX
        assert result.overall_status == ComplianceStatus.NON_COMPLIANT
        assert len(result.violations) == 2
        assert result.critical_violations == 1  # MFA violation is critical
        assert result.high_violations == 1  # Privileged users violation is high
        
        # Check specific violations
        violation_types = [v.violation_type for v in result.violations]
        assert "excessive_privileged_access" in violation_types
        assert "missing_mfa" in violation_types


class TestHIPAAComplianceHandler:
    """Test HIPAA compliance handler."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.handler = HIPAAComplianceHandler()
        self.org_id = uuid4()
    
    def test_load_hipaa_rules(self):
        """Test loading HIPAA rules."""
        rules = self.handler.get_rules()
        
        assert len(rules) >= 2  # Should have at least 2 HIPAA rules
        assert all(rule.framework == ComplianceFramework.HIPAA for rule in rules)
        
        # Check specific rules exist
        rule_ids = [rule.rule_id for rule in rules]
        assert "HIPAA-164.308" in rule_ids  # Administrative Safeguards
        assert "HIPAA-164.312" in rule_ids  # Technical Safeguards
    
    def test_validate_package_non_phi(self):
        """Test package validation for non-PHI handling package."""
        package_data = {
            "name": "test-package",
            "organization_id": self.org_id,
            "handles_phi": False
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 0
    
    def test_validate_package_phi_compliant(self):
        """Test package validation for compliant PHI handling."""
        package_data = {
            "name": "phi-package",
            "organization_id": self.org_id,
            "handles_phi": True,
            "supports_encryption": True
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 0
    
    def test_validate_package_phi_violations(self):
        """Test package validation with HIPAA violations."""
        package_data = {
            "name": "phi-package",
            "organization_id": self.org_id,
            "handles_phi": True,
            "supports_encryption": False
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 1
        
        violation = violations[0]
        assert violation.violation_type == "missing_encryption"
        assert violation.severity == SecurityLevel.CRITICAL
        assert violation.framework == ComplianceFramework.HIPAA
    
    def test_validate_organization_compliant(self):
        """Test organization validation for HIPAA compliance."""
        org_data = {
            "organization_id": self.org_id,
            "workforce_training_completed": True
        }
        
        result = self.handler.validate_organization(org_data)
        
        assert result.framework == ComplianceFramework.HIPAA
        assert result.overall_status == ComplianceStatus.COMPLIANT
        assert result.compliance_percentage == 100.0
        assert len(result.violations) == 0
    
    def test_validate_organization_violations(self):
        """Test organization validation with HIPAA violations."""
        org_data = {
            "organization_id": self.org_id,
            "workforce_training_completed": False
        }
        
        result = self.handler.validate_organization(org_data)
        
        assert result.framework == ComplianceFramework.HIPAA
        assert result.overall_status == ComplianceStatus.NON_COMPLIANT
        assert len(result.violations) == 1
        
        violation = result.violations[0]
        assert violation.violation_type == "missing_training"
        assert violation.severity == SecurityLevel.HIGH


class TestPCIDSSComplianceHandler:
    """Test PCI DSS compliance handler."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.handler = PCIDSSComplianceHandler()
        self.org_id = uuid4()
    
    def test_load_pci_rules(self):
        """Test loading PCI DSS rules."""
        rules = self.handler.get_rules()
        
        assert len(rules) >= 2  # Should have at least 2 PCI DSS rules
        assert all(rule.framework == ComplianceFramework.PCI_DSS for rule in rules)
        
        # Check specific rules exist
        rule_ids = [rule.rule_id for rule in rules]
        assert "PCI-DSS-3.4" in rule_ids  # Data Encryption
        assert "PCI-DSS-6.5" in rule_ids  # Secure Development
    
    def test_validate_package_non_cardholder_data(self):
        """Test package validation for non-cardholder data package."""
        package_data = {
            "name": "test-package",
            "organization_id": self.org_id,
            "handles_cardholder_data": False
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 0
    
    def test_validate_package_cardholder_data_compliant(self):
        """Test package validation for compliant cardholder data handling."""
        package_data = {
            "name": "payment-package",
            "organization_id": self.org_id,
            "handles_cardholder_data": True,
            "critical_vulnerabilities": 0,
            "high_vulnerabilities": 1
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 0
    
    def test_validate_package_vulnerability_violations(self):
        """Test package validation with PCI DSS vulnerability violations."""
        package_data = {
            "name": "payment-package",
            "organization_id": self.org_id,
            "handles_cardholder_data": True,
            "critical_vulnerabilities": 2,
            "high_vulnerabilities": 5
        }
        
        violations = self.handler.validate_package(package_data)
        assert len(violations) == 2
        
        # Check critical vulnerability violation
        critical_violation = next(v for v in violations if v.violation_type == "critical_vulnerabilities")
        assert critical_violation.severity == SecurityLevel.CRITICAL
        
        # Check high vulnerability violation
        high_violation = next(v for v in violations if v.violation_type == "excessive_high_vulnerabilities")
        assert high_violation.severity == SecurityLevel.HIGH
    
    def test_validate_organization_compliant(self):
        """Test organization validation for PCI DSS compliance."""
        org_data = {
            "organization_id": self.org_id,
            "encryption_implemented": True
        }
        
        result = self.handler.validate_organization(org_data)
        
        assert result.framework == ComplianceFramework.PCI_DSS
        assert result.overall_status == ComplianceStatus.COMPLIANT
        assert result.compliance_percentage == 100.0
        assert len(result.violations) == 0
    
    def test_validate_organization_violations(self):
        """Test organization validation with PCI DSS violations."""
        org_data = {
            "organization_id": self.org_id,
            "encryption_implemented": False
        }
        
        result = self.handler.validate_organization(org_data)
        
        assert result.framework == ComplianceFramework.PCI_DSS
        assert result.overall_status == ComplianceStatus.NON_COMPLIANT
        assert len(result.violations) == 1
        assert result.critical_violations == 1
        
        violation = result.violations[0]
        assert violation.violation_type == "missing_encryption"
        assert violation.severity == SecurityLevel.CRITICAL


class TestComplianceFrameworkRegistry:
    """Test ComplianceFrameworkRegistry."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.registry = ComplianceFrameworkRegistry()
        self.org_id = uuid4()
    
    def test_initialization(self):
        """Test registry initialization."""
        assert len(self.registry.handlers) >= 3
        assert ComplianceFramework.SOX in self.registry.handlers
        assert ComplianceFramework.HIPAA in self.registry.handlers
        assert ComplianceFramework.PCI_DSS in self.registry.handlers
    
    def test_get_supported_frameworks(self):
        """Test getting supported frameworks."""
        frameworks = self.registry.get_supported_frameworks()
        
        assert ComplianceFramework.SOX in frameworks
        assert ComplianceFramework.HIPAA in frameworks
        assert ComplianceFramework.PCI_DSS in frameworks
    
    def test_get_framework_handler(self):
        """Test getting framework handlers."""
        sox_handler = self.registry.get_framework_handler(ComplianceFramework.SOX)
        assert isinstance(sox_handler, SOXComplianceHandler)
        
        hipaa_handler = self.registry.get_framework_handler(ComplianceFramework.HIPAA)
        assert isinstance(hipaa_handler, HIPAAComplianceHandler)
        
        pci_handler = self.registry.get_framework_handler(ComplianceFramework.PCI_DSS)
        assert isinstance(pci_handler, PCIDSSComplianceHandler)
        
        # Test non-existent framework
        unknown_handler = self.registry.get_framework_handler(ComplianceFramework.CUSTOM)
        assert unknown_handler is None
    
    def test_get_all_rules(self):
        """Test getting all rules."""
        # Get all rules
        all_rules = self.registry.get_all_rules()
        assert len(all_rules) > 0
        
        # Get SOX rules only
        sox_rules = self.registry.get_all_rules(ComplianceFramework.SOX)
        assert all(rule.framework == ComplianceFramework.SOX for rule in sox_rules)
        
        # Get HIPAA rules only
        hipaa_rules = self.registry.get_all_rules(ComplianceFramework.HIPAA)
        assert all(rule.framework == ComplianceFramework.HIPAA for rule in hipaa_rules)
    
    def test_validate_package_compliance(self):
        """Test package compliance validation."""
        package_data = {
            "name": "test-package",
            "organization_id": self.org_id,
            "affects_financial_reporting": True,
            "handles_phi": True,
            "handles_cardholder_data": True,
            "has_approval": False,
            "supports_encryption": False,
            "critical_vulnerabilities": 1
        }
        
        frameworks = [ComplianceFramework.SOX, ComplianceFramework.HIPAA, ComplianceFramework.PCI_DSS]
        results = self.registry.validate_package_compliance(package_data, frameworks)
        
        assert len(results) == 3
        assert ComplianceFramework.SOX in results
        assert ComplianceFramework.HIPAA in results
        assert ComplianceFramework.PCI_DSS in results
        
        # Check that violations were found
        assert len(results[ComplianceFramework.SOX]) > 0  # Missing approval
        assert len(results[ComplianceFramework.HIPAA]) > 0  # Missing encryption
        assert len(results[ComplianceFramework.PCI_DSS]) > 0  # Critical vulnerabilities
    
    def test_validate_organization_compliance(self):
        """Test organization compliance validation."""
        org_data = {
            "organization_id": self.org_id,
            "privileged_users_count": 3,
            "mfa_enabled": True,
            "workforce_training_completed": True,
            "encryption_implemented": True
        }
        
        frameworks = [ComplianceFramework.SOX, ComplianceFramework.HIPAA, ComplianceFramework.PCI_DSS]
        results = self.registry.validate_organization_compliance(org_data, frameworks)
        
        assert len(results) == 3
        
        # All should be compliant
        for framework, result in results.items():
            assert result.overall_status == ComplianceStatus.COMPLIANT
            assert result.compliance_percentage == 100.0
            assert len(result.violations) == 0
    
    def test_detect_violations(self):
        """Test violation detection."""
        package_data = {
            "name": "violation-package",
            "organization_id": self.org_id,
            "affects_financial_reporting": True,
            "handles_phi": True,
            "has_approval": False,
            "supports_encryption": False
        }
        
        frameworks = [ComplianceFramework.SOX, ComplianceFramework.HIPAA]
        violations = self.registry.detect_violations(package_data, frameworks)
        
        assert len(violations) > 0
        
        # Check that violations are sorted by severity (critical first)
        if len(violations) > 1:
            for i in range(len(violations) - 1):
                current_severity = violations[i].severity
                next_severity = violations[i + 1].severity
                
                severity_order = {
                    SecurityLevel.CRITICAL: 0,
                    SecurityLevel.HIGH: 1,
                    SecurityLevel.MEDIUM: 2,
                    SecurityLevel.LOW: 3
                }
                
                assert severity_order[current_severity] <= severity_order[next_severity]
    
    def test_get_compliance_summary(self):
        """Test compliance summary generation."""
        # Create mock validation results
        sox_result = ComplianceValidationResult(
            framework=ComplianceFramework.SOX,
            organization_id=self.org_id,
            overall_status=ComplianceStatus.COMPLIANT,
            total_rules=3,
            compliant_rules=3,
            non_compliant_rules=0,
            not_assessed_rules=0,
            violations=[],
            critical_violations=0,
            high_violations=0,
            medium_violations=0,
            low_violations=0,
            compliance_percentage=100.0,
            risk_score=0.0,
            recommendations=[],
            required_actions=[]
        )
        
        hipaa_result = ComplianceValidationResult(
            framework=ComplianceFramework.HIPAA,
            organization_id=self.org_id,
            overall_status=ComplianceStatus.PARTIALLY_COMPLIANT,
            total_rules=2,
            compliant_rules=1,
            non_compliant_rules=1,
            not_assessed_rules=0,
            violations=[Mock()],  # Mock violation
            critical_violations=0,
            high_violations=1,
            medium_violations=0,
            low_violations=0,
            compliance_percentage=50.0,
            risk_score=3.0,
            recommendations=["Implement PHI protection"],
            required_actions=["Address HIPAA violations"]
        )
        
        validation_results = {
            ComplianceFramework.SOX: sox_result,
            ComplianceFramework.HIPAA: hipaa_result
        }
        
        summary = self.registry.get_compliance_summary(validation_results)
        
        assert summary["overall_status"] == ComplianceStatus.PARTIALLY_COMPLIANT
        assert summary["frameworks_assessed"] == 2
        assert summary["total_violations"] == 1
        assert summary["average_compliance_percentage"] == 75.0  # (100 + 50) / 2
        assert summary["highest_risk_score"] == 3.0
        assert "Implement PHI protection" in summary["recommendations"]
        assert "Address HIPAA violations" in summary["required_actions"]
    
    def test_generate_compliance_report(self):
        """Test compliance report generation."""
        org_data = {
            "organization_id": self.org_id,
            "name": "Test Organization",
            "privileged_users_count": 3,
            "mfa_enabled": True,
            "workforce_training_completed": True,
            "encryption_implemented": True
        }
        
        frameworks = [ComplianceFramework.SOX, ComplianceFramework.HIPAA]
        report = self.registry.generate_compliance_report(org_data, frameworks)
        
        assert report["organization_id"] == str(self.org_id)
        assert report["organization_name"] == "Test Organization"
        assert "report_generated_at" in report
        assert "assessment_summary" in report
        assert "framework_details" in report
        assert "executive_summary" in report
        assert "action_plan" in report
        
        # Check framework details
        assert ComplianceFramework.SOX.value in report["framework_details"]
        assert ComplianceFramework.HIPAA.value in report["framework_details"]
    
    def test_empty_validation_results_summary(self):
        """Test compliance summary with empty results."""
        summary = self.registry.get_compliance_summary({})
        
        assert summary["overall_status"] == ComplianceStatus.NOT_ASSESSED
        assert summary["frameworks_assessed"] == 0
        assert summary["total_violations"] == 0
        assert summary["average_compliance_percentage"] == 0.0
        assert summary["highest_risk_score"] == 0.0


class TestComplianceValidationResult:
    """Test ComplianceValidationResult model."""
    
    def test_create_validation_result(self):
        """Test creating validation result."""
        org_id = uuid4()
        result = ComplianceValidationResult(
            framework=ComplianceFramework.SOX,
            organization_id=org_id,
            overall_status=ComplianceStatus.COMPLIANT,
            total_rules=5,
            compliant_rules=5,
            non_compliant_rules=0,
            not_assessed_rules=0,
            violations=[],
            critical_violations=0,
            high_violations=0,
            medium_violations=0,
            low_violations=0,
            compliance_percentage=100.0,
            risk_score=0.0,
            recommendations=[],
            required_actions=[]
        )
        
        assert result.framework == ComplianceFramework.SOX
        assert result.organization_id == org_id
        assert result.is_compliant is True
        assert result.has_critical_violations is False
    
    def test_validation_result_with_violations(self):
        """Test validation result with violations."""
        org_id = uuid4()
        
        # Create mock violations
        critical_violation = Mock()
        critical_violation.severity = SecurityLevel.CRITICAL
        
        high_violation = Mock()
        high_violation.severity = SecurityLevel.HIGH
        
        result = ComplianceValidationResult(
            framework=ComplianceFramework.HIPAA,
            organization_id=org_id,
            overall_status=ComplianceStatus.NON_COMPLIANT,
            total_rules=3,
            compliant_rules=1,
            non_compliant_rules=2,
            not_assessed_rules=0,
            violations=[critical_violation, high_violation],
            critical_violations=1,
            high_violations=1,
            medium_violations=0,
            low_violations=0,
            compliance_percentage=33.3,
            risk_score=7.5,
            recommendations=["Fix critical issues"],
            required_actions=["Immediate remediation required"]
        )
        
        assert result.is_compliant is False
        assert result.has_critical_violations is True


if __name__ == "__main__":
    pytest.main([__file__])