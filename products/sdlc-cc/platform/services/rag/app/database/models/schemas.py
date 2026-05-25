"""
Pydantic validation models for the RAG service.

This module defines Pydantic models for request/response validation,
serialization, and API documentation. These models work alongside
the SQLAlchemy models to provide robust data validation.
"""

import datetime
import uuid
from typing import Any, Dict, List, Optional, Union
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict, EmailStr, validator, model_validator
from pydantic_core import ValidationError


# Enums matching SQLAlchemy enums
class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    DELETED = "deleted"


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    TENANT_ADMIN = "tenant_admin"
    DATA_SCIENTIST = "data_scientist"
    ANALYST = "analyst"
    VIEWER = "viewer"
    USER = "user"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PolicyType(str, Enum):
    AUTH = "auth"
    DATA_ACCESS = "data_access"
    DLP = "dlp"
    COST = "cost"
    COMPLIANCE = "compliance"


class EncryptionAlgorithm(str, Enum):
    AES_256_GCM = "aes-256-gcm"
    AES_256_CBC = "aes-256-cbc"
    CHACHA20_POLY1305 = "chacha20-poly1305"


class DataClassification(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class AuditAction(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    ACCESS_DENIED = "access_denied"


# Base models
class BaseResponse(BaseModel):
    """Base response model with common fields."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
        use_enum_values=True,
    )


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""

    created_at: datetime.datetime = Field(..., description="Creation timestamp")
    updated_at: datetime.datetime = Field(..., description="Last update timestamp")


class UUIDMixin(BaseModel):
    """Mixin for UUID primary key."""

    id: uuid.UUID = Field(..., description="Unique identifier")


class TenantMixin(BaseModel):
    """Mixin for tenant-aware models."""

    tenant_id: uuid.UUID = Field(..., description="Tenant identifier")


# Request/Response Models
class TenantBase(BaseModel):
    """Base tenant model."""

    name: str = Field(..., min_length=1, max_length=255, description="Tenant name")
    domain: str = Field(..., min_length=3, max_length=255, description="Tenant domain")
    status: TenantStatus = Field(
        default=TenantStatus.TRIAL, description="Tenant status"
    )
    config: Dict[str, Any] = Field(
        default_factory=dict, description="Tenant configuration"
    )
    settings: Dict[str, Any] = Field(
        default_factory=dict, description="Tenant settings"
    )
    subscription_tier: str = Field(
        default="basic", max_length=50, description="Subscription tier"
    )
    data_region: str = Field(
        default="us-east-1", max_length=50, description="Data region"
    )
    contact_email: Optional[EmailStr] = Field(None, description="Contact email")
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
        if not v:
            raise ValueError("Domain is required")
        if not "." in v:
            raise ValueError("Domain must contain a dot")
        if v.startswith(".") or v.endswith("."):
            raise ValueError("Domain cannot start or end with a dot")
        return v.lower()


class TenantCreate(TenantBase):
    """Tenant creation request model."""

    pass


class TenantUpdate(BaseModel):
    """Tenant update request model."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[TenantStatus] = None
    config: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    subscription_tier: Optional[str] = Field(None, max_length=50)
    contact_email: Optional[EmailStr] = None
    billing_info: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    retention_policy: Optional[Dict[str, Any]] = None
    resource_limits: Optional[Dict[str, Any]] = None
    compliance_requirements: Optional[Dict[str, Any]] = None


class TenantResponse(TenantBase, UUIDMixin, TimestampMixin, BaseResponse):
    """Tenant response model."""

    users_count: Optional[int] = Field(None, description="Number of users")
    documents_count: Optional[int] = Field(None, description="Number of documents")
    is_active: bool = Field(..., description="Whether tenant is active")

    @validator("is_active", pre=True, always=True)
    def set_is_active(cls, v, values):
        """Set is_active based on status."""
        status = values.get("status")
        return status == TenantStatus.ACTIVE


class UserBase(BaseModel):
    """Base user model."""

    email: EmailStr = Field(..., description="User email")
    role: UserRole = Field(default=UserRole.USER, description="User role")
    permissions: List[str] = Field(default_factory=list, description="User permissions")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="User metadata")
    is_active: bool = Field(default=True, description="Account status")
    phone_number: Optional[str] = Field(None, max_length=20, description="Phone number")
    profile: Dict[str, Any] = Field(default_factory=dict, description="User profile")
    preferences: Dict[str, Any] = Field(
        default_factory=dict, description="User preferences"
    )


class UserCreate(UserBase):
    """User creation request model."""

    tenant_id: uuid.UUID = Field(..., description="Tenant ID")
    password: str = Field(..., min_length=12, description="Password")

    @validator("password")
    def validate_password(cls, v):
        """Validate password strength."""
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters long")

        has_upper = any(c.isupper() for c in v)
        has_lower = any(c.islower() for c in v)
        has_digit = any(c.isdigit() for c in v)
        has_special = any(c in '!@#$%^&*(),.?":{}|<>' for c in v)

        if not (has_upper and has_lower and has_digit and has_special):
            raise ValueError(
                "Password must contain uppercase, lowercase, digit, and special character"
            )

        return v


class UserUpdate(BaseModel):
    """User update request model."""

    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    permissions: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    phone_number: Optional[str] = Field(None, max_length=20)
    profile: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None


class UserResponse(UserBase, UUIDMixin, TenantMixin, TimestampMixin, BaseResponse):
    """User response model."""

    last_login: Optional[datetime.datetime] = Field(None, description="Last login time")
    mfa_enabled: bool = Field(..., description="MFA enabled status")
    email_verified: bool = Field(..., description="Email verification status")
    phone_verified: bool = Field(..., description="Phone verification status")
    failed_login_attempts: int = Field(..., description="Failed login attempts")
    locked_until: Optional[datetime.datetime] = Field(
        None, description="Account lock expiration"
    )

    # Computed fields
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


class UserLoginRequest(BaseModel):
    """User login request model."""

    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., description="Password")
    tenant_id: Optional[uuid.UUID] = Field(None, description="Tenant ID (optional)")
    remember_me: bool = Field(default=False, description="Remember me")


