"""
Core domain models for Universal Dependency Platform.

Enterprise-grade Pydantic models with comprehensive validation,
security features, and business logic representation.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

import semver
from pydantic import BaseModel, Field, root_validator, validator


class EcosystemType(str, Enum):
    """Supported package ecosystem types."""
    NPM = "npm"
    PYPI = "pypi"
    MAVEN = "maven"
    CARGO = "cargo"
    NUGET = "nuget"
    COMPOSER = "composer"
    RUBYGEMS = "rubygems"
    GO = "go"


class SecurityLevel(str, Enum):
    """Security risk levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class LicenseType(str, Enum):
    """Common license types for enterprise compliance."""
    MIT = "MIT"
    APACHE_2_0 = "Apache-2.0"
    BSD_2_CLAUSE = "BSD-2-Clause"
    BSD_3_CLAUSE = "BSD-3-Clause"
    GPL_2_0 = "GPL-2.0"
    GPL_3_0 = "GPL-3.0"
    LGPL_2_1 = "LGPL-2.1"
    LGPL_3_0 = "LGPL-3.0"
    ISC = "ISC"
    UNLICENSE = "Unlicense"
    PROPRIETARY = "Proprietary"
    UNKNOWN = "Unknown"


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    DRAFT = "draft"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    WAITING_FOR_APPROVAL = "waiting_for_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PolicyAction(str, Enum):
    """Policy enforcement actions."""
    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"
    REQUIRE_APPROVAL = "require_approval"


class BaseEntity(BaseModel):
    """Base entity with common enterprise audit fields."""

    id: UUID = Field(default_factory=uuid4, description="Unique identifier")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")
    created_by: Optional[str] = Field(default=None, description="Creator user ID")
    updated_by: Optional[str] = Field(default=None, description="Last updater user ID")
    is_deleted: bool = Field(default=False, description="Soft delete flag")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }


class Package(BaseEntity):
    """
    Represents a software package in any ecosystem.

    Core entity representing packages from npm, PyPI, Maven Central, etc.
    Includes comprehensive metadata for enterprise governance.
    """

    name: str = Field(..., min_length=1, max_length=255, description="Package name")
    version: str = Field(..., min_length=1, max_length=50, description="Package version")
    ecosystem: EcosystemType = Field(..., description="Package ecosystem")
    namespace: Optional[str] = Field(default=None, max_length=255, description="Package namespace/scope")
    description: Optional[str] = Field(default=None, max_length=2000, description="Package description")
    homepage: Optional[str] = Field(default=None, max_length=500, description="Package homepage URL")
    repository_url: Optional[str] = Field(default=None, max_length=500, description="Source repository URL")
    license: LicenseType = Field(default=LicenseType.UNKNOWN, description="Package license")
    license_text: Optional[str] = Field(default=None, description="Full license text")
    author: Optional[str] = Field(default=None, max_length=255, description="Package author")
    maintainers: list[str] = Field(default_factory=list, description="Package maintainers")
    published_at: Optional[datetime] = Field(default=None, description="Publication timestamp")
    download_url: Optional[str] = Field(default=None, max_length=500, description="Download URL")
    size_bytes: Optional[int] = Field(default=None, ge=0, description="Package size in bytes")
    checksum: Optional[str] = Field(default=None, max_length=128, description="Package checksum")
    tags: set[str] = Field(default_factory=set, description="Package tags")

    @validator("name")
    def validate_package_name(cls, v: str) -> str:
        """Validate package name format."""
        if not v.strip():
            raise ValueError("Package name cannot be empty")
        return v.strip().lower()

    @validator("version")
    def validate_version(cls, v: str, values: dict) -> str:
        """Validate version format based on ecosystem."""
        ecosystem = values.get("ecosystem")

        if ecosystem in [EcosystemType.NPM, EcosystemType.PYPI]:
            # Try to parse as semantic version
            try:
                semver.VersionInfo.parse(v)
            except ValueError:
                # Allow non-semver versions for flexibility
                pass

        return v.strip()

    @property
    def full_name(self) -> str:
        """Get full package name including namespace."""
        if self.namespace:
            return f"{self.namespace}/{self.name}"
        return self.name

    @property
    def registry_key(self) -> str:
        """Get unique registry key."""
        return f"{self.ecosystem}:{self.full_name}@{self.version}"


