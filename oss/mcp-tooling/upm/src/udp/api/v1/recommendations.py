"""
Recommendations API v1.

Provides endpoints for package recommendations, alternatives, and feedback.
"""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator

from ...core.base import get_current_user
from ...core.models import User
from ...services.ai_service import ai_recommendation_service

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class RecommendationRequest(BaseModel):
    """Request model for package recommendations."""

    user_id: Optional[str] = Field(
        None, description="User ID for personalized recommendations"
    )
    project_id: Optional[str] = Field(
        None, description="Project ID for context-aware recommendations"
    )
    ecosystem: str = Field(
        "maven", description="Package ecosystem (maven, npm, pypi, etc.)"
    )
    limit: int = Field(
        10, ge=1, le=100, description="Maximum number of recommendations"
    )
    exclude_packages: Optional[set[str]] = Field(
        None, description="Packages to exclude from recommendations"
    )
    include_alternatives: bool = Field(
        True, description="Whether to include alternatives to existing packages"
    )

    @validator("ecosystem")
    def validate_ecosystem(cls, v):
        allowed = {"maven", "npm", "pypi", "gradle", "cargo", "nuget"}
        if v not in allowed:
            raise ValueError(f"Ecosystem must be one of: {allowed}")
        return v


class RecommendationResponse(BaseModel):
    """Response model for package recommendations."""

    recommendations: list[dict[str, Any]]
    total_count: int
    generated_at: datetime
    context: dict[str, Any]

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class AlternativeRequest(BaseModel):
    """Request model for package alternatives."""

    package_name: str = Field(
        ..., description="Name of the package to find alternatives for"
    )
    ecosystem: str = Field(..., description="Package ecosystem")
    limit: int = Field(5, ge=1, le=20, description="Maximum number of alternatives")
    user_id: Optional[str] = Field(
        None, description="User ID for personalized alternatives"
    )

    @validator("ecosystem")
    def validate_ecosystem(cls, v):
        allowed = {"maven", "npm", "pypi", "gradle", "cargo", "nuget"}
        if v not in allowed:
            raise ValueError(f"Ecosystem must be one of: {allowed}")
        return v


class FeedbackRequest(BaseModel):
    """Request model for user feedback."""

    user_id: str = Field(..., description="User providing feedback")
    package_name: str = Field(..., description="Package being rated")
    ecosystem: str = Field(..., description="Package ecosystem")
    feedback_score: float = Field(
        ..., ge=0.0, le=1.0, description="Feedback score from 0.0 to 1.0"
    )
    feedback_type: str = Field(
        ..., description="Type of feedback (recommendation, usage, rating)"
    )
    feedback_data: Optional[dict[str, Any]] = Field(
        None, description="Additional feedback data"
    )

    @validator("feedback_type")
    def validate_feedback_type(cls, v):
        allowed = {"recommendation", "usage", "rating", "review"}
        if v not in allowed:
            raise ValueError(f"Feedback type must be one of: {allowed}")
        return v


class FeedbackResponse(BaseModel):
    """Response model for feedback submission."""

    success: bool
    message: str
    feedback_id: Optional[str] = None


class ExplanationRequest(BaseModel):
    """Request model for recommendation explanation."""

    package_name: str = Field(..., description="Package to explain")
    user_id: Optional[str] = Field(
        None, description="User who received the recommendation"
    )
    project_id: Optional[str] = Field(None, description="Project context")


class ExplanationResponse(BaseModel):
    """Response model for recommendation explanation."""

    package: str
    confidence_score: float
    relevance_score: float
    security_score: float
    popularity_score: float
    reason: str
    benefits: list[str]
    risk_factors: list[str]
    similar_packages: list[str]
    usage_statistics: dict[str, Any]
    model_contributions: dict[str, str]


