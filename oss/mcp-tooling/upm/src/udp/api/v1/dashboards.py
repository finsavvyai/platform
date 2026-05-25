"""Dashboard API endpoints for security visualizations and metrics."""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...core.database import get_async_db
from ...core.schemas.dashboard import (
    DashboardExport,
    DashboardFilters,
    DashboardLayout,
    DashboardShare,
    HeatmapData,
    SecurityAlert,
    SecurityDashboardResponse,
    TimeRange,
    VulnerabilityTrend,
)
from ...security.rbac import Permission, require_permissions
from ...services.dashboard_service import DashboardService

settings = get_settings()
router = APIRouter()


@router.get(
    "/security",
    response_model=SecurityDashboardResponse,
    summary="Get comprehensive security dashboard",
    description="Retrieve a complete security dashboard with vulnerability trends, compliance status, risk metrics, and KPIs",
)
@require_permissions([Permission.VIEW_DASHBOARDS])
async def get_security_dashboard(
    organization_id: Optional[str] = Query(
        None, description="Filter by organization ID"
    ),
    project_ids: Optional[str] = Query(
        None, description="Comma-separated list of project IDs"
    ),
    time_range: TimeRange = Query(
        TimeRange.LAST_30_DAYS, description="Time range for data"
    ),
    severity_levels: Optional[str] = Query(
        None, description="Comma-separated severity levels to include"
    ),
    compliance_frameworks: Optional[str] = Query(
        None, description="Comma-separated compliance frameworks"
    ),
    min_risk_score: Optional[float] = Query(
        None, ge=0, le=10, description="Minimum risk score filter"
    ),
    max_risk_score: Optional[float] = Query(
        None, ge=0, le=10, description="Maximum risk score filter"
    ),
    status: Optional[str] = Query(None, description="Comma-separated status values"),
    db: AsyncSession = Depends(get_async_db),
) -> SecurityDashboardResponse:
    """Get comprehensive security dashboard data."""

    dashboard_service = DashboardService(db)

    # Parse filters
    filters = DashboardFilters()

    if project_ids:
        filters.project_ids = [
            pid.strip() for pid in project_ids.split(",") if pid.strip()
        ]

    if severity_levels:
        filters.severity_levels = [
            s.strip() for s in severity_levels.split(",") if s.strip()
        ]

    if compliance_frameworks:
        filters.compliance_frameworks = [
            f.strip() for f in compliance_frameworks.split(",") if f.strip()
        ]

    if min_risk_score is not None:
        filters.min_risk_score = min_risk_score

    if max_risk_score is not None:
        filters.max_risk_score = max_risk_score

    if status:
        filters.status = [s.strip() for s in status.split(",") if s.strip()]

    # Get dashboard data
    dashboard_data = await dashboard_service.get_security_dashboard(
        organization_id=organization_id,
        project_ids=filters.project_ids,
        time_range=time_range,
        filters=filters,
    )

    return dashboard_data


@router.get(
    "/vulnerabilities/trends",
    response_model=list[VulnerabilityTrend],
    summary="Get vulnerability trends over time",
    description="Retrieve vulnerability trend data for visualization in charts",
)
@require_permissions([Permission.VIEW_DASHBOARDS])
async def get_vulnerability_trends(
    organization_id: Optional[str] = Query(None),
    project_ids: Optional[str] = Query(None),
    time_range: TimeRange = Query(TimeRange.LAST_30_DAYS),
    severity_levels: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
) -> list[VulnerabilityTrend]:
    """Get vulnerability trends data."""

    dashboard_service = DashboardService(db)

    filters = DashboardFilters()
    if project_ids:
        filters.project_ids = [
            pid.strip() for pid in project_ids.split(",") if pid.strip()
        ]
    if severity_levels:
        filters.severity_levels = [
            s.strip() for s in severity_levels.split(",") if s.strip()
        ]

    start_date = dashboard_service._get_start_date(time_range, datetime.utcnow())
    end_date = datetime.utcnow()

    trends = await dashboard_service._get_vulnerability_trends(
        organization_id, filters.project_ids, start_date, end_date, filters
    )

    return trends


