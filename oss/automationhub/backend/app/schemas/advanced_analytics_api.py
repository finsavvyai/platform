"""API request/response and dashboard schemas for Advanced Analytics."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.advanced_analytics_enums import IntelligenceType, MetricType


class MetricsCollectionRequest(BaseModel):
    """Schema for metrics collection request."""
    metric_type: MetricType
    time_range: str = Field("24h", max_length=20)
    providers: Optional[List[str]] = None
    resources: Optional[List[str]] = None
    aggregation: Optional[str] = Field(None, max_length=20)


class AnomalyDetectionRequest(BaseModel):
    """Schema for anomaly detection request."""
    metric_type: MetricType
    time_range: str = Field("7d", max_length=20)
    sensitivity: float = Field(0.1, ge=0.01, le=1.0)
    analysis_window: str = Field("30d", max_length=20)
    providers: Optional[List[str]] = None
    resources: Optional[List[str]] = None


class PredictionRequest(BaseModel):
    """Schema for prediction request."""
    metric_type: MetricType
    prediction_horizon: str = Field("7d", max_length=20)
    confidence_threshold: float = Field(0.8, ge=0, le=1)
    resource_ids: Optional[List[UUID]] = None
    include_confidence_intervals: bool = True


class IntelligenceReportRequest(BaseModel):
    """Schema for intelligence report request."""
    report_type: IntelligenceType
    time_range: str = Field("7d", max_length=20)
    include_recommendations: bool = True
    include_charts: bool = True
    custom_filters: Optional[Dict[str, Any]] = None
    stakeholder_level: Optional[str] = Field(None, max_length=20)


class MetricsCollectionResponse(BaseModel):
    """Schema for metrics collection response."""
    metric_type: MetricType
    time_range: str
    start_time: datetime
    end_time: datetime
    data_sources: List[Dict[str, Any]]
    aggregated_metrics: Dict[str, Any]
    total_metrics_collected: int
    collection_duration: float
    generated_at: datetime


class AnomalyDetectionResponse(BaseModel):
    """Schema for anomaly detection response."""
    anomalies_detected: int
    anomaly_count_by_severity: Dict[str, int]
    anomaly_count_by_type: Dict[str, int]
    detection_confidence: float
    analysis_duration: float
    anomalies: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    generated_at: datetime


class PredictionResponse(BaseModel):
    """Schema for prediction response."""
    metric_type: MetricType
    prediction_horizon: str
    model_performance: Dict[str, float]
    predictions: List[Dict[str, Any]]
    confidence_distribution: Dict[str, int]
    prediction_accuracy: Optional[float]
    generated_at: datetime


class IntelligenceReportResponse(BaseModel):
    """Schema for intelligence report response (slim, for list/generate)."""
    report_id: UUID
    report_name: str
    report_type: IntelligenceType
    time_range: str
    executive_summary: Dict[str, Any]
    key_insights_count: int
    recommendations_count: int
    overall_health_score: Optional[float] = None
    risk_assessment: Dict[str, Any]
    charts: List[Dict[str, Any]]
    generated_at: datetime
    download_url: Optional[str] = None


class AnalyticsDashboardData(BaseModel):
    """Schema for analytics dashboard data."""
    overview: Dict[str, Any]
    metrics_summary: Dict[str, Any]
    anomaly_summary: Dict[str, Any]
    prediction_summary: Dict[str, Any]
    recent_insights: List[Dict[str, Any]]
    health_indicators: Dict[str, Any]
    cost_analysis: Dict[str, Any]
    performance_trends: Dict[str, Any]
    security_status: Dict[str, Any]
    updated_at: datetime


class MetricsTrendData(BaseModel):
    """Schema for metrics trend data."""
    metric_name: str
    metric_type: MetricType
    unit: Optional[str]
    data_points: List[Dict[str, Any]]
    trend_direction: str
    trend_percentage: Optional[float]
    prediction_available: bool


class AnomalySummary(BaseModel):
    """Schema for anomaly summary data."""
    total_anomalies: int
    active_anomalies: int
    resolved_anomalies: int
    critical_anomalies: int
    anomalies_by_severity: Dict[str, int]
    anomalies_by_type: Dict[str, int]
    recent_anomalies: List[Dict[str, Any]]


class PredictionAccuracyData(BaseModel):
    """Schema for prediction accuracy data."""
    model_name: str
    metric_type: MetricType
    r2_score: Optional[float]
    mae: Optional[float]
    rmse: Optional[float]
    mape: Optional[float]
    prediction_count: int
    average_confidence: float
    accuracy_trend: str
