"""
Pydantic validation schemas for the RAG service.

This module provides Pydantic models for request/response validation,
data serialization, and API documentation with proper type annotations
and validation rules.
"""

import datetime
import uuid
from typing import Any, Dict, List, Optional, Literal
from decimal import Decimal

from pydantic import (
    BaseModel,
    Field,
    EmailStr,
    validator,
    constr,
    confloat,
    conint,
)

# Import enums from models
from ..models import (
    TenantStatus,
    UserRole,
    DocumentStatus,
    EncryptionAlgorithm,
    DataClassification,
)


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    class Config:
        orm_mode = True
        use_enum_values = True
        validate_assignment = True
        allow_population_by_field_name = True


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields."""

    created_at: datetime.datetime = Field(..., description="Creation timestamp")
    updated_at: datetime.datetime = Field(..., description="Last update timestamp")


class UUIDSchema(BaseSchema):
    """Schema with UUID primary key."""

    id: uuid.UUID = Field(..., description="Unique identifier")


class TenantScopedSchema(BaseSchema):
    """Schema for tenant-aware resources."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")


# Pagination schemas
class PaginationParams(BaseModel):
    """Pagination parameters for list requests."""

    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")
    sort_by: Optional[str] = Field(default=None, description="Sort field")
    sort_desc: bool = Field(default=False, description="Sort in descending order")

    @property
    def offset(self) -> int:
        """Calculate offset for database query."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """Get limit for database query."""
        return self.page_size


class PaginatedResponse(BaseModel):
    """Generic paginated response."""

    items: List[Any] = Field(..., description="List of items")
    total: int = Field(..., ge=0, description="Total number of items")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, description="Items per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")
    has_next: bool = Field(..., description="Has next page")
    has_prev: bool = Field(..., description="Has previous page")


# Tenant schemas
class TenantBase(BaseSchema):
    """Base tenant schema."""

    name: constr(min_length=1, max_length=255) = Field(..., description="Tenant name")
    domain: constr(min_length=1, max_length=255) = Field(
        ..., description="Unique domain identifier"
    )
    status: TenantStatus = Field(
        default=TenantStatus.TRIAL, description="Tenant status"
    )
    subscription_tier: constr(max_length=50) = Field(
        default="basic", description="Subscription tier"
    )
    data_region: constr(max_length=50) = Field(
        default="us-east-1", description="Data storage region"
    )
    contact_email: Optional[EmailStr] = Field(None, description="Contact email address")
    config: Dict[str, Any] = Field(
        default_factory=dict, description="Tenant configuration"
    )
    settings: Dict[str, Any] = Field(
        default_factory=dict, description="Tenant settings"
    )
    billing_info: Dict[str, Any] = Field(
        default_factory=dict, description="Billing information"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    retention_policy: Dict[str, Any] = Field(
        default_factory=dict, description="Data retention policy"
    )
    resource_limits: Dict[str, Any] = Field(
        default_factory=dict, description="Resource limits"
    )
    compliance_requirements: Dict[str, Any] = Field(
        default_factory=dict, description="Compliance requirements"
    )

    @validator("domain")
    def validate_domain(cls, v):
        """Validate domain format."""
        import re

        domain_pattern = r"^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$"
        if not re.match(domain_pattern, v):
            raise ValueError("Invalid domain format")
        return v.lower()


class TenantCreate(TenantBase):
    """Schema for creating a tenant."""

    pass


class TenantUpdate(BaseSchema):
    """Schema for updating a tenant."""

    name: Optional[constr(min_length=1, max_length=255)] = Field(
        None, description="Tenant name"
    )
    status: Optional[TenantStatus] = Field(None, description="Tenant status")
    subscription_tier: Optional[constr(max_length=50)] = Field(
        None, description="Subscription tier"
    )
    contact_email: Optional[EmailStr] = Field(None, description="Contact email address")
    config: Optional[Dict[str, Any]] = Field(None, description="Tenant configuration")
    settings: Optional[Dict[str, Any]] = Field(None, description="Tenant settings")
    billing_info: Optional[Dict[str, Any]] = Field(
        None, description="Billing information"
    )
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    retention_policy: Optional[Dict[str, Any]] = Field(
        None, description="Data retention policy"
    )
    resource_limits: Optional[Dict[str, Any]] = Field(
        None, description="Resource limits"
    )
    compliance_requirements: Optional[Dict[str, Any]] = Field(
        None, description="Compliance requirements"
    )


class TenantResponse(UUIDSchema, TimestampSchema, TenantBase):
    """Schema for tenant response."""

    users_count: Optional[int] = Field(None, description="Number of users")
    documents_count: Optional[int] = Field(None, description="Number of documents")
    is_active: bool = Field(..., description="Whether tenant is active")

    @validator("is_active", pre=True, always=True)
    def set_is_active(cls, v, values):
        """Set is_active based on status."""
        status = values.get("status")
        return status == TenantStatus.ACTIVE


class TenantStats(BaseSchema):
    """Tenant statistics."""

    total_users: int = Field(..., ge=0, description="Total users")
    active_users: int = Field(..., ge=0, description="Active users")
    total_documents: int = Field(..., ge=0, description="Total documents")
    processed_documents: int = Field(..., ge=0, description="Processed documents")
    total_storage: int = Field(..., ge=0, description="Total storage in bytes")
    total_tokens: int = Field(..., ge=0, description="Total tokens consumed")
    total_cost: Decimal = Field(..., ge=0, description="Total cost in USD")
    active_api_keys: int = Field(..., ge=0, description="Active API keys")
    active_policies: int = Field(..., ge=0, description="Active policies")
    last_activity: Optional[datetime.datetime] = Field(
        None, description="Last user activity"
    )


# User schemas
class UserBase(BaseSchema):
    """Base user schema."""

    email: EmailStr = Field(..., description="User email address")
    role: UserRole = Field(default=UserRole.USER, description="User role")
    permissions: List[str] = Field(default_factory=list, description="User permissions")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="User metadata")
    is_active: bool = Field(default=True, description="Account status")
    mfa_enabled: bool = Field(default=False, description="MFA enabled status")
    email_verified: bool = Field(default=False, description="Email verification status")
    phone_number: Optional[constr(max_length=20)] = Field(
        None, description="Phone number"
    )
    phone_verified: bool = Field(default=False, description="Phone verification status")
    profile: Dict[str, Any] = Field(default_factory=dict, description="User profile")
    preferences: Dict[str, Any] = Field(
        default_factory=dict, description="User preferences"
    )


class UserCreate(UserBase):
    """Schema for creating a user."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")
    password: constr(min_length=12) = Field(..., description="Password")
    confirm_password: str = Field(..., description="Confirm password")

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        """Validate that passwords match."""
        if "password" in values and v != values["password"]:
            raise ValueError("Passwords do not match")
        return v

    @validator("password")
    def validate_password_strength(cls, v):
        """Validate password strength."""
        import re

        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters long")

        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")

        return v


