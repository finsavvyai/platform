"""
Workflow Templates API Endpoints

RESTful API endpoints for workflow template management including:
- Template CRUD operations
- Component library management
- Template marketplace features
- Template instantiation and deployment
- Rating and review system
"""

import logging
from typing import Dict, List, Optional, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_optional_user
from app.core.auth import User
from app.schemas.workflow import (
    WorkflowTemplateCreate, WorkflowTemplateUpdate, WorkflowTemplateResponse,
    WorkflowComponentCreate, WorkflowComponentUpdate, WorkflowComponentResponse,
    TemplateInstantiateRequest, TemplateInstantiateResponse,
    TemplateRatingCreate, TemplateRatingResponse,
    TemplateVersionResponse
)
from app.schemas.commons import PaginatedResponse, SearchResponse
from app.services.workflow_templates import (
    WorkflowTemplatesService, get_workflow_templates_service,
    TemplateSearchFilters, ComponentSearchFilters
)
from app.core.exceptions import (
    ValidationError, NotFoundError, ConflictError, AuthorizationError
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Template Management Endpoints

@router.post("/templates", response_model=WorkflowTemplateResponse)
async def create_template(
    template_data: WorkflowTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Create a new workflow template."""
    try:
        template = await templates_service.create_template(template_data, current_user.id)
        return WorkflowTemplateResponse.from_orm(template)

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/templates", response_model=PaginatedResponse[WorkflowTemplateResponse])
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    difficulty_level: Optional[str] = Query(None, description="Filter by difficulty level"),
    rating_min: Optional[float] = Query(None, ge=0, le=5, description="Minimum rating"),
    is_public: Optional[bool] = Query(None, description="Filter by public status"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_desc: bool = Query(True, description="Sort descending"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """List workflow templates with filters and pagination."""
    try:
        # Parse tags from query string
        tags_list = tags.split(",") if tags else None

        filters = TemplateSearchFilters(
            category=category,
            tags=tags_list,
            difficulty_level=difficulty_level,
            rating_min=rating_min,
            is_public=is_public,
            created_by=current_user.id if current_user else None,
            featured=featured
        )

        templates, total = await templates_service.list_templates(
            user_id=current_user.id if current_user else None,
            filters=filters,
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_desc=sort_desc
        )

        return PaginatedResponse[WorkflowTemplateResponse](
            items=[WorkflowTemplateResponse.from_orm(template) for template in templates],
            total=total,
            skip=skip,
            limit=limit
        )

    except Exception as e:
        logger.error(f"Failed to list templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/templates/{template_id}", response_model=WorkflowTemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get workflow template by ID."""
    try:
        template = await templates_service.get_template(
            template_id,
            user_id=current_user.id if current_user else None
        )
        return WorkflowTemplateResponse.from_orm(template)

    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/templates/{template_id}", response_model=WorkflowTemplateResponse)
async def update_template(
    template_id: UUID,
    template_data: WorkflowTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Update workflow template."""
    try:
        template = await templates_service.update_template(
            template_id, template_data, current_user.id
        )
        return WorkflowTemplateResponse.from_orm(template)

    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Delete workflow template."""
    try:
        await templates_service.delete_template(template_id, current_user.id)
        return {"message": "Template deleted successfully"}

    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Template Instantiation Endpoints

@router.post("/templates/{template_id}/instantiate", response_model=TemplateInstantiateResponse)
async def instantiate_template(
    template_id: UUID,
    instantiate_request: TemplateInstantiateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Create a workflow from a template."""
    try:
        workflow = await templates_service.instantiate_template(
            template_id, instantiate_request, current_user.id
        )
        return TemplateInstantiateResponse(
            workflow_id=workflow.id,
            workflow_name=workflow.name,
            message="Template instantiated successfully"
        )

    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to instantiate template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Template Rating Endpoints

@router.post("/templates/{template_id}/rate", response_model=TemplateRatingResponse)
async def rate_template(
    template_id: UUID,
    rating_data: TemplateRatingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Rate a workflow template."""
    try:
        rating = await templates_service.rate_template(
            template_id, rating_data.rating, rating_data.review, current_user.id
        )
        return TemplateRatingResponse.from_orm(rating)

    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to rate template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/templates/{template_id}/versions", response_model=List[TemplateVersionResponse])
async def get_template_versions(
    template_id: UUID,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get all versions of a template."""
    try:
        # Check access to template
        await templates_service.get_template(
            template_id,
            user_id=current_user.id if current_user else None
        )

        versions = await templates_service.get_template_versions(template_id)
        return [TemplateVersionResponse.from_orm(version) for version in versions]

    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get template versions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Component Management Endpoints

@router.post("/components", response_model=WorkflowComponentResponse)
async def create_component(
    component_data: WorkflowComponentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Create a new workflow component."""
    try:
        component = await templates_service.create_component(component_data, current_user.id)
        return WorkflowComponentResponse.from_orm(component)

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create component: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/components", response_model=PaginatedResponse[WorkflowComponentResponse])
async def list_components(
    category: Optional[str] = Query(None, description="Filter by category"),
    component_type: Optional[str] = Query(None, description="Filter by component type"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    is_public: Optional[bool] = Query(None, description="Filter by public status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """List workflow components."""
    try:
        tags_list = tags.split(",") if tags else None

        filters = ComponentSearchFilters(
            category=category,
            component_type=component_type,
            tags=tags_list,
            status=status,
            is_public=is_public
        )

        components, total = await templates_service.list_components(
            user_id=current_user.id if current_user else None,
            filters=filters,
            skip=skip,
            limit=limit
        )

        return PaginatedResponse[WorkflowComponentResponse](
            items=[WorkflowComponentResponse.from_orm(component) for component in components],
            total=total,
            skip=skip,
            limit=limit
        )

    except Exception as e:
        logger.error(f"Failed to list components: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/components/{component_id}", response_model=WorkflowComponentResponse)
async def get_component(
    component_id: UUID,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get workflow component by ID."""
    try:
        components, _ = await templates_service.list_components(
            user_id=current_user.id if current_user else None,
            limit=1
        )

        # Find the specific component
        component = None
        for comp in components:
            if comp.id == component_id:
                component = comp
                break

        if not component:
            raise HTTPException(status_code=404, detail="Component not found")

        return WorkflowComponentResponse.from_orm(component)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get component: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Category Management Endpoints

@router.get("/templates/categories")
async def get_template_categories(
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get all template categories."""
    try:
        categories = await templates_service.get_template_categories()
        return [
            {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "icon": category.icon
            }
            for category in categories
        ]

    except Exception as e:
        logger.error(f"Failed to get template categories: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/components/categories")
async def get_component_categories(
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get all component categories."""
    try:
        categories = await templates_service.get_component_categories()
        return [
            {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "icon": category.icon
            }
            for category in categories
        ]

    except Exception as e:
        logger.error(f"Failed to get component categories: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Featured and Search Endpoints

@router.get("/templates/featured", response_model=List[WorkflowTemplateResponse])
async def get_featured_templates(
    limit: int = Query(10, ge=1, le=50, description="Number of templates to return"),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get featured workflow templates."""
    try:
        templates = await templates_service.get_featured_templates(limit)
        return [WorkflowTemplateResponse.from_orm(template) for template in templates]

    except Exception as e:
        logger.error(f"Failed to get featured templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/templates/search", response_model=SearchResponse[WorkflowTemplateResponse])
async def search_templates(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Number of results to return"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Search workflow templates by text query."""
    try:
        templates = await templates_service.search_templates(
            q,
            user_id=current_user.id if current_user else None,
            limit=limit
        )
        return SearchResponse[WorkflowTemplateResponse](
            query=q,
            results=[WorkflowTemplateResponse.from_orm(template) for template in templates],
            total=len(templates)
        )

    except Exception as e:
        logger.error(f"Failed to search templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Template Validation Endpoints

@router.post("/templates/validate")
async def validate_template(
    template_definition: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Validate workflow template structure without saving."""
    try:
        validation_result = await templates_service._validate_template_structure(
            template_definition
        )
        return {
            "is_valid": validation_result.is_valid,
            "errors": validation_result.errors,
            "warnings": validation_result.warnings,
            "suggestions": validation_result.suggestions,
            "complexity_score": validation_result.complexity_score,
            "estimated_runtime": validation_result.estimated_runtime
        }

    except Exception as e:
        logger.error(f"Failed to validate template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/components/validate")
async def validate_component(
    component_definition: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Validate workflow component structure without saving."""
    try:
        validation_result = await templates_service._validate_component_structure(
            component_definition
        )
        return {
            "is_valid": validation_result.is_valid,
            "errors": validation_result.errors,
            "warnings": validation_result.warnings
        }

    except Exception as e:
        logger.error(f"Failed to validate component: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Analytics and Stats Endpoints

@router.get("/templates/stats")
async def get_template_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get template usage statistics."""
    try:
        # This would typically include analytics data
        # Implementation depends on specific analytics requirements
        return {
            "total_templates": 0,  # Would be populated from analytics
            "total_instantiations": 0,
            "average_rating": 0,
            "popular_categories": [],
            "recent_activity": []
        }

    except Exception as e:
        logger.error(f"Failed to get template stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/components/stats")
async def get_component_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    templates_service: WorkflowTemplatesService = Depends(get_workflow_templates_service)
):
    """Get component usage statistics."""
    try:
        # This would typically include analytics data
        return {
            "total_components": 0,  # Would be populated from analytics
            "total_usages": 0,
            "popular_components": [],
            "recent_uploads": []
        }

    except Exception as e:
        logger.error(f"Failed to get component stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")