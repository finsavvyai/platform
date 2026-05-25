"""
SBOM (Software Bill of Materials) API endpoints for Universal Dependency Platform.

Provides endpoints for SBOM generation, management, comparison, and analysis
with support for multiple formats (CycloneDX, SPDX, SWID).
"""

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from udp.core.models.user import User
from udp.core.schemas import ResponseModel
from udp.core.security import get_current_user
from udp.services.base import get_service
from udp.services.sbom_service import SBOMFormat, SBOMService

router = APIRouter()


class SBOMGenerationRequest(BaseModel):
    """Request model for SBOM generation."""

    format: str = Field(
        default=SBOMFormat.CYCLEDX,
        description="SBOM format",
        regex="^(cyclonedx|spdx|swid)$",
    )
    include_transitive: bool = Field(
        default=True, description="Include transitive dependencies"
    )
    include_vulnerabilities: bool = Field(
        default=True, description="Include vulnerability information"
    )
    include_licenses: bool = Field(
        default=True, description="Include license information"
    )
    custom_metadata: Optional[dict[str, Any]] = Field(
        default=None, description="Additional metadata to include"
    )


class SBOMComparisonRequest(BaseModel):
    """Request model for SBOM comparison."""

    sbom_id1: UUID = Field(..., description="First SBOM ID")
    sbom_id2: UUID = Field(..., description="Second SBOM ID")
    deep_analysis: bool = Field(
        default=True, description="Perform deep analysis including vulnerabilities"
    )


class SBOMExportRequest(BaseModel):
    """Request model for SBOM export."""

    format: Optional[str] = Field(
        default=None,
        description="Target format (if different from original)",
        regex="^(cyclonedx|spdx|swid)$",
    )
    output_format: str = Field(
        default="json", description="Output format", regex="^(json|yaml|xml)$"
    )