class UserUpdate(BaseSchema):
    """Schema for updating a user."""

    role: Optional[UserRole] = Field(None, description="User role")
    permissions: Optional[List[str]] = Field(None, description="User permissions")
    metadata: Optional[Dict[str, Any]] = Field(None, description="User metadata")
    is_active: Optional[bool] = Field(None, description="Account status")
    email_verified: Optional[bool] = Field(
        None, description="Email verification status"
    )
    phone_number: Optional[constr(max_length=20)] = Field(
        None, description="Phone number"
    )
    phone_verified: Optional[bool] = Field(
        None, description="Phone verification status"
    )
    profile: Optional[Dict[str, Any]] = Field(None, description="User profile")
    preferences: Optional[Dict[str, Any]] = Field(None, description="User preferences")


class UserPasswordUpdate(BaseSchema):
    """Schema for updating user password."""

    current_password: str = Field(..., description="Current password")
    new_password: constr(min_length=12) = Field(..., description="New password")
    confirm_password: str = Field(..., description="Confirm new password")

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        """Validate that passwords match."""
        if "new_password" in values and v != values["new_password"]:
            raise ValueError("Passwords do not match")
        return v

    @validator("new_password")
    def validate_password_strength(cls, v):
        """Validate password strength."""
        import re

        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters long")

        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")

        return v


