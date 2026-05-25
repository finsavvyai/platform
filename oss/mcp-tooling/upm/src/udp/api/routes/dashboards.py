"""
Dashboard API routes for Universal Dependency Platform.

Provides comprehensive security dashboards with vulnerability trends,
compliance status tracking, risk metrics, and interactive filtering.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from udp.api.deps import get_current_user
from udp.core.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dashboards", tags=["dashboards"])


class DashboardMetrics(BaseModel):
    """Dashboard metrics model."""

    total_packages: int
    vulnerable_packages: int
    policy_violations: int
    license_violations: int
    compliance_score: float
    last_scan: Optional[datetime]
    trend_data: dict[str, Any]


class ExecutiveDashboard(BaseModel):
    """Executive dashboard model."""

    organization_id: UUID
    organization_name: str
    overall_health_score: float
    risk_level: str
    compliance_status: str
    key_metrics: DashboardMetrics
    top_risks: list[dict[str, Any]]
    recommendations: list[str]
    last_updated: datetime


class TeamDashboard(BaseModel):
    """Team dashboard model."""

    team_id: UUID
    team_name: str
    project_count: int
    package_count: int
    vulnerability_count: int
    policy_violation_count: int
    recent_activities: list[dict[str, Any]]
    pending_approvals: int
    sla_compliance: float
    last_updated: datetime


class DeveloperDashboard(BaseModel):
    """Developer dashboard model."""

    user_id: UUID
    project_count: int
    package_count: int
    vulnerability_count: int
    pending_approvals: int
    recent_scans: list[dict[str, Any]]
    favorite_packages: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]
    last_updated: datetime


@router.get("/executive/{organization_id}", response_model=ExecutiveDashboard)
async def get_executive_dashboard(
    organization_id: UUID, current_user: User = Depends(get_current_user)
) -> ExecutiveDashboard:
    """Get executive dashboard with high-level metrics and insights."""
    logger.info(f"Generating executive dashboard for organization {organization_id}")

    try:
        # Mock executive dashboard data
        dashboard_data = await _generate_executive_dashboard_data(organization_id)
        return ExecutiveDashboard(**dashboard_data)

    except Exception as e:
        logger.error(f"Failed to generate executive dashboard: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to generate executive dashboard"
        )


@router.get("/team/{team_id}", response_model=TeamDashboard)
async def get_team_dashboard(
    team_id: UUID, current_user: User = Depends(get_current_user)
) -> TeamDashboard:
    """Get team dashboard with project-specific metrics."""
    logger.info(f"Generating team dashboard for team {team_id}")

    try:
        # Mock team dashboard data
        dashboard_data = await _generate_team_dashboard_data(team_id)
        return TeamDashboard(**dashboard_data)

    except Exception as e:
        logger.error(f"Failed to generate team dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate team dashboard")


@router.get("/developer/{user_id}", response_model=DeveloperDashboard)
async def get_developer_dashboard(
    user_id: UUID, current_user: User = Depends(get_current_user)
) -> DeveloperDashboard:
    """Get developer dashboard with personal metrics and recommendations."""
    logger.info(f"Generating developer dashboard for user {user_id}")

    try:
        # Mock developer dashboard data
        dashboard_data = await _generate_developer_dashboard_data(user_id)
        return DeveloperDashboard(**dashboard_data)

    except Exception as e:
        logger.error(f"Failed to generate developer dashboard: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to generate developer dashboard"
        )


@router.get("/metrics/trends")
async def get_metrics_trends(
    organization_id: UUID = Query(...),
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get metrics trends over time."""
    logger.info(
        f"Getting metrics trends for organization {organization_id} over {days} days"
    )

    try:
        # Mock trends data
        trends_data = await _generate_trends_data(organization_id, days)
        return trends_data

    except Exception as e:
        logger.error(f"Failed to get metrics trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to get metrics trends")


