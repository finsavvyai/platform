"""
Dependency management CRUD API endpoints.

REST API for dependency CRUD operations, analysis,
and dependency management operations.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from udp.api.routes.dependencies import require_permission
from udp.api.schemas.dependencies import (
    BatchDependencyCreate,
    BatchDependencyResponse,
    DependencyAnalysisResponse,
    DependencyConflictResponse,
    DependencyCreate,
    DependencyListResponse,
    DependencyResponse,
    DependencyScope,
    DependencyTreeResponse,
    DependencyUpdate,
    EcosystemType,
)
from udp.core.database import get_async_session
from udp.core.services import (
    DatabaseError,
    DependencyService,
    NotFoundError,
    ValidationError,
)
from udp.security.permissions import DEPENDENCY_ADMIN, DEPENDENCY_READ, DEPENDENCY_WRITE

router = APIRouter(prefix="/dependencies", tags=["dependencies"])


def get_dependency_service(
    db: AsyncSession = Depends(get_async_session),
) -> DependencyService:
    """Dependency provider for dependency service."""
    return DependencyService(db_session=db)


@router.post(
    "/", response_model=DependencyResponse, status_code=status.HTTP_201_CREATED
)
async def create_dependency(
    dependency_data: DependencyCreate,
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_WRITE)),
) -> DependencyResponse:
    """
    Create a new dependency.

    Adds a new dependency to a project with specified package, version, and configuration.
    """
    try:
        # Convert dependency_data to dict and add creator info
        create_data = dependency_data.dict()
        dependency = await service.create_dependency(
            project_id=create_data.pop("project_id"),
            package_id=create_data.pop("package_id"),
            version_constraint=create_data.pop("version_constraint"),
            ecosystem=create_data.pop("ecosystem"),
            **create_data,
        )
        return DependencyResponse.from_orm(dependency)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create dependency",
        )


@router.post("/batch", response_model=BatchDependencyResponse)
async def create_batch_dependencies(
    batch_data: BatchDependencyCreate,
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_WRITE)),
) -> BatchDependencyResponse:
    """
    Create multiple dependencies at once.

    Adds multiple dependencies to projects in a single operation.
    """
    try:
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []

        for dep_data in batch_data.dependencies:
            try:
                # Check if dependency already exists
                existing_deps = await service.get_dependencies_by_project(
                    dep_data.project_id
                )
                existing_match = next(
                    (
                        d
                        for d in existing_deps
                        if d.package_id == dep_data.package_id
                        and d.ecosystem == dep_data.ecosystem
                    ),
                    None,
                )

                if existing_match and not batch_data.overwrite_existing:
                    skipped_count += 1
                    continue

                if existing_match and batch_data.overwrite_existing:
                    # Update existing dependency
                    update_data = {
                        "version_constraint": dep_data.version_constraint,
                        "scope": dep_data.scope,
                        "is_direct": dep_data.is_direct,
                        "metadata": dep_data.metadata,
                    }
                    await service.update_dependency(existing_match.id, **update_data)
                    updated_count += 1
                else:
                    # Create new dependency
                    await service.create_dependency(
                        project_id=dep_data.project_id,
                        package_id=dep_data.package_id,
                        version_constraint=dep_data.version_constraint,
                        ecosystem=dep_data.ecosystem,
                        scope=dep_data.scope,
                        is_direct=dep_data.is_direct,
                        metadata=dep_data.metadata,
                    )
                    created_count += 1

            except Exception as e:
                errors.append({"dependency": dep_data.dict(), "error": str(e)})

        return BatchDependencyResponse(
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            errors=errors,
        )

    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create batch dependencies",
        )


@router.get("/", response_model=DependencyListResponse)
async def list_dependencies(
    skip: int = Query(0, ge=0, description="Number of dependencies to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of dependencies to return"
    ),
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    ecosystem: Optional[EcosystemType] = Query(None, description="Filter by ecosystem"),
    scope: Optional[DependencyScope] = Query(
        None, description="Filter by dependency scope"
    ),
    is_direct: Optional[bool] = Query(None, description="Filter by direct/transitive"),
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_READ)),
) -> DependencyListResponse:
    """
    List dependencies with pagination and filtering.

    Returns a paginated list of dependencies with optional filtering
    by project, ecosystem, scope, and other criteria.
    """
    try:
        # Build filters
        filters = {}
        if project_id:
            filters["project_id"] = str(project_id)
        if ecosystem:
            filters["ecosystem"] = ecosystem.value
        if scope:
            filters["scope"] = scope.value
        if is_direct is not None:
            filters["is_direct"] = is_direct

        # Get paginated results
        dependencies = await service.list_all(limit=limit, offset=skip, filters=filters)

        # Get total count for pagination
        total = await service.count(filters=filters)

        return DependencyListResponse(
            dependencies=[DependencyResponse.from_orm(dep) for dep in dependencies],
            total=total,
            skip=skip,
            limit=limit,
        )
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dependencies",
        )


@router.get("/{dependency_id}", response_model=DependencyResponse)
async def get_dependency(
    dependency_id: UUID,
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_READ)),
) -> DependencyResponse:
    """
    Get a specific dependency by ID.

    Retrieves detailed information about a specific dependency.
    """
    try:
        dependency = await service.get_by_id(dependency_id)
        return DependencyResponse.from_orm(dependency)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dependency",
        )


@router.put("/{dependency_id}", response_model=DependencyResponse)
async def update_dependency(
    dependency_id: UUID,
    dependency_data: DependencyUpdate,
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_WRITE)),
) -> DependencyResponse:
    """
    Update a dependency.

    Updates dependency configuration with provided data.
    """
    try:
        # Only include non-None fields in update
        update_data = {k: v for k, v in dependency_data.dict().items() if v is not None}

        dependency = await service.update_dependency(dependency_id, **update_data)
        return DependencyResponse.from_orm(dependency)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update dependency",
        )


@router.delete("/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dependency(
    dependency_id: UUID,
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_ADMIN)),
) -> None:
    """
    Soft delete a dependency.

    Marks a dependency as deleted (doesn't actually remove it from database).
    """
    try:
        await service.delete_dependency(dependency_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete dependency",
        )


@router.get("/projects/{project_id}/tree", response_model=DependencyTreeResponse)
async def get_dependency_tree(
    project_id: UUID,
    max_depth: int = Query(
        5, ge=1, le=10, description="Maximum depth of dependency tree"
    ),
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_READ)),
) -> DependencyTreeResponse:
    """
    Get dependency tree for a project.

    Retrieves the complete dependency tree showing how dependencies
    relate to each other, up to the specified depth.
    """
    try:
        tree_data = await service.get_dependency_tree(project_id, max_depth=max_depth)

        return DependencyTreeResponse(
            project_id=project_id,
            dependencies=tree_data,
            total_dependencies=len(tree_data),
            max_depth=max_depth,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate dependency tree",
        )


@router.get(
    "/projects/{project_id}/conflicts", response_model=DependencyConflictResponse
)
async def check_dependency_conflicts(
    project_id: UUID,
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_READ)),
) -> DependencyConflictResponse:
    """
    Check for dependency conflicts in a project.

    Analyzes dependencies for version conflicts, incompatible
    requirements, and other issues.
    """
    try:
        conflicts = await service.check_conflicts(project_id)

        # Count conflicts by severity (simplified)
        severity_counts = {"error": 0, "warning": 0, "info": 0}
        for conflict in conflicts:
            severity = conflict.get("severity", "info")
            if severity in severity_counts:
                severity_counts[severity] += 1

        return DependencyConflictResponse(
            conflicts=conflicts,
            total_conflicts=len(conflicts),
            severity_counts=severity_counts,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check dependency conflicts",
        )


@router.post(
    "/projects/{project_id}/analyze", response_model=DependencyAnalysisResponse
)
async def analyze_dependencies(
    project_id: UUID,
    force_reanalysis: bool = Query(
        False, description="Force re-analysis even if recently analyzed"
    ),
    service: DependencyService = Depends(get_dependency_service),
    current_user=Depends(require_permission(DEPENDENCY_READ)),
) -> DependencyAnalysisResponse:
    """
    Analyze dependencies for a project.

    Performs comprehensive analysis of project dependencies including
    security vulnerabilities, outdated packages, and recommendations.
    """
    try:
        # Get project dependencies
        dependencies = await service.get_dependencies_by_project(
            project_id, include_resolutions=True
        )

        # For now, return basic analysis
        # In a real implementation, this would trigger background analysis
        from datetime import datetime

        analysis_summary = {
            "total_dependencies": len(dependencies),
            "direct_dependencies": sum(1 for d in dependencies if d.is_direct),
            "transitive_dependencies": sum(1 for d in dependencies if not d.is_direct),
            "ecosystems": list(set(d.ecosystem for d in dependencies)),
            "vulnerabilities": 0,  # Would be calculated from vulnerability service
            "outdated": 0,  # Would be calculated from package registry
        }

        return DependencyAnalysisResponse(
            project_id=project_id,
            analysis_timestamp=datetime.utcnow(),
            summary=analysis_summary,
            dependencies=[DependencyResponse.from_orm(dep) for dep in dependencies],
            recommendations=[],  # Would be generated based on analysis
            issues=[],  # Would be identified during analysis
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze dependencies",
        )
