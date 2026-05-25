"""
RBAC (Role-Based Access Control) API endpoints for Universal Dependency Platform.

This module provides REST API endpoints for managing roles, permissions,
and user-role assignments throughout the platform.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.requests import Request
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload

from ..core.models.rbac import (
    Permission,
    PermissionScope,
    ResourcePermission,
    ResourceType,
    Role,
    UserRoleAssignment,
)
from ..core.models.user import User
from ..security.auth import get_current_user
from ..security.permissions import PermissionChecker, require_permission
from ..services.rbac_service import RBACService

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/rbac", tags=["RBAC"])

# Pydantic models for request/response


class PermissionResponse(BaseModel):
    """Permission response model."""

    id: str
    name: str
    display_name: str
    description: Optional[str]
    scope: str
    resource_type: str
    action: str
    is_system: bool
    is_active: bool

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    """Role response model."""

    id: str
    name: str
    display_name: str
    description: Optional[str]
    is_system: bool
    is_active: bool
    organization_id: Optional[str]
    parent_role_id: Optional[str]
    priority: int
    permissions: list[PermissionResponse]

    class Config:
        from_attributes = True


class RoleCreateRequest(BaseModel):
    """Role creation request model."""

    name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    organization_id: Optional[str] = None
    permission_names: list[str] = Field(default_factory=list)
    parent_role_id: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    """Role update request model."""

    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None
    permission_names: Optional[list[str]] = None
    parent_role_id: Optional[str] = None


class UserRoleAssignmentRequest(BaseModel):
    """User role assignment request model."""

    role_id: str
    resource_type: Optional[ResourceType] = None
    resource_id: Optional[str] = None
    expires_at: Optional[str] = None  # ISO datetime string


class UserRoleAssignmentResponse(BaseModel):
    """User role assignment response model."""

    id: str
    user_id: str
    role_id: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    assigned_by: Optional[str]
    assigned_at: str
    expires_at: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class ResourcePermissionRequest(BaseModel):
    """Resource permission grant request model."""

    permission_name: str
    resource_type: ResourceType
    resource_id: str
    expires_at: Optional[str] = None  # ISO datetime string


class ResourcePermissionResponse(BaseModel):
    """Resource permission response model."""

    id: str
    user_id: str
    permission_id: str
    permission_name: str
    resource_type: str
    resource_id: str
    granted_by: Optional[str]
    granted_at: str
    expires_at: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class UserPermissionsResponse(BaseModel):
    """User permissions response model."""

    user_id: str
    permissions: list[str]
    roles: list[RoleResponse]
    resource_permissions: list[ResourcePermissionResponse]


# Helper functions


async def get_rbac_service(request: Request) -> RBACService:
    """Get RBAC service from request."""
    services = getattr(request.app.state, "services", {})
    rbac_service = services.get("rbac")
    if not rbac_service:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RBAC service not available",
        )
    return rbac_service


async def get_permission_checker(request: Request) -> PermissionChecker:
    """Get permission checker from request."""
    rbac_service = await get_rbac_service(request)
    return PermissionChecker(rbac_service)


# Permission endpoints


@router.get(
    "/permissions",
    response_model=list[PermissionResponse],
    summary="List all permissions",
    description="Get a list of all available permissions in the system",
)
@require_permission("security:manage_policies")
async def list_permissions(
    request: Request,
    scope: Optional[PermissionScope] = Query(
        None, description="Filter by permission scope"
    ),
    resource_type: Optional[ResourceType] = Query(
        None, description="Filter by resource type"
    ),
    include_inactive: bool = Query(False, description="Include inactive permissions"),
    current_user: User = Depends(get_current_user),
):
    """List all permissions."""
    try:
        rbac_service = await get_rbac_service(request)

        # Get permissions based on filters
        query = select(Permission)

        if scope:
            query = query.where(Permission.scope == scope)

        if resource_type:
            query = query.where(Permission.resource_type == resource_type)

        if not include_inactive:
            query = query.where(Permission.is_active == True)

        result = await request.app.state.db.execute(query)
        permissions = result.scalars().all()

        return [PermissionResponse.from_orm(perm) for perm in permissions]

    except Exception as e:
        logger.error(f"Error listing permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list permissions",
        )


# Role endpoints


@router.get(
    "/roles",
    response_model=list[RoleResponse],
    summary="List roles",
    description="Get a list of roles, optionally filtered by organization",
)
@require_permission("user:manage_roles")
async def list_roles(
    request: Request,
    organization_id: Optional[str] = Query(
        None, description="Filter by organization ID"
    ),
    include_system: bool = Query(True, description="Include system roles"),
    include_inactive: bool = Query(False, description="Include inactive roles"),
    current_user: User = Depends(get_current_user),
):
    """List roles."""
    try:
        query = select(Role).options(selectinload(Role.permissions))

        if organization_id:
            query = query.where(Role.organization_id == organization_id)
        else:
            # If no organization specified, only show system roles unless user is system admin
            if not include_system:
                query = query.where(Role.organization_id.is_not(None))

        if not include_inactive:
            query = query.where(Role.is_active == True)

        result = await request.app.state.db.execute(query)
        roles = result.scalars().all()

        return [RoleResponse.from_orm(role) for role in roles]

    except Exception as e:
        logger.error(f"Error listing roles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list roles",
        )


@router.post(
    "/roles",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create role",
    description="Create a new role with specified permissions",
)
@require_permission("user:manage_roles")
async def create_role(
    request: Request,
    role_data: RoleCreateRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a new role."""
    try:
        rbac_service = await get_rbac_service(request)

        # Parse expiration time if provided
        expires_at = None
        if role_data.expires_at:
            expires_at = datetime.fromisoformat(
                role_data.expires_at.replace("Z", "+00:00")
            )

        role = await rbac_service.create_role(
            name=role_data.name,
            display_name=role_data.display_name,
            description=role_data.description,
            organization_id=role_data.organization_id,
            permission_names=role_data.permission_names,
            parent_role_id=role_data.parent_role_id,
        )

        # Load permissions for response
        result = await request.app.state.db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.id == role.id)
        )
        role_with_perms = result.scalar_one()

        return RoleResponse.from_orm(role_with_perms)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create role",
        )


