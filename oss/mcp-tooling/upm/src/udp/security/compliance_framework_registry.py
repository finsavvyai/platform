"""
Enterprise Compliance Framework Registry.

Comprehensive registry for SOX, HIPAA, PCI-DSS and other regulatory frameworks
with rule engines, validation logic, and violation detection.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator

from ..domain.models import BaseEntity, SecurityLevel

logger = logging.getLogger(__name__)


class ComplianceFramework(str, Enum):
    """Supported compliance frameworks."""

    SOX = "SOX"
    HIPAA = "HIPAA"
    PCI_DSS = "PCI_DSS"
    SOC2 = "SOC2"
    ISO27001 = "ISO27001"
    GDPR = "GDPR"
    FEDRAMP = "FEDRAMP"
    NIST = "NIST"
    CIS = "CIS"
    CUSTOM = "CUSTOM"


class ComplianceStatus(str, Enum):
    """Compliance validation status."""

    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PARTIALLY_COMPLIANT = "partially_compliant"
    NOT_ASSESSED = "not_assessed"
    UNDER_REVIEW = "under_review"
    REQUIRES_REMEDIATION = "requires_remediation"


class RuleType(str, Enum):
    """Types of compliance rules."""

    PACKAGE_RESTRICTION = "package_restriction"
    LICENSE_VALIDATION = "license_validation"
    VULNERABILITY_THRESHOLD = "vulnerability_threshold"
    ACCESS_CONTROL = "access_control"
    AUDIT_REQUIREMENT = "audit_requirement"
    DATA_PROTECTION = "data_protection"
    CHANGE_MANAGEMENT = "change_management"
    DOCUMENTATION = "documentation"


class ComplianceRule(BaseEntity):
    """Individual compliance rule definition."""

    rule_id: str = Field(..., description="Unique rule identifier")
    framework: ComplianceFramework = Field(
        ..., description="Associated compliance framework"
    )
    rule_type: RuleType = Field(..., description="Type of compliance rule")
    title: str = Field(..., min_length=1, max_length=500, description="Rule title")
    description: str = Field(..., min_length=1, description="Detailed rule description")
    severity: SecurityLevel = Field(..., description="Rule violation severity")
    category: str = Field(..., max_length=100, description="Rule category")
    subcategory: Optional[str] = Field(
        None, max_length=100, description="Rule subcategory"
    )

    # Rule configuration
    conditions: dict[str, Any] = Field(..., description="Rule evaluation conditions")
    parameters: dict[str, Any] = Field(
        default_factory=dict, description="Rule parameters"
    )
    exceptions: list[str] = Field(default_factory=list, description="Rule exceptions")

    # Compliance metadata
    regulatory_reference: str = Field(
        ..., description="Regulatory reference (e.g., SOX 404)"
    )
    control_objective: str = Field(..., description="Control objective")
    evidence_requirements: list[str] = Field(
        default_factory=list, description="Required evidence"
    )
    testing_procedures: list[str] = Field(
        default_factory=list, description="Testing procedures"
    )

    # Operational metadata
    is_active: bool = Field(default=True, description="Rule active status")
    effective_date: datetime = Field(
        default_factory=datetime.utcnow, description="Rule effective date"
    )
    expiration_date: Optional[datetime] = Field(
        None, description="Rule expiration date"
    )
    review_frequency: str = Field(default="quarterly", description="Review frequency")
    last_reviewed: Optional[datetime] = Field(None, description="Last review date")

    @validator("conditions")
    def validate_conditions(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate rule conditions structure."""
        if not isinstance(v, dict) or not v:
            raise ValueError("Rule conditions must be a non-empty dictionary")
        return v

    @property
    def is_expired(self) -> bool:
        """Check if rule has expired."""
        return (
            self.expiration_date is not None
            and datetime.utcnow() > self.expiration_date
        )

    @property
    def needs_review(self) -> bool:
        """Check if rule needs review based on frequency."""
        if not self.last_reviewed:
            return True

        frequency_days = {
            "daily": 1,
            "weekly": 7,
            "monthly": 30,
            "quarterly": 90,
            "annually": 365,
        }

        days = frequency_days.get(self.review_frequency, 90)
        return datetime.utcnow() > self.last_reviewed + timedelta(days=days)


class ComplianceViolation(BaseEntity):
    """Compliance rule violation record."""

    violation_id: str = Field(
        default_factory=lambda: str(uuid4()), description="Unique violation ID"
    )
    rule_id: str = Field(..., description="Violated rule ID")
    framework: ComplianceFramework = Field(
        ..., description="Associated compliance framework"
    )
    organization_id: UUID = Field(..., description="Organization ID")

    # Violation details
    violation_type: str = Field(..., description="Type of violation")
    title: str = Field(..., description="Violation title")
    description: str = Field(..., description="Detailed violation description")
    severity: SecurityLevel = Field(..., description="Violation severity")

    # Context information
    affected_packages: list[str] = Field(
        default_factory=list, description="Affected package names"
    )
    affected_resources: list[str] = Field(
        default_factory=list, description="Affected resources"
    )
    violation_context: dict[str, Any] = Field(
        default_factory=dict, description="Violation context data"
    )

    # Detection metadata
    detected_at: datetime = Field(
        default_factory=datetime.utcnow, description="Detection timestamp"
    )
    detected_by: str = Field(..., description="Detection source/system")
    detection_method: str = Field(..., description="Detection method")

    # Remediation tracking
    remediation_status: str = Field(default="open", description="Remediation status")
    remediation_plan: Optional[str] = Field(None, description="Remediation plan")
    remediation_deadline: Optional[datetime] = Field(
        None, description="Remediation deadline"
    )
    remediation_assigned_to: Optional[str] = Field(
        None, description="Assigned remediation owner"
    )
    remediation_completed_at: Optional[datetime] = Field(
        None, description="Remediation completion time"
    )

    # Risk assessment
    risk_score: float = Field(default=0.0, ge=0.0, le=10.0, description="Risk score")
    business_impact: str = Field(default="medium", description="Business impact level")
    likelihood: str = Field(default="medium", description="Likelihood of exploitation")

    @validator("remediation_status")
    def validate_remediation_status(cls, v: str) -> str:
        """Validate remediation status values."""
        valid_statuses = [
            "open",
            "in_progress",
            "resolved",
            "accepted_risk",
            "false_positive",
        ]
        if v not in valid_statuses:
            raise ValueError(f"Invalid remediation status: {v}")
        return v

    @property
    def is_critical(self) -> bool:
        """Check if violation is critical severity."""
        return self.severity == SecurityLevel.CRITICAL

    @property
    def is_overdue(self) -> bool:
        """Check if remediation is overdue."""
        return (
            self.remediation_deadline is not None
            and datetime.utcnow() > self.remediation_deadline
            and self.remediation_status not in ["resolved", "accepted_risk"]
        )

    @property
    def days_until_deadline(self) -> Optional[int]:
        """Get days until remediation deadline."""
        if not self.remediation_deadline:
            return None
        delta = self.remediation_deadline - datetime.utcnow()
        return max(0, delta.days)