class Vulnerability(BaseEntity):
    """
    Security vulnerability information.

    Represents known security vulnerabilities in packages with
    comprehensive tracking and remediation information.
    """

    cve_id: Optional[str] = Field(default=None, max_length=20, description="CVE identifier")
    advisory_id: str = Field(..., max_length=100, description="Security advisory ID")
    title: str = Field(..., min_length=1, max_length=500, description="Vulnerability title")
    description: str = Field(..., min_length=1, description="Detailed description")
    severity: SecurityLevel = Field(..., description="Vulnerability severity")
    cvss_score: Optional[float] = Field(default=None, ge=0.0, le=10.0, description="CVSS score")
    published_at: datetime = Field(..., description="Publication date")
    updated_at_source: Optional[datetime] = Field(default=None, description="Last update at source")
    affected_versions: list[str] = Field(..., min_items=1, description="Affected version ranges")
    fixed_versions: list[str] = Field(default_factory=list, description="Fixed version ranges")
    source: str = Field(..., max_length=100, description="Vulnerability source (NVD, GitHub, etc.)")
    source_url: Optional[str] = Field(default=None, max_length=500, description="Source URL")
    references: list[str] = Field(default_factory=list, description="Reference URLs")
    cwe_ids: list[str] = Field(default_factory=list, description="CWE identifiers")
    exploit_available: bool = Field(default=False, description="Known exploit availability")
    patch_available: bool = Field(default=False, description="Patch availability")

    @validator("cvss_score")
    def validate_cvss_score(cls, v: Optional[float]) -> Optional[float]:
        """Validate CVSS score range."""
        if v is not None and not (0.0 <= v <= 10.0):
            raise ValueError("CVSS score must be between 0.0 and 10.0")
        return v

    @property
    def is_high_risk(self) -> bool:
        """Check if vulnerability is high risk."""
        return self.severity in [SecurityLevel.CRITICAL, SecurityLevel.HIGH]

    @property
    def is_exploitable(self) -> bool:
        """Check if vulnerability has known exploits."""
        return self.exploit_available


class License(BaseEntity):
    """
    License information and compliance tracking.

    Represents software licenses with enterprise compliance metadata
    and compatibility information.
    """

    name: str = Field(..., min_length=1, max_length=100, description="License name")
    spdx_id: Optional[str] = Field(default=None, max_length=50, description="SPDX license identifier")
    license_type: LicenseType = Field(..., description="Standardized license type")
    text: Optional[str] = Field(default=None, description="Full license text")
    url: Optional[str] = Field(default=None, max_length=500, description="License URL")
    is_osi_approved: bool = Field(default=False, description="OSI approved license")
    is_copyleft: bool = Field(default=False, description="Copyleft license")
    allows_commercial_use: bool = Field(default=True, description="Commercial use allowed")
    allows_modification: bool = Field(default=True, description="Modification allowed")
    allows_distribution: bool = Field(default=True, description="Distribution allowed")
    requires_attribution: bool = Field(default=True, description="Attribution required")
    requires_source_disclosure: bool = Field(default=False, description="Source disclosure required")
    compatibility_notes: Optional[str] = Field(default=None, description="Compatibility notes")

    @property
    def is_permissive(self) -> bool:
        """Check if license is permissive."""
        return not self.is_copyleft and self.allows_commercial_use

    @property
    def enterprise_friendly(self) -> bool:
        """Check if license is enterprise-friendly."""
        return (
            self.allows_commercial_use
            and not self.requires_source_disclosure
            and not self.is_copyleft
        )


class User(BaseEntity):
    """User entity for authentication and authorization."""

    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field("user", pattern="^(admin|manager|user|viewer)$")
    organization_id: Optional[UUID] = None
    is_active: bool = Field(True)
    last_login: Optional[datetime] = None
    preferences: dict[str, Any] = Field(default_factory=dict)

    @validator("email")
    def validate_email(cls, v):
        if not v or "@" not in v:
            raise ValueError("Invalid email format")
        return v.lower()