@router.post(
    "/projects/{project_id}/sbom",
    response_model=ResponseModel[dict[str, Any]],
    summary="Generate SBOM for Project",
    description="Generate Software Bill of Materials for a project in specified format",
)
async def generate_project_sbom(
    project_id: str,
    request: SBOMGenerationRequest,
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Generate SBOM for a project's dependencies.

    Supports CycloneDX, SPDX, and SWID formats with optional
    vulnerability and license information inclusion.
    """
    try:
        sbom = await sbom_service.generate_sbom(
            project_id=UUID(project_id),
            format_type=request.format,
            include_transitive=request.include_transitive,
            include_vulnerabilities=request.include_vulnerabilities,
            include_licenses=request.include_licenses,
            custom_metadata=request.custom_metadata or {},
        )

        return ResponseModel(
            success=True,
            data={
                "id": str(sbom.id),
                "sbom_id": sbom.sbom_id,
                "format": sbom.format,
                "version": sbom.version,
                "target_id": str(sbom.target_id),
                "target_name": sbom.target_name,
                "total_components": sbom.total_components,
                "direct_dependencies": sbom.direct_dependencies,
                "transitive_dependencies": sbom.transitive_dependencies,
                "generated_at": sbom.generated_at,
                "generator": sbom.generator,
            },
            message=f"SBOM generated successfully in {request.format.upper()} format",
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SBOM generation failed: {str(e)}")


@router.get(
    "/sbom/{sbom_id}",
    response_model=ResponseModel[dict[str, Any]],
    summary="Get SBOM",
    description="Retrieve SBOM by ID with optional raw content",
)
async def get_sbom(
    sbom_id: UUID,
    include_raw: bool = Query(default=False, description="Include raw SBOM content"),
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Retrieve SBOM details by ID.
    """
    try:
        sbom = await sbom_service.get_sbom(sbom_id, include_raw=include_raw)

        if not sbom:
            raise HTTPException(status_code=404, detail="SBOM not found")

        response_data = {
            "id": str(sbom.id),
            "sbom_id": sbom.sbom_id,
            "format": sbom.format,
            "version": sbom.version,
            "target_type": sbom.target_type,
            "target_id": str(sbom.target_id),
            "target_name": sbom.target_name,
            "total_components": sbom.total_components,
            "direct_dependencies": sbom.direct_dependencies,
            "transitive_dependencies": sbom.transitive_dependencies,
            "generated_at": sbom.generated_at,
            "generator": sbom.generator,
            "created_at": sbom.created_at.isoformat() if sbom.created_at else None,
            "updated_at": sbom.updated_at.isoformat() if sbom.updated_at else None,
        }

        if include_raw and hasattr(sbom, "raw_content"):
            response_data["raw_content"] = sbom.raw_content

        return ResponseModel(
            success=True, data=response_data, message="SBOM retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve SBOM: {str(e)}"
        )


@router.get(
    "/projects/{project_id}/sboms",
    response_model=ResponseModel[dict[str, Any]],
    summary="List Project SBOMs",
    description="List all SBOMs generated for a project",
)
async def list_project_sboms(
    project_id: str,
    format: Optional[str] = Query(
        default=None, description="Filter by format", regex="^(cyclonedx|spdx|swid)$"
    ),
    limit: int = Query(
        default=50, ge=1, le=1000, description="Maximum number of results"
    ),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
    order_by: str = Query(
        default="generated_at",
        regex="^(generated_at|created_at|total_components)$",
        description="Field to order by",
    ),
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    List all SBOMs for a project with filtering and pagination.
    """
    try:
        sboms, total = await sbom_service.list_sboms(
            target_id=UUID(project_id),
            target_type="project",
            format_type=format,
            limit=limit,
            offset=offset,
            order_by=order_by,
        )

        sbom_list = []
        for sbom in sboms:
            sbom_list.append(
                {
                    "id": str(sbom.id),
                    "sbom_id": sbom.sbom_id,
                    "format": sbom.format,
                    "version": sbom.version,
                    "target_name": sbom.target_name,
                    "total_components": sbom.total_components,
                    "generated_at": sbom.generated_at,
                    "generator": sbom.generator,
                }
            )

        return ResponseModel(
            success=True,
            data={
                "sboms": sbom_list,
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "has_more": offset + limit < total,
                },
            },
            message=f"Retrieved {len(sbom_list)} SBOMs",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list SBOMs: {str(e)}")


@router.post(
    "/sbom/compare",
    response_model=ResponseModel[dict[str, Any]],
    summary="Compare SBOMs",
    description="Compare two SBOMs and identify differences",
)
async def compare_sboms(
    request: SBOMComparisonRequest,
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Compare two SBOMs to identify differences.

    Returns detailed comparison including added/removed components,
    version changes, license changes, and vulnerability impacts.
    """
    try:
        diff_result = await sbom_service.compare_sboms(
            sbom_id1=request.sbom_id1,
            sbom_id2=request.sbom_id2,
            deep_analysis=request.deep_analysis,
        )

        comparison_data = {
            "has_changes": diff_result.has_changes,
            "total_changes": diff_result.total_changes,
            "added_components": diff_result.added_components,
            "removed_components": diff_result.removed_components,
            "modified_components": diff_result.modified_components,
            "version_changes": diff_result.version_changes,
            "license_changes": diff_result.license_changes,
            "vulnerability_changes": diff_result.vulnerability_changes,
            "compliance_impact": diff_result.compliance_impact,
            "risk_assessment": diff_result.risk_assessment,
        }

        return ResponseModel(
            success=True,
            data=comparison_data,
            message=f"SBOM comparison complete: {diff_result.total_changes} changes found",
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SBOM comparison failed: {str(e)}")


@router.post(
    "/sbom/{sbom_id}/export",
    summary="Export SBOM",
    description="Export SBOM in specified format",
    responses={
        200: {
            "description": "SBOM exported successfully",
            "content": {
                "application/json": {},
                "application/xml": {},
                "application/x-yaml": {},
            },
        }
    },
)
async def export_sbom(
    sbom_id: UUID,
    request: SBOMExportRequest = Body(...),
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Export SBOM in specified format.

    Supports JSON, YAML, and XML output formats with optional
    format conversion (e.g., CycloneDX to SPDX).
    """
    try:
        exported_data = await sbom_service.export_sbom(
            sbom_id=sbom_id,
            format_type=request.format,
            output_format=request.output_format,
        )

        # Set appropriate content type based on output format
        content_type = {
            "json": "application/json",
            "yaml": "application/x-yaml",
            "xml": "application/xml",
        }.get(request.output_format, "application/json")

        # Get SBOM for filename
        sbom = await sbom_service.get_sbom(sbom_id)
        if not sbom:
            raise HTTPException(status_code=404, detail="SBOM not found")

        filename = f"sbom-{sbom.target_name}-{sbom.sbom_id}.{request.output_format}"

        return Response(
            content=exported_data if isinstance(exported_data, str) else exported_data,
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SBOM export failed: {str(e)}")


@router.delete(
    "/sbom/{sbom_id}",
    response_model=ResponseModel[dict[str, str]],
    summary="Delete SBOM",
    description="Delete an SBOM by ID",
)
async def delete_sbom(
    sbom_id: UUID,
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Delete an SBOM by ID.
    """
    try:
        deleted = await sbom_service.delete_sbom(sbom_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="SBOM not found")

        return ResponseModel(
            success=True, data={"deleted": "true"}, message="SBOM deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete SBOM: {str(e)}")


@router.post(
    "/sbom/validate",
    response_model=ResponseModel[dict[str, Any]],
    summary="Validate SBOM",
    description="Validate SBOM format and content",
)
async def validate_sbom(
    format: str = Query(
        ..., description="SBOM format", regex="^(cyclonedx|spdx|swid)$"
    ),
    sbom_data: dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Validate SBOM format and content.

    Checks format compliance, required fields, and data integrity.
    Returns validation results with any errors or warnings.
    """
    try:
        validation_result = await sbom_service.validate_sbom(
            sbom_data=sbom_data, format_type=format
        )

        return ResponseModel(
            success=True, data=validation_result, message="SBOM validation complete"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SBOM validation failed: {str(e)}")


@router.get(
    "/sbom/{sbom_id}/components",
    response_model=ResponseModel[list[dict[str, Any]]],
    summary="Get SBOM Components",
    description="Get all components from an SBOM",
)
async def get_sbom_components(
    sbom_id: UUID,
    filter_by: Optional[str] = Query(
        default=None, description="Filter components by name or type"
    ),
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Get all components from an SBOM with optional filtering.
    """
    try:
        sbom = await sbom_service.get_sbom(sbom_id, include_raw=True)

        if not sbom:
            raise HTTPException(status_code=404, detail="SBOM not found")

        components = sbom.sbom_data.get("components", [])

        if filter_by:
            components = [
                comp
                for comp in components
                if filter_by.lower() in comp.get("name", "").lower()
                or filter_by.lower() in comp.get("type", "").lower()
            ]

        return ResponseModel(
            success=True,
            data=components,
            message=f"Retrieved {len(components)} components",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get SBOM components: {str(e)}"
        )


@router.get(
    "/sbom/{sbom_id}/licenses",
    response_model=ResponseModel[dict[str, Any]],
    summary="Get SBOM License Summary",
    description="Get license summary from SBOM",
)
async def get_sbom_license_summary(
    sbom_id: UUID,
    current_user: User = Depends(get_current_user),
    sbom_service: SBOMService = Depends(get_service(SBOMService)),
):
    """
    Get license summary from an SBOM.

    Returns a count of each license type found in the SBOM
    for compliance reporting and analysis.
    """
    try:
        sbom = await sbom_service.get_sbom(sbom_id, include_raw=True)

        if not sbom:
            raise HTTPException(status_code=404, detail="SBOM not found")

        # Get license summary from SBOM
        licenses = {}
        for component in sbom.sbom_data.get("components", []):
            component_licenses = component.get("licenses", [])
            if component_licenses:
                for license_info in component_licenses:
                    license_id = license_info.get("id") or license_info.get(
                        "name", "Unknown"
                    )
                    licenses[license_id] = licenses.get(license_id, 0) + 1

        return ResponseModel(
            success=True,
            data={
                "licenses": licenses,
                "total_components": len(sbom.sbom_data.get("components", [])),
                "components_with_licenses": sum(licenses.values()),
            },
            message="License summary retrieved successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get license summary: {str(e)}"
        )