@router.get(
    "/roles/{role_id}",
    response_model=RoleResponse,
    summary="Get role",
    description="Get details of a specific role",
)
@require_permission("user:read")
async def get_role(
    request: Request, role_id: str, current_user: User = Depends(get_current_user)
):
    """Get role details."""
    try:
        result = await request.app.state.db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
            )

        return RoleResponse.from_orm(role)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get role",
        )


@router.put(
    "/roles/{role_id}",
    response_model=RoleResponse,
    summary="Update role",
    description="Update role details and permissions",
)
@require_permission("user:manage_roles")
async def update_role(
    request: Request,
    role_id: str,
    role_data: RoleUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """Update role."""
    try:
        # Get existing role
        result = await request.app.state.db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
            )

        # Update fields
        if role_data.display_name is not None:
            role.display_name = role_data.display_name
        if role_data.description is not None:
            role.description = role_data.description
        if role_data.is_active is not None:
            role.is_active = role_data.is_active
        if role_data.parent_role_id is not None:
            role.parent_role_id = role_data.parent_role_id

        # Update permissions if provided
        if role_data.permission_names is not None:
            role.permissions.clear()
            rbac_service = await get_rbac_service(request)
            await rbac_service._assign_permissions_to_role(
                role, role_data.permission_names
            )

        await request.app.state.db.commit()
        await request.app.state.db.refresh(role)

        return RoleResponse.from_orm(role)

    except HTTPException:
        raise
    except Exception as e:
        await request.app.state.db.rollback()
        logger.error(f"Error updating role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role",
        )


@router.delete(
    "/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete role",
    description="Delete a role (soft delete)",
)
@require_permission("user:manage_roles")
async def delete_role(
    request: Request, role_id: str, current_user: User = Depends(get_current_user)
):
    """Delete role."""
    try:
        # Get role
        result = await request.app.state.db.execute(
            select(Role).where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
            )

        # Don't allow deletion of system roles
        if role.is_system:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete system roles",
            )

        # Soft delete
        role.is_active = False
        await request.app.state.db.commit()

    except HTTPException:
        raise
    except Exception as e:
        await request.app.state.db.rollback()
        logger.error(f"Error deleting role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete role",
        )


# User role assignment endpoints


@router.get(
    "/users/{user_id}/roles",
    response_model=list[UserRoleAssignmentResponse],
    summary="Get user roles",
    description="Get all roles assigned to a user",
)
@require_permission("user:read")
async def get_user_roles(
    request: Request,
    user_id: str,
    resource_type: Optional[ResourceType] = Query(None),
    resource_id: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Get user's role assignments."""
    try:
        rbac_service = await get_rbac_service(request)

        roles = await rbac_service.get_user_roles(
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            organization_id=organization_id,
        )

        # Get assignment details
        assignments = []
        for role in roles:
            result = await request.app.state.db.execute(
                select(UserRoleAssignment).where(
                    and_(
                        UserRoleAssignment.user_id == user_id,
                        UserRoleAssignment.role_id == role.id,
                        UserRoleAssignment.is_active == True,
                    )
                )
            )
            assignment = result.scalar_one_or_none()
            if assignment:
                assignments.append(UserRoleAssignmentResponse.from_orm(assignment))

        return assignments

    except Exception as e:
        logger.error(f"Error getting user roles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user roles",
        )


@router.post(
    "/users/{user_id}/roles",
    response_model=UserRoleAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign role to user",
    description="Assign a role to a user, optionally scoped to a specific resource",
)
@require_permission("user:manage_roles")
async def assign_role_to_user(
    request: Request,
    user_id: str,
    assignment_data: UserRoleAssignmentRequest,
    current_user: User = Depends(get_current_user),
):
    """Assign role to user."""
    try:
        rbac_service = await get_rbac_service(request)

        # Parse expiration time if provided
        expires_at = None
        if assignment_data.expires_at:
            expires_at = datetime.fromisoformat(
                assignment_data.expires_at.replace("Z", "+00:00")
            )

        assignment = await rbac_service.assign_role(
            user_id=user_id,
            role_id=assignment_data.role_id,
            resource_type=assignment_data.resource_type,
            resource_id=assignment_data.resource_id,
            assigned_by=current_user.id,
            expires_at=expires_at,
        )

        return UserRoleAssignmentResponse.from_orm(assignment)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error assigning role to user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign role to user",
        )


