"""
Workflow Marketplace API Endpoints
Netflix-style workflow discovery and community features
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
import logging

from app.services.workflow_marketplace import (
    WorkflowMarketplaceService,
    WorkflowTemplate,
    WorkflowReview,
    MarketplaceAnalytics,
    WorkflowCategory,
    WorkflowComplexity,
    PricingModel,
    MarketplaceStatus,
    workflow_marketplace_service
)
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for API
class WorkflowTemplateResponse(BaseModel):
    """API response model for workflow template"""
    id: str
    name: str
    description: str
    category: str
    complexity: str
    author_id: str
    author_name: str
    version: str
    tags: List[str]
    pricing_model: str
    price: Optional[float]
    created_at: str
    updated_at: str
    downloads: int
    rating: float
    review_count: int
    status: str
    featured: bool
    verified_author: bool

    @classmethod
    def from_template(cls, template: WorkflowTemplate):
        return cls(
            id=template.id,
            name=template.name,
            description=template.description,
            category=template.category.value,
            complexity=template.complexity.value,
            author_id=template.author_id,
            author_name=template.author_name,
            version=template.version,
            tags=template.tags,
            pricing_model=template.pricing_model.value,
            price=template.price,
            created_at=template.created_at.isoformat(),
            updated_at=template.updated_at.isoformat(),
            downloads=template.downloads,
            rating=template.rating,
            review_count=template.review_count,
            status=template.status.value,
            featured=template.featured,
            verified_author=template.verified_author
        )


class PublishWorkflowRequest(BaseModel):
    """Request to publish a workflow"""
    name: str = Field(..., description="Workflow name")
    description: str = Field(..., description="Workflow description")
    category: WorkflowCategory = Field(..., description="Workflow category")
    complexity: WorkflowComplexity = Field(..., description="Complexity level")
    tags: List[str] = Field(default=[], description="Workflow tags")
    pricing_model: PricingModel = Field(default=PricingModel.FREE, description="Pricing model")
    price: Optional[float] = Field(default=0.0, description="Price for paid workflows")
    workflow_definition: dict = Field(..., description="Workflow definition JSON")


class WorkflowSearchRequest(BaseModel):
    """Workflow search parameters"""
    query: str = Field(default="", description="Search query")
    category: Optional[WorkflowCategory] = Field(None, description="Filter by category")
    complexity: Optional[WorkflowComplexity] = Field(None, description="Filter by complexity")
    pricing: Optional[PricingModel] = Field(None, description="Filter by pricing model")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    sort_by: str = Field(default="relevance", description="Sort order")
    limit: int = Field(default=20, description="Number of results")
    offset: int = Field(default=0, description="Pagination offset")


class WorkflowReviewRequest(BaseModel):
    """Request to review a workflow"""
    rating: int = Field(..., ge=1, le=5, description="Rating (1-5 stars)")
    comment: str = Field(default="", description="Review comment")


class WorkflowReviewResponse(BaseModel):
    """API response for workflow review"""
    id: str
    workflow_id: str
    user_id: str
    user_name: str
    rating: int
    comment: str
    created_at: str
    helpful_votes: int
    verified_purchase: bool

    @classmethod
    def from_review(cls, review: WorkflowReview):
        return cls(
            id=review.id,
            workflow_id=review.workflow_id,
            user_id=review.user_id,
            user_name=review.user_name,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at.isoformat(),
            helpful_votes=review.helpful_votes,
            verified_purchase=review.verified_purchase
        )


class MarketplaceAnalyticsResponse(BaseModel):
    """API response for marketplace analytics"""
    total_workflows: int
    total_downloads: int
    total_revenue: float
    top_categories: List[tuple]
    trending_workflows: List[str]
    user_engagement: dict

    @classmethod
    def from_analytics(cls, analytics: MarketplaceAnalytics):
        return cls(
            total_workflows=analytics.total_workflows,
            total_downloads=analytics.total_downloads,
            total_revenue=analytics.total_revenue,
            top_categories=analytics.top_categories,
            trending_workflows=analytics.trending_workflows,
            user_engagement=analytics.user_engagement
        )


@router.get("/health")
async def health_check():
    """Health check for workflow marketplace"""
    return {
        "status": "healthy",
        "service": "workflow_marketplace",
        "features": [
            "workflow_discovery",
            "ai_recommendations",
            "community_reviews",
            "monetization"
        ]
    }


@router.post("/publish", response_model=WorkflowTemplateResponse)
async def publish_workflow(
    request: PublishWorkflowRequest,
    current_user: User = Depends(get_current_user)
):
    """Publish a workflow to the marketplace"""
    try:
        logger.info(f"User {current_user.email} publishing workflow: {request.name}")

        metadata = {
            'name': request.name,
            'description': request.description,
            'category': request.category.value,
            'complexity': request.complexity.value,
            'tags': request.tags,
            'pricing_model': request.pricing_model.value,
            'price': request.price,
            'author_name': current_user.email  # Use email as display name for now
        }

        template = await workflow_marketplace_service.publish_workflow(
            workflow_definition=request.workflow_definition,
            metadata=metadata,
            author_id=str(current_user.id)
        )

        return WorkflowTemplateResponse.from_template(template)

    except Exception as e:
        logger.error(f"Failed to publish workflow: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to publish workflow: {str(e)}")


@router.get("/search", response_model=List[WorkflowTemplateResponse])
async def search_workflows(
    query: str = Query("", description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    complexity: Optional[str] = Query(None, description="Filter by complexity"),
    pricing: Optional[str] = Query(None, description="Filter by pricing model"),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    sort_by: str = Query("relevance", description="Sort order"),
    limit: int = Query(20, ge=1, le=100, description="Number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """Search workflows in the marketplace"""
    try:
        # Parse optional parameters
        category_enum = WorkflowCategory(category) if category else None
        complexity_enum = WorkflowComplexity(complexity) if complexity else None
        pricing_enum = PricingModel(pricing) if pricing else None
        tags_list = tags.split(',') if tags else None

        templates = await workflow_marketplace_service.search_workflows(
            query=query,
            category=category_enum,
            complexity=complexity_enum,
            pricing=pricing_enum,
            tags=tags_list,
            sort_by=sort_by,
            limit=limit,
            offset=offset
        )

        return [WorkflowTemplateResponse.from_template(t) for t in templates]

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")
    except Exception as e:
        logger.error(f"Workflow search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/recommendations", response_model=List[WorkflowTemplateResponse])
async def get_recommendations(
    count: int = Query(10, ge=1, le=50, description="Number of recommendations"),
    context: Optional[str] = Query(None, description="Context for recommendations (JSON)"),
    current_user: User = Depends(get_current_user)
):
    """Get AI-powered workflow recommendations"""
    try:
        # Parse context if provided
        context_dict = None
        if context:
            import json
            try:
                context_dict = json.loads(context)
            except json.JSONDecodeError:
                logger.warning(f"Invalid context JSON: {context}")

        recommendations = await workflow_marketplace_service.get_workflow_recommendations(
            user_id=str(current_user.id),
            context=context_dict,
            count=count
        )

        return [WorkflowTemplateResponse.from_template(r) for r in recommendations]

    except Exception as e:
        logger.error(f"Failed to get recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")


@router.get("/trending", response_model=List[WorkflowTemplateResponse])
async def get_trending_workflows(
    count: int = Query(10, ge=1, le=50, description="Number of trending workflows")
):
    """Get currently trending workflows"""
    try:
        trending = await workflow_marketplace_service.get_trending_workflows(count)
        return [WorkflowTemplateResponse.from_template(t) for t in trending]

    except Exception as e:
        logger.error(f"Failed to get trending workflows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get trending workflows: {str(e)}")


@router.get("/featured", response_model=List[WorkflowTemplateResponse])
async def get_featured_workflows():
    """Get featured workflows"""
    try:
        # Get all workflows and filter featured ones
        all_workflows = await workflow_marketplace_service._get_mock_workflow_templates()
        featured = [w for w in all_workflows if w.featured]

        return [WorkflowTemplateResponse.from_template(w) for w in featured]

    except Exception as e:
        logger.error(f"Failed to get featured workflows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get featured workflows: {str(e)}")


@router.get("/categories")
async def get_categories():
    """Get available workflow categories"""
    return {
        "categories": [
            {
                "id": category.value,
                "name": category.value.replace('_', ' ').title(),
                "description": f"Workflows related to {category.value.replace('_', ' ')}"
            }
            for category in WorkflowCategory
        ]
    }


@router.get("/complexity-levels")
async def get_complexity_levels():
    """Get available complexity levels"""
    return {
        "complexity_levels": [
            {
                "id": level.value,
                "name": level.value.title(),
                "description": f"Workflows suitable for {level.value} users"
            }
            for level in WorkflowComplexity
        ]
    }


@router.get("/pricing-models")
async def get_pricing_models():
    """Get available pricing models"""
    return {
        "pricing_models": [
            {
                "id": model.value,
                "name": model.value.replace('_', ' ').title(),
                "description": f"Workflows with {model.value.replace('_', ' ')} pricing"
            }
            for model in PricingModel
        ]
    }


@router.get("/{workflow_id}", response_model=WorkflowTemplateResponse)
async def get_workflow_details(workflow_id: str):
    """Get detailed information about a specific workflow"""
    try:
        # Get workflow from mock data
        all_workflows = await workflow_marketplace_service._get_mock_workflow_templates()
        workflow = next((w for w in all_workflows if w.id == workflow_id), None)

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        return WorkflowTemplateResponse.from_template(workflow)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get workflow details: {str(e)}")


@router.post("/{workflow_id}/review", response_model=WorkflowReviewResponse)
async def review_workflow(
    workflow_id: str,
    request: WorkflowReviewRequest,
    current_user: User = Depends(get_current_user)
):
    """Submit a review for a workflow"""
    try:
        review = await workflow_marketplace_service.rate_workflow(
            workflow_id=workflow_id,
            user_id=str(current_user.id),
            rating=request.rating,
            comment=request.comment
        )

        return WorkflowReviewResponse.from_review(review)

    except Exception as e:
        logger.error(f"Failed to submit review: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit review: {str(e)}")


@router.get("/{workflow_id}/reviews", response_model=List[WorkflowReviewResponse])
async def get_workflow_reviews(
    workflow_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get reviews for a specific workflow"""
    try:
        # Mock reviews for demonstration
        mock_reviews = [
            WorkflowReview(
                id="review_001",
                workflow_id=workflow_id,
                user_id="user_001",
                user_name="DevOps Engineer",
                rating=5,
                comment="Excellent workflow! Saved me hours of setup time.",
                created_at="2024-01-01T00:00:00Z",
                helpful_votes=12,
                verified_purchase=True
            ),
            WorkflowReview(
                id="review_002",
                workflow_id=workflow_id,
                user_id="user_002",
                user_name="Cloud Architect",
                rating=4,
                comment="Good workflow, but could use better documentation.",
                created_at="2024-01-01T00:00:00Z",
                helpful_votes=8,
                verified_purchase=True
            )
        ]

        # Apply pagination
        paginated_reviews = mock_reviews[offset:offset + limit]

        return [WorkflowReviewResponse.from_review(r) for r in paginated_reviews]

    except Exception as e:
        logger.error(f"Failed to get reviews: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get reviews: {str(e)}")