@router.get("/alerts")
async def get_active_alerts(
    organization_id: UUID = Query(...),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get active security and compliance alerts."""
    logger.info(f"Getting active alerts for organization {organization_id}")

    try:
        # Mock alerts data
        alerts_data = await _generate_alerts_data(organization_id, severity)
        return alerts_data

    except Exception as e:
        logger.error(f"Failed to get active alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to get active alerts")


@router.get("/compliance/status")
async def get_compliance_status(
    organization_id: UUID = Query(...), current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """Get compliance status and requirements."""
    logger.info(f"Getting compliance status for organization {organization_id}")

    try:
        # Mock compliance data
        compliance_data = await _generate_compliance_data(organization_id)
        return compliance_data

    except Exception as e:
        logger.error(f"Failed to get compliance status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get compliance status")


async def _generate_executive_dashboard_data(organization_id: UUID) -> dict[str, Any]:
    """Generate executive dashboard data."""
    return {
        "organization_id": organization_id,
        "organization_name": "Acme Corporation",
        "overall_health_score": 85.5,
        "risk_level": "medium",
        "compliance_status": "compliant",
        "key_metrics": {
            "total_packages": 1250,
            "vulnerable_packages": 45,
            "policy_violations": 12,
            "license_violations": 3,
            "compliance_score": 92.0,
            "last_scan": datetime.utcnow() - timedelta(hours=2),
            "trend_data": {
                "vulnerabilities_trend": "decreasing",
                "compliance_trend": "improving",
                "package_growth": "stable",
            },
        },
        "top_risks": [
            {
                "type": "security",
                "severity": "high",
                "description": "5 critical vulnerabilities in production dependencies",
                "affected_packages": 5,
                "recommended_action": "Update vulnerable packages immediately",
            },
            {
                "type": "license",
                "severity": "medium",
                "description": "GPL-licensed packages in commercial product",
                "affected_packages": 3,
                "recommended_action": "Review license compatibility",
            },
        ],
        "recommendations": [
            "Implement automated vulnerability scanning in CI/CD pipeline",
            "Establish regular dependency review process",
            "Create security training program for development teams",
            "Set up real-time monitoring for critical vulnerabilities",
        ],
        "last_updated": datetime.utcnow(),
    }


async def _generate_team_dashboard_data(team_id: UUID) -> dict[str, Any]:
    """Generate team dashboard data."""
    return {
        "team_id": team_id,
        "team_name": "Backend Development Team",
        "project_count": 8,
        "package_count": 320,
        "vulnerability_count": 12,
        "policy_violation_count": 4,
        "recent_activities": [
            {
                "type": "vulnerability_scan",
                "timestamp": datetime.utcnow() - timedelta(hours=1),
                "description": "Vulnerability scan completed for project-api",
                "status": "completed",
            },
            {
                "type": "approval_request",
                "timestamp": datetime.utcnow() - timedelta(hours=3),
                "description": "Approval requested for lodash@4.17.21",
                "status": "pending",
            },
            {
                "type": "policy_violation",
                "timestamp": datetime.utcnow() - timedelta(hours=6),
                "description": "License violation detected in auth-service",
                "status": "resolved",
            },
        ],
        "pending_approvals": 3,
        "sla_compliance": 95.0,
        "last_updated": datetime.utcnow(),
    }


async def _generate_developer_dashboard_data(user_id: UUID) -> dict[str, Any]:
    """Generate developer dashboard data."""
    return {
        "user_id": user_id,
        "project_count": 3,
        "package_count": 85,
        "vulnerability_count": 2,
        "pending_approvals": 1,
        "recent_scans": [
            {
                "project_name": "user-service",
                "timestamp": datetime.utcnow() - timedelta(hours=2),
                "vulnerabilities_found": 1,
                "status": "completed",
            },
            {
                "project_name": "payment-api",
                "timestamp": datetime.utcnow() - timedelta(days=1),
                "vulnerabilities_found": 0,
                "status": "completed",
            },
        ],
        "favorite_packages": [
            {
                "name": "express",
                "version": "4.18.2",
                "ecosystem": "npm",
                "usage_count": 5,
            },
            {
                "name": "lodash",
                "version": "4.17.21",
                "ecosystem": "npm",
                "usage_count": 3,
            },
        ],
        "recommendations": [
            {
                "type": "security",
                "title": "Update vulnerable dependency",
                "description": "Update axios to version 1.6.0 to fix CVE-2023-45853",
                "priority": "high",
                "package": "axios",
            },
            {
                "type": "license",
                "title": "Review license compatibility",
                "description": "Package 'moment' uses MIT license - ensure compatibility",
                "priority": "low",
                "package": "moment",
            },
        ],
        "last_updated": datetime.utcnow(),
    }


async def _generate_trends_data(organization_id: UUID, days: int) -> dict[str, Any]:
    """Generate trends data."""
    return {
        "period_days": days,
        "vulnerability_trend": {
            "total": [45, 42, 38, 35, 32, 30, 28],
            "critical": [5, 4, 3, 2, 2, 1, 1],
            "high": [15, 14, 12, 10, 8, 7, 6],
            "medium": [20, 19, 18, 18, 17, 17, 16],
            "low": [5, 5, 5, 5, 5, 5, 5],
        },
        "compliance_trend": {
            "score": [85, 87, 89, 91, 92, 93, 94],
            "policy_violations": [15, 12, 10, 8, 6, 4, 3],
            "license_violations": [8, 6, 5, 4, 3, 2, 1],
        },
        "package_growth": {
            "total_packages": [1000, 1050, 1100, 1150, 1200, 1220, 1250],
            "new_packages": [50, 50, 50, 50, 20, 30, 0],
            "removed_packages": [0, 0, 0, 0, 0, 0, 0],
        },
        "scan_frequency": {
            "daily_scans": [5, 6, 7, 8, 9, 10, 11],
            "weekly_scans": [2, 2, 2, 2, 2, 2, 2],
            "monthly_scans": [1, 1, 1, 1, 1, 1, 1],
        },
    }


async def _generate_alerts_data(
    organization_id: UUID, severity: Optional[str]
) -> list[dict[str, Any]]:
    """Generate alerts data."""
    alerts = [
        {
            "id": "alert-001",
            "type": "vulnerability",
            "severity": "critical",
            "title": "Critical vulnerability in production dependency",
            "description": "CVE-2024-1234 affects lodash@4.17.20",
            "affected_packages": ["lodash@4.17.20"],
            "created_at": datetime.utcnow() - timedelta(hours=2),
            "status": "active",
            "assigned_to": "security-team",
        },
        {
            "id": "alert-002",
            "type": "license",
            "severity": "high",
            "title": "License violation detected",
            "description": "GPL-licensed package in commercial product",
            "affected_packages": ["gpl-package@1.0.0"],
            "created_at": datetime.utcnow() - timedelta(hours=6),
            "status": "active",
            "assigned_to": "legal-team",
        },
        {
            "id": "alert-003",
            "type": "policy",
            "severity": "medium",
            "title": "Policy violation in new dependency",
            "description": "Package exceeds age limit policy",
            "affected_packages": ["old-package@1.0.0"],
            "created_at": datetime.utcnow() - timedelta(hours=12),
            "status": "resolved",
            "assigned_to": "dev-team",
        },
    ]

    if severity:
        alerts = [alert for alert in alerts if alert["severity"] == severity]

    return alerts


async def _generate_compliance_data(organization_id: UUID) -> dict[str, Any]:
    """Generate compliance data."""
    return {
        "overall_status": "compliant",
        "compliance_score": 92.0,
        "requirements": [
            {
                "name": "SOC 2 Type II",
                "status": "compliant",
                "score": 95.0,
                "last_audit": datetime.utcnow() - timedelta(days=30),
                "next_audit": datetime.utcnow() + timedelta(days=335),
            },
            {
                "name": "ISO 27001",
                "status": "compliant",
                "score": 90.0,
                "last_audit": datetime.utcnow() - timedelta(days=60),
                "next_audit": datetime.utcnow() + timedelta(days=305),
            },
            {
                "name": "GDPR",
                "status": "compliant",
                "score": 88.0,
                "last_audit": datetime.utcnow() - timedelta(days=15),
                "next_audit": datetime.utcnow() + timedelta(days=350),
            },
        ],
        "violations": [
            {
                "requirement": "SOC 2 Type II",
                "violation_type": "access_control",
                "description": "Insufficient access logging for dependency management",
                "severity": "medium",
                "status": "open",
                "created_at": datetime.utcnow() - timedelta(days=5),
            }
        ],
        "recommendations": [
            "Implement comprehensive audit logging",
            "Enhance access control mechanisms",
            "Regular compliance training for teams",
        ],
    }