class Organization(BaseEntity):
    """
    Enterprise organization entity.

    Represents an enterprise customer with their policies,
    settings, and compliance requirements.
    """

    name: str = Field(..., min_length=1, max_length=200, description="Organization name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-safe organization identifier")
    domain: Optional[str] = Field(default=None, max_length=255, description="Primary email domain")
    industry: Optional[str] = Field(default=None, max_length=100, description="Industry sector")
    size: Optional[str] = Field(default=None, max_length=50, description="Organization size")
    country: Optional[str] = Field(default=None, max_length=2, description="Country code")
    compliance_frameworks: set[str] = Field(default_factory=set, description="Required compliance frameworks")
    allowed_licenses: set[LicenseType] = Field(default_factory=set, description="Allowed license types")
    blocked_licenses: set[LicenseType] = Field(default_factory=set, description="Blocked license types")
    max_vulnerability_score: float = Field(default=7.0, ge=0.0, le=10.0, description="Maximum allowed CVSS score")
    auto_update_enabled: bool = Field(default=False, description="Automatic updates enabled")
    require_approval: bool = Field(default=True, description="Require manual approval")
    notification_emails: list[str] = Field(default_factory=list, description="Notification email addresses")
    settings: dict[str, Any] = Field(default_factory=dict, description="Organization-specific settings")

    @validator("slug")
    def validate_slug(cls, v: str) -> str:
        """Validate organization slug format."""
        if not v.isalnum() or not v.islower():
            raise ValueError("Slug must be lowercase alphanumeric")
        return v

    @validator("domain")
    def validate_domain(cls, v: Optional[str]) -> Optional[str]:
        """Validate domain format."""
        if v is not None:
            # Basic domain validation
            if not v or "." not in v:
                raise ValueError("Invalid domain format")
        return v

    @property
    def is_enterprise(self) -> bool:
        """Check if organization is enterprise-level."""
        return self.size in ["large", "enterprise"] if self.size else False


class AIRecommendation(BaseEntity):
    """
    AI-generated recommendation with confidence scoring.

    Represents intelligent recommendations from AI analysis with
    confidence metrics and decision rationale.
    """

    recommendation_type: str = Field(..., max_length=100, description="Type of recommendation")
    title: str = Field(..., min_length=1, max_length=500, description="Recommendation title")
    description: str = Field(..., min_length=1, description="Detailed description")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="AI confidence score (0-1)")
    risk_level: SecurityLevel = Field(..., description="Associated risk level")
    action_required: bool = Field(..., description="Whether immediate action is required")
    automated_action: Optional[str] = Field(None, max_length=200, description="Automated action taken")
    human_review_required: bool = Field(..., description="Whether human review is needed")
    rationale: str = Field(..., min_length=1, description="AI reasoning for recommendation")
    supporting_data: dict[str, Any] = Field(default_factory=dict, description="Supporting analysis data")
    workflow_id: Optional[str] = Field(None, max_length=100, description="Associated workflow ID")
    package_name: Optional[str] = Field(None, max_length=255, description="Related package name")
    ecosystem: Optional[EcosystemType] = Field(None, description="Related ecosystem")
    priority: int = Field(default=100, ge=0, le=1000, description="Recommendation priority")
    expires_at: Optional[datetime] = Field(None, description="Recommendation expiration")

    @validator("confidence_score")
    def validate_confidence_score(cls, v: float) -> float:
        """Validate confidence score is between 0 and 1."""
        if not (0.0 <= v <= 1.0):
            raise ValueError("Confidence score must be between 0.0 and 1.0")
        return v

    @property
    def is_high_confidence(self) -> bool:
        """Check if recommendation has high confidence."""
        return self.confidence_score >= 0.8

    @property
    def is_critical(self) -> bool:
        """Check if recommendation is critical priority."""
        return self.priority <= 10 and self.action_required

    @property
    def is_expired(self) -> bool:
        """Check if recommendation has expired."""
        return self.expires_at is not None and datetime.utcnow() > self.expires_at


