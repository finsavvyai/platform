"""
Policy model for UPM compliance and governance.

Represents policy frameworks, rules, and evaluations for
enforcing security and compliance requirements.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import JSON, Boolean, Column, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class PolicyFramework(str, Enum):
    """Policy framework types."""

    CUSTOM = "custom"
    NIST = "nist"
    ISO_27001 = "iso_27001"
    SOX = "sox"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    GDPR = "gdpr"
    SOC2 = "soc2"


class PolicyRuleType(str, Enum):
    """Policy rule types."""

    SECURITY = "security"
    LICENSE = "license"
    VERSION = "version"
    COMPLIANCE = "compliance"
    QUALITY = "quality"
    MAINTENANCE = "maintenance"


class PolicyStatus(str, Enum):
    """Policy status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"
    ARCHIVED = "archived"


class PolicyEvaluationStatus(str, Enum):
    """Policy evaluation status."""

    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    ERROR = "error"
    SKIPPED = "skipped"


class Policy(BaseModel):
    """
    Policy model representing compliance and security policies.

    Policies define rules that projects and dependencies must
    follow, with configurable conditions and actions.
    """

    __tablename__ = "policies"

    # Relationships
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=True,
        comment="Organization this policy belongs to (null for global policies)",
    )

    framework_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policy_frameworks.id"),
        nullable=True,
        comment="Policy framework this policy belongs to",
    )

    # Policy identification
    name = Column(String(255), nullable=False, comment="Policy name")

    description = Column(Text, nullable=True, comment="Policy description")

    # Policy classification
    rule_type = Column(String(50), nullable=False, comment="Type of policy rule")

    category = Column(String(100), nullable=True, comment="Policy category")

    tags = Column(JSON, default=list, comment="Policy tags for classification")

    # Policy definition
    conditions = Column(
        JSON, nullable=False, comment="Conditions that trigger this policy"
    )

    actions = Column(
        JSON, nullable=False, comment="Actions to take when conditions are met"
    )

    # Severity and priority
    severity = Column(
        String(20),
        default="medium",
        nullable=False,
        comment="Policy violation severity",
    )

    priority = Column(
        String(20),
        default="medium",
        nullable=False,
        comment="Policy priority for evaluation",
    )

    # Status and lifecycle
    status = Column(
        String(20), default=PolicyStatus.ACTIVE, nullable=False, comment="Policy status"
    )

    version = Column(
        String(20), default="1.0.0", nullable=False, comment="Policy version"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether policy is currently active",
    )

    # Configuration
    auto_enforce = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether to automatically enforce this policy",
    )

    requires_approval = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether violations require approval",
    )

    # Evaluation settings
    evaluation_frequency = Column(
        String(50),
        default="on_analysis",
        nullable=False,
        comment="When to evaluate this policy",
    )

    # Indexes
    __table_args__ = (
        Index("idx_policies_organization", "organization_id"),
        Index("idx_policies_framework", "framework_id"),
        Index("idx_policies_type", "rule_type"),
        Index("idx_policies_status", "status"),
        Index("idx_policies_active", "is_active", "status"),
    )

    # Relationships
    organization = relationship("Organization", back_populates="policies")

    framework = relationship("PolicyFramework", back_populates="policies")

    evaluations = relationship(
        "PolicyEvaluation", back_populates="policy", cascade="all, delete-orphan"
    )

    # Policy violations
    violations = relationship(
        "PolicyViolation", back_populates="policy", cascade="all, delete-orphan"
    )

    # Exception requests
    exception_requests = relationship(
        "PolicyExceptionRequest", back_populates="policy", cascade="all, delete-orphan"
    )

    @property
    def is_security_policy(self) -> bool:
        """Check if this is a security policy."""
        return self.rule_type == PolicyRuleType.SECURITY

    @property
    def is_license_policy(self) -> bool:
        """Check if this is a license policy."""
        return self.rule_type == PolicyRuleType.LICENSE

    def evaluate_condition(self, context: dict) -> bool:
        """Evaluate policy conditions against given context."""
        # This would need sophisticated condition evaluation logic
        # For now, simple implementation
        if not self.conditions:
            return False

        # TODO: Implement proper condition evaluation
        return True

    def get_triggered_actions(self, context: dict) -> List[dict]:
        """Get actions that should be triggered for given context."""
        if not self.evaluate_condition(context):
            return []

        return self.actions if self.actions else []

    def __repr__(self):
        return f"<Policy(id={self.id}, name={self.name}, type={self.rule_type})>"


