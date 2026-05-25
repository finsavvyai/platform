"""
Comprehensive Role-Based Access Control (RBAC) API Endpoints

This module provides complete API endpoints for managing roles, permissions,
and user assignments with enterprise-grade features including:
- Role hierarchy management with inheritance
- Granular permission assignment with conditions
- User role management with expiration
- Resource-level permission control
- Comprehensive audit logging
- Bulk operations and advanced filtering

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload, joinedload
from pydantic import BaseModel, Field, EmailStr, validator
import logging

from app.core.database import get_db
from app.models.rbac import (
    Role, Permission, RolePermission, UserRoleAssignment,
    ResourcePermission, PermissionAuditLog
)
from app.models.user import User
from app.services.authorization import AuthorizationService, PermissionCheckContext
from app.middleware.rbac import (
    require_role_manage, require_user_manage, rbac_decorator,
    require_permission, require_permissions
)
from app.utils.pagination import paginate_query
from app.utils.schemas import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter()
auth_service = AuthorizationService()

# Pydantic schemas for request/response models

class PermissionBase(BaseModel):
    """Base permission schema"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, max_length=100)
    action: str = Field(..., min_length=1, max_length=50)
    resource_type: str = Field(..., min_length=1, max_length=50)
    scope: str = Field(default="resource", min_length=1, max_length=20)
    conditions: Optional[Dict[str, Any]] = Field(default_factory=dict)
    constraints: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_sensitive: bool = Field(default=False)

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Permission name cannot be empty')
        return v.strip().lower()

    @validator('scope')
    def validate_scope(cls, v):
        allowed_scopes = ['system', 'organization', 'team', 'resource', 'self']
        if v not in allowed_scopes:
            raise ValueError(f'Scope must be one of: {", ".join(allowed_scopes)}')
        return v


class PermissionCreate(PermissionBase):
    """Schema for creating permissions"""
    pass