class ApprovalRequirement(BaseEntity):
    """
    Multi-stakeholder approval requirement for enterprise workflows.

    Represents approval requirements with stakeholder hierarchy,
    dependencies, and escalation policies for enterprise governance.
    """

    workflow_id: str = Field(..., max_length=100, description="Associated workflow ID")
    approver_role: str = Field(..., max_length=100, description="Required approver role")
    approver_email: Optional[str] = Field(None, max_length=255, description="Specific approver email")
    approver_user_id: Optional[UUID] = Field(None, description="Specific approver user ID")
    approval_type: str = Field(..., max_length=100, description="Type of approval required")
    priority: int = Field(default=100, ge=0, le=1000, description="Approval priority (lower = higher)")
    deadline: datetime = Field(..., description="Approval deadline")
    context: dict[str, Any] = Field(default_factory=dict, description="Approval context and data")
    dependencies: list[UUID] = Field(default_factory=list, description="Dependent approval requirement IDs")
    escalation_policy: dict[str, Any] = Field(default_factory=dict, description="Escalation policy configuration")
    stakeholder_hierarchy: list[dict[str, Any]] = Field(default_factory=list, description="Stakeholder hierarchy for escalation")
    auto_approval_conditions: Optional[dict[str, Any]] = Field(None, description="Conditions for automatic approval")
    rejection_conditions: Optional[dict[str, Any]] = Field(None, description="Conditions that trigger automatic rejection")
    approval_status: str = Field(default="pending", description="Current approval status")
    approved_by: Optional[UUID] = Field(None, description="User who provided approval")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")
    rejection_reason: Optional[str] = Field(None, description="Reason for rejection")
    escalation_count: int = Field(default=0, ge=0, description="Number of escalations performed")
    last_escalated_at: Optional[datetime] = Field(None, description="Last escalation timestamp")

    @validator("approval_status")
    def validate_approval_status(cls, v: str) -> str:
        """Validate approval status values."""
        valid_statuses = ["pending", "approved", "rejected", "escalated", "expired", "auto_approved"]
        if v not in valid_statuses:
            raise ValueError(f"Invalid approval status: {v}. Must be one of {valid_statuses}")
        return v

    @validator("deadline")
    def validate_deadline(cls, v: datetime) -> datetime:
        """Validate deadline is in the future."""
        if v <= datetime.utcnow():
            raise ValueError("Approval deadline must be in the future")
        return v

    @property
    def is_pending(self) -> bool:
        """Check if approval is still pending."""
        return self.approval_status == "pending"

    @property
    def is_approved(self) -> bool:
        """Check if approval has been granted."""
        return self.approval_status in ["approved", "auto_approved"]

    @property
    def is_rejected(self) -> bool:
        """Check if approval has been rejected."""
        return self.approval_status == "rejected"

    @property
    def is_expired(self) -> bool:
        """Check if approval deadline has passed."""
        return datetime.utcnow() > self.deadline

    @property
    def time_remaining_hours(self) -> float:
        """Get remaining time until deadline in hours."""
        if self.is_expired:
            return 0.0
        delta = self.deadline - datetime.utcnow()
        return delta.total_seconds() / 3600

    @property
    def requires_escalation(self) -> bool:
        """Check if approval requires escalation based on policy."""
        if not self.escalation_policy:
            return False

        escalation_threshold_hours = self.escalation_policy.get("escalation_threshold_hours", 24)
        return self.time_remaining_hours <= escalation_threshold_hours and self.is_pending

    @property
    def next_escalation_target(self) -> Optional[dict[str, Any]]:
        """Get next escalation target from stakeholder hierarchy."""
        if not self.stakeholder_hierarchy or self.escalation_count >= len(self.stakeholder_hierarchy):
            return None
        return self.stakeholder_hierarchy[self.escalation_count]


