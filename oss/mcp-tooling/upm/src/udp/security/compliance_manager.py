"""
Compliance Management System.

Manages compliance frameworks, regulatory requirements, and audit trails
for enterprise customers across various industries and jurisdictions.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class ComplianceFramework(str, Enum):
    """Supported compliance frameworks."""
    SOC2 = "SOC2"
    ISO27001 = "ISO27001"
    GDPR = "GDPR"
    HIPAA = "HIPAA"
    PCI_DSS = "PCI_DSS"
    SOX = "SOX"
    FEDRAMP = "FEDRAMP"
    NIST = "NIST"
    CIS = "CIS"
    CUSTOM = "CUSTOM"


class ComplianceStatus(str, Enum):
    """Compliance status levels."""
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PARTIALLY_COMPLIANT = "partially_compliant"
    NOT_ASSESSED = "not_assessed"
    UNDER_REVIEW = "under_review"


class RiskLevel(str, Enum):
    """Risk levels for compliance violations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ComplianceRequirement:
    """Individual compliance requirement."""
    id: str
    framework: ComplianceFramework
    title: str
    description: str
    category: str
    severity: RiskLevel
    controls: list[str]
    evidence_required: list[str]
    assessment_frequency: str  # daily, weekly, monthly, quarterly, annually


@dataclass
class ComplianceAssessment:
    """Compliance assessment result."""
    requirement_id: str
    framework: ComplianceFramework
    status: ComplianceStatus
    assessed_at: datetime
    assessed_by: str
    evidence: list[str]
    findings: list[str]
    remediation_plan: Optional[str]
    next_assessment: datetime


@dataclass
class ComplianceViolation:
    """Compliance violation record."""
    id: UUID
    requirement_id: str
    framework: ComplianceFramework
    violation_type: str
    description: str
    severity: RiskLevel
    detected_at: datetime
    detected_by: str
    affected_resources: list[str]
    remediation_status: str
    remediation_deadline: Optional[datetime]
    remediation_notes: Optional[str]


