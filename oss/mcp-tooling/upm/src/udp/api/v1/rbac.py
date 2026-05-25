"""
RBAC management API endpoints.

This module provides REST API endpoints for managing roles, permissions,
and role assignments in the Universal Dependency Platform.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.models.rbac import (
    Permission,
    PermissionScope,
    ResourceType,
    Role,
    RoleTemplate,
    UserRoleAssignment,
)
from udp.core.models.user import User
from udp.core.schemas.rbac import (
    PermissionCreate,
    PermissionResponse,
    ResourcePermissionCreate,
    ResourcePermissionResponse,
    RoleCreate,
    RoleResponse,
    RoleTemplateResponse,
    RoleUpdate,
    UserRoleAssignmentCreate,
    UserRoleAssignmentResponse,
)
from udp.infrastructure.database import get_async_session
from udp.security.auth import get_current_user
from udp.security.rbac import init_rbac
from udp.security.rbac.decorators import require_permission
from udp.security.rbac.rbac_service import RBACService

logger = structlog.get_logger()

# Create router
router = APIRouter(prefix="/rbac", tags=["rbac"])

# Initialize RBAC dependencies
# In practice, this would be done in your main app startup
rbac_service = RBACService()
init_rbac(rbac_service)

# ========== Permission Management Endpoints ==========


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_permission(
    permission_data: PermissionCreate,
    current_user: User = Depends(require_permission("permission.create")),
    db: AsyncSession = Depends(get_async_session),
) -> Permission:
    """
    Create a new permission.

    Requires permission: permission.create
    """
    try:
        permission = await rbac_service.create_permission(
            db=db,
            name=permission_data.name,
            code=permission_data.code,
            scope=permission_data.scope,
            resource_type=permission_data.resource_type,
            action=permission_data.action,
            description=permission_data.description,
            is_system=permission_data.is_system,
            is_sensitive=permission_data.is_sensitive,
            category=permission_data.category,
            metadata=permission_data.metadata,
        )

        return permission

    except Exception as e:
        logger.error(
            "Failed to create permission",
            error=str(e),
            user_id=current_user.id,
            permission_code=permission_data.code,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    scope: Optional[PermissionScope] = Query(
        None, description="Filter by permission scope"
    ),
    resource_type: Optional[ResourceType] = Query(
        None, description="Filter by resource type"
    ),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_system: Optional[bool] = Query(None, description="Filter system permissions"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    current_user: User = Depends(require_permission("permission.read")),
    db: AsyncSession = Depends(get_async_session),
) -> list[Permission]:
    """
    List permissions with filtering and pagination.

    Requires permission: permission.read
    """
    try:
        permissions, total = await rbac_service.list_permissions(
            db=db,
            scope=scope,
            resource_type=resource_type,
            category=category,
            is_system=is_system,
            page=page,
            limit=limit,
        )

        # Add pagination headers
        response = JSONResponse(
            content=[PermissionResponse.from_orm(p).dict() for p in permissions]
        )
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page"] = str(page)
        response.headers["X-Limit"] = str(limit)
        response.headers["X-Total-Pages"] = str((total + limit - 1) // limit)

        return response

    except Exception as e:
        logger.error(
            "Failed to list permissions",
            error=str(e),
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve permissions",
        )


@router.get("/permissions/{permission_id}", response_model=PermissionResponse)
async def get_permission(
    permission_id: UUID,
    current_user: User = Depends(require_permission("permission.read")),
    db: AsyncSession = Depends(get_async_session),
) -> Permission:
    """
    Get a specific permission by ID.

    Requires permission: permission.read
    """
    permission = await rbac_service.get_permission(db, permission_id=permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found",
        )

    return permission


# ========== Role Management Endpoints ==========


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    current_user: User = Depends(require_permission("role.create")),
    db: AsyncSession = Depends(get_async_session),
) -> Role:
    """
    Create a new role.

    Requires permission: role.create
    """
    try:
        role = await rbac_service.create_role(
            db=db,
            name=role_data.name,
            code=role_data.code,
            description=role_data.description,
            is_system=role_data.is_system,
            is_active=role_data.is_active,
            is_privileged=role_data.is_privileged,
            level=role_data.level,
            parent_role_id=role_data.parent_role_id,
            organization_id=role_data.organization_id,
            permission_codes=role_data.permission_codes,
            metadata=role_data.metadata,
        )

        logger.info(
            "Role created via API",
            role_id=role.id,
            code=role_data.code,
            user_id=current_user.id,
        )

        return role

    except Exception as e:
        logger.error(
            "Failed to create role",
            error=str(e),
            user_id=current_user.id,
            role_code=role_data.code,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    organization_id: Optional[UUID] = Query(None, description="Filter by organization"),
    is_active: Optional[bool] = Query(None, description="Filter active roles"),
    is_system: Optional[bool] = Query(None, description="Filter system roles"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    current_user: User = Depends(require_permission("role.read")),
    db: AsyncSession = Depends(get_async_session),
) -> list[Role]:
    """
    List roles with filtering and pagination.

    Requires permission: role.read
    """
    try:
        # Build query
        query = select(Role).options(selectinload(Role.permissions))

        # Apply filters
        conditions = []
        if organization_id:
            conditions.append(Role.organization_id == str(organization_id))
        if is_active is not None:
            conditions.append(Role.is_active == is_active)
        if is_system is not None:
            conditions.append(Role.is_system == is_system)

        if conditions:
            query = query.where(and_(*conditions))

        # Get total count
        count_query = select(func.count(Role.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))

        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        query = query.order_by(Role.level, Role.code)

        result = await db.execute(query)
        roles = list(result.scalars().all())

        # Add pagination headers
        response = JSONResponse(
            content=[RoleResponse.from_orm(r).dict() for r in roles]
        )
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page"] = str(page)
        response.headers["X-Limit"] = str(limit)
        response.headers["X-Total-Pages"] = str((total + limit - 1) // limit)

        return response

    except Exception as e:
        logger.error(
            "Failed to list roles",
            error=str(e),
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve roles",
        )


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    current_user: User = Depends(require_permission("role.read")),
    db: AsyncSession = Depends(get_async_session),
) -> Role:
    """
    Get a specific role by ID.

    Requires permission: role.read
    """
    role = await rbac_service.get_role(db, role_id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    return role


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    role_update: RoleUpdate,
    current_user: User = Depends(require_permission("role.update")),
    db: AsyncSession = Depends(get_async_session),
) -> Role:
    """
    Update a role.

    Requires permission: role.update
    """
    try:
        # Convert update dict, excluding None values
        updates = role_update.dict(exclude_unset=True)

        role = await rbac_service.update_role(db, role_id=role_id, updates=updates)

        logger.info(
            "Role updated via API",
            role_id=role.id,
            user_id=current_user.id,
            updates=list(updates.keys()),
        )

        return role

    except Exception as e:
        logger.error(
            "Failed to update role",
            error=str(e),
            user_id=current_user.id,
            role_id=role_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    force: bool = Query(False, description="Force delete even with assignments"),
    current_user: User = Depends(require_permission("role.delete")),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """
    Delete a role.

    Requires permission: role.delete
    """
    try:
        await rbac_service.delete_role(db, role_id=role_id, force=force)

        logger.info(
            "Role deleted via API",
            role_id=role_id,
            user_id=current_user.id,
            force=force,
        )

    except Exception as e:
        logger.error(
            "Failed to delete role",
            error=str(e),
            user_id=current_user.id,
            role_id=role_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/roles/{role_id}/permissions", response_model=RoleResponse)
async def add_permissions_to_role(
    role_id: UUID,
    permission_codes: list[str],
    current_user: User = Depends(require_permission("role.update")),
    db: AsyncSession = Depends(get_async_session),
) -> Role:
    """
    Add permissions to a role.

    Requires permission: role.update
    """
    try:
        role = await rbac_service.add_permissions_to_role(
            db, role_id=role_id, permission_codes=permission_codes
        )

        logger.info(
            "Permissions added to role via API",
            role_id=role_id,
            permission_codes=permission_codes,
            user_id=current_user.id,
        )

        return role

    except Exception as e:
        logger.error(
            "Failed to add permissions to role",
            error=str(e),
            user_id=current_user.id,
            role_id=role_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/roles/{role_id}/permissions", response_model=RoleResponse)
async def remove_permissions_from_role(
    role_id: UUID,
    permission_codes: list[str],
    current_user: User = Depends(require_permission("role.update")),
    db: AsyncSession = Depends(get_async_session),
) -> Role:
    """
    Remove permissions from a role.

    Requires permission: role.update
    """
    try:
        role = await rbac_service.remove_permissions_from_role(
            db, role_id=role_id, permission_codes=permission_codes
        )

        logger.info(
            "Permissions removed from role via API",
            role_id=role_id,
            permission_codes=permission_codes,
            user_id=current_user.id,
        )

        return role

    except Exception as e:
        logger.error(
            "Failed to remove permissions from role",
            error=str(e),
            user_id=current_user.id,
            role_id=role_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ========== User Role Assignment Endpoints ==========


@router.post(
    "/assignments",
    response_model=UserRoleAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_role_to_user(
    assignment_data: UserRoleAssignmentCreate,
    current_user: User = Depends(require_permission("assignment.create")),
    db: AsyncSession = Depends(get_async_session),
) -> UserRoleAssignment:
    """
    Assign a role to a user.

    Requires permission: assignment.create
    """
    try:
        assignment = await rbac_service.assign_role_to_user(
            db=db,
            user_id=assignment_data.user_id,
            role_id=assignment_data.role_id,
            organization_id=assignment_data.organization_id,
            project_id=assignment_data.project_id,
            expires_at=assignment_data.expires_at,
            assigned_by=current_user.id,
            reason=assignment_data.reason,
            metadata=assignment_data.metadata,
        )

        logger.info(
            "Role assigned via API",
            assignment_id=assignment.id,
            user_id=assignment_data.user_id,
            role_id=assignment_data.role_id,
            assigned_by=current_user.id,
        )

        return assignment

    except Exception as e:
        logger.error(
            "Failed to assign role to user",
            error=str(e),
            user_id=current_user.id,
            assignment_data=assignment_data.dict(),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/assignments", response_model=list[UserRoleAssignmentResponse])
async def list_user_assignments(
    user_id: Optional[UUID] = Query(None, description="Filter by user"),
    role_id: Optional[UUID] = Query(None, description="Filter by role"),
    organization_id: Optional[UUID] = Query(None, description="Filter by organization"),
    project_id: Optional[UUID] = Query(None, description="Filter by project"),
    active_only: bool = Query(True, description="Only show active assignments"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    current_user: User = Depends(require_permission("assignment.read")),
    db: AsyncSession = Depends(get_async_session),
) -> list[UserRoleAssignment]:
    """
    List user role assignments.

    Requires permission: assignment.read
    """
    try:
        # If user_id is not provided, check if user can only see their own assignments
        if not user_id and not current_user.is_superuser:
            # Users without assignment.read_all permission can only see their own assignments
            has_read_all = await rbac_service.check_permission(
                db, current_user, "assignment.read_all"
            )
            if not has_read_all:
                user_id = current_user.id

        # Get assignments
        if user_id:
            assignments = await rbac_service.get_user_assignments(
                db=db,
                user_id=user_id,
                organization_id=organization_id,
                project_id=project_id,
                active_only=active_only,
            )
        else:
            # Admin can view all assignments
            query = select(UserRoleAssignment).options(
                selectinload(UserRoleAssignment.user),
                selectinload(UserRoleAssignment.role),
            )

            conditions = []
            if role_id:
                conditions.append(UserRoleAssignment.role_id == str(role_id))
            if organization_id:
                conditions.append(
                    UserRoleAssignment.organization_id == str(organization_id)
                )
            if project_id:
                conditions.append(UserRoleAssignment.project_id == str(project_id))
            if active_only:
                conditions.append(UserRoleAssignment.is_active == True)
                conditions.append(
                    or_(
                        UserRoleAssignment.expires_at.is_(None),
                        UserRoleAssignment.expires_at > datetime.utcnow(),
                    )
                )

            if conditions:
                query = query.where(and_(*conditions))

            result = await db.execute(query)
            assignments = list(result.scalars().all())

        # Apply pagination
        offset = (page - 1) * limit
        paginated_assignments = assignments[offset : offset + limit]

        # Add pagination headers
        response = JSONResponse(
            content=[
                UserRoleAssignmentResponse.from_orm(a).dict()
                for a in paginated_assignments
            ]
        )
        response.headers["X-Total-Count"] = str(len(assignments))
        response.headers["X-Page"] = str(page)
        response.headers["X-Limit"] = str(limit)
        response.headers["X-Total-Pages"] = str((len(assignments) + limit - 1) // limit)

        return response

    except Exception as e:
        logger.error(
            "Failed to list assignments",
            error=str(e),
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve assignments",
        )


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_assignment(
    assignment_id: UUID,
    current_user: User = Depends(require_permission("assignment.delete")),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """
    Remove a user role assignment.

    Requires permission: assignment.delete
    """
    try:
        # Get assignment first
        result = await db.execute(
            select(UserRoleAssignment).where(UserRoleAssignment.id == assignment_id)
        )
        assignment = result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found",
            )

        # Remove assignment
        success = await rbac_service.remove_role_from_user(
            db=db,
            user_id=assignment.user_id,
            role_id=assignment.role_id,
            organization_id=assignment.organization_id,
            project_id=assignment.project_id,
        )

        if success:
            logger.info(
                "Role assignment removed via API",
                assignment_id=assignment_id,
                user_id=current_user.id,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove assignment",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to remove assignment",
            error=str(e),
            user_id=current_user.id,
            assignment_id=assignment_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove assignment",
        )


# ========== Resource Permission Endpoints ==========


@router.post(
    "/resource-permissions",
    response_model=ResourcePermissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def grant_resource_permission(
    permission_data: ResourcePermissionCreate,
    current_user: User = Depends(require_permission("resource_permission.grant")),
    db: AsyncSession = Depends(get_async_session),
) -> ResourcePermission:
    """
    Grant a permission to a user on a specific resource.

    Requires permission: resource_permission.grant
    """
    try:
        resource_permission = await rbac_service.grant_resource_permission(
            db=db,
            user_id=permission_data.user_id,
            permission_code=permission_data.permission_code,
            resource_type=permission_data.resource_type,
            resource_id=permission_data.resource_id,
            organization_id=permission_data.organization_id,
            expires_at=permission_data.expires_at,
            granted_by=current_user.id,
            reason=permission_data.reason,
            metadata=permission_data.metadata,
        )

        logger.info(
            "Resource permission granted via API",
            permission_id=resource_permission.id,
            user_id=permission_data.user_id,
            permission_code=permission_data.permission_code,
            granted_by=current_user.id,
        )

        return resource_permission

    except Exception as e:
        logger.error(
            "Failed to grant resource permission",
            error=str(e),
            user_id=current_user.id,
            permission_data=permission_data.dict(),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/resource-permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_resource_permission(
    permission_id: UUID,
    current_user: User = Depends(require_permission("resource_permission.revoke")),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """
    Revoke a resource permission.

    Requires permission: resource_permission.revoke
    """
    try:
        # Get resource permission first
        result = await db.execute(
            select(ResourcePermission).where(ResourcePermission.id == permission_id)
        )
        resource_permission = result.scalar_one_or_none()

        if not resource_permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource permission not found",
            )

        # Revoke permission
        success = await rbac_service.revoke_resource_permission(
            db=db,
            user_id=resource_permission.user_id,
            permission_code=resource_permission.permission.code,
            resource_type=resource_permission.resource_type,
            resource_id=resource_permission.resource_id,
        )

        if success:
            logger.info(
                "Resource permission revoked via API",
                permission_id=permission_id,
                user_id=current_user.id,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to revoke permission",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to revoke resource permission",
            error=str(e),
            user_id=current_user.id,
            permission_id=permission_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke permission",
        )


# ========== Role Template Endpoints ==========


@router.get("/role-templates", response_model=list[RoleTemplateResponse])
async def list_role_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    scope: Optional[PermissionScope] = Query(None, description="Filter by scope"),
    current_user: User = Depends(require_permission("template.read")),
    db: AsyncSession = Depends(get_async_session),
) -> list[RoleTemplate]:
    """
    List available role templates.

    Requires permission: template.read
    """
    try:
        query = select(RoleTemplate)

        # Apply filters
        conditions = []
        if category:
            conditions.append(RoleTemplate.category == category)
        if scope:
            conditions.append(RoleTemplate.scope == scope)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(RoleTemplate.category, RoleTemplate.name)

        result = await db.execute(query)
        templates = list(result.scalars().all())

        return templates

    except Exception as e:
        logger.error(
            "Failed to list role templates",
            error=str(e),
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve role templates",
        )


@router.post(
    "/roles/from-template",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_role_from_template(
    template_code: str,
    name: str,
    code: str,
    organization_id: Optional[UUID] = None,
    description: Optional[str] = None,
    current_user: User = Depends(require_permission("role.create")),
    db: AsyncSession = Depends(get_async_session),
) -> Role:
    """
    Create a role from a template.

    Requires permission: role.create
    """
    try:
        role = await rbac_service.create_role_from_template(
            db=db,
            template_code=template_code,
            name=name,
            code=code,
            organization_id=organization_id,
            description=description,
        )

        logger.info(
            "Role created from template via API",
            role_id=role.id,
            template_code=template_code,
            user_id=current_user.id,
        )

        return role

    except Exception as e:
        logger.error(
            "Failed to create role from template",
            error=str(e),
            user_id=current_user.id,
            template_code=template_code,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ========== Permission Check Endpoint ==========


@router.post("/check-permission")
async def check_permission(
    permission_code: str,
    resource_type: Optional[ResourceType] = None,
    resource_id: Optional[UUID] = None,
    organization_id: Optional[UUID] = None,
    project_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """
    Check if the current user has a specific permission.

    This endpoint allows frontend applications to check permissions
    before enabling/disabling features.

    No special permission required - users can only check their own permissions.
    """
    try:
        has_permission = await rbac_service.check_permission(
            db=db,
            user=current_user,
            permission_code=permission_code,
            resource_type=resource_type,
            resource_id=resource_id,
            organization_id=organization_id,
            project_id=project_id,
        )

        return {
            "has_permission": has_permission,
            "user_id": str(current_user.id),
            "permission_code": permission_code,
            "resource_type": resource_type,
            "resource_id": str(resource_id) if resource_id else None,
        }

    except Exception as e:
        logger.error(
            "Failed to check permission",
            error=str(e),
            user_id=current_user.id,
            permission_code=permission_code,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check permission",
        )


@router.get("/my-permissions")
async def get_my_permissions(
    organization_id: Optional[UUID] = Query(None, description="Organization context"),
    project_id: Optional[UUID] = Query(None, description="Project context"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """
    Get all permissions for the current user in a specific context.

    No special permission required - users can only view their own permissions.
    """
    try:
        permissions = await rbac_service.permission_checker.get_user_permissions(
            db=db,
            user=current_user,
            organization_id=organization_id,
            project_id=project_id,
        )

        # Get user's roles
        roles = await rbac_service.permission_checker.get_user_roles(
            db=db,
            user=current_user,
            organization_id=organization_id,
            project_id=project_id,
        )

        return {
            "user_id": str(current_user.id),
            "permissions": list(permissions),
            "roles": [
                {
                    "id": str(role.id),
                    "name": role.name,
                    "code": role.code,
                    "level": role.level,
                }
                for role in roles
            ],
            "organization_id": str(organization_id) if organization_id else None,
            "project_id": str(project_id) if project_id else None,
        }

    except Exception as e:
        logger.error(
            "Failed to get user permissions",
            error=str(e),
            user_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve permissions",
        )
