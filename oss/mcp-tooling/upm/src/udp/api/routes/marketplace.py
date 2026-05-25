"""
Marketplace API Routes.

Provides REST API endpoints for workflow template marketplace functionality
including browsing, purchasing, and managing templates.
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.domain.models import Organization, User
from udp.marketplace.models import (
    CustomizationPoint,
    PricingModel,
    QualityTier,
    TemplateCategory,
    WorkflowTemplate,
)
from udp.marketplace.workflow_marketplace import WorkflowMarketplace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# Request/Response Models
class TemplatePublishRequest(BaseModel):
    """Request model for publishing a template."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=10, max_length=1000)
    category: TemplateCategory
    workflow_definition: dict[str, Any]
    customization_points: list[dict[str, Any]] = Field(default_factory=list)
    pricing_model: PricingModel
    base_price: Optional[float] = Field(None, ge=0)
    monthly_fee: Optional[float] = Field(None, ge=0)
    per_execution_fee: Optional[float] = Field(None, ge=0)
    setup_fee: Optional[float] = Field(None, ge=0)
    tags: list[str] = Field(default_factory=list)
    documentation_url: Optional[str] = None
    support_contact: Optional[str] = None


class TemplatePurchaseRequest(BaseModel):
    """Request model for purchasing a template."""
    template_id: str
    customizations: dict[str, Any] = Field(default_factory=dict)


class TemplateBrowseRequest(BaseModel):
    """Request model for browsing templates."""
    category: Optional[TemplateCategory] = None
    quality_tier: Optional[QualityTier] = None
    pricing_model: Optional[PricingModel] = None
    search_query: Optional[str] = None
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)


class TemplateResponse(BaseModel):
    """Response model for template data."""
    id: str
    name: str
    description: str
    category: str
    creator_name: str
    version: str
    pricing_model: str
    base_price: Optional[float]
    monthly_fee: Optional[float]
    per_execution_fee: Optional[float]
    setup_fee: Optional[float]
    quality_tier: str
    tags: list[str]
    download_count: int
    purchase_count: int
    rating: float
    review_count: int
    created_at: str
    updated_at: str


class PurchaseResponse(BaseModel):
    """Response model for template purchase."""
    purchase_id: str
    template_id: str
    workflow_id: str
    total_amount: float
    currency: str
    payment_status: str
    customization_options: list[dict[str, Any]]


class BrowseResponse(BaseModel):
    """Response model for template browsing."""
    templates: list[TemplateResponse]
    total_count: int
    has_more: bool


