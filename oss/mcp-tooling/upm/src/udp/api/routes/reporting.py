"""
Reporting API endpoints.

REST API for generating reports, exporting data,
and compliance reporting.
"""

from datetime import datetime, timedelta
from io import BytesIO
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.database import get_async_session
from udp.infrastructure.models import (
    VulnerabilityModel,
)

logger = structlog.get_logger()
router = APIRouter()


@router.get("/security-report")
async def generate_security_report(
    organization_id: UUID,
    format: str = Query("json", description="Report format: json, csv, pdf"),
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Generate security vulnerability report.

    Args:
        organization_id: Organization ID
        format: Report format (json, csv, pdf)
        days: Number of days to include in report

    Returns:
        Security report data
    """
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Get vulnerability data
        vulnerabilities = await _get_vulnerability_report_data(db, organization_id, start_date, end_date)

        # Get package vulnerability associations
        package_vulnerabilities = await _get_package_vulnerability_data(db, organization_id)

        report_data = {
            "organization_id": str(organization_id),
            "report_type": "security",
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "summary": {
                "total_vulnerabilities": len(vulnerabilities),
                "critical_vulnerabilities": len([v for v in vulnerabilities if v["severity"] == "critical"]),
                "high_vulnerabilities": len([v for v in vulnerabilities if v["severity"] == "high"]),
                "medium_vulnerabilities": len([v for v in vulnerabilities if v["severity"] == "medium"]),
                "low_vulnerabilities": len([v for v in vulnerabilities if v["severity"] == "low"]),
                "affected_packages": len(set([pv["package_name"] for pv in package_vulnerabilities]))
            },
            "vulnerabilities": vulnerabilities,
            "package_vulnerabilities": package_vulnerabilities,
            "generated_at": datetime.utcnow().isoformat()
        }

        if format == "json":
            return report_data
        elif format == "csv":
            return _generate_csv_response(report_data, "security_report.csv")
        elif format == "pdf":
            return _generate_pdf_response(report_data, "security_report.pdf")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format: {format}. Supported formats: json, csv, pdf"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate security report", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate security report"
        )


async def _get_vulnerability_report_data(db: AsyncSession, organization_id: UUID, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
    """Get vulnerability data for report."""
    result = await db.execute(
        select(VulnerabilityModel).where(
            and_(
                VulnerabilityModel.is_deleted == False,
                VulnerabilityModel.published_at >= start_date,
                VulnerabilityModel.published_at <= end_date
            )
        ).order_by(VulnerabilityModel.severity, VulnerabilityModel.published_at.desc())
    )

    vulnerabilities = []
    for vuln in result.scalars():
        vulnerabilities.append({
            "id": str(vuln.id),
            "cve_id": vuln.cve_id,
            "advisory_id": vuln.advisory_id,
            "title": vuln.title,
            "severity": vuln.severity.value,
            "cvss_score": vuln.cvss_score,
            "published_at": vuln.published_at.isoformat() if vuln.published_at else None,
            "source": vuln.source,
            "exploit_available": vuln.exploit_available,
            "patch_available": vuln.patch_available
        })

    return vulnerabilities


async def _get_package_vulnerability_data(db: AsyncSession, organization_id: UUID) -> list[dict[str, Any]]:
    """Get package vulnerability associations."""
    # This would typically join with package_vulnerabilities table
    # For now, return empty list as placeholder
    return []


def _generate_csv_response(data: dict[str, Any], filename: str) -> StreamingResponse:
    """Generate CSV response from data."""
    # This would typically use pandas or csv module to generate CSV
    # For now, return a simple text response
    csv_content = f"Report generated at: {data.get('generated_at', 'Unknown')}\n"
    csv_content += f"Organization ID: {data.get('organization_id', 'Unknown')}\n"
    csv_content += f"Report Type: {data.get('report_type', 'Unknown')}\n"

    return StreamingResponse(
        BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _generate_pdf_response(data: dict[str, Any], filename: str) -> StreamingResponse:
    """Generate PDF response from data."""
    # This would typically use a PDF generation library
    # For now, return a simple text response
    pdf_content = f"Report generated at: {data.get('generated_at', 'Unknown')}\n"
    pdf_content += f"Organization ID: {data.get('organization_id', 'Unknown')}\n"
    pdf_content += f"Report Type: {data.get('report_type', 'Unknown')}\n"

    return StreamingResponse(
        BytesIO(pdf_content.encode()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
