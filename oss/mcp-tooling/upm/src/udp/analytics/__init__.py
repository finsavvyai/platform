"""
Predictive Analytics Module.

Provides predictive analytics for dependency trends, security predictions,
and intelligent insights for dependency management.
"""

from .predictive_analytics import (
    AnalyticsModel,
    DependencyInsight,
    PredictionType,
    PredictiveAnalyticsEngine,
    RiskLevel,
    SecurityPrediction,
    TrendAnalysis,
    TrendDirection,
)

__all__ = [
    "PredictiveAnalyticsEngine",
    "TrendAnalysis",
    "SecurityPrediction",
    "DependencyInsight",
    "AnalyticsModel",
    "PredictionType",
    "TrendDirection",
    "RiskLevel"
]
