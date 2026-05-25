"""
Compliance Management API Endpoints.

Provides RESTful API for:
- Compliance assessment and monitoring
- Violation tracking and remediation
- Custom framework management
- Compliance reporting and analytics
- Framework-specific evaluations
"""

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ComplianceError, ValidationError
from ...core.models.base import BaseResponse
from ...core.models.users import User
from ...security.compliance_framework_registry import ComplianceFramework
from ...services.compliance_service import ComplianceService
from ..dependencies import get_current_user, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compliance", tags=["compliance"])


# Pydantic Models for API
class ComplianceAssessmentRequest(BaseModel):
    """Request model for compliance assessment."""

    frameworks: Optional[list[str]] = Field(
        None, description="Compliance frameworks to assess against"
    )
    force_reassessment: bool = Field(
        default=False, description="Force new assessment even if cached"
    )

    @validator("frameworks", pre=True, always=True)
    def validate_frameworks(cls, v):
        if v is None:
            return [f.value for f in ComplianceFramework]

        valid_frameworks = [f.value for f in ComplianceFramework]
        for framework in v:
            if framework.upper() not in valid_frameworks:
                raise ValueError(f"Invalid framework: {framework}")
        return [f.upper() for f in v]


class ComplianceCheckResponse(BaseResponse):
    """Response model for compliance check results."""

    assessment_id: str = Field(..., description="Unique assessment identifier")
    frameworks_assessed: list[str] = Field(
        ..., description="Frameworks that were assessed"
    )
    total_violations: int = Field(..., description="Total number of violations found")
    critical_violations: int = Field(..., description="Number of critical violations")
    is_compliant: bool = Field(..., description="Whether the target is compliant")
    risk_score: float = Field(..., description="Overall risk score (0-10)")
    recommendations: list[str] = Field(..., description="Compliance recommendations")
    assessment_details: dict[str, Any] = Field(
        ..., description="Detailed assessment results"
    )


class ComplianceViolation(BaseModel):
    """Model for compliance violation."""

    framework: str = Field(..., description="Compliance framework")
    rule_id: str = Field(..., description="Violated rule identifier")
    title: str = Field(..., description="Violation title")
    description: str = Field(..., description="Violation description")
    severity: str = Field(..., description="Violation severity")
    detected_at: datetime = Field(..., description="When violation was detected")
    remediation_status: Optional[str] = Field(None, description="Remediation status")


class ViolationRemediationRequest(BaseModel):
    """Request model for violation remediation tracking."""

    remediation_status: str = Field(..., description="New remediation status")
    notes: Optional[str] = Field(None, description="Remediation notes")
    assigned_to: Optional[str] = Field(
        None, description="Person assigned to remediation"
    )

    @validator("remediation_status")
    def validate_status(cls, v):
        valid_statuses = [
            "open",
            "in_progress",
            "resolved",
            "accepted_risk",
            "false_positive",
        ]
        if v not in valid_statuses:
            raise ValueError(f"Invalid remediation status: {v}")
        return v


class CustomFrameworkRequest(BaseModel):
    """Request model for custom compliance framework creation."""

    framework_name: str = Field(
        ..., min_length=1, max_length=100, description="Framework name"
    )
    description: Optional[str] = Field(None, description="Framework description")
    rules: list[dict[str, Any]] = Field(..., min_items=1, description="Framework rules")

    @validator("rules")
    def validate_rules(cls, v):
        for rule in v:
            required_fields = ["title", "description", "severity", "conditions"]
            if not all(field in rule for field in required_fields):
                raise ValueError(f"Rule must include: {required_fields}")

            if rule["severity"].lower() not in ["critical", "high", "medium", "low"]:
                raise ValueError(f"Invalid severity: {rule['severity']}")

        return v


class ComplianceDashboardResponse(BaseResponse):
    """Response model for compliance dashboard."""

    organization_id: str = Field(..., description="Organization ID")
    timeframe_days: int = Field(..., description="Timeframe for analysis")
    summary: dict[str, Any] = Field(..., description="Compliance summary metrics")
    framework_compliance: dict[str, Any] = Field(
        ..., description="Framework-specific compliance"
    )
    recommendations: list[str] = Field(..., description="Compliance recommendations")
    generated_at: datetime = Field(..., description="When dashboard was generated")