class UserLoginResponse(BaseModel):
    """User login response model."""

    access_token: str = Field(..., description="Access token")
    refresh_token: str = Field(..., description="Refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")
    user: UserResponse = Field(..., description="User information")


class DocumentBase(BaseModel):
    """Base document model."""

    filename: str = Field(
        ..., min_length=1, max_length=1000, description="System filename"
    )
    original_filename: str = Field(
        ..., min_length=1, max_length=1000, description="Original filename"
    )
    content_type: str = Field(..., max_length=255, description="MIME content type")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    checksum: str = Field(
        ..., min_length=64, max_length=64, description="SHA-256 checksum"
    )
    storage_path: str = Field(
        ..., min_length=1, max_length=1000, description="Storage path"
    )
    storage_bucket: str = Field(
        ..., min_length=1, max_length=255, description="Storage bucket"
    )
    storage_provider: str = Field(
        default="r2", max_length=50, description="Storage provider"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Document metadata"
    )
    encryption_key_id: Optional[str] = Field(
        None, max_length=255, description="Encryption key ID"
    )
    encryption_algorithm: EncryptionAlgorithm = Field(
        default=EncryptionAlgorithm.AES_256_GCM, description="Encryption algorithm"
    )
    retention_policy: Dict[str, Any] = Field(
        default_factory=dict, description="Retention policy"
    )
    access_level: str = Field(
        default="private", max_length=50, description="Access level"
    )
    tags: List[str] = Field(default_factory=list, description="Document tags")
    classification: DataClassification = Field(
        default=DataClassification.INTERNAL, description="Data classification"
    )
    content_hash: Optional[str] = Field(None, max_length=64, description="Content hash")
    language: str = Field(default="en", max_length=10, description="Document language")


class DocumentCreate(DocumentBase):
    """Document creation request model."""

    tenant_id: uuid.UUID = Field(..., description="Tenant ID")
    created_by: uuid.UUID = Field(..., description="Creator user ID")


class DocumentUpdate(BaseModel):
    """Document update request model."""

    metadata: Optional[Dict[str, Any]] = None
    retention_policy: Optional[Dict[str, Any]] = None
    access_level: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None
    classification: Optional[DataClassification] = None
    language: Optional[str] = Field(None, max_length=10)


