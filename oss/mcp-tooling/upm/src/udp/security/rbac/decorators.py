"""
RBAC decorators and dependency injection utilities for FastAPI.

This module provides decorators and dependency functions for integrating
RBAC with FastAPI endpoints in a clean and declarative way.
"""

from collections.abc import Callable
from functools import wraps
from typing import Any, Optional, ParamSpec, TypeVar, Union
from uuid import UUID

import structlog
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.models.rbac import ResourceType
from udp.core.models.user import User
from udp.infrastructure.database import get_async_session
from udp.security.auth import get_current_user

from .exceptions import (
    PermissionDeniedError,
)
from .rbac_service import RBACService

logger = structlog.get_logger()
T = TypeVar("T")
P = ParamSpec("P")


class RBACDependency:
    """
    Dependency provider for RBAC operations.

    This class provides dependency injection for RBAC services and
    permission checking in FastAPI endpoints.
    """

    def __init__(self, rbac_service: RBACService):
        """
        Initialize RBAC dependency provider.

        Args:
            rbac_service: RBAC service instance
        """
        self.rbac_service = rbac_service

    def require_permission(
        self,
        permission_code: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[Union[str, UUID]] = None,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> Callable[[User], User]:
        """
        Create a dependency that requires a specific permission.

        Args:
            permission_code: Permission code to require
            resource_type: Type of resource
            resource_id: Specific resource ID
            organization_id: Organization context
            project_id: Project context

        Returns:
            Dependency function that returns the current user

        Example:
            @app.post("/projects")
            async def create_project(
                current_user: User = rbac.require_permission("project.create")
            ):
                ...
        """

        async def dependency(
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
        ) -> User:
            try:
                await self.rbac_service.require_permission(
                    db=db,
                    user=current_user,
                    permission_code=permission_code,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    organization_id=organization_id,
                    project_id=project_id,
                )
                return current_user
            except PermissionDeniedError as e:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(e),
                )

        return dependency

    def require_permissions(
        self,
        permissions: list[str],
        require_all: bool = True,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[Union[str, UUID]] = None,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> Callable[[User], User]:
        """
        Create a dependency that requires multiple permissions.

        Args:
            permissions: List of permission codes
            require_all: Whether all permissions are required (True) or any (False)
            resource_type: Type of resource
            resource_id: Specific resource ID
            organization_id: Organization context
            project_id: Project context

        Returns:
            Dependency function that returns the current user
        """

        async def dependency(
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
        ) -> User:
            has_permission = False

            for permission_code in permissions:
                try:
                    await self.rbac_service.require_permission(
                        db=db,
                        user=current_user,
                        permission_code=permission_code,
                        resource_type=resource_type,
                        resource_id=resource_id,
                        organization_id=organization_id,
                        project_id=project_id,
                    )

                    if require_all:
                        # Continue checking other permissions
                        has_permission = True
                        continue
                    else:
                        # Any permission is sufficient
                        return current_user

                except PermissionDeniedError:
                    if require_all:
                        # If all are required, fail on first denial
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Permission '{permission_code}' is required",
                        )
                    # Continue checking other permissions

            if require_all and has_permission:
                return current_user

            # If we get here, no permission was granted
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of the following permissions is required: {', '.join(permissions)}",
            )

        return dependency

    def require_role(
        self,
        role_code: str,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> Callable[[User], User]:
        """
        Create a dependency that requires a specific role.

        Args:
            role_code: Role code to require
            organization_id: Organization context
            project_id: Project context

        Returns:
            Dependency function that returns the current user
        """

        async def dependency(
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
        ) -> User:
            # Check role hierarchy
            has_role = await self.rbac_service.permission_checker.check_role_hierarchy(
                db=db,
                user=current_user,
                required_role_code=role_code,
                organization_id=organization_id,
                project_id=project_id,
            )

            if not has_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{role_code}' is required",
                )

            return current_user

        return dependency

    def require_privilege_level(
        self,
        min_level: int,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> Callable[[User], User]:
        """
        Create a dependency that requires a minimum privilege level.

        Args:
            min_level: Minimum privilege level required
            organization_id: Organization context
            project_id: Project context

        Returns:
            Dependency function that returns the current user
        """

        async def dependency(
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
        ) -> User:
            # Get user's roles
            roles = await self.rbac_service.permission_checker.get_user_roles(
                db=db,
                user=current_user,
                organization_id=organization_id,
                project_id=project_id,
            )

            # Check if any role meets the minimum level
            has_privilege = any(role.level >= min_level for role in roles)

            if not has_privilege:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Privilege level {min_level} is required",
                )

            return current_user

        return dependency

    def resource_owner_or_permission(
        self,
        resource_type: ResourceType,
        resource_id_param: str = "resource_id",
        permission_code: Optional[str] = None,
        owner_field: str = "created_by",
    ) -> Callable[[Request, User], Any]:
        """
        Create a dependency that allows resource owners or users with specific permission.

        This is useful for endpoints where users can modify their own resources
        or need special permission to modify others' resources.

        Args:
            resource_type: Type of resource
            resource_id_param: Path parameter name for resource ID
            permission_code: Permission to bypass ownership check
            owner_field: Field name containing owner ID

        Returns:
            Dependency function
        """

        async def dependency(
            request: Request,
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
        ) -> Any:
            # Get resource ID from path
            resource_id = request.path_params.get(resource_id_param)
            if not resource_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Resource ID parameter '{resource_id_param}' is required",
                )

            # If user is superuser, allow access
            if current_user.is_superuser:
                return resource_id

            # Check if user has the required permission
            if permission_code:
                has_permission = await self.rbac_service.check_permission(
                    db=db,
                    user=current_user,
                    permission_code=permission_code,
                    resource_type=resource_type,
                    resource_id=resource_id,
                )
                if has_permission:
                    return resource_id

            # Check ownership
            owner_id = await self._get_resource_owner(
                db, resource_type, resource_id, owner_field
            )

            if owner_id == str(current_user.id):
                return resource_id

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own resources or need special permission",
            )

        return dependency

    async def _get_resource_owner(
        self,
        db: AsyncSession,
        resource_type: ResourceType,
        resource_id: str,
        owner_field: str,
    ) -> Optional[str]:
        """
        Get the owner ID of a resource.

        Args:
            db: Database session
            resource_type: Type of resource
            resource_id: Resource ID
            owner_field: Field name containing owner ID

        Returns:
            Owner ID if found, None otherwise
        """
        # This is a simplified implementation
        # In practice, you would query the appropriate model based on resource_type
        # and return the value of the owner_field

        if resource_type == ResourceType.PROJECT:
            from udp.core.models.project import Project

            result = await db.execute(
                select(getattr(Project, owner_field)).where(Project.id == resource_id)
            )
            return result.scalar()

        elif resource_type == ResourceType.USER:
            return resource_id  # User owns themselves

        # Add other resource types as needed
        return None


