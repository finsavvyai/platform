"""
Advanced Security API routes for Universal Dependency Platform.

Provides endpoints for sophisticated vulnerability analysis, exploitability assessment,
contextual risk scoring, and attack path analysis.
"""

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ...core.models.user import User
from ...core.schemas import ResponseModel
from ...core.security import get_current_user
from ...services.advanced_security import AdvancedSecurityService
from ...services.base import get_service

router = APIRouter(prefix="/api/v1/advanced-security", tags=["advanced-security"])


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


class ContextualFactorsModel(BaseModel):
    """Model for project contextual factors."""

    project_exposure: str = Field(
        default="internal",
        description="Project exposure level",
        regex="^(internal|external|public)$",
    )
    data_sensitivity: str = Field(
        default="low",
        description="Data sensitivity level",
        regex="^(low|medium|high|critical)$",
    )
    user_base_size: int = Field(
        default=100, ge=1, description="Estimated number of users"
    )
    internet_facing: bool = Field(
        default=False, description="Whether the application is internet-facing"
    )
    compliance_requirements: list[str] = Field(
        default_factory=list, description="Compliance requirements"
    )
    business_criticality: str = Field(
        default="low",
        description="Business criticality level",
        regex="^(low|medium|high|critical)$",
    )
    third_party_integrations: list[str] = Field(
        default_factory=list, description="Third-party service integrations"
    )
    authentication_required: bool = Field(
        default=True, description="Whether authentication is required"
    )
    monitoring_level: str = Field(
        default="basic",
        description="Security monitoring level",
        regex="^(basic|standard|advanced)$",
    )
    patch_frequency: str = Field(
        default="monthly",
        description="Patch update frequency",
        regex="^(weekly|monthly|quarterly|adhoc)$",
    )


# Response Models
class ExploitabilityAssessmentResponse(BaseModel):
    """Response model for exploitability assessment."""

    vulnerability_id: str
    exploitability_assessment: dict[str, Any]
    exploitability_score: float
    exploit_intelligence: dict[str, Any]
    recommendations: list[str]
    assessment_date: str


class AttackPathResponse(BaseModel):
    """Response model for attack path analysis."""

    project_id: str
    attack_paths: list[dict[str, Any]]
    attack_graph: Optional[dict[str, Any]]
    summary: dict[str, Any]
    chain_summaries: list[dict[str, Any]]
    recommendations: list[str]
    analysis_date: str


class ContextualRiskResponse(BaseModel):
    """Response model for contextual risk assessment."""

    contextual_factors: dict[str, Any]
    assessments: list[dict[str, Any]]
    risk_distribution: dict[str, Any]
    recommendations: list[dict[str, Any]]
    assessment_date: str
    total_assessed: int


class AdvancedScanResponse(BaseModel):
    """Response model for advanced vulnerability scan."""

    project_id: str
    scan_type: str
    scan_date: str
    scan_config: dict[str, Any]
    basic_summary: dict[str, Any]
    total_dependencies: int
    advanced_statistics: dict[str, Any]
    risk_assessments: list[dict[str, Any]]
    attack_path_analysis: dict[str, Any]
    critical_vulnerabilities: list[dict[str, Any]]
    high_risk_chains: list[dict[str, Any]]
    contextual_factors: dict[str, Any]
    compliance_impact: dict[str, Any]
    prioritized_actions: list[dict[str, Any]]
    executive_summary: dict[str, Any]


