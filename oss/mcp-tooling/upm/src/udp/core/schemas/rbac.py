"""
Pydantic schemas for RBAC models.

This module contains request/response schemas for RBAC API endpoints
including permissions, roles, assignments, and templates.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from uuid import UUID

from pydantic import BaseModel, Field, validator
from enum import Enum

from udp.core.models.rbac import PermissionScope, ResourceType


# Permission Schemas
class PermissionBase(BaseModel):
    """Base permission schema."""

    name: str = Field(..., description="Human-readable permission name")
    code: str = Field(..., description="Unique permission code")
    description: Optional[str] = Field(None, description="Permission description")
    scope: PermissionScope = Field(..., description="Permission scope")
    resource_type: ResourceType = Field(..., description="Resource type")
    action: str = Field(..., description="Action that can be performed")
    is_system: bool = Field(False, description="Whether this is a system permission")
    is_sensitive: bool = Field(
        False, description="Whether this grants sensitive access"
    )
    category: Optional[str] = Field(None, description="Permission category")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class PermissionCreate(PermissionBase):
    """Schema for creating a permission."""

    @validator("code")
    def validate_code(cls, v):
        """Validate permission code format."""
        if not v or "." not in v:
            raise ValueError(
                "Permission code must contain a dot (e.g., 'project.create')"
            )
        return v.lower()


class PermissionUpdate(BaseModel):
    """Schema for updating a permission."""

    name: Optional[str] = Field(None, description="Permission name")
    description: Optional[str] = Field(None, description="Permission description")
    is_sensitive: Optional[bool] = Field(None, description="Sensitive flag")
    category: Optional[str] = Field(None, description="Permission category")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class PermissionResponse(PermissionBase):
    """Schema for permission response."""

    id: UUID = Field(..., description="Permission ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


# Role Schemas
class RoleBase(BaseModel):
    """Base role schema."""

    name: str = Field(..., description="Role name")
    code: str = Field(..., description="Unique role code")
    description: Optional[str] = Field(None, description="Role description")
    is_system: bool = Field(False, description="Whether this is a system role")
    is_active: bool = Field(True, description="Whether role is active")
    is_privileged: bool = Field(
        False, description="Whether role has elevated privileges"
    )
    level: int = Field(0, description="Role hierarchy level")
    parent_role_id: Optional[UUID] = Field(
        None, description="Parent role for inheritance"
    )
    organization_id: Optional[UUID] = Field(None, description="Organization context")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class RoleCreate(RoleBase):
    """Schema for creating a role."""

    permission_codes: Optional[List[str]] = Field(
        default_factory=list, description="List of permission codes to assign"
    )

    @validator("code")
    def validate_code(cls, v):
        """Validate role code format."""
        if not v or len(v) < 2:
            raise ValueError("Role code must be at least 2 characters")
        return v.lower().replace(" ", "_")


class RoleUpdate(BaseModel):
    """Schema for updating a role."""

    name: Optional[str] = Field(None, description="Role name")
    description: Optional[str] = Field(None, description="Role description")
    is_active: Optional[bool] = Field(None, description="Active status")
    is_privileged: Optional[bool] = Field(None, description="Privileged flag")
    level: Optional[int] = Field(None, description="Hierarchy level")
    parent_role_id: Optional[UUID] = Field(None, description="Parent role")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class RoleResponse(RoleBase):
    """Schema for role response."""

    id: UUID = Field(..., description="Role ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    permissions: List[PermissionResponse] = Field(
        default_factory=list, description="Role permissions"
    )

    class Config:
        from_attributes = True


class RoleSummary(BaseModel):
    """Summary role schema for list views."""

    id: UUID = Field(..., description="Role ID")
    name: str = Field(..., description="Role name")
    code: str = Field(..., description="Role code")
    description: Optional[str] = Field(None, description="Role description")
    is_system: bool = Field(..., description="System role flag")
    is_active: bool = Field(..., description="Active status")
    level: int = Field(..., description="Hierarchy level")
    permission_count: int = Field(..., description="Number of permissions")

    class Config:
        from_attributes = True


# User Role Assignment Schemas
class UserRoleAssignmentBase(BaseModel):
    """Base user role assignment schema."""

    user_id: UUID = Field(..., description="User ID")
    role_id: UUID = Field(..., description="Role ID")
    organization_id: Optional[UUID] = Field(None, description="Organization context")
    project_id: Optional[UUID] = Field(None, description="Project context")
    expires_at: Optional[datetime] = Field(None, description="Expiration time")
    reason: Optional[str] = Field(None, description="Assignment reason")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class UserRoleAssignmentCreate(UserRoleAssignmentBase):
    """Schema for creating a user role assignment."""

    pass


class UserRoleAssignmentUpdate(BaseModel):
    """Schema for updating a user role assignment."""

    is_active: Optional[bool] = Field(None, description="Active status")
    expires_at: Optional[datetime] = Field(None, description="Expiration time")
    reason: Optional[str] = Field(None, description="Assignment reason")


class UserRoleAssignmentResponse(UserRoleAssignmentBase):
    """Schema for user role assignment response."""

    id: UUID = Field(..., description="Assignment ID")
    is_active: bool = Field(..., description="Active status")
    assigned_at: datetime = Field(..., description="Assignment timestamp")
    assigned_by: Optional[UUID] = Field(None, description="Who made the assignment")

    # Nested objects
    user: Optional[Dict[str, Any]] = Field(None, description="User details")
    role: Optional[RoleSummary] = Field(None, description="Role details")

    class Config:
        from_attributes = True


# Resource Permission Schemas
class ResourcePermissionBase(BaseModel):
    """Base resource permission schema."""

    user_id: UUID = Field(..., description="User ID")
    permission_code: str = Field(..., description="Permission code")
    resource_type: ResourceType = Field(..., description="Resource type")
    resource_id: UUID = Field(..., description="Resource ID")
    organization_id: Optional[UUID] = Field(None, description="Organization context")
    expires_at: Optional[datetime] = Field(None, description="Expiration time")
    reason: Optional[str] = Field(None, description="Grant reason")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class ResourcePermissionCreate(ResourcePermissionBase):
    """Schema for creating a resource permission."""

    pass


class ResourcePermissionResponse(ResourcePermissionBase):
    """Schema for resource permission response."""

    id: UUID = Field(..., description="Permission ID")
    is_granted: bool = Field(..., description="Whether permission is granted")
    granted_at: datetime = Field(..., description="Grant timestamp")
    granted_by: Optional[UUID] = Field(None, description="Who granted the permission")

    class Config:
        from_attributes = True


# Role Template Schemas
class RoleTemplateBase(BaseModel):
    """Base role template schema."""

    name: str = Field(..., description="Template name")
    code: str = Field(..., description="Template code")
    description: Optional[str] = Field(None, description="Template description")
    category: str = Field(..., description="Template category")
    scope: PermissionScope = Field(..., description="Template scope")
    is_system: bool = Field(False, description="System template flag")
    permissions: List[str] = Field(default_factory=list, description="Permission codes")
    default_settings: Dict[str, Any] = Field(
        default_factory=dict, description="Default settings"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class RoleTemplateCreate(RoleTemplateBase):
    """Schema for creating a role template."""

    pass


class RoleTemplateResponse(RoleTemplateBase):
    """Schema for role template response."""

    id: UUID = Field(..., description="Template ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


# Permission Check Schemas
class PermissionCheckRequest(BaseModel):
    """Schema for permission check request."""

    permission_code: str = Field(..., description="Permission to check")
    resource_type: Optional[ResourceType] = Field(None, description="Resource type")
    resource_id: Optional[UUID] = Field(None, description="Resource ID")
    organization_id: Optional[UUID] = Field(None, description="Organization context")
    project_id: Optional[UUID] = Field(None, description="Project context")


class PermissionCheckResponse(BaseModel):
    """Schema for permission check response."""

    has_permission: bool = Field(..., description="Whether permission is granted")
    user_id: UUID = Field(..., description="User ID")
    permission_code: str = Field(..., description="Checked permission")
    resource_type: Optional[ResourceType] = Field(None, description="Resource type")
    resource_id: Optional[UUID] = Field(None, description="Resource ID")
    checked_at: datetime = Field(..., description="Check timestamp")


class UserPermissionsResponse(BaseModel):
    """Schema for user permissions response."""

    user_id: UUID = Field(..., description="User ID")
    permissions: List[str] = Field(..., description="User permissions")
    roles: List[RoleSummary] = Field(..., description="User roles")
    organization_id: Optional[UUID] = Field(None, description="Organization context")
    project_id: Optional[UUID] = Field(None, description="Project context")
    retrieved_at: datetime = Field(..., description="Retrieval timestamp")


# Bulk Operation Schemas
class BulkRoleAssignmentRequest(BaseModel):
    """Schema for bulk role assignment."""

    user_ids: List[UUID] = Field(..., description="List of user IDs")
    role_id: UUID = Field(..., description="Role to assign")
    organization_id: Optional[UUID] = Field(None, description="Organization context")
    project_id: Optional[UUID] = Field(None, description="Project context")
    expires_at: Optional[datetime] = Field(None, description="Expiration time")
    reason: Optional[str] = Field(None, description="Assignment reason")


class BulkOperationResponse(BaseModel):
    """Schema for bulk operation response."""

    total: int = Field(..., description="Total operations attempted")
    successful: int = Field(..., description="Successful operations")
    failed: int = Field(..., description="Failed operations")
    errors: List[Dict[str, Any]] = Field(
        default_factory=list, description="Error details"
    )

    class Config:
        from_attributes = True


# Audit Schemas
class RoleAssignmentAuditLog(BaseModel):
    """Schema for role assignment audit log."""

    id: UUID = Field(..., description="Log ID")
    user_id: UUID = Field(..., description="Target user ID")
    role_id: UUID = Field(..., description="Role ID")
    action: str = Field(..., description="Action (assign/revoke)")
    performed_by: UUID = Field(..., description="Who performed the action")
    performed_at: datetime = Field(..., description="Action timestamp")
    organization_id: Optional[UUID] = Field(None, description="Organization context")
    project_id: Optional[UUID] = Field(None, description="Project context")
    reason: Optional[str] = Field(None, description="Action reason")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    class Config:
        from_attributes = True


# Permission Inheritance Schemas
class RoleHierarchyResponse(BaseModel):
    """Schema for role hierarchy response."""

    role: RoleResponse = Field(..., description="Base role")
    parent_role: Optional[RoleResponse] = Field(None, description="Parent role")
    child_roles: List[RoleResponse] = Field(
        default_factory=list, description="Child roles"
    )
    inherited_permissions: List[PermissionResponse] = Field(
        default_factory=list, description="Permissions inherited from parent roles"
    )
    effective_permissions: List[PermissionResponse] = Field(
        default_factory=list,
        description="All effective permissions (direct + inherited)",
    )

    class Config:
        from_attributes = True


# Configuration Schemas
class RBACConfiguration(BaseModel):
    """Schema for RBAC system configuration."""

    cache_ttl: int = Field(300, description="Permission cache TTL in seconds")
    max_hierarchy_depth: int = Field(10, description="Maximum role hierarchy depth")
    allow_self_assignment: bool = Field(
        False, description="Allow users to assign roles to themselves"
    )
    require_approval_for_privileged: bool = Field(
        True, description="Require approval for privileged roles"
    )
    session_timeout_minutes: int = Field(60, description="Session timeout in minutes")
    audit_log_retention_days: int = Field(
        365, description="Audit log retention in days"
    )

    class Config:
        from_attributes = True
