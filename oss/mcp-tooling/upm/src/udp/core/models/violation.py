"""
Policy violation and exception request models for UPM.

Handles policy violation tracking, exception request workflows,
and remediation management for enterprise policy enforcement.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    JSON,
    TIMESTAMP,
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class ViolationSeverity(str, Enum):
    """Policy violation severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ViolationStatus(str, Enum):
    """Policy violation status values."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"
    ACCEPTED = "accepted"
    ESCALATED = "escalated"


class ExceptionStatus(str, Enum):
    """Exception request status values."""

    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    IMPLEMENTED = "implemented"


class ExceptionType(str, Enum):
    """Exception request types."""

    TEMPORARY = "temporary"
    PERMANENT = "permanent"
    ONE_TIME = "one_time"
    CONDITIONAL = "conditional"


class RemediationType(str, Enum):
    """Violation remediation types."""

    AUTOMATIC = "automatic"
    MANUAL = "manual"
    WORKAROUND = "workaround"
    ACCEPTANCE = "acceptance"
    MITIGATION = "mitigation"


class PolicyViolation(BaseModel):
    """
    Policy violation model for tracking and managing policy breaches.

    Represents instances where policies are violated, including details
    about the violation, its impact, and remediation status.
    """

    __tablename__ = "policy_violations"

    # Relationships
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        comment="Project where violation was detected",
    )

    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analysis_sessions.id", ondelete="CASCADE"),
        nullable=True,
        comment="Analysis session that detected the violation",
    )

    policy_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policys.id", ondelete="CASCADE"),
        nullable=False,
        comment="Policy that was violated",
    )

    policy_evaluation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policy_evaluations.id", ondelete="CASCADE"),
        nullable=True,
        comment="Policy evaluation that detected this violation",
    )

    dependency_id = Column(
        UUID(as_uuid=True),
        ForeignKey("dependencies.id", ondelete="CASCADE"),
        nullable=True,
        comment="Dependency that caused the violation (if applicable)",
    )

    package_id = Column(
        UUID(as_uuid=True),
        ForeignKey("packages.id", ondelete="CASCADE"),
        nullable=True,
        comment="Package that caused the violation (if applicable)",
    )

    # Violation identification
    violation_key = Column(
        String(255),
        nullable=False,
        comment="Unique identifier for this type of violation",
    )

    title = Column(
        String(500),
        nullable=False,
        comment="Human-readable violation title",
    )

    description = Column(
        Text,
        nullable=False,
        comment="Detailed description of the violation",
    )

    # Violation classification
    severity = Column(
        String(20),
        nullable=False,
        default=ViolationSeverity.MEDIUM,
        comment="Severity level of the violation",
    )

    category = Column(
        String(100),
        nullable=True,
        comment="Violation category (security, license, compliance, etc.)",
    )

    tags = Column(
        ARRAY(String),
        default=list,
        comment="Tags for violation classification and filtering",
    )

    # Violation details
    violation_details = Column(
        JSON,
        nullable=False,
        default=dict,
        comment="Detailed violation data and context",
    )

    detected_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="When the violation was detected",
    )

    first_detected_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="When this violation was first detected (for recurring violations)",
    )

    # Status and lifecycle
    status = Column(
        String(20),
        nullable=False,
        default=ViolationStatus.OPEN,
        comment="Current status of the violation",
    )

    acknowledged_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the violation was acknowledged",
    )

    acknowledged_by = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User who acknowledged the violation",
    )

    resolved_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the violation was resolved",
    )

    resolved_by = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User who resolved the violation",
    )

    # Risk and impact assessment
    risk_score = Column(
        Numeric(5, 2),
        nullable=True,
        comment="Calculated risk score (0-10)",
    )

    business_impact = Column(
        Text,
        nullable=True,
        comment="Description of business impact",
    )

    technical_impact = Column(
        Text,
        nullable=True,
        comment="Description of technical impact",
    )

    # Affected resources
    affected_components = Column(
        ARRAY(String),
        default=list,
        comment="List of affected components or systems",
    )

    affected_versions = Column(
        JSON,
        default=dict,
        comment="Affected package versions or configurations",
    )

    # Remediation information
    remediation_required = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether remediation is required",
    )

    remediation_type = Column(
        String(50),
        nullable=True,
        comment="Type of remediation required",
    )

    remediation_steps = Column(
        JSON,
        default=list,
        comment="Steps required to remediate the violation",
    )

    remediation_complexity = Column(
        String(20),
        default="medium",
        comment="Complexity of remediation (low, medium, high)",
    )

    estimated_remediation_time = Column(
        Integer,  # in hours
        nullable=True,
        comment="Estimated time to remediate (in hours)",
    )

    # Exception handling
    exception_requestable = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether an exception can be requested for this violation",
    )

    auto_exception_eligible = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether auto-exception is possible",
    )

    # Metadata and tracking
    detection_source = Column(
        String(100),
        nullable=True,
        comment="Source that detected the violation (scan, manual, etc.)",
    )

    false_positive_indicator = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Indicator that this might be a false positive",
    )

    recurrence_count = Column(
        Integer,
        default=1,
        nullable=False,
        comment="Number of times this violation has occurred",
    )

    last_seen_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="When this violation was last seen",
    )

    # Indexes
    __table_args__ = (
        Index("idx_policy_violations_project", "project_id"),
        Index("idx_policy_violations_policy", "policy_id"),
        Index("idx_policy_violations_analysis", "analysis_id"),
        Index("idx_policy_violations_status", "status"),
        Index("idx_policy_violations_severity", "severity"),
        Index("idx_policy_violations_detected", "detected_at"),
        Index("idx_policy_violations_key", "violation_key"),
        Index("idx_policy_violations_active", "status", "severity"),
        Index("idx_policy_violations_remediation", "remediation_required", "status"),
    )

    # Relationships
    project = relationship("Project", back_populates="policy_violations")
    policy = relationship("Policy", back_populates="violations")
    policy_evaluation = relationship("PolicyEvaluation", back_populates="violations")
    dependency = relationship("Dependency", back_populates="policy_violations")
    package = relationship("Package", back_populates="policy_violations")

    # Related exception requests
    exception_requests = relationship(
        "PolicyExceptionRequest",
        back_populates="violation",
        cascade="all, delete-orphan",
        order_by="PolicyExceptionRequest.created_at.desc()",
    )

    # Remediation activities
    remediation_activities = relationship(
        "ViolationRemediation",
        back_populates="violation",
        cascade="all, delete-orphan",
        order_by="ViolationRemediation.created_at.desc()",
    )

    @property
    def is_active(self) -> bool:
        """Check if violation is still active (not resolved or accepted)."""
        return self.status in [
            ViolationStatus.OPEN,
            ViolationStatus.IN_PROGRESS,
            ViolationStatus.ACKNOWLEDGED,
        ]

    @property
    def is_critical(self) -> bool:
        """Check if violation is critical severity."""
        return self.severity == ViolationSeverity.CRITICAL

    @property
    def age_days(self) -> int:
        """Calculate age of violation in days."""
        return (datetime.utcnow() - self.detected_at).days

    @property
    def sla_breached(self) -> bool:
        """Check if SLA for resolution has been breached."""
        if not self.is_active:
            return False

        sla_hours = {
            ViolationSeverity.CRITICAL: 24,
            ViolationSeverity.HIGH: 72,
            ViolationSeverity.MEDIUM: 168,  # 1 week
            ViolationSeverity.LOW: 720,  # 30 days
        }

        deadline = self.detected_at + timedelta(hours=sla_hours.get(self.severity, 168))
        return datetime.utcnow() > deadline

    def get_severity_priority(self) -> int:
        """Get numeric priority for severity (lower number = higher priority)."""
        priorities = {
            ViolationSeverity.CRITICAL: 1,
            ViolationSeverity.HIGH: 2,
            ViolationSeverity.MEDIUM: 3,
            ViolationSeverity.LOW: 4,
        }
        return priorities.get(self.severity, 5)

    def escalate_if_needed(self) -> bool:
        """Check if violation should be escalated based on age and severity."""
        if not self.is_active:
            return False

        # Escalation rules
        escalation_hours = {
            ViolationSeverity.CRITICAL: 12,
            ViolationSeverity.HIGH: 48,
            ViolationSeverity.MEDIUM: 168,  # 1 week
            ViolationSeverity.LOW: 720,  # 30 days
        }

        deadline = self.detected_at + timedelta(
            hours=escalation_hours.get(self.severity, 168)
        )
        if datetime.utcnow() > deadline and self.status != ViolationStatus.ESCALATED:
            self.status = ViolationStatus.ESCALATED
            return True

        return False

    def __repr__(self):
        return f"<PolicyViolation(id={self.id}, key={self.violation_key}, severity={self.severity}, status={self.status})>"


class PolicyExceptionRequest(BaseModel):
    """
    Policy exception request model for managing policy deviation requests.

    Represents formal requests to deviate from policies, including justification,
    approval workflow, and exception lifecycle management.
    """

    __tablename__ = "policy_exception_requests"

    # Relationships
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        comment="Project requesting the exception",
    )

    violation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policy_violations.id", ondelete="CASCADE"),
        nullable=True,
        comment="Associated policy violation (if any)",
    )

    policy_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policys.id", ondelete="CASCADE"),
        nullable=False,
        comment="Policy for which exception is requested",
    )

    requester_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        comment="User requesting the exception",
    )

    approver_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User who approved/rejected the exception",
    )

    workflow_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="Associated approval workflow ID",
    )

    # Exception identification
    exception_key = Column(
        String(255),
        nullable=False,
        comment="Unique identifier for this exception request",
    )

    title = Column(
        String(500),
        nullable=False,
        comment="Human-readable exception title",
    )

    description = Column(
        Text,
        nullable=False,
        comment="Detailed description of the exception request",
    )

    # Exception classification
    exception_type = Column(
        String(50),
        nullable=False,
        default=ExceptionType.TEMPORARY,
        comment="Type of exception being requested",
    )

    category = Column(
        String(100),
        nullable=True,
        comment="Exception category",
    )

    priority = Column(
        String(20),
        default="medium",
        comment="Priority level of the exception request",
    )

    # Exception details and justification
    justification = Column(
        Text,
        nullable=False,
        comment="Business justification for the exception",
    )

    business_risk = Column(
        Text,
        nullable=True,
        comment="Description of business risk if exception is not granted",
    )

    mitigation_plan = Column(
        Text,
        nullable=True,
        comment="Plan to mitigate risks associated with the exception",
    )

    # Exception scope and conditions
    scope = Column(
        JSON,
        default=dict,
        comment="Scope of the exception (what it applies to)",
    )

    conditions = Column(
        JSON,
        default=list,
        comment="Conditions that must be met for the exception to be valid",
    )

    # Time-based constraints
    start_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the exception becomes effective",
    )

    end_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the exception expires (for temporary exceptions)",
    )

    duration_days = Column(
        Integer,
        nullable=True,
        comment="Duration of exception in days",
    )

    # Status and workflow
    status = Column(
        String(20),
        nullable=False,
        default=ExceptionStatus.PENDING,
        comment="Current status of the exception request",
    )

    submitted_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="When the exception request was submitted",
    )

    reviewed_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the exception request was reviewed",
    )

    decided_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When a decision was made on the exception request",
    )

    implemented_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the approved exception was implemented",
    )

    # Decision details
    decision = Column(
        String(20),
        nullable=True,
        comment="Decision on the exception request (approved/rejected)",
    )

    decision_reason = Column(
        Text,
        nullable=True,
        comment="Reason for the decision",
    )

    approval_conditions = Column(
        JSON,
        default=list,
        comment="Conditions attached to the approval",
    )

    # Review and approval requirements
    review_required = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether formal review is required",
    )

    approval_required = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether approval is required",
    )

    required_approvers = Column(
        ARRAY(String),
        default=list,
        comment="List of roles/users who must approve",
    )

    # Monitoring and compliance
    monitoring_required = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether monitoring is required during exception period",
    )

    compliance_checks = Column(
        JSON,
        default=list,
        comment="Compliance checks that must be performed",
    )

    # Risk assessment
    risk_assessment = Column(
        JSON,
        default=dict,
        comment="Risk assessment details",
    )

    risk_score = Column(
        Numeric(5, 2),
        nullable=True,
        comment="Calculated risk score (0-10)",
    )

    # Metadata
    tags = Column(
        ARRAY(String),
        default=list,
        comment="Tags for categorization and filtering",
    )

    extra_metadata = Column(
        "metadata",
        JSON,
        default=dict,
        comment="Additional metadata",
    )

    # Indexes
    __table_args__ = (
        Index("idx_policy_exceptions_project", "project_id"),
        Index("idx_policy_exceptions_violation", "violation_id"),
        Index("idx_policy_exceptions_policy", "policy_id"),
        Index("idx_policy_exceptions_requester", "requester_id"),
        Index("idx_policy_exceptions_status", "status"),
        Index("idx_policy_exceptions_type", "exception_type"),
        Index("idx_policy_exceptions_submitted", "submitted_at"),
        Index("idx_policy_exceptions_active", "status", "end_date"),
    )

    # Relationships
    project = relationship("Project", back_populates="policy_exceptions")
    violation = relationship("PolicyViolation", back_populates="exception_requests")
    policy = relationship("Policy", back_populates="exception_requests")

    # Exception activities and history
    activities = relationship(
        "ExceptionActivity",
        back_populates="exception_request",
        cascade="all, delete-orphan",
        order_by="ExceptionActivity.created_at.desc()",
    )

    # Compliance monitoring records
    compliance_records = relationship(
        "ExceptionComplianceRecord",
        back_populates="exception_request",
        cascade="all, delete-orphan",
        order_by="ExceptionComplianceRecord.created_at.desc()",
    )

    @property
    def is_active(self) -> bool:
        """Check if exception is currently active."""
        if self.status != ExceptionStatus.APPROVED:
            return False

        now = datetime.utcnow()

        # Check start date
        if self.start_date and now < self.start_date:
            return False

        # Check end date for temporary exceptions
        if self.end_date and now > self.end_date:
            return False

        return True

    @property
    def is_expired(self) -> bool:
        """Check if exception has expired."""
        if not self.end_date:
            return False

        return datetime.utcnow() > self.end_date

    @property
    def days_until_expiry(self) -> Optional[int]:
        """Calculate days until expiry."""
        if not self.end_date:
            return None

        delta = self.end_date - datetime.utcnow()
        return max(0, delta.days)

    @property
    def approval_pending_days(self) -> int:
        """Calculate days pending approval."""
        if self.status not in [ExceptionStatus.PENDING, ExceptionStatus.UNDER_REVIEW]:
            return 0

        return (datetime.utcnow() - self.submitted_at).days

    def can_be_cancelled(self, user_id: UUID) -> bool:
        """Check if user can cancel this exception request."""
        # Requester can cancel if not yet decided
        if self.requester_id == user_id and self.status in [
            ExceptionStatus.PENDING,
            ExceptionStatus.UNDER_REVIEW,
        ]:
            return True

        # Admin users can cancel under certain conditions
        # This would integrate with RBAC system

        return False

    def requires_renewal(self, days_ahead: int = 30) -> bool:
        """Check if exception will require renewal soon."""
        if not self.end_date or self.exception_type != ExceptionType.TEMPORARY:
            return False

        days_until = self.days_until_expiry
        return days_until is not None and days_until <= days_ahead

    def __repr__(self):
        return f"<PolicyExceptionRequest(id={self.id}, key={self.exception_key}, status={self.status}, type={self.exception_type})>"


class ViolationRemediation(BaseModel):
    """
    Violation remediation model for tracking remediation activities.

    Records remediation efforts, progress, and outcomes for policy violations.
    """

    __tablename__ = "violation_remediations"

    # Relationships
    violation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policy_violations.id", ondelete="CASCADE"),
        nullable=False,
        comment="Violation being remediated",
    )

    assigned_to_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User assigned to perform remediation",
    )

    completed_by_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User who completed the remediation",
    )

    # Remediation details
    remediation_type = Column(
        String(50),
        nullable=False,
        comment="Type of remediation performed",
    )

    title = Column(
        String(500),
        nullable=False,
        comment="Remediation activity title",
    )

    description = Column(
        Text,
        nullable=False,
        comment="Detailed description of remediation activities",
    )

    # Status and progress
    status = Column(
        String(20),
        default="in_progress",
        nullable=False,
        comment="Remediation status",
    )

    progress_percentage = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Progress percentage (0-100)",
    )

    started_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="When remediation started",
    )

    completed_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When remediation was completed",
    )

    # Effort estimation
    estimated_hours = Column(
        Numeric(5, 2),
        nullable=True,
        comment="Estimated effort in hours",
    )

    actual_hours = Column(
        Numeric(5, 2),
        nullable=True,
        comment="Actual effort in hours",
    )

    # Remediation steps and outcomes
    steps_performed = Column(
        JSON,
        default=list,
        comment="List of remediation steps performed",
    )

    outcome = Column(
        Text,
        nullable=True,
        comment="Description of remediation outcome",
    )

    verification_method = Column(
        String(100),
        nullable=True,
        comment="How remediation was verified",
    )

    verification_results = Column(
        JSON,
        default=dict,
        comment="Results of remediation verification",
    )

    # Follow-up actions
    follow_up_required = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether follow-up actions are required",
    )

    follow_up_actions = Column(
        JSON,
        default=list,
        comment="List of follow-up actions",
    )

    next_review_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="Date for next review of remediation",
    )

    # Metadata
    extra_metadata = Column(
        "metadata",
        JSON,
        default=dict,
        comment="Additional remediation metadata",
    )

    # Indexes
    __table_args__ = (
        Index("idx_violation_remediations_violation", "violation_id"),
        Index("idx_violation_remediations_assigned", "assigned_to_id"),
        Index("idx_violation_remediations_status", "status"),
        Index("idx_violation_remediations_started", "started_at"),
    )

    # Relationships
    violation = relationship("PolicyViolation", back_populates="remediation_activities")

    @property
    def is_completed(self) -> bool:
        """Check if remediation is completed."""
        return self.status == "completed" and self.completed_at is not None

    @property
    def duration_days(self) -> Optional[int]:
        """Calculate duration in days."""
        if not self.completed_at:
            return None

        return (self.completed_at - self.started_at).days

    @property
    def is_overdue(self) -> bool:
        """Check if remediation is overdue based on violation SLA."""
        if self.is_completed:
            return False

        # This would check against the violation's SLA
        # For now, simple check based on age
        return (datetime.utcnow() - self.started_at).days > 30

    def __repr__(self):
        return f"<ViolationRemediation(id={self.id}, violation_id={self.violation_id}, type={self.remediation_type}, status={self.status})>"


class ExceptionActivity(BaseModel):
    """
    Exception activity model for tracking exception request activities.

    Records all activities and changes throughout the exception lifecycle.
    """

    __tablename__ = "exception_activities"

    # Relationships
    exception_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policy_exception_requests.id", ondelete="CASCADE"),
        nullable=False,
        comment="Exception request this activity belongs to",
    )

    user_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User who performed the activity",
    )

    # Activity details
    activity_type = Column(
        String(100),
        nullable=False,
        comment="Type of activity (created, submitted, approved, etc.)",
    )

    title = Column(
        String(500),
        nullable=False,
        comment="Activity title or summary",
    )

    description = Column(
        Text,
        nullable=True,
        comment="Detailed activity description",
    )

    # Activity data
    old_values = Column(
        JSON,
        default=dict,
        comment="Previous values before this activity",
    )

    new_values = Column(
        JSON,
        default=dict,
        comment="New values after this activity",
    )

    activity_data = Column(
        JSON,
        default=dict,
        comment="Additional activity-specific data",
    )

    # System information
    ip_address = Column(
        String(45),
        nullable=True,
        comment="IP address from which activity was performed",
    )

    user_agent = Column(
        String(500),
        nullable=True,
        comment="User agent string",
    )

    # Indexes
    __table_args__ = (
        Index("idx_exception_activities_request", "exception_request_id"),
        Index("idx_exception_activities_user", "user_id"),
        Index("idx_exception_activities_type", "activity_type"),
        Index("idx_exception_activities_created", "created_at"),
    )

    # Relationships
    exception_request = relationship(
        "PolicyExceptionRequest", back_populates="activities"
    )

    def __repr__(self):
        return f"<ExceptionActivity(id={self.id}, type={self.activity_type}, request_id={self.exception_request_id})>"


class ExceptionComplianceRecord(BaseModel):
    """
    Exception compliance record for monitoring exception compliance.

    Tracks compliance checks and monitoring activities for active exceptions.
    """

    __tablename__ = "exception_compliance_records"

    # Relationships
    exception_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("policy_exception_requests.id", ondelete="CASCADE"),
        nullable=False,
        comment="Exception request being monitored",
    )

    checked_by_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="User who performed the compliance check",
    )

    # Compliance check details
    check_type = Column(
        String(100),
        nullable=False,
        comment="Type of compliance check performed",
    )

    check_description = Column(
        Text,
        nullable=True,
        comment="Description of what was checked",
    )

    # Check results
    compliance_status = Column(
        String(20),
        nullable=False,
        comment="Compliance status (compliant, non_compliant, warning)",
    )

    findings = Column(
        JSON,
        default=list,
        comment="List of compliance findings",
    )

    risk_indicators = Column(
        JSON,
        default=list,
        comment="Risk indicators identified during check",
    )

    recommendations = Column(
        JSON,
        default=list,
        comment="Recommendations from compliance check",
    )

    # Check scheduling
    next_check_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="Date for next compliance check",
    )

    check_frequency = Column(
        String(50),
        nullable=True,
        comment="Frequency of compliance checks",
    )

    # Indexes
    __table_args__ = (
        Index("idx_exception_compliance_request", "exception_request_id"),
        Index("idx_exception_compliance_checker", "checked_by_id"),
        Index("idx_exception_compliance_status", "compliance_status"),
        Index("idx_exception_compliance_next_check", "next_check_date"),
    )

    # Relationships
    exception_request = relationship(
        "PolicyExceptionRequest", back_populates="compliance_records"
    )

    @property
    def has_findings(self) -> bool:
        """Check if compliance check found any issues."""
        return bool(self.findings)

    @property
    def is_overdue(self) -> bool:
        """Check if next compliance check is overdue."""
        if not self.next_check_date:
            return False

        return datetime.utcnow() > self.next_check_date

    def __repr__(self):
        return f"<ExceptionComplianceRecord(id={self.id}, type={self.check_type}, status={self.compliance_status})>"
