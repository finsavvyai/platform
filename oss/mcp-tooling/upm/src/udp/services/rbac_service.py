"""
RBAC (Role-Based Access Control) Service for Universal Dependency Platform.

This service provides comprehensive permission checking, role management,
and access control functionality throughout the platform.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.models.rbac import (
    Permission,
    ResourcePermission,
    ResourceType,
    Role,
    UserRoleAssignment,
)
from ..core.services import BaseService

logger = logging.getLogger(__name__)


class RBACService(BaseService):
    """
    Service for managing roles, permissions, and access control.

    Provides methods for checking permissions, managing roles,
    and handling user-role assignments with resource scoping.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self._permission_cache: dict[str, set[str]] = {}
        self._role_cache: dict[str, dict[str, Any]] = {}

    async def check_permission(
        self,
        user_id: str,
        permission_name: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> bool:
        """
        Check if a user has a specific permission.

        Args:
            user_id: User ID to check permission for
            permission_name: Permission name to check
            resource_type: Type of resource (optional)
            resource_id: Specific resource ID (optional)
            organization_id: Organization ID for context (optional)

        Returns:
            True if user has permission, False otherwise
        """
        try:
            # Check direct resource permissions first (most specific)
            if resource_type and resource_id:
                has_direct_permission = await self._check_direct_resource_permission(
                    user_id, permission_name, resource_type, resource_id
                )
                if has_direct_permission:
                    return True

            # Check role-based permissions
            has_role_permission = await self._check_role_permission(
                user_id, permission_name, resource_type, resource_id, organization_id
            )

            return has_role_permission

        except Exception as e:
            logger.error(f"Error checking permission for user {user_id}: {e}")
            return False

    async def check_permissions(
        self,
        user_id: str,
        permission_names: list[str],
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        require_all: bool = False,
    ) -> dict[str, bool]:
        """
        Check multiple permissions for a user.

        Args:
            user_id: User ID to check permissions for
            permission_names: List of permission names to check
            resource_type: Type of resource (optional)
            resource_id: Specific resource ID (optional)
            organization_id: Organization ID for context (optional)
            require_all: If True, require all permissions; if False, any permission suffices

        Returns:
            Dictionary mapping permission names to boolean results
        """
        results = {}
        for permission in permission_names:
            results[permission] = await self.check_permission(
                user_id, permission, resource_type, resource_id, organization_id
            )

        return results

    async def get_user_permissions(
        self,
        user_id: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> set[str]:
        """
        Get all permissions for a user in a given context.

        Args:
            user_id: User ID to get permissions for
            resource_type: Type of resource (optional)
            resource_id: Specific resource ID (optional)
            organization_id: Organization ID for context (optional)

        Returns:
            Set of permission names the user has
        """
        permissions = set()

        try:
            # Get direct resource permissions
            if resource_type and resource_id:
                direct_permissions = await self._get_direct_resource_permissions(
                    user_id, resource_type, resource_id
                )
                permissions.update(direct_permissions)

            # Get role-based permissions
            role_permissions = await self._get_role_permissions(
                user_id, resource_type, resource_id, organization_id
            )
            permissions.update(role_permissions)

            return permissions

        except Exception as e:
            logger.error(f"Error getting permissions for user {user_id}: {e}")
            return permissions

    async def assign_role(
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
            resource_type: Resource type for scoped assignment (optional)
            resource_id: Resource ID for scoped assignment (optional)
            assigned_by: User ID making the assignment (optional)
            expires_at: Expiration time for assignment (optional)

        Returns:
            Created UserRoleAssignment
        """
        try:
            # Check if assignment already exists
            existing = await self.db.execute(
                select(UserRoleAssignment).where(
                    and_(
                        UserRoleAssignment.user_id == user_id,
                        UserRoleAssignment.role_id == role_id,
                        UserRoleAssignment.resource_type == resource_type,
                        UserRoleAssignment.resource_id == resource_id,
                    )
                )
            )
            existing_assignment = existing.scalar_one_or_none()

            if existing_assignment:
                # Reactivate existing assignment
                existing_assignment.is_active = True
                existing_assignment.assigned_by = assigned_by
                existing_assignment.expires_at = expires_at
                await self.db.commit()
                return existing_assignment

            # Create new assignment
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

            # Clear cache for this user
            self._clear_user_cache(user_id)

            logger.info(f"Assigned role {role_id} to user {user_id}")
            return assignment

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error assigning role {role_id} to user {user_id}: {e}")
            raise

    async def revoke_role(
        self,
        user_id: str,
        role_id: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
        revoked_by: Optional[str] = None,
    ) -> bool:
        """
        Revoke a role from a user.

        Args:
            user_id: User ID to revoke role from
            role_id: Role ID to revoke
            resource_type: Resource type for scoped assignment (optional)
            resource_id: Resource ID for scoped assignment (optional)
            revoked_by: User ID revoking the role (optional)

        Returns:
            True if role was revoked, False if not found
        """
        try:
            result = await self.db.execute(
                update(UserRoleAssignment)
                .where(
                    and_(
                        UserRoleAssignment.user_id == user_id,
                        UserRoleAssignment.role_id == role_id,
                        UserRoleAssignment.resource_type == resource_type,
                        UserRoleAssignment.resource_id == resource_id,
                        UserRoleAssignment.is_active == True,
                    )
                )
                .values(is_active=False)
            )

            await self.db.commit()

            # Clear cache for this user
            self._clear_user_cache(user_id)

            if result.rowcount > 0:
                logger.info(f"Revoked role {role_id} from user {user_id}")
                return True

            return False

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error revoking role {role_id} from user {user_id}: {e}")
            raise

    async def grant_permission(
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
            resource_id: Specific resource ID
            granted_by: User ID granting the permission (optional)
            expires_at: Expiration time for permission (optional)

        Returns:
            Created ResourcePermission
        """
        try:
            # Get permission ID
            permission = await self._get_permission_by_name(permission_name)
            if not permission:
                raise ValueError(f"Permission not found: {permission_name}")

            # Check if permission already exists
            existing = await self.db.execute(
                select(ResourcePermission).where(
                    and_(
                        ResourcePermission.user_id == user_id,
                        ResourcePermission.permission_id == permission.id,
                        ResourcePermission.resource_type == resource_type,
                        ResourcePermission.resource_id == resource_id,
                    )
                )
            )
            existing_permission = existing.scalar_one_or_none()

            if existing_permission:
                # Reactivate existing permission
                existing_permission.is_active = True
                existing_permission.granted_by = granted_by
                existing_permission.expires_at = expires_at
                await self.db.commit()
                return existing_permission

            # Create new permission
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

            # Clear cache for this user
            self._clear_user_cache(user_id)

            logger.info(
                f"Granted permission {permission_name} to user {user_id} "
                f"for resource {resource_type}:{resource_id}"
            )
            return resource_permission

        except Exception as e:
            await self.db.rollback()
            logger.error(
                f"Error granting permission {permission_name} to user {user_id}: {e}"
            )
            raise

    async def create_role(
        self,
        name: str,
        display_name: str,
        description: Optional[str] = None,
        organization_id: Optional[str] = None,
        permission_names: Optional[list[str]] = None,
        parent_role_id: Optional[str] = None,
    ) -> Role:
        """
        Create a new role.

        Args:
            name: Role name (unique within organization)
            display_name: Display name for the role
            description: Role description (optional)
            organization_id: Organization ID (None for system roles)
            permission_names: List of permission names to assign (optional)
            parent_role_id: Parent role ID for inheritance (optional)

        Returns:
            Created Role
        """
        try:
            # Check if role already exists
            existing = await self.db.execute(
                select(Role).where(
                    and_(Role.name == name, Role.organization_id == organization_id)
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Role already exists: {name}")

            # Create role
            role = Role(
                name=name,
                display_name=display_name,
                description=description,
                organization_id=organization_id,
                parent_role_id=parent_role_id,
            )

            self.db.add(role)
            await self.db.flush()  # Get role ID

            # Assign permissions if provided
            if permission_names:
                await self._assign_permissions_to_role(role, permission_names)

            await self.db.commit()
            await self.db.refresh(role)

            logger.info(
                f"Created role {name} with {len(permission_names or [])} permissions"
            )
            return role

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating role {name}: {e}")
            raise

    async def get_user_roles(
        self,
        user_id: str,
        resource_type: Optional[ResourceType] = None,
        resource_id: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> list[Role]:
        """
        Get all roles assigned to a user in a given context.

        Args:
            user_id: User ID to get roles for
            resource_type: Resource type (optional)
            resource_id: Resource ID (optional)
            organization_id: Organization ID for context (optional)

        Returns:
            List of assigned roles
        """
        try:
            query = (
                select(Role)
                .join(UserRoleAssignment)
                .where(
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

            # Filter by resource scope
            if resource_type and resource_id:
                query = query.where(
                    or_(
                        and_(
                            UserRoleAssignment.resource_type == resource_type,
                            UserRoleAssignment.resource_id == resource_id,
                        ),
                        # Also include global roles
                        and_(
                            UserRoleAssignment.resource_type.is_(None),
                            UserRoleAssignment.resource_id.is_(None),
                        ),
                    )
                )

            # Filter by organization
            if organization_id:
                query = query.where(
                    or_(
                        Role.organization_id == organization_id,
                        Role.organization_id.is_(None),  # System roles
                    )
                )

            result = await self.db.execute(query)
            return result.scalars().all()

        except Exception as e:
            logger.error(f"Error getting roles for user {user_id}: {e}")
            return []

    # Private helper methods

    async def _check_direct_resource_permission(
        self,
        user_id: str,
        permission_name: str,
        resource_type: ResourceType,
        resource_id: str,
    ) -> bool:
        """Check if user has direct permission for a specific resource."""
        try:
            permission = await self._get_permission_by_name(permission_name)
            if not permission:
                return False

            result = await self.db.execute(
                select(ResourcePermission).where(
                    and_(
                        ResourcePermission.user_id == user_id,
                        ResourcePermission.permission_id == permission.id,
                        ResourcePermission.resource_type == resource_type,
                        ResourcePermission.resource_id == resource_id,
                        ResourcePermission.is_active == True,
                        or_(
                            ResourcePermission.expires_at.is_(None),
                            ResourcePermission.expires_at > datetime.utcnow(),
                        ),
                    )
                )
            )

            return result.scalar_one_or_none() is not None

        except Exception as e:
            logger.error(f"Error checking direct resource permission: {e}")
            return False

    async def _check_role_permission(
        self,
        user_id: str,
        permission_name: str,
        resource_type: Optional[ResourceType],
        resource_id: Optional[str],
        organization_id: Optional[str],
    ) -> bool:
        """Check if user has permission through role assignments."""
        try:
            # Get user's effective permissions in this context
            permissions = await self._get_role_permissions(
                user_id, resource_type, resource_id, organization_id
            )

            return permission_name in permissions

        except Exception as e:
            logger.error(f"Error checking role permission: {e}")
            return False

    async def _get_direct_resource_permissions(
        self, user_id: str, resource_type: ResourceType, resource_id: str
    ) -> set[str]:
        """Get direct resource permissions for a user."""
        permissions = set()

        try:
            result = await self.db.execute(
                select(Permission.name)
                .join(ResourcePermission)
                .where(
                    and_(
                        ResourcePermission.user_id == user_id,
                        ResourcePermission.resource_type == resource_type,
                        ResourcePermission.resource_id == resource_id,
                        ResourcePermission.is_active == True,
                        or_(
                            ResourcePermission.expires_at.is_(None),
                            ResourcePermission.expires_at > datetime.utcnow(),
                        ),
                    )
                )
            )

            for row in result:
                permissions.add(row[0])

        except Exception as e:
            logger.error(f"Error getting direct resource permissions: {e}")

        return permissions

    async def _get_role_permissions(
        self,
        user_id: str,
        resource_type: Optional[ResourceType],
        resource_id: Optional[str],
        organization_id: Optional[str],
    ) -> set[str]:
        """Get permissions for a user through their role assignments."""
        cache_key = f"{user_id}:{resource_type}:{resource_id}:{organization_id}"

        # Check cache first
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key]

        permissions = set()

        try:
            # Get all applicable roles for the user
            roles = await self.get_user_roles(
                user_id, resource_type, resource_id, organization_id
            )

            for role in roles:
                # Get permissions for this role (including inherited permissions)
                role_permissions = await self._get_role_permissions_recursive(role)
                permissions.update(role_permissions)

            # Cache the result
            self._permission_cache[cache_key] = permissions

        except Exception as e:
            logger.error(f"Error getting role permissions: {e}")

        return permissions

    async def _get_role_permissions_recursive(self, role: Role) -> set[str]:
        """Get all permissions for a role, including inherited permissions."""
        permissions = set()

        try:
            # Get direct permissions
            result = await self.db.execute(
                select(Permission.name)
                .join(Role.permissions)
                .where(and_(Role.id == role.id, Permission.is_active == True))
            )

            for row in result:
                permissions.add(row[0])

            # Get inherited permissions from parent role
            if role.parent_role:
                result = await self.db.execute(
                    select(Role).where(Role.id == role.parent_role_id)
                )
                parent_role = result.scalar_one_or_none()
                if parent_role:
                    parent_permissions = await self._get_role_permissions_recursive(
                        parent_role
                    )
                    permissions.update(parent_permissions)

        except Exception as e:
            logger.error(f"Error getting role permissions recursively: {e}")

        return permissions

    async def _get_permission_by_name(self, name: str) -> Optional[Permission]:
        """Get permission by name."""
        try:
            result = await self.db.execute(
                select(Permission).where(Permission.name == name)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting permission by name {name}: {e}")
            return None

    async def _assign_permissions_to_role(
        self, role: Role, permission_names: list[str]
    ) -> None:
        """Assign permissions to a role."""
        try:
            for permission_name in permission_names:
                permission = await self._get_permission_by_name(permission_name)
                if permission:
                    role.permissions.append(permission)
                else:
                    logger.warning(f"Permission not found: {permission_name}")

        except Exception as e:
            logger.error(f"Error assigning permissions to role: {e}")
            raise

    def _clear_user_cache(self, user_id: str) -> None:
        """Clear cached permissions for a user."""
        keys_to_remove = [
            key for key in self._permission_cache.keys() if key.startswith(user_id)
        ]
        for key in keys_to_remove:
            del self._permission_cache[key]
