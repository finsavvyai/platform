"""
Project management endpoints for Universal Dependency Platform.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.schemas.project import (
    ProjectAnalysisConfigUpdate,
    ProjectCreate,
    ProjectResponse,
    ProjectSettingsUpdate,
    ProjectUpdate,
)
from udp.core.services import ConflictError, NotFoundError, ValidationError
from udp.infrastructure.database import get_async_session
from udp.security.auth import get_current_user
from udp.services.project import ProjectService

router = APIRouter()


def _project_to_response(project) -> dict:
    """Convert a Project model to response dict."""
    return {
        "id": str(project.id),
        "organization_id": str(project.organization_id),
        "name": project.name,
        "slug": project.slug,
        "description": project.description,
        "repository_url": project.repository_url,
        "repository_branch": project.repository_branch or "main",
        "primary_language": project.primary_language,
        "ecosystem": project.ecosystem,
        "project_type": project.project_type or "polyglot",
        "status": project.status or "active",
        "build_system": project.build_system,
        "analysis_frequency": project.analysis_frequency or "daily",
        "auto_scan_enabled": project.auto_scan_enabled
        if project.auto_scan_enabled is not None
        else True,
        "policy_enforcement_enabled": project.policy_enforcement_enabled
        if project.policy_enforcement_enabled is not None
        else True,
        "last_analysis_at": project.last_analysis_at,
        "last_analysis_id": str(project.last_analysis_id)
        if project.last_analysis_id
        else None,
        "tags": project.tags,
        "settings": project.settings,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organization_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    primary_language: Optional[str] = Query(None),
    ecosystem: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """List projects with filtering and pagination."""
    service = ProjectService(db)
    projects = await service.list_projects(
        limit=limit,
        offset=skip,
        organization_id=organization_id,
        status=status,
        primary_language=primary_language,
        ecosystem=ecosystem,
        search=search,
    )
    return [_project_to_response(p) for p in projects]


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Create a new project."""
    service = ProjectService(db)
    try:
        project = await service.create_project(
            name=project_data.name,
            slug=project_data.slug,
            organization_id=project_data.organization_id,
            description=project_data.description,
            repository_url=project_data.repository_url,
            primary_language=project_data.primary_language,
            ecosystem=project_data.ecosystem,
            build_system=project_data.build_system,
            created_by=current_user.id if current_user else None,
        )
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return _project_to_response(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get project by ID."""
    service = ProjectService(db)
    try:
        project = await service.get_project_by_id(project_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_response(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Update project information."""
    service = ProjectService(db)
    update_dict = project_data.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        project = await service.update_project(
            project_id,
            update_dict,
            updated_by=current_user.id if current_user else None,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_response(project)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Delete (archive) a project."""
    service = ProjectService(db)
    try:
        await service.delete_project(
            project_id,
            deleted_by=current_user.id if current_user else None,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/settings")
async def get_project_settings(
    project_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get project settings."""
    service = ProjectService(db)
    try:
        settings = await service.get_project_settings(project_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")
    return settings


@router.put("/{project_id}/settings")
async def update_project_settings(
    project_id: str,
    settings_data: ProjectSettingsUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Update project settings."""
    service = ProjectService(db)
    try:
        project = await service.update_project_settings(
            project_id, settings_data.settings
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_response(project)


@router.get("/{project_id}/analysis-config")
async def get_analysis_config(
    project_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get project analysis configuration."""
    service = ProjectService(db)
    try:
        config = await service.get_analysis_config(project_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")
    return config


@router.put("/{project_id}/analysis-config")
async def update_analysis_config(
    project_id: str,
    config_data: ProjectAnalysisConfigUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Update project analysis configuration."""
    service = ProjectService(db)
    try:
        project = await service.update_analysis_config(project_id, config_data.config)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_response(project)


@router.get("/organization/{organization_id}", response_model=list[ProjectResponse])
async def get_organization_projects(
    organization_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    primary_language: Optional[str] = Query(None),
    ecosystem: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get all projects for an organization."""
    service = ProjectService(db)
    projects = await service.get_organization_projects(
        organization_id=organization_id,
        limit=limit,
        offset=skip,
        status=status,
        primary_language=primary_language,
        ecosystem=ecosystem,
        search=search,
    )
    return [_project_to_response(p) for p in projects]