@router.post("/", response_model=RecommendationResponse)
async def get_recommendations(
    request: RecommendationRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get personalized package recommendations.

    This endpoint uses machine learning models to provide intelligent
    package recommendations based on user behavior, project context,
    and collaborative filtering.

    Args:
        request: Recommendation request parameters
        background_tasks: FastAPI background tasks
        current_user: Currently authenticated user

    Returns:
        List of recommendations with confidence scores
    """
    try:
        # Use authenticated user if no user_id provided
        if not request.user_id and current_user:
            request.user_id = str(current_user.id)

        # Get recommendations from AI service
        recommendations = await ai_recommendation_service.get_package_recommendations(
            user_id=request.user_id,
            project_id=request.project_id,
            ecosystem=request.ecosystem,
            limit=request.limit,
            exclude_packages=request.exclude_packages,
            include_alternatives=request.include_alternatives,
        )

        # Log recommendation request for analytics
        background_tasks.add_task(
            _log_recommendation_request,
            request.user_id,
            request.project_id,
            request.ecosystem,
            len(recommendations),
        )

        # Convert recommendations to dicts
        rec_dicts = []
        for rec in recommendations:
            rec_dict = {
                "package_name": rec.package_name,
                "ecosystem": rec.ecosystem,
                "version": rec.version,
                "confidence_score": rec.confidence_score,
                "relevance_score": rec.relevance_score,
                "security_score": rec.security_score,
                "popularity_score": rec.popularity_score,
                "reason": rec.reason,
                "alternative_for": rec.alternative_for,
                "similar_packages": rec.similar_packages,
                "risk_factors": rec.risk_factors,
                "benefits": rec.benefits,
                "usage_stats": rec.usage_stats,
                "last_updated": rec.last_updated.isoformat(),
            }
            rec_dicts.append(rec_dict)

        # Build context information
        context = {
            "ecosystem": request.ecosystem,
            "has_project_context": request.project_id is not None,
            "has_user_context": request.user_id is not None,
            "excluded_count": len(request.exclude_packages)
            if request.exclude_packages
            else 0,
        }

        return RecommendationResponse(
            recommendations=rec_dicts,
            total_count=len(recommendations),
            generated_at=datetime.utcnow(),
            context=context,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate recommendations: {str(e)}"
        )


@router.post("/alternatives", response_model=RecommendationResponse)
async def get_alternatives(
    request: AlternativeRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get alternative packages for a given package.

    This endpoint finds packages with similar functionality that can
    replace the specified package, considering compatibility and
    feature parity.

    Args:
        request: Alternative request parameters
        background_tasks: FastAPI background tasks
        current_user: Currently authenticated user

    Returns:
        List of alternative packages
    """
    try:
        # Use authenticated user if no user_id provided
        if not request.user_id and current_user:
            request.user_id = str(current_user.id)

        # Get alternatives from AI service
        alternatives = await ai_recommendation_service.get_alternative_packages(
            package_name=request.package_name,
            ecosystem=request.ecosystem,
            limit=request.limit,
            user_id=request.user_id,
        )

        # Log alternative request
        background_tasks.add_task(
            _log_alternative_request,
            request.user_id,
            request.package_name,
            request.ecosystem,
            len(alternatives),
        )

        # Convert to response format
        alt_dicts = []
        for alt in alternatives:
            alt_dict = {
                "package_name": alt.package_name,
                "ecosystem": alt.ecosystem,
                "version": alt.version,
                "confidence_score": alt.confidence_score,
                "relevance_score": alt.relevance_score,
                "security_score": alt.security_score,
                "popularity_score": alt.popularity_score,
                "reason": alt.reason,
                "alternative_for": alt.alternative_for,
                "similar_packages": alt.similar_packages,
                "risk_factors": alt.risk_factors,
                "benefits": alt.benefits,
                "usage_stats": alt.usage_stats,
                "last_updated": alt.last_updated.isoformat(),
            }
            alt_dicts.append(alt_dict)

        context = {
            "ecosystem": request.ecosystem,
            "base_package": request.package_name,
            "has_user_context": request.user_id is not None,
        }

        return RecommendationResponse(
            recommendations=alt_dicts,
            total_count=len(alternatives),
            generated_at=datetime.utcnow(),
            context=context,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get alternatives: {str(e)}"
        )


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    request: FeedbackRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Submit user feedback to improve recommendations.

    This endpoint allows users to rate packages and provide feedback,
    which is used to continuously improve the recommendation algorithms.

    Args:
        request: Feedback submission
        background_tasks: FastAPI background tasks
        current_user: Currently authenticated user

    Returns:
        Feedback submission status
    """
    try:
        # Validate user permissions
        if current_user and request.user_id != str(current_user.id):
            raise HTTPException(
                status_code=403, detail="Cannot submit feedback for another user"
            )

        # Submit feedback to AI service
        success = await ai_recommendation_service.update_user_feedback(
            user_id=request.user_id,
            package_name=request.package_name,
            ecosystem=request.ecosystem,
            feedback_score=request.feedback_score,
            feedback_type=request.feedback_type,
            feedback_data=request.feedback_data,
        )

        if success:
            # Log feedback for analytics
            background_tasks.add_task(
                _log_feedback_submission,
                request.user_id,
                request.package_name,
                request.ecosystem,
                request.feedback_score,
                request.feedback_type,
            )

            return FeedbackResponse(
                success=True,
                message="Feedback submitted successfully",
                feedback_id=f"{request.user_id}_{request.package_name}_{datetime.utcnow().timestamp()}",
            )
        else:
            return FeedbackResponse(success=False, message="Failed to submit feedback")

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to submit feedback: {str(e)}"
        )


@router.post("/explain", response_model=ExplanationResponse)
async def explain_recommendation(
    request: ExplanationRequest,
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get detailed explanation for a package recommendation.

    This endpoint provides insights into why a package was recommended,
    including the factors that influenced the decision and the
    confidence in the recommendation.

    Args:
        request: Explanation request parameters
        current_user: Currently authenticated user

    Returns:
        Detailed explanation of the recommendation
    """
    try:
        # Get explanation from AI service
        explanation = await ai_recommendation_service.get_recommendation_explanation(
            package_name=request.package_name,
            user_id=request.user_id,
            project_id=request.project_id,
        )

        if "error" in explanation:
            raise HTTPException(status_code=404, detail=explanation["error"])

        return ExplanationResponse(**explanation)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate explanation: {str(e)}"
        )


