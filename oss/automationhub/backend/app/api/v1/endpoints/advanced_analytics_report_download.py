"""
Advanced Analytics: report download endpoint.
"""

import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.middleware.tenant import get_current_tenant_id as get_tenant_id
from app.models.user import User
from app.models.advanced_analytics import IntelligenceReport

from .advanced_analytics_common import log_action
from .advanced_analytics_helpers import generate_csv_report, generate_pdf_report

router = APIRouter()


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: UUID,
    format: str = Query("json", description="Download format: json, pdf, csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Download intelligence report in various formats."""
    try:
        report = db.query(IntelligenceReport).filter(
            and_(
                IntelligenceReport.id == report_id,
                IntelligenceReport.tenant_id == tenant_id,
            )
        ).first()
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        report.download_count += 1
        report.last_downloaded = datetime.now(timezone.utc)
        db.commit()
        payload = {
            "report_id": str(report.id),
            "report_name": report.report_name,
            "report_type": report.report_type,
            "time_range": report.time_range,
            "generated_at": report.generated_at.isoformat() if report.generated_at else "",
            "executive_summary": report.executive_summary,
            "key_insights": report.key_insights,
            "recommendations": report.recommendations,
            "detailed_analysis": report.detailed_analysis,
            "charts": report.charts,
        }
        if format == "json":
            content = json.dumps(payload).encode("utf-8")
            filename = f"{report.report_name}.json"
            media_type = "application/json"
        elif format == "csv":
            content = generate_csv_report(report).encode("utf-8")
            filename = f"{report.report_name}.csv"
            media_type = "text/csv"
        elif format == "pdf":
            content = generate_pdf_report(report)
            filename = f"{report.report_name}.pdf"
            media_type = "application/pdf"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported format. Use json, csv, or pdf.",
            )
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="download_intelligence_report",
            resource_id=str(report_id),
            resource_type="intelligence_report",
            details={"format": format, "filename": filename},
        )
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download report: {str(e)}",
        )
