"""
Advanced Analytics Models
SQLAlchemy models for analytics, anomalies, predictions, and intelligence reports
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, JSON, ForeignKey, BigInteger, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.declarative import declarative_base

from app.core.database import Base


class AnalyticsMetric(Base):
    """Analytics metric model for storing time-series data"""
    __tablename__ = "analytics_metrics"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("multi_cloud_providers.id", ondelete="CASCADE"), nullable=True, index=True)
    resource_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=True, index=True)

    # Metric identification
    metric_name = Column(String(255), nullable=False, index=True)
    metric_type = Column(String(50), nullable=False, index=True)  # performance, cost, security, etc.
    category = Column(String(50), nullable=True, index=True)  # cpu, memory, storage, network

    # Metric value and unit
    value = Column(Numeric(15, 6), nullable=False)
    unit = Column(String(20), nullable=True)  # %, ms, bytes, requests, etc.
    baseline_value = Column(Numeric(15, 6), nullable=True)
    deviation_percentage = Column(Float, nullable=True)

    # Timestamps
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    collected_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))

    # Metadata
    tags = Column(JSON, nullable=True, default=dict)
    extra_metadata = Column(JSON, nullable=True, default=dict)  # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    source = Column(String(50), nullable=False, default="automated")  # automated, manual, api

    # Aggregation data
    min_value = Column(Numeric(15, 6), nullable=True)
    max_value = Column(Numeric(15, 6), nullable=True)
    avg_value = Column(Numeric(15, 6), nullable=True)
    count_samples = Column(Integer, nullable=False, default=1)

    # Relationships
    provider = relationship("MultiCloudProvider", backref="analytics_metrics")
    resource = relationship("CloudResource", backref="analytics_metrics")

    @validates('metric_type')
    def validate_metric_type(self, key, value):
        valid_types = [
            'performance', 'cost', 'security', 'availability',
            'user_behavior', 'business', 'operational'
        ]
        if value not in valid_types:
            raise ValueError(f'Metric type must be one of: {valid_types}')
        return value

    def __repr__(self):
        return f"<AnalyticsMetric(id={self.id}, name='{self.metric_name}', type='{self.metric_type}', value={self.value})>"


class AnomalyDetection(Base):
    """Anomaly detection model for storing detected anomalies"""
    __tablename__ = "anomaly_detections"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("multi_cloud_providers.id", ondelete="CASCADE"), nullable=True, index=True)
    resource_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=True, index=True)

    # Anomaly identification
    anomaly_id = Column(String(100), nullable=False, unique=True, index=True)
    metric_type = Column(String(50), nullable=False, index=True)
    metric_name = Column(String(255), nullable=False, index=True)
    anomaly_type = Column(String(50), nullable=False)  # statistical, ml_based, rule_based

    # Anomaly details
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    value = Column(Numeric(15, 6), nullable=False)
    baseline_value = Column(Numeric(15, 6), nullable=False)
    deviation_score = Column(Float, nullable=False)  # Statistical deviation score

    # Classification
    severity = Column(String(20), nullable=False, index=True)  # low, medium, high, critical
    confidence = Column(Float, nullable=False)  # ML model confidence (0-1)
    status = Column(String(20), nullable=False, server_default="active", index=True)  # active, resolved, false_positive

    # Context and metadata
    context = Column(JSON, nullable=True, default=dict)  # Additional context information
    affected_systems = Column(JSON, nullable=True, default=list)  # Systems impacted by anomaly
    related_anomalies = Column(JSON, nullable=True, default=list)  # Related anomaly IDs

    # Detection method
    detection_method = Column(String(50), nullable=False, default="ml")  # ml, rule, statistical, hybrid
    detection_model = Column(String(100), nullable=True)  # Name/version of detection model
    feature_importance = Column(JSON, nullable=True, default=dict)  # Important features for detection

    # Resolution and tracking
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_method = Column(String(50), nullable=True)  # manual, automated, self_resolved
    resolution_notes = Column(Text, nullable=True)
    false_positive = Column(Boolean, nullable=False, server_default="false")

    # Impact assessment
    impact_level = Column(String(20), nullable=True)  # low, medium, high, critical
    business_impact = Column(Text, nullable=True)
    user_impact = Column(Text, nullable=True)

    # Timestamps
    detected_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    # Relationships
    provider = relationship("MultiCloudProvider", backref="anomalies")
    resource = relationship("CloudResource", backref="anomalies")
    alerts = relationship("AnomalyAlert", back_populates="anomaly", cascade="all, delete-orphan")

    @validates('severity')
    def validate_severity(self, key, value):
        valid_severities = ['low', 'medium', 'high', 'critical']
        if value not in valid_severities:
            raise ValueError(f'Severity must be one of: {valid_severities}')
        return value

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['active', 'resolved', 'false_positive', 'investigating']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<AnomalyDetection(id={self.id}, type='{self.anomaly_type}', severity='{self.severity}')>"


class PredictiveModel(Base):
    """Predictive model model for ML model management"""
    __tablename__ = "predictive_models"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Model identification
    model_name = Column(String(255), nullable=False, index=True)
    model_type = Column(String(50), nullable=False, index=True)  # regression, classification, clustering, anomaly
    model_category = Column(String(50), nullable=True)  # performance, cost, capacity, security
    version = Column(String(20), nullable=False, default="1.0")

    # Model configuration
    algorithm = Column(String(100), nullable=False)  # random_forest, lstm, arima, isolation_forest
    hyperparameters = Column(JSON, nullable=True, default=dict)  # Model hyperparameters
    feature_columns = Column(JSON, nullable=True, default=list)  # Features used by model

    # Training data
    training_data_start = Column(DateTime(timezone=True), nullable=True)
    training_data_end = Column(DateTime(timezone=True), nullable=True)
    training_samples = Column(BigInteger, nullable=False, default=0)
    feature_count = Column(Integer, nullable=False, default=0)

    # Performance metrics
    training_score = Column(Float, nullable=True)  # Training set score
    validation_score = Column(Float, nullable=True)  # Validation set score
    test_score = Column(Float, nullable=True)  # Test set score
    mae = Column(Float, nullable=True)  # Mean absolute error
    mse = Column(Float, nullable=True)  # Mean squared error
    rmse = Column(Float, nullable=True)  # Root mean squared error
    r2_score = Column(Float, nullable=True)  # R² score

    # Model status
    status = Column(String(20), nullable=False, server_default="training", index=True)  # training, active, deprecated, retired
    is_production = Column(Boolean, nullable=False, server_default="false", index=True)
    last_trained = Column(DateTime(timezone=True), nullable=True)
    last_updated = Column(DateTime(timezone=True), nullable=True)
    model_file_path = Column(String(500), nullable=True)  # Path to serialized model

    # Usage statistics
    prediction_count = Column(BigInteger, nullable=False, default=0)
    last_prediction = Column(DateTime(timezone=True), nullable=True)
    average_prediction_time = Column(Float, nullable=True)  # Average prediction time in ms

    # Retraining and maintenance
    retraining_interval = Column(Integer, nullable=True)  # Days between retraining
    last_retraining = Column(DateTime(timezone=True), nullable=True)
    model_drift_score = Column(Float, nullable=True)  # Model drift detection score

    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True, default=list)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    # Relationships
    predictions = relationship("PerformanceForecast", back_populates="model", cascade="all, delete-orphan")

    @validates('model_type')
    def validate_model_type(self, key, value):
        valid_types = ['regression', 'classification', 'clustering', 'anomaly', 'forecasting']
        if value not in valid_types:
            raise ValueError(f'Model type must be one of: {valid_types}')
        return value

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['training', 'active', 'deprecated', 'retired', 'error']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<PredictiveModel(id={self.id}, name='{self.model_name}', type='{self.model_type}', status='{self.status}')>"


class PerformanceForecast(Base):
    """Performance forecast model for storing predictions"""
    __tablename__ = "performance_forecasts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    model_id = Column(PG_UUID(as_uuid=True), ForeignKey("predictive_models.id", ondelete="CASCADE"), nullable=True, index=True)
    resource_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=True, index=True)

    # Forecast identification
    forecast_id = Column(String(100), nullable=False, unique=True, index=True)
    metric_type = Column(String(50), nullable=False, index=True)  # performance, cost, capacity, availability
    metric_name = Column(String(255), nullable=False, index=True)

    # Prediction details
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)  # Predicted timestamp
    predicted_value = Column(Numeric(15, 6), nullable=False)
    confidence_interval_lower = Column(Numeric(15, 6), nullable=True)  # Lower bound of confidence interval
    confidence_interval_upper = Column(Numeric(15, 6), nullable=True)  # Upper bound of confidence interval
    confidence = Column(Float, nullable=False)  # Prediction confidence (0-1)

    # Prediction metadata
    prediction_horizon = Column(String(20), nullable=False)  # 1h, 1d, 1w, 1m
    model_version = Column(String(20), nullable=False)
    features_used = Column(JSON, nullable=True, default=list)
    prediction_context = Column(JSON, nullable=True, default=dict)

    # Actual values (for post-analysis)
    actual_value = Column(Numeric(15, 6), nullable=True)  # Actual value when available
    prediction_error = Column(Float, nullable=True)  # Prediction error when actual value known
    mape = Column(Float, nullable=True)  # Mean absolute percentage error

    # Status and validation
    status = Column(String(20), nullable=False, server_default="pending", index=True)  # pending, validated, expired
    accuracy_rating = Column(String(20), nullable=True)  # excellent, good, fair, poor
    outlier_flag = Column(Boolean, nullable=False, server_default="false", index=True)

    # Business impact
    business_impact = Column(String(50), nullable=True)  # cost_savings, risk_reduction, capacity_planning
    impact_amount = Column(Numeric(15, 2), nullable=True)  # Quantified impact amount
    impact_currency = Column(String(3), nullable=True, default="USD")

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), index=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    model = relationship("PredictiveModel", back_populates="predictions")
    resource = relationship("CloudResource", backref="forecasts")

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['pending', 'validated', 'expired', 'invalidated']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<PerformanceForecast(id={self.id}, metric='{self.metric_name}', timestamp='{self.timestamp}')>"


class IntelligenceReport(Base):
    """Intelligence report model for AI-generated insights"""
    __tablename__ = "intelligence_reports"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Report identification
    report_name = Column(String(255), nullable=False, index=True)
    report_type = Column(String(50), nullable=False, index=True)  # performance_insight, cost_optimization, security_threat
    report_category = Column(String(50), nullable=True)  # executive, technical, operational
    version = Column(String(20), nullable=False, default="1.0")

    # Report configuration
    time_range = Column(String(20), nullable=False)  # 7d, 30d, 90d
    data_sources = Column(JSON, nullable=True, default=list)  # Data sources used in analysis
    filters = Column(JSON, nullable=True, default=dict)  # Filters applied to data
    analysis_types = Column(JSON, nullable=True, default=list)  # Types of analysis performed

    # Executive summary
    executive_summary = Column(JSON, nullable=False, default=dict)  # Key findings and metrics
    key_metrics = Column(JSON, nullable=True, default=dict)  # Important KPIs
    overall_score = Column(Float, nullable=True)  # Overall performance/health score
    trend_analysis = Column(String(20), nullable=True)  # improving, declining, stable

    # Insights and recommendations
    key_insights = Column(JSON, nullable=False, default=list)  # List of key insights
    recommendations = Column(JSON, nullable=False, default=list)  # Actionable recommendations
    risk_assessment = Column(JSON, nullable=True, default=dict)  # Risk analysis and assessment

    # Detailed analysis
    detailed_analysis = Column(JSON, nullable=True, default=dict)  # Full analysis data
    charts = Column(JSON, nullable=True, default=list)  # Chart configurations and data
    tables = Column(JSON, nullable=True, default=list)  # Table configurations and data
    supporting_data = Column(JSON, nullable=True, default=dict)  # Raw data supporting conclusions

    # Report status and metadata
    status = Column(String(20), nullable=False, server_default="generated", index=True)  # generated, reviewed, published, archived
    priority = Column(String(20), nullable=True, index=True)  # low, medium, high, critical
    tags = Column(JSON, nullable=True, default=list)
    description = Column(Text, nullable=True)

    # Distribution and sharing
    distribution_list = Column(JSON, nullable=True, default=list)  # Email addresses for distribution
    share_token = Column(String(100), nullable=True, unique=True)  # Token for secure sharing
    public_access = Column(Boolean, nullable=False, server_default="false")

    # Performance and usage
    generation_time = Column(Float, nullable=True)  # Time taken to generate report (seconds)
    view_count = Column(Integer, nullable=False, default=0)
    last_viewed = Column(DateTime(timezone=True), nullable=True)
    download_count = Column(Integer, nullable=False, default=0)
    last_downloaded = Column(DateTime(timezone=True), nullable=True)

    # Review and approval
    reviewed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_notes = Column(Text, nullable=True)

    # Scheduling (for recurring reports)
    is_recurring = Column(Boolean, nullable=False, server_default="false")
    recurrence_pattern = Column(JSON, nullable=True, default=dict)  # Cron-like pattern
    next_generation = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    generated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    approver = relationship("User", foreign_keys=[approved_by])
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

    @validates('report_type')
    def validate_report_type(self, key, value):
        valid_types = [
            'performance_insight', 'cost_optimization', 'security_threat',
            'capacity_planning', 'user_engagement', 'business_impact'
        ]
        if value not in valid_types:
            raise ValueError(f'Report type must be one of: {valid_types}')
        return value

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['generated', 'reviewed', 'published', 'archived', 'draft']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<IntelligenceReport(id={self.id}, name='{self.report_name}', type='{self.report_type}')>"


class InsightPattern(Base):
    """Insight pattern model for discovered patterns and trends"""
    __tablename__ = "insight_patterns"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Pattern identification
    pattern_name = Column(String(255), nullable=False, index=True)
    pattern_type = Column(String(50), nullable=False, index=True)  # seasonal, trend, correlation, anomaly_cluster
    category = Column(String(50), nullable=True, index=True)  # performance, cost, security, usage
    confidence_score = Column(Float, nullable=False)  # Pattern confidence (0-1)

    # Pattern details
    description = Column(Text, nullable=False)
    frequency = Column(String(20), nullable=True)  # hourly, daily, weekly, monthly, adhoc
    strength = Column(Float, nullable=True)  # Pattern strength/magnitude
    duration = Column(Integer, nullable=True)  # Duration of pattern in days/hours

    # Pattern metrics
    support = Column(Integer, nullable=False, default=0)  # Number of instances supporting pattern
    significance = Column(Float, nullable=True)  # Statistical significance (p-value)
    lift = Column(Float, nullable=True)  # Pattern lift over baseline

    # Pattern definition
    conditions = Column(JSON, nullable=True, default=dict)  # Conditions that define pattern
    triggers = Column(JSON, nullable=True, default=list)  # Events that trigger pattern
    consequences = Column(JSON, nullable=True, default=dict)  # Consequences of pattern

    # Detection metadata
    detection_method = Column(String(50), nullable=False, default="automated")
    detection_algorithm = Column(String(100), nullable=True)
    feature_importance = Column(JSON, nullable=True, default=dict)
    training_period = Column(String(20), nullable=True)  # Period used for pattern discovery

    # Business context
    business_impact = Column(String(50), nullable=True)  # positive, negative, neutral
    business_value = Column(Numeric(10, 2), nullable=True)  # Quantified business value
    stakeholders = Column(JSON, nullable=True, default=list)  # Stakeholders affected

    # Pattern management
    is_active = Column(Boolean, nullable=False, server_default="true", index=True)
    is_actionable = Column(Boolean, nullable=False, server_default="false")  # Can we act on this pattern
    action_taken = Column(Boolean, nullable=False, server_default="false")
    action_details = Column(JSON, nullable=True, default=dict)  # Details of actions taken

    # Validation and verification
    validated_at = Column(DateTime(timezone=True), nullable=True)
    validation_result = Column(String(50), nullable=True)  # confirmed, rejected, needs_review
    false_positive_count = Column(Integer, nullable=False, default=0)

    # Timestamps
    discovered_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), index=True)
    last_observed = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    @validates('pattern_type')
    def validate_pattern_type(self, key, value):
        valid_types = ['seasonal', 'trend', 'correlation', 'anomaly_cluster', 'recurring_event', 'behavioral']
        if value not in valid_types:
            raise ValueError(f'Pattern type must be one of: {valid_types}')
        return value

    def __repr__(self):
        return f"<InsightPattern(id={self.id}, name='{self.pattern_name}', type='{self.pattern_type}', confidence={self.confidence_score})>"


class AnomalyAlert(Base):
    """Anomaly alert model for managing alert notifications"""
    __tablename__ = "anomaly_alerts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    anomaly_id = Column(PG_UUID(as_uuid=True), ForeignKey("anomaly_detections.id", ondelete="CASCADE"), nullable=False, index=True)

    # Alert identification
    alert_name = Column(String(255), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)  # notification, escalation, remediation
    severity = Column(String(20), nullable=False, index=True)  # low, medium, high, critical

    # Alert configuration
    rule_id = Column(PG_UUID(as_uuid=True), nullable=True)  # Alert rule that triggered this alert
    condition_met = Column(JSON, nullable=True, default=dict)  # Condition that was met
    threshold_value = Column(Numeric(15, 6), nullable=True)  # Threshold that was crossed

    # Notification details
    notification_channels = Column(JSON, nullable=True, default=list)  # email, slack, webhook, sms
    recipients = Column(JSON, nullable=True, default=list)  # List of recipient information
    notification_sent = Column(Boolean, nullable=False, server_default="false")
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Alert content
    subject = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    action_required = Column(Text, nullable=True)  # Required action to resolve
    auto_remediation = Column(Boolean, nullable=False, server_default="false")
    remediation_actions = Column(JSON, nullable=True, default=list)

    # Alert lifecycle
    status = Column(String(20), nullable=False, server_default="open", index=True)  # open, acknowledged, resolved, suppressed
    acknowledged_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Escalation
    escalation_level = Column(Integer, nullable=False, server_default="0")  # 0=no escalation, 1=team lead, 2=manager, 3=executive
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    escalation_reason = Column(Text, nullable=True)

    # SLA and metrics
    response_time_target = Column(Integer, nullable=True)  # Response time target in minutes
    resolution_time_target = Column(Integer, nullable=True)  # Resolution time target in minutes
    actual_response_time = Column(Integer, nullable=True)  # Actual response time in minutes
    actual_resolution_time = Column(Integer, nullable=True)  # Actual resolution time in minutes

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    # Relationships
    anomaly = relationship("AnomalyDetection", back_populates="alerts")
    acknowledged_user = relationship("User", foreign_keys=[acknowledged_by])
    resolved_user = relationship("User", foreign_keys=[resolved_by])

    @validates('alert_type')
    def validate_alert_type(self, key, value):
        valid_types = ['notification', 'escalation', 'remediation', 'informational']
        if value not in valid_types:
            raise ValueError(f'Alert type must be one of: {valid_types}')
        return value

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['open', 'acknowledged', 'resolved', 'suppressed', 'false_positive']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    def __repr__(self):
        return f"<AnomalyAlert(id={self.id}, name='{self.alert_name}', severity='{self.severity}', status='{self.status}')>"