class UserResponse(UUIDSchema, TimestampSchema, TenantScopedSchema, UserBase):
    """Schema for user response."""

    last_login: Optional[datetime.datetime] = Field(
        None, description="Last login timestamp"
    )
    failed_login_attempts: int = Field(
        default=0, ge=0, description="Failed login attempts"
    )
    locked_until: Optional[datetime.datetime] = Field(
        None, description="Account lock expiration"
    )
    is_locked: bool = Field(..., description="Whether account is locked")
    is_admin: bool = Field(..., description="Whether user has admin role")

    @validator("is_locked", pre=True, always=True)
    def set_is_locked(cls, v, values):
        """Set is_locked based on locked_until."""
        locked_until = values.get("locked_until")
        if locked_until is None:
            return False
        return datetime.datetime.utcnow() < locked_until

    @validator("is_admin", pre=True, always=True)
    def set_is_admin(cls, v, values):
        """Set is_admin based on role."""
        role = values.get("role")
        return role in [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]


class UserStats(BaseSchema):
    """User statistics."""

    total_users: int = Field(..., ge=0, description="Total users")
    active_users: int = Field(..., ge=0, description="Active users")
    locked_users: int = Field(..., ge=0, description="Locked users")
    email_verified: int = Field(..., ge=0, description="Email verified users")
    mfa_enabled: int = Field(..., ge=0, description="MFA enabled users")
    failed_logins: int = Field(..., ge=0, description="Failed logins today")
    new_users: int = Field(..., ge=0, description="New users today")


# Document schemas
class DocumentBase(BaseSchema):
    """Base document schema."""

    filename: constr(min_length=1, max_length=1000) = Field(
        ..., description="System filename"
    )
    original_filename: constr(min_length=1, max_length=1000) = Field(
        ..., description="Original filename"
    )
    content_type: constr(min_length=1, max_length=255) = Field(
        ..., description="MIME content type"
    )
    file_size: conint(gt=0) = Field(..., description="File size in bytes")
    checksum: constr(length=64) = Field(..., description="SHA-256 checksum")
    storage_path: constr(min_length=1, max_length=1000) = Field(
        ..., description="Storage location"
    )
    storage_bucket: constr(min_length=1, max_length=255) = Field(
        ..., description="Storage bucket"
    )
    storage_provider: constr(max_length=50) = Field(
        default="r2", description="Storage provider"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Document metadata"
    )
    encryption_key_id: Optional[constr(max_length=255)] = Field(
        None, description="Encryption key identifier"
    )
    encryption_algorithm: EncryptionAlgorithm = Field(
        default=EncryptionAlgorithm.AES_256_GCM, description="Encryption algorithm"
    )
    retention_policy: Dict[str, Any] = Field(
        default_factory=dict, description="Retention policy"
    )
    access_level: constr(max_length=50) = Field(
        default="private", description="Access level"
    )
    tags: List[str] = Field(default_factory=list, description="Document tags")
    classification: DataClassification = Field(
        default=DataClassification.INTERNAL, description="Data classification"
    )
    content_hash: Optional[constr(length=64)] = Field(
        None, description="Content checksum"
    )
    language: constr(max_length=10) = Field(
        default="en", description="Document language"
    )


