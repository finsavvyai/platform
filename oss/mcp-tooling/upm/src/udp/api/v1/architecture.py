"""
Architecture API endpoints.

Provides RESTful endpoints for architecture pattern analysis,
recommendations, and cross-language integration guidance.
"""

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query

from ...core.base import get_current_user
from ...core.patterns.models import (
    ArchitecturePattern,
    ArchitectureRecommendationModel,
    BestPracticeModel,
    ComplexityLevel,
    IntegrationPatternModel,
    PatternMatchModel,
    PerformanceRecommendationModel,
)
from ...services.architecture_service import ArchitectureService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/architecture", tags=["architecture"])
architecture_service = ArchitectureService()


@router.get(
    "/projects/{project_id}/recommendations",
    response_model=ArchitectureRecommendationModel,
    summary="Get Architecture Recommendations",
    description="Get comprehensive architecture recommendations including patterns, integration strategies, best practices, and performance optimizations.",
)
async def get_architecture_recommendations(
    project_id: str = Path(..., description="Project ID to analyze"),
    user_id: Optional[str] = Query(
        None, description="User ID for personalized recommendations"
    ),
    force_refresh: bool = Query(
        False, description="Force fresh analysis instead of using cache"
    ),
    include_project_structure: bool = Query(
        False, description="Include file structure analysis"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get comprehensive architecture recommendations for a project.

    This endpoint analyzes the project's dependency structure, language mix,
    and integration patterns to provide actionable recommendations for:
    - Architecture pattern detection
    - Cross-language integration strategies
    - Best practice suggestions
    - Performance optimization opportunities

    The analysis is cached for 1 hour to improve performance.
    """
    try:
        # Verify user has access to the project
        # This would check project permissions in a real implementation

        recommendations = await architecture_service.get_architecture_recommendations(
            project_id=project_id,
            user_id=user_id or current_user.get("id"),
            force_refresh=force_refresh,
            include_project_structure=include_project_structure,
        )

        return recommendations

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting architecture recommendations: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to generate architecture recommendations"
        )


@router.get(
    "/projects/{project_id}/patterns",
    response_model=list[PatternMatchModel],
    summary="Detect Architecture Patterns",
    description="Detect and analyze architecture patterns used in the project.",
)
async def detect_patterns(
    project_id: str = Path(..., description="Project ID to analyze"),
    pattern_types: Optional[list[ArchitecturePattern]] = Query(
        None, description="Specific patterns to focus on"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Detect architecture patterns in the project.

    Analyzes the project structure and dependencies to identify
    architecture patterns such as microservices, event-driven,
    API gateway, and cross-language integration patterns.
    """
    try:
        patterns = await architecture_service.detect_patterns(
            project_id=project_id,
            pattern_types=pattern_types,
        )

        return [PatternMatchModel.from_orm(p) for p in patterns]

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error detecting patterns: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to detect architecture patterns"
        )


@router.get(
    "/projects/{project_id}/integration-recommendations",
    response_model=list[IntegrationPatternModel],
    summary="Get Integration Recommendations",
    description="Get recommendations for cross-language integration patterns and technologies.",
)
async def get_integration_recommendations(
    project_id: str = Path(..., description="Project ID to analyze"),
    target_languages: Optional[list[str]] = Query(
        None, description="Target languages to integrate with"
    ),
    performance_requirements: Optional[str] = Query(
        None, description="Performance requirements (low, standard, high, very_high)"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get integration pattern recommendations for cross-language communication.

    Based on the project's language mix and performance requirements,
    provides recommendations for integration technologies such as:
    - REST APIs
    - gRPC
    - Message Queues
    - Py4J (Python-Java)
    - WebAssembly
    """
    try:
        recommendations = await architecture_service.get_integration_recommendations(
            project_id=project_id,
            target_languages=target_languages,
            performance_requirements=performance_requirements,
        )

        return [IntegrationPatternModel.from_orm(r) for r in recommendations]

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting integration recommendations: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get integration recommendations"
        )


@router.get(
    "/projects/{project_id}/best-practices",
    response_model=list[BestPracticeModel],
    summary="Get Best Practices",
    description="Get best practice recommendations based on detected patterns and project characteristics.",
)
async def get_best_practices(
    project_id: str = Path(..., description="Project ID to analyze"),
    categories: Optional[list[str]] = Query(
        None,
        description="Specific categories to focus on (e.g., 'API Design', 'Performance')",
    ),
    pattern_focus: Optional[list[ArchitecturePattern]] = Query(
        None, description="Patterns to focus recommendations on"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get best practice recommendations for the project.

    Provides contextual best practices based on:
    - Detected architecture patterns
    - Technology stack
    - Project size and complexity
    - Cross-language integration needs

    Categories include:
    - Cross-Language Integration
    - API Design
    - Performance
    - Security
    """
    try:
        best_practices = await architecture_service.get_best_practices(
            project_id=project_id,
            categories=categories,
            pattern_focus=pattern_focus,
        )

        return [BestPracticeModel.from_orm(bp) for bp in best_practices]

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting best practices: {e}")
        raise HTTPException(status_code=500, detail="Failed to get best practices")


@router.get(
    "/projects/{project_id}/performance-recommendations",
    response_model=list[PerformanceRecommendationModel],
    summary="Get Performance Recommendations",
    description="Get performance optimization recommendations for the project.",
)
async def get_performance_recommendations(
    project_id: str = Path(..., description="Project ID to analyze"),
    focus_areas: Optional[list[str]] = Query(
        None, description="Areas to focus on (e.g., 'database', 'network', 'memory')"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get performance optimization recommendations.

    Analyzes the project for performance bottlenecks and provides
    actionable recommendations for optimization including:
    - Dependency management
    - Cross-language communication
    - Database connections
    - Caching strategies
    """
    try:
        recommendations = await architecture_service.get_performance_recommendations(
            project_id=project_id,
            focus_areas=focus_areas,
        )

        return [PerformanceRecommendationModel.from_orm(r) for r in recommendations]

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting performance recommendations: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get performance recommendations"
        )


@router.post(
    "/compare",
    summary="Compare Project Architectures",
    description="Compare architecture patterns and recommendations across multiple projects.",
)
async def compare_architectures(
    project_ids: list[str] = Query(..., description="List of project IDs to compare"),
    current_user: dict = Depends(get_current_user),
):
    """
    Compare architecture patterns across multiple projects.

    Provides insights into:
    - Common patterns across projects
    - Pattern diversity
    - Performance issue distribution
    - Recommendations for standardization
    """
    try:
        if len(project_ids) > 10:
            raise HTTPException(
                status_code=400, detail="Cannot compare more than 10 projects at once"
            )

        # Verify user has access to all projects
        # This would check permissions for each project

        comparison = await architecture_service.compare_architectures(project_ids)

        return comparison

    except Exception as e:
        logger.error(f"Error comparing architectures: {e}")
        raise HTTPException(status_code=500, detail="Failed to compare architectures")


@router.post(
    "/recommendations/{recommendation_id}/track",
    summary="Track Recommendation Adoption",
    description="Track the adoption and feedback of specific recommendations.",
)
async def track_recommendation_adoption(
    recommendation_id: str = Path(..., description="Recommendation ID to track"),
    project_id: str = Query(..., description="Project ID"),
    status: str = Query(
        ..., description="Adoption status (accepted, rejected, implemented)"
    ),
    feedback: Optional[str] = Query(None, description="User feedback"),
    current_user: dict = Depends(get_current_user),
):
    """
    Track recommendation adoption and collect feedback.

    This endpoint helps improve the recommendation engine by:
    - Tracking which recommendations are implemented
    - Collecting user feedback
    - Measuring recommendation effectiveness
    """
    try:
        success = await architecture_service.track_recommendation_adoption(
            project_id=project_id,
            recommendation_id=recommendation_id,
            status=status,
            feedback=feedback,
        )

        if success:
            return {"message": "Adoption tracked successfully", "status": status}
        else:
            raise HTTPException(status_code=500, detail="Failed to track adoption")

    except Exception as e:
        logger.error(f"Error tracking recommendation adoption: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to track recommendation adoption"
        )


@router.get(
    "/patterns",
    summary="List Available Patterns",
    description="List all supported architecture patterns for analysis.",
)
async def list_supported_patterns(
    current_user: dict = Depends(get_current_user),
):
    """
    List all supported architecture patterns.

    Returns a comprehensive list of patterns that can be detected
    and recommended by the architecture analysis engine.
    """
    patterns = {
        "integration_patterns": [
            {
                "value": pattern.value,
                "name": pattern.value.replace("_", " ").title(),
                "description": f"Analysis for {pattern.value} architecture pattern",
            }
            for pattern in ArchitecturePattern
        ],
        "complexity_levels": [
            {
                "value": level.value,
                "name": level.value.title(),
                "description": f"{level.value} implementation complexity",
            }
            for level in ComplexityLevel
        ],
        "integration_technologies": [
            "rest",
            "grpc",
            "message_queue",
            "py4j",
            "wasm",
            "jni",
        ],
    }

    return patterns


@router.post(
    "/projects/{project_id}/analyze",
    summary="Trigger Architecture Analysis",
    description="Trigger a fresh architecture analysis for the project.",
)
async def trigger_analysis(
    project_id: str = Path(..., description="Project ID to analyze"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    force_refresh: bool = Query(True, description="Force fresh analysis"),
    include_structure: bool = Query(
        True, description="Include file structure analysis"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Trigger architecture analysis in the background.

    This endpoint initiates a comprehensive architecture analysis
    and returns immediately. The results will be cached and can
    be retrieved using the recommendations endpoint.
    """
    try:
        # Schedule background analysis
        background_tasks.add_task(
            architecture_service.get_architecture_recommendations,
            project_id=project_id,
            user_id=current_user.get("id"),
            force_refresh=force_refresh,
            include_project_structure=include_structure,
        )

        return {
            "message": "Architecture analysis initiated",
            "project_id": project_id,
            "status": "in_progress",
        }

    except Exception as e:
        logger.error(f"Error triggering analysis: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to trigger architecture analysis"
        )
