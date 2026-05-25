"""
API routes for AI-powered workflow generation and analysis.

Provides endpoints for generating workflows from natural language,
intelligent dependency analysis, and AI-powered insights.
"""

import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from udp.ai.intelligent_analyzer import (
    AnalysisResult,
    DependencyInsight,
    IntelligentAnalyzer,
)
from udp.ai.workflow_generator import WorkflowGenerator
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.core.database import get_async_session
from udp.domain.models import Organization, User, Workflow

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response Models
class WorkflowGenerationRequest(BaseModel):
    """Request model for workflow generation."""
    description: str = Field(..., description="Natural language description of the workflow")
    parameters: Optional[dict[str, Any]] = Field(default_factory=dict, description="Additional parameters")
    template_id: Optional[str] = Field(None, description="Optional template ID to base generation on")


class WorkflowGenerationResponse(BaseModel):
    """Response model for workflow generation."""
    workflow: Workflow
    suggestions: list[str] = Field(default_factory=list, description="Improvement suggestions")
    confidence_score: float = Field(..., description="Confidence score for the generated workflow")


class DependencyAnalysisRequest(BaseModel):
    """Request model for intelligent dependency analysis."""
    dependencies: list[dict[str, Any]] = Field(..., description="List of dependencies to analyze")
    analysis_types: Optional[list[str]] = Field(default_factory=list, description="Types of analysis to perform")
    time_horizon_days: Optional[int] = Field(90, description="Time horizon for predictions")


class DependencyAnalysisResponse(BaseModel):
    """Response model for dependency analysis."""
    analysis_results: list[AnalysisResult]
    insights: list[DependencyInsight]
    summary: dict[str, Any]


class WorkflowImprovementRequest(BaseModel):
    """Request model for workflow improvement suggestions."""
    workflow_id: UUID = Field(..., description="ID of the workflow to improve")
    improvement_type: Optional[str] = Field("general", description="Type of improvements to suggest")


class WorkflowImprovementResponse(BaseModel):
    """Response model for workflow improvements."""
    suggestions: list[str]
    priority: str
    estimated_impact: str