class DocumentResponse(
    DocumentBase, UUIDMixin, TenantMixin, TimestampMixin, BaseResponse
):
    """Document response model."""

    created_by: uuid.UUID = Field(..., description="Creator user ID")
    extraction_status: DocumentStatus = Field(..., description="Text extraction status")
    processing_status: DocumentStatus = Field(..., description="Processing status")
    dlp_status: DocumentStatus = Field(..., description="DLP scan status")
    processing_duration_ms: Optional[int] = Field(
        None, description="Processing duration"
    )

    # Computed fields
    overall_status: DocumentStatus = Field(..., description="Overall processing status")
    is_processing_complete: bool = Field(
        ..., description="Whether processing is complete"
    )
    has_processing_failed: bool = Field(
        ..., description="Whether processing has failed"
    )
    is_retention_expired: bool = Field(..., description="Whether retention has expired")
    compliance_level: str = Field(..., description="Compliance level")

    @validator("overall_status", pre=True, always=True)
    def set_overall_status(cls, v, values):
        """Calculate overall status from individual statuses."""
        extraction = values.get("extraction_status")
        processing = values.get("processing_status")
        dlp = values.get("dlp_status")

        if (
            extraction == DocumentStatus.COMPLETED
            and processing == DocumentStatus.COMPLETED
            and dlp == DocumentStatus.COMPLETED
        ):
            return DocumentStatus.COMPLETED
        elif (
            extraction == DocumentStatus.FAILED
            or processing == DocumentStatus.FAILED
            or dlp == DocumentStatus.FAILED
        ):
            return DocumentStatus.FAILED
        elif (
            extraction == DocumentStatus.PROCESSING
            or processing == DocumentStatus.PROCESSING
            or dlp == DocumentStatus.PROCESSING
        ):
            return DocumentStatus.PROCESSING
        else:
            return DocumentStatus.PENDING

    @validator("is_processing_complete", pre=True, always=True)
    def set_is_processing_complete(cls, v, values):
        """Set processing complete flag."""
        overall_status = values.get("overall_status")
        return overall_status == DocumentStatus.COMPLETED

    @validator("has_processing_failed", pre=True, always=True)
    def set_has_processing_failed(cls, v, values):
        """Set processing failed flag."""
        overall_status = values.get("overall_status")
        return overall_status == DocumentStatus.FAILED

    @validator("is_retention_expired", pre=True, always=True)
    def set_is_retention_expired(cls, v, values):
        """Set retention expired flag (simplified)."""
        # In a real implementation, this would check actual retention policy
        return False

    @validator("compliance_level", pre=True, always=True)
    def set_compliance_level(cls, v, values):
        """Set compliance level based on classification."""
        classification = values.get("classification")
        mapping = {
            DataClassification.PUBLIC: "low",
            DataClassification.INTERNAL: "medium",
            DataClassification.CONFIDENTIAL: "high",
            DataClassification.RESTRICTED: "critical",
        }
        return mapping.get(classification, "medium")


