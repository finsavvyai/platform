"""
Advanced Security API endpoints for Universal Dependency Platform.

Provides endpoints for sophisticated vulnerability analysis, exploitability assessment,
contextual risk scoring, and attack path analysis.
"""

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from udp.core.models.user import User
from udp.core.schemas import ResponseModel
from udp.core.security import get_current_user
from udp.services.advanced_security import AdvancedSecurityService
from udp.services.base import get_service

router = APIRouter()


# Request/Response Models
class AdvancedScanRequest(BaseModel):
    """Request model for advanced vulnerability scan."""

    force_rescan: bool = Field(
        default=False, description="Force re-scan even if recent scan exists"
    )
    include_attack_paths: bool = Field(
        default=True, description="Include vulnerability chain analysis"
    )
    include_exploitability: bool = Field(
        default=True, description="Include exploitability assessment"
    )
    contextual_factors: Optional[dict[str, Any]] = Field(
        default=None, description="Project-specific context"
    )
    scan_config: Optional[dict[str, Any]] = Field(
        default=None, description="Additional scan configuration"
    )


class ExploitabilityRequest(BaseModel):
    """Request model for exploitability assessment."""

    vulnerability_id: str = Field(..., description="Vulnerability ID to assess")
    additional_intelligence: Optional[dict[str, Any]] = Field(
        default=None, description="Additional exploit intelligence"
    )


class AttackPathAnalysisRequest(BaseModel):
    """Request model for attack path analysis."""

    max_paths: int = Field(
        default=10, ge=1, le=100, description="Maximum number of attack paths"
    )
    min_impact_threshold: float = Field(
        default=40.0, ge=0, le=100, description="Minimum impact threshold"
    )


class ContextualRiskRequest(BaseModel):
    """Request model for contextual risk assessment."""

    vulnerability_ids: list[str] = Field(
        ..., description="List of vulnerability IDs to assess"
    )
    project_context: dict[str, Any] = Field(
        ..., description="Project context information"
    )
    prioritize_by: str = Field(
        default="overall_risk",
        description="Risk prioritization method",
        regex="^(overall_risk|exploitability|impact|contextual)$",
    )


# Endpoints
@router.post(
    "/projects/{project_id}/scan",
    response_model=ResponseModel[dict[str, Any]],
    summary="Perform Advanced Vulnerability Scan",
    description="Perform comprehensive vulnerability scan with risk assessment and attack path analysis",
)
async def advanced_vulnerability_scan(
    project_id: str,
    request: AdvancedScanRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    advanced_security: AdvancedSecurityService = Depends(
        get_service(AdvancedSecurityService)
    ),
):
    """
    Perform advanced vulnerability scan for a project.

    This endpoint provides comprehensive security analysis including:
    - Basic vulnerability scanning
    - Exploitability assessment
    - Contextual risk scoring
    - Vulnerability chain analysis
    - Attack path visualization
    - Compliance impact assessment
    """
    try:
        # Verify user has access to the project
        # This would typically check project membership/ownership

        # Perform advanced scan
        scan_result = await advanced_security.advanced_vulnerability_scan(
            project_id=project_id,
            scan_config=request.scan_config,
            include_attack_paths=request.include_attack_paths,
            include_exploitability=request.include_exploitability,
            contextual_factors=request.contextual_factors,
        )

        # Log the scan for audit purposes
        background_tasks.add_task(
            _log_security_scan,
            user_id=current_user.id,
            project_id=project_id,
            scan_type="advanced",
            vulnerabilities_found=scan_result.get("advanced_statistics", {}).get(
                "total_assessed", 0
            ),
        )

        return ResponseModel(
            success=True,
            data=scan_result,
            message="Advanced vulnerability scan completed successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Advanced scan failed: {str(e)}",
        )


@router.post(
    "/vulnerabilities/{vulnerability_id}/exploitability",
    response_model=ResponseModel[dict[str, Any]],
    summary="Assess Vulnerability Exploitability",
    description="Perform detailed exploitability assessment for a specific vulnerability",
)
async def assess_vulnerability_exploitability(
    vulnerability_id: str,
    request: ExploitabilityRequest,
    current_user: User = Depends(get_current_user),
    advanced_security: AdvancedSecurityService = Depends(
        get_service(AdvancedSecurityService)
    ),
):
    """
    Assess exploitability of a specific vulnerability.

    This endpoint analyzes:
    - Attack vectors and complexity
    - Required privileges and user interaction
    - Exploit code maturity
    - Weaponization potential
    - Confidence in assessment
    """
    try:
        assessment = await advanced_security.assess_exploitability(
            vulnerability_id=vulnerability_id,
            additional_intelligence=request.additional_intelligence,
        )

        return ResponseModel(
            success=True,
            data=assessment,
            message="Exploitability assessment completed successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Exploitability assessment failed: {str(e)}",
        )


@router.post(
    "/projects/{project_id}/attack-paths",
    response_model=ResponseModel[dict[str, Any]],
    summary="Analyze Attack Paths",
    description="Analyze potential vulnerability chains and attack paths in a project",
)
async def analyze_attack_paths(
    project_id: str,
    request: AttackPathAnalysisRequest,
    current_user: User = Depends(get_current_user),
    advanced_security: AdvancedSecurityService = Depends(
        get_service(AdvancedSecurityService)
    ),
):
    """
    Analyze potential attack paths through vulnerability chains.

    This endpoint identifies:
    - Multi-step attack paths
    - Vulnerability chaining opportunities
    - Attack feasibility and impact
    - Detection difficulty
    - Visualization of attack graphs
    """
    try:
        analysis = await advanced_security.analyze_attack_paths(
            project_id=project_id,
            max_paths=request.max_paths,
            min_impact_threshold=request.min_impact_threshold,
        )

        return ResponseModel(
            success=True,
            data=analysis,
            message="Attack path analysis completed successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Attack path analysis failed: {str(e)}",
        )


@router.post(
    "/contextual-risk-assessment",
    response_model=ResponseModel[dict[str, Any]],
    summary="Perform Contextual Risk Assessment",
    description="Assess vulnerabilities in the context of your specific project environment",
)
async def contextual_risk_assessment(
    request: ContextualRiskRequest,
    current_user: User = Depends(get_current_user),
    advanced_security: AdvancedSecurityService = Depends(
        get_service(AdvancedSecurityService)
    ),
):
    """
    Perform contextual risk assessment for multiple vulnerabilities.

    This endpoint considers:
    - Project exposure and data sensitivity
    - Business criticality and user base
    - Compliance requirements
    - Internet-facing status
    - Security controls in place
    """
    try:
        assessment = await advanced_security.contextual_risk_assessment(
            vulnerability_ids=request.vulnerability_ids,
            project_context=request.project_context,
            prioritize_by=request.prioritize_by,
        )

        return ResponseModel(
            success=True,
            data=assessment,
            message="Contextual risk assessment completed successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Contextual risk assessment failed: {str(e)}",
        )


# Helper functions
async def _log_security_scan(
    user_id: UUID, project_id: str, scan_type: str, vulnerabilities_found: int
):
    """Log security scan for audit purposes."""
    # Implementation would log to audit table
    pass