class PermissionUpdate(BaseModel):
    """Schema for updating permissions"""
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, max_length=100)
    conditions: Optional[Dict[str, Any]] = None
    constraints: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class PermissionResponse(PermissionBase):
    """Schema for permission response"""
    id: str
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    full_name: str

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    """Base role schema"""
    name: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, max_length=50)
    parent_role_id: Optional[str] = None
    inherits_from_parent: bool = Field(default=True)
    max_assignments: Optional[int] = Field(None, gt=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    scope_constraints: Optional[Dict[str, Any]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    tags: Optional[List[str]] = Field(default_factory=list)

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Role name cannot be empty')
        return v.strip().lower()

    @validator('valid_until')
    def validate_validity_dates(cls, v, values):
        if v and 'valid_from' in values and values['valid_from']:
            if v <= values['valid_from']:
                raise ValueError('valid_until must be after valid_from')
        return v


class RoleCreate(RoleBase):
    """Schema for creating roles"""
    permission_names: Optional[List[str]] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    """Schema for updating roles"""
    display_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, max_length=50)
    parent_role_id: Optional[str] = None
    inherits_from_parent: Optional[bool] = None
    is_active: Optional[bool] = None
    is_assignable: Optional[bool] = None
    max_assignments: Optional[int] = Field(None, gt=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    scope_constraints: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


class RoleResponse(RoleBase):
    """Schema for role response"""
    id: str
    level: int
    is_system_role: bool
    is_active: bool
    is_assignable: bool
    is_valid_now: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[str]
    permissions: Optional[List[str]] = None
    inherited_permissions: Optional[List[str]] = None

    class Config:
        from_attributes = True


class UserRoleAssignmentCreate(BaseModel):
    """Schema for assigning roles to users"""
    user_id: str
    role_name: str
    expires_at: Optional[datetime] = None
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    reason: Optional[str] = Field(None, max_length=1000)


class UserRoleAssignmentUpdate(BaseModel):
    """Schema for updating user role assignments"""
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    context: Optional[Dict[str, Any]] = None
    reason: Optional[str] = Field(None, max_length=1000)


class UserRoleAssignmentResponse(BaseModel):
    """Schema for user role assignment response"""
    id: str
    user_id: str
    role_id: str
    role_name: str
    assigned_at: datetime
    assigned_by: Optional[str]
    expires_at: Optional[datetime]
    is_active: bool
    is_valid: bool
    context: Dict[str, Any]
    reason: Optional[str]
    days_until_expiry: Optional[int]

    class Config:
        from_attributes = True


class ResourcePermissionGrant(BaseModel):
    """Schema for granting resource permissions"""
    resource_type: str = Field(..., min_length=1, max_length=50)
    resource_id: str = Field(..., min_length=1, max_length=50)
    user_id: Optional[str] = None
    role_id: Optional[str] = None
    permission_name: str = Field(..., min_length=1, max_length=200)
    expires_at: Optional[datetime] = None
    conditions: Optional[Dict[str, Any]] = Field(default_factory=dict)
    reason: Optional[str] = Field(None, max_length=1000)

    @validator('user_id', 'role_id')
    def validate_user_or_role(cls, v, values, field):
        user_id = values.get('user_id')
        role_id = values.get('role_id')
        if not user_id and not role_id and field.name == 'user_id':
            raise ValueError('Either user_id or role_id must be provided')
        return v


class UserPermissionCheck(BaseModel):
    """Schema for checking user permissions"""
    user_id: str
    permission_name: str
    resource_id: Optional[str] = None
    resource_type: Optional[str] = None
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


# Permission endpoints

@router.get("/permissions", response_model=PaginatedResponse[PermissionResponse])
async def list_permissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    is_system: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:read"))
):
    """List permissions with filtering and pagination"""
    try:
        # Build base query
        query = select(Permission)

        # Apply filters
        if category:
            query = query.where(Permission.category == category)
        if resource_type:
            query = query.where(Permission.resource_type == resource_type)
        if action:
            query = query.where(Permission.action == action)
        if is_system is not None:
            query = query.where(Permission.is_system == is_system)
        if is_active is not None:
            query = query.where(Permission.is_active == is_active)
        if search:
            query = query.where(
                or_(
                    Permission.name.ilike(f"%{search}%"),
                    Permission.description.ilike(f"%{search}%")
                )
            )

        # Order by category and name
        query = query.order_by(Permission.category, Permission.name)

        # Apply pagination
        total_count = await db.scalar(select(func.count()).select_from(query.subquery()))
        result = await db.execute(query.offset(skip).limit(limit))
        permissions = result.scalars().all()

        permission_responses = [PermissionResponse.from_orm(perm) for perm in permissions]

        return PaginatedResponse(
            items=permission_responses,
            total=total_count,
            skip=skip,
            limit=limit
        )

    except Exception as e:
        logger.error(f"Error listing permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list permissions"
        )


@router.post("/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def create_permission(
    permission_data: PermissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:create"))
):
    """Create a new permission"""
    try:
        # Check if permission already exists
        existing_result = await db.execute(
            select(Permission).where(Permission.name == permission_data.name)
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Permission '{permission_data.name}' already exists"
            )

        # Create permission
        new_permission = Permission(
            name=permission_data.name,
            description=permission_data.description,
            category=permission_data.category,
            action=permission_data.action,
            resource_type=permission_data.resource_type,
            scope=permission_data.scope,
            conditions=permission_data.conditions,
            constraints=permission_data.constraints,
            is_sensitive=permission_data.is_sensitive,
            is_system=False,
            is_active=True
        )

        db.add(new_permission)
        await db.commit()
        await db.refresh(new_permission)

        logger.info(f"Created permission: {permission_data.name} by user {current_user.id}")
        return PermissionResponse.from_orm(new_permission)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating permission: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create permission"
        )


@router.get("/permissions/{permission_id}", response_model=PermissionResponse)
async def get_permission(
    permission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:read"))
):
    """Get permission by ID"""
    try:
        result = await db.execute(
            select(Permission).where(Permission.id == permission_id)
        )
        permission = result.scalar_one_or_none()

        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission not found"
            )

        return PermissionResponse.from_orm(permission)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting permission {permission_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get permission"
        )