class ApprovalResponse(BaseEntity):
    """
    Response to an approval requirement from a stakeholder.

    Represents stakeholder responses with validation, conditions,
    and audit trail for enterprise approval workflows.
    """

    requirement_id: UUID = Field(..., description="Approval requirement ID")
    approver_id: UUID = Field(..., description="Approver user ID")
    approver_email: str = Field(..., max_length=255, description="Approver email address")
    approver_role: str = Field(..., max_length=100, description="Approver role")
    status: str = Field(..., description="Approval response status")
    comments: Optional[str] = Field(None, max_length=2000, description="Approver comments")
    conditions: list[str] = Field(default_factory=list, description="Approval conditions or requirements")
    risk_assessment: Optional[dict[str, Any]] = Field(None, description="Approver's risk assessment")
    alternative_suggestions: list[str] = Field(default_factory=list, description="Alternative suggestions if rejected")
    confidence_level: Optional[str] = Field(None, description="Approver's confidence level")
    responded_at: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")
    ip_address: Optional[str] = Field(None, max_length=45, description="Approver IP address")
    user_agent: Optional[str] = Field(None, max_length=500, description="Approver user agent")
    session_id: Optional[str] = Field(None, max_length=100, description="Session identifier")
    digital_signature: Optional[str] = Field(None, description="Digital signature for audit compliance")

    @validator("status")
    def validate_status(cls, v: str) -> str:
        """Validate response status values."""
        valid_statuses = ["approved", "rejected", "conditional", "delegated", "escalated"]
        if v not in valid_statuses:
            raise ValueError(f"Invalid response status: {v}. Must be one of {valid_statuses}")
        return v

    @validator("confidence_level")
    def validate_confidence_level(cls, v: Optional[str]) -> Optional[str]:
        """Validate confidence level values."""
        if v is not None:
            valid_levels = ["high", "medium", "low"]
            if v not in valid_levels:
                raise ValueError(f"Invalid confidence level: {v}. Must be one of {valid_levels}")
        return v

    @property
    def is_approval(self) -> bool:
        """Check if response is an approval."""
        return self.status in ["approved", "conditional"]

    @property
    def is_rejection(self) -> bool:
        """Check if response is a rejection."""
        return self.status == "rejected"

    @property
    def has_conditions(self) -> bool:
        """Check if approval has conditions."""
        return len(self.conditions) > 0

    @property
    def audit_summary(self) -> dict[str, Any]:
        """Get audit summary for compliance reporting."""
        return {
            "approver_id": str(self.approver_id),
            "approver_email": self.approver_email,
            "approver_role": self.approver_role,
            "status": self.status,
            "responded_at": self.responded_at.isoformat(),
            "has_conditions": self.has_conditions,
            "ip_address": self.ip_address,
            "digital_signature": bool(self.digital_signature)
        }


class PolicyViolation(BaseEntity):
    """Policy violation entity."""

    policy_id: UUID
    package_id: UUID
    violation_type: str
    severity: SecurityLevel
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    resolved: bool = Field(False)
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None


