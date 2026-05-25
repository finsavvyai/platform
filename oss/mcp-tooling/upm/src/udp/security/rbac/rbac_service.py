"""
Main RBAC service for Universal Dependency Platform.

This service provides comprehensive role-based access control functionality
including role management, permission checking, and audit logging.
"""

from datetime import datetime
from typing import Optional, Union
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from udp.core.models.rbac import (
    Permission,
    PermissionScope,
    ResourcePermission,
    ResourceType,
    Role,
    RoleTemplate,
    UserRoleAssignment,
)
from udp.core.models.user import User

from .exceptions import (
    InvalidAssignmentError,
    PermissionNotFoundError,
    RBACError,
    RoleNotFoundError,
)
from .permission_checker import PermissionChecker

logger = structlog.get_logger()


class RBACService:
    """
    Enterprise-grade RBAC service with comprehensive role and permission management.

    This service provides all RBAC functionality including:
    - Role and permission management
    - User role assignments
    - Resource-specific permissions
    - Permission checking with caching
    - Audit logging
    - Role hierarchy support
    """

    def __init__(self, cache_ttl: int = 300):
        """
        Initialize RBAC service.

        Args:
            cache_ttl: Cache TTL in seconds for permission checks
        """
        self.permission_checker = PermissionChecker(cache_ttl=cache_ttl)

    # ========== Permission Management ==========

    async def create_permission(
        self,
        db: AsyncSession,
        name: str,
        code: str,
        scope: PermissionScope,
        resource_type: ResourceType,
        action: str,
        description: Optional[str] = None,
        is_system: bool = False,
        is_sensitive: bool = False,
        category: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Permission:
        """
        Create a new permission.

        Args:
            db: Database session
            name: Human-readable permission name
            code: Unique permission code
            scope: Permission scope
            resource_type: Type of resource
            action: Action that can be performed
            description: Permission description
            is_system: Whether this is a system permission
            is_sensitive: Whether this permission grants sensitive access
            category: Permission category
            metadata: Additional metadata

        Returns:
            Created permission

        Raises:
            RBACError: If permission already exists
        """
        # Check if permission already exists
        existing = await db.execute(select(Permission).where(Permission.code == code))
        if existing.scalar_one_or_none():
            raise RBACError(f"Permission with code '{code}' already exists")

        permission = Permission(
            name=name,
            code=code,
            description=description,
            scope=scope,
            resource_type=resource_type,
            action=action,
            is_system=is_system,
            is_sensitive=is_sensitive,
            category=category,
            metadata=metadata or {},
        )

        db.add(permission)
        await db.commit()
        await db.refresh(permission)

        logger.info(
            "Permission created",
            permission_id=permission.id,
            code=code,
            scope=scope,
            resource_type=resource_type,
        )

        return permission

    async def get_permission(
        self,
        db: AsyncSession,
        permission_id: Optional[Union[str, UUID]] = None,
        code: Optional[str] = None,
    ) -> Optional[Permission]:
        """
        Get a permission by ID or code.

        Args:
            db: Database session
            permission_id: Permission ID
            code: Permission code

        Returns:
            Permission if found, None otherwise
        """
        if permission_id:
            result = await db.execute(
                select(Permission).where(Permission.id == permission_id)
            )
        elif code:
            result = await db.execute(select(Permission).where(Permission.code == code))
        else:
            raise ValueError("Either permission_id or code must be provided")

        return result.scalar_one_or_none()

    async def list_permissions(
        self,
        db: AsyncSession,
        scope: Optional[PermissionScope] = None,
        resource_type: Optional[ResourceType] = None,
        category: Optional[str] = None,
        is_system: Optional[bool] = None,
        page: int = 1,
        limit: int = 100,
    ) -> tuple[list[Permission], int]:
        """
        List permissions with filtering and pagination.

        Args:
            db: Database session
            scope: Filter by scope
            resource_type: Filter by resource type
            category: Filter by category
            is_system: Filter system permissions
            page: Page number
            limit: Items per page

        Returns:
            Tuple of (permissions list, total count)
        """
        query = select(Permission)
        count_query = select(func.count(Permission.id))

        # Apply filters
        conditions = []
        if scope:
            conditions.append(Permission.scope == scope)
        if resource_type:
            conditions.append(Permission.resource_type == resource_type)
        if category:
            conditions.append(Permission.category == category)
        if is_system is not None:
            conditions.append(Permission.is_system == is_system)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Get total count
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        query = query.order_by(
            Permission.scope, Permission.resource_type, Permission.code
        )

        result = await db.execute(query)
        permissions = list(result.scalars().all())

        return permissions, total

    # ========== Role Management ==========

    async def create_role(
        self,
        db: AsyncSession,
        name: str,
        code: str,
        description: Optional[str] = None,
        is_system: bool = False,
        is_active: bool = True,
        is_privileged: bool = False,
        level: int = 0,
        parent_role_id: Optional[Union[str, UUID]] = None,
        organization_id: Optional[Union[str, UUID]] = None,
        permission_codes: Optional[list[str]] = None,
        metadata: Optional[dict] = None,
    ) -> Role:
        """
        Create a new role.

        Args:
            db: Database session
            name: Human-readable role name
            code: Unique role code within scope
            description: Role description
            is_system: Whether this is a system role
            is_active: Whether role is active
            is_privileged: Whether role has elevated privileges
            level: Role hierarchy level
            parent_role_id: Parent role for inheritance
            organization_id: Organization for custom roles
            permission_codes: List of permission codes to assign
            metadata: Additional metadata

        Returns:
            Created role

        Raises:
            RBACError: If role already exists
            RoleNotFoundError: If parent role not found
        """
        # Check if role already exists
        existing = await db.execute(
            select(Role).where(
                and_(
                    Role.code == code,
                    Role.organization_id
                    == (str(organization_id) if organization_id else None),
                )
            )
        )
        if existing.scalar_one_or_none():
            raise RBACError(f"Role with code '{code}' already exists in this scope")

        # Check parent role
        parent_role = None
        if parent_role_id:
            parent_result = await db.execute(
                select(Role).where(Role.id == parent_role_id)
            )
            parent_role = parent_result.scalar_one_or_none()
            if not parent_role:
                raise RoleNotFoundError(role_id=str(parent_role_id))

        # Create role
        role = Role(
            name=name,
            code=code,
            description=description,
            is_system=is_system,
            is_active=is_active,
            is_privileged=is_privileged,
            level=level,
            parent_role_id=parent_role_id,
            organization_id=organization_id,
            metadata=metadata or {},
        )

        db.add(role)
        await db.flush()  # Get the role ID

        # Add permissions if provided
        if permission_codes:
            await self._add_permissions_to_role(db, role, permission_codes)

        await db.commit()
        await db.refresh(role)

        logger.info(
            "Role created",
            role_id=role.id,
            code=code,
            organization_id=organization_id,
            permission_count=len(permission_codes) if permission_codes else 0,
        )

        return role

    async def get_role(
        self,
        db: AsyncSession,
        role_id: Optional[Union[str, UUID]] = None,
        code: Optional[str] = None,
        organization_id: Optional[Union[str, UUID]] = None,
    ) -> Optional[Role]:
        """
        Get a role by ID or code.

        Args:
            db: Database session
            role_id: Role ID
            code: Role code
            organization_id: Organization context for code lookup

        Returns:
            Role if found, None otherwise
        """
        if role_id:
            result = await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .where(Role.id == role_id)
            )
        elif code:
            query = (
                select(Role)
                .options(selectinload(Role.permissions))
                .where(Role.code == code)
            )
            if organization_id:
                query = query.where(Role.organization_id == str(organization_id))
            else:
                query = query.where(Role.organization_id.is_(None))
            result = await db.execute(query)
        else:
            raise ValueError("Either role_id or code must be provided")

        return result.scalar_one_or_none()

    async def update_role(
        self,
        db: AsyncSession,
        role_id: Union[str, UUID],
        updates: dict,
    ) -> Role:
        """
        Update a role.

        Args:
            db: Database session
            role_id: Role ID to update
            updates: Dictionary of fields to update

        Returns:
            Updated role

        Raises:
            RoleNotFoundError: If role not found
            RBACError: If trying to update system role inappropriately
        """
        role = await self.get_role(db, role_id=role_id)
        if not role:
            raise RoleNotFoundError(role_id=str(role_id))

        # Check system role restrictions
        if role.is_system and "is_system" in updates and not updates["is_system"]:
            raise RBACError("Cannot convert system role to non-system")

        # Update fields
        for field, value in updates.items():
            if hasattr(role, field):
                setattr(role, field, value)

        role.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(role)

        logger.info(
            "Role updated",
            role_id=role.id,
            updates=list(updates.keys()),
        )

        return role

    async def delete_role(
        self,
        db: AsyncSession,
        role_id: Union[str, UUID],
        force: bool = False,
    ) -> None:
        """
        Delete a role.

        Args:
            db: Database session
            role_id: Role ID to delete
            force: Force delete even if role has assignments

        Raises:
            RoleNotFoundError: If role not found
            RBACError: If role has active assignments and force=False
        """
        role = await self.get_role(db, role_id=role_id)
        if not role:
            raise RoleNotFoundError(role_id=str(role_id))

        # Check for active assignments
        if not force:
            assignment_count = await db.execute(
                select(func.count(UserRoleAssignment.id))
                .where(UserRoleAssignment.role_id == role_id)
                .where(UserRoleAssignment.is_active == True)
            )
            if assignment_count.scalar() > 0:
                raise RBACError(
                    "Cannot delete role with active assignments. "
                    "Use force=True to override."
                )

        # Delete role (cascade will handle relationships)
        await db.delete(role)
        await db.commit()

        logger.info(
            "Role deleted",
            role_id=role.id,
            code=role.code,
            force=force,
        )

    async def add_permissions_to_role(
        self,
        db: AsyncSession,
        role_id: Union[str, UUID],
        permission_codes: list[str],
    ) -> Role:
        """
        Add permissions to a role.

        Args:
            db: Database session
            role_id: Role ID
            permission_codes: List of permission codes to add

        Returns:
            Updated role

        Raises:
            RoleNotFoundError: If role not found
            PermissionNotFoundError: If any permission not found
        """
        role = await self.get_role(db, role_id=role_id)
        if not role:
            raise RoleNotFoundError(role_id=str(role_id))

        await self._add_permissions_to_role(db, role, permission_codes)

        await db.commit()
        await db.refresh(role)

        logger.info(
            "Permissions added to role",
            role_id=role.id,
            permission_codes=permission_codes,
        )

        return role

    async def remove_permissions_from_role(
        self,
        db: AsyncSession,
        role_id: Union[str, UUID],
        permission_codes: list[str],
    ) -> Role:
        """
        Remove permissions from a role.

        Args:
            db: Database session
            role_id: Role ID
            permission_codes: List of permission codes to remove

        Returns:
            Updated role

        Raises:
            RoleNotFoundError: If role not found
        """
        role = await self.get_role(db, role_id=role_id)
        if not role:
            raise RoleNotFoundError(role_id=str(role_id))

        # Get permissions to remove
        permissions_to_remove = await db.execute(
            select(Permission).where(Permission.code.in_(permission_codes))
        )
        permissions = list(permissions_to_remove.scalars().all())

        # Remove permissions
        for permission in permissions:
            if permission in role.permissions:
                role.permissions.remove(permission)

        await db.commit()
        await db.refresh(role)

        logger.info(
            "Permissions removed from role",
            role_id=role.id,
            permission_codes=permission_codes,
        )

        return role

    # ========== Role Assignment Management ==========

    async def assign_role_to_user(
        self,
        db: AsyncSession,
        user_id: Union[str, UUID],
        role_id: Union[str, UUID],
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
        expires_at: Optional[datetime] = None,
        assigned_by: Optional[Union[str, UUID]] = None,
        reason: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> UserRoleAssignment:
        """
        Assign a role to a user.

        Args:
            db: Database session
            user_id: User ID
            role_id: Role ID
            organization_id: Organization context
            project_id: Project context
            expires_at: When assignment expires
            assigned_by: Who made the assignment
            reason: Reason for assignment
            metadata: Additional metadata

        Returns:
            Created role assignment

        Raises:
            RoleNotFoundError: If role not found
            InvalidAssignmentError: If assignment is invalid
        """
        # Validate role
        role = await self.get_role(db, role_id=role_id)
        if not role:
            raise RoleNotFoundError(role_id=str(role_id))

        # Validate scope
        if project_id and not organization_id:
            raise InvalidAssignmentError(
                "Project-specific roles require organization context"
            )

        if role.organization_id and str(role.organization_id) != str(organization_id):
            raise InvalidAssignmentError("Role belongs to different organization")

        # Check if assignment already exists
        existing = await db.execute(
            select(UserRoleAssignment).where(
                and_(
                    UserRoleAssignment.user_id == str(user_id),
                    UserRoleAssignment.role_id == str(role_id),
                    UserRoleAssignment.organization_id
                    == (str(organization_id) if organization_id else None),
                    UserRoleAssignment.project_id
                    == (str(project_id) if project_id else None),
                )
            )
        )
        existing_assignment = existing.scalar_one_or_none()

        if existing_assignment:
            # Reactivate existing assignment
            existing_assignment.is_active = True
            existing_assignment.expires_at = expires_at
            existing_assignment.assigned_by = str(assigned_by) if assigned_by else None
            existing_assignment.assigned_at = datetime.utcnow()
            existing_assignment.reason = reason
            existing_assignment.metadata = metadata or {}

            await db.commit()
            await db.refresh(existing_assignment)

            logger.info(
                "Role assignment reactivated",
                assignment_id=existing_assignment.id,
                user_id=user_id,
                role_id=role_id,
            )

            return existing_assignment

        # Create new assignment
        assignment = UserRoleAssignment(
            user_id=str(user_id),
            role_id=str(role_id),
            organization_id=str(organization_id) if organization_id else None,
            project_id=str(project_id) if project_id else None,
            expires_at=expires_at,
            assigned_by=str(assigned_by) if assigned_by else None,
            reason=reason,
            metadata=metadata or {},
        )

        db.add(assignment)
        await db.commit()
        await db.refresh(assignment)

        # Clear permission cache for this user
        self.permission_checker.clear_cache(user_id)

        logger.info(
            "Role assigned to user",
            assignment_id=assignment.id,
            user_id=user_id,
            role_id=role_id,
            organization_id=organization_id,
            project_id=project_id,
            expires_at=expires_at,
        )

        return assignment

    async def remove_role_from_user(
        self,
        db: AsyncSession,
        user_id: Union[str, UUID],
        role_id: Union[str, UUID],
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
    ) -> bool:
        """
        Remove a role assignment from a user.

        Args:
            db: Database session
            user_id: User ID
            role_id: Role ID
            organization_id: Organization context
            project_id: Project context

        Returns:
            True if assignment was removed, False if not found
        """
        # Find assignment
        result = await db.execute(
            select(UserRoleAssignment).where(
                and_(
                    UserRoleAssignment.user_id == str(user_id),
                    UserRoleAssignment.role_id == str(role_id),
                    UserRoleAssignment.organization_id
                    == (str(organization_id) if organization_id else None),
                    UserRoleAssignment.project_id
                    == (str(project_id) if project_id else None),
                )
            )
        )
        assignment = result.scalar_one_or_none()

        if not assignment:
            return False

        # Deactivate assignment
        assignment.is_active = False

        await db.commit()

        # Clear permission cache for this user
        self.permission_checker.clear_cache(user_id)

        logger.info(
            "Role assignment removed",
            assignment_id=assignment.id,
            user_id=user_id,
            role_id=role_id,
        )

        return True

    async def get_user_assignments(
        self,
        db: AsyncSession,
        user_id: Union[str, UUID],
        organization_id: Optional[Union[str, UUID]] = None,
        project_id: Optional[Union[str, UUID]] = None,
        active_only: bool = True,
    ) -> list[UserRoleAssignment]:
        """
        Get all role assignments for a user.

        Args:
            db: Database session
            user_id: User ID
            organization_id: Filter by organization
            project_id: Filter by project
            active_only: Only return active assignments

        Returns:
            List of role assignments
        """
        query = (
            select(UserRoleAssignment)
            .options(selectinload(UserRoleAssignment.role))
            .where(UserRoleAssignment.user_id == str(user_id))
        )

        if organization_id:
            query = query.where(
                or_(
                    UserRoleAssignment.organization_id == str(organization_id),
                    UserRoleAssignment.organization_id.is_(None),
                )
            )

        if project_id:
            query = query.where(
                or_(
                    UserRoleAssignment.project_id == str(project_id),
                    UserRoleAssignment.project_id.is_(None),
                )
            )

        if active_only:
            query = query.where(
                and_(
                    UserRoleAssignment.is_active == True,
                    or_(
                        UserRoleAssignment.expires_at.is_(None),
                        UserRoleAssignment.expires_at > datetime.utcnow(),
                    ),
                )
            )

        result = await db.execute(query)
        return list(result.scalars().all())

    # ========== Resource Permission Management ==========

    async def grant_resource_permission(
        self,
        db: AsyncSession,
        user_id: Union[str, UUID],
        permission_code: str,
        resource_type: ResourceType,
        resource_id: Union[str, UUID],
        organization_id: Optional[Union[str, UUID]] = None,
        expires_at: Optional[datetime] = None,
        granted_by: Optional[Union[str, UUID]] = None,
        reason: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> ResourcePermission:
        """
        Grant a permission to a user on a specific resource.

        Args:
            db: Database session
            user_id: User ID
            permission_code: Permission code to grant
            resource_type: Type of resource
            resource_id: Resource ID
            organization_id: Organization context
            expires_at: When permission expires
            granted_by: Who granted the permission
            reason: Reason for grant
            metadata: Additional metadata

        Returns:
            Created resource permission

        Raises:
            PermissionNotFoundError: If permission not found
        """
        # Get permission
        permission = await self.get_permission(db, code=permission_code)
        if not permission:
            raise PermissionNotFoundError(permission_code=permission_code)

        # Check if permission already exists
        existing = await db.execute(
            select(ResourcePermission).where(
                and_(
                    ResourcePermission.user_id == str(user_id),
                    ResourcePermission.permission_id == permission.id,
                    ResourcePermission.resource_type == resource_type,
                    ResourcePermission.resource_id == str(resource_id),
                )
            )
        )
        existing_permission = existing.scalar_one_or_none()

        if existing_permission:
            # Update existing permission
            existing_permission.is_granted = True
            existing_permission.expires_at = expires_at
            existing_permission.granted_by = str(granted_by) if granted_by else None
            existing_permission.granted_at = datetime.utcnow()
            existing_permission.reason = reason
            existing_permission.metadata = metadata or {}

            await db.commit()
            await db.refresh(existing_permission)

            logger.info(
                "Resource permission updated",
                permission_id=existing_permission.id,
                user_id=user_id,
                permission_code=permission_code,
                resource_type=resource_type,
                resource_id=resource_id,
            )

            return existing_permission

        # Create new resource permission
        resource_permission = ResourcePermission(
            user_id=str(user_id),
            permission_id=permission.id,
            resource_type=resource_type,
            resource_id=str(resource_id),
            is_granted=True,
            organization_id=str(organization_id) if organization_id else None,
            expires_at=expires_at,
            granted_by=str(granted_by) if granted_by else None,
            reason=reason,
            metadata=metadata or {},
        )

        db.add(resource_permission)
        await db.commit()
        await db.refresh(resource_permission)

        # Clear permission cache for this user
        self.permission_checker.clear_cache(user_id)

        logger.info(
            "Resource permission granted",
            permission_id=resource_permission.id,
            user_id=user_id,
            permission_code=permission_code,
            resource_type=resource_type,
            resource_id=resource_id,
        )

        return resource_permission

    async def revoke_resource_permission(
        self,
        db: AsyncSession,
        user_id: Union[str, UUID],
        permission_code: str,
        resource_type: ResourceType,
        resource_id: Union[str, UUID],
    ) -> bool:
        """
        Revoke a permission from a user on a specific resource.

        Args:
            db: Database session
            user_id: User ID
            permission_code: Permission code to revoke
            resource_type: Type of resource
            resource_id: Resource ID

        Returns:
            True if permission was revoked, False if not found
        """
        # Get permission
        permission = await self.get_permission(db, code=permission_code)
        if not permission:
            return False

        # Find resource permission
        result = await db.execute(
            select(ResourcePermission).where(
                and_(
                    ResourcePermission.user_id == str(user_id),
                    ResourcePermission.permission_id == permission.id,
                    ResourcePermission.resource_type == resource_type,
                    ResourcePermission.resource_id == str(resource_id),
                )
            )
        )
        resource_permission = result.scalar_one_or_none()

        if not resource_permission:
            return False

        # Update permission to denied
        resource_permission.is_granted = False

        await db.commit()

        # Clear permission cache for this user
        self.permission_checker.clear_cache(user_id)

        logger.info(
            "Resource permission revoked",
            permission_id=resource_permission.id,
            user_id=user_id,
            permission_code=permission_code,
            resource_type=resource_type,
            resource_id=resource_id,
        )

        return True

    # ========== Permission Checking ==========

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

        This is a convenience method that delegates to the PermissionChecker.
        """
        return await self.permission_checker.check_permission(
            db,
            user,
            permission_code,
            resource_type,
            resource_id,
            organization_id,
            project_id,
        )

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

        This is a convenience method that delegates to the PermissionChecker.
        """
        await self.permission_checker.require_permission(
            db,
            user,
            permission_code,
            resource_type,
            resource_id,
            organization_id,
            project_id,
        )

    # ========== Role Templates ==========

    async def create_role_from_template(
        self,
        db: AsyncSession,
        template_code: str,
        name: str,
        code: str,
        organization_id: Optional[Union[str, UUID]] = None,
        description: Optional[str] = None,
    ) -> Role:
        """
        Create a role from a template.

        Args:
            db: Database session
            template_code: Template code
            name: Role name
            code: Role code
            organization_id: Organization context
            description: Role description

        Returns:
            Created role

        Raises:
            RBACError: If template not found
        """
        # Get template
        result = await db.execute(
            select(RoleTemplate).where(RoleTemplate.code == template_code)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise RBACError(f"Role template '{template_code}' not found")

        # Create role with template permissions
        role = await self.create_role(
            db=db,
            name=name,
            code=code,
            description=description or template.description,
            is_system=False,
            organization_id=organization_id,
            permission_codes=template.permissions,
            metadata=template.default_settings or {},
        )

        logger.info(
            "Role created from template",
            role_id=role.id,
            template_code=template_code,
            permission_count=len(template.permissions),
        )

        return role

    # ========== Helper Methods ==========

    async def _add_permissions_to_role(
        self,
        db: AsyncSession,
        role: Role,
        permission_codes: list[str],
    ) -> None:
        """Add permissions to a role by code."""
        # Get permissions
        permissions_result = await db.execute(
            select(Permission).where(Permission.code.in_(permission_codes))
        )
        permissions = list(permissions_result.scalars().all())

        if len(permissions) != len(permission_codes):
            found_codes = {p.code for p in permissions}
            missing = set(permission_codes) - found_codes
            raise PermissionNotFoundError(
                f"Permissions not found: {', '.join(missing)}"
            )

        # Add permissions to role
        for permission in permissions:
            if permission not in role.permissions:
                role.permissions.append(permission)
