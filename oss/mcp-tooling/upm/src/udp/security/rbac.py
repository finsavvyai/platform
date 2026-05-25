"""
RBAC (Role-Based Access Control) service for Universal Dependency Platform.

This module provides comprehensive permission checking, role management,
and resource-based access control functionality.
"""

import logging
from datetime import datetime
from enum import Enum
from functools import wraps
from typing import Any, Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import (
    AuthorizationError,
    ResourceNotFoundError,
    ValidationError,
)
from ..core.models.rbac import (
    Permission,
    ResourcePermission,
    ResourceType,
    Role,
    UserRoleAssignment,
)
from ..core.models.user import User
from ..core.services import BaseService

logger = logging.getLogger(__name__)


class AccessDecision(str, Enum):
    """Access control decisions."""

    ALLOW = "allow"
    DENY = "deny"
    ABSTAIN = "abstain"


class PermissionResult:
    """Result of a permission check."""

    def __init__(
        self,
        decision: AccessDecision,
        permissions: set[str],
        roles: set[str],
        resource_permissions: set[str],
        reason: Optional[str] = None,
    ):
        self.decision = decision
        self.permissions = permissions
        self.roles = roles
        self.resource_permissions = resource_permissions
        self.reason = reason

    def is_allowed(self) -> bool:
        return self.decision == AccessDecision.ALLOW

    def __str__(self) -> str:
        return f"PermissionResult(decision={self.decision}, reason='{self.reason}')"