# Endpoints
@router.post(
    "/projects/{project_id}/scan",
    response_model=ResponseModel[AdvancedScanResponse],
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
        # await _verify_project_access(current_user.id, project_id)

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
    response_model=ResponseModel[ExploitabilityAssessmentResponse],
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
        # Verify vulnerability exists and user has access
        # await _verify_vulnerability_access(current_user.id, vulnerability_id)

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
    response_model=ResponseModel[AttackPathResponse],
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
        # Verify project access
        # await _verify_project_access(current_user.id, project_id)

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
    response_model=ResponseModel[ContextualRiskResponse],
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
        # Verify access to all specified vulnerabilities
        # for vuln_id in request.vulnerability_ids:
        #     await _verify_vulnerability_access(current_user.id, vuln_id)

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


@router.get(
    "/projects/{project_id}/risk-summary",
    response_model=ResponseModel[dict[str, Any]],
    summary="Get Project Risk Summary",
    description="Get a summary of security risks for a project",
)
async def get_project_risk_summary(
    project_id: str,
    include_chains: bool = Query(
        default=True, description="Include attack chain information"
    ),
    current_user: User = Depends(get_current_user),
    advanced_security: AdvancedSecurityService = Depends(
        get_service(AdvancedSecurityService)
    ),
):
    """
    Get a summarized view of project security risks.

    Returns key metrics including:
    - Overall risk level
    - Critical vulnerabilities count
    - High-risk attack paths
    - Compliance status
    - Risk trends over time
    """
    try:
        # Verify project access
        # await _verify_project_access(current_user.id, project_id)

        # Get recent scan results
        # This would typically query the scan_results table
        recent_scan = await _get_most_recent_scan(project_id)

        if not recent_scan:
            return ResponseModel(
                success=True,
                data={
                    "project_id": project_id,
                    "message": "No recent scans found",
                    "recommendation": "Run an advanced vulnerability scan",
                },
                message="No scan data available",
            )

        # Extract key metrics
        summary = {
            "project_id": project_id,
            "last_scan_date": recent_scan.get("scan_date"),
            "overall_risk_level": recent_scan.get("executive_summary", {}).get(
                "overall_risk_level"
            ),
            "total_vulnerabilities": recent_scan.get("advanced_statistics", {}).get(
                "total_assessed", 0
            ),
            "critical_vulnerabilities": recent_scan.get("advanced_statistics", {})
            .get("risk_distribution", {})
            .get("critical", {})
            .get("count", 0),
            "high_risk_vulnerabilities": recent_scan.get("advanced_statistics", {})
            .get("risk_distribution", {})
            .get("high", {})
            .get("count", 0),
            "attack_paths_found": recent_scan.get("attack_path_analysis", {}).get(
                "total_attack_paths", 0
            )
            if include_chains
            else 0,
            "compliance_score": recent_scan.get("compliance_impact", {}).get(
                "compliance_score", 100
            ),
            "immediate_actions_required": recent_scan.get("executive_summary", {}).get(
                "immediate_actions_required", 0
            ),
        }

        # Add trend data if available
        trend_data = await _get_risk_trends(project_id, days=30)
        if trend_data:
            summary["risk_trend"] = trend_data

        return ResponseModel(
            success=True,
            data=summary,
            message="Risk summary retrieved successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get risk summary: {str(e)}",
        )


@router.get(
    "/vulnerabilities/{vulnerability_id}/detailed-analysis",
    response_model=ResponseModel[dict[str, Any]],
    summary="Get Detailed Vulnerability Analysis",
    description="Get comprehensive analysis for a specific vulnerability",
)
async def get_detailed_vulnerability_analysis(
    vulnerability_id: str,
    include_attack_paths: bool = Query(
        default=True, description="Include related attack paths"
    ),
    current_user: User = Depends(get_current_user),
    advanced_security: AdvancedSecurityService = Depends(
        get_service(AdvancedSecurityService)
    ),
):
    """
    Get detailed analysis for a specific vulnerability.

    Returns comprehensive information including:
    - Basic vulnerability details
    - Exploitability assessment
    - Contextual risk factors
    - Related attack paths
    - Mitigation strategies
    - Affected projects
    """
    try:
        # Verify vulnerability access
        # await _verify_vulnerability_access(current_user.id, vulnerability_id)

        # Get vulnerability details
        vulnerability = await advanced_security.get_vulnerability_by_id(
            vulnerability_id
        )
        if not vulnerability:
            raise HTTPException(
                status_code=404,
                detail=f"Vulnerability {vulnerability_id} not found",
            )

        # Get exploitability assessment
        exploitability = await advanced_security.assess_exploitability(vulnerability_id)

        # Get projects affected by this vulnerability
        affected_projects = await _get_affected_projects(vulnerability_id)

        # Get related attack paths if requested
        attack_paths = []
        if include_attack_paths:
            attack_paths = await _get_related_attack_paths(vulnerability_id)

        analysis = {
            "vulnerability": {
                "id": vulnerability.id,
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
            },
            "exploitability": exploitability,
            "affected_projects": affected_projects,
            "attack_paths": attack_paths,
            "mitigation_strategies": exploitability.get("recommendations", []),
            "related_advisories": await _get_related_advisories(vulnerability_id),
        }

        return ResponseModel(
            success=True,
            data=analysis,
            message="Detailed analysis retrieved successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get detailed analysis: {str(e)}",
        )


@router.get(
    "/risk-metrics/dashboard",
    response_model=ResponseModel[dict[str, Any]],
    summary="Get Risk Metrics Dashboard",
    description="Get aggregated risk metrics across all projects",
)
async def get_risk_metrics_dashboard(
    organization_id: Optional[str] = Query(
        default=None, description="Filter by organization"
    ),
    time_range: int = Query(default=30, ge=1, le=365, description="Time range in days"),
    current_user: User = Depends(get_current_user),
    advanced_security: AdvancedSecurityService = Depends(
        get_service(AdvancedSecurityService)
    ),
):
    """
    Get aggregated risk metrics for dashboard view.

    Returns metrics including:
    - Risk distribution across projects
    - Critical vulnerabilities trending
    - Compliance status overview
    - Top riskiest projects
    - Remediation progress
    """
    try:
        # Verify user has permission to view organization metrics
        # if organization_id:
        #     await _verify_organization_access(current_user.id, organization_id)

        # Get aggregated metrics
        metrics = await _get_aggregated_risk_metrics(
            organization_id=organization_id,
            user_id=current_user.id,
            time_range_days=time_range,
        )

        return ResponseModel(
            success=True,
            data=metrics,
            message="Risk metrics retrieved successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get risk metrics: {str(e)}",
        )


# Helper functions (would be implemented in actual service)
async def _log_security_scan(
    user_id: UUID, project_id: str, scan_type: str, vulnerabilities_found: int
):
    """Log security scan for audit purposes."""
    # Implementation would log to audit table
    pass


async def _verify_project_access(user_id: UUID, project_id: str):
    """Verify user has access to the project."""
    # Implementation would check project membership
    pass


async def _verify_vulnerability_access(user_id: UUID, vulnerability_id: str):
    """Verify user has access to vulnerability details."""
    # Implementation would check if vulnerability is in user's projects
    pass


async def _get_most_recent_scan(project_id: str) -> Optional[dict[str, Any]]:
    """Get most recent scan results for a project."""
    # Implementation would query scan_results table
    return None


async def _get_risk_trends(project_id: str, days: int) -> Optional[dict[str, Any]]:
    """Get risk trend data over time."""
    # Implementation would query historical scan data
    return None


async def _get_affected_projects(vulnerability_id: str) -> list[dict[str, Any]]:
    """Get projects affected by a vulnerability."""
    # Implementation would query project_vulnerabilities table
    return []


async def _get_related_attack_paths(vulnerability_id: str) -> list[dict[str, Any]]:
    """Get attack paths that include this vulnerability."""
    # Implementation would query stored attack path data
    return []


async def _get_related_advisories(vulnerability_id: str) -> list[dict[str, Any]]:
    """Get related security advisories."""
    # Implementation would query external advisory sources
    return []


async def _get_aggregated_risk_metrics(
    organization_id: Optional[str], user_id: UUID, time_range_days: int
) -> dict[str, Any]:
    """Get aggregated risk metrics across projects."""
    # Implementation would aggregate data from multiple projects
    return {
        "total_projects": 0,
        "total_vulnerabilities": 0,
        "critical_vulnerabilities": 0,
        "high_risk_projects": 0,
        "average_risk_score": 0,
        "compliance_percentage": 100,
        "remediation_rate": 0,
    }