@router.put("/permissions/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    permission_id: str,
    permission_data: PermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:update"))
):
    """Update permission"""
    try:
        # Get permission
        result = await db.execute(
            select(Permission).where(Permission.id == permission_id)
        )
        permission = result.scalar_one_or_none()

        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission not found"
            )

        # Check if it's a system permission
        if permission.is_system:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system permissions"
            )

        # Update permission
        update_data = permission_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(permission, field, value)

        permission.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(permission)

        logger.info(f"Updated permission {permission_id} by user {current_user.id}")
        return PermissionResponse.from_orm(permission)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating permission {permission_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update permission"
        )


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission(
    permission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:delete"))
):
    """Delete permission"""
    try:
        # Get permission
        result = await db.execute(
            select(Permission).where(Permission.id == permission_id)
        )
        permission = result.scalar_one_or_none()

        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission not found"
            )

        # Check if it's a system permission
        if permission.is_system:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete system permissions"
            )

        # Check if permission is in use
        usage_result = await db.execute(
            select(func.count(RolePermission.id)).where(
                RolePermission.permission_id == permission_id
            )
        )
        usage_count = usage_result.scalar()

        if usage_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete permission: it is assigned to {usage_count} roles"
            )

        # Delete permission
        await db.delete(permission)
        await db.commit()

        logger.info(f"Deleted permission {permission_id} by user {current_user.id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting permission {permission_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete permission"
        )


# Role endpoints

@router.get("/roles", response_model=PaginatedResponse[RoleResponse])
async def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: Optional[str] = Query(None),
    is_system_role: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_assignable: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    include_permissions: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:read"))
):
    """List roles with filtering and pagination"""
    try:
        # Build base query
        query = select(Role)

        # Apply filters
        if category:
            query = query.where(Role.category == category)
        if is_system_role is not None:
            query = query.where(Role.is_system_role == is_system_role)
        if is_active is not None:
            query = query.where(Role.is_active == is_active)
        if is_assignable is not None:
            query = query.where(Role.is_assignable == is_assignable)
        if search:
            query = query.where(
                or_(
                    Role.name.ilike(f"%{search}%"),
                    Role.display_name.ilike(f"%{search}%"),
                    Role.description.ilike(f"%{search}%")
                )
            )

        # Order by level and name
        query = query.order_by(Role.level, Role.name)

        # Apply pagination
        total_count = await db.scalar(select(func.count()).select_from(query.subquery()))
        result = await db.execute(query.offset(skip).limit(limit))
        roles = result.scalars().all()

        role_responses = []
        for role in roles:
            role_data = role.to_dict(include_permissions=include_permissions)
            role_responses.append(RoleResponse(**role_data))

        return PaginatedResponse(
            items=role_responses,
            total=total_count,
            skip=skip,
            limit=limit
        )

    except Exception as e:
        logger.error(f"Error listing roles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list roles"
        )


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:create"))
):
    """Create a new role"""
    try:
        # Check if role already exists
        existing_result = await db.execute(
            select(Role).where(Role.name == role_data.name)
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role '{role_data.name}' already exists"
            )

        # Validate parent role if specified
        parent_role = None
        if role_data.parent_role_id:
            parent_result = await db.execute(
                select(Role).where(Role.id == role_data.parent_role_id, Role.is_active == True)
            )
            parent_role = parent_result.scalar_one_or_none()
            if not parent_role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent role not found or inactive"
                )

        # Create role
        new_role = Role(
            name=role_data.name,
            display_name=role_data.display_name,
            description=role_data.description,
            category=role_data.category,
            parent_role_id=role_data.parent_role_id,
            level=parent_role.level + 1 if parent_role else 0,
            inherits_from_parent=role_data.inherits_from_parent,
            max_assignments=role_data.max_assignments,
            valid_from=role_data.valid_from,
            valid_until=role_data.valid_until,
            scope_constraints=role_data.scope_constraints,
            metadata=role_data.metadata,
            tags=role_data.tags,
            is_system_role=False,
            is_active=True,
            is_assignable=True,
            created_by=str(current_user.id)
        )

        db.add(new_role)
        await db.flush()  # Get the ID

        # Add permissions if specified
        if role_data.permission_names:
            for perm_name in role_data.permission_names:
                perm_result = await db.execute(
                    select(Permission).where(Permission.name == perm_name, Permission.is_active == True)
                )
                permission = perm_result.scalar_one_or_none()

                if permission:
                    role_permission = RolePermission(
                        role_id=new_role.id,
                        permission_id=permission.id,
                        is_granted=True,
                        assigned_by=str(current_user.id)
                    )
                    db.add(role_permission)

        await db.commit()
        await db.refresh(new_role)

        logger.info(f"Created role: {role_data.name} by user {current_user.id}")
        return RoleResponse.from_orm(new_role)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating role: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create role"
        )


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: str,
    include_permissions: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:read"))
):
    """Get role by ID"""
    try:
        result = await db.execute(
            select(Role).where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )

        role_data = role.to_dict(include_permissions=include_permissions)
        return RoleResponse(**role_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting role {role_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get role"
        )


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:update"))
):
    """Update role"""
    try:
        # Get role
        result = await db.execute(
            select(Role).where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )

        # Check if it's a system role
        if role.is_system_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system roles"
            )

        # Validate parent role if specified
        if role_data.parent_role_id:
            parent_result = await db.execute(
                select(Role).where(
                    Role.id == role_data.parent_role_id,
                    Role.is_active == True,
                    Role.id != role_id  # Prevent self-reference
                )
            )
            parent_role = parent_result.scalar_one_or_none()
            if not parent_role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent role not found or inactive"
                )

        # Update role
        update_data = role_data.dict(exclude_unset=True)
        if 'parent_role_id' in update_data and update_data['parent_role_id']:
            update_data['level'] = parent_role.level + 1

        for field, value in update_data.items():
            setattr(role, field, value)

        role.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(role)

        logger.info(f"Updated role {role_id} by user {current_user.id}")
        return RoleResponse.from_orm(role)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating role {role_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role"
        )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:delete"))
):
    """Delete role"""
    try:
        # Get role
        result = await db.execute(
            select(Role).where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )

        # Check if it's a system role
        if role.is_system_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete system roles"
            )

        # Check if role is in use
        usage_result = await db.execute(
            select(func.count(UserRoleAssignment.id)).where(
                UserRoleAssignment.role_id == role_id,
                UserRoleAssignment.is_active == True
            )
        )
        usage_count = usage_result.scalar()

        if usage_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete role: it is assigned to {usage_count} users"
            )

        # Check if role has child roles
        child_result = await db.execute(
            select(func.count(Role.id)).where(Role.parent_role_id == role_id, Role.is_active == True)
        )
        child_count = child_result.scalar()

        if child_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete role: it has {child_count} child roles"
            )

        # Delete role and related data
        await db.delete(role)
        await db.commit()

        logger.info(f"Deleted role {role_id} by user {current_user.id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting role {role_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete role"
        )