class DocumentChunkBase(BaseModel):
    """Base document chunk model."""

    document_id: uuid.UUID = Field(..., description="Document ID")
    chunk_index: int = Field(..., ge=0, description="Chunk index")
    content: str = Field(..., min_length=1, description="Chunk content")
    content_length: int = Field(..., gt=0, description="Content length")
    chunk_type: str = Field(default="text", max_length=50, description="Chunk type")
    embedding_model: Optional[str] = Field(
        None, max_length=100, description="Embedding model"
    )
    embedding_dimensions: Optional[int] = Field(
        None, gt=0, description="Embedding dimensions"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk metadata")
    checksum: str = Field(
        ..., min_length=64, max_length=64, description="Content checksum"
    )
    token_count: Optional[int] = Field(None, ge=0, description="Token count")
    source_page_number: Optional[int] = Field(
        None, gt=0, description="Source page number"
    )
    source_section: Optional[str] = Field(
        None, max_length=255, description="Source section"
    )
    language: str = Field(default="en", max_length=10, description="Content language")


class DocumentChunkCreate(DocumentChunkBase):
    """Document chunk creation request model."""

    tenant_id: uuid.UUID = Field(..., description="Tenant ID")


class DocumentChunkUpdate(BaseModel):
    """Document chunk update request model."""

    metadata: Optional[Dict[str, Any]] = None
    source_page_number: Optional[int] = Field(None, gt=0)
    source_section: Optional[str] = Field(None, max_length=255)
    language: Optional[str] = Field(None, max_length=10)


class DocumentChunkResponse(
    DocumentChunkBase, UUIDMixin, TenantMixin, TimestampMixin, BaseResponse
):
    """Document chunk response model."""

    embedding_status: DocumentStatus = Field(..., description="Embedding status")
    processing_time_ms: Optional[int] = Field(None, description="Processing time")

    # Computed fields
    has_embedding: bool = Field(..., description="Whether chunk has embedding")
    needs_embedding: bool = Field(..., description="Whether chunk needs embedding")
    is_embedding_complete: bool = Field(
        ..., description="Whether embedding is complete"
    )
    content_preview: str = Field(..., description="Content preview")

    @validator("has_embedding", pre=True, always=True)
    def set_has_embedding(cls, v, values):
        """Set has_embedding flag."""
        embedding = values.get("embedding")
        return embedding is not None

    @validator("needs_embedding", pre=True, always=True)
    def set_needs_embedding(cls, v, values):
        """Set needs_embedding flag."""
        embedding_status = values.get("embedding_status")
        return embedding_status in [DocumentStatus.PENDING, DocumentStatus.FAILED]

    @validator("is_embedding_complete", pre=True, always=True)
    def set_is_embedding_complete(cls, v, values):
        """Set is_embedding_complete flag."""
        embedding_status = values.get("embedding_status")
        has_embedding = values.get("has_embedding")
        return embedding_status == DocumentStatus.COMPLETED and has_embedding

    @validator("content_preview", pre=True, always=True)
    def set_content_preview(cls, v, values):
        """Generate content preview."""
        content = values.get("content", "")
        max_length = 100
        if len(content) <= max_length:
            return content
        return content[:max_length] + "..."


class PolicyBase(BaseModel):
    """Base policy model."""

    name: str = Field(..., min_length=1, max_length=255, description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")
    type: PolicyType = Field(..., description="Policy type")
    rego_policy: str = Field(..., min_length=1, description="Rego policy code")
    version: int = Field(default=1, gt=0, description="Policy version")
    is_active: bool = Field(default=True, description="Policy status")
    priority: int = Field(default=100, ge=0, description="Policy priority")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Policy metadata"
    )
    test_cases: List[Dict[str, Any]] = Field(
        default_factory=list, description="Policy test cases"
    )
    dependencies: List[str] = Field(
        default_factory=list, description="Policy dependencies"
    )
    tags: List[str] = Field(default_factory=list, description="Policy tags")


class PolicyCreate(PolicyBase):
    """Policy creation request model."""

    tenant_id: uuid.UUID = Field(..., description="Tenant ID")
    created_by: uuid.UUID = Field(..., description="Creator user ID")


class PolicyUpdate(BaseModel):
    """Policy update request model."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    rego_policy: Optional[str] = Field(None, min_length=1)
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0)
    metadata: Optional[Dict[str, Any]] = None
    test_cases: Optional[List[Dict[str, Any]]] = None
    dependencies: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class PolicyResponse(PolicyBase, UUIDMixin, TenantMixin, TimestampMixin, BaseResponse):
    """Policy response model."""

    created_by: uuid.UUID = Field(..., description="Creator user ID")

    # Computed fields
    can_evaluate: bool = Field(..., description="Whether policy can be evaluated")

    @validator("can_evaluate", pre=True, always=True)
    def set_can_evaluate(cls, v, values):
        """Set can_evaluate flag."""
        is_active = values.get("is_active")
        rego_policy = values.get("rego_policy")
        return is_active and bool(rego_policy and rego_policy.strip())


# Search and Query Models
class SearchRequest(BaseModel):
    """Search request model."""

    query: str = Field(..., min_length=1, description="Search query")
    tenant_id: uuid.UUID = Field(..., description="Tenant ID")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")
    limit: int = Field(default=10, ge=1, le=100, description="Result limit")
    offset: int = Field(default=0, ge=0, description="Result offset")
    sort_by: str = Field(default="created_at", description="Sort field")
    sort_desc: bool = Field(default=True, description="Sort descending")


class VectorSearchRequest(BaseModel):
    """Vector search request model."""

    tenant_id: uuid.UUID = Field(..., description="Tenant ID")
    query_vector: List[float] = Field(..., min_length=1, description="Query vector")
    similarity_threshold: float = Field(
        default=0.7, ge=0.0, le=1.0, description="Similarity threshold"
    )
    limit: int = Field(default=10, ge=1, le=100, description="Result limit")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")


class HybridSearchRequest(BaseModel):
    """Hybrid search request model."""

    tenant_id: uuid.UUID = Field(..., description="Tenant ID")
    query_text: str = Field(..., min_length=1, description="Text query")
    query_vector: List[float] = Field(..., min_length=1, description="Query vector")
    vector_weight: float = Field(
        default=0.7, ge=0.0, le=1.0, description="Vector search weight"
    )
    text_weight: float = Field(
        default=0.2, ge=0.0, le=1.0, description="Text search weight"
    )
    limit: int = Field(default=10, ge=1, le=100, description="Result limit")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")

    @model_validator(mode="after")
    def validate_weights(self):
        """Validate that weights sum to reasonable value."""
        total = self.vector_weight + self.text_weight
        if total > 1.0:
            # Normalize weights
            self.vector_weight = self.vector_weight / total
            self.text_weight = self.text_weight / total
        return self


# Pagination Models
class PaginationParams(BaseModel):
    """Pagination parameters."""

    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Page size")
    sort_by: str = Field(default="created_at", description="Sort field")
    sort_desc: bool = Field(default=True, description="Sort descending")


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""

    items: List[Any] = Field(..., description="Items")
    total: int = Field(..., ge=0, description="Total items")
    page: int = Field(..., ge=1, description="Current page")
    page_size: int = Field(..., ge=1, description="Page size")
    total_pages: int = Field(..., ge=0, description="Total pages")
    has_next: bool = Field(..., description="Has next page")
    has_prev: bool = Field(..., description="Has previous page")


# Error Models
class ErrorResponse(BaseModel):
    """Error response model."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Error details")
    request_id: Optional[str] = Field(None, description="Request ID")
    timestamp: datetime.datetime = Field(
        default_factory=datetime.datetime.utcnow, description="Error timestamp"
    )


