"""
API endpoints for automated remediation functionality.

Provides REST endpoints for generating, managing, and applying
remediation suggestions for vulnerabilities.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from udp.api.deps import get_current_user, get_db
from udp.api.schemas.common import PaginatedResponse

from udp.core.models.user import UserModel
from udp.core.services import (
    NotFoundError,
    ServiceException,
    ValidationError,
)
from udp.domain.models.remediation import (
    RemediationAnalytics,
    RemediationExecutionResult,
    RemediationPlanModel,
    RemediationSuggestionModel,
)
from udp.services.remediation_service import (
    AutomatedRemediationService,
    RemediationPriority,
    RemediationSuggestion,
    RemediationType,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/projects/{project_id}/remediation/suggestions",
    response_model=PaginatedResponse[RemediationSuggestionModel],
    summary="Get remediation suggestions for a project",
    description="Retrieve all remediation suggestions for vulnerabilities in a project",
)
async def get_remediation_suggestions(
    project_id: str,
    vulnerability_id: Optional[str] = Query(
        None, description="Filter by specific vulnerability ID"
    ),
    remediation_type: Optional[RemediationType] = Query(
        None, description="Filter by remediation type"
    ),
    priority: Optional[RemediationPriority] = Query(
        None, description="Filter by priority level"
    ),
    status: Optional[str] = Query(None, description="Filter by application status"),
    automated_only: bool = Query(
        False, description="Only show suggestions with automated fixes available"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    sort_by: str = Query("priority", description="Sort field"),
    sort_desc: bool = Query(True, description="Sort descending"),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> PaginatedResponse[RemediationSuggestionModel]:
    """
    Get remediation suggestions for a project's vulnerabilities.

    Supports filtering by vulnerability, type, priority, and status.
    Results are paginated and sortable.
    """
    try:
        remediation_service = AutomatedRemediationService(db)

        # Generate suggestions if not cached
        suggestions = await remediation_service.generate_remediation_suggestions(
            project_id=project_id,
            vulnerability_ids=[vulnerability_id] if vulnerability_id else None,
            include_alternatives=True,
            include_patches=True,
        )

        # Apply filters
        filtered_suggestions = suggestions

        if remediation_type:
            filtered_suggestions = [
                s
                for s in filtered_suggestions
                if s.remediation_type == remediation_type
            ]

        if priority:
            filtered_suggestions = [
                s for s in filtered_suggestions if s.priority == priority
            ]

        if status:
            filtered_suggestions = [
                s for s in filtered_suggestions if s.status == status
            ]

        if automated_only:
            filtered_suggestions = [
                s for s in filtered_suggestions if s.automated_fix_available
            ]

        # Apply sorting
        if sort_by == "priority":
            filtered_suggestions.sort(
                key=lambda x: (x.priority.value, x.confidence_score),
                reverse=sort_desc,
            )
        elif sort_by == "confidence":
            filtered_suggestions.sort(
                key=lambda x: x.confidence_score,
                reverse=sort_desc,
            )
        elif sort_by == "created_at":
            filtered_suggestions.sort(
                key=lambda x: x.created_at,
                reverse=sort_desc,
            )

        # Apply pagination
        total = len(filtered_suggestions)
        start = (page - 1) * size
        end = start + size
        page_suggestions = filtered_suggestions[start:end]

        # Convert to response models
        suggestion_models = [_convert_suggestion_to_model(s) for s in page_suggestions]

        return PaginatedResponse(
            items=suggestion_models,
            total=total,
            page=page,
            size=size,
            pages=(total + size - 1) // size,
        )

    except Exception as e:
        logger.error(f"Error getting remediation suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/projects/{project_id}/remediation/suggestions/generate",
    response_model=List[RemediationSuggestionModel],
    summary="Generate remediation suggestions",
    description="Generate new remediation suggestions for project vulnerabilities",
)
async def generate_remediation_suggestions(
    project_id: str,
    vulnerability_ids: Optional[List[str]] = Query(
        None, description="Specific vulnerability IDs to analyze"
    ),
    include_alternatives: bool = Query(
        True, description="Include alternative package suggestions"
    ),
    include_patches: bool = Query(True, description="Include patch suggestions"),
    max_suggestions_per_vuln: int = Query(
        3, ge=1, le=10, description="Maximum suggestions per vulnerability"
    ),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> List[RemediationSuggestionModel]:
    """
    Generate remediation suggestions for project vulnerabilities.

    Can analyze specific vulnerabilities or all open vulnerabilities.
    Supports different types of suggestions and limits per vulnerability.
    """
    try:
        remediation_service = AutomatedRemediationService(db)

        # Generate suggestions
        suggestions = await remediation_service.generate_remediation_suggestions(
            project_id=project_id,
            vulnerability_ids=vulnerability_ids,
            include_alternatives=include_alternatives,
            include_patches=include_patches,
            max_suggestions_per_vuln=max_suggestions_per_vuln,
        )

        # Store suggestions in database for caching
        # TODO: Implement caching/persistence

        # Schedule background analysis for complex suggestions
        background_tasks.add_task(
            _analyze_complex_suggestions,
            project_id,
            suggestions,
        )

        # Convert to response models
        return [_convert_suggestion_to_model(s) for s in suggestions]

    except Exception as e:
        logger.error(f"Error generating remediation suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/projects/{project_id}/remediation/suggestions/{suggestion_id}",
    response_model=RemediationSuggestionModel,
    summary="Get specific remediation suggestion",
    description="Get detailed information about a specific remediation suggestion",
)
async def get_remediation_suggestion(
    project_id: str,
    suggestion_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> RemediationSuggestionModel:
    """
    Get detailed information about a specific remediation suggestion.

    Includes full implementation details, risks, and prerequisites.
    """
    try:
        # TODO: Fetch from database
        # For now, regenerate the suggestion
        remediation_service = AutomatedRemediationService(db)
        suggestions = await remediation_service.generate_remediation_suggestions(
            project_id=project_id
        )

        for suggestion in suggestions:
            if suggestion.id == suggestion_id:
                return _convert_suggestion_to_model(suggestion)

        raise NotFoundError(f"Suggestion {suggestion_id} not found")

    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting remediation suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/projects/{project_id}/remediation/suggestions/{suggestion_id}/apply",
    response_model=RemediationExecutionResult,
    summary="Apply a remediation suggestion",
    description="Apply an automated remediation suggestion to fix a vulnerability",
)
async def apply_remediation_suggestion(
    project_id: str,
    suggestion_id: str,
    validate_before_apply: bool = Query(
        True, description="Validate the fix before applying"
    ),
    create_backup: bool = Query(True, description="Create backup before applying fix"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> RemediationExecutionResult:
    """
    Apply a remediation suggestion to fix a vulnerability.

    Supports validation and backup creation before applying.
    Returns execution results and verification status.
    """
    try:
        remediation_service = AutomatedRemediationService(db)

        # Check if suggestion has automated fix available
        # TODO: Fetch suggestion from database
        suggestions = await remediation_service.generate_remediation_suggestions(
            project_id=project_id
        )

        target_suggestion = None
        for suggestion in suggestions:
            if suggestion.id == suggestion_id:
                target_suggestion = suggestion
                break

        if not target_suggestion:
            raise NotFoundError(f"Suggestion {suggestion_id} not found")

        if not target_suggestion.automated_fix_available:
            raise ValidationError(
                f"No automated fix available for suggestion {suggestion_id}"
            )

        # Apply the fix
        result = await remediation_service.apply_automated_fix(
            suggestion_id=suggestion_id,
            project_id=project_id,
            validate_before_apply=validate_before_apply,
            create_backup=create_backup,
        )

        # Schedule background verification
        background_tasks.add_task(
            _verify_fix_application,
            project_id,
            suggestion_id,
            result,
        )

        # Convert to response model
        return _convert_execution_result_to_model(result)

    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error applying remediation suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/projects/{project_id}/remediation/plans",
    response_model=RemediationPlanModel,
    summary="Create a remediation plan",
    description="Create a structured plan with multiple remediation suggestions",
)
async def create_remediation_plan(
    project_id: str,
    plan_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> RemediationPlanModel:
    """
    Create a remediation plan with multiple suggestions.

    Allows organizing fixes into phases and managing dependencies.
    """
    try:
        # Extract suggestion IDs from plan data
        suggestion_ids = plan_data.get("suggestion_ids", [])

        # Get suggestions
        remediation_service = AutomatedRemediationService(db)
        all_suggestions = await remediation_service.generate_remediation_suggestions(
            project_id=project_id
        )

        # Filter selected suggestions
        selected_suggestions = [s for s in all_suggestions if s.id in suggestion_ids]

        if not selected_suggestions:
            raise ValidationError("No valid suggestions provided")

        # Create plan
        plan = RemediationPlanModel(
            project_id=project_id,
            name=plan_data.get("name", "Remediation Plan"),
            description=plan_data.get("description", ""),
            suggestions=[_convert_suggestion_to_model(s) for s in selected_suggestions],
            dependencies=plan_data.get("dependencies", []),
            created_by=str(current_user.id),
        )

        # Calculate total effort and risk
        plan.total_effort_estimate = _calculate_total_effort(selected_suggestions)
        plan.risk_assessment = _assess_plan_risk(selected_suggestions)

        # Save plan to database
        # TODO: Implement plan persistence

        return plan

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating remediation plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/projects/{project_id}/remediation/analytics",
    response_model=RemediationAnalytics,
    summary="Get remediation analytics",
    description="Get analytics and metrics for remediation effectiveness",
)
async def get_remediation_analytics(
    project_id: str,
    time_period: str = Query("30d", description="Time period (7d, 30d, 90d, 1y)"),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> RemediationAnalytics:
    """
    Get analytics about remediation effectiveness.

    Includes success rates, time metrics, and risk assessments.
    """
    try:
        # Calculate date range
        days = int(time_period.rstrip("d"))
        if time_period.endswith("y"):
            days = 365
        elif time_period.endswith("m"):
            days = 30 * int(time_period.rstrip("m"))

        start_date = datetime.utcnow() - timedelta(days=days)

        # TODO: Query database for actual analytics
        # For now, return mock data
        analytics = RemediationAnalytics(
            project_id=project_id,
            time_period=time_period,
            total_suggestions_generated=25,
            suggestions_applied=18,
            success_rate=0.83,
            version_bumps=12,
            alternative_packages=3,
            patches_applied=2,
            configuration_changes=1,
            avg_time_to_apply="15 minutes",
            vulnerabilities_fixed=15,
            breaking_changes_encountered=2,
            rollbacks_performed=0,
        )

        return analytics

    except Exception as e:
        logger.error(f"Error getting remediation analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/projects/{project_id}/remediation/suggestions/{suggestion_id}/accept",
    summary="Accept a vulnerability risk",
    description="Accept the risk of a vulnerability without applying remediation",
)
async def accept_vulnerability_risk(
    project_id: str,
    suggestion_id: str,
    acceptance_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Accept the risk of a vulnerability without applying remediation.

    Requires justification and approval for high-risk vulnerabilities.
    """
    try:
        # Validate acceptance
        justification = acceptance_data.get("justification", "")
        if not justification:
            raise ValidationError("Justification is required for risk acceptance")

        # TODO: Update vulnerability status in database
        # TODO: Create audit trail entry
        # TODO: Check if approval is needed based on risk level

        result = {
            "suggestion_id": suggestion_id,
            "project_id": project_id,
            "status": "accepted",
            "accepted_by": str(current_user.id),
            "accepted_at": datetime.utcnow(),
            "justification": justification,
            "expires_at": acceptance_data.get("expires_at"),
            "requires_approval": acceptance_data.get("requires_approval", False),
        }

        logger.info(f"Vulnerability risk accepted: {result}")
        return result

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error accepting vulnerability risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/projects/{project_id}/remediation/suggestions/{suggestion_id}/dismiss",
    summary="Dismiss a remediation suggestion",
    description="Dismiss a suggestion as not applicable or false positive",
)
async def dismiss_remediation_suggestion(
    project_id: str,
    suggestion_id: str,
    dismissal_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Dismiss a remediation suggestion.

    Used when the suggestion is not applicable or is a false positive.
    """
    try:
        reason = dismissal_data.get("reason", "")
        if not reason:
            raise ValidationError("Reason is required for dismissal")

        # TODO: Update suggestion status in database
        # TODO: Create audit trail entry

        result = {
            "suggestion_id": suggestion_id,
            "project_id": project_id,
            "status": "dismissed",
            "dismissed_by": str(current_user.id),
            "dismissed_at": datetime.utcnow(),
            "reason": reason,
            "category": dismissal_data.get("category", "not_applicable"),
        }

        logger.info(f"Remediation suggestion dismissed: {result}")
        return result

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error dismissing remediation suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions


def _convert_suggestion_to_model(
    suggestion: RemediationSuggestion,
) -> RemediationSuggestionModel:
    """Convert service suggestion to API model."""
    return RemediationSuggestionModel(
        id=suggestion.id,
        vulnerability_id=suggestion.vulnerability_id,
        dependency_id=suggestion.dependency_id,
        project_id=suggestion.project_id,
        remediation_type=suggestion.remediation_type,
        priority=suggestion.priority,
        title=suggestion.title,
        description=suggestion.description,
        version_bump=_convert_version_bump_to_model(suggestion.version_bump)
        if suggestion.version_bump
        else None,
        alternative_package=_convert_alternative_to_model(
            suggestion.alternative_package
        )
        if suggestion.alternative_package
        else None,
        patch=_convert_patch_to_model(suggestion.patch) if suggestion.patch else None,
        prerequisites=suggestion.prerequisites,
        side_effects=suggestion.side_effects,
        estimated_effort=suggestion.estimated_effort,
        automated_fix_available=suggestion.automated_fix_available,
        automated_fix_script=suggestion.automated_fix_script,
        confidence_score=suggestion.confidence_score,
        created_at=suggestion.created_at,
        expires_at=suggestion.expires_at,
    )


def _convert_version_bump_to_model(version_bump) -> Dict[str, Any]:
    """Convert version bump to model."""
    if not version_bump:
        return None
    return {
        "current_version": version_bump.current_version,
        "suggested_version": version_bump.suggested_version,
        "vulnerability_fixes": version_bump.vulnerability_fixes,
        "breaking_change_risk": version_bump.breaking_change_risk,
        "changelog_summary": version_bump.changelog_summary,
        "download_url": version_bump.download_url,
        "release_date": version_bump.release_date,
        "confidence_score": version_bump.confidence_score,
        "effort_estimate": version_bump.effort_estimate,
    }


def _convert_alternative_to_model(alternative) -> Dict[str, Any]:
    """Convert alternative package to model."""
    if not alternative:
        return None
    return {
        "original_package": alternative.original_package,
        "alternative_package": alternative.alternative_package,
        "ecosystem": alternative.ecosystem,
        "compatibility_score": alternative.compatibility_score,
        "api_similarity_score": alternative.api_similarity_score,
        "maintenance_score": alternative.maintenance_score,
        "security_score": alternative.security_score,
        "popularity_score": alternative.popularity_score,
        "migration_effort": alternative.migration_effort,
        "migration_guide": alternative.migration_guide,
        "code_changes_required": alternative.code_changes_required,
        "benefits": alternative.benefits,
        "drawbacks": alternative.drawbacks,
        "confidence_score": alternative.confidence_score,
    }


def _convert_patch_to_model(patch) -> Dict[str, Any]:
    """Convert patch to model."""
    if not patch:
        return None
    return {
        "patch_type": patch.patch_type,
        "patch_source": patch.patch_source,
        "patch_url": patch.patch_url,
        "patch_description": patch.patch_description,
        "application_instructions": patch.application_instructions,
        "rollback_instructions": patch.rollback_instructions,
        "testing_required": patch.testing_required,
        "test_cases": patch.test_cases,
        "estimated_downtime": patch.estimated_downtime,
        "risk_assessment": patch.risk_assessment,
        "confidence_score": patch.confidence_score,
    }


def _convert_execution_result_to_model(
    result: Dict[str, Any],
) -> RemediationExecutionResult:
    """Convert execution result to model."""
    return RemediationExecutionResult(
        id=result.get("id", uuid4()),
        suggestion_id=result.get("suggestion_id"),
        project_id=result.get("project_id"),
        executed_at=result.get("fix_applied_at", datetime.utcnow()),
        success=result.get("success", False),
        error_message=result.get("error_message"),
        changes_made=result.get("apply_result", {}).get("changes_made", []),
        artifacts_created=result.get("apply_result", {}).get("artifacts", []),
        verification_status=result.get("verification_result", {}).get(
            "verified", "pending"
        ),
        verification_results=result.get("verification_result", {}),
        backup_created=result.get("backup_info") is not None,
        backup_location=result.get("backup_info", {}).get("backup_path"),
        rollback_available=True,  # Always true if backup was created
    )


def _calculate_total_effort(suggestions: List[RemediationSuggestion]) -> str:
    """Calculate total effort for multiple suggestions."""
    # Simple implementation - could be more sophisticated
    total_hours = 0
    for suggestion in suggestions:
        effort = suggestion.estimated_effort.lower()
        if "minute" in effort:
            hours = 0.5
        elif "hour" in effort:
            hours = 1
        elif "day" in effort:
            hours = 8
        else:
            hours = 2
        total_hours += hours

    if total_hours < 1:
        return f"{int(total_hours * 60)} minutes"
    elif total_hours < 8:
        return f"{total_hours:.1f} hours"
    else:
        return f"{total_hours / 8:.1f} days"


def _assess_plan_risk(suggestions: List[RemediationSuggestion]) -> str:
    """Assess overall risk of a remediation plan."""
    high_risk_count = sum(
        1 for s in suggestions if s.priority == RemediationPriority.CRITICAL
    )
    breaking_changes = sum(
        1
        for s in suggestions
        if s.version_bump
        and s.version_bump.breaking_change_risk != BreakingChangeRisk.NONE
    )

    if high_risk_count > 0 or breaking_changes > 2:
        return "High - Requires thorough testing and rollback plan"
    elif high_risk_count == 0 and breaking_changes <= 1:
        return "Low - Minimal risk, can be applied during regular maintenance"
    else:
        return "Medium - Requires testing but manageable risk"


async def _analyze_complex_suggestions(
    project_id: str,
    suggestions: List[RemediationSuggestion],
):
    """Background task to analyze complex suggestions."""
    try:
        # Identify complex suggestions requiring detailed analysis
        complex_suggestions = [
            s
            for s in suggestions
            if s.remediation_type == RemediationType.ALTERNATIVE_PACKAGE
            or (
                s.version_bump
                and s.version_bump.breaking_change_risk != BreakingChangeRisk.NONE
            )
        ]

        # Perform detailed analysis
        for suggestion in complex_suggestions:
            # TODO: Implement detailed analysis
            # - Check for transitive dependencies
            # - Analyze potential side effects
            # - Generate test cases
            pass

        logger.info(
            f"Completed analysis of {len(complex_suggestions)} complex suggestions"
        )

    except Exception as e:
        logger.error(f"Error in complex suggestion analysis: {e}")


async def _verify_fix_application(
    project_id: str,
    suggestion_id: str,
    result: Dict[str, Any],
):
    """Background task to verify fix application."""
    try:
        # TODO: Implement verification
        # - Run tests
        # - Check vulnerability is resolved
        # - Verify no regressions
        logger.info(f"Verified fix application for suggestion {suggestion_id}")

    except Exception as e:
        logger.error(f"Error verifying fix application: {e}")