class ComplianceValidationResult(BaseModel):
    """Result of compliance validation."""

    framework: ComplianceFramework
    organization_id: UUID
    validation_timestamp: datetime = Field(default_factory=datetime.utcnow)
    overall_status: ComplianceStatus

    # Rule results
    total_rules: int = Field(ge=0)
    compliant_rules: int = Field(ge=0)
    non_compliant_rules: int = Field(ge=0)
    not_assessed_rules: int = Field(ge=0)

    # Violations
    violations: list[ComplianceViolation] = Field(default_factory=list)
    critical_violations: int = Field(ge=0)
    high_violations: int = Field(ge=0)
    medium_violations: int = Field(ge=0)
    low_violations: int = Field(ge=0)

    # Compliance metrics
    compliance_percentage: float = Field(ge=0.0, le=100.0)
    risk_score: float = Field(ge=0.0, le=10.0)

    # Recommendations
    recommendations: list[str] = Field(default_factory=list)
    required_actions: list[str] = Field(default_factory=list)

    @property
    def is_compliant(self) -> bool:
        """Check if overall status is compliant."""
        return self.overall_status == ComplianceStatus.COMPLIANT

    @property
    def has_critical_violations(self) -> bool:
        """Check if there are critical violations."""
        return self.critical_violations > 0


class BaseComplianceFrameworkHandler(ABC):
    """Abstract base class for compliance framework handlers."""

    def __init__(self, framework: ComplianceFramework):
        self.framework = framework
        self.rules: list[ComplianceRule] = []
        self._load_rules()

    @abstractmethod
    def _load_rules(self) -> None:
        """Load framework-specific rules."""
        pass

    @abstractmethod
    def validate_package(
        self, package_data: dict[str, Any]
    ) -> list[ComplianceViolation]:
        """Validate a package against framework rules."""
        pass

    @abstractmethod
    def validate_organization(
        self, org_data: dict[str, Any]
    ) -> ComplianceValidationResult:
        """Validate organization compliance."""
        pass

    def get_rules(self) -> list[ComplianceRule]:
        """Get all rules for this framework."""
        return [rule for rule in self.rules if rule.is_active and not rule.is_expired]

    def get_rule_by_id(self, rule_id: str) -> Optional[ComplianceRule]:
        """Get specific rule by ID."""
        return next((rule for rule in self.rules if rule.rule_id == rule_id), None)


