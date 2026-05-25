"""
Permission checker for RBAC system with caching and performance optimization.
"""

from datetime import datetime, timedelta
from typing import Optional, Union
from uuid import UUID

import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.models.rbac import (
    Permission,
    ResourcePermission,
    ResourceType,
    Role,
    UserRoleAssignment,
)
from udp.core.models.user import User

from .exceptions import (
    PermissionDeniedError,
)

logger = structlog.get_logger()


class PermissionChecker:
    """
    High-performance permission checker with caching and smart evaluation.

    This class provides efficient permission checking with multiple levels of
    caching to optimize performance in high-traffic scenarios.
    """

    def __init__(self, cache_ttl: int = 300):
        """
        Initialize permission checker.

        Args:
            cache_ttl: Time-to-live for cache entries in seconds
        """
        self.cache_ttl = cache_ttl
        self._permission_cache: dict[str, tuple[set[str], datetime]] = {}
        self._role_cache: dict[str, tuple[list[Role], datetime]] = {}
        self._resource_permission_cache: dict[str, tuple[set[str], datetime]] = {}

    async def check_permission(
        self,
        db: AsyncSession,
        user: User,
        permission_code: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[Union[str, UUID]] = None,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> bool:
        """
        Check if a user has a specific permission.

        Args:
            db: Database session
            user: User to check
            permission_code: Permission code to check
            resource_type: Type of resource (for resource-specific permissions)
            resource_id: ID of specific resource
            organization_id: Organization context
            project_id: Project context

        Returns:
            True if user has permission, False otherwise
        """
        # Superusers have all permissions
        if user.is_superuser:
            logger.debug(
                "Superuser access granted",
                user_id=user.id,
                permission=permission_code,
            )
            return True

        # Build cache key
        cache_key = self._build_cache_key(
            user.id,
            permission_code,
            resource_type,
            resource_id,
            organization_id,
            project_id,
        )

        # Check cache
        cached_result = self._get_from_cache(cache_key)
        if cached_result is not None:
            return cached_result

        # Get user's effective permissions
        permissions = await self.get_user_permissions(
            db, user, organization_id, project_id
        )

        # Check direct permission
        has_permission = permission_code in permissions

        # If checking resource-specific permission, also check resource permissions
        if not has_permission and resource_type and resource_id:
            resource_permissions = await self.get_user_resource_permissions(
                db, user, resource_type, resource_id
            )
            has_permission = permission_code in resource_permissions

        # Cache the result
        self._cache_result(cache_key, has_permission)

        # Log the check
        logger.debug(
            "Permission check result",
            user_id=user.id,
            permission=permission_code,
            granted=has_permission,
            resource_type=resource_type,
            resource_id=resource_id,
            organization_id=organization_id,
            project_id=project_id,
        )

        return has_permission

    async def require_permission(
        self,
        db: AsyncSession,
        user: User,
        permission_code: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[Union[str, UUID]] = None,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> None:
        """
        Require a permission, raising an exception if not granted.

        This is a convenience method that raises PermissionDeniedError
        instead of returning a boolean.

        Args:
            db: Database session
            user: User to check
            permission_code: Permission code to require
            resource_type: Type of resource
            resource_id: ID of specific resource
            organization_id: Organization context
            project_id: Project context

        Raises:
            PermissionDeniedError: If user doesn't have the required permission
        """
        has_permission = await self.check_permission(
            db,
            user,
            permission_code,
            resource_type,
            resource_id,
            organization_id,
            project_id,
        )

        if not has_permission:
            raise PermissionDeniedError(
                f"User {user.id} does not have permission '{permission_code}'"
                f" on {resource_type}:{resource_id}"
                if resource_type and resource_id
                else f"User {user.id} does not have permission '{permission_code}'",
                user_id=str(user.id),
                permission=permission_code,
                resource_type=str(resource_type) if resource_type else None,
                resource_id=str(resource_id) if resource_id else None,
            )

    async def get_user_permissions(
        self,
        db: AsyncSession,
        user: User,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> set[str]:
        """
        Get all permissions for a user in a specific context.

        Args:
            db: Database session
            user: User to get permissions for
            organization_id: Organization context
            project_id: Project context

        Returns:
            Set of permission codes
        """
        # Check cache first
        cache_key = f"user_perms:{user.id}:{organization_id}:{project_id}"
        cached_permissions = self._get_permissions_from_cache(cache_key)
        if cached_permissions is not None:
            return cached_permissions

        permissions = set()

        # Get user's roles in the specified context
        roles = await self._get_user_roles(db, user, organization_id, project_id)

        # Collect permissions from roles
        for role in roles:
            # Include role permissions
            for permission in role.permissions:
                permissions.add(permission.code)

                # Add inherited permissions from parent roles
                parent_role = role.parent_role
                while parent_role:
                    for permission in parent_role.permissions:
                        permissions.add(permission.code)
                    parent_role = parent_role.parent_role

        # Cache the permissions
        self._cache_permissions(cache_key, permissions)

        return permissions

    async def get_user_resource_permissions(
        self,
        db: AsyncSession,
        user: User,
        resource_type: ResourceType,
        resource_id: Union[str, UUID],
    ) -> set[str]:
        """
        Get user's direct permissions on a specific resource.

        Args:
            db: Database session
            user: User to check
            resource_type: Type of resource
            resource_id: ID of resource

        Returns:
            Set of granted permission codes
        """
        # Check cache
        cache_key = f"resource_perms:{user.id}:{resource_type}:{resource_id}"
        cached_permissions = self._get_resource_permissions_from_cache(cache_key)
        if cached_permissions is not None:
            return cached_permissions

        # Query resource permissions
        result = await db.execute(
            select(ResourcePermission)
            .join(Permission)
            .where(
                and_(
                    ResourcePermission.user_id == user.id,
                    ResourcePermission.resource_type == resource_type,
                    ResourcePermission.resource_id == str(resource_id),
                    ResourcePermission.is_granted == True,
                    or_(
                        ResourcePermission.expires_at.is_(None),
                        ResourcePermission.expires_at > datetime.utcnow(),
                    ),
                )
            )
        )

        permissions = set()
        for resource_permission in result.scalars():
            permissions.add(resource_permission.permission.code)

        # Cache the result
        self._cache_resource_permissions(cache_key, permissions)

        return permissions

    async def get_user_roles(
        self,
        db: AsyncSession,
        user: User,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> list[Role]:
        """
        Get all active roles for a user in a specific context.

        Args:
            db: Database session
            user: User to get roles for
            organization_id: Organization context
            project_id: Project context

        Returns:
            List of active roles
        """
        return await self._get_user_roles(db, user, organization_id, project_id)

    async def check_role_hierarchy(
        self,
        db: AsyncSession,
        user: User,
        required_role_code: str,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> bool:
        """
        Check if user has a role at or above the required level in hierarchy.

        Args:
            db: Database session
            user: User to check
            required_role_code: Required role code
            organization_id: Organization context
            project_id: Project context

        Returns:
            True if user has sufficient role level
        """
        # Get the required role
        result = await db.execute(select(Role).where(Role.code == required_role_code))
        required_role = result.scalar_one_or_none()

        if not required_role:
            logger.warning(
                "Required role not found",
                role_code=required_role_code,
                user_id=user.id,
            )
            return False

        # Get user's roles
        user_roles = await self._get_user_roles(db, user, organization_id, project_id)

        # Check if any user role is at or above the required level
        for role in user_roles:
            if role.level >= required_role.level:
                return True

        return False

    def clear_cache(self, user_id: Optional[Union[str, UUID]] = None) -> None:
        """
        Clear permission cache.

        Args:
            user_id: If provided, only clear cache for this user
        """
        if user_id:
            # Clear cache entries for specific user
            keys_to_remove = []
            for key in self._permission_cache:
                if str(user_id) in key:
                    keys_to_remove.append(key)

            for key in keys_to_remove:
                del self._permission_cache[key]

            # Clear role cache
            keys_to_remove = []
            for key in self._role_cache:
                if str(user_id) in key:
                    keys_to_remove.append(key)

            for key in keys_to_remove:
                del self._role_cache[key]
        else:
            # Clear all cache
            self._permission_cache.clear()
            self._role_cache.clear()
            self._resource_permission_cache.clear()

    async def _get_user_roles(
        self,
        db: AsyncSession,
        user: User,
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> list[Role]:
        """Get user's active roles with caching."""
        cache_key = f"user_roles:{user.id}:{organization_id}:{project_id}"

        # Check cache
        if cache_key in self._role_cache:
            cached_roles, timestamp = self._role_cache[cache_key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.cache_ttl):
                return cached_roles

        # Query database
        query = (
            select(Role)
            .join(UserRoleAssignment)
            .where(
                and_(
                    UserRoleAssignment.user_id == user.id,
                    UserRoleAssignment.is_active == True,
                    or_(
                        UserRoleAssignment.expires_at.is_(None),
                        UserRoleAssignment.expires_at > datetime.utcnow(),
                    ),
                )
            )
        )

        # Add scope filters
        if project_id:
            query = query.where(
                or_(
                    UserRoleAssignment.project_id == str(project_id),
                    and_(
                        UserRoleAssignment.project_id.is_(None),
                        UserRoleAssignment.organization_id == str(organization_id)
                        if organization_id
                        else False,
                    ),
                    and_(
                        UserRoleAssignment.project_id.is_(None),
                        UserRoleAssignment.organization_id.is_(None),
                    ),
                )
            )
        elif organization_id:
            query = query.where(
                or_(
                    UserRoleAssignment.organization_id == str(organization_id),
                    UserRoleAssignment.organization_id.is_(None),
                )
            )

        result = await db.execute(query)
        roles = list(result.scalars().all())

        # Cache the result
        self._role_cache[cache_key] = (roles, datetime.utcnow())

        return roles

    def _build_cache_key(
        self,
        user_id: Union[str, UUID],
        permission_code: str,
        resource_type: Optional[ResourceType],
        resource_id: Optional[Union[str, UUID]],
        organization_id: Optional[Union[str, UUID]],
        project_id: Optional[Union[str, UUID]],
    ) -> str:
        """Build a cache key for permission check."""
        parts = [
            str(user_id),
            permission_code,
            str(resource_type) if resource_type else "null",
            str(resource_id) if resource_id else "null",
            str(organization_id) if organization_id else "null",
            str(project_id) if project_id else "null",
        ]
        return ":".join(parts)

    def _get_from_cache(self, key: str) -> Optional[bool]:
        """Get permission check result from cache."""
        if key in self._permission_cache:
            result, timestamp = self._permission_cache[key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.cache_ttl):
                return result
            else:
                del self._permission_cache[key]
        return None

    def _cache_result(self, key: str, result: bool) -> None:
        """Cache permission check result."""
        self._permission_cache[key] = (result, datetime.utcnow())

    def _get_permissions_from_cache(self, key: str) -> Optional[set[str]]:
        """Get permissions from cache."""
        if key in self._permission_cache:
            permissions, timestamp = self._permission_cache[key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.cache_ttl):
                return permissions
            else:
                del self._permission_cache[key]
        return None

    def _cache_permissions(self, key: str, permissions: set[str]) -> None:
        """Cache permissions set."""
        self._permission_cache[key] = (permissions, datetime.utcnow())

    def _get_resource_permissions_from_cache(self, key: str) -> Optional[set[str]]:
        """Get resource permissions from cache."""
        if key in self._resource_permission_cache:
            permissions, timestamp = self._resource_permission_cache[key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.cache_ttl):
                return permissions
            else:
                del self._resource_permission_cache[key]
        return None

    def _cache_resource_permissions(self, key: str, permissions: set[str]) -> None:
        """Cache resource permissions."""
        self._resource_permission_cache[key] = (permissions, datetime.utcnow())
