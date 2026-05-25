"""
Analytics API endpoints.

REST API for dependency analytics, metrics,
and insights generation.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.database import get_async_session
from udp.infrastructure.models import (
    DependencyGraphModel,
    PackageModel,
    VulnerabilityModel,
)

logger = structlog.get_logger()
router = APIRouter()


@router.get("/overview")
async def get_analytics_overview(
    organization_id: UUID,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Get analytics overview for an organization.

    Args:
        organization_id: Organization ID
        days: Number of days to analyze

    Returns:
        Analytics overview with key metrics
    """
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Get package statistics
        package_stats = await _get_package_statistics(db, organization_id, start_date, end_date)

        # Get vulnerability statistics
        vulnerability_stats = await _get_vulnerability_statistics(db, organization_id, start_date, end_date)

        # Get dependency graph statistics
        dependency_stats = await _get_dependency_statistics(db, organization_id, start_date, end_date)

        return {
            "organization_id": str(organization_id),
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "package_statistics": package_stats,
            "vulnerability_statistics": vulnerability_stats,
            "dependency_statistics": dependency_stats,
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Failed to get analytics overview", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get analytics overview"
        )


@router.get("/ecosystem-breakdown")
async def get_ecosystem_breakdown(
    organization_id: UUID,
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Get breakdown of packages by ecosystem.

    Args:
        organization_id: Organization ID

    Returns:
        Ecosystem breakdown statistics
    """
    try:
        # Get ecosystem statistics
        result = await db.execute(
            select(
                PackageModel.ecosystem,
                func.count(PackageModel.id).label("package_count"),
                func.count(func.distinct(PackageModel.name)).label("unique_packages")
            ).where(
                and_(
                    PackageModel.is_deleted == False
                )
            ).group_by(PackageModel.ecosystem)
        )

        ecosystem_stats = []
        for row in result:
            ecosystem_stats.append({
                "ecosystem": row.ecosystem.value,
                "package_count": row.package_count,
                "unique_packages": row.unique_packages
            })

        return {
            "organization_id": str(organization_id),
            "ecosystem_breakdown": ecosystem_stats,
            "total_ecosystems": len(ecosystem_stats),
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Failed to get ecosystem breakdown", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get ecosystem breakdown"
        )


async def _get_package_statistics(db: AsyncSession, organization_id: UUID, start_date: datetime, end_date: datetime) -> dict[str, Any]:
    """Get package statistics for the given period."""
    # Total packages
    total_result = await db.execute(
        select(func.count(PackageModel.id)).where(
            and_(
                PackageModel.is_deleted == False
            )
        )
    )
    total_packages = total_result.scalar() or 0

    # New packages in period
    new_result = await db.execute(
        select(func.count(PackageModel.id)).where(
            and_(
                PackageModel.is_deleted == False,
                PackageModel.created_at >= start_date,
                PackageModel.created_at <= end_date
            )
        )
    )
    new_packages = new_result.scalar() or 0

    return {
        "total_packages": total_packages,
        "new_packages": new_packages,
        "growth_rate": (new_packages / max(total_packages - new_packages, 1)) * 100 if total_packages > new_packages else 0
    }


async def _get_vulnerability_statistics(db: AsyncSession, organization_id: UUID, start_date: datetime, end_date: datetime) -> dict[str, Any]:
    """Get vulnerability statistics for the given period."""
    # Total vulnerabilities
    total_result = await db.execute(
        select(func.count(VulnerabilityModel.id)).where(
            VulnerabilityModel.is_deleted == False
        )
    )
    total_vulnerabilities = total_result.scalar() or 0

    # High-risk vulnerabilities
    high_risk_result = await db.execute(
        select(func.count(VulnerabilityModel.id)).where(
            and_(
                VulnerabilityModel.is_deleted == False,
                VulnerabilityModel.severity.in_(["critical", "high"])
            )
        )
    )
    high_risk_vulnerabilities = high_risk_result.scalar() or 0

    return {
        "total_vulnerabilities": total_vulnerabilities,
        "high_risk_vulnerabilities": high_risk_vulnerabilities,
        "risk_percentage": (high_risk_vulnerabilities / max(total_vulnerabilities, 1)) * 100
    }


async def _get_dependency_statistics(db: AsyncSession, organization_id: UUID, start_date: datetime, end_date: datetime) -> dict[str, Any]:
    """Get dependency statistics for the given period."""
    # Total dependency graphs
    total_result = await db.execute(
        select(func.count(DependencyGraphModel.id)).where(
            and_(
                DependencyGraphModel.is_deleted == False,
                DependencyGraphModel.organization_id == organization_id
            )
        )
    )
    total_graphs = total_result.scalar() or 0

    # Graphs with conflicts
    conflict_result = await db.execute(
        select(func.count(DependencyGraphModel.id)).where(
            and_(
                DependencyGraphModel.is_deleted == False,
                DependencyGraphModel.organization_id == organization_id,
                DependencyGraphModel.is_resolved == False
            )
        )
    )
    graphs_with_conflicts = conflict_result.scalar() or 0

    return {
        "total_dependency_graphs": total_graphs,
        "graphs_with_conflicts": graphs_with_conflicts,
        "conflict_percentage": (graphs_with_conflicts / max(total_graphs, 1)) * 100
    }