class DocumentCreate(DocumentBase):
    """Schema for creating a document."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")
    created_by: uuid.UUID = Field(..., description="Creator user ID")


class DocumentUpdate(BaseSchema):
    """Schema for updating a document."""

    metadata: Optional[Dict[str, Any]] = Field(None, description="Document metadata")
    retention_policy: Optional[Dict[str, Any]] = Field(
        None, description="Retention policy"
    )
    access_level: Optional[constr(max_length=50)] = Field(
        None, description="Access level"
    )
    tags: Optional[List[str]] = Field(None, description="Document tags")
    classification: Optional[DataClassification] = Field(
        None, description="Data classification"
    )
    language: Optional[constr(max_length=10)] = Field(
        None, description="Document language"
    )


class DocumentResponse(UUIDSchema, TimestampSchema, TenantScopedSchema, DocumentBase):
    """Schema for document response."""

    extraction_status: DocumentStatus = Field(..., description="Text extraction status")
    processing_status: DocumentStatus = Field(..., description="Processing status")
    dlp_status: DocumentStatus = Field(..., description="DLP scan status")
    created_by: uuid.UUID = Field(..., description="Creator user ID")
    processing_duration_ms: Optional[int] = Field(
        None, ge=0, description="Processing time in milliseconds"
    )
    overall_status: DocumentStatus = Field(..., description="Overall processing status")
    is_processing_complete: bool = Field(
        ..., description="Whether processing is complete"
    )
    is_retention_expired: bool = Field(
        ..., description="Whether retention period has expired"
    )
    compliance_level: str = Field(..., description="Compliance level")

    @validator("overall_status", pre=True, always=True)
    def set_overall_status(cls, v, values):
        """Set overall status based on individual statuses."""
        extraction = values.get("extraction_status")
        processing = values.get("processing_status")
        dlp = values.get("dlp_status")

        if all(s == DocumentStatus.COMPLETED for s in [extraction, processing, dlp]):
            return DocumentStatus.COMPLETED
        elif any(s == DocumentStatus.FAILED for s in [extraction, processing, dlp]):
            return DocumentStatus.FAILED
        elif any(s == DocumentStatus.PROCESSING for s in [extraction, processing, dlp]):
            return DocumentStatus.PROCESSING
        else:
            return DocumentStatus.PENDING

    @validator("is_processing_complete", pre=True, always=True)
    def set_is_processing_complete(cls, v, values):
        """Set processing complete status."""
        overall_status = values.get("overall_status")
        return overall_status == DocumentStatus.COMPLETED


class DocumentStats(BaseSchema):
    """Document statistics."""

    total_documents: int = Field(..., ge=0, description="Total documents")
    processed_documents: int = Field(..., ge=0, description="Processed documents")
    pending_documents: int = Field(..., ge=0, description="Pending documents")
    failed_documents: int = Field(..., ge=0, description="Failed documents")
    total_size: int = Field(..., ge=0, description="Total size in bytes")
    average_size: int = Field(..., ge=0, description="Average size in bytes")
    total_chunks: int = Field(..., ge=0, description="Total chunks")
    embedded_chunks: int = Field(..., ge=0, description="Embedded chunks")
    pending_embeddings: int = Field(..., ge=0, description="Pending embeddings")


class StorageStats(BaseSchema):
    """Storage statistics."""

    total_used: int = Field(..., ge=0, description="Total used bytes")
    documents_size: int = Field(..., ge=0, description="Documents size bytes")
    chunks_size: int = Field(..., ge=0, description="Chunks size bytes")
    available: int = Field(..., ge=0, description="Available bytes")
    usage_percent: confloat(ge=0, le=100) = Field(..., description="Usage percentage")


# Document chunk schemas
class DocumentChunkBase(BaseSchema):
    """Base document chunk schema."""

    document_id: uuid.UUID = Field(..., description="Document identifier")
    chunk_index: conint(ge=0) = Field(..., description="Chunk order within document")
    content: constr(min_length=1) = Field(..., description="Chunk text content")
    content_length: conint(gt=0) = Field(
        ..., description="Content length in characters"
    )
    chunk_type: constr(max_length=50) = Field(
        default="text", description="Type of chunk content"
    )
    embedding_model: Optional[constr(max_length=100)] = Field(
        None, description="Embedding model used"
    )
    embedding_dimensions: Optional[conint(gt=0)] = Field(
        None, description="Vector dimensions"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk metadata")
    processing_time_ms: Optional[int] = Field(
        None, ge=0, description="Processing time in milliseconds"
    )
    checksum: constr(length=64) = Field(..., description="Content checksum")
    token_count: Optional[int] = Field(None, ge=0, description="Estimated token count")
    source_page_number: Optional[int] = Field(
        None, ge=1, description="Source page number"
    )
    source_section: Optional[constr(max_length=255)] = Field(
        None, description="Source section name"
    )
    language: constr(max_length=10) = Field(
        default="en", description="Content language"
    )


class DocumentChunkCreate(DocumentChunkBase):
    """Schema for creating a document chunk."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")


class DocumentChunkUpdate(BaseSchema):
    """Schema for updating a document chunk."""

    chunk_type: Optional[constr(max_length=50)] = Field(
        None, description="Type of chunk content"
    )
    metadata: Optional[Dict[str, Any]] = Field(None, description="Chunk metadata")
    token_count: Optional[int] = Field(None, ge=0, description="Estimated token count")
    source_page_number: Optional[int] = Field(
        None, ge=1, description="Source page number"
    )
    source_section: Optional[constr(max_length=255)] = Field(
        None, description="Source section name"
    )
    language: Optional[constr(max_length=10)] = Field(
        None, description="Content language"
    )


