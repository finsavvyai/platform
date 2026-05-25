"""
API routes for predictive analytics.

Provides endpoints for predictive analytics including vulnerability predictions,
trend analysis, and dependency insights.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from udp.analytics.predictive_analytics import (
    PredictionType,
    PredictiveAnalyticsEngine,
    RiskLevel,
    TrendDirection,
)
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.domain.models import Organization, User

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize analytics engine
analytics_engine = PredictiveAnalyticsEngine()


# Request/Response Models
class VulnerabilityPredictionRequest(BaseModel):
    """Request model for vulnerability prediction."""
    package_name: str = Field(..., description="Package name")
    ecosystem: str = Field(..., description="Package ecosystem")
    time_horizon_days: int = Field(90, description="Prediction time horizon in days")


class TrendAnalysisRequest(BaseModel):
    """Request model for trend analysis."""
    package_name: str = Field(..., description="Package name")
    ecosystem: str = Field(..., description="Package ecosystem")
    time_period_months: int = Field(12, description="Analysis time period in months")


class DependencyInsightsRequest(BaseModel):
    """Request model for dependency insights."""
    package_name: str = Field(..., description="Package name")
    ecosystem: str = Field(..., description="Package ecosystem")


class AdoptionPredictionRequest(BaseModel):
    """Request model for adoption prediction."""
    package_name: str = Field(..., description="Package name")
    ecosystem: str = Field(..., description="Package ecosystem")
    time_horizon_days: int = Field(90, description="Prediction time horizon in days")


class SecurityPredictionResponse(BaseModel):
    """Response model for security prediction."""
    package_name: str
    ecosystem: str
    vulnerability_probability: float
    risk_level: str
    predicted_severity: str
    confidence: float
    time_horizon_days: int
    risk_factors: list[str]
    mitigation_recommendations: list[str]


class TrendAnalysisResponse(BaseModel):
    """Response model for trend analysis."""
    package_name: str
    ecosystem: str
    trend_direction: str
    trend_strength: float
    confidence: float
    time_period: str
    data_points: int
    prediction_horizon: int
    key_insights: list[str]


class DependencyInsightResponse(BaseModel):
    """Response model for dependency insight."""
    insight_type: str
    package_name: str
    ecosystem: str
    insight_score: float
    confidence: float
    description: str
    impact: str
    recommendations: list[str]
    related_packages: list[str]


class AdoptionPredictionResponse(BaseModel):
    """Response model for adoption prediction."""
    package_name: str
    ecosystem: str
    predicted_adoption_rate: float
    confidence: float
    time_horizon_days: int
    factors: list[str]


class AnalyticsModelResponse(BaseModel):
    """Response model for analytics model information."""
    model_id: str
    model_type: str
    version: str
    accuracy: float
    last_trained: str
    features_used: list[str]
    performance_metrics: dict[str, float]


# API Endpoints
@router.post("/vulnerability-prediction", response_model=SecurityPredictionResponse)
async def predict_vulnerability_risk(
    request: VulnerabilityPredictionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Predict vulnerability risk for a package."""
    try:
        logger.info(f"Predicting vulnerability risk for {request.package_name}@{request.ecosystem}")

        prediction = analytics_engine.predict_vulnerability_risk(
            package_name=request.package_name,
            ecosystem=request.ecosystem,
            time_horizon_days=request.time_horizon_days
        )

        # Log audit event
        background_tasks.add_task(
            _log_analytics_event,
            current_user.id, current_org.id, "vulnerability_prediction", request, prediction
        )

        return SecurityPredictionResponse(
            package_name=prediction.package_name,
            ecosystem=prediction.ecosystem,
            vulnerability_probability=prediction.vulnerability_probability,
            risk_level=prediction.risk_level.value,
            predicted_severity=prediction.predicted_severity,
            confidence=prediction.confidence,
            time_horizon_days=prediction.time_horizon_days,
            risk_factors=prediction.risk_factors,
            mitigation_recommendations=prediction.mitigation_recommendations
        )

    except Exception as e:
        logger.error(f"Failed to predict vulnerability risk: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to predict vulnerability risk: {str(e)}"
        )


