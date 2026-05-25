"""
Pydantic schemas for approval workflow API.

Comprehensive schemas for human-in-the-loop approval workflows
with validation, serialization, and API documentation.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, root_validator, validator


class ApprovalType(str):
    """Approval request types."""

    DEPENDENCY_UPDATE = "dependency_update"
    POLICY_EXCEPTION = "policy_exception"
    SECURITY_OVERRIDE = "security_override"
    COMPLIANCE_EXCEPTION = "compliance_exception"
    EMERGENCY_OVERRIDE = "emergency_override"


class ApprovalStatus(str):
    """Approval status values."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONDITIONAL = "conditional"
    DELEGATED = "delegated"
    ESCALATED = "escalated"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class RoutingStrategy(str):
    """Approval routing strategies."""

    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"
    RISK_BASED = "risk_based"
    AI_OPTIMIZED = "ai_optimized"


class ConfidenceLevel(str):
    """Confidence levels for approval responses."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# Base schemas


class BaseApprovalSchema(BaseModel):
    """Base schema for approval-related objects."""

    class Config:
        use_enum_values = True
        json_encoders = {datetime: lambda v: v.isoformat(), UUID: lambda v: str(v)}


# Request schemas


class ApprovalRequestCreate(BaseApprovalSchema):
    """Schema for creating approval requests."""

    request_type: str = Field(
        ...,
        description="Type of approval request",
        example=ApprovalType.DEPENDENCY_UPDATE,
    )
    request_data: dict[str, Any] = Field(
        ...,
        description="Request-specific data and context",
        example={
            "project_id": "123e4567-e89b-12d3-a456-426614174000",
            "dependencies": [
                {"name": "react", "version": "18.2.0", "ecosystem": "npm"},
                {"name": "fastapi", "version": "0.104.0", "ecosystem": "pypi"},
            ],
            "vulnerabilities": [],
            "policy_violations": [],
            "license_violations": [],
            "ecosystems": ["npm", "pypi"],
        },
    )
    routing_strategy: Optional[str] = Field(
        None,
        description="Approval routing strategy",
        example=RoutingStrategy.RISK_BASED,
    )
    priority: Optional[int] = Field(
        None,
        ge=1,
        le=100,
        description="Request priority (lower = higher priority)",
        example=50,
    )
    tags: Optional[list[str]] = Field(
        None,
        description="Request tags for categorization",
        example=["security", "production", "urgent"],
    )

    @validator("request_type")
    def validate_request_type(cls, v):
        """Validate request type."""
        valid_types = [
            ApprovalType.DEPENDENCY_UPDATE,
            ApprovalType.POLICY_EXCEPTION,
            ApprovalType.SECURITY_OVERRIDE,
            ApprovalType.COMPLIANCE_EXCEPTION,
            ApprovalType.EMERGENCY_OVERRIDE,
        ]
        if v not in valid_types:
            raise ValueError(f"Invalid request type: {v}")
        return v

    @validator("routing_strategy")
    def validate_routing_strategy(cls, v):
        """Validate routing strategy."""
        if v is None:
            return v

        valid_strategies = [
            RoutingStrategy.SEQUENTIAL,
            RoutingStrategy.PARALLEL,
            RoutingStrategy.RISK_BASED,
            RoutingStrategy.AI_OPTIMIZED,
        ]
        if v not in valid_strategies:
            raise ValueError(f"Invalid routing strategy: {v}")
        return v


class ApprovalResponseCreate(BaseApprovalSchema):
    """Schema for submitting approval responses."""

    requirement_id: UUID = Field(
        ..., description="ID of the approval requirement being responded to"
    )
    approver_email: EmailStr = Field(..., description="Approver's email address")
    approver_role: str = Field(
        ..., description="Approver's role", example="security_officer"
    )
    status: str = Field(
        ..., description="Approval response status", example=ApprovalStatus.APPROVED
    )
    comments: Optional[str] = Field(
        None,
        description="Optional comments explaining the decision",
        example="Approved after security review. No critical vulnerabilities found.",
    )
    conditions: Optional[list[str]] = Field(
        None,
        description="Conditions for approval (if conditional approval)",
        example=[
            "Must update to version 18.2.1 within 30 days",
            "Security scan must pass before production deployment",
        ],
    )
    risk_assessment: Optional[dict[str, Any]] = Field(
        None,
        description="Approver's risk assessment",
        example={
            "risk_level": "low",
            "risk_factors": {
                "security_vulnerabilities": 0,
                "license_compliance": "compliant",
                "dependency_freshness": "recent",
            },
        },
    )
    alternative_suggestions: Optional[list[str]] = Field(
        None,
        description="Alternative suggestions if rejected",
        example=[
            "Consider using version 17.x instead",
            "Look into alternative package X",
        ],
    )
    confidence_level: Optional[str] = Field(
        None,
        description="Confidence level in the decision",
        example=ConfidenceLevel.HIGH,
    )
    session_id: Optional[str] = Field(None, description="Session identifier for audit")

    @validator("status")
    def validate_status(cls, v):
        """Validate response status."""
        valid_statuses = [
            ApprovalStatus.APPROVED,
            ApprovalStatus.REJECTED,
            ApprovalStatus.CONDITIONAL,
            ApprovalStatus.DELEGATED,
            ApprovalStatus.ESCALATED,
        ]
        if v not in valid_statuses:
            raise ValueError(f"Invalid response status: {v}")
        return v

    @validator("confidence_level")
    def validate_confidence_level(cls, v):
        """Validate confidence level."""
        if v is None:
            return v

        valid_levels = [
            ConfidenceLevel.LOW,
            ConfidenceLevel.MEDIUM,
            ConfidenceLevel.HIGH,
        ]
        if v not in valid_levels:
            raise ValueError(f"Invalid confidence level: {v}")
        return v

    @root_validator
    def validate_conditional_approval(cls, values):
        """Validate conditional approval has conditions."""
        if values.get("status") == ApprovalStatus.CONDITIONAL:
            if not values.get("conditions") or len(values["conditions"]) == 0:
                raise ValueError("Conditional approval must include conditions")
        return values


class EscalationRequest(BaseApprovalSchema):
    """Schema for escalation requests."""

    requirement_id: UUID = Field(..., description="ID of the requirement to escalate")
    escalation_reason: str = Field(
        ...,
        description="Reason for escalation",
        example="SLA deadline exceeded without response",
    )
    escalation_notes: Optional[str] = Field(
        None, description="Additional notes about escalation"
    )
    escalate_to: Optional[dict[str, Any]] = Field(
        None,
        description="Specific escalation target (overrides default hierarchy)",
        example={"role": "security_manager", "email": "security.manager@example.com"},
    )


class WorkflowCancellationRequest(BaseApprovalSchema):
    """Schema for workflow cancellation."""

    cancellation_reason: str = Field(
        ...,
        description="Reason for cancelling the workflow",
        example="Request no longer needed - project cancelled",
    )
    notify_stakeholders: bool = Field(
        True, description="Whether to notify stakeholders about cancellation"
    )


# Response schemas


class ApproverInfo(BaseApprovalSchema):
    """Information about an approver."""

    requirement_id: UUID
    role: str
    email: Optional[str]
    deadline: Optional[datetime]
    status: str
    priority: int


class ApprovalRequirementResponse(BaseApprovalSchema):
    """Schema for approval requirement information."""

    id: UUID
    workflow_id: UUID
    approver_role: str
    approver_email: Optional[str]
    approver_user_id: Optional[UUID]
    approval_type: str
    priority: int
    status: str
    deadline: datetime
    escalation_count: int
    last_escalated_at: Optional[datetime]
    context: dict[str, Any]
    auto_approval_conditions: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class ApprovalWorkflowResponse(BaseApprovalSchema):
    """Schema for approval workflow response."""

    workflow_id: UUID
    workflow_type: str
    request_type: str
    status: str
    current_step: str
    requester_id: UUID
    requester_role: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    sla_deadline: Optional[datetime]
    sla_status: str
    escalation_level: int
    final_decision: Optional[str]
    decision_rationale: Optional[str]
    decision_confidence: Optional[float]
    approval_requirements: list[ApprovalRequirementResponse]
    current_approvers: list[ApproverInfo]
    stakeholder_hierarchy: dict[str, Any]

    # Computed fields
    approval_count: int = Field(..., description="Number of approvals received")
    total_required: int = Field(..., description="Total number of approvals required")
    progress_percentage: float = Field(
        ..., description="Workflow completion percentage"
    )
    urgency: str = Field(..., description="Urgency level based on SLA")


class ApprovalStatusSummary(BaseApprovalSchema):
    """Summary of approval workflow status."""

    workflow_id: UUID
    workflow_status: str
    request_type: str
    routing_strategy: str
    created_at: datetime
    sla_deadline: Optional[datetime]
    sla_status: str
    escalation_level: int

    # Requirement summary
    total_requirements: int
    completed: int
    pending: int
    rejected: int
    escalated: int

    # Progress metrics
    approval_percentage: float
    estimated_completion_hours: Optional[float]
    average_response_time_hours: Optional[float]

    # Risk indicators
    risk_indicators: dict[str, Any]


class PendingApprovalItem(BaseApprovalSchema):
    """Item in pending approvals list."""

    workflow_id: UUID
    request_type: str
    request_data: dict[str, Any]
    created_at: datetime
    sla_deadline: Optional[datetime]
    urgency: str
    current_approver_role: Optional[str]
    approval_count: int
    total_required: int

    # Quick preview information
    title: str = Field(..., description="Human-readable title for the request")
    description: Optional[str] = Field(
        None, description="Brief description of the request"
    )
    tags: list[str] = Field(default_factory=list, description="Request tags")


class PendingApprovalsResponse(BaseApprovalSchema):
    """Response for pending approvals endpoint."""

    pending_approvals: list[PendingApprovalItem]
    total_count: int
    limit: int
    offset: int
    has_more: bool


class EscalationEvent(BaseApprovalSchema):
    """Escalation event information."""

    escalation_id: UUID
    requirement_id: UUID
    escalated_at: datetime
    escalated_from: Optional[str]
    escalated_to: dict[str, Any]
    reason: str
    escalation_level: int
    escalation_type: str  # "automatic" or "manual"
    escalated_by: Optional[UUID]

    # Escalation details
    deadline_missed_by_hours: Optional[float]
    previous_approver_responses: list[dict[str, Any]]


class AuditLogEntry(BaseApprovalSchema):
    """Audit log entry."""

    id: UUID
    workflow_id: UUID
    event_type: str
    event_timestamp: datetime
    event_data: dict[str, Any]

    # Actor information
    actor_id: Optional[UUID]
    actor_role: Optional[str]
    actor_email: Optional[str]

    # Security information
    ip_address: Optional[str]
    user_agent: Optional[str]
    session_id: Optional[str]

    # Change tracking
    previous_state: Optional[dict[str, Any]]
    new_state: Optional[dict[str, Any]]


class WorkflowAnalytics(BaseApprovalSchema):
    """Analytics for approval workflows."""

    workflow_id: UUID

    # Performance metrics
    total_duration_hours: float
    approval_cycle_time_hours: float
    escalation_count: int
    sla_compliance: bool

    # Stakeholder metrics
    stakeholder_response_times: dict[str, float]
    approval_patterns: dict[str, Any]
    bottleneck_analysis: dict[str, Any]

    # Quality metrics
    decision_confidence_average: Optional[float]
    conditional_approval_rate: float
    rejection_rate: float


# Template schemas


class ApprovalTemplateCreate(BaseApprovalSchema):
    """Schema for creating approval templates."""

    name: str = Field(
        ..., description="Template name", example="Standard Dependency Update"
    )
    description: Optional[str] = Field(None, description="Template description")
    request_type: str = Field(..., description="Request type this template applies to")
    approval_stages: dict[str, Any] = Field(
        ..., description="Approval stage configuration"
    )
    stakeholder_configuration: dict[str, Any] = Field(
        ..., description="Stakeholder role and hierarchy configuration"
    )
    escalation_policies: dict[str, Any] = Field(
        ..., description="Escalation policies and rules"
    )
    sla_configuration: dict[str, Any] = Field(
        ..., description="SLA configuration by role and risk level"
    )
    auto_approval_conditions: dict[str, Any] = Field(
        default_factory=dict, description="Conditions for automatic approval"
    )
    routing_rules: dict[str, Any] = Field(
        default_factory=dict, description="Intelligent routing rules"
    )
    validation_rules: dict[str, Any] = Field(
        default_factory=dict, description="Business rule validation"
    )
    tags: list[str] = Field(default_factory=list, description="Template tags")
    is_global: bool = Field(
        False, description="Whether template is global to organization"
    )


class ApprovalTemplateResponse(BaseApprovalSchema):
    """Schema for approval template response."""

    id: UUID
    name: str
    description: Optional[str]
    request_type: str
    organization_id: UUID
    is_global: bool
    version: str
    is_active: bool
    tags: list[str]

    # Configuration
    approval_stages: dict[str, Any]
    stakeholder_configuration: dict[str, Any]
    escalation_policies: dict[str, Any]
    sla_configuration: dict[str, Any]
    auto_approval_conditions: dict[str, Any]
    routing_rules: dict[str, Any]
    validation_rules: dict[str, Any]

    # Metadata
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    updated_by: Optional[str]


# Error response schemas


class ApprovalErrorResponse(BaseApprovalSchema):
    """Schema for approval-related error responses."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict[str, Any]] = Field(
        None, description="Additional error details"
    )
    workflow_id: Optional[UUID] = Field(
        None, description="Associated workflow ID if applicable"
    )
    requirement_id: Optional[UUID] = Field(
        None, description="Associated requirement ID if applicable"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Error timestamp"
    )


# Validation response schemas


class ApprovalValidationResponse(BaseApprovalSchema):
    """Schema for approval validation results."""

    valid: bool
    errors: list[str] = Field(default_factory=list, description="Validation errors")
    warnings: list[str] = Field(default_factory=list, description="Validation warnings")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional validation metadata"
    )