class DocumentChunkResponse(
    UUIDSchema, TimestampSchema, TenantScopedSchema, DocumentChunkBase
):
    """Schema for document chunk response."""

    embedding_status: DocumentStatus = Field(
        ..., description="Embedding processing status"
    )
    has_embedding: bool = Field(..., description="Whether chunk has embedding")
    needs_embedding: bool = Field(..., description="Whether chunk needs embedding")
    is_embedding_complete: bool = Field(
        ..., description="Whether embedding is complete"
    )
    content_preview: str = Field(..., description="Content preview")

    @validator("has_embedding", pre=True, always=True)
    def set_has_embedding(cls, v, values):
        """Set has_embedding based on embedding field."""
        return values.get("embedding") is not None

    @validator("needs_embedding", pre=True, always=True)
    def set_needs_embedding(cls, v, values):
        """Set needs_embedding based on embedding status."""
        status = values.get("embedding_status")
        return status in [DocumentStatus.PENDING, DocumentStatus.FAILED]

    @validator("is_embedding_complete", pre=True, always=True)
    def set_is_embedding_complete(cls, v, values):
        """Set is_embedding_complete based on status and embedding."""
        status = values.get("embedding_status")
        has_embedding = values.get("has_embedding")
        return status == DocumentStatus.COMPLETED and has_embedding

    @validator("content_preview", pre=True, always=True)
    def set_content_preview(cls, v, values):
        """Set content preview."""
        content = values.get("content", "")
        if len(content) <= 100:
            return content
        return content[:100] + "..."


class ChunkStats(BaseSchema):
    """Chunk statistics."""

    total_chunks: int = Field(..., ge=0, description="Total chunks")
    embedded_chunks: int = Field(..., ge=0, description="Embedded chunks")
    pending_embeddings: int = Field(..., ge=0, description="Pending embeddings")
    failed_embeddings: int = Field(..., ge=0, description="Failed embeddings")
    total_tokens: int = Field(..., ge=0, description="Total tokens")
    average_chunk_size: int = Field(..., ge=0, description="Average chunk size")
    average_token_count: int = Field(..., ge=0, description="Average token count")


class EmbeddingProgress(BaseSchema):
    """Embedding progress statistics."""

    total: int = Field(..., ge=0, description="Total chunks")
    completed: int = Field(..., ge=0, description="Completed chunks")
    pending: int = Field(..., ge=0, description="Pending chunks")
    failed: int = Field(..., ge=0, description="Failed chunks")
    in_progress: int = Field(..., ge=0, description="In progress chunks")
    percent: confloat(ge=0, le=100) = Field(..., description="Percentage complete")


# API Key schemas
class APIKeyBase(BaseSchema):
    """Base API key schema."""

    name: constr(min_length=1, max_length=255) = Field(..., description="API key name")
    expires_at: Optional[datetime.datetime] = Field(
        None, description="Expiration timestamp"
    )
    max_usage: Optional[conint(gt=0)] = Field(None, description="Maximum usage count")
    permissions: List[str] = Field(
        default_factory=list, description="API key permissions"
    )
    rate_limit: conint(ge=0) = Field(default=1000, description="Rate limit per hour")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class APIKeyCreate(APIKeyBase):
    """Schema for creating an API key."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")


class APIKeyUpdate(BaseSchema):
    """Schema for updating an API key."""

    name: Optional[constr(min_length=1, max_length=255)] = Field(
        None, description="API key name"
    )
    expires_at: Optional[datetime.datetime] = Field(
        None, description="Expiration timestamp"
    )
    max_usage: Optional[conint(gt=0)] = Field(None, description="Maximum usage count")
    permissions: Optional[List[str]] = Field(None, description="API key permissions")
    rate_limit: Optional[conint(ge=0)] = Field(None, description="Rate limit per hour")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class APIKeyResponse(UUIDSchema, TimestampSchema, TenantScopedSchema, APIKeyBase):
    """Schema for API key response."""

    key_prefix: str = Field(..., description="API key prefix")
    is_active: bool = Field(..., description="Whether API key is active")
    last_used: Optional[datetime.datetime] = Field(
        None, description="Last used timestamp"
    )
    usage_count: int = Field(..., ge=0, description="Usage count")
    is_expired: bool = Field(..., description="Whether API key is expired")
    is_usage_exceeded: bool = Field(..., description="Whether usage limit exceeded")
    is_valid: bool = Field(..., description="Whether API key is valid")
    usage_percentage: confloat(ge=0, le=100) = Field(
        ..., description="Usage percentage"
    )

    @validator("is_expired", pre=True, always=True)
    def set_is_expired(cls, v, values):
        """Set is_expired based on expires_at."""
        expires_at = values.get("expires_at")
        if expires_at is None:
            return False
        return datetime.datetime.utcnow() > expires_at

    @validator("is_usage_exceeded", pre=True, always=True)
    def set_is_usage_exceeded(cls, v, values):
        """Set is_usage_exceeded based on usage and max_usage."""
        usage_count = values.get("usage_count", 0)
        max_usage = values.get("max_usage")
        if max_usage is None or max_usage <= 0:
            return False
        return usage_count >= max_usage

    @validator("is_valid", pre=True, always=True)
    def set_is_valid(cls, v, values):
        """Set is_valid based on multiple factors."""
        is_active = values.get("is_active", True)
        is_expired = values.get("is_expired", False)
        is_usage_exceeded = values.get("is_usage_exceeded", False)
        return is_active and not is_expired and not is_usage_exceeded

    @validator("usage_percentage", pre=True, always=True)
    def set_usage_percentage(cls, v, values):
        """Set usage percentage."""
        usage_count = values.get("usage_count", 0)
        max_usage = values.get("max_usage")
        if max_usage is None or max_usage <= 0:
            return 0.0
        return (usage_count / max_usage) * 100.0


# Search schemas
class VectorSearchRequest(BaseSchema):
    """Vector search request."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")
    query_vector: List[float] = Field(..., min_items=1, description="Query vector")
    limit: conint(ge=1, le=100) = Field(default=10, description="Maximum results")
    threshold: confloat(ge=0, le=1) = Field(
        default=0.7, description="Similarity threshold"
    )
    filters: Optional[Dict[str, Any]] = Field(None, description="Additional filters")


