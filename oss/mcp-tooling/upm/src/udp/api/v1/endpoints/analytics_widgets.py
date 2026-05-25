"""Analytics Widgets API endpoints for dashboard components."""

from __future__ import annotations

import logging
from dataclasses import field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.models.user import User
from ....infrastructure.database import get_async_session
from ....security.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/widgets", tags=["analytics-widgets"])


class TimeRange(str, Enum):
    """Time range options for analytics widgets."""

    HOUR = "1h"
    DAY = "1d"
    WEEK = "7d"
    MONTH = "30d"
    QUARTER = "90d"
    YEAR = "365d"


class SeverityLevel(str, Enum):
    """Vulnerability severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


# ==================== Response Models ====================


class MetricCardData(BaseModel):
    """Data for a metric card widget."""

    title: str
    value: float | int
    unit: Optional[str] = None
    change: Optional[float] = None  # Percentage change
    change_direction: Optional[str] = None  # "up" or "down"
    trend: list[dict[str, Any]] = field(default_factory=list)
    threshold: Optional[float] = None
    status: str = "neutral"  # "success", "warning", "danger", "neutral"


class VulnerabilityHeatmapData(BaseModel):
    """Data for vulnerability heatmap widget."""

    period: str
    data: list[dict[str, Any]]
    max_value: int


class ComplianceGaugeData(BaseModel):
    """Data for compliance gauge widget."""

    score: float
    max_score: float = 100
    breakdown: dict[str, float] = field(default_factory=dict)
    trend: list[dict[str, Any]] = field(default_factory=list)
    grade: str = "A"


class RemediationQueueData(BaseModel):
    """Data for remediation queue widget."""

    items: list[dict[str, Any]]
    total: int
    estimated_time: Optional[str] = None
    auto_fixable: int


class RiskDistributionData(BaseModel):
    """Data for risk distribution pie chart."""

    labels: list[str]
    values: list[int]
    colors: list[str]


class DependencyGrowthData(BaseModel):
    """Data for dependency growth trend widget."""

    period: str
    data: list[dict[str, Any]]
    total_added: int
    total_removed: int
    net_change: int


class EcosystemDistributionData(BaseModel):
    """Data for ecosystem distribution widget."""

    ecosystems: list[dict[str, Any]]
    total: int


class TopRisksData(BaseModel):
    """Data for top risks widget."""

    risks: list[dict[str, Any]]
    total_risk_score: float


class MTTRData(BaseModel):
    """Data for Mean Time To Remediate widget."""

    current_mttr: float  # in minutes
    target_mttr: float
    trend: list[dict[str, Any]] = field(default_factory=list)
    improvement_rate: Optional[float] = None


class LicenseComplianceData(BaseModel):
    """Data for license compliance widget."""

    compliant: int
    non_compliant: int
    unknown: int
    total: int
    violations: list[dict[str, Any]] = field(default_factory=list)


class DeploymentRiskData(BaseModel):
    """Data for deployment risk widget."""

    risk_level: str  # "low", "medium", "high", "critical"
    blocked_deployments: int
    risk_factors: list[dict[str, Any]]
    recommendations: list[str] = field(default_factory=list)


# ==================== Widget Endpoints ====================


@router.get("/metric-card/{metric_name}", response_model=MetricCardData)
async def get_metric_card(
    metric_name: str,
    time_range: TimeRange = TimeRange.WEEK,
    organization_id: Optional[str] = None,
    project_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> MetricCardData:
    """Get data for a metric card widget.

    Available metrics:
    - total-dependencies
    - total-vulnerabilities
    - compliance-score
    - mttr
    - active-scans
    - policy-violations
    """
    # Map metric name to data generator
    metrics = {
        "total-dependencies": _get_total_dependencies_metric,
        "total-vulnerabilities": _get_total_vulnerabilities_metric,
        "compliance-score": _get_compliance_score_metric,
        "mttr": _get_mttr_metric,
        "active-scans": _get_active_scans_metric,
        "policy-violations": _get_policy_violations_metric,
    }

    generator = metrics.get(metric_name, _get_default_metric)
    return generator(time_range, organization_id, project_id)


@router.get("/vulnerability-heatmap", response_model=VulnerabilityHeatmapData)
async def get_vulnerability_heatmap(
    time_range: TimeRange = TimeRange.MONTH,
    severity: Optional[SeverityLevel] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> VulnerabilityHeatmapData:
    """Get vulnerability heatmap data.

    Returns a 2D grid showing vulnerability counts by day and severity,
    suitable for a calendar-style heatmap visualization.
    """
    now = datetime.now()
    days = _get_days_for_range(time_range)

    data = []
    max_val = 0

    for i in range(days):
        date = now - timedelta(days=days - i)
        # Generate mock data
        for sev in ["critical", "high", "medium", "low"]:
            count = _random_vulnerability_count(sev, i)
            max_val = max(max_val, count)
            data.append(
                {
                    "date": date.isoformat(),
                    "severity": sev,
                    "count": count,
                }
            )

    return VulnerabilityHeatmapData(
        period=time_range.value,
        data=data,
        max_value=max_val,
    )


@router.get("/compliance-gauge", response_model=ComplianceGaugeData)
async def get_compliance_gauge(
    organization_id: Optional[str] = None,
    project_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> ComplianceGaugeData:
    """Get compliance gauge data.

    Returns overall compliance score with breakdown by category
    (security, license, maintenance, policy).
    """
    score = 87.5
    breakdown = {
        "security": 92.0,
        "license": 95.0,
        "maintenance": 78.0,
        "policy": 85.0,
    }

    # Calculate trend
    trend = []
    for i in range(30):
        date = datetime.now() - timedelta(days=30 - i)
        trend.append(
            {
                "date": date.isoformat(),
                "score": max(50, score - (30 - i) * 0.5 + _random_noise()),
            }
        )

    # Calculate grade
    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 70:
        grade = "C"
    else:
        grade = "D"

    return ComplianceGaugeData(
        score=score,
        breakdown=breakdown,
        trend=trend,
        grade=grade,
    )


@router.get("/remediation-queue", response_model=RemediationQueueData)
async def get_remediation_queue(
    limit: int = Query(10, ge=1, le=50),
    severity: Optional[SeverityLevel] = None,
    auto_fix_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> RemediationQueueData:
    """Get remediation queue data.

    Returns prioritized list of vulnerabilities waiting for remediation.
    """
    items = [
        {
            "id": "CVE-2021-44228",
            "package": "log4j:log4j-core:2.14.1",
            "severity": "critical",
            "cvss": 9.8,
            "project": "payment-service",
            "auto_fixable": True,
            "estimated_effort": "5 min",
            "in_queue_since": "2024-01-15T10:30:00Z",
            "priority": 1,
        },
        {
            "id": "CVE-2021-23337",
            "package": "npm:lodash:4.17.15",
            "severity": "high",
            "cvss": 7.5,
            "project": "frontend-app",
            "auto_fixable": True,
            "estimated_effort": "3 min",
            "in_queue_since": "2024-01-15T11:00:00Z",
            "priority": 2,
        },
        {
            "id": "CVE-2023-32681",
            "package": "pypi:requests:2.25.0",
            "severity": "medium",
            "cvss": 5.3,
            "project": "api-gateway",
            "auto_fixable": False,
            "estimated_effort": "1 hour",
            "in_queue_since": "2024-01-14T09:00:00Z",
            "priority": 3,
        },
        {
            "id": "CVE-2022-22965",
            "package": "maven:org.springframework:spring-core:5.3.15",
            "severity": "critical",
            "cvss": 9.8,
            "project": "user-auth-api",
            "auto_fixable": True,
            "estimated_effort": "10 min",
            "in_queue_since": "2024-01-13T14:30:00Z",
            "priority": 4,
        },
        {
            "id": "CVE-2021-22918",
            "package": "npm:node-fetch:2.6.1",
            "severity": "high",
            "cvss": 7.2,
            "project": "backend-worker",
            "auto_fixable": True,
            "estimated_effort": "5 min",
            "in_queue_since": "2024-01-12T16:00:00Z",
            "priority": 5,
        },
    ]

    # Filter by severity if specified
    if severity:
        items = [i for i in items if i["severity"] == severity.value]

    # Filter by auto-fix only
    if auto_fix_only:
        items = [i for i in items if i["auto_fixable"]]

    items = items[:limit]

    auto_fixable = sum(1 for i in items if i["auto_fixable"])

    # Estimate total time
    total_mins = sum(_parse_effort(i["estimated_effort"]) for i in items)
    estimated_time = _format_duration(total_mins)

    return RemediationQueueData(
        items=items,
        total=len(items),
        estimated_time=estimated_time,
        auto_fixable=auto_fixable,
    )


@router.get("/risk-distribution", response_model=RiskDistributionData)
async def get_risk_distribution(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> RiskDistributionData:
    """Get risk distribution data.

    Returns breakdown of risks by category for a pie/donut chart.
    """
    return RiskDistributionData(
        labels=["Critical", "High", "Medium", "Low", "Info"],
        values=[7, 16, 23, 31, 22],
        colors=["#ef4444", "#f97316", "#f59e0b", "#10b981", "#6366f1"],
    )


@router.get("/dependency-growth", response_model=DependencyGrowthData)
async def get_dependency_growth(
    time_range: TimeRange = TimeRange.MONTH,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> DependencyGrowthData:
    """Get dependency growth trend data.

    Shows how the number of dependencies has changed over time.
    """
    days = _get_days_for_range(time_range)
    data = []
    total = 12000

    for i in range(days):
        date = datetime.now() - timedelta(days=days - i)
        added = _random_int(5, 20)
        removed = _random_int(2, 10)
        total += added - removed

        data.append(
            {
                "date": date.isoformat(),
                "total": total,
                "added": added,
                "removed": removed,
            }
        )

    total_added = sum(d["added"] for d in data)
    total_removed = sum(d["removed"] for d in data)

    return DependencyGrowthData(
        period=time_range.value,
        data=data,
        total_added=total_added,
        total_removed=total_removed,
        net_change=total_added - total_removed,
    )


@router.get("/ecosystem-distribution", response_model=EcosystemDistributionData)
async def get_ecosystem_distribution(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> EcosystemDistributionData:
    """Get ecosystem distribution data.

    Shows breakdown of dependencies by ecosystem (Maven, npm, PyPI, etc.).
    """
    ecosystems = [
        {"name": "Maven", "count": 4850, "color": "#ef4444", "icon": "java"},
        {"name": "npm", "count": 4200, "color": "#f97316", "icon": "javascript"},
        {"name": "PyPI", "count": 2100, "color": "#3b82f6", "icon": "python"},
        {"name": "Go", "count": 850, "color": "#10b981", "icon": "go"},
        {"name": "NuGet", "count": 450, "color": "#8b5cf6", "icon": "csharp"},
        {"name": "Cargo", "count": 280, "color": "#f59e0b", "icon": "rust"},
        {"name": "Composer", "count": 117, "color": "#6366f1", "icon": "php"},
    ]

    total = sum(e["count"] for e in ecosystems)

    return EcosystemDistributionData(
        ecosystems=ecosystems,
        total=total,
    )


@router.get("/top-risks", response_model=TopRisksData)
async def get_top_risks(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> TopRisksData:
    """Get top risks data.

    Returns the highest-risk packages based on vulnerability count,
    severity, and usage impact.
    """
    risks = [
        {
            "package": "log4j:log4j-core",
            "version": "2.14.1",
            "risk_score": 98.5,
            "vulnerabilities": 5,
            "highest_severity": "critical",
            "affected_projects": 12,
            "first_detected": "2021-12-10",
            "exploit_available": True,
        },
        {
            "package": "lodash:lodash",
            "version": "4.17.15",
            "risk_score": 85.2,
            "vulnerabilities": 3,
            "highest_severity": "high",
            "affected_projects": 8,
            "first_detected": "2021-01-15",
            "exploit_available": False,
        },
        {
            "package": "spring-framework:spring-core",
            "version": "5.3.15",
            "risk_score": 92.0,
            "vulnerabilities": 2,
            "highest_severity": "critical",
            "affected_projects": 15,
            "first_detected": "2022-03-31",
            "exploit_available": True,
        },
        {
            "package": "requests:requests",
            "version": "2.25.0",
            "risk_score": 65.3,
            "vulnerabilities": 2,
            "highest_severity": "medium",
            "affected_projects": 6,
            "first_detected": "2023-03-15",
            "exploit_available": False,
        },
    ]

    total_risk_score = sum(r["risk_score"] for r in risks)

    return TopRisksData(
        risks=risks[:limit],
        total_risk_score=total_risk_score,
    )


@router.get("/mttr", response_model=MTTRData)
async def get_mttr_widget(
    time_range: TimeRange = TimeRange.MONTH,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> MTTRData:
    """Get Mean Time To Remediate widget data.

    Shows current MTTR with trend and improvement rate.
    """
    current_mttr = 2.4  # minutes
    target_mttr = 5.0

    # Generate trend data
    trend = []
    for i in range(30):
        date = datetime.now() - timedelta(days=30 - i)
        # Simulate improvement
        value = 3.5 - (i * 0.04) + _random_noise() * 0.2
        trend.append(
            {
                "date": date.isoformat(),
                "mttr": max(1, value),
            }
        )

    improvement_rate = ((3.5 - current_mttr) / 3.5) * 100

    return MTTRData(
        current_mttr=current_mttr,
        target_mttr=target_mttr,
        trend=trend,
        improvement_rate=improvement_rate,
    )


@router.get("/license-compliance", response_model=LicenseComplianceData)
async def get_license_compliance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> LicenseComplianceData:
    """Get license compliance widget data.

    Shows breakdown of license compliance status.
    """
    violations = [
        {
            "package": "npm:babel-core",
            "license": "MIT",
            "issue": "License file missing",
            "severity": "low",
        },
        {
            "package": "maven:commons-logging",
            "license": "Apache-2.0",
            "issue": "Conflicting license declaration",
            "severity": "medium",
        },
    ]

    return LicenseComplianceData(
        compliant=12550,
        non_compliant=250,
        unknown=47,
        total=12847,
        violations=violations,
    )


@router.get("/deployment-risk", response_model=DeploymentRiskData)
async def get_deployment_risk(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> DeploymentRiskData:
    """Get deployment risk assessment for a project.

    Evaluates whether a deployment should be blocked due to security concerns.
    """
    risk_factors = [
        {
            "type": "critical_vulnerability",
            "description": "2 critical vulnerabilities in direct dependencies",
            "severity": "critical",
        },
        {
            "type": "outdated_dependencies",
            "description": "15 dependencies more than 6 months outdated",
            "severity": "medium",
        },
        {
            "type": "license_violation",
            "description": "1 license policy violation detected",
            "severity": "low",
        },
    ]

    recommendations = [
        "Update log4j-core to 2.17.1 or later",
        "Review and update outdated dependencies",
        "Resolve license violation for babel-core",
    ]

    return DeploymentRiskData(
        risk_level="high",
        blocked_deployments=2,
        risk_factors=risk_factors,
        recommendations=recommendations,
    )


# ==================== Helper Functions ====================


def _get_days_for_range(time_range: TimeRange) -> int:
    """Get number of days for a time range."""
    mapping = {
        TimeRange.HOUR: 1,
        TimeRange.DAY: 1,
        TimeRange.WEEK: 7,
        TimeRange.MONTH: 30,
        TimeRange.QUARTER: 90,
        TimeRange.YEAR: 365,
    }
    return mapping.get(time_range, 30)


def _random_vulnerability_count(severity: str, day_offset: int) -> int:
    """Generate random vulnerability count for mock data."""
    base = {"critical": 5, "high": 15, "medium": 25, "low": 35}[severity]
    return max(0, base + _random_int(-10, 10))


def _random_int(min_val: int, max_val: int) -> int:
    """Generate random integer in range."""
    import random

    return random.randint(min_val, max_val)


def _random_noise() -> float:
    """Generate small random noise."""
    import random

    return random.uniform(-1, 1)


def _parse_effort(effort_str: str) -> int:
    """Parse effort string to minutes."""
    effort_str = effort_str.lower()
    if "hour" in effort_str:
        return int(effort_str.split()[0]) * 60
    if "min" in effort_str:
        return int(effort_str.split()[0])
    return 30  # default


def _format_duration(minutes: int) -> str:
    """Format minutes to human-readable duration."""
    if minutes < 60:
        return f"{minutes} min"
    hours = minutes // 60
    mins = minutes % 60
    if hours < 8:
        return f"{hours}h {mins}m"
    days = hours // 8
    hours = hours % 8
    return f"{days}d {hours}h"


# Metric generators


def _get_total_dependencies_metric(
    time_range: TimeRange,
    organization_id: Optional[str],
    project_id: Optional[str],
) -> MetricCardData:
    """Generate total dependencies metric."""
    value = 12847
    change = 12.0
    change_direction = "up"

    trend = []
    for i in range(_get_days_for_range(time_range)):
        date = datetime.now() - timedelta(days=_get_days_for_range(time_range) - i)
        trend.append(
            {
                "date": date.isoformat(),
                "value": value - (100 - i * 5),
            }
        )

    return MetricCardData(
        title="Total Dependencies",
        value=value,
        change=change,
        change_direction=change_direction,
        trend=trend,
        status="neutral",
    )


def _get_total_vulnerabilities_metric(
    time_range: TimeRange,
    organization_id: Optional[str],
    project_id: Optional[str],
) -> MetricCardData:
    """Generate total vulnerabilities metric."""
    value = 23
    change = -3.0
    change_direction = "down"

    trend = []
    for i in range(_get_days_for_range(time_range)):
        date = datetime.now() - timedelta(days=_get_days_for_range(time_range) - i)
        trend.append(
            {
                "date": date.isoformat(),
                "value": max(10, value + (30 - i)),
            }
        )

    return MetricCardData(
        title="Vulnerabilities",
        value=value,
        change=change,
        change_direction=change_direction,
        trend=trend,
        threshold=50,
        status="warning",
    )


def _get_compliance_score_metric(
    time_range: TimeRange,
    organization_id: Optional[str],
    project_id: Optional[str],
) -> MetricCardData:
    """Generate compliance score metric."""
    value = 94
    change = 2.5
    change_direction = "up"

    trend = []
    for i in range(_get_days_for_range(time_range)):
        date = datetime.now() - timedelta(days=_get_days_for_range(time_range) - i)
        trend.append(
            {
                "date": date.isoformat(),
                "value": min(100, value - (10 - i * 0.3)),
            }
        )

    return MetricCardData(
        title="Compliance Score",
        value=value,
        unit="%",
        change=change,
        change_direction=change_direction,
        trend=trend,
        threshold=90,
        status="success",
    )


def _get_mttr_metric(
    time_range: TimeRange,
    organization_id: Optional[str],
    project_id: Optional[str],
) -> MetricCardData:
    """Generate MTTR metric."""
    value = 2.4
    change = -15.0
    change_direction = "down"

    trend = []
    for i in range(_get_days_for_range(time_range)):
        date = datetime.now() - timedelta(days=_get_days_for_range(time_range) - i)
        trend.append(
            {
                "date": date.isoformat(),
                "value": min(10, value + (8 - i * 0.2)),
            }
        )

    return MetricCardData(
        title="Mean Time to Fix",
        value=value,
        unit="min",
        change=change,
        change_direction=change_direction,
        trend=trend,
        threshold=5,
        status="success",
    )


def _get_active_scans_metric(
    time_range: TimeRange,
    organization_id: Optional[str],
    project_id: Optional[str],
) -> MetricCardData:
    """Generate active scans metric."""
    value = 156
    return MetricCardData(
        title="Active Scans",
        value=value,
        status="neutral",
    )


def _get_policy_violations_metric(
    time_range: TimeRange,
    organization_id: Optional[str],
    project_id: Optional[str],
) -> MetricCardData:
    """Generate policy violations metric."""
    value = 8
    return MetricCardData(
        title="Policy Violations",
        value=value,
        threshold=10,
        status="warning",
    )


def _get_default_metric(
    time_range: TimeRange,
    organization_id: Optional[str],
    project_id: Optional[str],
) -> MetricCardData:
    """Generate default metric."""
    return MetricCardData(
        title="Metric",
        value=0,
        status="neutral",
    )
