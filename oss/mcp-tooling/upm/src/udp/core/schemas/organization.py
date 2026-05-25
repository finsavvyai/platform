"""
Organization management schemas for Universal Dependency Platform.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    """Organization creation schema."""

    name: str = Field(
        ..., min_length=1, max_length=255, description="Organization name"
    )
    slug: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="URL-friendly organization identifier",
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Organization description"
    )
    domain: Optional[str] = Field(
        None, max_length=255, description="Primary domain for SSO"
    )
    website: Optional[str] = Field(
        None, max_length=500, description="Organization website"
    )


class OrganizationUpdate(BaseModel):
    """Organization update schema."""

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Organization name"
    )
    description: Optional[str] = Field(None, max_length=1000, description="Description")
    domain: Optional[str] = Field(
        None, max_length=255, description="Primary domain for SSO"
    )
    website: Optional[str] = Field(
        None, max_length=500, description="Organization website"
    )
    logo_url: Optional[str] = Field(None, max_length=500, description="Logo URL")


class OrganizationResponse(BaseModel):
    """Organization response schema."""

    id: str = Field(..., description="Organization ID")
    name: str = Field(..., description="Organization name")
    slug: str = Field(..., description="URL-friendly identifier")
    description: Optional[str] = Field(None, description="Description")
    domain: Optional[str] = Field(None, description="Primary domain")
    website: Optional[str] = Field(None, description="Website")
    logo_url: Optional[str] = Field(None, description="Logo URL")
    status: str = Field(..., description="Organization status")
    is_enterprise: bool = Field(False, description="Enterprise features enabled")
    subscription_tier: Optional[str] = Field(None, description="Subscription tier")
    max_users: Optional[str] = Field(None, description="Max users")
    max_projects: Optional[str] = Field(None, description="Max projects")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class MemberAdd(BaseModel):
    """Add member to organization schema."""

    user_id: str = Field(..., description="User ID to add")
    role: str = Field("member", description="Member role: owner, admin, member, viewer")


class MemberUpdate(BaseModel):
    """Update member role schema."""

    role: str = Field(..., description="New role: owner, admin, member, viewer")


class MemberResponse(BaseModel):
    """Organization member response schema."""

    user_id: str = Field(..., description="User ID")
    organization_id: str = Field(..., description="Organization ID")
    role: str = Field(..., description="Member role")
    invited_at: Optional[str] = Field(None, description="Invitation timestamp")
    joined_at: Optional[str] = Field(None, description="Join timestamp")

    class Config:
        from_attributes = True


class OrganizationSettingsUpdate(BaseModel):
    """Organization settings update schema."""

    settings: Dict[str, Any] = Field(..., description="Organization settings")