class PolicyFramework(BaseModel):
    """
    Policy framework model representing compliance frameworks.

    Frameworks group related policies for specific compliance
    requirements like SOX, HIPAA, PCI-DSS, etc.
    """

    __tablename__ = "policy_frameworks"

    # Framework identification
    name = Column(String(255), nullable=False, comment="Framework name")

    slug = Column(
        String(100),
        unique=True,
        nullable=False,
        comment="URL-friendly framework identifier",
    )

    description = Column(Text, nullable=True, comment="Framework description")

    framework_type = Column(
        String(50),
        default=PolicyFramework.CUSTOM,
        nullable=False,
        comment="Type of framework",
    )

    # Version and status
    version = Column(String(20), nullable=False, comment="Framework version")

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether framework is currently active",
    )

    # Framework configuration
    requirements = Column(JSON, default=list, comment="Framework requirements")

    controls = Column(JSON, default=list, comment="Framework controls")

    # Metadata
    documentation_url = Column(String(500), nullable=True, comment="Documentation URL")

    reference_url = Column(String(500), nullable=True, comment="Reference URL")

    # Indexes
    __table_args__ = (
        Index("idx_policy_frameworks_type", "framework_type"),
        Index("idx_policy_frameworks_active", "is_active"),
        Index("idx_policy_frameworks_slug", "slug"),
    )

    # Relationships
    policies = relationship(
        "Policy", back_populates="framework", cascade="all, delete-orphan"
    )

    @property
    def is_standard_framework(self) -> bool:
        """Check if this is a standard compliance framework."""
        return self.framework_type != PolicyFramework.CUSTOM

    def get_policy_count(self) -> int:
        """Get number of policies in this framework."""
        return len([p for p in self.policies if p.is_active])

    def __repr__(self):
        return f"<PolicyFramework(id={self.id}, name={self.name}, type={self.framework_type})>"


class PolicyEvaluation(BaseModel):
    """
    Policy evaluation model representing results of policy evaluations.

    Tracks when policies were evaluated against projects or
    dependencies and the results of those evaluations.
    """

    __tablename__ = "policy_evaluations"

    # Relationships
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
        comment="Project being evaluated",
    )

    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analysis_sessions.id"),
        nullable=True,
        comment="Analysis session that triggered evaluation",
    )

    policy_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policys.id"),
        nullable=False,
        comment="Policy being evaluated",
    )

    # Evaluation context
    target_type = Column(
        String(50),
        nullable=False,
        comment="Type of target (project, dependency, package)",
    )

    target_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="ID of specific target being evaluated",
    )

    context = Column(JSON, default=dict, comment="Evaluation context data")

    # Evaluation results
    status = Column(String(20), nullable=False, comment="Evaluation result status")

    result_message = Column(
        Text, nullable=True, comment="Human-readable result message"
    )

    evaluation_details = Column(
        JSON, default=dict, comment="Detailed evaluation results"
    )

    # Violation information
    violation_detected = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether policy violation was detected",
    )

    violation_severity = Column(
        String(20), nullable=True, comment="Severity of policy violation"
    )

    violation_details = Column(
        JSON, nullable=True, comment="Details of policy violation"
    )

    # Actions taken
    triggered_actions = Column(
        JSON, default=list, comment="Actions triggered by this evaluation"
    )

    action_results = Column(JSON, default=dict, comment="Results of triggered actions")

    # Timing information
    evaluated_at = Column(
        String(50),
        nullable=False,
        default=lambda: datetime.utcnow().isoformat(),
        comment="When evaluation was performed",
    )

    evaluation_duration_ms = Column(
        String(20), nullable=True, comment="Evaluation duration in milliseconds"
    )

    # Indexes
    __table_args__ = (
        Index("idx_policy_evaluations_project", "project_id"),
        Index("idx_policy_evaluations_policy", "policy_id"),
        Index("idx_policy_evaluations_analysis", "analysis_id"),
        Index("idx_policy_evaluations_status", "status"),
        Index("idx_policy_evaluations_violation", "violation_detected"),
        Index("idx_policy_evaluations_target", "target_type", "target_id"),
    )

    # Relationships
    project = relationship("Project", back_populates="policy_evaluations")

    policy = relationship("Policy", back_populates="evaluations")

    analysis = relationship("AnalysisSession", back_populates="policy_evaluations")

    # Related violations from this evaluation
    violations = relationship(
        "PolicyViolation",
        back_populates="policy_evaluation",
        cascade="all, delete-orphan",
    )

    @property
    def has_violation(self) -> bool:
        """Check if evaluation detected a policy violation."""
        return self.violation_detected

    @property
    def is_critical_violation(self) -> bool:
        """Check if violation is critical."""
        return self.violation_severity == "critical"

    def get_violation_message(self) -> str:
        """Get formatted violation message."""
        if not self.violation_detected:
            return "No policy violation"

        return self.result_message or f"Policy violation detected: {self.policy.name}"

    def __repr__(self):
        return f"<PolicyEvaluation(id={self.id}, policy_id={self.policy_id}, status={self.status})>"
