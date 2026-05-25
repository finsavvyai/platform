"""
SQLAlchemy models for the RAG service.

This module defines all the database models using SQLAlchemy ORM with proper
type annotations, relationships, and constraints for multi-tenant architecture.
"""

import datetime
import enum
import json
import uuid
from typing import Any, Dict, List, Optional, Type, TypeVar, Union

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    CheckConstraint,
    Float,
    LargeBinary,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID, VECTOR
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import relationship, Session
from sqlalchemy.sql import func
from sqlalchemy.sql.expression import text

Base = declarative_base()

# Type variable for generic model operations
ModelType = TypeVar("ModelType", bound=Base)


# Enums
class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    DELETED = "deleted"


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    TENANT_ADMIN = "tenant_admin"
    DATA_SCIENTIST = "data_scientist"
    ANALYST = "analyst"
    VIEWER = "viewer"
    USER = "user"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PolicyType(str, enum.Enum):
    AUTH = "auth"
    DATA_ACCESS = "data_access"
    DLP = "dlp"
    COST = "cost"
    COMPLIANCE = "compliance"


class EncryptionAlgorithm(str, enum.Enum):
    AES_256_GCM = "aes-256-gcm"
    AES_256_CBC = "aes-256-cbc"
    CHACHA20_POLY1305 = "chacha20-poly1305"


class DataClassification(str, enum.Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class AuditAction(str, enum.Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    ACCESS_DENIED = "access_denied"


# Mixin classes for common functionality
class TimestampMixin:
    """Mixin for timestamp fields."""

    @declared_attr
    def created_at(cls):
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
            index=True,
        )

    @declared_attr
    def updated_at(cls):
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        )


class UUIDMixin:
    """Mixin for UUID primary key."""

    @declared_attr
    def id(cls):
        return Column(
            UUID(as_uuid=True),
            primary_key=True,
            default=uuid.uuid4,
            server_default=text("uuid_generate_v4()"),
        )


class TenantMixin:
    """Mixin for tenant-aware models."""

    @declared_attr
    def tenant_id(cls):
        return Column(
            UUID(as_uuid=True),
            ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )


class SoftDeleteMixin:
    """Mixin for soft delete functionality."""

    @declared_attr
    def deleted_at(cls):
        return Column(DateTime(timezone=True), nullable=True)

    @declared_attr
    def is_deleted(cls):
        return Column(Boolean, default=False, nullable=False, index=True)