@router.post("/trend-analysis", response_model=TrendAnalysisResponse)
async def analyze_dependency_trends(
    request: TrendAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Analyze dependency trends for a package."""
    try:
        logger.info(f"Analyzing trends for {request.package_name}@{request.ecosystem}")

        analysis = analytics_engine.analyze_dependency_trends(
            package_name=request.package_name,
            ecosystem=request.ecosystem,
            time_period_months=request.time_period_months
        )

        # Log audit event
        background_tasks.add_task(
            _log_analytics_event,
            current_user.id, current_org.id, "trend_analysis", request, analysis
        )

        return TrendAnalysisResponse(
            package_name=analysis.package_name,
            ecosystem=analysis.ecosystem,
            trend_direction=analysis.trend_direction.value,
            trend_strength=analysis.trend_strength,
            confidence=analysis.confidence,
            time_period=analysis.time_period,
            data_points=analysis.data_points,
            prediction_horizon=analysis.prediction_horizon,
            key_insights=analysis.key_insights
        )

    except Exception as e:
        logger.error(f"Failed to analyze dependency trends: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze dependency trends: {str(e)}"
        )


@router.post("/dependency-insights", response_model=list[DependencyInsightResponse])
async def generate_dependency_insights(
    request: DependencyInsightsRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Generate comprehensive insights for a dependency."""
    try:
        logger.info(f"Generating insights for {request.package_name}@{request.ecosystem}")

        insights = analytics_engine.generate_dependency_insights(
            package_name=request.package_name,
            ecosystem=request.ecosystem
        )

        # Log audit event
        background_tasks.add_task(
            _log_analytics_event,
            current_user.id, current_org.id, "dependency_insights", request, insights
        )

        return [
            DependencyInsightResponse(
                insight_type=insight.insight_type,
                package_name=insight.package_name,
                ecosystem=insight.ecosystem,
                insight_score=insight.insight_score,
                confidence=insight.confidence,
                description=insight.description,
                impact=insight.impact,
                recommendations=insight.recommendations,
                related_packages=insight.related_packages
            )
            for insight in insights
        ]

    except Exception as e:
        logger.error(f"Failed to generate dependency insights: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dependency insights: {str(e)}"
        )


@router.post("/adoption-prediction", response_model=AdoptionPredictionResponse)
async def predict_dependency_adoption(
    request: AdoptionPredictionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Predict dependency adoption trends."""
    try:
        logger.info(f"Predicting adoption for {request.package_name}@{request.ecosystem}")

        prediction = analytics_engine.predict_dependency_adoption(
            package_name=request.package_name,
            ecosystem=request.ecosystem,
            time_horizon_days=request.time_horizon_days
        )

        # Log audit event
        background_tasks.add_task(
            _log_analytics_event,
            current_user.id, current_org.id, "adoption_prediction", request, prediction
        )

        return AdoptionPredictionResponse(
            package_name=prediction["package_name"],
            ecosystem=prediction["ecosystem"],
            predicted_adoption_rate=prediction["predicted_adoption_rate"],
            confidence=prediction["confidence"],
            time_horizon_days=prediction["time_horizon_days"],
            factors=prediction["factors"]
        )

    except Exception as e:
        logger.error(f"Failed to predict dependency adoption: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to predict dependency adoption: {str(e)}"
        )


@router.get("/models", response_model=list[AnalyticsModelResponse])
async def get_analytics_models(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get information about analytics models."""
    try:
        logger.info("Getting analytics models information")

        models = analytics_engine.get_analytics_models()

        return [
            AnalyticsModelResponse(
                model_id=model.model_id,
                model_type=model.model_type,
                version=model.version,
                accuracy=model.accuracy,
                last_trained=model.last_trained.isoformat(),
                features_used=model.features_used,
                performance_metrics=model.performance_metrics
            )
            for model in models.values()
        ]

    except Exception as e:
        logger.error(f"Failed to get analytics models: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics models: {str(e)}"
        )


@router.get("/models/{model_id}/performance", response_model=dict[str, Any])
async def get_model_performance(
    model_id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get performance metrics for a specific model."""
    try:
        logger.info(f"Getting performance metrics for model {model_id}")

        performance = analytics_engine.get_model_performance(model_id)
        return performance

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get model performance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model performance: {str(e)}"
        )


@router.get("/prediction-types", response_model=list[dict[str, str]])
async def get_prediction_types(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available prediction types."""
    try:
        prediction_types = [
            {
                "id": PredictionType.VULNERABILITY.value,
                "name": "Vulnerability Prediction",
                "description": "Predict vulnerability risk for packages"
            },
            {
                "id": PredictionType.DEPENDENCY_TREND.value,
                "name": "Dependency Trend",
                "description": "Analyze usage trends and adoption patterns"
            },
            {
                "id": PredictionType.SECURITY_RISK.value,
                "name": "Security Risk",
                "description": "Assess overall security risk factors"
            },
            {
                "id": PredictionType.PERFORMANCE_IMPACT.value,
                "name": "Performance Impact",
                "description": "Predict performance impact of dependencies"
            },
            {
                "id": PredictionType.MAINTENANCE_COST.value,
                "name": "Maintenance Cost",
                "description": "Estimate maintenance and support costs"
            },
            {
                "id": PredictionType.ADOPTION_RATE.value,
                "name": "Adoption Rate",
                "description": "Predict package adoption and popularity"
            },
            {
                "id": PredictionType.DEPRECATION_RISK.value,
                "name": "Deprecation Risk",
                "description": "Assess risk of package deprecation"
            }
        ]
        return prediction_types
    except Exception as e:
        logger.error(f"Failed to get prediction types: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get prediction types: {str(e)}"
        )


@router.get("/trend-directions", response_model=list[dict[str, str]])
async def get_trend_directions(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available trend directions."""
    try:
        trend_directions = [
            {
                "id": TrendDirection.RISING.value,
                "name": "Rising",
                "description": "Package usage is increasing"
            },
            {
                "id": TrendDirection.FALLING.value,
                "name": "Falling",
                "description": "Package usage is decreasing"
            },
            {
                "id": TrendDirection.STABLE.value,
                "name": "Stable",
                "description": "Package usage is stable"
            },
            {
                "id": TrendDirection.VOLATILE.value,
                "name": "Volatile",
                "description": "Package usage is volatile"
            }
        ]
        return trend_directions
    except Exception as e:
        logger.error(f"Failed to get trend directions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get trend directions: {str(e)}"
        )


@router.get("/risk-levels", response_model=list[dict[str, str]])
async def get_risk_levels(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available risk levels."""
    try:
        risk_levels = [
            {
                "id": RiskLevel.LOW.value,
                "name": "Low Risk",
                "description": "Minimal risk identified"
            },
            {
                "id": RiskLevel.MEDIUM.value,
                "name": "Medium Risk",
                "description": "Moderate risk identified"
            },
            {
                "id": RiskLevel.HIGH.value,
                "name": "High Risk",
                "description": "Significant risk identified"
            },
            {
                "id": RiskLevel.CRITICAL.value,
                "name": "Critical Risk",
                "description": "Critical risk identified"
            }
        ]
        return risk_levels
    except Exception as e:
        logger.error(f"Failed to get risk levels: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get risk levels: {str(e)}"
        )


@router.get("/statistics", response_model=dict[str, Any])
async def get_analytics_statistics(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get analytics statistics."""
    try:
        logger.info("Getting analytics statistics")

        models = analytics_engine.get_analytics_models()

        statistics = {
            "total_models": len(models),
            "model_types": list(set(model.model_type for model in models.values())),
            "average_accuracy": sum(model.accuracy for model in models.values()) / len(models) if models else 0,
            "last_trained": max(model.last_trained for model in models.values()).isoformat() if models else None,
            "total_features": len(set(feature for model in models.values() for feature in model.features_used)),
            "prediction_types": [pt.value for pt in PredictionType],
            "trend_directions": [td.value for td in TrendDirection],
            "risk_levels": [rl.value for rl in RiskLevel]
        }

        return statistics
    except Exception as e:
        logger.error(f"Failed to get analytics statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics statistics: {str(e)}"
        )


# Helper Functions
async def _log_analytics_event(
    user_id: str,
    organization_id: UUID,
    event_type: str,
    request: Any,
    result: Any
):
    """Log analytics event to audit logger."""
    try:
        from udp.security.audit_logger import (
            AuditEventSeverity,
            AuditEventStatus,
            AuditEventType,
            AuditLogger,
        )

        audit_logger = AuditLogger()
        audit_logger.log_event(
            event_type=AuditEventType.DEPENDENCY_ANALYSIS,
            action=f"analytics_{event_type}",
            description=f"Performed {event_type} for package {getattr(request, 'package_name', 'unknown')}",
            user_id=user_id,
            organization_id=organization_id,
            details={
                "analytics_event_type": event_type,
                "package_name": getattr(request, 'package_name', 'unknown'),
                "ecosystem": getattr(request, 'ecosystem', 'unknown'),
                "confidence": getattr(result, 'confidence', 0.0)
            },
            severity=AuditEventSeverity.MEDIUM,
            status=AuditEventStatus.SUCCESS,
            tags=["analytics", "prediction", event_type]
        )
    except Exception as e:
        logger.error(f"Failed to log analytics event: {e}")
