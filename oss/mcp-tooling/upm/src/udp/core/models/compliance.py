"""
Compliance model for policy compliance tracking.

Manages compliance checks, violations, and remediation workflows
for dependencies and licenses.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from sqlalchemy import JSON, Boolean, Column, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class ComplianceStatus(str, Enum):
    """Compliance check status."""

    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PENDING = "pending"
    EXEMPTED = "exempted"
    WAIVED = "waived"
    UNKNOWN = "unknown"


class ViolationSeverity(str, Enum):
    """Violation severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ComplianceRule(BaseModel):
    """
    Compliance rule definition.

    Defines specific compliance rules that can be applied
    to projects, dependencies, or licenses.
    """

    __tablename__ = "compliance_rules"

    # Rule identification
    name = Column(String(255), nullable=False, index=True, comment="Rule name")

    description = Column(Text, nullable=True, comment="Rule description")

    rule_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of rule (license, vulnerability, policy)",
    )

    # Rule configuration
    conditions = Column(JSON, nullable=False, comment="Rule conditions and logic")

    actions = Column(
        JSON, default=list, comment="Actions to take when rule is violated"
    )

    # Severity and priority
    severity = Column(
        String(50),
        nullable=False,
        default=ViolationSeverity.MEDIUM,
        comment="Violation severity",
    )

    priority = Column(
        Integer, default=50, nullable=False, comment="Rule priority (1-100)"
    )

    # Status and lifecycle
    is_active = Column(
        Boolean, default=True, nullable=False, comment="Whether rule is active"
    )

    # Organization and project scope
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        comment="Organization scope (null for global)",
    )

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=True,
        index=True,
        comment="Project scope (null for organization-wide)",
    )

    # Indexes
    __table_args__ = (
        Index("idx_compliance_rules_type_active", "rule_type", "is_active"),
        Index("idx_compliance_rules_org_project", "organization_id", "project_id"),
        Index("idx_compliance_rules_severity_priority", "severity", "priority"),
    )

    # Relationships
    organization = relationship("Organization")
    project = relationship("Project")

    def __repr__(self) -> str:
        return (
            f"<ComplianceRule(id={self.id}, name={self.name}, type={self.rule_type})>"
        )