class ValidationErrorDetail(BaseModel):
    """Validation error detail."""

    field: str = Field(..., description="Field name")
    message: str = Field(..., description="Error message")
    value: Any = Field(..., description="Invalid value")


class ValidationErrorResponse(ErrorResponse):
    """Validation error response model."""

    errors: List[ValidationErrorDetail] = Field(..., description="Validation errors")


# Health Check Models
class HealthCheckResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Overall health status")
    timestamp: datetime.datetime = Field(
        default_factory=datetime.datetime.utcnow, description="Check timestamp"
    )
    version: str = Field(..., description="Service version")
    checks: Dict[str, Dict[str, Any]] = Field(
        ..., description="Individual health checks"
    )
    uptime_seconds: float = Field(..., description="Service uptime")


# Statistics Models
class TenantStatistics(BaseModel):
    """Tenant statistics model."""

    total_users: int = Field(..., ge=0, description="Total users")
    active_users: int = Field(..., ge=0, description="Active users")
    total_documents: int = Field(..., ge=0, description="Total documents")
    processed_documents: int = Field(..., ge=0, description="Processed documents")
    total_storage_bytes: int = Field(..., ge=0, description="Total storage in bytes")
    total_tokens: int = Field(..., ge=0, description="Total tokens")
    total_cost_usd: float = Field(..., ge=0.0, description="Total cost in USD")
    active_api_keys: int = Field(..., ge=0, description="Active API keys")
    active_policies: int = Field(..., ge=0, description="Active policies")
    last_activity: Optional[datetime.datetime] = Field(
        None, description="Last activity"
    )

    # Computed fields
    user_activity_rate: float = Field(
        ..., ge=0.0, le=100.0, description="User activity rate percentage"
    )
    document_processing_rate: float = Field(
        ..., ge=0.0, le=100.0, description="Document processing rate percentage"
    )
    average_cost_per_token: float = Field(
        ..., ge=0.0, description="Average cost per token"
    )
    is_high_usage_tenant: bool = Field(..., description="Whether tenant has high usage")

    @validator("user_activity_rate", pre=True, always=True)
    def calculate_user_activity_rate(cls, v, values):
        """Calculate user activity rate."""
        total_users = values.get("total_users", 0)
        active_users = values.get("active_users", 0)
        if total_users == 0:
            return 0.0
        return (active_users / total_users) * 100.0

    @validator("document_processing_rate", pre=True, always=True)
    def calculate_document_processing_rate(cls, v, values):
        """Calculate document processing rate."""
        total_documents = values.get("total_documents", 0)
        processed_documents = values.get("processed_documents", 0)
        if total_documents == 0:
            return 0.0
        return (processed_documents / total_documents) * 100.0

    @validator("average_cost_per_token", pre=True, always=True)
    def calculate_average_cost_per_token(cls, v, values):
        """Calculate average cost per token."""
        total_tokens = values.get("total_tokens", 0)
        total_cost = values.get("total_cost_usd", 0.0)
        if total_tokens == 0:
            return 0.0
        return total_cost / total_tokens

    @validator("is_high_usage_tenant", pre=True, always=True)
    def calculate_is_high_usage_tenant(cls, v, values):
        """Calculate if tenant has high usage."""
        total_tokens = values.get("total_tokens", 0)
        total_storage = values.get("total_storage_bytes", 0)
        return (
            total_tokens > 1000000 or total_storage > 10 * 1024 * 1024 * 1024
        )  # 1M tokens or 10GB
