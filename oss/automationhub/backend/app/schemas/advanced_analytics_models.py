"""Predictive, forecast, and report schemas for Advanced Analytics."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.schemas.advanced_analytics_enums import IntelligenceType, MetricType, ModelType


class PredictiveModelCreate(BaseModel):
    """Schema for creating a predictive model."""
    model_name: str = Field(..., min_length=1, max_length=255)
    model_type: ModelType
    model_category: Optional[str] = Field(None, max_length=50)
    version: str = Field("1.0", max_length=20)
    algorithm: str = Field(..., max_length=100)
    hyperparameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    feature_columns: Optional[List[str]] = Field(default_factory=list)
    description: Optional[str] = Field(None, max_length=1000)
    tags: Optional[List[str]] = Field(default_factory=list)
    retraining_interval: Optional[int] = Field(None, ge=1, le=365)

    @validator("algorithm")
    def validate_algorithm(cls, v):
        valid = ["random_forest", "linear_regression", "decision_tree", "svm", "lstm", "arima",
                 "prophet", "isolation_forest", "kmeans", "dbscan", "hierarchical", "xgboost", "lightgbm", "catboost"]
        if v.lower() not in [a.lower() for a in valid]:
            raise ValueError(f"Algorithm must be one of: {valid}")
        return v


class PredictiveModelResponse(BaseModel):
    """Schema for predictive model response."""
    id: UUID
    tenant_id: UUID
    model_name: str
    model_type: ModelType
    model_category: Optional[str]
    version: str
    algorithm: str
    hyperparameters: Dict[str, Any]
    feature_columns: List[str]
    training_data_start: Optional[datetime]
    training_data_end: Optional[datetime]
    training_samples: int
    feature_count: int
    training_score: Optional[float]
    validation_score: Optional[float]
    test_score: Optional[float]
    mae: Optional[float]
    mse: Optional[float]
    rmse: Optional[float]
    r2_score: Optional[float]
    status: str
    is_production: bool
    last_trained: Optional[datetime]
    last_updated: Optional[datetime]
    prediction_count: int
    last_prediction: Optional[datetime]
    average_prediction_time: Optional[float]
    retraining_interval: Optional[int]
    last_retraining: Optional[datetime]
    model_drift_score: Optional[float]
    description: Optional[str]
    tags: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PerformanceForecastCreate(BaseModel):
    """Schema for creating a performance forecast."""
    forecast_id: str = Field(..., min_length=1, max_length=100)
    metric_type: MetricType
    metric_name: str = Field(..., min_length=1, max_length=255)
    timestamp: datetime
    predicted_value: float
    confidence_interval_lower: Optional[float] = None
    confidence_interval_upper: Optional[float] = None
    confidence: float = Field(..., ge=0, le=1)
    prediction_horizon: str = Field(..., max_length=20)
    model_version: str = Field(..., max_length=20)
    features_used: Optional[List[str]] = Field(default_factory=list)
    prediction_context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    business_impact: Optional[str] = Field(None, max_length=50)
    impact_amount: Optional[float] = None
    impact_currency: str = Field("USD", max_length=3)

    @validator("prediction_horizon")
    def validate_prediction_horizon(cls, v):
        valid = ["1h", "6h", "1d", "3d", "1w", "2w", "1m", "3m", "6m", "1y"]
        if v not in valid:
            raise ValueError(f"Prediction horizon must be one of: {valid}")
        return v

    @validator("confidence_interval_lower")
    def validate_confidence_lower(cls, v, values):
        if v is not None and values.get("predicted_value") is not None and v > values["predicted_value"]:
            raise ValueError("Lower confidence interval must be <= predicted value")
        return v

    @validator("confidence_interval_upper")
    def validate_confidence_upper(cls, v, values):
        if v is not None and values.get("predicted_value") is not None and v < values["predicted_value"]:
            raise ValueError("Upper confidence interval must be >= predicted value")
        return v


class PerformanceForecastResponse(BaseModel):
    """Schema for performance forecast response."""
    id: UUID
    tenant_id: UUID
    model_id: Optional[UUID]
    resource_id: Optional[UUID]
    forecast_id: str
    metric_type: MetricType
    metric_name: str
    timestamp: datetime
    predicted_value: float
    confidence_interval_lower: Optional[float]
    confidence_interval_upper: Optional[float]
    confidence: float
    prediction_horizon: str
    model_version: str
    features_used: List[str]
    prediction_context: Dict[str, Any]
    actual_value: Optional[float]
    prediction_error: Optional[float]
    mape: Optional[float]
    status: str
    accuracy_rating: Optional[str]
    outlier_flag: bool
    business_impact: Optional[str]
    impact_amount: Optional[float]
    impact_currency: str
    created_at: datetime
    validated_at: Optional[datetime]
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True
class IntelligenceReportCreate(BaseModel):
    """Schema for creating an intelligence report."""
    report_name: str = Field(..., min_length=1, max_length=255)
    report_type: IntelligenceType
    report_category: Optional[str] = Field(None, max_length=50)
    version: str = Field("1.0", max_length=20)
    time_range: str = Field(..., max_length=20)
    data_sources: Optional[List[str]] = Field(default_factory=list)
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    analysis_types: Optional[List[str]] = Field(default_factory=list)
    executive_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
    key_insights: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    recommendations: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    risk_assessment: Optional[Dict[str, Any]] = Field(default_factory=dict)
    description: Optional[str] = Field(None, max_length=1000)
    priority: Optional[str] = Field(None, max_length=20)
    tags: Optional[List[str]] = Field(default_factory=list)
    distribution_list: Optional[List[str]] = Field(default_factory=list)
    is_recurring: bool = False
    recurrence_pattern: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator("report_type")
    def validate_report_type(cls, v):
        valid = ["performance_insight", "cost_optimization", "security_threat", "capacity_planning", "user_engagement", "business_impact"]
        if v not in valid:
            raise ValueError(f"Report type must be one of: {valid}")
        return v
    @validator("time_range")
    def validate_time_range(cls, v):
        if v not in ["7d", "14d", "30d", "60d", "90d", "6m", "1y"]:
            raise ValueError("Time range must be one of: 7d, 14d, 30d, 90d, 6m, 1y")
        return v
    @validator("priority")
    def validate_priority(cls, v):
        if v and v not in ["low", "medium", "high", "critical"]:
            raise ValueError("Priority must be one of: low, medium, high, critical")
        return v

class IntelligenceReportDetailResponse(BaseModel):
    """Full report schema for GET /reports/{report_id}."""
    report_id: UUID
    report_name: str
    report_type: str
    time_range: str
    executive_summary: Dict[str, Any]
    key_insights: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    detailed_analysis: Dict[str, Any]
    charts: List[Dict[str, Any]]
    risk_assessment: Dict[str, Any]
    status: str
    generated_at: datetime
    download_url: Optional[str] = None
    class Config:
        from_attributes = True