class Policy(BaseEntity):
    """
    Enterprise governance policy.

    Represents policies for dependency management, security,
    licensing, and compliance requirements.
    """

    name: str = Field(..., min_length=1, max_length=200, description="Policy name")
    description: Optional[str] = Field(default=None, max_length=1000, description="Policy description")
    organization_id: UUID = Field(..., description="Organization ID")
    policy_type: str = Field(..., max_length=50, description="Policy type")
    rules: dict[str, Any] = Field(..., description="Policy rules configuration")
    action: PolicyAction = Field(default=PolicyAction.WARN, description="Policy enforcement action")
    is_active: bool = Field(default=True, description="Policy active status")
    priority: int = Field(default=100, ge=0, le=1000, description="Policy priority (lower = higher priority)")
    applicable_ecosystems: set[EcosystemType] = Field(default_factory=set, description="Applicable ecosystems")
    exceptions: list[str] = Field(default_factory=list, description="Policy exceptions")

    @validator("rules")
    def validate_rules(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate policy rules structure."""
        if not isinstance(v, dict):
            raise ValueError("Rules must be a dictionary")
        if not v:
            raise ValueError("Rules cannot be empty")
        return v

    @property
    def is_blocking(self) -> bool:
        """Check if policy blocks actions."""
        return self.action == PolicyAction.BLOCK


class DependencyGraph(BaseEntity):
    """
    Dependency relationship graph.

    Represents the complete dependency tree for a project with
    conflict detection and resolution information.
    """

    root_package_id: UUID = Field(..., description="Root package ID")
    organization_id: UUID = Field(..., description="Organization ID")
    dependencies: dict[str, Any] = Field(..., description="Dependency tree structure")
    conflicts: list[dict[str, Any]] = Field(default_factory=list, description="Version conflicts")
    vulnerabilities: list[UUID] = Field(default_factory=list, description="Vulnerability IDs")
    license_issues: list[dict[str, Any]] = Field(default_factory=list, description="License compatibility issues")
    total_packages: int = Field(default=0, ge=0, description="Total package count")
    total_vulnerabilities: int = Field(default=0, ge=0, description="Total vulnerability count")
    risk_score: float = Field(default=0.0, ge=0.0, le=10.0, description="Overall risk score")
    is_resolved: bool = Field(default=False, description="Conflicts resolved status")
    resolution_strategy: Optional[str] = Field(default=None, description="Resolution strategy used")

    @validator("dependencies")
    def validate_dependencies(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate dependency structure."""
        if not isinstance(v, dict):
            raise ValueError("Dependencies must be a dictionary")
        return v

    @property
    def has_conflicts(self) -> bool:
        """Check if graph has unresolved conflicts."""
        return len(self.conflicts) > 0 and not self.is_resolved

    @property
    def has_vulnerabilities(self) -> bool:
        """Check if graph has vulnerabilities."""
        return self.total_vulnerabilities > 0

    @property
    def is_high_risk(self) -> bool:
        """Check if graph is high risk."""
        return self.risk_score >= 7.0


class Workflow(BaseEntity):
    """
    Workflow execution tracking.

    Represents LangGraph workflow executions with state tracking,
    approval processes, and audit trails.
    """

    name: str = Field(..., min_length=1, max_length=200, description="Workflow name")
    workflow_type: str = Field(..., max_length=100, description="Workflow type")
    organization_id: UUID = Field(..., description="Organization ID")
    initiator_id: str = Field(..., max_length=100, description="Workflow initiator")
    status: WorkflowStatus = Field(default=WorkflowStatus.PENDING, description="Workflow status")
    input_data: dict[str, Any] = Field(..., description="Workflow input data")
    output_data: Optional[dict[str, Any]] = Field(default=None, description="Workflow output data")
    current_state: Optional[str] = Field(default=None, max_length=100, description="Current workflow state")
    error_message: Optional[str] = Field(default=None, description="Error message if failed")
    started_at: Optional[datetime] = Field(default=None, description="Workflow start time")
    completed_at: Optional[datetime] = Field(default=None, description="Workflow completion time")
    approvals_required: list[str] = Field(default_factory=list, description="Required approval roles")
    approvals_received: list[dict[str, Any]] = Field(default_factory=list, description="Received approvals")
    checkpoints: list[dict[str, Any]] = Field(default_factory=list, description="Workflow checkpoints")
    related_entities: dict[str, UUID] = Field(default_factory=dict, description="Related entity IDs")

    @root_validator(skip_on_failure=True)
    def validate_workflow_times(cls, values: dict) -> dict:
        """Validate workflow timing constraints."""
        started_at = values.get("started_at")
        completed_at = values.get("completed_at")

        if started_at and completed_at and completed_at < started_at:
            raise ValueError("Completion time cannot be before start time")

        return values

    @property
    def is_complete(self) -> bool:
        """Check if workflow is complete."""
        return self.status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED]

    @property
    def is_pending_approval(self) -> bool:
        """Check if workflow is pending approval."""
        return self.status == WorkflowStatus.WAITING_FOR_APPROVAL

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get workflow duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def pending_approvals(self) -> list[str]:
        """Get list of pending approval roles."""
        approved_roles = {approval["role"] for approval in self.approvals_received}
        return [role for role in self.approvals_required if role not in approved_roles]


# Model registry for serialization and validation
MODEL_REGISTRY = {
    "Package": Package,
    "Vulnerability": Vulnerability,
    "License": License,
    "Organization": Organization,
    "Policy": Policy,
    "DependencyGraph": DependencyGraph,
    "Workflow": Workflow,
    "AIRecommendation": AIRecommendation,
    "ApprovalRequirement": ApprovalRequirement,
    "ApprovalResponse": ApprovalResponse,
}