@router.get(
    "/risk/heatmap",
    response_model=HeatmapData,
    summary="Get risk heatmap data",
    description="Retrieve risk data formatted for heatmap visualization",
)
@require_permissions([Permission.VIEW_DASHBOARDS])
async def get_risk_heatmap(
    organization_id: Optional[str] = Query(None),
    project_ids: Optional[str] = Query(None),
    heatmap_type: str = Query("project_severity", description="Type of heatmap data"),
    db: AsyncSession = Depends(get_async_db),
) -> HeatmapData:
    """Get risk heatmap visualization data."""

    dashboard_service = DashboardService(db)

    if project_ids:
        project_ids_list = [
            pid.strip() for pid in project_ids.split(",") if pid.strip()
        ]
    else:
        project_ids_list = None

    if heatmap_type == "project_severity":
        # Get risk scores by project and severity
        from ...services.dashboard_service_extensions import DashboardServiceExtensions

        extensions = DashboardServiceExtensions(db)
        heatmap_data = await extensions.get_project_risk_heatmap(
            organization_id, project_ids_list
        )
    elif heatmap_type == "compliance_risk":
        # Get compliance risk by framework
        from ...services.dashboard_service_extensions import DashboardServiceExtensions

        extensions = DashboardServiceExtensions(db)
        heatmap_data = await extensions.get_compliance_risk_heatmap(
            organization_id, project_ids_list
        )
    else:
        raise HTTPException(
            status_code=400, detail=f"Invalid heatmap type: {heatmap_type}"
        )

    return heatmap_data


@router.get(
    "/alerts",
    response_model=list[SecurityAlert],
    summary="Get security alerts",
    description="Retrieve active security alerts requiring attention",
)
@require_permissions([Permission.VIEW_DASHBOARDS])
async def get_security_alerts(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_async_db),
) -> list[SecurityAlert]:
    """Get security alerts."""

    # This would integrate with the notification service
    # For now, return a placeholder response
    alerts = [
        SecurityAlert(
            id="1",
            alert_type="vulnerability",
            severity="critical",
            title="Critical vulnerability detected",
            message="CVE-2024-1234 detected in project X with CVSS 9.8",
            project_id="proj-1",
            project_name="Project X",
            vulnerability_id="CVE-2024-1234",
            action_required=True,
            created_at=datetime.utcnow(),
            metadata={"package": "example-package", "version": "1.0.0"},
        )
    ]

    return alerts