class ComplianceReportRequest(BaseModel):
    """Request model for compliance report generation."""

    report_type: str = Field(..., description="Report type")
    frameworks: Optional[list[str]] = Field(None, description="Frameworks to include")
    include_recommendations: bool = Field(
        default=True, description="Include recommendations"
    )
    format: str = Field(default="json", description="Report format")


# API Endpoints


@router.post("/packages/{package_id}/assess", response_model=ComplianceCheckResponse)
async def assess_package_compliance(
    package_id: UUID,
    request: ComplianceAssessmentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assess package compliance against specified frameworks.

    Performs comprehensive compliance assessment for a package including:
    - Framework-specific rule validation
    - Violation detection and classification
    - Risk scoring and recommendations
    - Caching for performance
    """
    try:
        logger.info(
            f"User {current_user.id} requesting compliance assessment for package {package_id}"
        )

        # Convert framework strings to enum values
        frameworks = None
        if request.frameworks:
            frameworks = [ComplianceFramework(f) for f in request.frameworks]

        # Create compliance service
        compliance_service = ComplianceService(db)

        # Perform assessment
        assessment_result = await compliance_service.assess_package_compliance(
            package_id=package_id,
            frameworks=frameworks,
            force_reassessment=request.force_reassessment,
        )

        # Schedule background tasks if needed
        if assessment_result["critical_violations"] > 0:
            background_tasks.add_task(
                notify_critical_violations,
                user_id=current_user.id,
                package_id=package_id,
                violations=assessment_result["violations"],
            )

        return ComplianceCheckResponse(
            success=True,
            message=f"Compliance assessment completed for package {package_id}",
            data={
                "assessment_id": f"{package_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                "frameworks_assessed": assessment_result["frameworks_assessed"],
                "total_violations": assessment_result["total_violations"],
                "critical_violations": assessment_result["critical_violations"],
                "is_compliant": assessment_result["is_compliant"],
                "risk_score": assessment_result["risk_score"],
                "recommendations": assessment_result["recommendations"],
                "assessment_details": assessment_result,
            },
        )

    except ValidationError as e:
        logger.warning(f"Validation error in package compliance assessment: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except ComplianceError as e:
        logger.error(f"Compliance error in package assessment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(
            f"Unexpected error in package compliance assessment: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/projects/{project_id}/assess", response_model=ComplianceCheckResponse)
async def assess_project_compliance(
    project_id: UUID,
    request: ComplianceAssessmentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assess project compliance across all dependencies.

    Evaluates compliance for an entire project including:
    - All project dependencies
    - Organization-level compliance
    - Aggregate risk assessment
    - Project-specific recommendations
    """
    try:
        logger.info(
            f"User {current_user.id} requesting compliance assessment for project {project_id}"
        )

        # Validate user has access to project
        # This would typically involve checking project membership or organization access
        # For now, we'll assume authenticated users have access

        # Convert framework strings to enum values
        frameworks = None
        if request.frameworks:
            frameworks = [ComplianceFramework(f) for f in request.frameworks]

        # Create compliance service
        compliance_service = ComplianceService(db)

        # Perform assessment
        assessment_result = await compliance_service.assess_project_compliance(
            project_id=project_id,
            frameworks=frameworks,
            force_reassessment=request.force_reassessment,
        )

        # Schedule background tasks
        if assessment_result["critical_violations"] > 0:
            background_tasks.add_task(
                create_compliance_ticket,
                user_id=current_user.id,
                project_id=project_id,
                critical_violations=assessment_result["critical_violations"],
            )

        return ComplianceCheckResponse(
            success=True,
            message=f"Compliance assessment completed for project {project_id}",
            data={
                "assessment_id": f"project-{project_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                "frameworks_assessed": assessment_result["frameworks_assessed"],
                "total_violations": assessment_result["total_violations"],
                "critical_violations": assessment_result["critical_violations"],
                "is_compliant": assessment_result["is_compliant"],
                "risk_score": assessment_result["overall_risk_score"],
                "recommendations": assessment_result["recommendations"],
                "assessment_details": assessment_result,
            },
        )

    except ValidationError as e:
        logger.warning(f"Validation error in project compliance assessment: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except ComplianceError as e:
        logger.error(f"Compliance error in project assessment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(
            f"Unexpected error in project compliance assessment: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/organizations/{organization_id}/dashboard",
    response_model=ComplianceDashboardResponse,
)
async def get_compliance_dashboard(
    organization_id: UUID,
    timeframe: int = Query(default=30, ge=1, le=365, description="Timeframe in days"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate comprehensive compliance dashboard for organization.

    Provides organization-wide compliance overview including:
    - Project compliance summary
    - Framework-specific metrics
    - Violation trends
    - Compliance recommendations
    """
    try:
        logger.info(
            f"User {current_user.id} requesting compliance dashboard for organization {organization_id}"
        )

        # Validate user has access to organization
        # This would typically involve checking organization membership
        # For now, we'll assume authenticated users have access

        # Create compliance service
        compliance_service = ComplianceService(db)

        # Generate dashboard
        dashboard = await compliance_service.get_compliance_dashboard(
            organization_id=organization_id, timeframe=timeframe
        )

        return ComplianceDashboardResponse(
            success=True,
            message=f"Compliance dashboard generated for organization {organization_id}",
            data=dashboard,
        )

    except ValidationError as e:
        logger.warning(f"Validation error generating compliance dashboard: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except ComplianceError as e:
        logger.error(f"Compliance error generating dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(
            f"Unexpected error generating compliance dashboard: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/organizations/{organization_id}/frameworks/custom", response_model=BaseResponse
)
async def create_custom_framework(
    organization_id: UUID,
    request: CustomFrameworkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create custom compliance framework for organization.

    Allows organizations to define their own compliance frameworks with:
    - Custom rules and conditions
    - Organization-specific requirements
    - Flexible rule definitions
    """
    try:
        logger.info(
            f"User {current_user.id} creating custom framework {request.framework_name}"
        )

        # Validate user has admin access to organization
        # This would typically involve checking user permissions

        # Create compliance service
        compliance_service = ComplianceService(db)

        # Create custom framework
        framework_result = await compliance_service.create_custom_framework(
            organization_id=organization_id,
            framework_name=request.framework_name,
            rules=request.rules,
        )

        return BaseResponse(
            success=True,
            message=f"Custom framework '{request.framework_name}' created successfully",
            data=framework_result,
        )

    except ValidationError as e:
        logger.warning(f"Validation error creating custom framework: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except ComplianceError as e:
        logger.error(f"Compliance error creating custom framework: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error creating custom framework: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/frameworks", response_model=BaseResponse)
async def get_supported_frameworks(current_user: User = Depends(get_current_user)):
    """
    Get list of supported compliance frameworks.

    Returns all available compliance frameworks with:
    - Framework names and descriptions
    - Supported rule types
    - Assessment capabilities
    """
    try:
        from ...security.compliance_framework_registry import (
            ComplianceFrameworkRegistry,
        )

        registry = ComplianceFrameworkRegistry()
        frameworks = registry.get_supported_frameworks()

        framework_details = []
        for framework in frameworks:
            handler = registry.get_framework_handler(framework)
            rules = handler.get_rules() if handler else []

            framework_details.append(
                {
                    "name": framework.value,
                    "display_name": framework.value.replace("_", " "),
                    "total_rules": len(rules),
                    "rule_categories": list(set(rule.category for rule in rules)),
                    "severity_levels": list(set(rule.severity.value for rule in rules)),
                }
            )

        return BaseResponse(
            success=True,
            message="Retrieved supported compliance frameworks",
            data={
                "frameworks": framework_details,
                "total_frameworks": len(framework_details),
            },
        )

    except Exception as e:
        logger.error(f"Error retrieving supported frameworks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/violations/{violation_id}/remediate", response_model=BaseResponse)
async def track_violation_remediation(
    violation_id: str,
    request: ViolationRemediationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Track remediation progress for compliance violation.

    Updates violation remediation status including:
    - Status changes and progress tracking
    - Assignment to remediation owners
    - Notes and documentation
    - Completion tracking
    """
    try:
        logger.info(
            f"User {current_user.id} updating remediation status for violation {violation_id}"
        )

        # Create compliance service
        compliance_service = ComplianceService(db)

        # Track remediation
        tracking_result = await compliance_service.track_violation_remediation(
            violation_id=violation_id,
            remediation_status=request.remediation_status,
            notes=request.notes,
            assigned_to=request.assigned_to,
        )

        return BaseResponse(
            success=True,
            message=f"Violation {violation_id} remediation status updated",
            data=tracking_result,
        )

    except ValidationError as e:
        logger.warning(f"Validation error tracking violation remediation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except ComplianceError as e:
        logger.error(f"Compliance error tracking remediation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(
            f"Unexpected error tracking violation remediation: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/organizations/{organization_id}/reports/generate", response_model=BaseResponse
)
async def generate_compliance_report(
    organization_id: UUID,
    report_type: str = Query(..., description="Report type"),
    frameworks: Optional[list[str]] = Query(None, description="Frameworks to include"),
    format: str = Query(default="json", description="Report format"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate comprehensive compliance report for organization.

    Creates detailed compliance reports including:
    - Executive summary
    - Framework-specific analysis
    - Violation details and trends
    - Recommendations and action plans
    """
    try:
        logger.info(
            f"User {current_user.id} generating {report_type} report for organization {organization_id}"
        )

        # Validate report type
        valid_report_types = ["summary", "detailed", "executive", "framework_specific"]
        if report_type not in valid_report_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid report type. Must be one of: {valid_report_types}",
            )

        # Validate format
        valid_formats = ["json", "pdf", "csv"]
        if format not in valid_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid format. Must be one of: {valid_formats}",
            )

        # Convert framework strings to enum values
        framework_enums = None
        if frameworks:
            framework_enums = [ComplianceFramework(f) for f in frameworks]

        # Create compliance service
        compliance_service = ComplianceService(db)

        # Generate report based on type
        if report_type == "summary":
            dashboard = await compliance_service.get_compliance_dashboard(
                organization_id=organization_id, timeframe=30
            )
            report_data = {
                "report_type": report_type,
                "organization_id": str(organization_id),
                "generated_at": datetime.utcnow().isoformat(),
                "summary": dashboard["summary"],
                "framework_compliance": dashboard["framework_compliance"],
                "recommendations": dashboard["recommendations"],
            }
        else:
            # For other report types, would implement specific report generation logic
            report_data = {
                "report_type": report_type,
                "organization_id": str(organization_id),
                "generated_at": datetime.utcnow().isoformat(),
                "message": f"Report type '{report_type}' generation not yet implemented",
            }

        # Return report data
        if format == "json":
            return BaseResponse(
                success=True,
                message=f"{report_type.title()} report generated successfully",
                data=report_data,
            )
        else:
            # For PDF/CSV, would implement specific format generation
            return JSONResponse(
                status_code=501,
                content={
                    "success": False,
                    "message": f"Report format '{format}' not yet implemented",
                },
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating compliance report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# Background Task Functions
async def notify_critical_violations(
    user_id: UUID, package_id: UUID, violations: list[dict]
):
    """Background task to notify users of critical violations."""
    try:
        logger.info(
            f"Notifying user {user_id} of {len(violations)} critical violations for package {package_id}"
        )
        # Implementation would send email/Slack notifications
        # For now, just log the notification
        critical_violations = [v for v in violations if v.get("severity") == "critical"]
        logger.info(
            f"Found {len(critical_violations)} critical violations requiring immediate attention"
        )
    except Exception as e:
        logger.error(f"Error sending critical violation notifications: {e}")


async def create_compliance_ticket(
    user_id: UUID, project_id: UUID, critical_violations: int
):
    """Background task to create compliance tickets for critical violations."""
    try:
        logger.info(
            f"Creating compliance ticket for project {project_id} with {critical_violations} critical violations"
        )
        # Implementation would create tickets in JIRA/ServiceNow
        # For now, just log the ticket creation
        logger.info(f"Compliance ticket created for project {project_id}")
    except Exception as e:
        logger.error(f"Error creating compliance ticket: {e}")