class ComplianceCheck(BaseModel):
    """
    Individual compliance check execution.

    Records the result of applying compliance rules to
    specific targets (dependencies, projects, etc.).
    """

    __tablename__ = "compliance_checks"

    # Check metadata
    check_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique check identifier",
    )

    rule_id = Column(
        UUID(as_uuid=True),
        ForeignKey("compliance_rules.id"),
        nullable=False,
        index=True,
        comment="Compliance rule being checked",
    )

    # Target identification
    target_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of target (dependency, license, project)",
    )

    target_id = Column(
        UUID(as_uuid=True), nullable=False, index=True, comment="ID of target entity"
    )

    target_name = Column(
        String(255), nullable=True, comment="Human-readable target name"
    )

    # Check results
    status = Column(
        String(50),
        nullable=False,
        default=ComplianceStatus.PENDING,
        comment="Compliance status",
    )

    violation_details = Column(JSON, nullable=True, comment="Details of any violations")

    violation_count = Column(
        Integer, default=0, nullable=False, comment="Number of violations found"
    )

    # Context and metadata
    context = Column(JSON, default=dict, comment="Additional context for the check")

    check_metadata = Column(
        JSON, default=dict, comment="Metadata about the check execution"
    )

    # Scan information
    scan_id = Column(
        String(100),
        nullable=True,
        index=True,
        comment="ID of the scan that triggered this check",
    )

    # Remediation
    remediation_steps = Column(
        JSON, default=list, comment="Recommended remediation steps"
    )

    auto_fixable = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether violation can be auto-fixed",
    )

    # Indexes
    __table_args__ = (
        Index("idx_compliance_checks_status", "status", "created_at"),
        Index(
            "idx_compliance_checks_rule_target", "rule_id", "target_type", "target_id"
        ),
        Index("idx_compliance_checks_scan", "scan_id", "status"),
    )

    # Relationships
    rule = relationship("ComplianceRule", backref="checks")

    @property
    def is_compliant(self) -> bool:
        """Check if target is compliant."""
        return self.status == ComplianceStatus.COMPLIANT

    @property
    def is_violation(self) -> bool:
        """Check if this check represents a violation."""
        return self.status == ComplianceStatus.NON_COMPLIANT

    @property
    def has_violations(self) -> bool:
        """Check if any violations were found."""
        return self.violation_count > 0

    def add_violation(self, violation_type: str, details: Dict):
        """Add a violation to the check."""
        if not self.violation_details:
            self.violation_details = []

        self.violation_details.append(
            {
                "type": violation_type,
                "details": details,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

        self.violation_count += 1

        # Update status if this is the first violation
        if self.status == ComplianceStatus.COMPLIANT:
            self.status = ComplianceStatus.NON_COMPLIANT

    def exempt(
        self, reason: str, exempted_by: UUID, expires_at: Optional[datetime] = None
    ):
        """Mark check as exempted."""
        self.status = ComplianceStatus.EXEMPTED
        self.add_metadata(
            {
                "exemption": {
                    "reason": reason,
                    "exempted_by": str(exempted_by),
                    "expires_at": expires_at.isoformat() if expires_at else None,
                }
            }
        )

    def waive(self, reason: str, waived_by: UUID):
        """Mark check as waived."""
        self.status = ComplianceStatus.WAIVED
        self.add_metadata(
            {
                "waiver": {
                    "reason": reason,
                    "waived_by": str(waived_by),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            }
        )

    def __repr__(self) -> str:
        return f"<ComplianceCheck(id={self.id}, rule_id={self.rule_id}, status={self.status})>"


class ComplianceReport(BaseModel):
    """
    Compliance report aggregating multiple checks.

    Provides summary and detailed compliance status
    for projects or organizations.
    """

    __tablename__ = "compliance_reports"

    # Report identification
    report_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique report identifier",
    )

    report_type = Column(
        String(50), nullable=False, comment="Report type (summary, detailed, trends)"
    )

    # Scope
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        comment="Organization scope",
    )

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=True,
        index=True,
        comment="Project scope",
    )

    # Summary statistics
    total_checks = Column(
        Integer, default=0, nullable=False, comment="Total number of checks"
    )

    compliant_checks = Column(
        Integer, default=0, nullable=False, comment="Number of compliant checks"
    )

    non_compliant_checks = Column(
        Integer, default=0, nullable=False, comment="Number of non-compliant checks"
    )

    exempted_checks = Column(
        Integer, default=0, nullable=False, comment="Number of exempted checks"
    )

    waived_checks = Column(
        Integer, default=0, nullable=False, comment="Number of waived checks"
    )

    # Compliance score
    compliance_score = Column(
        Integer, default=0, nullable=False, comment="Overall compliance score (0-100)"
    )

    # Report data
    report_data = Column(JSON, default=dict, comment="Detailed report data and charts")

    recommendations = Column(
        JSON, default=list, comment="Compliance improvement recommendations"
    )

    # Generation metadata
    generated_by = Column(
        UUID(as_uuid=True), nullable=True, comment="User who generated the report"
    )

    generated_at = Column(
        String(50),
        nullable=False,
        default=lambda: datetime.utcnow().isoformat(),
        comment="When report was generated",
    )

    # Indexes
    __table_args__ = (
        Index("idx_compliance_reports_org_project", "organization_id", "project_id"),
        Index("idx_compliance_reports_type_date", "report_type", "generated_at"),
        Index("idx_compliance_reports_score", "compliance_score"),
    )

    # Relationships
    organization = relationship("Organization")
    project = relationship("Project")

    def calculate_score(self) -> int:
        """Calculate compliance score."""
        if self.total_checks == 0:
            return 100

        # Only count non-exempted and non-waived checks in score
        scored_checks = self.total_checks - self.exempted_checks - self.waived_checks
        if scored_checks == 0:
            return 100

        return int((self.compliant_checks / scored_checks) * 100)

    def update_summary(self, checks: List[ComplianceCheck]):
        """Update summary statistics from a list of checks."""
        self.total_checks = len(checks)
        self.compliant_checks = sum(
            1 for c in checks if c.status == ComplianceStatus.COMPLIANT
        )
        self.non_compliant_checks = sum(
            1 for c in checks if c.status == ComplianceStatus.NON_COMPLIANT
        )
        self.exempted_checks = sum(
            1 for c in checks if c.status == ComplianceStatus.EXEMPTED
        )
        self.waived_checks = sum(
            1 for c in checks if c.status == ComplianceStatus.WAIVED
        )

        self.compliance_score = self.calculate_score()

    def __repr__(self) -> str:
        return f"<ComplianceReport(id={self.id}, report_id={self.report_id}, score={self.compliance_score})>"