class ComplianceManager:
    """Manages compliance frameworks and assessments."""

    def __init__(self):
        self.frameworks = self._load_compliance_frameworks()
        self.requirements = self._load_compliance_requirements()
        self.assessments: dict[str, list[ComplianceAssessment]] = {}
        self.violations: list[ComplianceViolation] = []

    def get_supported_frameworks(self) -> list[ComplianceFramework]:
        """Get list of supported compliance frameworks."""
        return list(ComplianceFramework)

    def get_framework_requirements(
        self,
        framework: ComplianceFramework
    ) -> list[ComplianceRequirement]:
        """Get requirements for a specific compliance framework."""
        return [req for req in self.requirements if req.framework == framework]

    def assess_compliance(
        self,
        organization_id: UUID,
        framework: ComplianceFramework,
        assessor_id: str
    ) -> dict[str, Any]:
        """
        Perform compliance assessment for an organization.

        Args:
            organization_id: Organization being assessed
            framework: Compliance framework to assess against
            assessor_id: ID of the person performing the assessment

        Returns:
            Assessment results and compliance status
        """
        try:
            logger.info(f"Starting compliance assessment for organization {organization_id} against {framework}")

            requirements = self.get_framework_requirements(framework)
            assessments = []
            overall_status = ComplianceStatus.COMPLIANT
            violations = []

            for requirement in requirements:
                # Perform assessment for each requirement
                assessment = self._assess_requirement(
                    requirement, organization_id, assessor_id
                )
                assessments.append(assessment)

                # Check for violations
                if assessment.status == ComplianceStatus.NON_COMPLIANT:
                    violation = self._create_violation(requirement, assessment)
                    violations.append(violation)
                    overall_status = ComplianceStatus.NON_COMPLIANT
                elif assessment.status == ComplianceStatus.PARTIALLY_COMPLIANT:
                    if overall_status == ComplianceStatus.COMPLIANT:
                        overall_status = ComplianceStatus.PARTIALLY_COMPLIANT

            # Store assessments
            org_key = str(organization_id)
            if org_key not in self.assessments:
                self.assessments[org_key] = []
            self.assessments[org_key].extend(assessments)

            # Store violations
            self.violations.extend(violations)

            # Generate compliance report
            report = self._generate_compliance_report(
                organization_id, framework, assessments, violations
            )

            logger.info(f"Compliance assessment completed: {overall_status}")
            return report

        except Exception as e:
            logger.error(f"Failed to assess compliance: {e}", exc_info=True)
            raise

    def get_compliance_status(
        self,
        organization_id: UUID,
        framework: Optional[ComplianceFramework] = None
    ) -> dict[str, Any]:
        """Get current compliance status for an organization."""
        try:
            org_key = str(organization_id)
            org_assessments = self.assessments.get(org_key, [])

            if framework:
                org_assessments = [a for a in org_assessments if a.framework == framework]

            if not org_assessments:
                return {
                    "status": ComplianceStatus.NOT_ASSESSED,
                    "last_assessment": None,
                    "next_assessment": None,
                    "compliance_percentage": 0.0
                }

            # Calculate overall status
            total_requirements = len(org_assessments)
            compliant_count = sum(1 for a in org_assessments if a.status == ComplianceStatus.COMPLIANT)
            compliance_percentage = (compliant_count / total_requirements) * 100 if total_requirements > 0 else 0

            # Determine overall status
            if compliance_percentage == 100:
                overall_status = ComplianceStatus.COMPLIANT
            elif compliance_percentage >= 80:
                overall_status = ComplianceStatus.PARTIALLY_COMPLIANT
            else:
                overall_status = ComplianceStatus.NON_COMPLIANT

            # Get latest assessment date
            latest_assessment = max(org_assessments, key=lambda a: a.assessed_at)

            # Get next assessment date
            next_assessment = min(
                (a.next_assessment for a in org_assessments if a.next_assessment),
                default=None
            )

            return {
                "status": overall_status,
                "last_assessment": latest_assessment.assessed_at,
                "next_assessment": next_assessment,
                "compliance_percentage": compliance_percentage,
                "total_requirements": total_requirements,
                "compliant_requirements": compliant_count,
                "framework": framework.value if framework else "all"
            }

        except Exception as e:
            logger.error(f"Failed to get compliance status: {e}", exc_info=True)
            raise

    def get_violations(
        self,
        organization_id: UUID,
        framework: Optional[ComplianceFramework] = None,
        severity: Optional[RiskLevel] = None
    ) -> list[ComplianceViolation]:
        """Get compliance violations for an organization."""
        try:
            # Filter violations by organization (simplified - in real implementation would query database)
            org_violations = [v for v in self.violations if str(organization_id) in str(v.id)]

            if framework:
                org_violations = [v for v in org_violations if v.framework == framework]

            if severity:
                org_violations = [v for v in org_violations if v.severity == severity]

            return org_violations

        except Exception as e:
            logger.error(f"Failed to get violations: {e}", exc_info=True)
            raise

    def create_remediation_plan(
        self,
        violation_id: UUID,
        plan: str,
        deadline: datetime,
        assigned_to: str
    ) -> bool:
        """Create a remediation plan for a compliance violation."""
        try:
            # Find the violation
            violation = next((v for v in self.violations if v.id == violation_id), None)
            if not violation:
                logger.warning(f"Violation {violation_id} not found")
                return False

            # Update violation with remediation plan
            violation.remediation_status = "planned"
            violation.remediation_deadline = deadline
            violation.remediation_notes = plan

            logger.info(f"Created remediation plan for violation {violation_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to create remediation plan: {e}", exc_info=True)
            return False

    def _assess_requirement(
        self,
        requirement: ComplianceRequirement,
        organization_id: UUID,
        assessor_id: str
    ) -> ComplianceAssessment:
        """Assess a single compliance requirement."""
        try:
            # Simulate assessment logic
            # In real implementation, this would check actual controls and evidence

            # Mock assessment based on requirement type
            if "security" in requirement.title.lower():
                status = ComplianceStatus.COMPLIANT
                evidence = ["security_policy_document", "access_control_audit"]
                findings = []
            elif "data" in requirement.title.lower():
                status = ComplianceStatus.PARTIALLY_COMPLIANT
                evidence = ["data_classification_policy"]
                findings = ["Missing data retention policy"]
            else:
                status = ComplianceStatus.COMPLIANT
                evidence = ["general_compliance_documentation"]
                findings = []

            assessment = ComplianceAssessment(
                requirement_id=requirement.id,
                framework=requirement.framework,
                status=status,
                assessed_at=datetime.utcnow(),
                assessed_by=assessor_id,
                evidence=evidence,
                findings=findings,
                remediation_plan=None,
                next_assessment=datetime.utcnow() + timedelta(days=90)
            )

            return assessment

        except Exception as e:
            logger.error(f"Failed to assess requirement {requirement.id}: {e}")
            # Return non-compliant assessment on error
            return ComplianceAssessment(
                requirement_id=requirement.id,
                framework=requirement.framework,
                status=ComplianceStatus.NON_COMPLIANT,
                assessed_at=datetime.utcnow(),
                assessed_by=assessor_id,
                evidence=[],
                findings=[f"Assessment failed: {str(e)}"],
                remediation_plan="Investigate assessment failure",
                next_assessment=datetime.utcnow() + timedelta(days=30)
            )

    def _create_violation(
        self,
        requirement: ComplianceRequirement,
        assessment: ComplianceAssessment
    ) -> ComplianceViolation:
        """Create a compliance violation from assessment."""
        return ComplianceViolation(
            id=UUID(),
            requirement_id=requirement.id,
            framework=requirement.framework,
            violation_type="non_compliance",
            description=f"Non-compliance with {requirement.title}",
            severity=requirement.severity,
            detected_at=assessment.assessed_at,
            detected_by=assessment.assessed_by,
            affected_resources=[f"organization_{requirement.id}"],
            remediation_status="detected",
            remediation_deadline=None,
            remediation_notes=None
        )

    def _generate_compliance_report(
        self,
        organization_id: UUID,
        framework: ComplianceFramework,
        assessments: list[ComplianceAssessment],
        violations: list[ComplianceViolation]
    ) -> dict[str, Any]:
        """Generate a comprehensive compliance report."""
        total_requirements = len(assessments)
        compliant_count = sum(1 for a in assessments if a.status == ComplianceStatus.COMPLIANT)
        non_compliant_count = sum(1 for a in assessments if a.status == ComplianceStatus.NON_COMPLIANT)
        partially_compliant_count = sum(1 for a in assessments if a.status == ComplianceStatus.PARTIALLY_COMPLIANT)

        compliance_percentage = (compliant_count / total_requirements) * 100 if total_requirements > 0 else 0

        # Categorize violations by severity
        critical_violations = [v for v in violations if v.severity == RiskLevel.CRITICAL]
        high_violations = [v for v in violations if v.severity == RiskLevel.HIGH]
        medium_violations = [v for v in violations if v.severity == RiskLevel.MEDIUM]
        low_violations = [v for v in violations if v.severity == RiskLevel.LOW]

        return {
            "organization_id": str(organization_id),
            "framework": framework.value,
            "assessment_date": datetime.utcnow().isoformat(),
            "overall_status": self._determine_overall_status(compliance_percentage),
            "compliance_percentage": compliance_percentage,
            "requirements_summary": {
                "total": total_requirements,
                "compliant": compliant_count,
                "partially_compliant": partially_compliant_count,
                "non_compliant": non_compliant_count
            },
            "violations_summary": {
                "total": len(violations),
                "critical": len(critical_violations),
                "high": len(high_violations),
                "medium": len(medium_violations),
                "low": len(low_violations)
            },
            "assessments": [
                {
                    "requirement_id": a.requirement_id,
                    "status": a.status.value,
                    "findings": a.findings,
                    "evidence": a.evidence
                }
                for a in assessments
            ],
            "violations": [
                {
                    "id": str(v.id),
                    "requirement_id": v.requirement_id,
                    "severity": v.severity.value,
                    "description": v.description,
                    "detected_at": v.detected_at.isoformat()
                }
                for v in violations
            ],
            "recommendations": self._generate_recommendations(assessments, violations)
        }

    def _determine_overall_status(self, compliance_percentage: float) -> str:
        """Determine overall compliance status based on percentage."""
        if compliance_percentage == 100:
            return ComplianceStatus.COMPLIANT.value
        elif compliance_percentage >= 80:
            return ComplianceStatus.PARTIALLY_COMPLIANT.value
        else:
            return ComplianceStatus.NON_COMPLIANT.value

    def _generate_recommendations(
        self,
        assessments: list[ComplianceAssessment],
        violations: list[ComplianceViolation]
    ) -> list[str]:
        """Generate recommendations based on assessment results."""
        recommendations = []

        # Recommendations based on violations
        critical_violations = [v for v in violations if v.severity == RiskLevel.CRITICAL]
        if critical_violations:
            recommendations.append("Address critical compliance violations immediately")

        high_violations = [v for v in violations if v.severity == RiskLevel.HIGH]
        if high_violations:
            recommendations.append("Develop remediation plan for high-severity violations")

        # Recommendations based on assessment findings
        all_findings = []
        for assessment in assessments:
            all_findings.extend(assessment.findings)

        if any("policy" in finding.lower() for finding in all_findings):
            recommendations.append("Review and update organizational policies")

        if any("access" in finding.lower() for finding in all_findings):
            recommendations.append("Strengthen access control mechanisms")

        if any("data" in finding.lower() for finding in all_findings):
            recommendations.append("Implement data protection measures")

        return recommendations

    def _load_compliance_frameworks(self) -> dict[ComplianceFramework, dict[str, Any]]:
        """Load compliance framework definitions."""
        return {
            ComplianceFramework.SOC2: {
                "name": "SOC 2 Type II",
                "description": "Security, availability, processing integrity, confidentiality, and privacy",
                "categories": ["Security", "Availability", "Processing Integrity", "Confidentiality", "Privacy"]
            },
            ComplianceFramework.ISO27001: {
                "name": "ISO/IEC 27001",
                "description": "Information security management system",
                "categories": ["Information Security", "Risk Management", "Asset Management"]
            },
            ComplianceFramework.GDPR: {
                "name": "General Data Protection Regulation",
                "description": "EU data protection and privacy regulation",
                "categories": ["Data Protection", "Privacy Rights", "Data Processing"]
            },
            ComplianceFramework.HIPAA: {
                "name": "Health Insurance Portability and Accountability Act",
                "description": "US healthcare data protection regulation",
                "categories": ["Protected Health Information", "Administrative Safeguards", "Physical Safeguards"]
            },
            ComplianceFramework.PCI_DSS: {
                "name": "Payment Card Industry Data Security Standard",
                "description": "Credit card data protection standard",
                "categories": ["Cardholder Data", "Network Security", "Access Control"]
            }
        }

    def _load_compliance_requirements(self) -> list[ComplianceRequirement]:
        """Load compliance requirements for all frameworks."""
        requirements = []

        # SOC2 Requirements
        requirements.extend([
            ComplianceRequirement(
                id="SOC2-CC1",
                framework=ComplianceFramework.SOC2,
                title="Control Environment",
                description="The entity demonstrates a commitment to integrity and ethical values",
                category="Security",
                severity=RiskLevel.HIGH,
                controls=["Code of Conduct", "Ethics Training", "Whistleblower Program"],
                evidence_required=["Policy Documents", "Training Records", "Incident Reports"],
                assessment_frequency="quarterly"
            ),
            ComplianceRequirement(
                id="SOC2-CC2",
                framework=ComplianceFramework.SOC2,
                title="Communication and Information",
                description="The entity obtains or generates and uses relevant, quality information",
                category="Security",
                severity=RiskLevel.MEDIUM,
                controls=["Information Systems", "Data Quality", "Communication Protocols"],
                evidence_required=["System Documentation", "Data Quality Reports"],
                assessment_frequency="monthly"
            )
        ])

        # ISO27001 Requirements
        requirements.extend([
            ComplianceRequirement(
                id="ISO27001-5.1",
                framework=ComplianceFramework.ISO27001,
                title="Information Security Policies",
                description="Management direction and support for information security",
                category="Information Security",
                severity=RiskLevel.HIGH,
                controls=["Security Policy", "Policy Review", "Policy Communication"],
                evidence_required=["Security Policy", "Review Records", "Communication Records"],
                assessment_frequency="annually"
            ),
            ComplianceRequirement(
                id="ISO27001-6.1",
                framework=ComplianceFramework.ISO27001,
                title="Information Security Risk Assessment",
                description="Information security risk assessment and treatment",
                category="Risk Management",
                severity=RiskLevel.HIGH,
                controls=["Risk Assessment Process", "Risk Treatment", "Risk Monitoring"],
                evidence_required=["Risk Assessment Reports", "Risk Register", "Treatment Plans"],
                assessment_frequency="quarterly"
            )
        ])

        # GDPR Requirements
        requirements.extend([
            ComplianceRequirement(
                id="GDPR-Art5",
                framework=ComplianceFramework.GDPR,
                title="Principles Relating to Processing of Personal Data",
                description="Lawfulness, fairness, transparency, purpose limitation, data minimization",
                category="Data Protection",
                severity=RiskLevel.CRITICAL,
                controls=["Data Processing Records", "Consent Management", "Data Minimization"],
                evidence_required=["Processing Records", "Consent Records", "Data Inventory"],
                assessment_frequency="monthly"
            ),
            ComplianceRequirement(
                id="GDPR-Art25",
                framework=ComplianceFramework.GDPR,
                title="Data Protection by Design and by Default",
                description="Technical and organizational measures for data protection",
                category="Data Protection",
                severity=RiskLevel.HIGH,
                controls=["Privacy by Design", "Default Settings", "Technical Measures"],
                evidence_required=["Design Documentation", "Technical Specifications", "Testing Results"],
                assessment_frequency="quarterly"
            )
        ])

        return requirements
