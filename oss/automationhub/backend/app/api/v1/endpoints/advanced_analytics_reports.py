"""
Advanced Analytics: intelligence reports generate, list, get by id.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.middleware.tenant import get_current_tenant_id as get_tenant_id
from app.models.user import User
from app.models.advanced_analytics import IntelligenceReport
from app.schemas.advanced_analytics import (
    IntelligenceReportRequest,
    IntelligenceReportResponse,
    IntelligenceReportDetailResponse,
)
from app.services.advanced_analytics_service import advanced_analytics_service

from .advanced_analytics_common import log_action

router = APIRouter()


@router.post("/reports/generate", response_model=IntelligenceReportResponse)
async def generate_intelligence_report(
    request: IntelligenceReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Generate comprehensive intelligence report."""
    try:
        report_data = await advanced_analytics_service.generate_intelligence_report(
            request.report_type,
            request.time_range,
            request.include_recommendations,
        )
        report = IntelligenceReport(
            id=UUID(report_data["id"]),
            tenant_id=tenant_id,
            report_name=f"{request.report_type.value.replace('_', ' ').title()} - {datetime.now().strftime('%Y-%m-%d')}",
            report_type=request.report_type.value,
            time_range=request.time_range,
            data_sources=report_data.get("detailed_analysis", {}).get("metrics_data", {}).get("data_sources", []),
            filters=getattr(request, "custom_filters", None) or {},
            analysis_types=getattr(request, "analysis_types", None) or [],
            executive_summary=report_data["executive_summary"],
            key_insights=report_data["key_insights"],
            recommendations=report_data["recommendations"],
            detailed_analysis=report_data["detailed_analysis"],
            charts=report_data["charts"],
            created_by=current_user.id,
            generated_at=report_data["generated_at"],
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="generate_intelligence_report",
            resource_id=str(report.id),
            resource_type="intelligence_report",
            details={
                "report_type": request.report_type.value,
                "time_range": request.time_range,
                "insights_count": len(report_data["key_insights"]),
                "recommendations_count": len(report_data["recommendations"]),
            },
        )
        return IntelligenceReportResponse(
            report_id=report.id,
            report_name=report.report_name,
            report_type=report.report_type,
            time_range=report.time_range,
            executive_summary=report.executive_summary or {},
            key_insights_count=len(report.key_insights or []),
            recommendations_count=len(report.recommendations or []),
            overall_health_score=(report.executive_summary or {}).get("overall_score") if isinstance(report.executive_summary, dict) else None,
            risk_assessment=report.risk_assessment or {},
            charts=report.charts or [],
            download_url=f"/api/v1/analytics/reports/{report.id}/download",
            generated_at=report.generated_at,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate intelligence report: {str(e)}",
        )


@router.get("/reports", response_model=List[IntelligenceReportResponse])
async def list_intelligence_reports(
    report_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """List intelligence reports."""
    try:
        query = db.query(IntelligenceReport).filter(IntelligenceReport.tenant_id == tenant_id)
        if report_type:
            query = query.filter(IntelligenceReport.report_type == report_type)
        if status:
            query = query.filter(IntelligenceReport.status == status)
        if priority:
            query = query.filter(IntelligenceReport.priority == priority)
        if start_date:
            query = query.filter(IntelligenceReport.generated_at >= start_date)
        if end_date:
            query = query.filter(IntelligenceReport.generated_at <= end_date)
        reports = query.order_by(IntelligenceReport.generated_at.desc()).offset(skip).limit(limit).all()
        return [
            IntelligenceReportResponse(
                report_id=r.id,
                report_name=r.report_name,
                report_type=r.report_type,
                time_range=r.time_range,
                executive_summary=r.executive_summary or {},
                key_insights_count=len(r.key_insights or []),
                recommendations_count=len(r.recommendations or []),
                overall_health_score=(r.executive_summary or {}).get("overall_score") if isinstance(r.executive_summary, dict) else None,
                risk_assessment=r.risk_assessment or {},
                charts=r.charts or [],
                generated_at=r.generated_at,
                download_url=f"/api/v1/analytics/reports/{r.id}/download",
            )
            for r in reports
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list intelligence reports: {str(e)}",
        )


@router.get("/reports/{report_id}", response_model=IntelligenceReportDetailResponse)
async def get_report_by_id(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Get a single intelligence report by id."""
    report = db.query(IntelligenceReport).filter(
        and_(
            IntelligenceReport.id == report_id,
            IntelligenceReport.tenant_id == tenant_id,
        )
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return IntelligenceReportDetailResponse(
        report_id=report.id,
        report_name=report.report_name,
        report_type=report.report_type,
        time_range=report.time_range,
        executive_summary=report.executive_summary or {},
        key_insights=report.key_insights or [],
        recommendations=report.recommendations or [],
        detailed_analysis=report.detailed_analysis or {},
        charts=report.charts or [],
        risk_assessment=report.risk_assessment or {},
        status=report.status,
        generated_at=report.generated_at,
        download_url=f"/api/v1/analytics/reports/{report.id}/download",
    )