# API Endpoints
@router.post("/generate", response_model=WorkflowGenerationResponse)
async def generate_workflow_from_description(
    request: WorkflowGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Generate a workflow from natural language description.

    This endpoint uses AI to convert natural language descriptions
    into executable LangGraph workflows with proper state management.
    """
    try:
        logger.info(f"Generating workflow from description: {request.description[:100]}...")

        # Initialize workflow generator
        generator = WorkflowGenerator()

        # Generate the workflow
        workflow = generator.generate_workflow(
            description=request.description,
            organization_id=current_org.id,
            user_id=current_user.id
        )

        # Add any additional parameters
        if request.parameters:
            workflow.parameters.update(request.parameters)

        # Generate improvement suggestions
        suggestions = generator.suggest_workflow_improvements(workflow)

        # Calculate confidence score (simplified)
        confidence_score = min(0.9, 0.6 + (len(workflow.definition.get("steps", [])) * 0.05))

        # Save workflow to database (in background)
        background_tasks.add_task(_save_workflow_to_db, workflow, db)

        logger.info(f"Successfully generated workflow: {workflow.name}")

        return WorkflowGenerationResponse(
            workflow=workflow,
            suggestions=suggestions,
            confidence_score=confidence_score
        )

    except Exception as e:
        logger.error(f"Failed to generate workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate workflow: {str(e)}"
        )


@router.post("/analyze-dependencies", response_model=DependencyAnalysisResponse)
async def analyze_dependencies_intelligently(
    request: DependencyAnalysisRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Perform intelligent analysis of dependencies.

    Provides AI-powered insights into dependency health, security trends,
    performance optimization opportunities, and compliance risks.
    """
    try:
        logger.info(f"Analyzing {len(request.dependencies)} dependencies intelligently")

        # Initialize intelligent analyzer
        analyzer = IntelligentAnalyzer()

        # Perform dependency health analysis
        analysis_results = analyzer.analyze_dependency_health(
            dependencies=request.dependencies,
            organization_id=str(current_org.id)
        )

        # Generate insights for individual dependencies
        insights = []
        for dep in request.dependencies[:10]:  # Limit to first 10 for performance
            package_name = dep.get('name', '')
            ecosystem = dep.get('ecosystem', '')
            current_version = dep.get('version', '')
            latest_version = dep.get('latest_version', current_version)

            if package_name and ecosystem:
                dep_insights = analyzer.generate_dependency_insights(
                    package_name=package_name,
                    ecosystem=ecosystem,
                    current_version=current_version,
                    latest_version=latest_version
                )
                insights.extend(dep_insights)

        # Generate predictions if time horizon is specified
        if request.time_horizon_days and request.time_horizon_days > 0:
            predictions = analyzer.predict_dependency_risks(
                dependencies=request.dependencies,
                time_horizon_days=request.time_horizon_days
            )
            analysis_results.extend(predictions)

        # Create summary
        summary = _create_analysis_summary(analysis_results, insights)

        logger.info(f"Completed intelligent analysis with {len(analysis_results)} results and {len(insights)} insights")

        return DependencyAnalysisResponse(
            analysis_results=analysis_results,
            insights=insights,
            summary=summary
        )

    except Exception as e:
        logger.error(f"Failed to analyze dependencies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze dependencies: {str(e)}"
        )


@router.post("/improve-workflow", response_model=WorkflowImprovementResponse)
async def suggest_workflow_improvements(
    request: WorkflowImprovementRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Suggest improvements for an existing workflow.

    Analyzes a workflow and provides AI-powered suggestions for
    optimization, security enhancement, and best practices.
    """
    try:
        logger.info(f"Suggesting improvements for workflow: {request.workflow_id}")

        # Get workflow from database
        workflow = await _get_workflow_from_db(request.workflow_id, db)
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )

        # Check if user has access to this workflow
        if workflow.organization_id != current_org.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this workflow"
            )

        # Initialize workflow generator
        generator = WorkflowGenerator()

        # Generate improvement suggestions
        suggestions = generator.suggest_workflow_improvements(workflow)

        # Determine priority based on suggestions
        priority = "low"
        if any("security" in suggestion.lower() for suggestion in suggestions):
            priority = "high"
        elif any("performance" in suggestion.lower() for suggestion in suggestions):
            priority = "medium"

        # Estimate impact
        estimated_impact = "low"
        if len(suggestions) > 5:
            estimated_impact = "high"
        elif len(suggestions) > 2:
            estimated_impact = "medium"

        logger.info(f"Generated {len(suggestions)} improvement suggestions")

        return WorkflowImprovementResponse(
            suggestions=suggestions,
            priority=priority,
            estimated_impact=estimated_impact
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to suggest workflow improvements: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to suggest improvements: {str(e)}"
        )


@router.get("/templates", response_model=list[dict[str, Any]])
async def get_workflow_templates(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Get available workflow templates for AI generation.

    Returns a list of predefined workflow templates that can be used
    as starting points for AI-powered workflow generation.
    """
    try:
        logger.info("Retrieving workflow templates")

        # Initialize workflow generator to get templates
        generator = WorkflowGenerator()
        templates = generator._load_workflow_templates()

        # Convert to API format
        template_list = []
        for template_id, template_data in templates.items():
            template_list.append({
                "id": template_id,
                "name": template_data["name"],
                "description": template_data["description"],
                "steps": template_data["steps"],
                "estimated_complexity": len(template_data["steps"]),
                "category": _categorize_template(template_id)
            })

        logger.info(f"Retrieved {len(template_list)} workflow templates")
        return template_list

    except Exception as e:
        logger.error(f"Failed to retrieve workflow templates: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve templates: {str(e)}"
        )


@router.post("/validate-description")
async def validate_workflow_description(
    request: WorkflowGenerationRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Validate a workflow description before generation.

    Checks if a natural language description can be successfully
    parsed and provides feedback on potential issues.
    """
    try:
        logger.info("Validating workflow description")

        # Initialize workflow generator
        generator = WorkflowGenerator()

        # Parse the description
        workflow_def = generator.nlp_processor.parse_workflow_description(request.description)

        # Validate the definition
        issues = generator.validate_workflow_definition(workflow_def)

        # Determine if description is valid
        is_valid = len(issues) == 0

        # Provide feedback
        feedback = {
            "is_valid": is_valid,
            "issues": issues,
            "parsed_steps": len(workflow_def.steps),
            "trigger_type": workflow_def.trigger_type.value,
            "approval_required": workflow_def.approval_required,
            "suggestions": []
        }

        # Add suggestions for improvement
        if not is_valid:
            feedback["suggestions"].append("Fix the identified issues before generating the workflow")

        if len(workflow_def.steps) == 0:
            feedback["suggestions"].append("Add more specific steps to your description")

        if len(workflow_def.steps) > 10:
            feedback["suggestions"].append("Consider breaking the workflow into smaller parts")

        logger.info(f"Description validation completed: valid={is_valid}, issues={len(issues)}")
        return feedback

    except Exception as e:
        logger.error(f"Failed to validate workflow description: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate description: {str(e)}"
        )


# Helper Functions
async def _save_workflow_to_db(workflow: Workflow, db: AsyncSession):
    """Save workflow to database in background."""
    try:
        # This would save the workflow to the database
        # For now, just log the action
        logger.info(f"Would save workflow {workflow.name} to database")
    except Exception as e:
        logger.error(f"Failed to save workflow to database: {e}")


async def _get_workflow_from_db(workflow_id: UUID, db: AsyncSession) -> Optional[Workflow]:
    """Get workflow from database."""
    try:
        # This would query the database for the workflow
        # For now, return None (workflow not found)
        logger.info(f"Would query database for workflow {workflow_id}")
        return None
    except Exception as e:
        logger.error(f"Failed to get workflow from database: {e}")
        return None


def _create_analysis_summary(analysis_results: list[AnalysisResult], insights: list[DependencyInsight]) -> dict[str, Any]:
    """Create a summary of analysis results and insights."""
    # Count results by risk level
    risk_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for result in analysis_results:
        risk_counts[result.risk_level.value] += 1

    # Count insights by type
    insight_types = {}
    for insight in insights:
        insight_type = insight.insight_type
        insight_types[insight_type] = insight_types.get(insight_type, 0) + 1

    # Calculate overall risk score
    total_results = len(analysis_results)
    if total_results > 0:
        risk_score = (
            risk_counts["low"] * 1 +
            risk_counts["medium"] * 3 +
            risk_counts["high"] * 7 +
            risk_counts["critical"] * 10
        ) / total_results
    else:
        risk_score = 0

    return {
        "total_analyses": len(analysis_results),
        "total_insights": len(insights),
        "risk_distribution": risk_counts,
        "insight_types": insight_types,
        "overall_risk_score": round(risk_score, 2),
        "recommendations_count": sum(len(result.recommendations) for result in analysis_results)
    }


def _categorize_template(template_id: str) -> str:
    """Categorize a workflow template."""
    if "security" in template_id:
        return "security"
    elif "compliance" in template_id:
        return "compliance"
    elif "dependency" in template_id:
        return "dependency_management"
    else:
        return "general"