# Model definitions
class Tenant(Base, UUIDMixin, TimestampMixin):
    """Multi-tenant organization management."""

    __tablename__ = "tenants"

    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(
        Enum(TenantStatus), nullable=False, default=TenantStatus.TRIAL, index=True
    )
    config = Column(JSON, nullable=False, default=dict)
    settings = Column(JSON, nullable=False, default=dict)
    subscription_tier = Column(String(50), nullable=False, default="basic", index=True)
    data_region = Column(String(50), nullable=False, default="us-east-1")
    contact_email = Column(String(255))
    billing_info = Column(JSON, nullable=False, default=dict)
    metadata = Column(JSON, nullable=False, default=dict)
    retention_policy = Column(JSON, nullable=False, default=dict)
    resource_limits = Column(JSON, nullable=False, default=dict)
    compliance_requirements = Column(JSON, nullable=False, default=dict)

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    documents = relationship(
        "Document", back_populates="tenant", cascade="all, delete-orphan"
    )
    document_chunks = relationship(
        "DocumentChunk", back_populates="tenant", cascade="all, delete-orphan"
    )
    policies = relationship(
        "Policy", back_populates="tenant", cascade="all, delete-orphan"
    )
    audit_logs = relationship(
        "AuditLog", back_populates="tenant", cascade="all, delete-orphan"
    )

    # Indexes
    __table_args__ = (
        Index("idx_tenants_domain_status", "domain", "status"),
        Index("idx_tenants_subscription_created", "subscription_tier", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name={self.name}, domain={self.domain}, status={self.status})>"

    def is_active(self) -> bool:
        """Check if tenant is active."""
        return self.status == TenantStatus.ACTIVE

    def is_trial(self) -> bool:
        """Check if tenant is in trial mode."""
        return self.status == TenantStatus.TRIAL

    def get_resource_limit(self, resource_type: str) -> Optional[int]:
        """Get resource limit for a specific type."""
        return self.resource_limits.get(resource_type)

    def check_compliance_requirement(self, requirement: str) -> bool:
        """Check if tenant meets a compliance requirement."""
        return requirement in self.compliance_requirements.get("requirements", [])


class User(Base, UUIDMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """User authentication and authorization."""

    __tablename__ = "users"

    email = Column(String(255), nullable=False, index=True)
    encrypted_password = Column(LargeBinary, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER, index=True)
    permissions = Column(JSON, nullable=False, default=list)
    metadata = Column(JSON, nullable=False, default=dict)
    last_login = Column(DateTime(timezone=True), index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(LargeBinary)
    email_verified = Column(Boolean, default=False, nullable=False)
    phone_number = Column(String(20))
    phone_verified = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True))
    profile = Column(JSON, nullable=False, default=dict)
    preferences = Column(JSON, nullable=False, default=dict)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    documents = relationship(
        "Document", back_populates="creator", cascade="all, delete-orphan"
    )
    user_sessions = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )
    policy_evaluations = relationship(
        "PolicyEvaluation", back_populates="user", cascade="all, delete-orphan"
    )
    token_usage = relationship(
        "TokenUsage", back_populates="user", cascade="all, delete-orphan"
    )
    document_access_logs = relationship(
        "DocumentAccessLog", back_populates="user", cascade="all, delete-orphan"
    )
    created_policies = relationship(
        "Policy", back_populates="creator", cascade="all, delete-orphan"
    )

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'",
            name="chk_user_email",
        ),
        CheckConstraint("failed_login_attempts >= 0", name="chk_failed_attempts"),
        Index("idx_users_tenant_email", "tenant_id", "email"),
        Index("idx_users_role_active", "role", "is_active"),
        Index("idx_users_tenant_active", "tenant_id", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role}, active={self.is_active})>"

    def is_locked(self) -> bool:
        """Check if user account is locked."""
        return (
            self.locked_until is not None
            and self.locked_until > datetime.datetime.utcnow()
        )

    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return self.role in [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]

    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission."""
        if self.is_admin():
            return True
        return permission in self.permissions

    def can_access_tenant(self, tenant_id: str) -> bool:
        """Check if user can access the tenant."""
        return str(self.tenant_id) == tenant_id or self.role == UserRole.SUPER_ADMIN

    def lock_account(self, duration: datetime.timedelta) -> None:
        """Lock user account for specified duration."""
        self.locked_until = datetime.datetime.utcnow() + duration

    def unlock_account(self) -> None:
        """Unlock user account."""
        self.locked_until = None
        self.failed_login_attempts = 0

    def increment_failed_login(self) -> None:
        """Increment failed login count."""
        self.failed_login_attempts += 1

    def reset_failed_login(self) -> None:
        """Reset failed login count."""
        self.failed_login_attempts = 0

    def update_last_login(self) -> None:
        """Update last login timestamp."""
        self.last_login = datetime.datetime.utcnow()


class UserSession(Base, UUIDMixin, TimestampMixin):
    """User login sessions."""

    __tablename__ = "user_sessions"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    last_used = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ip_address = Column(String(45))
    user_agent = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)
    metadata = Column(JSON, nullable=False, default=dict)

    # Relationships
    user = relationship("User", back_populates="user_sessions")

    # Indexes
    __table_args__ = (
        Index("idx_user_sessions_token_active", "token", "is_active"),
        Index("idx_user_sessions_user_active", "user_id", "is_active"),
        Index("idx_user_sessions_expires_active", "expires_at", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})>"

    def is_expired(self) -> bool:
        """Check if session is expired."""
        return datetime.datetime.utcnow() > self.expires_at

    def is_valid(self) -> bool:
        """Check if session is valid (active and not expired)."""
        return self.is_active and not self.is_expired()

    def extend_session(self, duration: datetime.timedelta) -> None:
        """Extend session expiration."""
        self.expires_at = datetime.datetime.utcnow() + duration
        self.last_used = datetime.datetime.utcnow()


class Document(Base, UUIDMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """Document metadata and storage tracking."""

    __tablename__ = "documents"

    filename = Column(String(1000), nullable=False)
    original_filename = Column(String(1000), nullable=False)
    content_type = Column(String(255), nullable=False, index=True)
    file_size = Column(Integer, nullable=False)
    checksum = Column(String(64), nullable=False, index=True)
    storage_path = Column(String(1000), nullable=False)
    storage_bucket = Column(String(255), nullable=False)
    storage_provider = Column(String(50), nullable=False, default="r2")
    metadata = Column(JSON, nullable=False, default=dict)
    extraction_status = Column(
        Enum(DocumentStatus), nullable=False, default=DocumentStatus.PENDING, index=True
    )
    processing_status = Column(
        Enum(DocumentStatus), nullable=False, default=DocumentStatus.PENDING, index=True
    )
    dlp_status = Column(
        Enum(DocumentStatus), nullable=False, default=DocumentStatus.PENDING, index=True
    )
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    encryption_key_id = Column(String(255))
    encryption_algorithm = Column(
        Enum(EncryptionAlgorithm), default=EncryptionAlgorithm.AES_256_GCM
    )
    retention_policy = Column(JSON, nullable=False, default=dict)
    access_level = Column(String(50), nullable=False, default="private", index=True)
    tags = Column(JSON, nullable=False, default=list)
    classification = Column(
        Enum(DataClassification),
        nullable=False,
        default=DataClassification.INTERNAL,
        index=True,
    )
    content_hash = Column(String(64), index=True)
    language = Column(String(10), default="en")
    processing_duration_ms = Column(Integer)

    # Relationships
    tenant = relationship("Tenant", back_populates="documents")
    creator = relationship("User", back_populates="documents")
    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )
    processing_jobs = relationship(
        "DocumentProcessingJob", back_populates="document", cascade="all, delete-orphan"
    )
    access_logs = relationship(
        "DocumentAccessLog", back_populates="document", cascade="all, delete-orphan"
    )

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("file_size > 0", name="chk_file_size"),
        Index("idx_documents_creator_status", "created_by", "processing_status"),
        Index("idx_documents_tenant_classification", "tenant_id", "classification"),
        Index("idx_documents_status_created", "processing_status", "created_at"),
        Index("idx_documents_checksum_tenant", "checksum", "tenant_id"),
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename={self.filename}, status={self.processing_status})>"

    def is_processing_complete(self) -> bool:
        """Check if all document processing is complete."""
        return (
            self.extraction_status == DocumentStatus.COMPLETED
            and self.processing_status == DocumentStatus.COMPLETED
            and self.dlp_status == DocumentStatus.COMPLETED
        )

    def is_processing(self) -> bool:
        """Check if document is currently being processed."""
        return (
            self.extraction_status == DocumentStatus.PROCESSING
            or self.processing_status == DocumentStatus.PROCESSING
            or self.dlp_status == DocumentStatus.PROCESSING
        )

    def has_processing_failed(self) -> bool:
        """Check if any document processing has failed."""
        return (
            self.extraction_status == DocumentStatus.FAILED
            or self.processing_status == DocumentStatus.FAILED
            or self.dlp_status == DocumentStatus.FAILED
        )

    def get_overall_status(self) -> DocumentStatus:
        """Get overall processing status."""
        if self.is_processing_complete():
            return DocumentStatus.COMPLETED
        if self.has_processing_failed():
            return DocumentStatus.FAILED
        if self.is_processing():
            return DocumentStatus.PROCESSING
        return DocumentStatus.PENDING

    def get_retention_days(self) -> int:
        """Get retention period in days from retention policy."""
        return self.retention_policy.get("days", 365)

    def is_retention_expired(self) -> bool:
        """Check if document has exceeded retention period."""
        expiry_date = self.created_at + datetime.timedelta(
            days=self.get_retention_days()
        )
        return datetime.datetime.utcnow() > expiry_date

    def should_be_archived(self) -> bool:
        """Check if document should be archived based on retention or classification."""
        return (
            self.is_retention_expired()
            or self.classification == DataClassification.RESTRICTED
        )

    def get_compliance_level(self) -> str:
        """Get compliance level based on classification."""
        mapping = {
            DataClassification.PUBLIC: "low",
            DataClassification.INTERNAL: "medium",
            DataClassification.CONFIDENTIAL: "high",
            DataClassification.RESTRICTED: "critical",
        }
        return mapping.get(self.classification, "medium")

    def add_tag(self, tag: str) -> None:
        """Add a tag to the document."""
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: str) -> None:
        """Remove a tag from the document."""
        if tag in self.tags:
            self.tags.remove(tag)


class DocumentChunk(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """Text chunks for RAG processing with vector embeddings."""

    __tablename__ = "document_chunks"

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    content_length = Column(Integer, nullable=False)
    chunk_type = Column(String(50), nullable=False, default="text")
    embedding_model = Column(String(100))
    embedding_dimensions = Column(Integer)
    embedding = Column(VECTOR(1536))
    embedding_status = Column(
        Enum(DocumentStatus), nullable=False, default=DocumentStatus.PENDING, index=True
    )
    metadata = Column(JSON, nullable=False, default=dict)
    processing_time_ms = Column(Integer)
    checksum = Column(String(64), nullable=False)
    token_count = Column(Integer, index=True)
    source_page_number = Column(Integer)
    source_section = Column(String(255))
    language = Column(String(10), default="en")

    # Relationships
    document = relationship("Document", back_populates="chunks")
    tenant = relationship("Tenant", back_populates="document_chunks")
    embedding_jobs = relationship(
        "EmbeddingJob", back_populates="chunk", cascade="all, delete-orphan"
    )

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("content_length > 0", name="chk_content_length"),
        CheckConstraint("chunk_index >= 0", name="chk_chunk_index"),
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunk_index"),
        Index("idx_document_chunks_document_index", "document_id", "chunk_index"),
        Index("idx_document_chunks_embedding_status", "embedding_status"),
        Index("idx_document_chunks_token_count", "token_count"),
        # Vector index for similarity search (created separately)
    )

    def __repr__(self) -> str:
        return f"<DocumentChunk(id={self.id}, document_id={self.document_id}, chunk_index={self.chunk_index})>"

    def has_embedding(self) -> bool:
        """Check if chunk has embedding."""
        return self.embedding is not None

    def needs_embedding(self) -> bool:
        """Check if chunk needs embedding."""
        return self.embedding_status in [DocumentStatus.PENDING, DocumentStatus.FAILED]

    def is_embedding_complete(self) -> bool:
        """Check if embedding processing is complete."""
        return (
            self.embedding_status == DocumentStatus.COMPLETED and self.has_embedding()
        )

    def update_embedding_status(
        self, status: DocumentStatus, processing_time: Optional[int] = None
    ) -> None:
        """Update embedding status."""
        self.embedding_status = status
        if processing_time is not None:
            self.processing_time_ms = processing_time

    def estimate_token_count(self) -> None:
        """Estimate token count for the chunk."""
        # Simple estimation: roughly 4 characters per token
        self.token_count = len(self.content) // 4

    def get_content_preview(self, max_length: int = 100) -> str:
        """Get a preview of the chunk content."""
        if len(self.content) <= max_length:
            return self.content
        return self.content[:max_length] + "..."


class DocumentProcessingJob(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """Document processing jobs."""

    __tablename__ = "document_processing_jobs"

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_type = Column(String(100), nullable=False)
    status = Column(Enum(DocumentStatus), nullable=False, index=True)
    progress = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), index=True)
    completed_at = Column(DateTime(timezone=True), index=True)
    error = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    metadata = Column(JSON, nullable=False, default=dict)

    # Relationships
    document = relationship("Document", back_populates="processing_jobs")
    tenant = relationship("Tenant")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("progress >= 0 AND progress <= 100", name="chk_progress_range"),
        CheckConstraint("retry_count >= 0", name="chk_retry_count"),
        CheckConstraint("max_retries >= 0", name="chk_max_retries"),
        Index("idx_processing_jobs_document_status", "document_id", "status"),
        Index("idx_processing_jobs_type_status", "job_type", "status"),
        Index("idx_processing_jobs_created_status", "created_at", "status"),
    )

    def __repr__(self) -> str:
        return f"<DocumentProcessingJob(id={self.id}, document_id={self.document_id}, status={self.status})>"

    def is_retryable(self) -> bool:
        """Check if the job can be retried."""
        return (
            self.status == DocumentStatus.FAILED and self.retry_count < self.max_retries
        )

    def increment_retry(self) -> None:
        """Increment retry count."""
        self.retry_count += 1

    def start_job(self) -> None:
        """Mark job as started."""
        self.started_at = datetime.datetime.utcnow()
        self.status = DocumentStatus.PROCESSING

    def complete_job(self) -> None:
        """Mark job as completed."""
        self.completed_at = datetime.datetime.utcnow()
        self.status = DocumentStatus.COMPLETED
        self.progress = 100

    def fail_job(self, error_message: str) -> None:
        """Mark job as failed."""
        self.completed_at = datetime.datetime.utcnow()
        self.status = DocumentStatus.FAILED
        self.error = error_message


class EmbeddingJob(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """Embedding processing jobs."""

    __tablename__ = "embedding_jobs"

    chunk_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model = Column(String(100), nullable=False)
    status = Column(Enum(DocumentStatus), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), index=True)
    completed_at = Column(DateTime(timezone=True), index=True)
    error = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    duration_ms = Column(Integer)
    tokens_used = Column(Integer)
    cost_usd = Column(Numeric(10, 4))
    metadata = Column(JSON, nullable=False, default=dict)

    # Relationships
    chunk = relationship("DocumentChunk", back_populates="embedding_jobs")
    tenant = relationship("Tenant")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("retry_count >= 0", name="chk_embedding_retry_count"),
        CheckConstraint("max_retries >= 0", name="chk_embedding_max_retries"),
        CheckConstraint("duration_ms >= 0", name="chk_duration_ms"),
        CheckConstraint("tokens_used >= 0", name="chk_tokens_used"),
        CheckConstraint("cost_usd >= 0", name="chk_cost_usd"),
        Index("idx_embedding_jobs_chunk_status", "chunk_id", "status"),
        Index("idx_embedding_jobs_model_status", "model", "status"),
        Index("idx_embedding_jobs_created_status", "created_at", "status"),
    )

    def __repr__(self) -> str:
        return f"<EmbeddingJob(id={self.id}, chunk_id={self.chunk_id}, model={self.model}, status={self.status})>"

    def is_retryable(self) -> bool:
        """Check if the job can be retried."""
        return (
            self.status == DocumentStatus.FAILED and self.retry_count < self.max_retries
        )

    def increment_retry(self) -> None:
        """Increment retry count."""
        self.retry_count += 1

    def start_job(self) -> None:
        """Mark job as started."""
        self.started_at = datetime.datetime.utcnow()
        self.status = DocumentStatus.PROCESSING

    def complete_job(
        self,
        duration: Optional[int] = None,
        tokens: Optional[int] = None,
        cost: Optional[float] = None,
    ) -> None:
        """Mark job as completed."""
        self.completed_at = datetime.datetime.utcnow()
        self.status = DocumentStatus.COMPLETED
        if duration is not None:
            self.duration_ms = duration
        if tokens is not None:
            self.tokens_used = tokens
        if cost is not None:
            self.cost_usd = cost

    def fail_job(self, error_message: str) -> None:
        """Mark job as failed."""
        self.completed_at = datetime.datetime.utcnow()
        self.status = DocumentStatus.FAILED
        self.error = error_message


class Policy(Base, UUIDMixin, TenantMixin, TimestampMixin):
    """OPA policy management."""

    __tablename__ = "policies"

    name = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(Enum(PolicyType), nullable=False, index=True)
    rego_policy = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    priority = Column(Integer, default=100, index=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    metadata = Column(JSON, nullable=False, default=dict)
    test_cases = Column(JSON, nullable=False, default=list)
    dependencies = Column(JSON, nullable=False, default=list)
    tags = Column(JSON, nullable=False, default=list)

    # Relationships
    tenant = relationship("Tenant", back_populates="policies")
    creator = relationship("User", back_populates="created_policies")
    policy_evaluations = relationship(
        "PolicyEvaluation", back_populates="policy", cascade="all, delete-orphan"
    )

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("priority >= 0", name="chk_policy_priority"),
        CheckConstraint("version > 0", name="chk_policy_version"),
        UniqueConstraint("tenant_id", "name", "version", name="uq_policy_name_version"),
        Index("idx_policies_tenant_type", "tenant_id", "type"),
        Index("idx_policies_active_priority", "is_active", "priority"),
        Index("idx_policies_version_created", "version", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Policy(id={self.id}, name={self.name}, type={self.type}, active={self.is_active})>"

    def is_active_policy(self) -> bool:
        """Check if policy is currently active."""
        return self.is_active

    def can_evaluate(self) -> bool:
        """Check if policy can be evaluated."""
        return self.is_active and self.rego_policy.strip() != ""

    def add_test_case(self, test_case: Dict[str, Any]) -> None:
        """Add a test case to the policy."""
        if test_case not in self.test_cases:
            self.test_cases.append(test_case)

    def activate(self) -> None:
        """Activate the policy."""
        self.is_active = True

    def deactivate(self) -> None:
        """Deactivate the policy."""
        self.is_active = False

    def increment_version(self) -> None:
        """Increment policy version."""
        self.version += 1