# Global RBAC dependency instance
_rbac_dependency: Optional[RBACDependency] = None


def get_rbac_dependency() -> RBACDependency:
    """
    Get the global RBAC dependency instance.

    Returns:
        RBACDependency instance

    Raises:
        RuntimeError: If RBAC is not initialized
    """
    global _rbac_dependency
    if _rbac_dependency is None:
        raise RuntimeError("RBAC is not initialized. Call init_rbac() first.")
    return _rbac_dependency


def init_rbac(rbac_service: RBACService) -> None:
    """
    Initialize RBAC dependencies.

    This should be called during application startup.

    Args:
        rbac_service: RBAC service instance
    """
    global _rbac_dependency
    _rbac_dependency = RBACDependency(rbac_service)


# Convenience functions that use the global RBAC dependency
def require_permission(
    permission_code: str,
    resource_type: Optional[ResourceType] = None,
    resource_id: Optional[Union[str, UUID]] = None,
    organization_id: Optional[Union[str, UUID]] = None,
    project_id: Optional[Union[str, UUID]] = None,
) -> Callable[[User], User]:
    """
    Convenience function to require a permission.

    See RBACDependency.require_permission for details.
    """
    return get_rbac_dependency().require_permission(
        permission_code, resource_type, resource_id, organization_id, project_id
    )