@router.delete(
    "/users/{user_id}/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke role from user",
    description="Revoke a role from a user",
)
@require_permission("user:manage_roles")
async def revoke_role_from_user(
    request: Request,
    user_id: str,
    role_id: str,
    resource_type: Optional[ResourceType] = Query(None),
    resource_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Revoke role from user."""
    try:
        rbac_service = await get_rbac_service(request)

        success = await rbac_service.revoke_role(
            user_id=user_id,
            role_id=role_id,
            resource_type=resource_type,
            resource_id=resource_id,
            revoked_by=current_user.id,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role assignment not found",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking role from user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke role from user",
        )


# Resource permission endpoints


@router.post(
    "/users/{user_id}/permissions",
    response_model=ResourcePermissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Grant resource permission",
    description="Grant a direct permission to a user for a specific resource",
)
@require_permission("user:manage_roles")
async def grant_resource_permission(
    request: Request,
    user_id: str,
    permission_data: ResourcePermissionRequest,
    current_user: User = Depends(get_current_user),
):
    """Grant direct resource permission to user."""
    try:
        rbac_service = await get_rbac_service(request)

        # Parse expiration time if provided
        expires_at = None
        if permission_data.expires_at:
            expires_at = datetime.fromisoformat(
                permission_data.expires_at.replace("Z", "+00:00")
            )

        resource_permission = await rbac_service.grant_permission(
            user_id=user_id,
            permission_name=permission_data.permission_name,
            resource_type=permission_data.resource_type,
            resource_id=permission_data.resource_id,
            granted_by=current_user.id,
            expires_at=expires_at,
        )

        # Load permission details for response
        result = await request.app.state.db.execute(
            select(ResourcePermission)
            .options(selectinload(ResourcePermission.permission))
            .where(ResourcePermission.id == resource_permission.id)
        )
        perm_with_details = result.scalar_one()

        response = ResourcePermissionResponse.from_orm(perm_with_details)
        response.permission_name = perm_with_details.permission.name

        return response

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error granting resource permission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to grant resource permission",
        )


@router.get(
    "/users/{user_id}/permissions",
    response_model=UserPermissionsResponse,
    summary="Get user permissions",
    description="Get all permissions for a user in a given context",
)
@require_permission("user:read")
async def get_user_permissions(
    request: Request,
    user_id: str,
    resource_type: Optional[ResourceType] = Query(None),
    resource_id: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Get user's permissions."""
    try:
        rbac_service = await get_rbac_service(request)

        # Get user permissions
        permissions = await rbac_service.get_user_permissions(
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            organization_id=organization_id,
        )

        # Get user roles
        roles = await rbac_service.get_user_roles(
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            organization_id=organization_id,
        )

        # Get resource permissions
        result = await request.app.state.db.execute(
            select(ResourcePermission)
            .options(selectinload(ResourcePermission.permission))
            .where(
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
        resource_permissions = result.scalars().all()

        return UserPermissionsResponse(
            user_id=user_id,
            permissions=list(permissions),
            roles=[RoleResponse.from_orm(role) for role in roles],
            resource_permissions=[
                ResourcePermissionResponse.from_orm(rp) for rp in resource_permissions
            ],
        )

    except Exception as e:
        logger.error(f"Error getting user permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user permissions",
        )


# Permission check endpoint


@router.post(
    "/check-permission",
    summary="Check permission",
    description="Check if a user has a specific permission",
)
@require_permission("user:read")
async def check_permission(
    request: Request,
    user_id: str,
    permission_name: str,
    resource_type: Optional[ResourceType] = None,
    resource_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Check if user has specific permission."""
    try:
        rbac_service = await get_rbac_service(request)

        has_permission = await rbac_service.check_permission(
            user_id=user_id,
            permission_name=permission_name,
            resource_type=resource_type,
            resource_id=resource_id,
            organization_id=organization_id,
        )

        return {
            "user_id": user_id,
            "permission_name": permission_name,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "organization_id": organization_id,
            "has_permission": has_permission,
        }

    except Exception as e:
        logger.error(f"Error checking permission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check permission",
        )
