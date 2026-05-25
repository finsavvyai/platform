"""Metric and anomaly schemas for Advanced Analytics."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.schemas.advanced_analytics_enums import AnomalySeverity, MetricType


class AnalyticsMetricCreate(BaseModel):
    """Schema for creating an analytics metric."""
    metric_name: str = Field(..., min_length=1, max_length=255)
    metric_type: MetricType
    category: Optional[str] = Field(None, max_length=50)
    value: float = Field(..., description="Metric value")
    unit: Optional[str] = Field(None, max_length=20)
    baseline_value: Optional[float] = None
    timestamp: datetime = Field(..., description="When the metric was collected")
    tags: Optional[Dict[str, str]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    source: str = Field("automated", max_length=50)

    @validator("value")
    def validate_value(cls, v):
        if v is None:
            raise ValueError("Value cannot be None")
        return v

    @validator("timestamp")
    def validate_timestamp(cls, v):
        if v > datetime.now():
            raise ValueError("Timestamp cannot be in the future")
        return v


class AnalyticsMetricResponse(BaseModel):
    """Schema for analytics metric response."""
    id: UUID
    tenant_id: UUID
    provider_id: Optional[UUID]
    resource_id: Optional[UUID]
    metric_name: str
    metric_type: MetricType
    category: Optional[str]
    value: float
    unit: Optional[str]
    baseline_value: Optional[float]
    deviation_percentage: Optional[float]
    timestamp: datetime
    collected_at: datetime
    min_value: Optional[float]
    max_value: Optional[float]
    avg_value: Optional[float]
    count_samples: int
    tags: Dict[str, str]
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="extra_metadata")

    class Config:
        from_attributes = True
        populate_by_name = True

    @validator("metadata", pre=True)
    def _metadata_from_extra(cls, v):
        return v if v is not None else {}


class AnomalyDetectionCreate(BaseModel):
    """Schema for creating an anomaly detection."""
    anomaly_id: str = Field(..., min_length=1, max_length=100)
    metric_type: MetricType
    metric_name: str = Field(..., min_length=1, max_length=255)
    anomaly_type: str = Field(..., max_length=50)
    timestamp: datetime
    value: float
    baseline_value: float
    deviation_score: float = Field(..., ge=0)
    severity: AnomalySeverity
    confidence: float = Field(..., ge=0, le=1)
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    affected_systems: Optional[List[str]] = Field(default_factory=list)
    related_anomalies: Optional[List[UUID]] = Field(default_factory=list)
    detection_method: str = Field("ml", max_length=50)
    detection_model: Optional[str] = Field(None, max_length=100)
    feature_importance: Optional[Dict[str, float]] = Field(default_factory=dict)
    impact_level: Optional[str] = Field(None, max_length=20)
    business_impact: Optional[str] = None
    user_impact: Optional[str] = None

    @validator("deviation_score")
    def validate_deviation_score(cls, v):
        if v < 0:
            raise ValueError("Deviation score must be non-negative")
        return v

    @validator("anomaly_type")
    def validate_anomaly_type(cls, v):
        valid = ["statistical", "ml_based", "rule_based", "threshold_based", "pattern_based"]
        if v not in valid:
            raise ValueError(f"Anomaly type must be one of: {valid}")
        return v

    @validator("detection_method")
    def validate_detection_method(cls, v):
        if v not in ["ml", "rule", "statistical", "hybrid"]:
            raise ValueError("Detection method must be one of: ml, rule, statistical, hybrid")
        return v

    @validator("impact_level")
    def validate_impact_level(cls, v):
        if v and v not in ["low", "medium", "high", "critical"]:
            raise ValueError("Impact level must be one of: low, medium, high, critical")
        return v


class AnomalyDetectionListItemResponse(BaseModel):
    """Schema for a single anomaly in list response."""
    id: UUID
    tenant_id: UUID
    provider_id: Optional[UUID]
    resource_id: Optional[UUID]
    anomaly_id: str
    metric_type: MetricType
    metric_name: str
    anomaly_type: str
    timestamp: datetime
    value: float
    baseline_value: float
    deviation_score: float
    severity: AnomalySeverity
    confidence: float
    status: str
    context: Dict[str, Any]
    affected_systems: List[str]
    related_anomalies: List[str]
    detection_method: str
    detection_model: Optional[str]
    feature_importance: Dict[str, float]
    resolved_at: Optional[datetime]
    resolution_method: Optional[str]
    resolution_notes: Optional[str]
    false_positive: bool
    impact_level: Optional[str]
    business_impact: Optional[str]
    user_impact: Optional[str]
    detected_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