# API Endpoints
@router.post("/templates", response_model=dict[str, Any])
async def publish_template(
    request: TemplatePublishRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Publish a new workflow template to the marketplace.

    Args:
        request: Template publication request
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        Publication result with template ID and validation status
    """
    try:
        logger.info(f"Publishing template: {request.name} by user {current_user.email}")

        # Create template object
        template = WorkflowTemplate(
            name=request.name,
            description=request.description,
            category=request.category,
            creator_id=current_user.id,
            creator_name=current_user.email,
            workflow_definition=request.workflow_definition,
            customization_points=[
                CustomizationPoint(**cp) for cp in request.customization_points
            ],
            pricing_model=request.pricing_model,
            base_price=request.base_price,
            monthly_fee=request.monthly_fee,
            per_execution_fee=request.per_execution_fee,
            setup_fee=request.setup_fee,
            tags=request.tags,
            documentation_url=request.documentation_url,
            support_contact=request.support_contact
        )

        # Publish template
        marketplace = WorkflowMarketplace()
        result = await marketplace.publish_template(template, current_user)

        if result["status"] == "success":
            return {
                "status": "success",
                "message": "Template published successfully",
                "template_id": result["template_id"],
                "validation_results": result.get("validation_results"),
                "security_review": result.get("security_review")
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Template publication failed")
            )

    except Exception as e:
        logger.error(f"Template publication failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Template publication failed: {str(e)}"
        )


@router.get("/templates", response_model=BrowseResponse)
async def browse_templates(
    category: Optional[TemplateCategory] = Query(None, description="Filter by category"),
    quality_tier: Optional[QualityTier] = Query(None, description="Filter by quality tier"),
    pricing_model: Optional[PricingModel] = Query(None, description="Filter by pricing model"),
    search_query: Optional[str] = Query(None, description="Search in name and description"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_current_user)
):
    """
    Browse available workflow templates with filtering and pagination.

    Args:
        category: Filter by template category
        quality_tier: Filter by quality tier
        pricing_model: Filter by pricing model
        search_query: Search in name and description
        limit: Maximum number of results
        offset: Number of results to skip
        current_user: Current authenticated user

    Returns:
        List of matching templates with metadata
    """
    try:
        logger.info(f"Browsing templates with filters: category={category}, search={search_query}")

        marketplace = WorkflowMarketplace()
        result = await marketplace.browse_templates(
            category=category,
            quality_tier=quality_tier,
            pricing_model=pricing_model,
            search_query=search_query,
            limit=limit,
            offset=offset
        )

        if result["status"] == "success":
            templates = [
                TemplateResponse(
                    id=template.id,
                    name=template.name,
                    description=template.description,
                    category=template.category.value,
                    creator_name=template.creator_name,
                    version=template.version,
                    pricing_model=template.pricing_model.value,
                    base_price=template.base_price,
                    monthly_fee=template.monthly_fee,
                    per_execution_fee=template.per_execution_fee,
                    setup_fee=template.setup_fee,
                    quality_tier=template.quality_tier.value,
                    tags=template.tags,
                    download_count=template.download_count,
                    purchase_count=template.purchase_count,
                    rating=template.rating,
                    review_count=template.review_count,
                    created_at=template.created_at.isoformat(),
                    updated_at=template.updated_at.isoformat()
                )
                for template in result["templates"]
            ]

            return BrowseResponse(
                templates=templates,
                total_count=result["total_count"],
                has_more=result["has_more"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to browse templates")
            )

    except Exception as e:
        logger.error(f"Template browsing failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Template browsing failed: {str(e)}"
        )


@router.get("/templates/{template_id}", response_model=dict[str, Any])
async def get_template_details(
    template_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information about a specific template.

    Args:
        template_id: ID of the template
        current_user: Current authenticated user

    Returns:
        Detailed template information with reviews and statistics
    """
    try:
        logger.info(f"Getting template details: {template_id}")

        marketplace = WorkflowMarketplace()
        result = await marketplace.get_template_details(template_id)

        if result["status"] == "success":
            return {
                "status": "success",
                "template": result["template"],
                "reviews": result["reviews"],
                "statistics": result["statistics"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Template not found")
            )

    except Exception as e:
        logger.error(f"Failed to get template details: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template details: {str(e)}"
        )


@router.post("/templates/{template_id}/purchase", response_model=PurchaseResponse)
async def purchase_template(
    template_id: str,
    request: TemplatePurchaseRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Purchase and install a workflow template for the organization.

    Args:
        template_id: ID of the template to purchase
        request: Purchase request with customizations
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        Purchase result with installation details
    """
    try:
        logger.info(f"Purchasing template {template_id} for organization {current_org.id}")

        marketplace = WorkflowMarketplace()
        result = await marketplace.purchase_template(
            template_id=template_id,
            organization=current_org,
            purchaser=current_user,
            customizations=request.customizations
        )

        if result["status"] == "success":
            return PurchaseResponse(
                purchase_id=result["purchase_id"],
                template_id=template_id,
                workflow_id=result["workflow_id"],
                total_amount=result["total_amount"],
                currency="USD",
                payment_status="completed",
                customization_options=result["customization_options"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Template purchase failed")
            )

    except Exception as e:
        logger.error(f"Template purchase failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Template purchase failed: {str(e)}"
        )


@router.get("/categories", response_model=list[dict[str, str]])
async def get_categories():
    """
    Get list of available template categories.

    Returns:
        List of category information
    """
    try:
        categories = [
            {"value": category.value, "label": category.value.replace("_", " ").title()}
            for category in TemplateCategory
        ]
        return categories

    except Exception as e:
        logger.error(f"Failed to get categories: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}"
        )


@router.get("/pricing-models", response_model=list[dict[str, str]])
async def get_pricing_models():
    """
    Get list of available pricing models.

    Returns:
        List of pricing model information
    """
    try:
        pricing_models = [
            {"value": model.value, "label": model.value.replace("_", " ").title()}
            for model in PricingModel
        ]
        return pricing_models

    except Exception as e:
        logger.error(f"Failed to get pricing models: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pricing models: {str(e)}"
        )


@router.get("/quality-tiers", response_model=list[dict[str, str]])
async def get_quality_tiers():
    """
    Get list of available quality tiers.

    Returns:
        List of quality tier information
    """
    try:
        quality_tiers = [
            {"value": tier.value, "label": tier.value.replace("_", " ").title()}
            for tier in QualityTier
        ]
        return quality_tiers

    except Exception as e:
        logger.error(f"Failed to get quality tiers: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quality tiers: {str(e)}"
        )


@router.get("/my-templates", response_model=list[TemplateResponse])
async def get_my_templates(
    current_user: User = Depends(get_current_user)
):
    """
    Get templates created by the current user.

    Args:
        current_user: Current authenticated user

    Returns:
        List of user's templates
    """
    try:
        logger.info(f"Getting templates for user {current_user.email}")

        # In production, this would query the template registry for user's templates
        # For now, return empty list
        return []

    except Exception as e:
        logger.error(f"Failed to get user templates: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user templates: {str(e)}"
        )


@router.get("/my-purchases", response_model=list[dict[str, Any]])
async def get_my_purchases(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Get templates purchased by the current organization.

    Args:
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        List of organization's template purchases
    """
    try:
        logger.info(f"Getting purchases for organization {current_org.id}")

        # In production, this would query the template registry for organization's purchases
        # For now, return empty list
        return []

    except Exception as e:
        logger.error(f"Failed to get organization purchases: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get organization purchases: {str(e)}"
        )
