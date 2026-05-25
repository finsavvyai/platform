"""
Tenant-related models for the RAG service.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator
from sqlalchemy import JSONB, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class TenantStatus(str, Enum):
    """Tenant status enumeration."""

    TRIAL = "trial"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class Tenant(Base, TimestampMixin):
    """Tenant model representing a multi-tenant organization."""

    __tablename__ = "tenants"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Basic information
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, comment="Organization name"
    )
    domain: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Organization domain",
    )

    # Status and subscription
    status: Mapped[TenantStatus] = mapped_column(
        String(50),
        nullable=False,
        default=TenantStatus.TRIAL,
        index=True,
        comment="Tenant status",
    )
    subscription_tier: Mapped[str] = mapped_column(
        String(50), nullable=False, default="basic", comment="Subscription tier"
    )

    # Configuration and settings
    config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, comment="Tenant-specific configuration"
    )
    settings: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, comment="Tenant settings and preferences"
    )

    # Contact and billing information
    contact_email: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Contact email address"
    )
    billing_info: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, comment="Billing information"
    )

    # Data residency and compliance
    data_region: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="us-east-1",
        comment="Primary data region for residency compliance",
    )
    compliance_requirements: Mapped[List[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="List of compliance frameworks (e.g., GDPR, HIPAA)",
    )

    # Resource limits and policies
    resource_limits: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=lambda: {
            "users": 10,
            "documents": 1000,
            "storage_gb": 10,
            "tokens_per_month": 100000,
        },
        nullable=False,
        comment="Resource usage limits",
    )
    retention_policy: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=lambda: {
            "documents": 2555,  # 7 years in days
            "audit_logs": 365,  # 1 year in days
            "sessions": 30,  # 30 days
        },
        nullable=False,
        comment="Data retention policies",
    )

    # Metadata
    metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, comment="Additional metadata"
    )

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    documents = relationship(
        "Document", back_populates="tenant", cascade="all, delete-orphan"
    )
    api_keys = relationship(
        "APIKey", back_populates="tenant", cascade="all, delete-orphan"
    )
    policies = relationship(
        "Policy", back_populates="tenant", cascade="all, delete-orphan"
    )
    document_chunks = relationship(
        "DocumentChunk", back_populates="tenant", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name={self.name}, status={self.status})>"

    @property
    def is_active(self) -> bool:
        """Check if tenant is active."""
        return self.status == TenantStatus.ACTIVE

    @property
    def is_suspended(self) -> bool:
        """Check if tenant is suspended."""
        return self.status == TenantStatus.SUSPENDED

    def get_resource_limit(self, key: str, default: int = 0) -> int:
        """Get a specific resource limit with fallback."""
        return self.resource_limits.get(key, default)

    @property
    def max_users(self) -> int:
        """Maximum number of users allowed."""
        return self.get_resource_limit("users", 10)

    @property
    def max_documents(self) -> int:
        """Maximum number of documents allowed."""
        return self.get_resource_limit("documents", 1000)

    @property
    def max_storage_gb(self) -> int:
        """Maximum storage in GB allowed."""
        return self.get_resource_limit("storage_gb", 10)

    @property
    def max_tokens_per_month(self) -> int:
        """Maximum tokens per month allowed."""
        return self.get_resource_limit("tokens_per_month", 100000)

    def has_compliance_requirement(self, requirement: str) -> bool:
        """Check if tenant has a specific compliance requirement."""
        return requirement in self.compliance_requirements

    def can_create_user(self, current_user_count: int) -> bool:
        """Check if tenant can create more users."""
        return current_user_count < self.max_users

    def can_create_document(self, current_document_count: int) -> bool:
        """Check if tenant can create more documents."""
        return current_document_count < self.max_documents

    def can_use_storage(self, current_storage_gb: int) -> bool:
        """Check if tenant can use more storage."""
        return current_storage_gb < self.max_storage_gb

    def can_use_tokens(self, current_token_usage: int) -> bool:
        """Check if tenant can use more tokens."""
        return current_token_usage < self.max_tokens_per_month


# Pydantic schemas for API
class TenantBase(BaseModel):
    """Base tenant schema."""

    name: str = Field(..., min_length=1, max_length=255)
    domain: str = Field(..., min_length=1, max_length=255)
    contact_email: Optional[str] = Field(
        None, regex=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    )
    subscription_tier: str = Field(default="basic")
    data_region: str = Field(default="us-east-1")
    compliance_requirements: List[str] = Field(default_factory=list)


class TenantCreate(TenantBase):
    """Schema for creating a tenant."""

    config: Dict[str, Any] = Field(default_factory=dict)
    settings: Dict[str, Any] = Field(default_factory=dict)
    billing_info: Dict[str, Any] = Field(default_factory=dict)
    resource_limits: Optional[Dict[str, Any]] = None
    retention_policy: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    domain: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[TenantStatus] = None
    contact_email: Optional[str] = Field(
        None, regex=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    )
    subscription_tier: Optional[str] = None
    data_region: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    billing_info: Optional[Dict[str, Any]] = None
    compliance_requirements: Optional[List[str]] = None
    resource_limits: Optional[Dict[str, Any]] = None
    retention_policy: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class TenantResponse(TenantBase):
    """Schema for tenant response."""

    id: uuid.UUID
    status: TenantStatus
    config: Dict[str, Any]
    settings: Dict[str, Any]
    billing_info: Dict[str, Any]
    resource_limits: Dict[str, Any]
    retention_policy: Dict[str, Any]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    """Schema for tenant list response."""

    tenants: List[TenantResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool


# Tenant usage statistics
class TenantUsageStats(BaseModel):
    """Tenant usage statistics."""

    tenant_id: uuid.UUID
    user_count: int
    document_count: int
    total_storage_gb: float
    monthly_token_usage: int
    api_key_count: int
    policy_count: int

    # Resource limit percentages
    users_usage_percentage: float
    documents_usage_percentage: float
    storage_usage_percentage: float
    tokens_usage_percentage: float

    @classmethod
    def from_database_stats(cls, stats: Dict[str, Any]) -> "TenantUsageStats":
        """Create usage stats from database query results."""
        tenant = stats.get("tenant")
        if not tenant:
            raise ValueError("Tenant information required")

        return cls(
            tenant_id=tenant.id,
            user_count=stats.get("user_count", 0),
            document_count=stats.get("document_count", 0),
            total_storage_gb=stats.get("total_storage_gb", 0),
            monthly_token_usage=stats.get("monthly_token_usage", 0),
            api_key_count=stats.get("api_key_count", 0),
            policy_count=stats.get("policy_count", 0),
            users_usage_percentage=(
                (stats.get("user_count", 0) / tenant.max_users) * 100
                if tenant.max_users > 0
                else 0
            ),
            documents_usage_percentage=(
                (stats.get("document_count", 0) / tenant.max_documents) * 100
                if tenant.max_documents > 0
                else 0
            ),
            storage_usage_percentage=(
                (stats.get("total_storage_gb", 0) / tenant.max_storage_gb) * 100
                if tenant.max_storage_gb > 0
                else 0
            ),
            tokens_usage_percentage=(
                (stats.get("monthly_token_usage", 0) / tenant.max_tokens_per_month)
                * 100
                if tenant.max_tokens_per_month > 0
                else 0
            ),
        )
