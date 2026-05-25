"""Insight pattern and anomaly alert schemas for Advanced Analytics."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.schemas.advanced_analytics_enums import AlertType, AnomalySeverity


class InsightPatternCreate(BaseModel):
    """Schema for creating an insight pattern."""
    pattern_name: str = Field(..., min_length=1, max_length=255)
    pattern_type: str = Field(..., max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    confidence_score: float = Field(..., ge=0, le=1)
    description: str = Field(..., min_length=1, max_length=2000)
    frequency: Optional[str] = Field(None, max_length=20)
    strength: Optional[float] = Field(None, ge=0)
    duration: Optional[int] = Field(None, ge=0)
    support: int = Field(..., ge=0)
    significance: Optional[float] = Field(None, ge=0, le=1)
    lift: Optional[float] = None
    conditions: Optional[Dict[str, Any]] = Field(default_factory=dict)
    triggers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    consequences: Optional[Dict[str, Any]] = Field(default_factory=dict)
    detection_method: str = Field("automated", max_length=50)
    detection_algorithm: Optional[str] = Field(None, max_length=100)
    feature_importance: Optional[Dict[str, float]] = Field(default_factory=dict)
    training_period: Optional[str] = Field(None, max_length=20)
    business_impact: Optional[str] = Field(None, max_length=50)
    business_value: Optional[float] = Field(None, ge=0)
    stakeholders: Optional[List[str]] = Field(default_factory=list)
    is_actionable: bool = False
    action_taken: bool = False
    action_details: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator("pattern_type")
    def validate_pattern_type(cls, v):
        valid = ["seasonal", "trend", "correlation", "anomaly_cluster", "recurring_event", "behavioral", "usage_pattern", "cost_pattern"]
        if v not in valid:
            raise ValueError(f"Pattern type must be one of: {valid}")
        return v

    @validator("frequency")
    def validate_frequency(cls, v):
        if v and v.lower() not in ["hourly", "daily", "weekly", "monthly", "quarterly", "ad hoc"]:
            raise ValueError("Invalid frequency")
        return v

    @validator("business_impact")
    def validate_business_impact(cls, v):
        if v and v.lower() not in ["positive", "negative", "neutral"]:
            raise ValueError("Business impact must be one of: positive, negative, neutral")
        return v


class InsightPatternResponse(BaseModel):
    """Schema for insight pattern response."""
    id: UUID
    tenant_id: UUID
    pattern_name: str
    pattern_type: str
    category: Optional[str]
    confidence_score: float
    description: str
    frequency: Optional[str]
    strength: Optional[float]
    duration: Optional[int]
    support: int
    significance: Optional[float]
    lift: Optional[float]
    conditions: Dict[str, Any]
    triggers: List[Dict[str, Any]]
    consequences: Dict[str, Any]
    detection_method: str
    detection_algorithm: Optional[str]
    feature_importance: Dict[str, float]
    training_period: Optional[str]
    business_impact: Optional[str]
    business_value: Optional[float]
    stakeholders: List[str]
    is_active: bool
    is_actionable: bool
    action_taken: bool
    action_details: Dict[str, Any]
    validated_at: Optional[datetime]
    validation_result: Optional[str]
    false_positive_count: int
    discovered_at: datetime
    last_observed: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyAlertCreate(BaseModel):
    """Schema for creating an anomaly alert."""
    alert_name: str = Field(..., min_length=1, max_length=255)
    alert_type: AlertType
    severity: AnomalySeverity
    rule_id: Optional[UUID] = None
    condition_met: Optional[Dict[str, Any]] = Field(default_factory=dict)
    threshold_value: Optional[float] = None
    notification_channels: Optional[List[str]] = Field(default_factory=list)
    recipients: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    subject: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1, max_length=2000)
    action_required: Optional[str] = None
    auto_remediation: bool = False
    remediation_actions: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    response_time_target: Optional[int] = Field(None, ge=1, le=10080)
    resolution_time_target: Optional[int] = Field(None, ge=1, le=43200)

    @validator("alert_type")
    def validate_alert_type(cls, v):
        if v not in ["notification", "escalation", "remediation", "informational"]:
            raise ValueError("Alert type must be one of: notification, escalation, remediation, informational")
        return v


class AnomalyAlertResponse(BaseModel):
    """Schema for anomaly alert response."""
    id: UUID
    tenant_id: UUID
    anomaly_id: UUID
    alert_name: str
    alert_type: AlertType
    severity: AnomalySeverity
    rule_id: Optional[UUID]
    condition_met: Dict[str, Any]
    threshold_value: Optional[float]
    notification_channels: List[str]
    recipients: List[Dict[str, Any]]
    subject: str
    message: str
    action_required: Optional[str]
    auto_remediation: bool
    remediation_actions: List[Dict[str, Any]]
    notification_sent: bool
    sent_at: Optional[datetime]
    status: str
    acknowledged_by: Optional[UUID]
    acknowledged_at: Optional[datetime]
    resolved_by: Optional[UUID]
    resolved_at: Optional[datetime]
    resolution_notes: Optional[str]
    escalation_level: int
    escalated_at: Optional[datetime]
    escalation_reason: Optional[str]
    response_time_target: Optional[int]
    resolution_time_target: Optional[int]
    actual_response_time: Optional[int]
    actual_resolution_time: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
