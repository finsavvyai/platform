"""
Basic Security API endpoints for Universal Dependency Platform.

Provides endpoints for vulnerability scanning, security reports, and basic security management.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from udp.core.models.user import User
from udp.core.schemas import ResponseModel
from udp.core.security import get_current_user
from udp.services.base import get_service
from udp.services.security_service import SecurityScanningService

router = APIRouter()


class VulnerabilityScanRequest(BaseModel):
    """Request model for vulnerability scan."""

    force_rescan: bool = Field(
        default=False, description="Force re-scan even if recent scan exists"
    )
    include_transitive: bool = Field(
        default=True, description="Include transitive dependencies"
    )
    severity_threshold: str = Field(
        default="low",
        description="Minimum severity to report",
        regex="^(low|medium|high|critical)$",
    )


@router.post(
    "/projects/{project_id}/scan",
    response_model=ResponseModel[dict[str, Any]],
    summary="Scan Project for Vulnerabilities",
    description="Perform vulnerability scan for a project's dependencies",
)
async def scan_project_vulnerabilities(
    project_id: str,
    request: VulnerabilityScanRequest,
    current_user: User = Depends(get_current_user),
    security_service: SecurityScanningService = Depends(
        get_service(SecurityScanningService)
    ),
):
    """
    Scan a project for vulnerabilities in its dependencies.
    """
    try:
        result = await security_service.scan_project_vulnerabilities(
            project_id=project_id,
            force_rescan=request.force_rescan,
            include_transitive=request.include_transitive,
            severity_threshold=request.severity_threshold,
            scanned_by=current_user.id,
        )

        return ResponseModel(
            success=True,
            data=result,
            message="Vulnerability scan completed successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Vulnerability scan failed: {str(e)}",
        )


@router.get(
    "/projects/{project_id}/vulnerabilities",
    response_model=ResponseModel[list[dict[str, Any]]],
    summary="Get Project Vulnerabilities",
    description="Get all vulnerabilities for a project",
)
async def get_project_vulnerabilities(
    project_id: str,
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity level",
        regex="^(low|medium|high|critical)$",
    ),
    status: Optional[str] = Query(
        default="open",
        description="Filter by vulnerability status",
        regex="^(open|resolved|ignored)$",
    ),
    current_user: User = Depends(get_current_user),
    security_service: SecurityScanningService = Depends(
        get_service(SecurityScanningService)
    ),
):
    """
    Get all vulnerabilities for a project with optional filtering.
    """
    try:
        # This would typically query the project_vulnerabilities table
        # For now, return the most recent scan results
        scan_result = await security_service.scan_project_vulnerabilities(
            project_id=project_id,
            force_rescan=False,
            include_transitive=True,
            severity_threshold=severity or "low",
        )

        vulnerabilities = scan_result.get("vulnerabilities", [])

        # Filter by status if specified
        if status:
            vulnerabilities = [v for v in vulnerabilities if v.get("status") == status]

        return ResponseModel(
            success=True,
            data=vulnerabilities,
            message=f"Found {len(vulnerabilities)} vulnerabilities",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get vulnerabilities: {str(e)}",
        )


@router.get(
    "/vulnerabilities/{vulnerability_id}",
    response_model=ResponseModel[dict[str, Any]],
    summary="Get Vulnerability Details",
    description="Get detailed information about a specific vulnerability",
)
async def get_vulnerability_details(
    vulnerability_id: str,
    current_user: User = Depends(get_current_user),
    security_service: SecurityScanningService = Depends(
        get_service(SecurityScanningService)
    ),
):
    """
    Get detailed information about a specific vulnerability.
    """
    try:
        vulnerability = await security_service.get_vulnerability_by_id(vulnerability_id)

        if not vulnerability:
            raise HTTPException(
                status_code=404,
                detail=f"Vulnerability {vulnerability_id} not found",
            )

        # Convert to dictionary format
        vuln_data = {
            "id": vulnerability.id,
            "cve_id": vulnerability.cve_id,
            "title": vulnerability.title,
            "description": vulnerability.description,
            "severity": vulnerability.severity,
            "score": vulnerability.score,
            "vector": vulnerability.vector,
            "source": vulnerability.source,
            "published_at": vulnerability.published_at.isoformat()
            if vulnerability.published_at
            else None,
            "modified_at": vulnerability.modified_at.isoformat()
            if vulnerability.modified_at
            else None,
            "references": vulnerability.references,
            "affected_packages": vulnerability.affected_packages,
        }

        return ResponseModel(
            success=True,
            data=vuln_data,
            message="Vulnerability details retrieved successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get vulnerability details: {str(e)}",
        )