class HybridSearchRequest(BaseSchema):
    """Hybrid search request."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")
    query_text: constr(min_length=1) = Field(..., description="Query text")
    query_vector: Optional[List[float]] = Field(
        None, min_items=1, description="Query vector"
    )
    limit: conint(ge=1, le=100) = Field(default=10, description="Maximum results")
    vector_weight: confloat(ge=0, le=1) = Field(
        default=0.7, description="Vector search weight"
    )
    text_weight: confloat(ge=0, le=1) = Field(
        default=0.3, description="Text search weight"
    )
    filters: Optional[Dict[str, Any]] = Field(None, description="Additional filters")


class SearchResult(BaseSchema):
    """Single search result."""

    chunk_id: uuid.UUID = Field(..., description="Chunk identifier")
    document_id: uuid.UUID = Field(..., description="Document identifier")
    document_title: Optional[str] = Field(None, description="Document title")
    content: str = Field(..., description="Chunk content")
    score: confloat(ge=0, le=1) = Field(..., description="Relevance score")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class SearchResponse(BaseModel):
    """Search response."""

    results: List[SearchResult] = Field(..., description="Search results")
    total: int = Field(..., ge=0, description="Total results found")
    query_time_ms: int = Field(..., ge=0, description="Query time in milliseconds")
    has_more: bool = Field(..., description="Has more results")


# Health check schemas
class HealthCheckResponse(BaseModel):
    """Health check response."""

    status: Literal["healthy", "unhealthy", "degraded"] = Field(
        ..., description="Overall health status"
    )
    timestamp: datetime.datetime = Field(..., description="Check timestamp")
    checks: Dict[str, Any] = Field(..., description="Individual health checks")
    uptime_seconds: float = Field(..., ge=0, description="Service uptime in seconds")
    version: str = Field(..., description="Service version")

    class Config:
        use_enum_values = True


class DatabaseHealthCheck(BaseModel):
    """Database health check result."""

    status: Literal["healthy", "unhealthy"] = Field(..., description="Database status")
    response_time_ms: int = Field(
        ..., ge=0, description="Response time in milliseconds"
    )
    connections: Dict[str, int] = Field(..., description="Connection statistics")
    last_check: datetime.datetime = Field(..., description="Last check timestamp")
    error: Optional[str] = Field(None, description="Error message if unhealthy")


# Error response schemas
class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Error details")
    timestamp: datetime.datetime = Field(..., description="Error timestamp")
    request_id: Optional[str] = Field(None, description="Request identifier")


class ValidationErrorResponse(BaseModel):
    """Validation error response."""

    error: str = Field(default="validation_error", description="Error type")
    message: str = Field(default="Validation failed", description="Error message")
    validation_errors: Dict[str, List[str]] = Field(
        ..., description="Field validation errors"
    )
    timestamp: datetime.datetime = Field(..., description="Error timestamp")
    request_id: Optional[str] = Field(None, description="Request identifier")
