"""Dashboard API endpoints for predictive analytics."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.models.user import User
from ....infrastructure.database import get_async_session
from ....security.auth import get_current_user
from ....services.dashboard_service import (
    DashboardSummary,
    Trend,
    get_dashboard_service,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardSummaryResponse(BaseModel):
    """Response model for dashboard summary."""

    total_projects: int
    total_dependencies: int
    total_vulnerabilities: int
    critical_vulnerabilities: int
    high_risk_dependencies: int
    avg_compliance_score: float
    active_remediations: int
    pending_approvals: int

    # Trends
    vulnerability_trend: dict[str, Any]
    compliance_trend: dict[str, Any]
    dependency_trend: dict[str, Any]

    # Forecasts
    risk_forecast: dict[str, Any]
    compliance_projection: dict[str, Any]

    # Top issues
    top_vulnerable_packages: list[dict[str, Any]] = []
    top_policy_violations: list[dict[str, Any]] = []


class TrendResponse(BaseModel):
    """Response model for trend data."""

    metric_name: str
    direction: str
    current_value: float
    previous_value: float
    percent_change: float
    data_points: list[dict[str, Any]] = []


class RiskForecastResponse(BaseModel):
    """Response model for risk forecast."""

    period: str
    risk_level: str
    confidence: float
    predicted_vulnerabilities: int
    key_factors: list[str] = []


class ComplianceProjectionResponse(BaseModel):
    """Response model for compliance projection."""

    current_score: float
    projected_score_7d: float
    projected_score_30d: float
    projected_score_90d: float
    trend: str
    at_risk_policies: list[str] = []
    recommendations: list[str] = []


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    time_range_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> DashboardSummaryResponse:
    """Get comprehensive dashboard summary.

    Provides overview metrics, trends, forecasts, and top issues for:
    - All accessible projects (default)
    - Specific organization (if org_id provided)
    - Specific project (if project_id provided)
    """
    service = get_dashboard_service(db)

    summary = await service.get_dashboard_summary(
        organization_id=organization_id,
        project_id=project_id,
        time_range_days=time_range_days,
    )

    return _serialize_dashboard_summary(summary)


@router.get("/trends/vulnerabilities", response_model=TrendResponse)
async def get_vulnerability_trend(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> TrendResponse:
    """Get vulnerability trend over time."""
    service = get_dashboard_service(db)

    trend = await service._get_vulnerability_trend(
        organization_id=organization_id,
        project_id=project_id,
        days=days,
    )

    return _serialize_trend(trend)


@router.get("/trends/compliance", response_model=TrendResponse)
async def get_compliance_trend(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> TrendResponse:
    """Get compliance score trend over time."""
    service = get_dashboard_service(db)

    trend = await service._get_compliance_trend(
        organization_id=organization_id,
        project_id=project_id,
        days=days,
    )

    return _serialize_trend(trend)


@router.get("/trends/dependencies", response_model=TrendResponse)
async def get_dependency_trend(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> TrendResponse:
    """Get dependency count trend over time."""
    service = get_dashboard_service(db)

    trend = await service._get_dependency_trend(
        organization_id=organization_id,
        project_id=project_id,
        days=days,
    )

    return _serialize_trend(trend)


@router.get("/forecast/risk", response_model=RiskForecastResponse)
async def get_risk_forecast(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> RiskForecastResponse:
    """Get risk forecast for the next period."""
    service = get_dashboard_service(db)

    forecast = await service._generate_risk_forecast(
        organization_id=organization_id,
        project_id=project_id,
    )

    return RiskForecastResponse(
        period=forecast.period,
        risk_level=forecast.risk_level,
        confidence=forecast.confidence,
        predicted_vulnerabilities=forecast.predicted_vulnerabilities,
        key_factors=forecast.key_factors,
    )


@router.get("/forecast/compliance", response_model=ComplianceProjectionResponse)
async def get_compliance_projection(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> ComplianceProjectionResponse:
    """Get compliance score projection."""
    service = get_dashboard_service(db)

    projection = await service._generate_compliance_projection(
        organization_id=organization_id,
        project_id=project_id,
    )

    return ComplianceProjectionResponse(
        current_score=projection.current_score,
        projected_score_7d=projection.projected_score_7d,
        projected_score_30d=projection.projected_score_30d,
        projected_score_90d=projection.projected_score_90d,
        trend=projection.trend.value,
        at_risk_policies=projection.at_risk_policies,
        recommendations=projection.recommendations,
    )


@router.get("/issues/vulnerable-packages")
async def get_vulnerable_packages(
    limit: int = Query(10, ge=1, le=100),
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> list[dict[str, Any]]:
    """Get packages with most vulnerabilities."""
    service = get_dashboard_service(db)

    packages = await service._get_top_vulnerable_packages(
        organization_id=organization_id,
        project_id=project_id,
        limit=limit,
    )

    return packages


@router.get("/issues/policy-violations")
async def get_policy_violations(
    limit: int = Query(10, ge=1, le=100),
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> list[dict[str, Any]]:
    """Get most common policy violations."""
    service = get_dashboard_service(db)

    violations = await service._get_top_policy_violations(
        organization_id=organization_id,
        project_id=project_id,
        limit=limit,
    )

    return violations


def _serialize_dashboard_summary(summary: DashboardSummary) -> DashboardSummaryResponse:
    """Serialize dashboard summary to response model."""
    return DashboardSummaryResponse(
        total_projects=summary.total_projects,
        total_dependencies=summary.total_dependencies,
        total_vulnerabilities=summary.total_vulnerabilities,
        critical_vulnerabilities=summary.critical_vulnerabilities,
        high_risk_dependencies=summary.high_risk_dependencies,
        avg_compliance_score=summary.avg_compliance_score,
        active_remediations=summary.active_remediations,
        pending_approvals=summary.pending_approvals,
        vulnerability_trend=_serialize_trend_dict(summary.vulnerability_trend),
        compliance_trend=_serialize_trend_dict(summary.compliance_trend),
        dependency_trend=_serialize_trend_dict(summary.dependency_trend),
        risk_forecast={
            "period": summary.risk_forecast.period,
            "risk_level": summary.risk_forecast.risk_level,
            "confidence": summary.risk_forecast.confidence,
            "predicted_vulnerabilities": summary.risk_forecast.predicted_vulnerabilities,
            "key_factors": summary.risk_forecast.key_factors,
        },
        compliance_projection={
            "current_score": summary.compliance_projection.current_score,
            "projected_score_7d": summary.compliance_projection.projected_score_7d,
            "projected_score_30d": summary.compliance_projection.projected_score_30d,
            "projected_score_90d": summary.compliance_projection.projected_score_90d,
            "trend": summary.compliance_projection.trend.value,
            "at_risk_policies": summary.compliance_projection.at_risk_policies,
            "recommendations": summary.compliance_projection.recommendations,
        },
        top_vulnerable_packages=summary.top_vulnerable_packages,
        top_policy_violations=summary.top_policy_violations,
    )


def _serialize_trend(trend: Trend) -> TrendResponse:
    """Serialize trend to response model."""
    return TrendResponse(
        metric_name=trend.metric_name,
        direction=trend.direction.value,
        current_value=trend.current_value,
        previous_value=trend.previous_value,
        percent_change=trend.percent_change,
        data_points=[
            {
                "timestamp": dp.timestamp.isoformat(),
                "value": dp.value,
                "label": dp.label,
            }
            for dp in trend.data_points
        ],
    )


def _serialize_trend_dict(trend: Trend) -> dict[str, Any]:
    """Serialize trend to dictionary."""
    return {
        "metric_name": trend.metric_name,
        "direction": trend.direction.value,
        "current_value": trend.current_value,
        "previous_value": trend.previous_value,
        "percent_change": trend.percent_change,
        "data_points": [
            {
                "timestamp": dp.timestamp.isoformat(),
                "value": dp.value,
                "label": dp.label,
            }
            for dp in trend.data_points
        ],
        "prediction": [
            {
                "timestamp": dp.timestamp.isoformat(),
                "value": dp.value,
                "label": dp.label,
            }
            for dp in (trend.prediction or [])
        ],
    }
