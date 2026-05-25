"""
Tenant management models for SDLC.ai SDK

Provides models for tenant operations including hierarchy and isolation.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import Field, validator

from .base import BaseModel, TimestampModel, ListResponseModel


class TenantSettings(BaseModel):
    """Tenant configuration settings model."""

    # General settings
    name: str = Field(..., description="Tenant display name")
    domain: Optional[str] = Field(None, description="Tenant domain")
    timezone: str = Field("UTC", description="Tenant timezone")
    locale: str = Field("en", description="Tenant locale")

    # Security settings
    mfa_required: bool = Field(False, description="MFA required for all users")
    password_policy: Dict[str, Any] = Field(
        default_factory=lambda: {
            "min_length": 8,
            "require_uppercase": True,
            "require_lowercase": True,
            "require_numbers": True,
            "require_symbols": True,
        },
        description="Password policy",
    )
    session_timeout_minutes: int = Field(480, description="Session timeout")

    # Feature flags
    features: Dict[str, bool] = Field(
        default_factory=lambda: {
            "document_upload": True,
            "rag_queries": True,
            "vector_search": True,
            "policy_management": True,
            "audit_logs": True,
        },
        description="Feature flags",
    )

    # Limits
    limits: Dict[str, Any] = Field(
        default_factory=lambda: {
            "max_users": 1000,
            "max_documents": 100000,
            "storage_gb": 1000,
            "api_calls_per_day": 1000000,
        },
        description="Resource limits",
    )

    # Branding
    branding: Dict[str, Any] = Field(
        default_factory=dict, description="Custom branding settings"
    )

    # Integration settings
    integrations: Dict[str, Any] = Field(
        default_factory=dict, description="Third-party integrations"
    )


class Tenant(BaseModel, TimestampModel):
    """Tenant model."""

    id: str = Field(..., description="Tenant ID")
    name: str = Field(..., description="Tenant name")
    slug: str = Field(..., description="Tenant slug for URLs")
    description: Optional[str] = Field(None, description="Tenant description")

    # Hierarchy
    parent_tenant_id: Optional[str] = Field(None, description="Parent tenant ID")
    root_tenant_id: Optional[str] = Field(None, description="Root tenant ID")
    hierarchy_level: int = Field(0, description="Hierarchy level")

    # Status
    status: Literal["active", "inactive", "suspended", "archived"] = Field(
        "active", description="Tenant status"
    )

    # Settings
    settings: TenantSettings = Field(..., description="Tenant settings")

    # Metadata
    owner_id: str = Field(..., description="Tenant owner ID")
    created_by: str = Field(..., description="Creator ID")

    # Billing
    plan: str = Field("free", description="Subscription plan")
    billing_email: Optional[str] = Field(None, description="Billing email")

    # Usage statistics
    user_count: int = Field(0, description="Number of users")
    document_count: int = Field(0, description="Number of documents")
    storage_used_mb: float = Field(0.0, description="Storage used in MB")

    # Custom data
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Custom metadata"
    )
    tags: List[str] = Field(default_factory=list, description="Tenant tags")

    @validator("slug")
    def validate_slug(cls, v):
        """Validate tenant slug."""
        if not v or not v.isalnum():
            raise ValueError("Slug must be alphanumeric")
        return v.lower()

    @property
    def is_active(self) -> bool:
        """Check if tenant is active."""
        return self.status == "active"

    @property
    def is_root(self) -> bool:
        """Check if tenant is root."""
        return self.hierarchy_level == 0


class TenantCreate(BaseModel):
    """Tenant creation model."""

    name: str = Field(..., description="Tenant name")
    slug: Optional[str] = Field(None, description="Tenant slug")
    description: Optional[str] = Field(None, description="Tenant description")

    # Hierarchy
    parent_tenant_id: Optional[str] = Field(None, description="Parent tenant ID")

    # Initial settings
    settings: Optional[TenantSettings] = Field(None, description="Initial settings")

    # Owner
    owner_id: str = Field(..., description="Initial owner ID")
    owner_email: str = Field(..., description="Owner email")

    # Plan
    plan: str = Field("free", description="Subscription plan")
    billing_email: Optional[str] = Field(None, description="Billing email")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Custom metadata"
    )
    tags: List[str] = Field(default_factory=list, description="Initial tags")

    @validator("slug")
    def generate_slug_if_missing(cls, v, values):
        """Generate slug from name if not provided."""
        if not v and "name" in values:
            v = values["name"].lower().replace(" ", "-")
            v = "".join(c for c in v if c.isalnum() or c == "-")
        return v


class TenantUpdate(BaseModel):
    """Tenant update model."""

    name: Optional[str] = Field(None, description="Tenant name")
    description: Optional[str] = Field(None, description="Tenant description")
    status: Optional[Literal["active", "inactive", "suspended", "archived"]] = Field(
        None, description="Tenant status"
    )

    # Settings
    settings: Optional[TenantSettings] = Field(None, description="Updated settings")

    # Plan
    plan: Optional[str] = Field(None, description="Subscription plan")
    billing_email: Optional[str] = Field(None, description="Billing email")

    # Metadata
    metadata: Optional[Dict[str, Any]] = Field(None, description="Custom metadata")
    tags: Optional[List[str]] = Field(None, description="Tenant tags")

    class Config:
        """Model configuration."""

        extra = "allow"


class TenantListResponse(ListResponseModel):
    """Tenant list response model."""

    data: List[Tenant] = Field(..., description="List of tenants")


class TenantHierarchy(BaseModel):
    """Tenant hierarchy model."""

    tenant: Tenant = Field(..., description="Tenant information")
    children: List["TenantHierarchy"] = Field(
        default_factory=list, description="Child tenants"
    )
    depth: int = Field(0, description="Hierarchy depth")

    @property
    def total_tenants(self) -> int:
        """Get total number of tenants in hierarchy."""
        count = 1
        for child in self.children:
            count += child.total_tenants
        return count

    def find_tenant(self, tenant_id: str) -> Optional["TenantHierarchy"]:
        """Find tenant in hierarchy."""
        if self.tenant.id == tenant_id:
            return self

        for child in self.children:
            found = child.find_tenant(tenant_id)
            if found:
                return found

        return None

    def get_all_descendants(self) -> List[str]:
        """Get all descendant tenant IDs."""
        ids = []
        for child in self.children:
            ids.append(child.tenant.id)
            ids.extend(child.get_all_descendants())
        return ids


class TenantUsage(BaseModel):
    """Tenant usage statistics model."""

    tenant_id: str = Field(..., description="Tenant ID")
    period: str = Field(..., description="Usage period")

    # User metrics
    active_users: int = Field(0, description="Active users")
    total_users: int = Field(0, description="Total users")
    new_users: int = Field(0, description="New users in period")

    # Document metrics
    documents_uploaded: int = Field(0, description="Documents uploaded")
    documents_processed: int = Field(0, description="Documents processed")
    total_documents: int = Field(0, description="Total documents")

    # Storage metrics
    storage_used_gb: float = Field(0.0, description="Storage used in GB")
    storage_quota_gb: float = Field(0.0, description="Storage quota in GB")
    storage_utilization: float = Field(
        0.0, description="Storage utilization percentage"
    )

    # API metrics
    api_calls: int = Field(0, description="API calls in period")
    api_quota: int = Field(0, description="API quota")
    api_utilization: float = Field(0.0, description="API utilization percentage")

    # LLM metrics
    llm_tokens_used: int = Field(0, description="LLM tokens used")
    llm_cost: float = Field(0.0, description="LLM cost")
    llm_quota_tokens: int = Field(0, description="LLM token quota")

    # RAG metrics
    rag_queries: int = Field(0, description="RAG queries")
    rag_quota: int = Field(0, description="RAG query quota")

    @validator("storage_utilization", always=True)
    def calculate_storage_utilization(cls, v, values):
        """Calculate storage utilization."""
        if "storage_used_gb" in values and "storage_quota_gb" in values:
            if values["storage_quota_gb"] > 0:
                return (values["storage_used_gb"] / values["storage_quota_gb"]) * 100
        return v

    @validator("api_utilization", always=True)
    def calculate_api_utilization(cls, v, values):
        """Calculate API utilization."""
        if "api_calls" in values and "api_quota" in values:
            if values["api_quota"] > 0:
                return (values["api_calls"] / values["api_quota"]) * 100
        return v


class TenantInvitation(BaseModel):
    """Tenant invitation model."""

    id: str = Field(..., description="Invitation ID")
    tenant_id: str = Field(..., description="Tenant ID")
    email: str = Field(..., description="Invited email")
    role: str = Field(..., description="Invited role")

    # Invitation details
    invited_by: str = Field(..., description="Who sent invitation")
    message: Optional[str] = Field(None, description="Invitation message")

    # Status
    status: Literal["pending", "accepted", "declined", "expired"] = Field(
        "pending", description="Invitation status"
    )

    # Timing
    created_at: datetime = Field(..., description="Creation time")
    expires_at: datetime = Field(..., description="Expiration time")
    responded_at: Optional[datetime] = Field(None, description="Response time")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional data"
    )

    @property
    def is_expired(self) -> bool:
        """Check if invitation is expired."""
        return datetime.utcnow() > self.expires_at


class TenantMember(BaseModel):
    """Tenant member model."""

    id: str = Field(..., description="Member ID")
    tenant_id: str = Field(..., description="Tenant ID")
    user_id: str = Field(..., description="User ID")

    # Member info
    email: str = Field(..., description="User email")
    name: str = Field(..., description="User name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")

    # Role and permissions
    role: str = Field(..., description="Member role")
    permissions: List[str] = Field(
        default_factory=list, description="Member permissions"
    )

    # Status
    status: Literal["active", "inactive", "pending"] = Field(
        "pending", description="Member status"
    )

    # Timestamps
    joined_at: Optional[datetime] = Field(None, description="Join date")
    last_active_at: Optional[datetime] = Field(None, description="Last activity")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional data"
    )

    @property
    def is_active(self) -> bool:
        """Check if member is active."""
        return self.status == "active"