@router.get("/analytics/marketplace", response_model=MarketplaceAnalyticsResponse)
async def get_marketplace_analytics():
    """Get overall marketplace analytics"""
    try:
        analytics = await workflow_marketplace_service.get_workflow_analytics()
        return MarketplaceAnalyticsResponse.from_analytics(analytics)

    except Exception as e:
        logger.error(f"Failed to get marketplace analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@router.get("/analytics/author", response_model=MarketplaceAnalyticsResponse)
async def get_author_analytics(current_user: User = Depends(get_current_user)):
    """Get analytics for the current user's published workflows"""
    try:
        analytics = await workflow_marketplace_service.get_workflow_analytics(
            author_id=str(current_user.id)
        )
        return MarketplaceAnalyticsResponse.from_analytics(analytics)

    except Exception as e:
        logger.error(f"Failed to get author analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get author analytics: {str(e)}")


@router.post("/{workflow_id}/download")
async def download_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download/purchase a workflow"""
    try:
        # In a real implementation, this would:
        # 1. Check if payment is required
        # 2. Process payment if needed
        # 3. Grant access to the workflow
        # 4. Increment download counter
        # 5. Return the workflow definition

        logger.info(f"User {current_user.email} downloading workflow {workflow_id}")

        return {
            "status": "success",
            "workflow_id": workflow_id,
            "download_url": f"/api/v1/workflows/{workflow_id}/definition",
            "access_granted": True,
            "message": "Workflow downloaded successfully"
        }

    except Exception as e:
        logger.error(f"Failed to download workflow: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download workflow: {str(e)}")


@router.get("/my/published", response_model=List[WorkflowTemplateResponse])
async def get_my_published_workflows(current_user: User = Depends(get_current_user)):
    """Get workflows published by the current user"""
    try:
        # Filter workflows by author
        all_workflows = await workflow_marketplace_service._get_mock_workflow_templates()
        my_workflows = [w for w in all_workflows if w.author_id == str(current_user.id)]

        return [WorkflowTemplateResponse.from_template(w) for w in my_workflows]

    except Exception as e:
        logger.error(f"Failed to get published workflows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get published workflows: {str(e)}")


@router.get("/my/purchased", response_model=List[WorkflowTemplateResponse])
async def get_my_purchased_workflows(current_user: User = Depends(get_current_user)):
    """Get workflows purchased by the current user"""
    try:
        # In a real implementation, this would query the purchase history
        # For now, return a subset of workflows as demo
        all_workflows = await workflow_marketplace_service._get_mock_workflow_templates()
        purchased_workflows = all_workflows[:3]  # Mock purchased workflows

        return [WorkflowTemplateResponse.from_template(w) for w in purchased_workflows]

    except Exception as e:
        logger.error(f"Failed to get purchased workflows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get purchased workflows: {str(e)}")


# Import necessary classes for response models
from app.services.workflow_marketplace import WorkflowReview
from datetime import datetime