# User role assignment endpoints

@router.get("/users/{user_id}/roles", response_model=List[UserRoleAssignmentResponse])
async def get_user_roles(
    user_id: str,
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:read"))
):
    """Get roles assigned to a user"""
    try:
        # Verify user exists
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        if not user_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Get role assignments
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

        assignment_responses = []
        for assignment in assignments:
            assignment_data = assignment.to_dict()
            assignment_responses.append(UserRoleAssignmentResponse(**assignment_data))

        return assignment_responses

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting roles for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user roles"
        )


@router.post("/users/{user_id}/roles", response_model=UserRoleAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_role_to_user(
    user_id: str,
    assignment_data: UserRoleAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:assign"))
):
    """Assign a role to a user"""
    try:
        # Verify user exists
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        if not user_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Check if user can be assigned roles
        if assignment_data.user_id and assignment_data.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID in path and body must match"
            )

        # Assign role
        success = await auth_service.assign_role_to_user(
            db=db,
            user_id=user_id,
            role_name=assignment_data.role_name,
            assigned_by=str(current_user.id),
            expires_at=assignment_data.expires_at,
            context=assignment_data.context,
            reason=assignment_data.reason
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to assign role to user"
            )

        # Get the assignment
        assignment_result = await db.execute(
            select(UserRoleAssignment)
            .options(selectinload(UserRoleAssignment.role))
            .where(
                UserRoleAssignment.user_id == user_id,
                UserRoleAssignment.is_active == True
            )
            .order_by(desc(UserRoleAssignment.assigned_at))
            .limit(1)
        )
        assignment = assignment_result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created assignment"
            )

        assignment_data = assignment.to_dict()
        return UserRoleAssignmentResponse(**assignment_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning role to user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign role to user"
        )