class RBACService(BaseService):
    """
    Service for managing role-based access control.

    Provides methods for:
    - Permission checking and authorization
    - Role management (create, update, delete)
    - User role assignment and revocation
    - Resource-based permission management
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self._permission_cache: dict[str, set[str]] = {}
        self._role_cache: dict[str, dict[str, Any]] = {}

    async def check_permission(
        self,
        user: User,
        permission_name: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
        require_all: bool = False,
    ) -> PermissionResult:
        """
        Check if a user has a specific permission.

        Args:
            user: The user to check permissions for
            permission_name: The permission to check
            resource_type: Optional resource type for resource-specific permissions
            resource_id: Optional resource ID for resource-specific permissions
            require_all: If True, user must have all scopes of the permission

        Returns:
            PermissionResult with access decision and details
        """
        try:
            # Get all permissions for the user
            user_permissions = await self._get_user_permissions(user)

            # Check direct permission match
            if permission_name in user_permissions["global"]:
                return PermissionResult(
                    decision=AccessDecision.ALLOW,
                    permissions=user_permissions["global"],
                    roles=user_permissions["roles"],
                    resource_permissions=user_permissions["resource"],
                    reason="Global permission granted",
                )

            # Check resource-specific permission if resource context provided
            if resource_type and resource_id:
                resource_key = f"{resource_type.value}:{resource_id}"
                if permission_name in user_permissions["resource"].get(
                    resource_key, set()
                ):
                    return PermissionResult(
                        decision=AccessDecision.ALLOW,
                        permissions=user_permissions["global"],
                        roles=user_permissions["roles"],
                        resource_permissions=user_permissions["resource"],
                        reason="Resource-specific permission granted",
                    )

                # Check if user has permission for all resources of this type
                wildcard_key = f"{resource_type.value}:*"
                if permission_name in user_permissions["resource"].get(
                    wildcard_key, set()
                ):
                    return PermissionResult(
                        decision=AccessDecision.ALLOW,
                        permissions=user_permissions["global"],
                        roles=user_permissions["roles"],
                        resource_permissions=user_permissions["resource"],
                        reason="Resource-type permission granted",
                    )

            # Check scope-based permissions
            permission = await self._get_permission_by_name(permission_name)
            if permission:
                scope = permission.scope.value
                if await self._check_scope_permissions(user, scope, user_permissions):
                    return PermissionResult(
                        decision=AccessDecision.ALLOW,
                        permissions=user_permissions["global"],
                        roles=user_permissions["roles"],
                        resource_permissions=user_permissions["resource"],
                        reason=f"Scope-based permission granted: {scope}",
                    )

            return PermissionResult(
                decision=AccessDecision.DENY,
                permissions=user_permissions["global"],
                roles=user_permissions["roles"],
                resource_permissions=user_permissions["resource"],
                reason=f"Permission denied: {permission_name}",
            )

        except Exception as e:
            logger.error(f"Permission check failed for user {user.id}: {e}")
            raise AuthorizationError(f"Permission check failed: {str(e)}")

    async def require_permission(
        self,
        user: User,
        permission_name: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
    ) -> None:
        """
        Check permission and raise AuthorizationError if not allowed.

        Args:
            user: The user to check permissions for
            permission_name: The required permission
            resource_type: Optional resource type
            resource_id: Optional resource ID

        Raises:
            AuthorizationError: If permission is denied
        """
        result = await self.check_permission(
            user, permission_name, resource_type, resource_id
        )
        if not result.is_allowed():
            raise AuthorizationError(f"Access denied: {result.reason}")

    async def create_role(
        self,
        name: str,
        display_name: str,
        description: Optional[str] = None,
        is_system: bool = False,
        organization_id: Optional[str] = None,
        parent_role_id: Optional[str] = None,
        priority: int = 0,
    ) -> Role:
        """
        Create a new role.

        Args:
            name: Internal role name
            display_name: Human-readable name
            description: Optional description
            is_system: Whether this is a system role
            organization_id: Optional organization ID for custom roles
            parent_role_id: Optional parent role for inheritance
            priority: Role priority level

        Returns:
            Created Role instance
        """
        try:
            # Validate role name uniqueness
            existing_role = await self._get_role_by_name(name, organization_id)
            if existing_role:
                raise ValidationError(f"Role '{name}' already exists")

            role = Role(
                name=name,
                display_name=display_name,
                description=description,
                is_system=is_system,
                organization_id=organization_id,
                parent_role_id=parent_role_id,
                priority=priority,
            )

            self.db.add(role)
            await self.db.commit()
            await self.db.refresh(role)

            # Clear cache for affected users
            await self._clear_cache_for_role(role)

            logger.info(f"Created role: {role.name} (ID: {role.id})")
            return role

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create role '{name}': {e}")
            raise

    async def assign_role_to_user(
        self,
        user_id: str,
        role_id: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
        assigned_by: Optional[str] = None,
        expires_at: Optional[datetime] = None,
    ) -> UserRoleAssignment:
        """
        Assign a role to a user.

        Args:
            user_id: User ID to assign role to
            role_id: Role ID to assign
            resource_type: Optional resource type for scoped assignment
            resource_id: Optional resource ID for scoped assignment
            assigned_by: Optional user ID making the assignment
            expires_at: Optional expiration time

        Returns:
            Created UserRoleAssignment instance
        """
        try:
            # Check if assignment already exists
            existing = await self._get_user_role_assignment(
                user_id, role_id, resource_type, resource_id
            )
            if existing:
                existing.is_active = True
                existing.assigned_at = datetime.utcnow()
                existing.assigned_by = assigned_by
                existing.expires_at = expires_at
                await self.db.commit()
                return existing

            assignment = UserRoleAssignment(
                user_id=user_id,
                role_id=role_id,
                resource_type=resource_type,
                resource_id=resource_id,
                assigned_by=assigned_by,
                expires_at=expires_at,
            )

            self.db.add(assignment)
            await self.db.commit()
            await self.db.refresh(assignment)

            # Clear cache for affected user
            await self._clear_cache_for_user(user_id)

            logger.info(f"Assigned role {role_id} to user {user_id}")
            return assignment

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to assign role {role_id} to user {user_id}: {e}")
            raise

    async def revoke_role_from_user(
        self,
        user_id: str,
        role_id: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
    ) -> bool:
        """
        Revoke a role from a user.

        Args:
            user_id: User ID to revoke role from
            role_id: Role ID to revoke
            resource_type: Optional resource type for scoped revocation
            resource_id: Optional resource ID for scoped revocation

        Returns:
            True if role was revoked, False if not found
        """
        try:
            assignment = await self._get_user_role_assignment(
                user_id, role_id, resource_type, resource_id
            )

            if not assignment:
                return False

            assignment.is_active = False
            await self.db.commit()

            # Clear cache for affected user
            await self._clear_cache_for_user(user_id)

            logger.info(f"Revoked role {role_id} from user {user_id}")
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to revoke role {role_id} from user {user_id}: {e}")
            raise

    async def grant_resource_permission(
        self,
        user_id: str,
        permission_name: str,
        resource_type: ResourceType,
        resource_id: str,
        granted_by: Optional[str] = None,
        expires_at: Optional[datetime] = None,
    ) -> ResourcePermission:
        """
        Grant a direct permission to a user for a specific resource.

        Args:
            user_id: User ID to grant permission to
            permission_name: Permission name to grant
            resource_type: Type of resource
            resource_id: ID of resource
            granted_by: Optional user ID granting the permission
            expires_at: Optional expiration time

        Returns:
            Created ResourcePermission instance
        """
        try:
            # Get permission by name
            permission = await self._get_permission_by_name(permission_name)
            if not permission:
                raise ValidationError(f"Permission '{permission_name}' not found")

            # Check if permission already exists
            existing = await self._get_resource_permission(
                user_id, permission.id, resource_type, resource_id
            )
            if existing:
                existing.is_active = True
                existing.granted_at = datetime.utcnow()
                existing.granted_by = granted_by
                existing.expires_at = expires_at
                await self.db.commit()
                return existing

            resource_permission = ResourcePermission(
                user_id=user_id,
                permission_id=permission.id,
                resource_type=resource_type,
                resource_id=resource_id,
                granted_by=granted_by,
                expires_at=expires_at,
            )

            self.db.add(resource_permission)
            await self.db.commit()
            await self.db.refresh(resource_permission)

            # Clear cache for affected user
            await self._clear_cache_for_user(user_id)

            logger.info(
                f"Granted permission {permission_name} to user {user_id} "
                f"for resource {resource_type.value}:{resource_id}"
            )
            return resource_permission

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to grant permission {permission_name}: {e}")
            raise

    async def get_user_permissions_summary(self, user_id: str) -> dict[str, Any]:
        """
        Get a summary of all permissions for a user.

        Args:
            user_id: User ID to get permissions for

        Returns:
            Dictionary containing:
            - global_permissions: Set of globally granted permissions
            - resource_permissions: Dict of resource-specific permissions
            - roles: Set of assigned roles
            - role_hierarchy: Hierarchical role information
        """
        try:
            # Get user object
            user = await self._get_user_by_id(user_id)
            if not user:
                raise ResourceNotFoundError(f"User {user_id} not found")

            permissions = await self._get_user_permissions(user)

            return {
                "user_id": user_id,
                "global_permissions": list(permissions["global"]),
                "resource_permissions": {
                    k: list(v) for k, v in permissions["resource"].items()
                },
                "roles": list(permissions["roles"]),
                "role_hierarchy": permissions["hierarchy"],
            }

        except Exception as e:
            logger.error(f"Failed to get permissions summary for user {user_id}: {e}")
            raise

    # Helper methods

    async def _get_user_permissions(self, user: User) -> dict[str, Any]:
        """
        Get all permissions for a user, including inherited permissions.

        Args:
            user: User to get permissions for

        Returns:
            Dictionary with permissions, roles, and hierarchy info
        """
        # Check cache first
        cache_key = f"user_permissions:{user.id}"
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key]

        result = {"global": set(), "resource": {}, "roles": set(), "hierarchy": []}

        try:
            # Get all active role assignments for user
            role_assignments = await self._get_user_role_assignments(user.id)

            for assignment in role_assignments:
                role = assignment.role
                if not role.is_active:
                    continue

                # Add role to result
                result["roles"].add(role.name)

                # Get role hierarchy
                role_hierarchy = await self._get_role_hierarchy(role)
                result["hierarchy"].extend(role_hierarchy)

                # Get permissions from role and parent roles
                role_permissions = await self._get_role_permissions(role)
                result["global"].update(role_permissions["global"])

                # Handle resource-scoped permissions
                if assignment.resource_type and assignment.resource_id:
                    resource_key = (
                        f"{assignment.resource_type.value}:{assignment.resource_id}"
                    )
                    result["resource"][resource_key] = set()
                    result["resource"][resource_key].update(role_permissions["global"])

                # Add resource-specific permissions
                resource_permissions = await self._get_user_resource_permissions(
                    user.id
                )
                for perm in resource_permissions:
                    if perm.is_active:
                        resource_key = f"{perm.resource_type.value}:{perm.resource_id}"
                        if resource_key not in result["resource"]:
                            result["resource"][resource_key] = set()
                        result["resource"][resource_key].add(perm.permission.name)

            # Cache the result
            self._permission_cache[cache_key] = result
            return result

        except Exception as e:
            logger.error(f"Failed to get permissions for user {user.id}: {e}")
            raise

    async def _check_scope_permissions(
        self, user: User, scope: str, user_permissions: dict[str, Any]
    ) -> bool:
        """
        Check if user has permissions for a specific scope.

        Args:
            user: User to check
            scope: Permission scope to check
            user_permissions: User's current permissions

        Returns:
            True if user has required scope permissions
        """
        # Scope-based permission checking logic
        # This can be expanded based on specific business rules

        if scope.startswith("system:"):
            # System permissions require global admin access
            return "system:admin" in user_permissions["global"]

        elif scope.startswith("organization:"):
            # Organization permissions can be scoped or global
            return "organization:read" in user_permissions["global"] or any(
                p.startswith("organization:") for p in user_permissions["global"]
            )

        elif scope.startswith("project:"):
            # Project permissions
            return "project:read" in user_permissions["global"] or any(
                p.startswith("project:") for p in user_permissions["global"]
            )

        # Add more scope-based checks as needed
        return False

    # Database query helper methods

    async def _get_permission_by_name(self, name: str) -> Optional[Permission]:
        """Get permission by name."""
        result = await self.db.execute(
            select(Permission).where(Permission.name == name)
        )
        return result.scalar_one_or_none()

    async def _get_role_by_name(
        self, name: str, organization_id: Optional[str] = None
    ) -> Optional[Role]:
        """Get role by name and optional organization."""
        query = select(Role).where(Role.name == name)
        if organization_id:
            query = query.where(Role.organization_id == organization_id)
        else:
            query = query.where(Role.organization_id.is_(None))

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_user_role_assignment(
        self,
        user_id: str,
        role_id: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
    ) -> Optional[UserRoleAssignment]:
        """Get user role assignment."""
        query = select(UserRoleAssignment).where(
            and_(
                UserRoleAssignment.user_id == user_id,
                UserRoleAssignment.role_id == role_id,
                UserRoleAssignment.resource_type == resource_type,
                UserRoleAssignment.resource_id == resource_id,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_user_role_assignments(
        self, user_id: str
    ) -> list[UserRoleAssignment]:
        """Get all active role assignments for a user."""
        result = await self.db.execute(
            select(UserRoleAssignment).where(
                and_(
                    UserRoleAssignment.user_id == user_id,
                    UserRoleAssignment.is_active == True,
                    or_(
                        UserRoleAssignment.expires_at.is_(None),
                        UserRoleAssignment.expires_at > datetime.utcnow(),
                    ),
                )
            )
        )
        return result.scalars().all()

    async def _get_resource_permission(
        self,
        user_id: str,
        permission_id: str,
        resource_type: ResourceType,
        resource_id: str,
    ) -> Optional[ResourcePermission]:
        """Get resource permission."""
        result = await self.db.execute(
            select(ResourcePermission).where(
                and_(
                    ResourcePermission.user_id == user_id,
                    ResourcePermission.permission_id == permission_id,
                    ResourcePermission.resource_type == resource_type,
                    ResourcePermission.resource_id == resource_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def _get_user_resource_permissions(
        self, user_id: str
    ) -> list[ResourcePermission]:
        """Get all active resource permissions for a user."""
        result = await self.db.execute(
            select(ResourcePermission).where(
                and_(
                    ResourcePermission.user_id == user_id,
                    ResourcePermission.is_active == True,
                    or_(
                        ResourcePermission.expires_at.is_(None),
                        ResourcePermission.expires_at > datetime.utcnow(),
                    ),
                )
            )
        )
        return result.scalars().all()

    async def _get_role_permissions(self, role: Role) -> dict[str, set]:
        """Get all permissions for a role, including inherited permissions."""
        permissions = {"global": set()}

        # Add permissions from this role
        for permission in role.permissions:
            if permission.is_active:
                permissions["global"].add(permission.name)

        # Recursively add permissions from parent roles
        if role.parent_role:
            parent_permissions = await self._get_role_permissions(role.parent_role)
            permissions["global"].update(parent_permissions["global"])

        return permissions

    async def _get_role_hierarchy(self, role: Role) -> list[str]:
        """Get role hierarchy including parent roles."""
        hierarchy = [role.name]

        if role.parent_role:
            parent_hierarchy = await self._get_role_hierarchy(role.parent_role)
            hierarchy.extend(parent_hierarchy)

        return hierarchy

    async def _get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    # Cache management methods

    async def _clear_cache_for_user(self, user_id: str):
        """Clear permission cache for a specific user."""
        cache_key = f"user_permissions:{user_id}"
        if cache_key in self._permission_cache:
            del self._permission_cache[cache_key]

    async def _clear_cache_for_role(self, role: Role):
        """Clear cache for all users with this role."""
        # This is a simplified version - in production, you might want to
        # track which users have which roles for more efficient cache clearing
        self._permission_cache.clear()

    def clear_all_cache(self):
        """Clear all permission cache."""
        self._permission_cache.clear()
        self._role_cache.clear()


# Decorator for permission checking
def require_permission(
    permission_name: str, resource_type: Optional[ResourceType] = None
):
    """
    Decorator to require a specific permission for function execution.

    Args:
        permission_name: Required permission name
        resource_type: Optional resource type required

    Usage:
        @require_permission("project:read", ResourceType.PROJECT)
        async def get_project(project_id: str):
            pass
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user from args/kwargs
            user = None
            for arg in args:
                if isinstance(arg, User):
                    user = arg
                    break

            if not user:
                # Try to get user from kwargs
                user = kwargs.get("user")

            if not user:
                raise AuthorizationError("User context required for permission check")

            # Extract resource context if needed
            resource_id = None
            if resource_type:
                # Try to find resource_id in args/kwargs
                for arg in args:
                    if isinstance(arg, str) and len(arg) == 36:  # UUID-like
                        resource_id = arg
                        break
                if not resource_id:
                    resource_id = kwargs.get("resource_id") or kwargs.get("id")

            # Get RBAC service (this would typically be injected)
            # For now, we'll use a simple approach - in production, use proper DI
            from ..core.database import get_db_session

            async with get_db_session() as db:
                rbac_service = RBACService(db)
                await rbac_service.require_permission(
                    user, permission_name, resource_type, resource_id
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator
