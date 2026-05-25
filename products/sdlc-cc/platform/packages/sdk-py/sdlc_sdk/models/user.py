"""
User models for SDLC.ai SDK

Provides models for user management operations.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import Field, validator, EmailStr

from .base import BaseModel, TimestampModel, ListResponseModel


class UserRole(BaseModel):
    """User role model."""

    id: str = Field(..., description="Role ID")
    name: str = Field(..., description="Role name")
    display_name: str = Field(..., description="Display name")
    description: Optional[str] = Field(None, description="Role description")
    permissions: List[str] = Field(default_factory=list, description="Role permissions")
    is_system: bool = Field(False, description="System role flag")
    created_at: datetime = Field(..., description="Creation time")


class UserPermissions(BaseModel):
    """User permissions model."""

    permissions: List[str] = Field(default_factory=list, description="Permission list")
    roles: List[UserRole] = Field(default_factory=list, description="User roles")
    custom_permissions: Dict[str, Any] = Field(
        default_factory=dict, description="Custom permissions"
    )

    def has_permission(self, permission: str) -> bool:
        """Check if user has permission."""
        if permission in self.permissions:
            return True

        for role in self.roles:
            if permission in role.permissions:
                return True

        return False

    def has_role(self, role_name: str) -> bool:
        """Check if user has role."""
        return any(role.name == role_name for role in self.roles)


class User(BaseModel, TimestampModel):
    """User model."""

    id: str = Field(..., description="User ID")
    email: EmailStr = Field(..., description="User email")
    name: str = Field(..., description="User name")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    phone: Optional[str] = Field(None, description="Phone number")
    timezone: str = Field("UTC", description="User timezone")
    locale: str = Field("en", description="User locale")
    is_active: bool = Field(True, description="Active status")
    is_verified: bool = Field(False, description="Verification status")
    last_login_at: Optional[datetime] = Field(None, description="Last login time")
    tenant_id: Optional[str] = Field(None, description="Primary tenant ID")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    @property
    def display_name(self) -> str:
        """Get display name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.name

    @validator("email")
    def normalize_email(cls, v):
        """Normalize email address."""
        return v.lower().strip()


class UserCreate(BaseModel):
    """User creation model."""

    email: EmailStr = Field(..., description="User email")
    name: str = Field(..., description="User name")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    password: Optional[str] = Field(None, min_length=8, description="Initial password")
    phone: Optional[str] = Field(None, description="Phone number")
    tenant_id: str = Field(..., description="Tenant ID")
    roles: List[str] = Field(default_factory=list, description="Initial roles")
    permissions: List[str] = Field(
        default_factory=list, description="Additional permissions"
    )
    timezone: str = Field("UTC", description="User timezone")
    locale: str = Field("en", description="User locale")
    send_welcome_email: bool = Field(True, description="Send welcome email")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    @validator("tenant_id")
    def validate_tenant_id(cls, v):
        """Validate tenant ID format."""
        if not v or len(v) < 3:
            raise ValueError("Tenant ID must be at least 3 characters")
        return v


class UserUpdate(BaseModel):
    """User update model."""

    name: Optional[str] = Field(None, description="User name")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    phone: Optional[str] = Field(None, description="Phone number")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    timezone: Optional[str] = Field(None, description="User timezone")
    locale: Optional[str] = Field(None, description="User locale")
    is_active: Optional[bool] = Field(None, description="Active status")
    roles: Optional[List[str]] = Field(None, description="User roles")
    permissions: Optional[List[str]] = Field(None, description="User permissions")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    class Config:
        """Model configuration."""

        extra = "allow"


class UserListResponse(ListResponseModel):
    """User list response model."""

    data: List[User] = Field(..., description="List of users")


class BulkUserCreate(BaseModel):
    """Bulk user creation model."""

    users: List[UserCreate] = Field(..., description="Users to create")
    continue_on_error: bool = Field(False, description="Continue on error")
    send_welcome_emails: bool = Field(True, description="Send welcome emails")

    @validator("users")
    def validate_users(cls, v):
        """Validate users list."""
        if len(v) > 1000:
            raise ValueError("Cannot create more than 1000 users at once")
        return v


class BulkUserResult(BaseModel):
    """Bulk user operation result."""

    total: int = Field(..., description="Total users processed")
    successful: int = Field(..., description="Successful operations")
    failed: int = Field(..., description="Failed operations")
    results: List[Dict[str, Any]] = Field(..., description="Operation results")
    errors: List[Dict[str, Any]] = Field(
        default_factory=list, description="Errors encountered"
    )


class UserActivity(BaseModel):
    """User activity model."""

    id: str = Field(..., description="Activity ID")
    user_id: str = Field(..., description="User ID")
    action: str = Field(..., description="Action performed")
    resource_type: Optional[str] = Field(None, description="Resource type")
    resource_id: Optional[str] = Field(None, description="Resource ID")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    timestamp: datetime = Field(..., description="Activity timestamp")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional data"
    )


class UserPreferences(BaseModel):
    """User preferences model."""

    user_id: str = Field(..., description="User ID")
    theme: Literal["light", "dark", "auto"] = Field("auto", description="UI theme")
    language: str = Field("en", description="Language preference")
    timezone: str = Field("UTC", description="Timezone")
    notifications: Dict[str, bool] = Field(
        default_factory=lambda: {
            "email": True,
            "push": True,
            "sms": False,
        },
        description="Notification preferences",
    )
    ui_settings: Dict[str, Any] = Field(default_factory=dict, description="UI settings")
    custom: Dict[str, Any] = Field(
        default_factory=dict, description="Custom preferences"
    )


class UserProfile(BaseModel):
    """Extended user profile model."""

    user: User = Field(..., description="Base user information")
    permissions: UserPermissions = Field(..., description="User permissions")
    preferences: UserPreferences = Field(..., description="User preferences")
    tenants: List[str] = Field(default_factory=list, description="Accessible tenants")
    last_activity: Optional[UserActivity] = Field(None, description="Last activity")
    stats: Dict[str, Any] = Field(default_factory=dict, description="User statistics")