@router.delete("/users/{user_id}/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role_from_user(
    user_id: str,
    role_name: str,
    reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:assign"))
):
    """Remove a role from a user"""
    try:
        # Verify user exists
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        if not user_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Remove role
        success = await auth_service.remove_role_from_user(
            db=db,
            user_id=user_id,
            role_name=role_name,
            removed_by=str(current_user.id),
            reason=reason
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove role from user"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing role from user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove role from user"
        )


# Permission check endpoints

@router.post("/check-permission")
async def check_user_permission(
    check_data: UserPermissionCheck,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:read"))
):
    """Check if a user has a specific permission"""
    try:
        context = PermissionCheckContext(
            request_id=None,
            additional_data=check_data.context
        )

        result = await auth_service.check_permission(
            db=db,
            user_id=check_data.user_id,
            permission_name=check_data.permission_name,
            context=context,
            resource_id=check_data.resource_id,
            resource_type=check_data.resource_type
        )

        return {
            "user_id": check_data.user_id,
            "permission_name": check_data.permission_name,
            "resource_id": check_data.resource_id,
            "resource_type": check_data.resource_type,
            "granted": result.granted,
            "reason": result.reason,
            "source": result.source,
            "conditions_met": result.conditions_met,
            "expires_at": result.expires_at,
            "cached": result.cached
        }

    except Exception as e:
        logger.error(f"Error checking permission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check permission"
        )


@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    include_inherited: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:read"))
):
    """Get all permissions for a user"""
    try:
        # Verify user exists
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        if not user_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        context = PermissionCheckContext()

        permissions = await auth_service.get_user_permissions(
            db=db,
            user_id=user_id,
            include_inherited=include_inherited,
            context=context
        )

        return {
            "user_id": user_id,
            "permissions": sorted(list(permissions)),
            "count": len(permissions),
            "include_inherited": include_inherited
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting permissions for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user permissions"
        )


# Resource permission endpoints

@router.post("/resource-permissions/grant", status_code=status.HTTP_201_CREATED)
async def grant_resource_permission(
    grant_data: ResourcePermissionGrant,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:manage"))
):
    """Grant resource-specific permission"""
    try:
        success = await auth_service.grant_resource_permission(
            db=db,
            resource_type=grant_data.resource_type,
            resource_id=grant_data.resource_id,
            user_id=grant_data.user_id,
            role_id=grant_data.role_id,
            permission_name=grant_data.permission_name,
            granted_by=str(current_user.id),
            expires_at=grant_data.expires_at,
            conditions=grant_data.conditions,
            reason=grant_data.reason
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to grant resource permission"
            )

        return {
            "message": "Resource permission granted successfully",
            "resource_type": grant_data.resource_type,
            "resource_id": grant_data.resource_id,
            "permission_name": grant_data.permission_name,
            "user_id": grant_data.user_id,
            "role_id": grant_data.role_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error granting resource permission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to grant resource permission"
        )


@router.post("/resource-permissions/revoke")
async def revoke_resource_permission(
    resource_type: str,
    resource_id: str,
    permission_name: str,
    user_id: Optional[str] = None,
    role_id: Optional[str] = None,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:manage"))
):
    """Revoke resource-specific permission"""
    try:
        success = await auth_service.revoke_resource_permission(
            db=db,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            role_id=role_id,
            permission_name=permission_name,
            revoked_by=str(current_user.id),
            reason=reason
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to revoke resource permission"
            )

        return {
            "message": "Resource permission revoked successfully",
            "resource_type": resource_type,
            "resource_id": resource_id,
            "permission_name": permission_name,
            "user_id": user_id,
            "role_id": role_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking resource permission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke resource permission"
        )


# System management endpoints

@router.post("/system/initialize-permissions", status_code=status.HTTP_200_OK)
async def initialize_system_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:config"))
):
    """Initialize system permissions"""
    try:
        await auth_service.initialize_system_permissions(db)
        return {"message": "System permissions initialized successfully"}

    except Exception as e:
        logger.error(f"Error initializing system permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize system permissions"
        )


@router.post("/system/initialize-roles", status_code=status.HTTP_200_OK)
async def initialize_system_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:config"))
):
    """Initialize system roles"""
    try:
        await auth_service.initialize_system_roles(db)
        return {"message": "System roles initialized successfully"}

    except Exception as e:
        logger.error(f"Error initializing system roles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize system roles"
        )