@router.get("/popular/{ecosystem}")
async def get_popular_packages(
    ecosystem: str,
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get popular packages in an ecosystem.

    This endpoint returns the most popular packages in a given ecosystem,
    optionally filtered by category.

    Args:
        ecosystem: Package ecosystem
        limit: Maximum number of packages to return
        category: Optional category filter
        current_user: Currently authenticated user

    Returns:
        List of popular packages
    """
    try:
        # Get personalized recommendations with no specific context
        recommendations = await ai_recommendation_service.get_package_recommendations(
            user_id=str(current_user.id) if current_user else None,
            ecosystem=ecosystem,
            limit=limit,
            exclude_packages=set(),
        )

        # Filter by category if specified
        if category:
            filtered = []
            for rec in recommendations:
                if category.lower() in [tag.lower() for tag in rec.similar_packages]:
                    filtered.append(rec)
            recommendations = filtered

        # Convert to response format
        packages = []
        for rec in recommendations:
            pkg = {
                "name": rec.package_name,
                "ecosystem": rec.ecosystem,
                "description": rec.reason,
                "popularity_score": rec.popularity_score,
                "security_score": rec.security_score,
                "last_updated": rec.last_updated.isoformat(),
                "tags": rec.similar_packages,  # Using similar_packages as tags
            }
            packages.append(pkg)

        return {
            "packages": packages,
            "ecosystem": ecosystem,
            "category": category,
            "total_count": len(packages),
            "generated_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get popular packages: {str(e)}"
        )


@router.get("/trending/{ecosystem}")
async def get_trending_packages(
    ecosystem: str,
    days: int = Query(30, ge=1, le=365, description="Number of days to consider"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of packages"),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Get trending packages in an ecosystem.

    This endpoint returns packages that are trending in popularity
    over the specified time period.

    Args:
        ecosystem: Package ecosystem
        days: Number of days to analyze
        limit: Maximum number of packages to return
        current_user: Currently authenticated user

    Returns:
        List of trending packages
    """
    try:
        # Get recommendations with focus on recent trends
        recommendations = await ai_recommendation_service.get_package_recommendations(
            user_id=str(current_user.id) if current_user else None,
            ecosystem=ecosystem,
            limit=limit * 2,  # Get more to filter
            exclude_packages=set(),
        )

        # Filter for packages with positive trends
        trending = []
        for rec in recommendations:
            # Check if usage stats indicate trending
            if rec.usage_stats.get("downloads") and rec.confidence_score > 0.6:
                trending.append(rec)

        # Sort by confidence and return top results
        trending.sort(key=lambda r: r.confidence_score, reverse=True)
        trending = trending[:limit]

        # Convert to response format
        packages = []
        for rec in trending:
            pkg = {
                "name": rec.package_name,
                "ecosystem": rec.ecosystem,
                "trend_score": rec.confidence_score,
                "description": rec.reason,
                "usage_stats": rec.usage_stats,
                "risk_level": "low"
                if rec.security_score > 0.8
                else "medium"
                if rec.security_score > 0.5
                else "high",
            }
            packages.append(pkg)

        return {
            "packages": packages,
            "ecosystem": ecosystem,
            "period_days": days,
            "total_count": len(packages),
            "generated_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get trending packages: {str(e)}"
        )


# Background task functions
async def _log_recommendation_request(
    user_id: Optional[str],
    project_id: Optional[str],
    ecosystem: str,
    recommendation_count: int,
):
    """Log recommendation request for analytics."""
    # In production, this would log to analytics service
    pass


async def _log_alternative_request(
    user_id: Optional[str], package_name: str, ecosystem: str, alternative_count: int
):
    """Log alternative request for analytics."""
    # In production, this would log to analytics service
    pass


async def _log_feedback_submission(
    user_id: str,
    package_name: str,
    ecosystem: str,
    feedback_score: float,
    feedback_type: str,
):
    """Log feedback submission for analytics."""
    # In production, this would log to analytics service
    pass
