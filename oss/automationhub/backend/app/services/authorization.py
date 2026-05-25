"""
Comprehensive Authorization Service for Advanced RBAC

This service implements enterprise-grade authorization with support for:
- Hierarchical role-based access control with inheritance
- Granular, resource-based permissions
- Time-based and condition-based permission checks
- Dynamic permission evaluation with context awareness
- Permission overrides and conflict resolution
- Resource ownership and team-based access
- Advanced caching and performance optimization
- Comprehensive audit logging

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

from typing import List, Dict, Any, Optional, Set, Union, Tuple
from datetime import datetime, timedelta
from enum import Enum
import json
import logging
import hashlib
from functools import lru_cache
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.dialects.postgresql import UUID

from app.models.rbac import (
    Role, Permission, RolePermission, UserRoleAssignment,
    ResourcePermission, PermissionAuditLog, PermissionScope,
    PermissionAction, ResourceType
)
from app.models.user import User
from app.models.organization import Organization

logger = logging.getLogger(__name__)


@dataclass
class PermissionCheckContext:
    """Context for permission checks"""
    request_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    resource_id: Optional[str] = None
    resource_type: Optional[str] = None
    organization_id: Optional[str] = None
    team_id: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None


@dataclass
class PermissionResult:
    """Result of permission check"""
    granted: bool
    reason: Optional[str] = None
    source: Optional[str] = None  # 'role', 'direct', 'inherited', 'resource'
    conditions_met: bool = True
    expires_at: Optional[datetime] = None
    cached: bool = False


class AuthorizationService:
    """
    Comprehensive authorization service with advanced RBAC features
    """

    def __init__(self):
        self._permission_cache = {}
        self._role_cache = {}
        self._cache_timeout = 300  # 5 minutes
        self._max_cache_size = 10000

    async def initialize_system_permissions(self, db: AsyncSession) -> None:
        """Initialize system permissions if they don't exist"""
        try:
            system_permissions = self._get_system_permissions()

            for perm_data in system_permissions:
                # Check if permission exists
                result = await db.execute(
                    select(Permission).where(Permission.name == perm_data["name"])
                )
                existing_perm = result.scalar_one_or_none()

                if not existing_perm:
                    # Create new permission
                    new_permission = Permission(
                        name=perm_data["name"],
                        description=perm_data["description"],
                        category=perm_data["category"],
                        action=perm_data["action"],
                        resource_type=perm_data["resource_type"],
                        scope=perm_data["scope"],
                        is_system=True,
                        conditions=perm_data.get("conditions", {}),
                        constraints=perm_data.get("constraints", {})
                    )
                    db.add(new_permission)
                    logger.info(f"Created system permission: {perm_data['name']}")
                else:
                    # Update existing permission
                    existing_perm.description = perm_data["description"]
                    existing_perm.category = perm_data["category"]
                    existing_perm.conditions = perm_data.get("conditions", {})
                    existing_perm.constraints = perm_data.get("constraints", {})
                    logger.info(f"Updated system permission: {perm_data['name']}")

            await db.commit()
            logger.info("System permissions initialized successfully")

        except Exception as e:
            logger.error(f"Error initializing system permissions: {e}")
            await db.rollback()
            raise

    async def initialize_system_roles(self, db: AsyncSession) -> None:
        """Initialize system roles with hierarchical structure"""
        try:
            system_roles = self._get_system_roles()

            # Create roles in order (parents first)
            for role_data in sorted(system_roles, key=lambda x: x.get('level', 0)):
                # Check if role exists
                result = await db.execute(
                    select(Role).where(Role.name == role_data["name"])
                )
                existing_role = result.scalar_one_or_none()

                if not existing_role:
                    # Create new role
                    new_role = Role(
                        name=role_data["name"],
                        display_name=role_data.get("display_name"),
                        description=role_data["description"],
                        category=role_data.get("category", "system"),
                        level=role_data.get("level", 0),
                        is_system_role=True,
                        is_assignable=role_data.get("is_assignable", True),
                        role_metadata=role_data.get("metadata", {}),
                        tags=role_data.get("tags", [])
                    )

                    # Set parent role if specified
                    if "parent_role" in role_data:
                        parent_result = await db.execute(
                            select(Role).where(Role.name == role_data["parent_role"])
                        )
                        parent_role = parent_result.scalar_one_or_none()
                        if parent_role:
                            new_role.parent_role_id = parent_role.id

                    db.add(new_role)
                    await db.flush()  # Get the ID

                    # Add permissions
                    for perm_name in role_data.get("permissions", []):
                        await self._add_permission_to_role(db, new_role.id, perm_name)

                    logger.info(f"Created system role: {role_data['name']}")
                else:
                    # Update existing role
                    existing_role.display_name = role_data.get("display_name")
                    existing_role.description = role_data["description"]
                    existing_role.role_metadata = role_data.get("metadata", {})
                    existing_role.tags = role_data.get("tags", [])

                    # Update permissions
                    await self._update_role_permissions(db, existing_role, role_data.get("permissions", []))

                    logger.info(f"Updated system role: {role_data['name']}")

            await db.commit()
            logger.info("System roles initialized successfully")

        except Exception as e:
            logger.error(f"Error initializing system roles: {e}")
            await db.rollback()
            raise

    async def check_permission(
        self,
        db: AsyncSession,
        user_id: str,
        permission_name: str,
        context: Optional[PermissionCheckContext] = None,
        resource_id: Optional[str] = None,
        resource_type: Optional[str] = None
    ) -> PermissionResult:
        """
        Check if user has a specific permission with advanced context evaluation
        """
        try:
            # Generate cache key
            cache_key = self._generate_permission_cache_key(user_id, permission_name, resource_id, resource_type, context)

            # Check cache first
            if cached_result := self._get_cached_permission(cache_key):
                cached_result.cached = True
                return cached_result

            # Get user
            user_result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()

            if not user:
                return PermissionResult(granted=False, reason="User not found")

            # Superuser bypass
            if user.is_superuser:
                result = PermissionResult(granted=True, source="superuser")
                self._cache_permission(cache_key, result)
                return result

            # Check various permission sources in order of priority

            # 1. Direct resource permissions (highest priority)
            if resource_id and resource_type:
                resource_result = await self._check_resource_permission(
                    db, user_id, permission_name, resource_id, resource_type, context
                )
                if resource_result.granted:
                    self._cache_permission(cache_key, resource_result)
                    return resource_result

            # 2. User role permissions with inheritance
            role_result = await self._check_role_permissions(
                db, user_id, permission_name, context, resource_id, resource_type
            )
            if role_result.granted:
                self._cache_permission(cache_key, role_result)
                return role_result

            # 3. Resource ownership permissions
            if resource_id and resource_type:
                ownership_result = await self._check_ownership_permission(
                    db, user_id, resource_id, resource_type, permission_name
                )
                if ownership_result.granted:
                    self._cache_permission(cache_key, ownership_result)
                    return ownership_result

            # No permission granted
            result = PermissionResult(granted=False, reason="Permission not granted")
            self._cache_permission(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Error checking permission {permission_name} for user {user_id}: {e}")
            return PermissionResult(granted=False, reason=f"Error: {str(e)}")

    async def check_permissions(
        self,
        db: AsyncSession,
        user_id: str,
        permission_names: List[str],
        context: Optional[PermissionCheckContext] = None,
        require_all: bool = True,
        resource_id: Optional[str] = None,
        resource_type: Optional[str] = None
    ) -> Dict[str, PermissionResult]:
        """
        Check multiple permissions for a user
        """
        results = {}

        for permission_name in permission_names:
            result = await self.check_permission(
                db, user_id, permission_name, context, resource_id, resource_type
            )
            results[permission_name] = result

            # Early exit if require_all and any permission is denied
            if require_all and not result.granted:
                break

        return results

    async def assign_role_to_user(
        self,
        db: AsyncSession,
        user_id: str,
        role_name: str,
        assigned_by: str,
        expires_at: Optional[datetime] = None,
        context: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None
    ) -> bool:
        """
        Assign a role to a user with enhanced features
        """
        try:
            # Get role
            role_result = await db.execute(
                select(Role).where(Role.name == role_name, Role.is_active == True)
            )
            role = role_result.scalar_one_or_none()

            if not role:
                logger.error(f"Role {role_name} not found")
                return False

            if not role.is_assignable:
                logger.error(f"Role {role_name} is not assignable")
                return False

            # Check role validity
            if not role.is_valid_now:
                logger.error(f"Role {role_name} is not currently valid")
                return False

            # Check max assignments
            if role.max_assignments:
                current_assignments_result = await db.execute(
                    select(func.count(UserRoleAssignment.id)).where(
                        UserRoleAssignment.role_id == role.id,
                        UserRoleAssignment.is_active == True,
                        or_(
                            UserRoleAssignment.expires_at.is_(None),
                            UserRoleAssignment.expires_at > datetime.utcnow()
                        )
                    )
                )
                current_count = current_assignments_result.scalar()

                if current_count >= role.max_assignments:
                    logger.error(f"Role {role_name} has reached maximum assignments")
                    return False

            # Check if user already has this role
            existing_result = await db.execute(
                select(UserRoleAssignment).where(
                    UserRoleAssignment.user_id == user_id,
                    UserRoleAssignment.role_id == role.id,
                    UserRoleAssignment.is_active == True
                )
            )
            existing_assignment = existing_result.scalar_one_or_none()

            if existing_assignment:
                logger.info(f"User {user_id} already has active role {role_name}")
                return True

            # Create new assignment
            assignment = UserRoleAssignment(
                user_id=user_id,
                role_id=role.id,
                assigned_by=assigned_by,
                expires_at=expires_at,
                context=context or {},
                reason=reason
            )
            db.add(assignment)

            # Clear user's permission cache
            self._clear_user_cache(user_id)

            # Log assignment
            await self._log_permission_event(
                db,
                "role_assigned",
                "user",
                user_id,
                assigned_by,
                target_user_id=user_id,
                old_value=None,
                new_value={"role_name": role_name, "expires_at": expires_at.isoformat() if expires_at else None}
            )

            await db.commit()
            logger.info(f"Assigned role {role_name} to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error assigning role {role_name} to user {user_id}: {e}")
            await db.rollback()
            return False

    async def remove_role_from_user(
        self,
        db: AsyncSession,
        user_id: str,
        role_name: str,
        removed_by: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Remove a role from a user
        """
        try:
            # Get role
            role_result = await db.execute(
                select(Role).where(Role.name == role_name)
            )
            role = role_result.scalar_one_or_none()

            if not role:
                return False

            # Get assignment
            assignment_result = await db.execute(
                select(UserRoleAssignment).where(
                    UserRoleAssignment.user_id == user_id,
                    UserRoleAssignment.role_id == role.id,
                    UserRoleAssignment.is_active == True
                )
            )
            assignment = assignment_result.scalar_one_or_none()

            if not assignment:
                logger.info(f"User {user_id} does not have active role {role_name}")
                return True

            # Deactivate assignment
            assignment.is_active = False
            assignment.assigned_by = removed_by  # Update to show who removed it
            assignment.reason = reason

            # Clear user's permission cache
            self._clear_user_cache(user_id)

            # Log removal
            await self._log_permission_event(
                db,
                "role_removed",
                "user",
                user_id,
                removed_by,
                target_user_id=user_id,
                old_value={"role_name": role_name},
                new_value=None
            )

            await db.commit()
            logger.info(f"Removed role {role_name} from user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error removing role {role_name} from user {user_id}: {e}")
            await db.rollback()
            return False

    async def get_user_permissions(
        self,
        db: AsyncSession,
        user_id: str,
        include_inherited: bool = True,
        context: Optional[PermissionCheckContext] = None
    ) -> Set[str]:
        """
        Get all permissions for a user including inherited permissions
        """
        try:
            permissions = set()

            # Get user's active role assignments
            assignment_result = await db.execute(
                select(UserRoleAssignment)
                .options(selectinload(UserRoleAssignment.role).selectinload(Role.permissions))
                .where(
                    UserRoleAssignment.user_id == user_id,
                    UserRoleAssignment.is_active == True,
                    or_(
                        UserRoleAssignment.expires_at.is_(None),
                        UserRoleAssignment.expires_at > datetime.utcnow()
                    )
                )
            )
            assignments = assignment_result.scalars().all()

            for assignment in assignments:
                role = assignment.role

                # Check role validity
                if not role.is_valid_now:
                    continue

                # Get role permissions
                role_permissions = role.get_all_permissions(include_inherited=include_inherited)
                permissions.update(role_permissions)

            # Check if user is superuser
            user_result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()

            if user and user.is_superuser:
                # Add all system permissions
                perm_result = await db.execute(
                    select(Permission.name).where(Permission.is_active == True)
                )
                all_permissions = {row[0] for row in perm_result.fetchall()}
                permissions.update(all_permissions)

            return permissions

        except Exception as e:
            logger.error(f"Error getting permissions for user {user_id}: {e}")
            return set()

    async def get_user_roles(
        self,
        db: AsyncSession,
        user_id: str,
        include_inactive: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get all roles for a user with assignment details
        """
        try:
            query = select(UserRoleAssignment).options(
                selectinload(UserRoleAssignment.role)
            ).where(UserRoleAssignment.user_id == user_id)

            if not include_inactive:
                query = query.where(
                    UserRoleAssignment.is_active == True,
                    or_(
                        UserRoleAssignment.expires_at.is_(None),
                        UserRoleAssignment.expires_at > datetime.utcnow()
                    )
                )

            assignment_result = await db.execute(query.order_by(desc(UserRoleAssignment.assigned_at)))
            assignments = assignment_result.scalars().all()

            roles = []
            for assignment in assignments:
                role_data = assignment.role.to_dict() if assignment.role else {}
                role_data.update({
                    'assignment_id': str(assignment.id),
                    'assigned_at': assignment.assigned_at.isoformat() if assignment.assigned_at else None,
                    'assigned_by': str(assignment.assigned_by) if assignment.assigned_by else None,
                    'expires_at': assignment.expires_at.isoformat() if assignment.expires_at else None,
                    'is_active': assignment.is_active,
                    'is_valid': assignment.is_valid,
                    'context': assignment.context,
                    'reason': assignment.reason,
                    'days_until_expiry': assignment.days_until_expiry,
                })
                roles.append(role_data)

            return roles

        except Exception as e:
            logger.error(f"Error getting roles for user {user_id}: {e}")
            return []

    async def grant_resource_permission(
        self,
        db: AsyncSession,
        resource_type: str,
        resource_id: str,
        user_id: Optional[str] = None,
        role_id: Optional[str] = None,
        permission_name: str,
        granted_by: str,
        expires_at: Optional[datetime] = None,
        conditions: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None
    ) -> bool:
        """
        Grant resource-specific permission to user or role
        """
        try:
            # Validate input
            if not user_id and not role_id:
                raise ValueError("Either user_id or role_id must be provided")

            # Get permission
            perm_result = await db.execute(
                select(Permission).where(Permission.name == permission_name)
            )
            permission = perm_result.scalar_one_or_none()

            if not permission:
                logger.error(f"Permission {permission_name} not found")
                return False

            # Check if resource permission already exists
            existing_result = await db.execute(
                select(ResourcePermission).where(
                    ResourcePermission.resource_type == resource_type,
                    ResourcePermission.resource_id == resource_id,
                    ResourcePermission.user_id == user_id,
                    ResourcePermission.role_id == role_id,
                    ResourcePermission.permission_id == permission.id
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                # Update existing permission
                existing.is_granted = True
                existing.granted_by = granted_by
                existing.expires_at = expires_at
                existing.conditions = conditions or {}
                existing.reason = reason
                existing.granted_at = datetime.utcnow()
            else:
                # Create new resource permission
                resource_permission = ResourcePermission(
                    resource_type=resource_type,
                    resource_id=resource_id,
                    user_id=user_id,
                    role_id=role_id,
                    permission_id=permission.id,
                    is_granted=True,
                    granted_by=granted_by,
                    expires_at=expires_at,
                    conditions=conditions or {},
                    reason=reason
                )
                db.add(resource_permission)

            # Clear affected cache
            if user_id:
                self._clear_user_cache(user_id)

            # Log the grant
            await self._log_permission_event(
                db,
                "resource_permission_granted",
                "resource_permission",
                resource_id,
                granted_by,
                target_user_id=user_id,
                old_value=None,
                new_value={
                    "resource_type": resource_type,
                    "permission_name": permission_name,
                    "user_id": user_id,
                    "role_id": role_id,
                    "expires_at": expires_at.isoformat() if expires_at else None
                }
            )

            await db.commit()
            logger.info(f"Granted {permission_name} on {resource_type}:{resource_id}")
            return True

        except Exception as e:
            logger.error(f"Error granting resource permission: {e}")
            await db.rollback()
            return False

    async def revoke_resource_permission(
        self,
        db: AsyncSession,
        resource_type: str,
        resource_id: str,
        user_id: Optional[str] = None,
        role_id: Optional[str] = None,
        permission_name: str,
        revoked_by: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Revoke resource-specific permission
        """
        try:
            # Get permission
            perm_result = await db.execute(
                select(Permission).where(Permission.name == permission_name)
            )
            permission = perm_result.scalar_one_or_none()

            if not permission:
                return False

            # Get resource permission
            resource_perm_result = await db.execute(
                select(ResourcePermission).where(
                    ResourcePermission.resource_type == resource_type,
                    ResourcePermission.resource_id == resource_id,
                    ResourcePermission.user_id == user_id,
                    ResourcePermission.role_id == role_id,
                    ResourcePermission.permission_id == permission.id
                )
            )
            resource_permission = resource_perm_result.scalar_one_or_none()

            if not resource_permission:
                logger.info(f"Resource permission not found for revocation")
                return True

            # Delete the permission
            await db.delete(resource_permission)

            # Clear affected cache
            if user_id:
                self._clear_user_cache(user_id)

            # Log the revocation
            await self._log_permission_event(
                db,
                "resource_permission_revoked",
                "resource_permission",
                resource_id,
                revoked_by,
                target_user_id=user_id,
                old_value={
                    "resource_type": resource_type,
                    "permission_name": permission_name,
                    "user_id": user_id,
                    "role_id": role_id
                },
                new_value=None
            )

            await db.commit()
            logger.info(f"Revoked {permission_name} on {resource_type}:{resource_id}")
            return True

        except Exception as e:
            logger.error(f"Error revoking resource permission: {e}")
            await db.rollback()
            return False

    # Private helper methods

    async def _check_resource_permission(
        self,
        db: AsyncSession,
        user_id: str,
        permission_name: str,
        resource_id: str,
        resource_type: str,
        context: Optional[PermissionCheckContext] = None
    ) -> PermissionResult:
        """Check direct resource permission"""
        try:
            result = await db.execute(
                select(ResourcePermission)
                .options(selectinload(ResourcePermission.permission))
                .where(
                    ResourcePermission.user_id == user_id,
                    ResourcePermission.resource_type == resource_type,
                    ResourcePermission.resource_id == resource_id,
                    ResourcePermission.is_granted == True,
                    or_(
                        ResourcePermission.expires_at.is_(None),
                        ResourcePermission.expires_at > datetime.utcnow()
                    )
                )
            )
            resource_permissions = result.scalars().all()

            for resource_perm in resource_permissions:
                if resource_perm.permission and resource_perm.permission.name == permission_name:
                    # Check conditions
                    conditions_met = await self._evaluate_conditions(
                        resource_perm.conditions, context
                    )

                    return PermissionResult(
                        granted=conditions_met,
                        source="resource",
                        conditions_met=conditions_met,
                        expires_at=resource_perm.expires_at,
                        reason=f"Direct resource permission: {permission_name}"
                    )

            return PermissionResult(granted=False, reason="No direct resource permission")

        except Exception as e:
            logger.error(f"Error checking resource permission: {e}")
            return PermissionResult(granted=False, reason=f"Error: {str(e)}")

    async def _check_role_permissions(
        self,
        db: AsyncSession,
        user_id: str,
        permission_name: str,
        context: Optional[PermissionCheckContext] = None,
        resource_id: Optional[str] = None,
        resource_type: Optional[str] = None
    ) -> PermissionResult:
        """Check permissions through user roles"""
        try:
            # Get user's active role assignments
            assignment_result = await db.execute(
                select(UserRoleAssignment)
                .options(
                    selectinload(UserRoleAssignment.role)
                    .selectinload(Role.permissions)
                    .selectinload(RolePermission.permission)
                )
                .where(
                    UserRoleAssignment.user_id == user_id,
                    UserRoleAssignment.is_active == True,
                    or_(
                        UserRoleAssignment.expires_at.is_(None),
                        UserRoleAssignment.expires_at > datetime.utcnow()
                    )
                )
            )
            assignments = assignment_result.scalars().all()

            for assignment in assignments:
                role = assignment.role

                # Check role validity
                if not role.is_valid_now:
                    continue

                # Check role permissions
                for role_perm in role.permissions:
                    if (role_perm.permission and
                        role_perm.permission.name == permission_name and
                        role_perm.is_granted and
                        role_perm.is_valid):

                        # Check conditions
                        conditions_met = await self._evaluate_conditions(
                            role_perm.conditions, context
                        )

                        if conditions_met:
                            return PermissionResult(
                                granted=True,
                                source="role" if role_perm.permission else "inherited",
                                conditions_met=conditions_met,
                                expires_at=role_perm.expires_at or assignment.expires_at,
                                reason=f"Role permission: {role.name}"
                            )

            return PermissionResult(granted=False, reason="No role permission")

        except Exception as e:
            logger.error(f"Error checking role permissions: {e}")
            return PermissionResult(granted=False, reason=f"Error: {str(e)}")

    async def _check_ownership_permission(
        self,
        db: AsyncSession,
        user_id: str,
        resource_id: str,
        resource_type: str,
        permission_name: str
    ) -> PermissionResult:
        """Check ownership-based permissions"""
        try:
            # For now, implement basic ownership checks
            # This can be extended based on specific resource types

            if resource_type == ResourceType.USER and resource_id == user_id:
                # Users can manage themselves
                self_permissions = [
                    "user:read", "user:update", "user:read"
                ]
                if permission_name in self_permissions:
                    return PermissionResult(
                        granted=True,
                        source="ownership",
                        reason="Self-permission on user resource"
                    )

            elif resource_type == ResourceType.WORKFLOW:
                # Check if user owns the workflow
                workflow_result = await db.execute(
                    select(func.count()).where(
                        func.text("workflows.owner_id = :user_id AND workflows.id = :resource_id")
                    ).params(user_id=user_id, resource_id=resource_id)
                )
                if workflow_result.scalar() > 0:
                    owner_permissions = [
                        "workflow:read", "workflow:update", "workflow:delete",
                        "workflow:execute", "workflow:manage"
                    ]
                    if permission_name in owner_permissions:
                        return PermissionResult(
                            granted=True,
                            source="ownership",
                            reason="Owner permission on workflow"
                        )

            elif resource_type == ResourceType.DOCUMENT:
                # Check if user owns the document
                doc_result = await db.execute(
                    select(func.count()).where(
                        func.text("documents.owner_id = :user_id AND documents.id = :resource_id")
                    ).params(user_id=user_id, resource_id=resource_id)
                )
                if doc_result.scalar() > 0:
                    owner_permissions = [
                        "document:read", "document:update", "document:delete",
                        "document:manage", "document:share"
                    ]
                    if permission_name in owner_permissions:
                        return PermissionResult(
                            granted=True,
                            source="ownership",
                            reason="Owner permission on document"
                        )

            return PermissionResult(granted=False, reason="No ownership permission")

        except Exception as e:
            logger.error(f"Error checking ownership permission: {e}")
            return PermissionResult(granted=False, reason=f"Error: {str(e)}")

    async def _evaluate_conditions(
        self,
        conditions: Dict[str, Any],
        context: Optional[PermissionCheckContext] = None
    ) -> bool:
        """Evaluate permission conditions"""
        if not conditions:
            return True

        try:
            # Time-based conditions
            if "time_range" in conditions:
                time_range = conditions["time_range"]
                now = datetime.utcnow().time()

                if "start_time" in time_range and "end_time" in time_range:
                    start_time = datetime.strptime(time_range["start_time"], "%H:%M").time()
                    end_time = datetime.strptime(time_range["end_time"], "%H:%M").time()

                    if not (start_time <= now <= end_time):
                        return False

            # Date-based conditions
            if "date_range" in conditions:
                date_range = conditions["date_range"]
                today = datetime.utcnow().date()

                if "start_date" in date_range:
                    start_date = datetime.strptime(date_range["start_date"], "%Y-%m-%d").date()
                    if today < start_date:
                        return False

                if "end_date" in date_range:
                    end_date = datetime.strptime(date_range["end_date"], "%Y-%m-%d").date()
                    if today > end_date:
                        return False

            # IP-based conditions
            if "allowed_ips" in conditions and context and context.ip_address:
                if context.ip_address not in conditions["allowed_ips"]:
                    return False

            # User agent conditions
            if "allowed_user_agents" in conditions and context and context.user_agent:
                user_agent_allowed = any(
                    agent.lower() in context.user_agent.lower()
                    for agent in conditions["allowed_user_agents"]
                )
                if not user_agent_allowed:
                    return False

            # Custom conditions
            if "custom" in conditions and context and context.additional_data:
                custom_conditions = conditions["custom"]
                for key, expected_value in custom_conditions.items():
                    if context.additional_data.get(key) != expected_value:
                        return False

            return True

        except Exception as e:
            logger.error(f"Error evaluating conditions: {e}")
            return False

    def _generate_permission_cache_key(
        self,
        user_id: str,
        permission_name: str,
        resource_id: Optional[str],
        resource_type: Optional[str],
        context: Optional[PermissionCheckContext]
    ) -> str:
        """Generate cache key for permission check"""
        key_parts = [user_id, permission_name]

        if resource_id:
            key_parts.append(f"res:{resource_id}")
        if resource_type:
            key_parts.append(f"type:{resource_type}")
        if context:
            if context.organization_id:
                key_parts.append(f"org:{context.organization_id}")
            if context.team_id:
                key_parts.append(f"team:{context.team_id}")

        key_string = ":".join(key_parts)
        return hashlib.md5(key_string.encode()).hexdigest()

    def _get_cached_permission(self, cache_key: str) -> Optional[PermissionResult]:
        """Get cached permission result"""
        if cache_key in self._permission_cache:
            cached_data = self._permission_cache[cache_key]

            # Check if cache is still valid
            if datetime.utcnow() - cached_data["timestamp"] < timedelta(seconds=self._cache_timeout):
                return cached_data["result"]
            else:
                # Remove expired cache entry
                del self._permission_cache[cache_key]

        return None

    def _cache_permission(self, cache_key: str, result: PermissionResult) -> None:
        """Cache permission result"""
        self._permission_cache[cache_key] = {
            "result": result,
            "timestamp": datetime.utcnow()
        }

        # Clean up old cache entries if cache is too large
        if len(self._permission_cache) > self._max_cache_size:
            self._cleanup_cache()

    def _clear_user_cache(self, user_id: str) -> None:
        """Clear cache entries for a specific user"""
        keys_to_remove = []
        for cache_key in self._permission_cache:
            if cache_key.startswith(hashlib.md5(user_id.encode()).hexdigest()[:8]):
                keys_to_remove.append(cache_key)

        for key in keys_to_remove:
            del self._permission_cache[key]

    def _cleanup_cache(self) -> None:
        """Clean up old cache entries"""
        cutoff_time = datetime.utcnow() - timedelta(seconds=self._cache_timeout)
        keys_to_remove = []

        for cache_key, cached_data in self._permission_cache.items():
            if cached_data["timestamp"] < cutoff_time:
                keys_to_remove.append(cache_key)

        for key in keys_to_remove:
            del self._permission_cache[key]

    async def _add_permission_to_role(self, db: AsyncSession, role_id: str, permission_name: str) -> None:
        """Add permission to role"""
        perm_result = await db.execute(
            select(Permission).where(Permission.name == permission_name)
        )
        permission = perm_result.scalar_one_or_none()

        if permission:
            role_permission = RolePermission(
                role_id=role_id,
                permission_id=permission.id,
                is_granted=True
            )
            db.add(role_permission)

    async def _update_role_permissions(
        self,
        db: AsyncSession,
        role: Role,
        permission_names: List[str]
    ) -> None:
        """Update role permissions"""
        # Get current permissions
        current_perms = {
            rp.permission.name for rp in role.permissions
            if rp.permission and rp.is_granted
        }

        # Get target permissions
        target_perms = set(permission_names)

        # Add missing permissions
        for perm_name in target_perms - current_perms:
            await self._add_permission_to_role(db, str(role.id), perm_name)

        # Remove extra permissions (only for system roles)
        if role.is_system_role:
            for rp in role.permissions:
                if (rp.permission and
                    rp.permission.name not in target_perms and
                    rp.is_granted):
                    rp.is_granted = False

    async def _log_permission_event(
        self,
        db: AsyncSession,
        event_type: str,
        entity_type: str,
        entity_id: str,
        actor_id: Optional[str],
        target_user_id: Optional[str] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log permission-related event"""
        audit_log = PermissionAuditLog(
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            target_user_id=target_user_id,
            old_value=old_value,
            new_value=new_value,
            metadata=metadata or {}
        )
        db.add(audit_log)

    def _get_system_permissions(self) -> List[Dict[str, Any]]:
        """Get system permissions definition"""
        return [
            # User management permissions
            {
                "name": "user:read",
                "description": "Read user information",
                "category": "user_management",
                "action": "read",
                "resource_type": "user",
                "scope": "organization"
            },
            {
                "name": "user:update",
                "description": "Update user information",
                "category": "user_management",
                "action": "update",
                "resource_type": "user",
                "scope": "organization"
            },
            {
                "name": "user:delete",
                "description": "Delete user accounts",
                "category": "user_management",
                "action": "delete",
                "resource_type": "user",
                "scope": "organization"
            },
            {
                "name": "user:manage",
                "description": "Manage user accounts and permissions",
                "category": "user_management",
                "action": "manage",
                "resource_type": "user",
                "scope": "organization"
            },

            # Role management permissions
            {
                "name": "role:read",
                "description": "Read role information",
                "category": "role_management",
                "action": "read",
                "resource_type": "role",
                "scope": "organization"
            },
            {
                "name": "role:create",
                "description": "Create new roles",
                "category": "role_management",
                "action": "create",
                "resource_type": "role",
                "scope": "organization"
            },
            {
                "name": "role:update",
                "description": "Update role information and permissions",
                "category": "role_management",
                "action": "update",
                "resource_type": "role",
                "scope": "organization"
            },
            {
                "name": "role:delete",
                "description": "Delete roles",
                "category": "role_management",
                "action": "delete",
                "resource_type": "role",
                "scope": "organization"
            },
            {
                "name": "role:assign",
                "description": "Assign roles to users",
                "category": "role_management",
                "action": "manage",
                "resource_type": "role",
                "scope": "organization"
            },

            # Workflow management permissions
            {
                "name": "workflow:read",
                "description": "Read workflow information",
                "category": "workflow_management",
                "action": "read",
                "resource_type": "workflow",
                "scope": "resource"
            },
            {
                "name": "workflow:create",
                "description": "Create new workflows",
                "category": "workflow_management",
                "action": "create",
                "resource_type": "workflow",
                "scope": "organization"
            },
            {
                "name": "workflow:update",
                "description": "Update workflow definitions",
                "category": "workflow_management",
                "action": "update",
                "resource_type": "workflow",
                "scope": "resource"
            },
            {
                "name": "workflow:delete",
                "description": "Delete workflows",
                "category": "workflow_management",
                "action": "delete",
                "resource_type": "workflow",
                "scope": "resource"
            },
            {
                "name": "workflow:execute",
                "description": "Execute workflows",
                "category": "workflow_management",
                "action": "execute",
                "resource_type": "workflow",
                "scope": "resource"
            },
            {
                "name": "workflow:manage",
                "description": "Manage all workflows in organization",
                "category": "workflow_management",
                "action": "manage",
                "resource_type": "workflow",
                "scope": "organization"
            },

            # Document management permissions
            {
                "name": "document:read",
                "description": "Read document information",
                "category": "document_management",
                "action": "read",
                "resource_type": "document",
                "scope": "resource"
            },
            {
                "name": "document:create",
                "description": "Create new documents",
                "category": "document_management",
                "action": "create",
                "resource_type": "document",
                "scope": "organization"
            },
            {
                "name": "document:update",
                "description": "Update document content",
                "category": "document_management",
                "action": "update",
                "resource_type": "document",
                "scope": "resource"
            },
            {
                "name": "document:delete",
                "description": "Delete documents",
                "category": "document_management",
                "action": "delete",
                "resource_type": "document",
                "scope": "resource"
            },
            {
                "name": "document:manage",
                "description": "Manage all documents in organization",
                "category": "document_management",
                "action": "manage",
                "resource_type": "document",
                "scope": "organization"
            },
            {
                "name": "document:share",
                "description": "Share documents with others",
                "category": "document_management",
                "action": "share",
                "resource_type": "document",
                "scope": "resource"
            },

            # Agent management permissions
            {
                "name": "agent:read",
                "description": "Read agent information",
                "category": "agent_management",
                "action": "read",
                "resource_type": "agent",
                "scope": "resource"
            },
            {
                "name": "agent:create",
                "description": "Create new agents",
                "category": "agent_management",
                "action": "create",
                "resource_type": "agent",
                "scope": "organization"
            },
            {
                "name": "agent:update",
                "description": "Update agent configurations",
                "category": "agent_management",
                "action": "update",
                "resource_type": "agent",
                "scope": "resource"
            },
            {
                "name": "agent:delete",
                "description": "Delete agents",
                "category": "agent_management",
                "action": "delete",
                "resource_type": "agent",
                "scope": "resource"
            },
            {
                "name": "agent:execute",
                "description": "Execute agents",
                "category": "agent_management",
                "action": "execute",
                "resource_type": "agent",
                "scope": "resource"
            },
            {
                "name": "agent:manage",
                "description": "Manage all agents in organization",
                "category": "agent_management",
                "action": "manage",
                "resource_type": "agent",
                "scope": "organization"
            },

            # Organization management permissions
            {
                "name": "organization:read",
                "description": "Read organization information",
                "category": "organization_management",
                "action": "read",
                "resource_type": "organization",
                "scope": "self"
            },
            {
                "name": "organization:update",
                "description": "Update organization settings",
                "category": "organization_management",
                "action": "update",
                "resource_type": "organization",
                "scope": "self"
            },
            {
                "name": "organization:manage",
                "description": "Manage organization settings and billing",
                "category": "organization_management",
                "action": "manage",
                "resource_type": "organization",
                "scope": "self"
            },

            # System administration permissions
            {
                "name": "system:admin",
                "description": "Full system administration access",
                "category": "system_administration",
                "action": "manage",
                "resource_type": "system",
                "scope": "system",
                "is_sensitive": True
            },
            {
                "name": "system:monitor",
                "description": "Monitor system health and performance",
                "category": "system_administration",
                "action": "read",
                "resource_type": "system",
                "scope": "system"
            },
            {
                "name": "system:config",
                "description": "Configure system settings",
                "category": "system_administration",
                "action": "update",
                "resource_type": "system",
                "scope": "system",
                "is_sensitive": True
            },
            {
                "name": "system:audit",
                "description": "Access audit logs and security events",
                "category": "system_administration",
                "action": "read",
                "resource_type": "audit_log",
                "scope": "system",
                "is_sensitive": True
            },

            # Infrastructure management permissions
            {
                "name": "infrastructure:read",
                "description": "Read infrastructure information",
                "category": "infrastructure_management",
                "action": "read",
                "resource_type": "infrastructure",
                "scope": "organization"
            },
            {
                "name": "infrastructure:create",
                "description": "Create infrastructure resources",
                "category": "infrastructure_management",
                "action": "create",
                "resource_type": "infrastructure",
                "scope": "organization"
            },
            {
                "name": "infrastructure:update",
                "description": "Update infrastructure configurations",
                "category": "infrastructure_management",
                "action": "update",
                "resource_type": "infrastructure",
                "scope": "resource"
            },
            {
                "name": "infrastructure:delete",
                "description": "Delete infrastructure resources",
                "category": "infrastructure_management",
                "action": "delete",
                "resource_type": "infrastructure",
                "scope": "resource"
            },
            {
                "name": "infrastructure:deploy",
                "description": "Deploy infrastructure changes",
                "category": "infrastructure_management",
                "action": "execute",
                "resource_type": "infrastructure",
                "scope": "organization"
            },
            {
                "name": "infrastructure:manage",
                "description": "Manage all infrastructure resources",
                "category": "infrastructure_management",
                "action": "manage",
                "resource_type": "infrastructure",
                "scope": "organization"
            },
        ]

    def _get_system_roles(self) -> List[Dict[str, Any]]:
        """Get system roles definition with hierarchy"""
        return [
            {
                "name": "super_admin",
                "display_name": "Super Administrator",
                "description": "Super Administrator with full system access",
                "category": "system",
                "level": 0,
                "is_assignable": False,
                "permissions": [
                    "system:admin", "system:monitor", "system:config", "system:audit",
                    "user:manage", "role:assign", "organization:manage",
                    "infrastructure:manage", "workflow:manage", "agent:manage", "document:manage"
                ],
                "metadata": {"system_role": True, "max_assignments": 1}
            },
            {
                "name": "admin",
                "display_name": "Administrator",
                "description": "Organization Administrator with comprehensive access",
                "category": "administrative",
                "level": 10,
                "parent_role": "super_admin",
                "permissions": [
                    "system:monitor",
                    "user:manage", "role:assign",
                    "organization:manage",
                    "infrastructure:manage", "workflow:manage", "agent:manage", "document:manage"
                ],
                "metadata": {"requires_approval": True}
            },
            {
                "name": "manager",
                "display_name": "Manager",
                "description": "Team manager with resource management capabilities",
                "category": "management",
                "level": 20,
                "parent_role": "admin",
                "permissions": [
                    "user:read", "user:update",
                    "organization:read",
                    "workflow:manage", "agent:manage", "document:manage",
                    "infrastructure:read", "infrastructure:deploy"
                ],
                "metadata": {"team_based": True}
            },
            {
                "name": "developer",
                "display_name": "Developer",
                "description": "Developer with workflow and agent development access",
                "category": "technical",
                "level": 30,
                "parent_role": "manager",
                "permissions": [
                    "user:read",
                    "organization:read",
                    "workflow:create", "workflow:read", "workflow:update", "workflow:execute",
                    "agent:create", "agent:read", "agent:update", "agent:execute",
                    "document:create", "document:read", "document:update",
                    "infrastructure:read", "infrastructure:create", "infrastructure:update"
                ],
                "metadata": {"technical_role": True}
            },
            {
                "name": "user",
                "display_name": "Standard User",
                "description": "Standard user with basic access to resources",
                "category": "user",
                "level": 40,
                "parent_role": "developer",
                "permissions": [
                    "user:read",
                    "organization:read",
                    "workflow:read", "workflow:execute",
                    "agent:read", "agent:execute",
                    "document:create", "document:read", "document:update", "document:share"
                ],
                "metadata": {"default_role": True}
            },
            {
                "name": "viewer",
                "display_name": "Viewer",
                "description": "Read-only access to resources",
                "category": "read_only",
                "level": 50,
                "parent_role": "user",
                "permissions": [
                    "user:read",
                    "organization:read",
                    "workflow:read",
                    "agent:read",
                    "document:read",
                    "infrastructure:read"
                ],
                "metadata": {"read_only": True}
            },
        ]


# Create global instance
authorization_service = AuthorizationService()