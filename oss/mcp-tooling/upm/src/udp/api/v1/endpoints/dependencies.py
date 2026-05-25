"""
Dependency management endpoints for Universal Dependency Platform.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.schemas.dependency import (
    DependencyAnalysis,
    DependencyCreate,
    DependencyResponse,
    DependencySearch,
    DependencyUpdate,
)
from udp.infrastructure.database import get_async_session
from udp.security.auth import get_current_user
from udp.services.dependency_service import DependencyService

router = APIRouter()


@router.get("/", response_model=list[DependencyResponse])
async def list_dependencies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    language: Optional[str] = Query(None),
    framework: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """List dependencies with filtering and pagination."""
    dependency_service = DependencyService(db)

    filters = {}
    if language:
        filters["language"] = language
    if framework:
        filters["framework"] = framework
    if search:
        filters["search"] = search

    dependencies = await dependency_service.list(
        skip=skip, limit=limit, filters=filters
    )

    return dependencies


@router.post("/", response_model=DependencyResponse)
async def create_dependency(
    dependency_data: DependencyCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Create a new dependency entry."""
    dependency_service = DependencyService(db)

    dependency = await dependency_service.create(dependency_data)
    return dependency


@router.get("/{dependency_id}", response_model=DependencyResponse)
async def get_dependency(
    dependency_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get dependency by ID."""
    dependency_service = DependencyService(db)

    dependency = await dependency_service.get(dependency_id)
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")

    return dependency


@router.put("/{dependency_id}", response_model=DependencyResponse)
async def update_dependency(
    dependency_id: str,
    dependency_data: DependencyUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Update dependency information."""
    dependency_service = DependencyService(db)

    dependency = await dependency_service.update(dependency_id, dependency_data)
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")

    return dependency


@router.delete("/{dependency_id}")
async def delete_dependency(
    dependency_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Delete dependency."""
    dependency_service = DependencyService(db)

    success = await dependency_service.delete(dependency_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dependency not found")

    return {"message": "Dependency deleted successfully"}


@router.post("/{dependency_id}/analyze", response_model=DependencyAnalysis)
async def analyze_dependency(
    dependency_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Analyze dependency for security vulnerabilities and compatibility."""
    dependency_service = DependencyService(db)

    analysis = await dependency_service.analyze(dependency_id)
    return analysis


@router.post("/search", response_model=list[DependencyResponse])
async def search_dependencies(
    search_query: DependencySearch,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Search dependencies with advanced filters."""
    dependency_service = DependencyService(db)

    dependencies = await dependency_service.search(search_query)
    return dependencies


@router.get("/languages/{language}/popular", response_model=list[DependencyResponse])
async def get_popular_dependencies(
    language: str,
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get popular dependencies for a specific language."""
    dependency_service = DependencyService(db)

    dependencies = await dependency_service.get_popular(language, limit)
    return dependencies
