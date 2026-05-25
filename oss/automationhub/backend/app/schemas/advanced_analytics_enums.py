"""Enums for Advanced Analytics schemas."""

from enum import Enum


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