class SOXComplianceHandler(BaseComplianceFrameworkHandler):
    """Sarbanes-Oxley Act compliance handler."""

    def __init__(self):
        super().__init__(ComplianceFramework.SOX)

    def _load_rules(self) -> None:
        """Load SOX-specific rules."""
        self.rules = [
            ComplianceRule(
                rule_id="SOX-404-001",
                framework=ComplianceFramework.SOX,
                rule_type=RuleType.CHANGE_MANAGEMENT,
                title="Change Management Controls",
                description="All changes to financial reporting systems must be documented and approved",
                severity=SecurityLevel.HIGH,
                category="Internal Controls",
                subcategory="Change Management",
                conditions={
                    "requires_approval": True,
                    "requires_documentation": True,
                    "approval_roles": ["financial_controller", "it_manager"],
                },
                regulatory_reference="SOX Section 404",
                control_objective="Ensure integrity of financial reporting systems",
                evidence_requirements=[
                    "Change request documentation",
                    "Approval records",
                    "Testing evidence",
                ],
                testing_procedures=[
                    "Review change management process",
                    "Test approval workflows",
                    "Validate documentation completeness",
                ],
            ),
            ComplianceRule(
                rule_id="SOX-404-002",
                framework=ComplianceFramework.SOX,
                rule_type=RuleType.ACCESS_CONTROL,
                title="Access Control for Financial Systems",
                description="Access to financial reporting systems must be restricted and monitored",
                severity=SecurityLevel.CRITICAL,
                category="Access Controls",
                conditions={
                    "max_privileged_users": 5,
                    "requires_mfa": True,
                    "access_review_frequency": "quarterly",
                },
                regulatory_reference="SOX Section 404",
                control_objective="Prevent unauthorized access to financial data",
                evidence_requirements=[
                    "Access control lists",
                    "User access reviews",
                    "Authentication logs",
                ],
                testing_procedures=[
                    "Review user access rights",
                    "Test authentication controls",
                    "Validate access monitoring",
                ],
            ),
            ComplianceRule(
                rule_id="SOX-404-003",
                framework=ComplianceFramework.SOX,
                rule_type=RuleType.AUDIT_REQUIREMENT,
                title="Audit Trail Requirements",
                description="All financial system activities must maintain comprehensive audit trails",
                severity=SecurityLevel.HIGH,
                category="Audit and Monitoring",
                conditions={
                    "audit_retention_years": 7,
                    "immutable_logs": True,
                    "log_integrity_checks": True,
                },
                regulatory_reference="SOX Section 404",
                control_objective="Maintain audit trail for financial activities",
                evidence_requirements=[
                    "Audit log configurations",
                    "Log retention policies",
                    "Integrity verification records",
                ],
                testing_procedures=[
                    "Review audit log completeness",
                    "Test log integrity controls",
                    "Validate retention compliance",
                ],
            ),
        ]

    def validate_package(
        self, package_data: dict[str, Any]
    ) -> list[ComplianceViolation]:
        """Validate package against SOX requirements."""
        violations = []

        # Check if package affects financial systems
        is_financial_system = package_data.get("affects_financial_reporting", False)
        if not is_financial_system:
            return violations

        # Validate change management
        if not package_data.get("has_approval", False):
            violations.append(
                ComplianceViolation(
                    rule_id="SOX-404-001",
                    framework=ComplianceFramework.SOX,
                    organization_id=package_data.get("organization_id"),
                    violation_type="missing_approval",
                    title="Missing Change Approval",
                    description="Package change to financial system lacks required approval",
                    severity=SecurityLevel.HIGH,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="sox_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Validate documentation
        if not package_data.get("has_documentation", False):
            violations.append(
                ComplianceViolation(
                    rule_id="SOX-404-001",
                    framework=ComplianceFramework.SOX,
                    organization_id=package_data.get("organization_id"),
                    violation_type="missing_documentation",
                    title="Missing Change Documentation",
                    description="Package change lacks required documentation",
                    severity=SecurityLevel.MEDIUM,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="sox_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        return violations

    def validate_organization(
        self, org_data: dict[str, Any]
    ) -> ComplianceValidationResult:
        """Validate organization SOX compliance."""
        violations = []
        active_rules = self.get_rules()

        # Check access control compliance
        privileged_users = org_data.get("privileged_users_count", 0)
        if privileged_users > 5:
            violations.append(
                ComplianceViolation(
                    rule_id="SOX-404-002",
                    framework=ComplianceFramework.SOX,
                    organization_id=org_data.get("organization_id"),
                    violation_type="excessive_privileged_access",
                    title="Excessive Privileged Users",
                    description=f"Organization has {privileged_users} privileged users (max: 5)",
                    severity=SecurityLevel.HIGH,
                    detected_by="sox_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Check MFA requirement
        if not org_data.get("mfa_enabled", False):
            violations.append(
                ComplianceViolation(
                    rule_id="SOX-404-002",
                    framework=ComplianceFramework.SOX,
                    organization_id=org_data.get("organization_id"),
                    violation_type="missing_mfa",
                    title="Multi-Factor Authentication Not Enabled",
                    description="MFA is required for financial system access",
                    severity=SecurityLevel.CRITICAL,
                    detected_by="sox_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Calculate compliance metrics
        total_rules = len(active_rules)
        non_compliant_rules = len(violations)
        compliant_rules = total_rules - non_compliant_rules
        compliance_percentage = (
            (compliant_rules / total_rules * 100) if total_rules > 0 else 0
        )

        # Determine overall status
        if compliance_percentage == 100:
            overall_status = ComplianceStatus.COMPLIANT
        elif compliance_percentage >= 80:
            overall_status = ComplianceStatus.PARTIALLY_COMPLIANT
        else:
            overall_status = ComplianceStatus.NON_COMPLIANT

        return ComplianceValidationResult(
            framework=ComplianceFramework.SOX,
            organization_id=org_data.get("organization_id"),
            overall_status=overall_status,
            total_rules=total_rules,
            compliant_rules=compliant_rules,
            non_compliant_rules=non_compliant_rules,
            not_assessed_rules=0,
            violations=violations,
            critical_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.CRITICAL
            ),
            high_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.HIGH
            ),
            medium_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.MEDIUM
            ),
            low_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.LOW
            ),
            compliance_percentage=compliance_percentage,
            risk_score=min(10.0, len(violations) * 2.0),
            recommendations=self._generate_sox_recommendations(violations),
            required_actions=self._generate_sox_required_actions(violations),
        )

    def _generate_sox_recommendations(
        self, violations: list[ComplianceViolation]
    ) -> list[str]:
        """Generate SOX-specific recommendations."""
        recommendations = []

        if any(v.violation_type == "missing_approval" for v in violations):
            recommendations.append(
                "Implement formal change approval process for financial systems"
            )

        if any(v.violation_type == "missing_documentation" for v in violations):
            recommendations.append(
                "Establish comprehensive change documentation requirements"
            )

        if any(v.violation_type == "excessive_privileged_access" for v in violations):
            recommendations.append("Review and reduce privileged user access")

        if any(v.violation_type == "missing_mfa" for v in violations):
            recommendations.append(
                "Enable multi-factor authentication for all financial system access"
            )

        return recommendations

    def _generate_sox_required_actions(
        self, violations: list[ComplianceViolation]
    ) -> list[str]:
        """Generate required actions for SOX compliance."""
        actions = []

        critical_violations = [
            v for v in violations if v.severity == SecurityLevel.CRITICAL
        ]
        if critical_violations:
            actions.append("Address critical SOX violations immediately")

        high_violations = [v for v in violations if v.severity == SecurityLevel.HIGH]
        if high_violations:
            actions.append(
                "Develop remediation plan for high-severity SOX violations within 30 days"
            )

        return actions


class HIPAAComplianceHandler(BaseComplianceFrameworkHandler):
    """HIPAA compliance handler."""

    def __init__(self):
        super().__init__(ComplianceFramework.HIPAA)

    def _load_rules(self) -> None:
        """Load HIPAA-specific rules."""
        self.rules = [
            ComplianceRule(
                rule_id="HIPAA-164.308",
                framework=ComplianceFramework.HIPAA,
                rule_type=RuleType.ACCESS_CONTROL,
                title="Administrative Safeguards",
                description="Implement administrative safeguards for PHI access",
                severity=SecurityLevel.CRITICAL,
                category="Administrative Safeguards",
                conditions={
                    "requires_access_controls": True,
                    "requires_workforce_training": True,
                    "requires_incident_response": True,
                },
                regulatory_reference="45 CFR 164.308",
                control_objective="Protect PHI through administrative controls",
                evidence_requirements=[
                    "Access control policies",
                    "Training records",
                    "Incident response procedures",
                ],
            ),
            ComplianceRule(
                rule_id="HIPAA-164.312",
                framework=ComplianceFramework.HIPAA,
                rule_type=RuleType.DATA_PROTECTION,
                title="Technical Safeguards",
                description="Implement technical safeguards for PHI protection",
                severity=SecurityLevel.CRITICAL,
                category="Technical Safeguards",
                conditions={
                    "requires_encryption": True,
                    "requires_access_logging": True,
                    "requires_integrity_controls": True,
                },
                regulatory_reference="45 CFR 164.312",
                control_objective="Protect PHI through technical controls",
                evidence_requirements=[
                    "Encryption implementation",
                    "Access logs",
                    "Integrity verification",
                ],
            ),
        ]

    def validate_package(
        self, package_data: dict[str, Any]
    ) -> list[ComplianceViolation]:
        """Validate package against HIPAA requirements."""
        violations = []

        # Check if package handles PHI
        handles_phi = package_data.get("handles_phi", False)
        if not handles_phi:
            return violations

        # Check encryption requirement
        if not package_data.get("supports_encryption", False):
            violations.append(
                ComplianceViolation(
                    rule_id="HIPAA-164.312",
                    framework=ComplianceFramework.HIPAA,
                    organization_id=package_data.get("organization_id"),
                    violation_type="missing_encryption",
                    title="Missing Encryption Support",
                    description="Package handling PHI must support encryption",
                    severity=SecurityLevel.CRITICAL,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="hipaa_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        return violations

    def validate_organization(
        self, org_data: dict[str, Any]
    ) -> ComplianceValidationResult:
        """Validate organization HIPAA compliance."""
        violations = []
        active_rules = self.get_rules()

        # Check workforce training
        if not org_data.get("workforce_training_completed", False):
            violations.append(
                ComplianceViolation(
                    rule_id="HIPAA-164.308",
                    framework=ComplianceFramework.HIPAA,
                    organization_id=org_data.get("organization_id"),
                    violation_type="missing_training",
                    title="Missing Workforce Training",
                    description="HIPAA workforce training not completed",
                    severity=SecurityLevel.HIGH,
                    detected_by="hipaa_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Calculate compliance metrics
        total_rules = len(active_rules)
        non_compliant_rules = len(violations)
        compliant_rules = total_rules - non_compliant_rules
        compliance_percentage = (
            (compliant_rules / total_rules * 100) if total_rules > 0 else 0
        )

        # Determine overall status
        if compliance_percentage == 100:
            overall_status = ComplianceStatus.COMPLIANT
        elif compliance_percentage >= 90:  # HIPAA requires higher compliance
            overall_status = ComplianceStatus.PARTIALLY_COMPLIANT
        else:
            overall_status = ComplianceStatus.NON_COMPLIANT

        return ComplianceValidationResult(
            framework=ComplianceFramework.HIPAA,
            organization_id=org_data.get("organization_id"),
            overall_status=overall_status,
            total_rules=total_rules,
            compliant_rules=compliant_rules,
            non_compliant_rules=non_compliant_rules,
            not_assessed_rules=0,
            violations=violations,
            critical_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.CRITICAL
            ),
            high_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.HIGH
            ),
            medium_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.MEDIUM
            ),
            low_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.LOW
            ),
            compliance_percentage=compliance_percentage,
            risk_score=min(
                10.0, len(violations) * 3.0
            ),  # Higher risk multiplier for HIPAA
            recommendations=["Implement comprehensive PHI protection measures"],
            required_actions=["Address all HIPAA violations immediately"],
        )


class PCIDSSComplianceHandler(BaseComplianceFrameworkHandler):
    """PCI DSS compliance handler."""

    def __init__(self):
        super().__init__(ComplianceFramework.PCI_DSS)

    def _load_rules(self) -> None:
        """Load PCI DSS-specific rules."""
        self.rules = [
            ComplianceRule(
                rule_id="PCI-DSS-3.4",
                framework=ComplianceFramework.PCI_DSS,
                rule_type=RuleType.DATA_PROTECTION,
                title="Cardholder Data Encryption",
                description="Render cardholder data unreadable anywhere it is stored",
                severity=SecurityLevel.CRITICAL,
                category="Data Protection",
                conditions={
                    "requires_encryption": True,
                    "encryption_strength": "AES-256",
                    "key_management": True,
                },
                regulatory_reference="PCI DSS Requirement 3.4",
                control_objective="Protect stored cardholder data",
                evidence_requirements=[
                    "Encryption implementation",
                    "Key management procedures",
                    "Data discovery reports",
                ],
            ),
            ComplianceRule(
                rule_id="PCI-DSS-6.5",
                framework=ComplianceFramework.PCI_DSS,
                rule_type=RuleType.VULNERABILITY_THRESHOLD,
                title="Secure Development Practices",
                description="Address common vulnerabilities in development processes",
                severity=SecurityLevel.HIGH,
                category="Secure Development",
                conditions={
                    "max_critical_vulnerabilities": 0,
                    "max_high_vulnerabilities": 2,
                    "requires_security_testing": True,
                },
                regulatory_reference="PCI DSS Requirement 6.5",
                control_objective="Prevent common vulnerabilities",
                evidence_requirements=[
                    "Security testing results",
                    "Vulnerability scan reports",
                    "Code review documentation",
                ],
            ),
        ]

    def validate_package(
        self, package_data: dict[str, Any]
    ) -> list[ComplianceViolation]:
        """Validate package against PCI DSS requirements."""
        violations = []

        # Check if package handles cardholder data
        handles_card_data = package_data.get("handles_cardholder_data", False)
        if not handles_card_data:
            return violations

        # Check vulnerability thresholds
        critical_vulns = package_data.get("critical_vulnerabilities", 0)
        high_vulns = package_data.get("high_vulnerabilities", 0)

        if critical_vulns > 0:
            violations.append(
                ComplianceViolation(
                    rule_id="PCI-DSS-6.5",
                    framework=ComplianceFramework.PCI_DSS,
                    organization_id=package_data.get("organization_id"),
                    violation_type="critical_vulnerabilities",
                    title="Critical Vulnerabilities Present",
                    description=f"Package has {critical_vulns} critical vulnerabilities (max: 0)",
                    severity=SecurityLevel.CRITICAL,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="pci_compliance_engine",
                    detection_method="vulnerability_scan",
                )
            )

        if high_vulns > 2:
            violations.append(
                ComplianceViolation(
                    rule_id="PCI-DSS-6.5",
                    framework=ComplianceFramework.PCI_DSS,
                    organization_id=package_data.get("organization_id"),
                    violation_type="excessive_high_vulnerabilities",
                    title="Excessive High Vulnerabilities",
                    description=f"Package has {high_vulns} high vulnerabilities (max: 2)",
                    severity=SecurityLevel.HIGH,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="pci_compliance_engine",
                    detection_method="vulnerability_scan",
                )
            )

        return violations

    def validate_organization(
        self, org_data: dict[str, Any]
    ) -> ComplianceValidationResult:
        """Validate organization PCI DSS compliance."""
        violations = []
        active_rules = self.get_rules()

        # Check encryption implementation
        if not org_data.get("encryption_implemented", False):
            violations.append(
                ComplianceViolation(
                    rule_id="PCI-DSS-3.4",
                    framework=ComplianceFramework.PCI_DSS,
                    organization_id=org_data.get("organization_id"),
                    violation_type="missing_encryption",
                    title="Missing Data Encryption",
                    description="Cardholder data encryption not implemented",
                    severity=SecurityLevel.CRITICAL,
                    detected_by="pci_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Calculate compliance metrics
        total_rules = len(active_rules)
        non_compliant_rules = len(violations)
        compliant_rules = total_rules - non_compliant_rules
        compliance_percentage = (
            (compliant_rules / total_rules * 100) if total_rules > 0 else 0
        )

        # Determine overall status
        if compliance_percentage == 100:
            overall_status = ComplianceStatus.COMPLIANT
        elif compliance_percentage >= 95:  # PCI DSS requires very high compliance
            overall_status = ComplianceStatus.PARTIALLY_COMPLIANT
        else:
            overall_status = ComplianceStatus.NON_COMPLIANT

        return ComplianceValidationResult(
            framework=ComplianceFramework.PCI_DSS,
            organization_id=org_data.get("organization_id"),
            overall_status=overall_status,
            total_rules=total_rules,
            compliant_rules=compliant_rules,
            non_compliant_rules=non_compliant_rules,
            not_assessed_rules=0,
            violations=violations,
            critical_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.CRITICAL
            ),
            high_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.HIGH
            ),
            medium_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.MEDIUM
            ),
            low_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.LOW
            ),
            compliance_percentage=compliance_percentage,
            risk_score=min(
                10.0, len(violations) * 4.0
            ),  # Highest risk multiplier for PCI DSS
            recommendations=["Implement comprehensive cardholder data protection"],
            required_actions=["Address all PCI DSS violations immediately"],
        )


class GDPRComplianceHandler(BaseComplianceFrameworkHandler):
    """GDPR compliance handler."""

    def __init__(self):
        super().__init__(ComplianceFramework.GDPR)

    def _load_rules(self) -> None:
        """Load GDPR-specific rules."""
        self.rules = [
            ComplianceRule(
                rule_id="GDPR-Art5",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.DATA_PROTECTION,
                title="Principles Relating to Processing of Personal Data",
                description="Lawfulness, fairness, transparency, purpose limitation, data minimization, accuracy, storage limitation, integrity, and confidentiality",
                severity=SecurityLevel.CRITICAL,
                category="Data Protection Principles",
                subcategory="General Principles",
                conditions={
                    "requires_lawful_basis": True,
                    "requires_transparency": True,
                    "requires_purpose_limitation": True,
                    "requires_data_minimization": True,
                    "requires_accuracy": True,
                    "requires_storage_limitation": True,
                    "requires_integrity_confidentiality": True,
                },
                regulatory_reference="GDPR Article 5",
                control_objective="Ensure personal data is processed lawfully and transparently",
                evidence_requirements=[
                    "Data processing register",
                    "Privacy notices",
                    "Consent records",
                    "Data retention policies",
                ],
                testing_procedures=[
                    "Review data processing activities",
                    "Validate consent mechanisms",
                    "Check data retention compliance",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art6",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.LICENSE_VALIDATION,
                title="Lawfulness of Processing",
                description="Personal data must be processed based on valid legal basis",
                severity=SecurityLevel.CRITICAL,
                category="Lawfulness of Processing",
                subcategory="Legal Basis",
                conditions={
                    "requires_legal_basis": True,
                    "valid_bases": [
                        "consent",
                        "contract",
                        "legal_obligation",
                        "vital_interests",
                        "public_task",
                        "legitimate_interests",
                    ],
                },
                regulatory_reference="GDPR Article 6",
                control_objective="Ensure all personal data processing has valid legal basis",
                evidence_requirements=[
                    "Legal basis documentation",
                    "Consent records",
                    "Contractual requirements",
                    "Legitimate interest assessments",
                ],
                testing_procedures=[
                    "Verify legal basis for all processing",
                    "Review consent mechanisms",
                    "Assess legitimate interests",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art7",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.DOCUMENTATION,
                title="Conditions for Consent",
                description="Consent must be freely given, specific, informed, and unambiguous",
                severity=SecurityLevel.HIGH,
                category="Consent Management",
                subcategory="Consent Requirements",
                conditions={
                    "requires_granular_consent": True,
                    "requires_withdrawable_consent": True,
                    "requires_easy_withdrawal": True,
                    "requires_clear_consent_request": True,
                },
                regulatory_reference="GDPR Article 7",
                control_objective="Ensure valid consent mechanisms for data processing",
                evidence_requirements=[
                    "Consent forms",
                    "Consent logs",
                    "Withdrawal mechanisms",
                    "Privacy notices",
                ],
                testing_procedures=[
                    "Test consent mechanisms",
                    "Verify withdrawal process",
                    "Review consent language",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art25",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.DATA_PROTECTION,
                title="Data Protection by Design and by Default",
                description="Technical and organizational measures for data protection",
                severity=SecurityLevel.HIGH,
                category="Data Protection by Design",
                subcategory="Privacy Engineering",
                conditions={
                    "requires_privacy_by_design": True,
                    "requires_privacy_by_default": True,
                    "requires_data_protection_measures": True,
                    "requires_regular_reviews": True,
                },
                regulatory_reference="GDPR Article 25",
                control_objective="Implement privacy-enhancing technologies and practices",
                evidence_requirements=[
                    "Privacy impact assessments",
                    "Privacy design documentation",
                    "Technical specifications",
                    "Review records",
                ],
                testing_procedures=[
                    "Review privacy architecture",
                    "Test privacy controls",
                    "Verify default settings",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art32",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.DATA_PROTECTION,
                title="Security of Processing",
                description="Implement appropriate technical and organizational security measures",
                severity=SecurityLevel.CRITICAL,
                category="Security Measures",
                subcategory="Information Security",
                conditions={
                    "requires_encryption": True,
                    "requires_access_controls": True,
                    "requires_pseudonymization": True,
                    "requires_incident_response": True,
                    "requires_regular_testing": True,
                },
                regulatory_reference="GDPR Article 32",
                control_objective="Ensure security of personal data processing",
                evidence_requirements=[
                    "Security policies",
                    "Encryption implementation",
                    "Access control records",
                    "Incident response plan",
                    "Security testing reports",
                ],
                testing_procedures=[
                    "Penetration testing",
                    "Access control testing",
                    "Incident response drills",
                    "Encryption verification",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art33",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.AUDIT_REQUIREMENT,
                title="Notification of Personal Data Breach",
                description="Notify supervisory authority of personal data breaches within 72 hours",
                severity=SecurityLevel.HIGH,
                category="Breach Management",
                subcategory="Incident Notification",
                conditions={
                    "requires_breach_detection": True,
                    "requires_72hour_notification": True,
                    "requires_breach_documentation": True,
                    "requires_notification_procedures": True,
                },
                regulatory_reference="GDPR Article 33",
                control_objective="Ensure timely notification of data breaches to authorities",
                evidence_requirements=[
                    "Breach detection procedures",
                    "Notification templates",
                    "Breach register",
                    "Incident response logs",
                ],
                testing_procedures=[
                    "Test breach detection",
                    "Simulate breach notification",
                    "Review documentation completeness",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art34",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.AUDIT_REQUIREMENT,
                title="Communication of Personal Data Breach",
                description="Communicate personal data breaches to data subjects when high risk is involved",
                severity=SecurityLevel.HIGH,
                category="Breach Management",
                subcategory="Data Subject Notification",
                conditions={
                    "requires_risk_assessment": True,
                    "requires_data_subject_notification": True,
                    "requires_clear_communication": True,
                    "requires_notification_criteria": True,
                },
                regulatory_reference="GDPR Article 34",
                control_objective="Ensure affected data subjects are informed of high-risk breaches",
                evidence_requirements=[
                    "Risk assessment procedures",
                    "Communication templates",
                    "Notification criteria documentation",
                    "Communication logs",
                ],
                testing_procedures=[
                    "Test risk assessment process",
                    "Verify notification triggers",
                    "Review communication procedures",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art35",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.DOCUMENTATION,
                title="Data Protection Impact Assessment",
                description="Conduct DPIA for high-risk processing activities",
                severity=SecurityLevel.HIGH,
                category="Risk Assessment",
                subcategory="DPIA",
                conditions={
                    "requires_dpia_for_high_risk": True,
                    "requires_consultation": True,
                    "requires_risk_minimization": True,
                    "requires_regular_review": True,
                },
                regulatory_reference="GDPR Article 35",
                control_objective="Identify and minimize privacy risks in high-risk processing",
                evidence_requirements=[
                    "DPIA documentation",
                    "Risk assessment reports",
                    "Consultation records",
                    "Review schedules",
                ],
                testing_procedures=[
                    "Review DPIA completeness",
                    "Verify risk assessment methodology",
                    "Check consultation process",
                ],
            ),
            ComplianceRule(
                rule_id="GDPR-Art44-50",
                framework=ComplianceFramework.GDPR,
                rule_type=RuleType.DATA_PROTECTION,
                title="International Data Transfers",
                description="Ensure adequate level of protection for international data transfers",
                severity=SecurityLevel.CRITICAL,
                category="International Transfers",
                subcategory="Cross-border Data Flows",
                conditions={
                    "requires_adequacy_decision": True,
                    "requires_appropriate_safeguards": True,
                    "requires_binding_corporate_rules": True,
                    "requires_specific_situations": True,
                },
                regulatory_reference="GDPR Articles 44-50",
                control_objective="Protect personal data in international transfers",
                evidence_requirements=[
                    "Transfer impact assessments",
                    "Adequacy decisions",
                    "Standard contractual clauses",
                    "Binding corporate rules",
                    "Transfer records",
                ],
                testing_procedures=[
                    "Review transfer mechanisms",
                    "Verify safeguard implementation",
                    "Check documentation completeness",
                ],
            ),
        ]

    def validate_package(
        self, package_data: dict[str, Any]
    ) -> list[ComplianceViolation]:
        """Validate package against GDPR requirements."""
        violations = []

        # Check if package processes personal data
        processes_personal_data = package_data.get("processes_personal_data", False)
        if not processes_personal_data:
            return violations

        # Check legal basis requirement
        if not package_data.get("has_legal_basis", False):
            violations.append(
                ComplianceViolation(
                    rule_id="GDPR-Art6",
                    framework=ComplianceFramework.GDPR,
                    organization_id=package_data.get("organization_id"),
                    violation_type="missing_legal_basis",
                    title="Missing Legal Basis for Processing",
                    description="Package processes personal data without valid legal basis",
                    severity=SecurityLevel.CRITICAL,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="gdpr_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Check consent mechanism
        if package_data.get("relies_on_consent", False) and not package_data.get(
            "has_valid_consent", False
        ):
            violations.append(
                ComplianceViolation(
                    rule_id="GDPR-Art7",
                    framework=ComplianceFramework.GDPR,
                    organization_id=package_data.get("organization_id"),
                    violation_type="invalid_consent",
                    title="Invalid Consent Mechanism",
                    description="Package relies on consent but lacks valid consent mechanism",
                    severity=SecurityLevel.HIGH,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="gdpr_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Check data protection by design
        if not package_data.get("privacy_by_design", False):
            violations.append(
                ComplianceViolation(
                    rule_id="GDPR-Art25",
                    framework=ComplianceFramework.GDPR,
                    organization_id=package_data.get("organization_id"),
                    violation_type="missing_privacy_by_design",
                    title="Missing Privacy by Design",
                    description="Package lacks privacy by design principles",
                    severity=SecurityLevel.HIGH,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="gdpr_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Check security measures
        if not package_data.get("has_security_measures", False):
            violations.append(
                ComplianceViolation(
                    rule_id="GDPR-Art32",
                    framework=ComplianceFramework.GDPR,
                    organization_id=package_data.get("organization_id"),
                    violation_type="missing_security_measures",
                    title="Missing Security Measures",
                    description="Package lacks appropriate security measures for personal data",
                    severity=SecurityLevel.CRITICAL,
                    affected_packages=[package_data.get("name", "unknown")],
                    detected_by="gdpr_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        return violations

    def validate_organization(
        self, org_data: dict[str, Any]
    ) -> ComplianceValidationResult:
        """Validate organization GDPR compliance."""
        violations = []
        active_rules = self.get_rules()

        # Check DPO appointment
        if not org_data.get("dpo_appointed", False):
            violations.append(
                ComplianceViolation(
                    rule_id="GDPR-Art37",
                    framework=ComplianceFramework.GDPR,
                    organization_id=org_data.get("organization_id"),
                    violation_type="missing_dpo",
                    title="Missing Data Protection Officer",
                    description="Organization has not appointed a Data Protection Officer",
                    severity=SecurityLevel.HIGH,
                    detected_by="gdpr_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Check privacy notices
        if not org_data.get("privacy_notices_updated", False):
            violations.append(
                ComplianceViolation(
                    rule_id="GDPR-Art13-14",
                    framework=ComplianceFramework.GDPR,
                    organization_id=org_data.get("organization_id"),
                    violation_type="outdated_privacy_notices",
                    title="Outdated Privacy Notices",
                    description="Privacy notices do not meet GDPR requirements",
                    severity=SecurityLevel.MEDIUM,
                    detected_by="gdpr_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Check breach notification procedures
        if not org_data.get("breach_procedures", False):
            violations.append(
                ComplianceViolation(
                    rule_id="GDPR-Art33",
                    framework=ComplianceFramework.GDPR,
                    organization_id=org_data.get("organization_id"),
                    violation_type="missing_breach_procedures",
                    title="Missing Breach Notification Procedures",
                    description="Organization lacks procedures for breach notification",
                    severity=SecurityLevel.HIGH,
                    detected_by="gdpr_compliance_engine",
                    detection_method="automated_rule_check",
                )
            )

        # Calculate compliance metrics
        total_rules = len(active_rules)
        non_compliant_rules = len(violations)
        compliant_rules = total_rules - non_compliant_rules
        compliance_percentage = (
            (compliant_rules / total_rules * 100) if total_rules > 0 else 0
        )

        # Determine overall status
        if compliance_percentage == 100:
            overall_status = ComplianceStatus.COMPLIANT
        elif compliance_percentage >= 85:  # GDPR requires high compliance
            overall_status = ComplianceStatus.PARTIALLY_COMPLIANT
        else:
            overall_status = ComplianceStatus.NON_COMPLIANT

        return ComplianceValidationResult(
            framework=ComplianceFramework.GDPR,
            organization_id=org_data.get("organization_id"),
            overall_status=overall_status,
            total_rules=total_rules,
            compliant_rules=compliant_rules,
            non_compliant_rules=non_compliant_rules,
            not_assessed_rules=0,
            violations=violations,
            critical_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.CRITICAL
            ),
            high_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.HIGH
            ),
            medium_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.MEDIUM
            ),
            low_violations=sum(
                1 for v in violations if v.severity == SecurityLevel.LOW
            ),
            compliance_percentage=compliance_percentage,
            risk_score=min(10.0, len(violations) * 2.5),
            recommendations=self._generate_gdpr_recommendations(violations),
            required_actions=self._generate_gdpr_required_actions(violations),
        )

    def _generate_gdpr_recommendations(
        self, violations: list[ComplianceViolation]
    ) -> list[str]:
        """Generate GDPR-specific recommendations."""
        recommendations = []

        if any(v.violation_type == "missing_legal_basis" for v in violations):
            recommendations.append(
                "Identify and document legal basis for all personal data processing"
            )

        if any(v.violation_type == "invalid_consent" for v in violations):
            recommendations.append(
                "Implement granular, withdrawable consent mechanisms"
            )

        if any(v.violation_type == "missing_privacy_by_design" for v in violations):
            recommendations.append(
                "Adopt privacy by design principles in system development"
            )

        if any(v.violation_type == "missing_security_measures" for v in violations):
            recommendations.append(
                "Implement comprehensive security measures including encryption and access controls"
            )

        if any(v.violation_type == "missing_dpo" for v in violations):
            recommendations.append("Appoint a Data Protection Officer if required")

        if any(v.violation_type == "outdated_privacy_notices" for v in violations):
            recommendations.append(
                "Update privacy notices to include all required information"
            )

        return recommendations

    def _generate_gdpr_required_actions(
        self, violations: list[ComplianceViolation]
    ) -> list[str]:
        """Generate required actions for GDPR compliance."""
        actions = []

        critical_violations = [
            v for v in violations if v.severity == SecurityLevel.CRITICAL
        ]
        if critical_violations:
            actions.append(
                "Address critical GDPR violations immediately within 72 hours"
            )

        high_violations = [v for v in violations if v.severity == SecurityLevel.HIGH]
        if high_violations:
            actions.append("Remediate high-severity GDPR violations within 30 days")

        if any(
            v.violation_type in ["missing_legal_basis", "missing_security_measures"]
            for v in violations
        ):
            actions.append(
                "Conduct Data Protection Impact Assessment for high-risk processing activities"
            )

        return actions


class ComplianceFrameworkRegistry:
    """
    Registry for all compliance frameworks with rule engines and validation.

    Central registry that manages multiple compliance frameworks,
    provides unified validation interface, and handles rule engines.
    """

    def __init__(self):
        self.handlers: dict[ComplianceFramework, BaseComplianceFrameworkHandler] = {}
        self._initialize_handlers()
        logger.info("Compliance Framework Registry initialized")

    def _initialize_handlers(self) -> None:
        """Initialize all compliance framework handlers."""
        try:
            self.handlers[ComplianceFramework.SOX] = SOXComplianceHandler()
            self.handlers[ComplianceFramework.HIPAA] = HIPAAComplianceHandler()
            self.handlers[ComplianceFramework.PCI_DSS] = PCIDSSComplianceHandler()
            self.handlers[ComplianceFramework.GDPR] = GDPRComplianceHandler()

            logger.info(
                f"Initialized {len(self.handlers)} compliance framework handlers"
            )
        except Exception as e:
            logger.error(f"Failed to initialize compliance handlers: {e}")
            raise

    def get_supported_frameworks(self) -> list[ComplianceFramework]:
        """Get list of supported compliance frameworks."""
        return list(self.handlers.keys())

    def get_framework_handler(
        self, framework: ComplianceFramework
    ) -> Optional[BaseComplianceFrameworkHandler]:
        """Get handler for specific compliance framework."""
        return self.handlers.get(framework)

    def get_all_rules(
        self, framework: Optional[ComplianceFramework] = None
    ) -> list[ComplianceRule]:
        """Get all rules for specified framework or all frameworks."""
        if framework:
            handler = self.handlers.get(framework)
            return handler.get_rules() if handler else []

        all_rules = []
        for handler in self.handlers.values():
            all_rules.extend(handler.get_rules())
        return all_rules

    def validate_package_compliance(
        self, package_data: dict[str, Any], frameworks: list[ComplianceFramework]
    ) -> dict[ComplianceFramework, list[ComplianceViolation]]:
        """
        Validate package against specified compliance frameworks.

        Args:
            package_data: Package information for validation
            frameworks: List of frameworks to validate against

        Returns:
            Dictionary mapping frameworks to their violations
        """
        results = {}

        for framework in frameworks:
            handler = self.handlers.get(framework)
            if handler:
                try:
                    violations = handler.validate_package(package_data)
                    results[framework] = violations
                    logger.debug(
                        f"Package validation for {framework}: {len(violations)} violations"
                    )
                except Exception as e:
                    logger.error(f"Failed to validate package against {framework}: {e}")
                    results[framework] = []
            else:
                logger.warning(f"No handler found for framework: {framework}")
                results[framework] = []

        return results

    def validate_organization_compliance(
        self, org_data: dict[str, Any], frameworks: list[ComplianceFramework]
    ) -> dict[ComplianceFramework, ComplianceValidationResult]:
        """
        Validate organization against specified compliance frameworks.

        Args:
            org_data: Organization information for validation
            frameworks: List of frameworks to validate against

        Returns:
            Dictionary mapping frameworks to their validation results
        """
        results = {}

        for framework in frameworks:
            handler = self.handlers.get(framework)
            if handler:
                try:
                    result = handler.validate_organization(org_data)
                    results[framework] = result
                    logger.info(
                        f"Organization validation for {framework}: {result.overall_status}"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to validate organization against {framework}: {e}"
                    )
                    # Create error result
                    results[framework] = ComplianceValidationResult(
                        framework=framework,
                        organization_id=org_data.get("organization_id"),
                        overall_status=ComplianceStatus.NOT_ASSESSED,
                        total_rules=0,
                        compliant_rules=0,
                        non_compliant_rules=0,
                        not_assessed_rules=0,
                        violations=[],
                        critical_violations=0,
                        high_violations=0,
                        medium_violations=0,
                        low_violations=0,
                        compliance_percentage=0.0,
                        risk_score=10.0,
                        recommendations=[f"Failed to assess {framework} compliance"],
                        required_actions=["Investigate compliance assessment failure"],
                    )
            else:
                logger.warning(f"No handler found for framework: {framework}")

        return results

    def get_compliance_summary(
        self, validation_results: dict[ComplianceFramework, ComplianceValidationResult]
    ) -> dict[str, Any]:
        """
        Generate comprehensive compliance summary across all frameworks.

        Args:
            validation_results: Results from framework validations

        Returns:
            Comprehensive compliance summary
        """
        if not validation_results:
            return {
                "overall_status": ComplianceStatus.NOT_ASSESSED,
                "frameworks_assessed": 0,
                "total_violations": 0,
                "average_compliance_percentage": 0.0,
                "highest_risk_score": 0.0,
            }

        # Calculate aggregate metrics
        total_violations = sum(
            len(result.violations) for result in validation_results.values()
        )
        total_critical = sum(
            result.critical_violations for result in validation_results.values()
        )
        total_high = sum(
            result.high_violations for result in validation_results.values()
        )

        compliance_percentages = [
            result.compliance_percentage for result in validation_results.values()
        ]
        average_compliance = sum(compliance_percentages) / len(compliance_percentages)

        risk_scores = [result.risk_score for result in validation_results.values()]
        highest_risk = max(risk_scores) if risk_scores else 0.0

        # Determine overall status
        if all(
            result.overall_status == ComplianceStatus.COMPLIANT
            for result in validation_results.values()
        ):
            overall_status = ComplianceStatus.COMPLIANT
        elif any(
            result.overall_status == ComplianceStatus.NON_COMPLIANT
            for result in validation_results.values()
        ):
            overall_status = ComplianceStatus.NON_COMPLIANT
        else:
            overall_status = ComplianceStatus.PARTIALLY_COMPLIANT

        # Collect all recommendations and actions
        all_recommendations = []
        all_actions = []
        for result in validation_results.values():
            all_recommendations.extend(result.recommendations)
            all_actions.extend(result.required_actions)

        return {
            "overall_status": overall_status,
            "frameworks_assessed": len(validation_results),
            "framework_results": {
                framework.value: {
                    "status": result.overall_status,
                    "compliance_percentage": result.compliance_percentage,
                    "violations": len(result.violations),
                    "risk_score": result.risk_score,
                }
                for framework, result in validation_results.items()
            },
            "total_violations": total_violations,
            "critical_violations": total_critical,
            "high_violations": total_high,
            "average_compliance_percentage": average_compliance,
            "highest_risk_score": highest_risk,
            "recommendations": list(set(all_recommendations)),
            "required_actions": list(set(all_actions)),
            "assessment_timestamp": datetime.utcnow().isoformat(),
        }

    def detect_violations(
        self, package_data: dict[str, Any], frameworks: list[ComplianceFramework]
    ) -> list[ComplianceViolation]:
        """
        Detect all compliance violations for a package across frameworks.

        Args:
            package_data: Package information
            frameworks: Frameworks to check

        Returns:
            List of all detected violations
        """
        all_violations = []

        validation_results = self.validate_package_compliance(package_data, frameworks)
        for violations in validation_results.values():
            all_violations.extend(violations)

        # Sort by severity (critical first)
        severity_order = {
            SecurityLevel.CRITICAL: 0,
            SecurityLevel.HIGH: 1,
            SecurityLevel.MEDIUM: 2,
            SecurityLevel.LOW: 3,
        }

        all_violations.sort(key=lambda v: severity_order.get(v.severity, 4))

        logger.info(f"Detected {len(all_violations)} compliance violations")
        return all_violations

    def generate_compliance_report(
        self, org_data: dict[str, Any], frameworks: list[ComplianceFramework]
    ) -> dict[str, Any]:
        """
        Generate comprehensive compliance report for organization.

        Args:
            org_data: Organization data
            frameworks: Frameworks to assess

        Returns:
            Comprehensive compliance report
        """
        validation_results = self.validate_organization_compliance(org_data, frameworks)
        summary = self.get_compliance_summary(validation_results)

        # Generate detailed report
        report = {
            "organization_id": org_data.get("organization_id"),
            "organization_name": org_data.get("name", "Unknown"),
            "report_generated_at": datetime.utcnow().isoformat(),
            "assessment_summary": summary,
            "framework_details": {},
            "executive_summary": self._generate_executive_summary(
                summary, validation_results
            ),
            "action_plan": self._generate_action_plan(validation_results),
        }

        # Add detailed framework results
        for framework, result in validation_results.items():
            report["framework_details"][framework.value] = {
                "overall_status": result.overall_status,
                "compliance_percentage": result.compliance_percentage,
                "risk_score": result.risk_score,
                "total_rules": result.total_rules,
                "compliant_rules": result.compliant_rules,
                "violations": [
                    {
                        "violation_id": v.violation_id,
                        "rule_id": v.rule_id,
                        "title": v.title,
                        "severity": v.severity,
                        "description": v.description,
                        "remediation_status": v.remediation_status,
                    }
                    for v in result.violations
                ],
                "recommendations": result.recommendations,
                "required_actions": result.required_actions,
            }

        logger.info(
            f"Generated compliance report for organization {org_data.get('organization_id')}"
        )
        return report

    def _generate_executive_summary(
        self,
        summary: dict[str, Any],
        validation_results: dict[ComplianceFramework, ComplianceValidationResult],
    ) -> str:
        """Generate executive summary for compliance report."""
        status = summary["overall_status"]
        frameworks_count = summary["frameworks_assessed"]
        avg_compliance = summary["average_compliance_percentage"]
        total_violations = summary["total_violations"]

        if status == ComplianceStatus.COMPLIANT:
            return f"Organization is fully compliant across all {frameworks_count} assessed frameworks with {avg_compliance:.1f}% average compliance."
        elif status == ComplianceStatus.PARTIALLY_COMPLIANT:
            return f"Organization is partially compliant across {frameworks_count} frameworks with {avg_compliance:.1f}% average compliance and {total_violations} violations requiring attention."
        else:
            return f"Organization has significant compliance gaps across {frameworks_count} frameworks with {avg_compliance:.1f}% average compliance and {total_violations} violations requiring immediate remediation."

    def _generate_action_plan(
        self, validation_results: dict[ComplianceFramework, ComplianceValidationResult]
    ) -> list[dict[str, Any]]:
        """Generate prioritized action plan for compliance remediation."""
        actions = []

        # Collect all violations across frameworks
        all_violations = []
        for result in validation_results.values():
            all_violations.extend(result.violations)

        # Group by severity and create actions
        critical_violations = [
            v for v in all_violations if v.severity == SecurityLevel.CRITICAL
        ]
        high_violations = [
            v for v in all_violations if v.severity == SecurityLevel.HIGH
        ]

        if critical_violations:
            actions.append(
                {
                    "priority": 1,
                    "title": "Address Critical Compliance Violations",
                    "description": f"Immediately remediate {len(critical_violations)} critical violations",
                    "timeline": "Immediate (0-7 days)",
                    "violations": [v.violation_id for v in critical_violations],
                }
            )

        if high_violations:
            actions.append(
                {
                    "priority": 2,
                    "title": "Remediate High-Severity Violations",
                    "description": f"Develop and execute plan for {len(high_violations)} high-severity violations",
                    "timeline": "Short-term (1-4 weeks)",
                    "violations": [v.violation_id for v in high_violations],
                }
            )

        return actions
