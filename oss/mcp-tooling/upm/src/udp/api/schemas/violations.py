"""
Policy Violation Management API Schemas

Pydantic models for request/response validation in policy violation
management and exception request APIs.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# Base violation schemas
class ViolationBase(BaseModel):
    """Base violation model with common fields."""

    title: str = Field(..., description="Violation title")
    description: str = Field(..., description="Violation description")
    severity: str = Field(..., description="Violation severity level")
    category: Optional[str] = Field(None, description="Violation category")
    tags: list[str] = Field(default_factory=list, description="Violation tags")


class ViolationCreate(ViolationBase):
    """Schema for creating a new violation."""

    project_id: UUID = Field(..., description="Project ID")
    policy_id: UUID = Field(..., description="Policy ID")
    violation_key: str = Field(..., description="Unique violation key")
    violation_details: dict[str, Any] = Field(
        default_factory=dict, description="Violation details"
    )
    risk_score: Optional[float] = Field(None, description="Risk score (0-10)")
    business_impact: Optional[str] = Field(
        None, description="Business impact description"
    )
    technical_impact: Optional[str] = Field(
        None, description="Technical impact description"
    )
    affected_components: list[str] = Field(
        default_factory=list, description="Affected components"
    )
    affected_versions: dict[str, Any] = Field(
        default_factory=dict, description="Affected versions"
    )
    remediation_required: bool = Field(
        default=True, description="Whether remediation is required"
    )
    remediation_type: Optional[str] = Field(None, description="Type of remediation")
    remediation_steps: list[dict[str, Any]] = Field(
        default_factory=list, description="Remediation steps"
    )
    remediation_complexity: str = Field(
        default="medium", description="Remediation complexity"
    )
    estimated_remediation_time: Optional[int] = Field(
        None, description="Estimated remediation time in hours"
    )
    exception_requestable: bool = Field(
        default=True, description="Whether exception can be requested"
    )
    auto_exception_eligible: bool = Field(
        default=False, description="Auto-exception eligibility"
    )
    detection_source: Optional[str] = Field(None, description="Detection source")
    false_positive: bool = Field(default=False, description="False positive indicator")
    dependency_id: Optional[UUID] = Field(None, description="Related dependency ID")
    package_id: Optional[UUID] = Field(None, description="Related package ID")


class ViolationUpdate(BaseModel):
    """Schema for updating a violation."""

    title: Optional[str] = Field(None, description="Violation title")
    description: Optional[str] = Field(None, description="Violation description")
    severity: Optional[str] = Field(None, description="Violation severity")
    status: Optional[str] = Field(None, description="Violation status")
    category: Optional[str] = Field(None, description="Violation category")
    tags: Optional[list[str]] = Field(None, description="Violation tags")
    risk_score: Optional[float] = Field(None, description="Risk score")
    business_impact: Optional[str] = Field(None, description="Business impact")
    technical_impact: Optional[str] = Field(None, description="Technical impact")
    remediation_type: Optional[str] = Field(None, description="Remediation type")
    remediation_steps: Optional[list[dict[str, Any]]] = Field(
        None, description="Remediation steps"
    )


class ViolationResponse(ViolationBase):
    """Schema for violation response."""

    id: UUID
    project_id: UUID
    policy_id: UUID
    analysis_id: Optional[UUID]
    policy_evaluation_id: Optional[UUID]
    dependency_id: Optional[UUID]
    package_id: Optional[UUID]
    violation_key: str
    violation_details: dict[str, Any]
    detected_at: datetime
    first_detected_at: datetime
    status: str
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[UUID]
    resolved_at: Optional[datetime]
    resolved_by: Optional[UUID]
    risk_score: Optional[float]
    business_impact: Optional[str]
    technical_impact: Optional[str]
    affected_components: list[str]
    affected_versions: dict[str, Any]
    remediation_required: bool
    remediation_type: Optional[str]
    remediation_steps: list[dict[str, Any]]
    remediation_complexity: str
    estimated_remediation_time: Optional[int]
    exception_requestable: bool
    auto_exception_eligible: bool
    detection_source: Optional[str]
    false_positive_indicator: bool
    recurrence_count: int
    last_seen_at: datetime
    created_at: datetime
    updated_at: datetime

    # Computed properties
    is_active: bool = Field(False, description="Whether violation is still active")
    is_critical: bool = Field(False, description="Whether violation is critical")
    age_days: int = Field(0, description="Age in days")
    sla_breached: bool = Field(False, description="Whether SLA is breached")

    class Config:
        from_attributes = True


# Violation action schemas
class ViolationAcknowledgmentRequest(BaseModel):
    """Schema for acknowledging a violation."""

    comment: Optional[str] = Field(None, description="Acknowledgment comment")


class ViolationResolutionRequest(BaseModel):
    """Schema for resolving a violation."""

    resolution_method: str = Field(..., description="Method used for resolution")
    comment: Optional[str] = Field(None, description="Resolution comment")


class ViolationEscalationRequest(BaseModel):
    """Schema for escalating a violation."""

    reason: str = Field(..., description="Escalation reason")
    escalated_to: Optional[UUID] = Field(None, description="User to escalate to")


# Exception request schemas
class ExceptionRequestBase(BaseModel):
    """Base exception request model."""

    title: str = Field(..., description="Exception request title")
    description: str = Field(..., description="Exception request description")
    exception_type: str = Field(..., description="Type of exception")
    justification: str = Field(..., description="Business justification")
    business_risk: Optional[str] = Field(
        None, description="Business risk if not granted"
    )
    mitigation_plan: Optional[str] = Field(None, description="Risk mitigation plan")
    category: Optional[str] = Field(None, description="Exception category")
    priority: str = Field(default="medium", description="Exception priority")


class ExceptionRequestCreate(ExceptionRequestBase):
    """Schema for creating an exception request."""

    project_id: UUID = Field(..., description="Project ID")
    policy_id: UUID = Field(..., description="Policy ID")
    violation_id: Optional[UUID] = Field(None, description="Related violation ID")
    exception_key: Optional[str] = Field(None, description="Unique exception key")
    scope: dict[str, Any] = Field(default_factory=dict, description="Exception scope")
    conditions: list[dict[str, Any]] = Field(
        default_factory=list, description="Exception conditions"
    )
    start_date: Optional[datetime] = Field(None, description="Exception start date")
    end_date: Optional[datetime] = Field(None, description="Exception end date")
    duration_days: Optional[int] = Field(None, description="Duration in days")
    review_required: bool = Field(
        default=True, description="Whether review is required"
    )
    approval_required: bool = Field(
        default=True, description="Whether approval is required"
    )
    required_approvers: list[str] = Field(
        default_factory=list, description="Required approvers"
    )
    monitoring_required: bool = Field(
        default=True, description="Whether monitoring is required"
    )
    compliance_checks: list[dict[str, Any]] = Field(
        default_factory=list, description="Compliance checks"
    )
    risk_assessment: dict[str, Any] = Field(
        default_factory=dict, description="Risk assessment"
    )
    risk_score: Optional[float] = Field(None, description="Risk score")
    tags: list[str] = Field(default_factory=list, description="Exception tags")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class ExceptionRequestUpdate(BaseModel):
    """Schema for updating an exception request."""

    status: str = Field(..., description="New status")
    reason: Optional[str] = Field(None, description="Reason for status change")
    approval_conditions: list[dict[str, Any]] = Field(
        default_factory=list, description="Approval conditions"
    )


class ExceptionRequestResponse(ExceptionRequestBase):
    """Schema for exception request response."""

    id: UUID
    project_id: UUID
    violation_id: Optional[UUID]
    policy_id: UUID
    requester_id: UUID
    approver_id: Optional[UUID]
    workflow_id: Optional[UUID]
    exception_key: str
    scope: dict[str, Any]
    conditions: list[dict[str, Any]]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    duration_days: Optional[int]
    status: str
    submitted_at: datetime
    reviewed_at: Optional[datetime]
    decided_at: Optional[datetime]
    implemented_at: Optional[datetime]
    decision: Optional[str]
    decision_reason: Optional[str]
    approval_conditions: list[dict[str, Any]]
    review_required: bool
    approval_required: bool
    required_approvers: list[str]
    monitoring_required: bool
    compliance_checks: list[dict[str, Any]]
    risk_assessment: dict[str, Any]
    risk_score: Optional[float]
    tags: list[str]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    # Computed properties
    is_active: bool = Field(False, description="Whether exception is currently active")
    is_expired: bool = Field(False, description="Whether exception has expired")
    days_until_expiry: Optional[int] = Field(None, description="Days until expiry")
    approval_pending_days: int = Field(0, description="Days pending approval")

    class Config:
        from_attributes = True


# Exception activity schemas
class ExceptionActivityBase(BaseModel):
    """Base exception activity model."""

    activity_type: str = Field(..., description="Activity type")
    title: str = Field(..., description="Activity title")
    description: Optional[str] = Field(None, description="Activity description")


class ExceptionActivityResponse(ExceptionActivityBase):
    """Schema for exception activity response."""

    id: UUID
    exception_request_id: UUID
    user_id: Optional[UUID]
    old_values: dict[str, Any]
    new_values: dict[str, Any]
    activity_data: dict[str, Any]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Remediation schemas
class RemediationPlanBase(BaseModel):
    """Base remediation plan model."""

    remediation_type: str = Field(..., description="Type of remediation")
    title: str = Field(..., description="Remediation plan title")
    description: str = Field(..., description="Remediation plan description")
    estimated_hours: Optional[float] = Field(
        None, description="Estimated hours to complete"
    )
    steps_performed: list[dict[str, Any]] = Field(
        default_factory=list, description="Steps performed"
    )
    follow_up_required: bool = Field(
        default=False, description="Whether follow-up is required"
    )
    follow_up_actions: list[dict[str, Any]] = Field(
        default_factory=list, description="Follow-up actions"
    )
    next_review_date: Optional[datetime] = Field(None, description="Next review date")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class RemediationPlanCreate(RemediationPlanBase):
    """Schema for creating a remediation plan."""

    assigned_to_id: Optional[UUID] = Field(
        None, description="User assigned to remediation"
    )


class RemediationPlanResponse(RemediationPlanBase):
    """Schema for remediation plan response."""

    id: UUID
    violation_id: UUID
    assigned_to_id: Optional[UUID]
    completed_by_id: Optional[UUID]
    status: str
    progress_percentage: int
    started_at: datetime
    completed_at: Optional[datetime]
    actual_hours: Optional[float]
    outcome: Optional[str]
    verification_method: Optional[str]
    verification_results: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    # Computed properties
    is_completed: bool = Field(False, description="Whether remediation is completed")
    duration_days: Optional[int] = Field(None, description="Duration in days")
    is_overdue: bool = Field(False, description="Whether remediation is overdue")

    class Config:
        from_attributes = True


class RemediationProgressUpdate(BaseModel):
    """Schema for updating remediation progress."""

    progress_percentage: int = Field(
        ..., ge=0, le=100, description="Progress percentage (0-100)"
    )
    steps_completed: list[dict[str, Any]] = Field(..., description="Completed steps")
    actual_hours: Optional[float] = Field(None, description="Actual hours spent")
    outcome: Optional[str] = Field(None, description="Remediation outcome")
    verification_method: Optional[str] = Field(
        None, description="Verification method used"
    )
    verification_results: dict[str, Any] = Field(
        default_factory=dict, description="Verification results"
    )


# Analytics schemas
class ViolationMetricsResponse(BaseModel):
    """Schema for violation metrics response."""

    period_days: int
    total_violations: int
    violations_by_status: dict[str, int]
    violations_by_severity: dict[str, int]
    average_resolution_time_hours: float
    overdue_violations_count: int
    active_exception_requests: int
    exceptions_by_status: dict[str, int]


class ViolationTrendResponse(BaseModel):
    """Schema for violation trend response."""

    week: str
    total: int
    low: Optional[int] = None
    medium: Optional[int] = None
    high: Optional[int] = None
    critical: Optional[int] = None


class TopViolatingPolicyResponse(BaseModel):
    """Schema for top violating policy response."""

    policy_id: str
    policy_name: str
    policy_type: str
    violation_count: int
    severity_distribution: dict[str, int]


# Summary schemas for API responses
class PolicyViolationResponse(BaseModel):
    """Comprehensive policy violation response."""

    id: UUID
    project_id: UUID
    policy_id: UUID
    violation_key: str
    title: str
    description: str
    severity: str
    category: Optional[str]
    tags: list[str]
    status: str
    detected_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    risk_score: Optional[float]
    business_impact: Optional[str]
    technical_impact: Optional[str]
    remediation_required: bool
    remediation_type: Optional[str]
    remediation_steps: list[dict[str, Any]]
    exception_requestable: bool
    recurrence_count: int

    # Related data
    policy_name: Optional[str] = None
    project_name: Optional[str] = None
    package_name: Optional[str] = None
    package_version: Optional[str] = None

    # Computed properties
    is_active: bool
    is_critical: bool
    age_days: int
    sla_breached: bool

    class Config:
        from_attributes = True