def require_permissions(
    permissions: list[str],
    require_all: bool = True,
    resource_type: Optional[ResourceType] = None,
    resource_id: Optional[Union[str, UUID]] = None,
    organization_id: Optional[Union[str, UUID]] = None,
    project_id: Optional[Union[str, UUID]] = None,
) -> Callable[[User], User]:
    """
    Convenience function to require multiple permissions.

    See RBACDependency.require_permissions for details.
    """
    return get_rbac_dependency().require_permissions(
        permissions,
        require_all,
        resource_type,
        resource_id,
        organization_id,
        project_id,
    )


def require_role(
    role_code: str,
    organization_id: Optional[Union[str, UUID]] = None,
    project_id: Optional[Union[str, UUID]] = None,
) -> Callable[[User], User]:
    """
    Convenience function to require a role.

    See RBACDependency.require_role for details.
    """
    return get_rbac_dependency().require_role(role_code, organization_id, project_id)


def require_privilege_level(
    min_level: int,
    organization_id: Optional[Union[str, UUID]] = None,
    project_id: Optional[Union[str, UUID]] = None,
) -> Callable[[User], User]:
    """
    Convenience function to require a privilege level.

    See RBACDependency.require_privilege_level for details.
    """
    return get_rbac_dependency().require_privilege_level(
        min_level, organization_id, project_id
    )


def resource_owner_or_permission(
    resource_type: ResourceType,
    resource_id_param: str = "resource_id",
    permission_code: Optional[str] = None,
    owner_field: str = "created_by",
) -> Callable[[Request, User], Any]:
    """
    Convenience function for resource owner or permission check.

    See RBACDependency.resource_owner_or_permission for details.
    """
    return get_rbac_dependency().resource_owner_or_permission(
        resource_type, resource_id_param, permission_code, owner_field
    )


# Decorator versions for use with existing functions
def has_permission(
    permission_code: str,
    resource_type: Optional[ResourceType] = None,
    organization_id: Optional[Union[str, UUID]] = None,
    project_id: Optional[Union[str, UUID]] = None,
):
    """
    Decorator to check if user has permission before executing function.

    This decorator can be used with any async function that has access to
    database session and current user.

    Args:
        permission_code: Permission code to check
        resource_type: Type of resource
        organization_id: Organization context
        project_id: Project context

    Returns:
        Decorated function

    Example:
        @has_permission("project.create")
        async def my_function(db: AsyncSession, current_user: User):
            ...
    """

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # Extract db and current_user from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")

            if not db or not current_user:
                raise ValueError(
                    "Function must have 'db' and 'current_user' parameters "
                    "when using @has_permission decorator"
                )

            # Check permission
            await get_rbac_dependency().rbac_service.require_permission(
                db=db,
                user=current_user,
                permission_code=permission_code,
                resource_type=resource_type,
                organization_id=organization_id,
                project_id=project_id,
            )

            # Execute function
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def has_role(
    role_code: str,
    organization_id: Optional[Union[str, UUID]] = None,
    project_id: Optional[Union[str, UUID]] = None,
):
    """
    Decorator to check if user has role before executing function.

    Args:
        role_code: Role code to check
        organization_id: Organization context
        project_id: Project context

    Returns:
        Decorated function
    """

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # Extract db and current_user from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")

            if not db or not current_user:
                raise ValueError(
                    "Function must have 'db' and 'current_user' parameters "
                    "when using @has_role decorator"
                )

            # Check role
            has_required_role = await get_rbac_dependency().rbac_service.permission_checker.check_role_hierarchy(
                db=db,
                user=current_user,
                required_role_code=role_code,
                organization_id=organization_id,
                project_id=project_id,
            )

            if not has_required_role:
                raise PermissionDeniedError(
                    f"Role '{role_code}' is required",
                    user_id=str(current_user.id),
                )

            # Execute function
            return await func(*args, **kwargs)

        return wrapper

    return decorator
