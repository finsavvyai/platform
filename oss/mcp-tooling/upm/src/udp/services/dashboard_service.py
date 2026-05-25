"""Predictive Analytics Dashboard Service.

Provides executive dashboard with trends, predictions, and
compliance projections for UPM.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.models import (
    Project,
    ProjectVulnerability,
)
from ..services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)


class TrendDirection(str, Enum):
    """Direction of a trend."""

    UP = "up"
    DOWN = "down"
    STABLE = "stable"


@dataclass
class TrendData:
    """Data point for a trend."""

    timestamp: datetime
    value: float
    label: Optional[str] = None


@dataclass
class Trend:
    """A trend over time."""

    metric_name: str
    direction: TrendDirection
    current_value: float
    previous_value: float
    percent_change: float
    data_points: list[TrendData] = field(default_factory=list)
    prediction: Optional[list[TrendData]] = None


@dataclass
class RiskForecast:
    """Risk forecast for a future period."""

    period: str  # e.g., "7d", "30d", "90d"
    risk_level: str  # "low", "medium", "high", "critical"
    confidence: float
    predicted_vulnerabilities: int
    key_factors: list[str] = field(default_factory=list)


@dataclass
class ComplianceProjection:
    """Projection of compliance metrics."""

    current_score: float
    projected_score_7d: float
    projected_score_30d: float
    projected_score_90d: float
    trend: TrendDirection
    at_risk_policies: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


@dataclass
class DashboardSummary:
    """Summary data for the dashboard."""

    total_projects: int
    total_dependencies: int
    total_vulnerabilities: int
    critical_vulnerabilities: int
    high_risk_dependencies: int
    avg_compliance_score: float
    active_remediations: int
    pending_approvals: int

    # Trends
    vulnerability_trend: Trend
    compliance_trend: Trend
    dependency_trend: Trend

    # Forecasts
    risk_forecast: RiskForecast
    compliance_projection: ComplianceProjection

    # Top issues
    top_vulnerable_packages: list[dict[str, Any]] = field(default_factory=list)
    top_policy_violations: list[dict[str, Any]] = field(default_factory=list)


class DashboardService:
    """Service for generating predictive analytics dashboard data."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.analytics_service = AnalyticsService()

    async def get_dashboard_summary(
        self,
        organization_id: Optional[str] = None,
        project_id: Optional[str] = None,
        time_range_days: int = 30,
    ) -> DashboardSummary:
        """Get comprehensive dashboard summary.

        Args:
            organization_id: Filter by organization
            project_id: Filter by specific project
            time_range_days: Time range for trend analysis

        Returns:
            Dashboard summary with all metrics
        """
        # Get base counts
        counts = await self._get_counts(organization_id, project_id)

        # Get trends
        vulnerability_trend = await self._get_vulnerability_trend(
            organization_id, project_id, time_range_days
        )
        compliance_trend = await self._get_compliance_trend(
            organization_id, project_id, time_range_days
        )
        dependency_trend = await self._get_dependency_trend(
            organization_id, project_id, time_range_days
        )

        # Get forecasts
        risk_forecast = await self._generate_risk_forecast(organization_id, project_id)
        compliance_projection = await self._generate_compliance_projection(
            organization_id, project_id
        )

        # Get top issues
        top_vulnerable = await self._get_top_vulnerable_packages(
            organization_id, project_id, limit=5
        )
        top_violations = await self._get_top_policy_violations(
            organization_id, project_id, limit=5
        )

        return DashboardSummary(
            total_projects=counts.get("projects", 0),
            total_dependencies=counts.get("dependencies", 0),
            total_vulnerabilities=counts.get("vulnerabilities", 0),
            critical_vulnerabilities=counts.get("critical_vulns", 0),
            high_risk_dependencies=counts.get("high_risk_deps", 0),
            avg_compliance_score=counts.get("avg_compliance", 0),
            active_remediations=counts.get("active_remediations", 0),
            pending_approvals=counts.get("pending_approvals", 0),
            vulnerability_trend=vulnerability_trend,
            compliance_trend=compliance_trend,
            dependency_trend=dependency_trend,
            risk_forecast=risk_forecast,
            compliance_projection=compliance_projection,
            top_vulnerable_packages=top_vulnerable,
            top_policy_violations=top_violations,
        )

    async def _get_counts(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
    ) -> dict[str, int]:
        """Get base counts for the dashboard."""
        # Build base query
        if project_id:
            project_filter = Project.id == project_id
        elif organization_id:
            project_filter = Project.organization_id == organization_id
        else:
            project_filter = True

        # Count projects
        projects_result = await self.db.execute(
            select(func.count(Project.id)).where(project_filter)
        )
        project_count = projects_result.scalar() or 0

        # Count dependencies (would need to join with project_dependencies)
        dependency_count = project_count * 50  # Placeholder

        # Count vulnerabilities
        vuln_result = await self.db.execute(select(func.count(ProjectVulnerability.id)))
        vuln_count = vuln_result.scalar() or 0

        # Count critical vulnerabilities
        critical_result = await self.db.execute(
            select(func.count(ProjectVulnerability.id)).where(
                ProjectVulnerability.severity == "critical"
            )
        )
        critical_count = critical_result.scalar() or 0

        return {
            "projects": project_count,
            "dependencies": dependency_count,
            "vulnerabilities": vuln_count,
            "critical_vulns": critical_count,
            "high_risk_deps": int(vuln_count * 0.1),
            "avg_compliance": 75.0,
            "active_remediations": 0,
            "pending_approvals": 0,
        }

    async def _get_vulnerability_trend(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
        days: int,
    ) -> Trend:
        """Get vulnerability trend over time."""
        # Generate mock trend data
        now = datetime.now()
        data_points = []

        for i in range(days):
            timestamp = now - timedelta(days=days - i)
            # Simulate some trend
            base_value = 100 + i * 0.5 + np.random.randint(-10, 10)
            data_points.append(TrendData(timestamp=timestamp, value=float(base_value)))

        current = data_points[-1].value if data_points else 0
        previous = data_points[0].value if data_points else 0
        change_pct = ((current - previous) / previous * 100) if previous > 0 else 0

        direction = (
            TrendDirection.UP
            if change_pct > 5
            else TrendDirection.DOWN
            if change_pct < -5
            else TrendDirection.STABLE
        )

        # Generate prediction
        prediction = []
        for i in range(7):
            timestamp = now + timedelta(days=i + 1)
            predicted_value = current * (1 + 0.01 * (i + 1))
            prediction.append(TrendData(timestamp=timestamp, value=predicted_value))

        return Trend(
            metric_name="Vulnerabilities",
            direction=direction,
            current_value=current,
            previous_value=previous,
            percent_change=change_pct,
            data_points=data_points,
            prediction=prediction,
        )

    async def _get_compliance_trend(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
        days: int,
    ) -> Trend:
        """Get compliance score trend over time."""
        now = datetime.now()
        data_points = []

        for i in range(days):
            timestamp = now - timedelta(days=days - i)
            # Simulate improvement trend
            base_value = 65 + i * 0.3 + np.random.randint(-5, 5)
            data_points.append(
                TrendData(timestamp=timestamp, value=min(base_value, 100))
            )

        current = data_points[-1].value if data_points else 0
        previous = data_points[0].value if data_points else 0
        change_pct = ((current - previous) / previous * 100) if previous > 0 else 0

        direction = (
            TrendDirection.UP
            if change_pct > 2
            else TrendDirection.DOWN
            if change_pct < -2
            else TrendDirection.STABLE
        )

        # Generate prediction
        prediction = []
        for i in range(7):
            timestamp = now + timedelta(days=i + 1)
            predicted_value = current * (1 + 0.005 * (i + 1))
            prediction.append(
                TrendData(timestamp=timestamp, value=min(predicted_value, 100))
            )

        return Trend(
            metric_name="Compliance Score",
            direction=direction,
            current_value=current,
            previous_value=previous,
            percent_change=change_pct,
            data_points=data_points,
            prediction=prediction,
        )

    async def _get_dependency_trend(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
        days: int,
    ) -> Trend:
        """Get dependency count trend over time."""
        now = datetime.now()
        data_points = []

        for i in range(days):
            timestamp = now - timedelta(days=days - i)
            # Simulate gradual growth
            base_value = 1000 + i * 2 + np.random.randint(-20, 20)
            data_points.append(TrendData(timestamp=timestamp, value=float(base_value)))

        current = data_points[-1].value if data_points else 0
        previous = data_points[0].value if data_points else 0
        change_pct = ((current - previous) / previous * 100) if previous > 0 else 0

        direction = (
            TrendDirection.UP
            if change_pct > 1
            else TrendDirection.DOWN
            if change_pct < -1
            else TrendDirection.STABLE
        )

        return Trend(
            metric_name="Dependencies",
            direction=direction,
            current_value=current,
            previous_value=previous,
            percent_change=change_pct,
            data_points=data_points,
        )

    async def _generate_risk_forecast(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
    ) -> RiskForecast:
        """Generate risk forecast for the next period."""
        # Use historical data to predict future risk
        current_vulns = 100

        # Simulate prediction
        predicted_vulns = int(current_vulns * 1.15)  # 15% increase expected

        if predicted_vulns > 150:
            risk_level = "critical"
            confidence = 0.7
        elif predicted_vulns > 120:
            risk_level = "high"
            confidence = 0.75
        elif predicted_vulns > 100:
            risk_level = "medium"
            confidence = 0.8
        else:
            risk_level = "low"
            confidence = 0.85

        return RiskForecast(
            period="30d",
            risk_level=risk_level,
            confidence=confidence,
            predicted_vulnerabilities=predicted_vulns,
            key_factors=[
                "Aging dependencies with known CVEs",
                "New vulnerabilities in ecosystem",
                "Lack of recent dependency updates",
            ],
        )

    async def _generate_compliance_projection(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
    ) -> ComplianceProjection:
        """Generate compliance score projection."""
        current_score = 75.0

        # Project scores based on trend
        score_7d = current_score + 1.5
        score_30d = current_score + 5.0
        score_90d = min(current_score + 10.0, 95.0)

        trend = TrendDirection.UP

        return ComplianceProjection(
            current_score=current_score,
            projected_score_7d=score_7d,
            projected_score_30d=score_30d,
            projected_score_90d=score_90d,
            trend=trend,
            at_risk_policies=[
                "License compliance for some npm packages",
                "Security policy for aging log4j dependencies",
            ],
            recommendations=[
                "Update 3 packages with known vulnerabilities",
                "Review license compatibility for 5 packages",
                "Enable automated dependency scanning",
            ],
        )

    async def _get_top_vulnerable_packages(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Get packages with most vulnerabilities."""
        # Mock data
        return [
            {
                "package_id": "maven:org.apache.logging.log4j:log4j-core",
                "vulnerability_count": 5,
                "highest_severity": "critical",
                "affected_projects": 12,
            },
            {
                "package_id": "npm:lodash",
                "vulnerability_count": 3,
                "highest_severity": "high",
                "affected_projects": 8,
            },
            {
                "package_id": "pypi:requests",
                "vulnerability_count": 2,
                "highest_severity": "medium",
                "affected_projects": 5,
            },
        ][:limit]

    async def _get_top_policy_violations(
        self,
        organization_id: Optional[str],
        project_id: Optional[str],
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Get most common policy violations."""
        return [
            {
                "policy_name": "no_critical_vulnerabilities",
                "violation_count": 15,
                "affected_projects": 8,
            },
            {
                "policy_name": "license_compatibility",
                "violation_count": 12,
                "affected_projects": 10,
            },
            {
                "policy_name": "maintained_packages",
                "violation_count": 8,
                "affected_projects": 5,
            },
        ][:limit]


# Singleton for backward compatibility
_dashboard_service: Optional[DashboardService] = None


def get_dashboard_service(db: AsyncSession) -> DashboardService:
    """Get or create dashboard service instance."""
    return DashboardService(db)
