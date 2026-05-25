"""
Unit tests for GDPR Compliance Framework Handler.

Tests GDPR-specific compliance rules, validation logic, and violation detection
including data protection principles, consent management, and breach notification.
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
    GDPRComplianceHandler,
    RuleType,
)
from src.udp.domain.models import SecurityLevel


class TestGDPRComplianceHandler:
    """Test GDPR compliance handler implementation."""

    def setup_method(self):
        """Set up test fixtures."""
        self.handler = GDPRComplianceHandler()
        self.org_id = uuid4()

    def test_load_gdpr_rules(self):
        """Test loading GDPR compliance rules."""
        rules = self.handler.get_rules()

        # Verify minimum number of GDPR rules
        assert len(rules) >= 8  # Should have at least 8 GDPR rules

        # Verify all rules are GDPR framework
        assert all(rule.framework == ComplianceFramework.GDPR for rule in rules)

        # Check specific GDPR rules exist
        rule_ids = [rule.rule_id for rule in rules]
        assert "GDPR-Art5" in rule_ids  # Data Protection Principles
        assert "GDPR-Art6" in rule_ids  # Lawfulness of Processing
        assert "GDPR-Art7" in rule_ids  # Conditions for Consent
        assert "GDPR-Art25" in rule_ids  # Data Protection by Design
        assert "GDPR-Art32" in rule_ids  # Security of Processing
        assert "GDPR-Art33" in rule_ids  # Breach Notification
        assert "GDPR-Art34" in rule_ids  # Communication of Breach
        assert "GDPR-Art35" in rule_ids  # DPIA
        assert "GDPR-Art44-50" in rule_ids  # International Transfers

    def test_validate_package_non_personal_data(self):
        """Test package validation for non-personal data processing."""
        package_data = {
            "name": "analytics-package",
            "organization_id": self.org_id,
            "processes_personal_data": False,
        }

        violations = self.handler.validate_package(package_data)

        # Should have no violations for non-personal data
        assert len(violations) == 0

    def test_validate_package_compliant_personal_data(self):
        """Test package validation for compliant personal data processing."""
        package_data = {
            "name": "crm-system",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": True,
            "relies_on_consent": True,
            "has_valid_consent": True,
            "privacy_by_design": True,
            "has_security_measures": True,
        }

        violations = self.handler.validate_package(package_data)

        # Should have no violations for compliant processing
        assert len(violations) == 0

    def test_validate_package_missing_legal_basis(self):
        """Test package validation for missing legal basis."""
        package_data = {
            "name": "data-processor",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": False,
            "has_security_measures": True,
        }

        violations = self.handler.validate_package(package_data)

        # Should have violation for missing legal basis
        assert len(violations) == 1

        violation = violations[0]
        assert violation.rule_id == "GDPR-Art6"
        assert violation.framework == ComplianceFramework.GDPR
        assert violation.violation_type == "missing_legal_basis"
        assert violation.severity == SecurityLevel.CRITICAL
        assert "legal basis" in violation.description.lower()

    def test_validate_package_invalid_consent(self):
        """Test package validation for invalid consent mechanism."""
        package_data = {
            "name": "marketing-tool",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": True,
            "relies_on_consent": True,
            "has_valid_consent": False,
            "has_security_measures": True,
        }

        violations = self.handler.validate_package(package_data)

        # Should have violation for invalid consent
        assert len(violations) == 1

        violation = violations[0]
        assert violation.rule_id == "GDPR-Art7"
        assert violation.violation_type == "invalid_consent"
        assert violation.severity == SecurityLevel.HIGH
        assert "consent" in violation.title.lower()

    def test_validate_package_missing_privacy_by_design(self):
        """Test package validation for missing privacy by design."""
        package_data = {
            "name": "legacy-system",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": True,
            "has_security_measures": True,
            "privacy_by_design": False,
        }

        violations = self.handler.validate_package(package_data)

        # Should have violation for missing privacy by design
        assert len(violations) == 1

        violation = violations[0]
        assert violation.rule_id == "GDPR-Art25"
        assert violation.violation_type == "missing_privacy_by_design"
        assert violation.severity == SecurityLevel.HIGH
        assert "privacy by design" in violation.description.lower()

    def test_validate_package_missing_security_measures(self):
        """Test package validation for missing security measures."""
        package_data = {
            "name": "unsecured-app",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": True,
            "has_security_measures": False,
        }

        violations = self.handler.validate_package(package_data)

        # Should have violation for missing security measures
        assert len(violations) == 1

        violation = violations[0]
        assert violation.rule_id == "GDPR-Art32"
        assert violation.violation_type == "missing_security_measures"
        assert violation.severity == SecurityLevel.CRITICAL
        assert "security measures" in violation.title.lower()

    def test_validate_package_multiple_violations(self):
        """Test package validation with multiple violations."""
        package_data = {
            "name": "non-compliant-package",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": False,
            "relies_on_consent": True,
            "has_valid_consent": False,
            "privacy_by_design": False,
            "has_security_measures": False,
        }

        violations = self.handler.validate_package(package_data)

        # Should have multiple violations
        assert len(violations) == 4

        # Check all expected violation types
        violation_types = [v.violation_type for v in violations]
        assert "missing_legal_basis" in violation_types
        assert "invalid_consent" in violation_types
        assert "missing_privacy_by_design" in violation_types
        assert "missing_security_measures" in violation_types

        # Check severity distribution
        critical_violations = [
            v for v in violations if v.severity == SecurityLevel.CRITICAL
        ]
        high_violations = [v for v in violations if v.severity == SecurityLevel.HIGH]

        assert len(critical_violations) == 2  # legal basis, security measures
        assert len(high_violations) == 2  # consent, privacy by design

    def test_validate_organization_compliant(self):
        """Test organization validation for GDPR compliance."""
        org_data = {
            "organization_id": self.org_id,
            "dpo_appointed": True,
            "privacy_notices_updated": True,
            "breach_procedures": True,
        }

        result = self.handler.validate_organization(org_data)

        # Verify compliant result
        assert result.framework == ComplianceFramework.GDPR
        assert result.organization_id == self.org_id
        assert result.overall_status == ComplianceStatus.COMPLIANT
        assert result.compliance_percentage == 100.0
        assert len(result.violations) == 0
        assert result.critical_violations == 0
        assert result.high_violations == 0

    def test_validate_organization_missing_dpo(self):
        """Test organization validation for missing DPO."""
        org_data = {
            "organization_id": self.org_id,
            "dpo_appointed": False,
            "privacy_notices_updated": True,
            "breach_procedures": True,
        }

        result = self.handler.validate_organization(org_data)

        # Verify non-compliant result
        assert result.overall_status != ComplianceStatus.COMPLIANT
        assert len(result.violations) == 1

        violation = result.violations[0]
        assert violation.rule_id == "GDPR-Art37"  # DPO requirement
        assert violation.violation_type == "missing_dpo"
        assert violation.severity == SecurityLevel.HIGH
        assert "data protection officer" in violation.title.lower()

    def test_validate_organization_outdated_privacy_notices(self):
        """Test organization validation for outdated privacy notices."""
        org_data = {
            "organization_id": self.org_id,
            "dpo_appointed": True,
            "privacy_notices_updated": False,
            "breach_procedures": True,
        }

        result = self.handler.validate_organization(org_data)

        # Verify non-compliant result
        assert result.overall_status != ComplianceStatus.COMPLIANT
        assert len(result.violations) == 1

        violation = result.violations[0]
        assert violation.rule_id == "GDPR-Art13-14"  # Privacy notice requirements
        assert violation.violation_type == "outdated_privacy_notices"
        assert violation.severity == SecurityLevel.MEDIUM
        assert "privacy notices" in violation.title.lower()

    def test_validate_organization_missing_breach_procedures(self):
        """Test organization validation for missing breach procedures."""
        org_data = {
            "organization_id": self.org_id,
            "dpo_appointed": True,
            "privacy_notices_updated": True,
            "breach_procedures": False,
        }

        result = self.handler.validate_organization(org_data)

        # Verify non-compliant result
        assert result.overall_status != ComplianceStatus.COMPLIANT
        assert len(result.violations) == 1

        violation = result.violations[0]
        assert violation.rule_id == "GDPR-Art33"  # Breach notification
        assert violation.violation_type == "missing_breach_procedures"
        assert violation.severity == SecurityLevel.HIGH
        assert "breach notification" in violation.title.lower()

    def test_validate_organization_multiple_violations(self):
        """Test organization validation with multiple violations."""
        org_data = {
            "organization_id": self.org_id,
            "dpo_appointed": False,
            "privacy_notices_updated": False,
            "breach_procedures": False,
        }

        result = self.handler.validate_organization(org_data)

        # Verify non-compliant result with multiple violations
        assert result.overall_status == ComplianceStatus.NON_COMPLIANT
        assert len(result.violations) == 3

        # Check violation counts
        assert result.high_violations == 2  # DPO, breach procedures
        assert result.medium_violations == 1  # privacy notices

        # Verify compliance percentage calculation
        active_rules = len(self.handler.get_rules())
        expected_compliance = ((active_rules - 3) / active_rules) * 100
        assert abs(result.compliance_percentage - expected_compliance) < 0.1

    def test_generate_gdpr_recommendations(self):
        """Test GDPR-specific recommendation generation."""
        # Create mock violations
        violations = [
            Mock(violation_type="missing_legal_basis", severity=SecurityLevel.CRITICAL),
            Mock(violation_type="invalid_consent", severity=SecurityLevel.HIGH),
            Mock(
                violation_type="missing_privacy_by_design", severity=SecurityLevel.HIGH
            ),
            Mock(violation_type="missing_dpo", severity=SecurityLevel.HIGH),
        ]

        recommendations = self.handler._generate_gdpr_recommendations(violations)

        # Verify recommendations are generated
        assert len(recommendations) > 0

        # Check specific recommendations
        rec_text = " ".join(recommendations).lower()
        assert "legal basis" in rec_text
        assert "consent" in rec_text
        assert "privacy by design" in rec_text
        assert "data protection officer" in rec_text

        # Verify no duplicates
        assert len(recommendations) == len(set(recommendations))

    def test_generate_gdpr_required_actions(self):
        """Test GDPR-specific required actions generation."""
        # Create critical and high violations
        violations = [
            Mock(severity=SecurityLevel.CRITICAL, violation_type="missing_legal_basis"),
            Mock(
                severity=SecurityLevel.CRITICAL,
                violation_type="missing_security_measures",
            ),
            Mock(severity=SecurityLevel.HIGH, violation_type="invalid_consent"),
        ]

        actions = self.handler._generate_gdpr_required_actions(violations)

        # Verify actions are generated
        assert len(actions) > 0

        # Check for immediate action on critical violations
        actions_text = " ".join(actions).lower()
        assert "immediately" in actions_text or "72 hours" in actions_text

        # Check for DPIA requirement for security/legal basis violations
        assert "data protection impact assessment" in actions_text

        # Check for timeframe on high-severity violations
        assert "30 days" in actions_text

    def test_gdpr_rule_details(self):
        """Test GDPR rule properties and structure."""
        rules = self.handler.get_rules()

        # Test Art 5 - Data Protection Principles
        art5_rule = next(r for r in rules if r.rule_id == "GDPR-Art5")

        assert art5_rule.rule_type == RuleType.DATA_PROTECTION
        assert art5_rule.category == "Data Protection Principles"
        assert art5_rule.severity == SecurityLevel.CRITICAL
        assert "lawfulness" in art5_rule.description.lower()

        # Verify conditions include all GDPR principles
        conditions = art5_rule.conditions
        assert conditions["requires_lawful_basis"] is True
        assert conditions["requires_transparency"] is True
        assert conditions["requires_purpose_limitation"] is True
        assert conditions["requires_data_minimization"] is True

        # Verify regulatory reference
        assert art5_rule.regulatory_reference == "GDPR Article 5"

        # Verify evidence requirements
        assert "data processing register" in art5_rule.evidence_requirements
        assert "privacy notices" in art5_rule.evidence_requirements

        # Test Art 32 - Security of Processing
        art32_rule = next(r for r in rules if r.rule_id == "GDPR-Art32")

        assert art32_rule.rule_type == RuleType.DATA_PROTECTION
        assert art32_rule.category == "Security Measures"
        assert art32_rule.severity == SecurityLevel.CRITICAL

        # Verify security conditions
        security_conditions = art32_rule.conditions
        assert security_conditions["requires_encryption"] is True
        assert security_conditions["requires_access_controls"] is True
        assert security_conditions["requires_pseudonymization"] is True
        assert security_conditions["requires_incident_response"] is True


class TestGDPRInFrameworkRegistry:
    """Test GDPR integration with compliance framework registry."""

    def setup_method(self):
        """Set up test fixtures."""
        self.registry = ComplianceFrameworkRegistry()
        self.org_id = uuid4()

    def test_gdpr_handler_registration(self):
        """Test GDPR handler is properly registered."""
        assert ComplianceFramework.GDPR in self.registry.get_supported_frameworks()

        handler = self.registry.get_framework_handler(ComplianceFramework.GDPR)
        assert isinstance(handler, GDPRComplianceHandler)

    def test_validate_package_with_gdpr_in_registry(self):
        """Test package validation through registry with GDPR."""
        package_data = {
            "name": "test-package",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": False,
            "has_security_measures": False,
        }

        frameworks = [ComplianceFramework.GDPR]
        results = self.registry.validate_package_compliance(package_data, frameworks)

        assert ComplianceFramework.GDPR in results
        assert len(results[ComplianceFramework.GDPR]) == 2  # legal basis and security

    def test_validate_organization_with_gdpr_in_registry(self):
        """Test organization validation through registry with GDPR."""
        org_data = {
            "organization_id": self.org_id,
            "dpo_appointed": False,
            "privacy_notices_updated": False,
            "breach_procedures": False,
        }

        frameworks = [ComplianceFramework.GDPR]
        results = self.registry.validate_organization_compliance(org_data, frameworks)

        assert ComplianceFramework.GDPR in results
        result = results[ComplianceFramework.GDPR]
        assert result.overall_status != ComplianceStatus.COMPLIANT
        assert len(result.violations) == 3

    def test_multi_framework_validation_with_gdpr(self):
        """Test validation across multiple frameworks including GDPR."""
        package_data = {
            "name": "multi-framework-package",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "handles_phi": True,
            "handles_cardholder_data": True,
            "has_legal_basis": False,
            "supports_encryption": False,
            "has_security_measures": False,
        }

        frameworks = [
            ComplianceFramework.GDPR,
            ComplianceFramework.HIPAA,
            ComplianceFramework.PCI_DSS,
        ]

        results = self.registry.validate_package_compliance(package_data, frameworks)

        # Verify all frameworks were assessed
        assert len(results) == 3
        assert ComplianceFramework.GDPR in results
        assert ComplianceFramework.HIPAA in results
        assert ComplianceFramework.PCI_DSS in results

        # Verify GDPR-specific violations
        gdpr_violations = results[ComplianceFramework.GDPR]
        assert len(gdpr_violations) >= 2  # legal basis and security measures

    def test_gdpr_violation_severity_prioritization(self):
        """Test GDPR violations are properly prioritized by severity."""
        package_data = {
            "name": "severe-violations-package",
            "organization_id": self.org_id,
            "processes_personal_data": True,
            "has_legal_basis": False,  # Critical
            "relies_on_consent": True,
            "has_valid_consent": False,  # High
            "privacy_by_design": False,  # High
            "has_security_measures": False,  # Critical
        }

        violations = self.registry.detect_violations(
            package_data, [ComplianceFramework.GDPR]
        )

        # Verify violations are sorted by severity (critical first)
        if len(violations) > 1:
            for i in range(len(violations) - 1):
                current_severity = violations[i].severity
                next_severity = violations[i + 1].severity

                severity_order = {
                    SecurityLevel.CRITICAL: 0,
                    SecurityLevel.HIGH: 1,
                    SecurityLevel.MEDIUM: 2,
                    SecurityLevel.LOW: 3,
                }

                assert severity_order[current_severity] <= severity_order[next_severity]

        # Verify critical violations are present
        critical_violations = [
            v for v in violations if v.severity == SecurityLevel.CRITICAL
        ]
        assert len(critical_violations) >= 2


if __name__ == "__main__":
    pytest.main([__file__])