@router.post(
    "/export",
    summary="Export dashboard data",
    description="Export dashboard data in various formats (PDF, CSV, JSON)",
)
@require_permissions([Permission.EXPORT_DASHBOARDS])
async def export_dashboard(
    export_config: DashboardExport,
    organization_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Export dashboard data."""

    dashboard_service = DashboardService(db)

    # Generate the export
    if export_config.format == "json":
        # Return JSON data directly
        dashboard_data = await dashboard_service.get_security_dashboard(
            organization_id=organization_id,
            project_ids=export_config.filters.project_ids
            if export_config.filters
            else None,
            time_range=export_config.time_range,
            filters=export_config.filters,
        )

        return JSONResponse(
            content=dashboard_data.dict(),
            headers={
                "Content-Disposition": f"attachment; filename=security_dashboard_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            },
        )

    elif export_config.format == "csv":
        # Generate CSV export
        csv_data = await dashboard_service.export_to_csv(
            organization_id=organization_id,
            time_range=export_config.time_range,
            filters=export_config.filters,
        )

        return StreamingResponse(
            iter([csv_data]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=security_dashboard_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            },
        )

    elif export_config.format == "pdf":
        # Queue PDF generation
        export_id = await dashboard_service.queue_pdf_export(
            organization_id=organization_id,
            time_range=export_config.time_range,
            filters=export_config.filters,
            include_charts=export_config.include_charts,
            background_tasks=background_tasks,
        )

        return {
            "export_id": export_id,
            "status": "queued",
            "message": "PDF export is being generated. You will be notified when it's ready.",
        }

    else:
        raise HTTPException(
            status_code=400, detail=f"Unsupported export format: {export_config.format}"
        )


@router.post(
    "/share",
    summary="Share dashboard",
    description="Create a shareable link for the dashboard",
)
@require_permissions([Permission.SHARE_DASHBOARDS])
async def share_dashboard(
    share_config: DashboardShare, db: AsyncSession = Depends(get_async_db)
) -> dict[str, Any]:
    """Create dashboard share link."""

    dashboard_service = DashboardService(db)

    # Generate share link
    share_link = await dashboard_service.create_share_link(
        dashboard_id=share_config.dashboard_id,
        share_type=share_config.share_type,
        recipients=share_config.recipients,
        expires_at=share_config.expires_at,
        permissions=share_config.permissions,
    )

    return {
        "share_id": share_link.id,
        "share_url": f"{settings.BASE_URL}/shared/dashboards/{share_link.id}",
        "expires_at": share_link.expires_at,
        "permissions": share_link.permissions,
    }


@router.get(
    "/layouts",
    response_model=list[DashboardLayout],
    summary="Get dashboard layouts",
    description="Retrieve available dashboard layouts",
)
@require_permissions([Permission.VIEW_DASHBOARDS])
async def get_dashboard_layouts(
    organization_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
) -> list[DashboardLayout]:
    """Get dashboard layouts."""

    dashboard_service = DashboardService(db)

    layouts = await dashboard_service.get_dashboard_layouts(organization_id)

    return layouts


@router.post(
    "/layouts",
    response_model=DashboardLayout,
    summary="Create dashboard layout",
    description="Create a new dashboard layout",
)
@require_permissions([Permission.EDIT_DASHBOARDS])
async def create_dashboard_layout(
    layout: DashboardLayout, db: AsyncSession = Depends(get_async_db)
) -> DashboardLayout:
    """Create dashboard layout."""

    dashboard_service = DashboardService(db)

    new_layout = await dashboard_service.create_dashboard_layout(layout)

    return new_layout


@router.get(
    "/metrics/realtime",
    summary="Get real-time metrics",
    description="Retrieve real-time security metrics for live dashboard updates",
)
@require_permissions([Permission.VIEW_DASHBOARDS])
async def get_realtime_metrics(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    metrics: Optional[str] = Query(
        None, description="Comma-separated list of metrics to retrieve"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> dict[str, Any]:
    """Get real-time security metrics."""

    dashboard_service = DashboardService(db)

    requested_metrics = []
    if metrics:
        requested_metrics = [m.strip() for m in metrics.split(",") if m.strip()]

    realtime_data = await dashboard_service.get_realtime_metrics(
        organization_id=organization_id,
        project_id=project_id,
        metrics=requested_metrics,
    )

    return {"timestamp": datetime.utcnow().isoformat(), "metrics": realtime_data}


@router.get(
    "/projects/{project_id}/security-score",
    summary="Get project security score",
    description="Retrieve detailed security score breakdown for a specific project",
)
@require_permissions([Permission.VIEW_PROJECTS])
async def get_project_security_score(
    project_id: str, db: AsyncSession = Depends(get_async_db)
) -> dict[str, Any]:
    """Get detailed security score for a project."""

    dashboard_service = DashboardService(db)

    security_score = await dashboard_service.get_project_security_score_detail(
        project_id
    )

    return security_score


@router.get(
    "/compliance/{framework}/summary",
    summary="Get compliance summary",
    description="Retrieve compliance summary for a specific framework",
)
@require_permissions([Permission.VIEW_COMPLIANCE])
async def get_compliance_summary(
    framework: str,
    organization_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
) -> dict[str, Any]:
    """Get compliance framework summary."""

    dashboard_service = DashboardService(db)

    compliance_summary = await dashboard_service.get_compliance_framework_summary(
        framework=framework, organization_id=organization_id
    )

    return compliance_summary


@router.post(
    "/alerts/{alert_id}/acknowledge",
    summary="Acknowledge security alert",
    description="Mark a security alert as acknowledged",
)
@require_permissions([Permission.MANAGE_ALERTS])
async def acknowledge_alert(
    alert_id: str, db: AsyncSession = Depends(get_async_db)
) -> dict[str, str]:
    """Acknowledge a security alert."""

    # This would integrate with the alert management system
    # For now, return a success response

    return {
        "alert_id": alert_id,
        "status": "acknowledged",
        "message": "Alert has been acknowledged",
    }


@router.get(
    "/reports/weekly-summary",
    summary="Get weekly security summary",
    description="Retrieve a weekly security summary report",
)
@require_permissions([Permission.VIEW_REPORTS])
async def get_weekly_security_summary(
    organization_id: Optional[str] = Query(None),
    week_offset: int = Query(
        0, ge=0, description="Number of weeks to offset from current week"
    ),
    db: AsyncSession = Depends(get_async_db),
) -> dict[str, Any]:
    """Get weekly security summary report."""

    dashboard_service = DashboardService(db)

    weekly_summary = await dashboard_service.get_weekly_security_summary(
        organization_id=organization_id, week_offset=week_offset
    )

    return weekly_summary
