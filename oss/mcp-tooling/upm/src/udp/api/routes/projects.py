"""
Project management API endpoints.

REST API for project CRUD operations, settings management,
and project-related functionality.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from udp.api.routes.dependencies import require_permission
from udp.api.schemas.projects import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectSettingsResponse,
    ProjectSettingsUpdate,
    ProjectStatsResponse,
    ProjectStatus,
    ProjectType,
    ProjectUpdate,
)
from udp.core.database import get_async_session
from udp.core.services import (
    DatabaseError,
    NotFoundError,
    ProjectService,
    ValidationError,
)
from udp.security.permissions import PROJECT_ADMIN, PROJECT_READ, PROJECT_WRITE

router = APIRouter(prefix="/projects", tags=["projects"])


def get_project_service(
    db: AsyncSession = Depends(get_async_session),
) -> ProjectService:
    """Dependency provider for project service."""
    return ProjectService(db_session=db)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_WRITE)),
) -> ProjectResponse:
    """
    Create a new project.

    Creates a new project with the specified details and associates it
    with the given organization.
    """
    try:
        # Convert project_data to dict and add creator info
        create_data = project_data.dict()
        project = await service.create(create_data, created_by=current_user.id)
        return ProjectResponse.from_orm(project)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project",
        )


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    skip: int = Query(0, ge=0, description="Number of projects to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of projects to return"
    ),
    organization_id: Optional[UUID] = Query(
        None, description="Filter by organization ID"
    ),
    project_type: Optional[ProjectType] = Query(
        None, description="Filter by project type"
    ),
    status: Optional[ProjectStatus] = Query(
        None, description="Filter by project status"
    ),
    search: Optional[str] = Query(
        None, description="Search in project name and description"
    ),
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_READ)),
) -> ProjectListResponse:
    """
    List projects with pagination and filtering.

    Returns a paginated list of projects with optional filtering
    by organization, type, status, and search terms.
    """
    try:
        # Build filters
        filters = {}
        if organization_id:
            filters["organization_id"] = str(organization_id)
        if project_type:
            filters["project_type"] = project_type.value
        if status:
            filters["status"] = status.value
        if search:
            filters["name"] = f"%{search}%"

        # Get paginated results
        projects = await service.list_all(limit=limit, offset=skip, filters=filters)

        # Get total count for pagination
        total = await service.count(filters=filters)

        return ProjectListResponse(
            projects=[ProjectResponse.from_orm(project) for project in projects],
            total=total,
            skip=skip,
            limit=limit,
        )
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve projects",
        )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_READ)),
) -> ProjectResponse:
    """
    Get a specific project by ID.

    Retrieves detailed information about a specific project.
    """
    try:
        project = await service.get_by_id(project_id)
        return ProjectResponse.from_orm(project)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project",
        )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_WRITE)),
) -> ProjectResponse:
    """
    Update a project.

    Updates project information with the provided data.
    """
    try:
        # Only include non-None fields in update
        update_data = {k: v for k, v in project_data.dict().items() if v is not None}

        project = await service.update(
            project_id, update_data, updated_by=current_user.id
        )
        return ProjectResponse.from_orm(project)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project",
        )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_ADMIN)),
) -> None:
    """
    Soft delete a project.

    Marks a project as deleted (doesn't actually remove it from the database).
    """
    try:
        await service.delete(project_id, deleted_by=current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project",
        )


@router.get("/{project_id}/settings", response_model=ProjectSettingsResponse)
async def get_project_settings(
    project_id: UUID,
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_READ)),
) -> ProjectSettingsResponse:
    """
    Get project settings.

    Retrieves the settings and configuration for a specific project.
    """
    try:
        project = await service.get_by_id(project_id)
        return ProjectSettingsResponse(
            id=project.id,
            settings=project.settings or {},
            updated_at=project.updated_at,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project settings",
        )


@router.put("/{project_id}/settings", response_model=ProjectSettingsResponse)
async def update_project_settings(
    project_id: UUID,
    settings_data: ProjectSettingsUpdate,
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_WRITE)),
) -> ProjectSettingsResponse:
    """
    Update project settings.

    Updates the settings and configuration for a specific project.
    """
    try:
        project = await service.update(
            project_id, {"settings": settings_data.settings}, updated_by=current_user.id
        )
        return ProjectSettingsResponse(
            id=project.id,
            settings=project.settings or {},
            updated_at=project.updated_at,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project settings",
        )


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
async def get_project_stats(
    project_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(require_permission(PROJECT_READ)),
) -> ProjectStatsResponse:
    """
    Get project statistics.

    Retrieves statistics about a project including dependency counts,
    vulnerability information, and ecosystem breakdown.
    """
    try:
        # This would typically use dependency service to get real stats
        # For now, return placeholder data
        return ProjectStatsResponse(
            total_dependencies=0,
            direct_dependencies=0,
            transitive_dependencies=0,
            vulnerabilities=0,
            last_analysis=None,
            ecosystem_breakdown={},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project statistics",
        )


@router.post("/{project_id}/clone", response_model=ProjectResponse)
async def clone_project(
    project_id: UUID,
    new_name: str = Query(..., description="Name for the cloned project"),
    service: ProjectService = Depends(get_project_service),
    current_user=Depends(require_permission(PROJECT_WRITE)),
) -> ProjectResponse:
    """
    Clone a project.

    Creates a copy of an existing project with a new name.
    """
    try:
        # Get original project
        original_project = await service.get_by_id(project_id)

        # Create clone data
        clone_data = {
            "name": new_name,
            "description": f"Clone of {original_project.name}",
            "organization_id": str(original_project.organization_id),
            "repository_url": original_project.repository_url,
            "homepage_url": original_project.homepage_url,
            "project_type": original_project.project_type,
            "status": original_project.status,
            "tags": original_project.tags or [],
            "metadata": original_project.metadata or {},
            "settings": original_project.settings or {},
        }

        # Create cloned project
        cloned_project = await service.create(clone_data, created_by=current_user.id)
        return ProjectResponse.from_orm(cloned_project)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clone project",
        )
