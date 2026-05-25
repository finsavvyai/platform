"""
API routes for dependency resolution.

Provides endpoints for advanced dependency resolution using SAT solvers,
conflict resolution, and optimization strategies.
"""

import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.domain.models import Organization, User
from udp.resolution.sat_solver import (
    ConflictType,
    ConstraintType,
    DependencyConstraint,
    PackageVersion,
    ResolutionResult,
    ResolutionStrategy,
    SATSolver,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response Models
class PackageRequest(BaseModel):
    """Request model for a package."""
    name: str = Field(..., description="Package name")
    version: str = Field(..., description="Package version")
    ecosystem: str = Field(..., description="Package ecosystem")


class DependencyConstraintRequest(BaseModel):
    """Request model for dependency constraint."""
    package_name: str = Field(..., description="Package name")
    constraint_type: ConstraintType = Field(..., description="Type of constraint")
    version_spec: str = Field(..., description="Version specification")
    ecosystem: str = Field(..., description="Package ecosystem")
    optional: bool = Field(False, description="Whether constraint is optional")
    reason: Optional[str] = Field(None, description="Reason for constraint")


class ResolutionRequest(BaseModel):
    """Request model for dependency resolution."""
    requested_packages: list[PackageRequest] = Field(..., description="List of requested packages")
    strategy: ResolutionStrategy = Field(ResolutionStrategy.CONSERVATIVE, description="Resolution strategy")
    constraints: Optional[list[DependencyConstraintRequest]] = Field(None, description="Additional constraints")


class ConflictResponse(BaseModel):
    """Response model for resolution conflict."""
    conflict_type: str
    packages_involved: list[str]
    description: str
    severity: str
    possible_solutions: list[dict[str, Any]]


class ResolutionResponse(BaseModel):
    """Response model for dependency resolution."""
    success: bool
    resolved_packages: list[dict[str, Any]]
    conflicts: list[ConflictResponse]
    resolution_time: float
    strategy_used: str
    total_packages: int
    resolution_steps: list[str]


class PackageVersionResponse(BaseModel):
    """Response model for package version."""
    name: str
    version: str
    ecosystem: str
    dependencies: list[dict[str, Any]]
    provides: list[str]
    conflicts: list[str]
    metadata: dict[str, Any]


# API Endpoints
@router.post("/resolve", response_model=ResolutionResponse)
async def resolve_dependencies(
    request: ResolutionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Resolve dependencies using SAT solver."""
    try:
        logger.info(f"Resolving dependencies for {len(request.requested_packages)} packages")

        # Create SAT solver instance
        solver = SATSolver()

        # Add package versions (mock data for demonstration)
        await _populate_solver_with_mock_data(solver)

        # Add additional constraints if provided
        if request.constraints:
            for constraint_req in request.constraints:
                constraint = DependencyConstraint(
                    package_name=constraint_req.package_name,
                    constraint_type=constraint_req.constraint_type,
                    version_spec=constraint_req.version_spec,
                    ecosystem=constraint_req.ecosystem,
                    optional=constraint_req.optional,
                    reason=constraint_req.reason
                )
                solver.add_constraint(constraint)

        # Prepare requested packages
        requested_packages = [
            (pkg.name, pkg.version, pkg.ecosystem)
            for pkg in request.requested_packages
        ]

        # Resolve dependencies
        result = solver.resolve_dependencies(requested_packages, request.strategy)

        # Log audit event
        background_tasks.add_task(
            _log_resolution_event,
            current_user.id, current_org.id, request, result
        )

        return ResolutionResponse(
            success=result.success,
            resolved_packages=[
                {
                    "name": pkg.name,
                    "version": pkg.version,
                    "ecosystem": pkg.ecosystem,
                    "dependencies": [
                        {
                            "package_name": dep.package_name,
                            "constraint_type": dep.constraint_type.value,
                            "version_spec": dep.version_spec,
                            "ecosystem": dep.ecosystem,
                            "optional": dep.optional
                        }
                        for dep in pkg.dependencies
                    ],
                    "provides": pkg.provides,
                    "conflicts": pkg.conflicts,
                    "metadata": pkg.metadata
                }
                for pkg in result.resolved_packages
            ],
            conflicts=[
                ConflictResponse(
                    conflict_type=conflict.conflict_type.value,
                    packages_involved=conflict.packages_involved,
                    description=conflict.description,
                    severity=conflict.severity,
                    possible_solutions=conflict.possible_solutions
                )
                for conflict in result.conflicts
            ],
            resolution_time=result.resolution_time,
            strategy_used=result.strategy_used.value,
            total_packages=result.total_packages,
            resolution_steps=result.resolution_steps
        )

    except Exception as e:
        logger.error(f"Failed to resolve dependencies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve dependencies: {str(e)}"
        )


@router.get("/strategies", response_model=list[dict[str, str]])
async def get_resolution_strategies(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available resolution strategies."""
    try:
        strategies = [
            {
                "id": ResolutionStrategy.CONSERVATIVE.value,
                "name": "Conservative",
                "description": "Prefer older, stable versions"
            },
            {
                "id": ResolutionStrategy.LATEST.value,
                "name": "Latest",
                "description": "Prefer latest versions"
            },
            {
                "id": ResolutionStrategy.MINIMAL.value,
                "name": "Minimal",
                "description": "Minimize total number of packages"
            },
            {
                "id": ResolutionStrategy.SECURITY_FIRST.value,
                "name": "Security First",
                "description": "Prioritize security updates"
            },
            {
                "id": ResolutionStrategy.PERFORMANCE_OPTIMIZED.value,
                "name": "Performance Optimized",
                "description": "Optimize for performance"
            }
        ]
        return strategies
    except Exception as e:
        logger.error(f"Failed to get resolution strategies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get resolution strategies: {str(e)}"
        )


@router.get("/constraint-types", response_model=list[dict[str, str]])
async def get_constraint_types(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available constraint types."""
    try:
        constraint_types = [
            {
                "id": ConstraintType.VERSION_RANGE.value,
                "name": "Version Range",
                "description": "Version range constraint (e.g., >=1.0.0,<2.0.0)"
            },
            {
                "id": ConstraintType.EXACT_VERSION.value,
                "name": "Exact Version",
                "description": "Exact version constraint (e.g., 1.2.3)"
            },
            {
                "id": ConstraintType.MINIMUM_VERSION.value,
                "name": "Minimum Version",
                "description": "Minimum version constraint (e.g., >=1.0.0)"
            },
            {
                "id": ConstraintType.MAXIMUM_VERSION.value,
                "name": "Maximum Version",
                "description": "Maximum version constraint (e.g., <2.0.0)"
            },
            {
                "id": ConstraintType.EXCLUDED_VERSION.value,
                "name": "Excluded Version",
                "description": "Excluded version constraint (e.g., !=1.2.3)"
            },
            {
                "id": ConstraintType.CONFLICT.value,
                "name": "Conflict",
                "description": "Package conflict constraint"
            },
            {
                "id": ConstraintType.REQUIRES.value,
                "name": "Requires",
                "description": "Required dependency constraint"
            },
            {
                "id": ConstraintType.PROVIDES.value,
                "name": "Provides",
                "description": "Provided feature constraint"
            }
        ]
        return constraint_types
    except Exception as e:
        logger.error(f"Failed to get constraint types: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get constraint types: {str(e)}"
        )


@router.get("/conflict-types", response_model=list[dict[str, str]])
async def get_conflict_types(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available conflict types."""
    try:
        conflict_types = [
            {
                "id": ConflictType.VERSION_CONFLICT.value,
                "name": "Version Conflict",
                "description": "Conflicting version requirements"
            },
            {
                "id": ConflictType.CIRCULAR_DEPENDENCY.value,
                "name": "Circular Dependency",
                "description": "Circular dependency detected"
            },
            {
                "id": ConflictType.MISSING_DEPENDENCY.value,
                "name": "Missing Dependency",
                "description": "Required dependency not found"
            },
            {
                "id": ConflictType.LICENSE_CONFLICT.value,
                "name": "License Conflict",
                "description": "Conflicting license requirements"
            },
            {
                "id": ConflictType.ARCHITECTURE_CONFLICT.value,
                "name": "Architecture Conflict",
                "description": "Conflicting architecture requirements"
            },
            {
                "id": ConflictType.PLATFORM_CONFLICT.value,
                "name": "Platform Conflict",
                "description": "Conflicting platform requirements"
            }
        ]
        return conflict_types
    except Exception as e:
        logger.error(f"Failed to get conflict types: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get conflict types: {str(e)}"
        )


@router.get("/statistics", response_model=dict[str, Any])
async def get_resolution_statistics(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get dependency resolution statistics."""
    try:
        # Create solver instance and get statistics
        solver = SATSolver()
        await _populate_solver_with_mock_data(solver)
        stats = solver.get_resolution_statistics()

        # Add additional statistics
        stats.update({
            "total_resolution_requests": 0,  # Would come from database
            "successful_resolutions": 0,
            "failed_resolutions": 0,
            "average_resolution_time": 0.0,
            "most_common_conflicts": [],
            "most_used_strategies": []
        })

        return stats
    except Exception as e:
        logger.error(f"Failed to get resolution statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get resolution statistics: {str(e)}"
        )


@router.post("/validate", response_model=dict[str, Any])
async def validate_dependency_graph(
    request: ResolutionRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Validate a dependency graph without resolving."""
    try:
        logger.info(f"Validating dependency graph for {len(request.requested_packages)} packages")

        # Create solver instance
        solver = SATSolver()
        await _populate_solver_with_mock_data(solver)

        # Add constraints
        if request.constraints:
            for constraint_req in request.constraints:
                constraint = DependencyConstraint(
                    package_name=constraint_req.package_name,
                    constraint_type=constraint_req.constraint_type,
                    version_spec=constraint_req.version_spec,
                    ecosystem=constraint_req.ecosystem,
                    optional=constraint_req.optional,
                    reason=constraint_req.reason
                )
                solver.add_constraint(constraint)

        # Validate requested packages exist
        validation_results = []
        for pkg_req in request.requested_packages:
            package = solver._find_package_version(pkg_req.name, pkg_req.version, pkg_req.ecosystem)
            validation_results.append({
                "package": f"{pkg_req.ecosystem}:{pkg_req.name}@{pkg_req.version}",
                "exists": package is not None,
                "dependencies": len(package.dependencies) if package else 0
            })

        return {
            "valid": all(result["exists"] for result in validation_results),
            "validation_results": validation_results,
            "total_packages": len(request.requested_packages),
            "valid_packages": sum(1 for result in validation_results if result["exists"]),
            "invalid_packages": sum(1 for result in validation_results if not result["exists"])
        }

    except Exception as e:
        logger.error(f"Failed to validate dependency graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate dependency graph: {str(e)}"
        )


# Helper Functions
async def _populate_solver_with_mock_data(solver: SATSolver):
    """Populate solver with mock package data for demonstration."""
    # Mock package data
    mock_packages = [
        PackageVersion(
            name="react",
            version="18.2.0",
            ecosystem="npm",
            dependencies=[
                DependencyConstraint("loose-envify", ConstraintType.VERSION_RANGE, "^1.1.0", "npm"),
                DependencyConstraint("js-tokens", ConstraintType.VERSION_RANGE, "^4.0.0", "npm")
            ],
            provides=["react"],
            conflicts=[],
            metadata={"description": "React library"}
        ),
        PackageVersion(
            name="react",
            version="17.0.2",
            ecosystem="npm",
            dependencies=[
                DependencyConstraint("loose-envify", ConstraintType.VERSION_RANGE, "^1.1.0", "npm"),
                DependencyConstraint("js-tokens", ConstraintType.VERSION_RANGE, "^3.0.0 || ^4.0.0", "npm")
            ],
            provides=["react"],
            conflicts=[],
            metadata={"description": "React library"}
        ),
        PackageVersion(
            name="loose-envify",
            version="1.4.0",
            ecosystem="npm",
            dependencies=[],
            provides=["loose-envify"],
            conflicts=[],
            metadata={"description": "Environment variable replacement"}
        ),
        PackageVersion(
            name="js-tokens",
            version="4.0.0",
            ecosystem="npm",
            dependencies=[],
            provides=["js-tokens"],
            conflicts=[],
            metadata={"description": "JavaScript tokenizer"}
        ),
        PackageVersion(
            name="js-tokens",
            version="3.0.2",
            ecosystem="npm",
            dependencies=[],
            provides=["js-tokens"],
            conflicts=[],
            metadata={"description": "JavaScript tokenizer"}
        ),
        PackageVersion(
            name="fastapi",
            version="0.104.1",
            ecosystem="pypi",
            dependencies=[
                DependencyConstraint("starlette", ConstraintType.VERSION_RANGE, ">=0.27.0", "pypi"),
                DependencyConstraint("pydantic", ConstraintType.VERSION_RANGE, ">=1.6.2,!=2.0.0,!=2.0.1,!=2.1.0", "pypi")
            ],
            provides=["fastapi"],
            conflicts=[],
            metadata={"description": "FastAPI framework"}
        ),
        PackageVersion(
            name="starlette",
            version="0.27.0",
            ecosystem="pypi",
            dependencies=[],
            provides=["starlette"],
            conflicts=[],
            metadata={"description": "Starlette framework"}
        ),
        PackageVersion(
            name="pydantic",
            version="2.5.0",
            ecosystem="pypi",
            dependencies=[],
            provides=["pydantic"],
            conflicts=[],
            metadata={"description": "Data validation library"}
        )
    ]

    for package in mock_packages:
        solver.add_package_version(package)


async def _log_resolution_event(
    user_id: str,
    organization_id: UUID,
    request: ResolutionRequest,
    result: ResolutionResult
):
    """Log dependency resolution event to audit logger."""
    try:
        from udp.security.audit_logger import (
            AuditEventSeverity,
            AuditEventStatus,
            AuditEventType,
            AuditLogger,
        )

        audit_logger = AuditLogger()
        audit_logger.log_event(
            event_type=AuditEventType.DEPENDENCY_ANALYSIS,
            action="dependency_resolution",
            description=f"Resolved dependencies for {len(request.requested_packages)} packages using {request.strategy.value} strategy",
            user_id=user_id,
            organization_id=organization_id,
            details={
                "requested_packages": len(request.requested_packages),
                "strategy": request.strategy.value,
                "success": result.success,
                "resolved_packages": result.total_packages,
                "conflicts": len(result.conflicts),
                "resolution_time": result.resolution_time
            },
            severity=AuditEventSeverity.MEDIUM,
            status=AuditEventStatus.SUCCESS if result.success else AuditEventStatus.FAILURE,
            tags=["dependency", "resolution", request.strategy.value]
        )
    except Exception as e:
        logger.error(f"Failed to log resolution event: {e}")
