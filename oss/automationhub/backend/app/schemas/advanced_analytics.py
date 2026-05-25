"""
Advanced Analytics Schemas
Pydantic schemas for analytics, anomalies, predictions, and intelligence reports
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any, Union, Literal
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator, root_validator

# Enums
class MetricType(str, Enum):
    PERFORMANCE = "performance"
    COST = "cost"
    SECURITY = "security"
    AVAILABILITY = "availability"
    USER_BEHAVIOR = "user_behavior"
    BUSINESS = "business"
    OPERATIONAL = "operational"


class AnalysisType(str, Enum):
    TREND = "trend"
    ANOMALY = "anomaly"
    PREDICTION = "prediction"
    CORRELATION = "correlation"
    CLUSTERING = "clustering"
    SENTIMENT = "sentiment"


class AnomalySeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IntelligenceType(str, Enum):
    PERFORMANCE_INSIGHT = "performance_insight"
    COST_OPTIMIZATION = "cost_optimization"
    SECURITY_THREAT = "security_threat"
    CAPACITY_PLANNING = "capacity_planning"
    USER_ENGAGEMENT = "user_engagement"
    BUSINESS_IMPACT = "business_impact"


class ModelType(str, Enum):
    REGRESSION = "regression"
    CLASSIFICATION = "classification"
    CLUSTERING = "clustering"
    ANOMALY = "anomaly"
    FORECASTING = "forecasting"


class AlertType(str, Enum):
    NOTIFICATION = "notification"
    ESCALATION = "escalation"
    REMEDIATION = "remediation"
    INFORMATIONAL = "informational"


# Metric Schemas
class AnalyticsMetricCreate(BaseModel):
    """Schema for creating an analytics metric"""
    metric_name: str = Field(..., min_length=1, max_length=255)
    metric_type: MetricType
    category: Optional[str] = Field(None, max_length=50)
    value: float = Field(..., description="Metric value")
    unit: Optional[str] = Field(None, max_length=20, description="Unit of measurement")
    baseline_value: Optional[float] = None
    timestamp: datetime = Field(..., description="When the metric was collected")
    tags: Optional[Dict[str, str]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    source: str = Field("automated", max_length=50)

    @validator('value')
    def validate_value(cls, v):
        if v is None:
            raise ValueError('Value cannot be None')
        return v

    @validator('timestamp')
    def validate_timestamp(cls, v):
        if v > datetime.now():
            raise ValueError('Timestamp cannot be in the future')
        return v


class AnalyticsMetricResponse(BaseModel):
    """Schema for analytics metric response"""
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
    metadata: Dict[str, Any]
    source: str

    class Config:
        from_attributes = True


# Anomaly Detection Schemas
class AnomalyDetectionCreate(BaseModel):
    """Schema for creating an anomaly detection"""
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

    @validator('deviation_score')
    def validate_deviation_score(cls, v):
        if v < 0:
            raise ValueError('Deviation score must be non-negative')
        return v

    @validator('anomaly_type')
    def validate_anomaly_type(cls, v):
        valid_types = ['statistical', 'ml_based', 'rule_based', 'threshold_based', 'pattern_based']
        if v not in valid_types:
            raise ValueError(f'Anomaly type must be one of: {valid_types}')
        return v

    @validator('detection_method')
    def validate_detection_method(cls, v):
        valid_methods = ['ml', 'rule', 'statistical', 'hybrid']
        if v not in valid_methods:
            raise ValueError(f'Detection method must be one of: {valid_methods}')
        return v

    @validator('impact_level')
    def validate_impact_level(cls, v):
        if v:
            valid_levels = ['low', 'medium', 'high', 'critical']
            if v not in valid_levels:
                raise ValueError(f'Impact level must be one of: {valid_levels}')
        return v


class AnomalyDetectionResponse(BaseModel):
    """Schema for anomaly detection response"""
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


# Predictive Model Schemas
class PredictiveModelCreate(BaseModel):
    """Schema for creating a predictive model"""
    model_name: str = Field(..., min_length=1, max_length=255)
    model_type: ModelType
    model_category: Optional[str] = Field(None, max_length=50)
    version: str = Field("1.0", max_length=20)
    algorithm: str = Field(..., max_length=100)
    hyperparameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    feature_columns: Optional[List[str]] = Field(default_factory=list)
    description: Optional[str] = Field(None, max_length=1000)
    tags: Optional[List[str]] = Field(default_factory=list)
    retraining_interval: Optional[int] = Field(None, ge=1, le=365)  # Days between retraining

    @validator('algorithm')
    def validate_algorithm(cls, v):
        valid_algorithms = [
            'random_forest', 'linear_regression', 'decision_tree', 'svm',
            'lstm', 'arima', 'prophet', 'isolation_forest', 'kmeans',
            'dbscan', 'hierarchical', 'xgboost', 'lightgbm', 'catboost'
        ]
        if v.lower() not in [algo.lower() for algo in valid_algorithms]:
            raise ValueError(f'Algorithm must be one of: {valid_algorithms}')
        return v


class PredictiveModelResponse(BaseModel):
    """Schema for predictive model response"""
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


# Performance Forecast Schemas
class PerformanceForecastCreate(BaseModel):
    """Schema for creating a performance forecast"""
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

    @validator('prediction_horizon')
    def validate_prediction_horizon(cls, v):
        valid_horizons = ['1h', '6h', '1d', '3d', '1w', '2w', '1m', '3m', '6m', '1y']
        if v not in valid_horizons:
            raise ValueError(f'Prediction horizon must be one of: {valid_horizons}')
        return v

    @validator('confidence_interval_lower', 'confidence_interval_upper')
    def validate_confidence_intervals(cls, v, values):
        if v is not None:
            predicted_value = values.get('predicted_value')
            if predicted_value is not None:
                if v > predicted_value:
                    raise ValueError('Lower confidence interval must be less than or equal to predicted value')
        return v

    @validator('confidence_interval_upper')
    def validate_confidence_interval_upper(cls, v, values):
        if v is not None:
            predicted_value = values.get('predicted_value')
            if predicted_value is not None:
                if v < predicted_value:
                    raise ValueError('Upper confidence interval must be greater than or equal to predicted value')
        return v


class PerformanceForecastResponse(BaseModel):
    """Schema for performance forecast response"""
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


# Intelligence Report Schemas
class IntelligenceReportCreate(BaseModel):
    """Schema for creating an intelligence report"""
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

    @validator('report_type')
    def validate_report_type(cls, v):
        valid_types = [
            'performance_insight', 'cost_optimization', 'security_threat',
            'capacity_planning', 'user_engagement', 'business_impact'
        ]
        if v not in valid_types:
            raise ValueError(f'Report type must be one of: {valid_types}')
        return v

    @validator('time_range')
    def validate_time_range(cls, v):
        valid_ranges = ['7d', '14d', '30d', '60d', '90d', '6m', '1y']
        if v not in valid_ranges:
            raise ValueError(f'Time range must be one of: {valid_ranges}')
        return v

    @validator('priority')
    def validate_priority(cls, v):
        if v:
            valid_priorities = ['low', 'medium', 'high', 'critical']
            if v not in valid_priorities:
                raise ValueError(f'Priority must be one of: {valid_priorities}')
        return v


class IntelligenceReportResponse(BaseModel):
    """Schema for intelligence report response"""
    id: UUID
    tenant_id: UUID
    report_name: str
    report_type: IntelligenceType
    report_category: Optional[str]
    version: str
    time_range: str
    data_sources: List[str]
    filters: Dict[str, Any]
    analysis_types: List[str]
    executive_summary: Dict[str, Any]
    key_metrics: Dict[str, Any]
    overall_score: Optional[float]
    trend_analysis: Optional[str]
    key_insights: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    risk_assessment: Dict[str, Any]
    detailed_analysis: Dict[str, Any]
    charts: List[Dict[str, Any]]
    tables: List[Dict[str, Any]]
    supporting_data: Dict[str, Any]
    status: str
    priority: Optional[str]
    tags: List[str]
    description: Optional[str]
    generation_time: Optional[float]
    view_count: int
    last_viewed: Optional[datetime]
    download_count: int
    last_downloaded: Optional[datetime]
    reviewed_by: Optional[UUID]
    reviewed_at: Optional[datetime]
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    is_recurring: bool
    recurrence_pattern: Dict[str, Any]
    next_generation: Optional[datetime]
    generated_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# Insight Pattern Schemas
class InsightPatternCreate(BaseModel):
    """Schema for creating an insight pattern"""
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

    @validator('pattern_type')
    def validate_pattern_type(cls, v):
        valid_types = [
            'seasonal', 'trend', 'correlation', 'anomaly_cluster',
            'recurring_event', 'behavioral', 'usage_pattern', 'cost_pattern'
        ]
        if v not in valid_types:
            raise ValueError(f'Pattern type must be one of: {valid_types}')
        return v

    @validator('frequency')
    def validate_frequency(cls, v):
        if v:
            valid_frequencies = ['hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'ad hoc']
            if v.lower() not in [freq.lower() for freq in valid_frequencies]:
                raise ValueError(f'Frequency must be one of: {valid_frequencies}')
        return v

    @validator('business_impact')
    def validate_business_impact(cls, v):
        if v:
            valid_impacts = ['positive', 'negative', 'neutral']
            if v.lower() not in [impact.lower() for impact in valid_impacts]:
                raise ValueError(f'Business impact must be one of: {valid_impacts}')
        return v


class InsightPatternResponse(BaseModel):
    """Schema for insight pattern response"""
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


# Anomaly Alert Schemas
class AnomalyAlertCreate(BaseModel):
    """Schema for creating an anomaly alert"""
    alert_name: str = Field(..., min_length=1, max_length=255)
    alert_type: AlertType
    severity: AnomalySeverity
    rule_id: Optional[UUID] = None
    condition_met: Optional[Dict[str, Any]] = Field(default_factory=dict)
    threshold_value: Optional[float] = None
    notification_channels: Optional[List[str]] = Field(default_factory=list)
    recipients: Optional[List[Dict[str, Any]]] Field(default_factory=list)
    subject: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1, max_length=2000)
    action_required: Optional[str] = None
    auto_remediation: bool = False
    remediation_actions: Optional[List[Dict[str, Any]]] Field(default_factory=list)
    response_time_target: Optional[int] = Field(None, ge=1, le=10080)  # 1 minute to 1 week
    resolution_time_target: Optional[int] = Field(None, ge=1, le=43200)  # 1 minute to 12 hours

    @validator('alert_type')
    def validate_alert_type(cls, v):
        valid_types = ['notification', 'escalation', 'remediation', 'informational']
        if v not in valid_types:
            raise ValueError(f'Alert type must be one of: {valid_types}')
        return v


class AnomalyAlertResponse(BaseModel):
    """Schema for anomaly alert response"""
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


# Request and Response Schemas for API Endpoints
class MetricsCollectionRequest(BaseModel):
    """Schema for metrics collection request"""
    metric_type: MetricType
    time_range: str = Field("24h", max_length=20)
    providers: Optional[List[str]] = None
    resources: Optional[List[str]] = None
    aggregation: Optional[str] = Field(None, max_length=20)  # hourly, daily, weekly, monthly


class AnomalyDetectionRequest(BaseModel):
    """Schema for anomaly detection request"""
    metric_type: MetricType
    time_range: str = Field("7d", max_length=20)
    sensitivity: float = Field(0.1, ge=0.01, le=1.0)
    analysis_window: str = Field("30d", max_length=20)
    providers: Optional[List[str]] = None
    resources: Optional[List[str]] = None


class PredictionRequest(BaseModel):
    """Schema for prediction request"""
    metric_type: MetricType
    prediction_horizon: str = Field("7d", max_length=20)
    confidence_threshold: float = Field(0.8, ge=0, le=1)
    resource_ids: Optional[List[UUID]] = None
    include_confidence_intervals: bool = True


class IntelligenceReportRequest(BaseModel):
    """Schema for intelligence report request"""
    report_type: IntelligenceType
    time_range: str = Field("7d", max_length=20)
    include_recommendations: bool = True
    include_charts: bool = True
    custom_filters: Optional[Dict[str, Any]] = None
    stakeholder_level: Optional[str] = Field(None, max_length=20)  # executive, technical, operational


class MetricsCollectionResponse(BaseModel):
    """Schema for metrics collection response"""
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
    """Schema for anomaly detection response"""
    anomalies_detected: int
    anomaly_count_by_severity: Dict[str, int]
    anomaly_count_by_type: Dict[str, int]
    detection_confidence: float
    analysis_duration: float
    anomalies: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    generated_at: datetime


class PredictionResponse(BaseModel):
    """Schema for prediction response"""
    metric_type: MetricType
    prediction_horizon: str
    model_performance: Dict[str, float]
    predictions: List[Dict[str, Any]]
    confidence_distribution: Dict[str, int]
    prediction_accuracy: Optional[float]
    generated_at: datetime


class IntelligenceReportResponse(BaseModel):
    """Schema for intelligence report response"""
    report_id: UUID
    report_name: str
    report_type: IntelligenceType
    time_range: str
    executive_summary: Dict[str, Any]
    key_insights_count: int
    recommendations_count: int
    overall_health_score: Optional[float]
    risk_assessment: Dict[str, Any]
    charts: List[Dict[str, Any]]
    generated_at: datetime
    download_url: Optional[str]


# Analytics Dashboard Schemas
class AnalyticsDashboardData(BaseModel):
    """Schema for analytics dashboard data"""
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
    """Schema for metrics trend data"""
    metric_name: str
    metric_type: MetricType
    unit: Optional[str]
    data_points: List[Dict[str, Any]]
    trend_direction: str  # up, down, stable
    trend_percentage: Optional[float]
    prediction_available: bool


class AnomalySummary(BaseModel):
    """Schema for anomaly summary data"""
    total_anomalies: int
    active_anomalies: int
    resolved_anomalies: int
    critical_anomalies: int
    anomalies_by_severity: Dict[str, int]
    anomalies_by_type: Dict[str, int]
    recent_anomalies: List[Dict[str, Any]]


class PredictionAccuracyData(BaseModel):
    """Schema for prediction accuracy data"""
    model_name: str
    metric_type: MetricType
    r2_score: Optional[float]
    mae: Optional[float]
    rmse: Optional[float]
    mape: Optional[float]
    prediction_count: int
    average_confidence: float
    accuracy_trend: str