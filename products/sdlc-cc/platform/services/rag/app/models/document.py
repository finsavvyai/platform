"""
Document-related models for the RAG service.
"""

import uuid
import hashlib
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, BigInteger
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID, VECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class DocumentStatus(str, Enum):
    """Document processing status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class DataClassification(str, Enum):
    """Data classification levels."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class EncryptionAlgorithm(str, Enum):
    """Supported encryption algorithms."""

    AES_256_GCM = "aes-256-gcm"
    CHACHA20_POLY1305 = "chacha20-poly1305"


class Document(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """Document model representing uploaded and processed documents."""

    __tablename__ = "documents"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Basic document information
    filename: Mapped[str] = mapped_column(
        String(1000), nullable=False, comment="Internal filename (may be sanitized)"
    )
    original_filename: Mapped[str] = mapped_column(
        String(1000), nullable=False, comment="Original user-provided filename"
    )
    content_type: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, comment="MIME type of the document"
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="File size in bytes"
    )

    # Checksums and integrity
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        comment="SHA-256 checksum of the file",
    )
    content_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="SHA-256 hash of extracted content",
    )

    # Storage information
    storage_path: Mapped[str] = mapped_column(
        String(1000), nullable=False, comment="Storage path or object key"
    )
    storage_bucket: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Storage bucket/container name"
    )
    storage_provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="r2",
        comment="Storage provider (r2, s3, etc.)",
    )

    # Processing status
    extraction_status: Mapped[DocumentStatus] = mapped_column(
        String(50),
        nullable=False,
        default=DocumentStatus.PENDING,
        index=True,
        comment="Text extraction status",
    )
    processing_status: Mapped[DocumentStatus] = mapped_column(
        String(50),
        nullable=False,
        default=DocumentStatus.PENDING,
        index=True,
        comment="Overall processing status",
    )
    dlp_status: Mapped[DocumentStatus] = mapped_column(
        String(50),
        nullable=False,
        default=DocumentStatus.PENDING,
        index=True,
        comment="DLP scanning status",
    )

    # Processing metrics
    processing_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Total processing time in milliseconds"
    )

    # Security and classification
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
        comment="User who uploaded the document",
    )
    encryption_key_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Encryption key identifier"
    )
    encryption_algorithm: Mapped[EncryptionAlgorithm] = mapped_column(
        String(50),
        nullable=False,
        default=EncryptionAlgorithm.AES_256_GCM,
        comment="Encryption algorithm used",
    )
    access_level: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="private",
        index=True,
        comment="Access level (public, internal, private, restricted)",
    )
    classification: Mapped[DataClassification] = mapped_column(
        String(50),
        nullable=False,
        default=DataClassification.INTERNAL,
        index=True,
        comment="Data classification level",
    )

    # Content metadata
    language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="en",
        comment="Document language (ISO 639-1 code)",
    )
    tags: Mapped[List[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False, comment="Document tags"
    )

    # Policies and metadata
    retention_policy: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Document-specific retention policy",
    )
    metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, comment="Additional document metadata"
    )

    # Relationships
    creator = relationship("User", back_populates="documents")
    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename={self.filename}, status={self.processing_status})>"

    @property
    def is_processing_complete(self) -> bool:
        """Check if all processing steps are complete."""
        return (
            self.extraction_status == DocumentStatus.COMPLETED
            and self.processing_status == DocumentStatus.COMPLETED
            and self.dlp_status == DocumentStatus.COMPLETED
        )

    @property
    def has_failed(self) -> bool:
        """Check if any processing step has failed."""
        return (
            self.extraction_status == DocumentStatus.FAILED
            or self.processing_status == DocumentStatus.FAILED
            or self.dlp_status == DocumentStatus.FAILED
        )

    @property
    def processing_progress(self) -> float:
        """Calculate overall processing progress (0-100)."""
        statuses = [self.extraction_status, self.processing_status, self.dlp_status]
        completed = sum(1 for status in statuses if status == DocumentStatus.COMPLETED)
        return (completed / len(statuses)) * 100

    def can_access(self, user_role: str) -> bool:
        """Check if a user with a given role can access this document."""
        if user_role == "super_admin":
            return True

        access_rules = {
            "tenant_admin": ["public", "internal", "private", "restricted"],
            "data_scientist": ["public", "internal", "private"],
            "analyst": ["public", "internal"],
            "viewer": ["public", "internal"],
            "user": ["public"],
        }

        allowed_levels = access_rules.get(user_role, [])
        return self.access_level in allowed_levels

    def add_tag(self, tag: str) -> None:
        """Add a tag to the document (avoid duplicates)."""
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: str) -> None:
        """Remove a tag from the document."""
        if tag in self.tags:
            self.tags.remove(tag)

    def set_content_hash(self, content: str) -> None:
        """Calculate and set the content hash."""
        self.content_hash = hashlib.sha256(content.encode()).hexdigest()


class DocumentChunk(Base, TenantMixin, TimestampMixin):
    """Document chunk model for RAG processing."""

    __tablename__ = "document_chunks"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Document relationship
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent document ID",
    )

    # Chunk information
    chunk_index: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Index of the chunk within the document"
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Chunk content text"
    )
    content_length: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Length of the content in characters"
    )
    chunk_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="text",
        comment="Type of chunk (text, code, table, etc.)",
    )

    # Token information
    token_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="Approximate token count for the chunk",
    )

    # Source information
    source_page_number: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Page number in the original document"
    )
    source_section: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Section or chapter name"
    )

    # Embedding information
    embedding_model: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Model used to generate the embedding"
    )
    embedding_dimensions: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Dimensions of the embedding vector"
    )
    embedding: Mapped[Optional[List[float]]] = mapped_column(
        VECTOR(1536), nullable=True, comment="Vector embedding for semantic search"
    )
    embedding_status: Mapped[DocumentStatus] = mapped_column(
        String(50),
        nullable=False,
        default=DocumentStatus.PENDING,
        index=True,
        comment="Embedding generation status",
    )

    # Processing metrics
    processing_time_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Time taken to process this chunk in milliseconds",
    )

    # Integrity
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="SHA-256 checksum of the chunk content",
    )

    # Additional metadata
    language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="en",
        comment="Chunk language (ISO 639-1 code)",
    )
    metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, comment="Additional chunk metadata"
    )

    # Relationships
    document = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<DocumentChunk(id={self.id}, document_id={self.document_id}, index={self.chunk_index})>"

    @property
    def has_embedding(self) -> bool:
        """Check if the chunk has an embedding."""
        return (
            self.embedding_status == DocumentStatus.COMPLETED
            and self.embedding is not None
        )

    @property
    def is_embedding_processing_complete(self) -> bool:
        """Check if embedding processing is complete."""
        return self.embedding_status == DocumentStatus.COMPLETED

    @property
    def has_embedding_failed(self) -> bool:
        """Check if embedding processing has failed."""
        return self.embedding_status == DocumentStatus.FAILED

    def set_checksum(self) -> None:
        """Calculate and set the chunk checksum."""
        self.checksum = hashlib.sha256(self.content.encode()).hexdigest()

    def verify_checksum(self) -> bool:
        """Verify the chunk checksum matches the content."""
        calculated = hashlib.sha256(self.content.encode()).hexdigest()
        return calculated == self.checksum


# Pydantic schemas for API
class DocumentBase(BaseModel):
    """Base document schema."""

    filename: str = Field(..., min_length=1, max_length=1000)
    original_filename: str = Field(..., min_length=1, max_length=1000)
    content_type: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., gt=0)
    access_level: str = Field(default="private")
    classification: DataClassification = Field(default=DataClassification.INTERNAL)
    language: str = Field(default="en", max_length=10)
    tags: List[str] = Field(default_factory=list)


class DocumentCreate(DocumentBase):
    """Schema for creating a document."""

    created_by: uuid.UUID
    storage_path: str
    storage_bucket: str
    storage_provider: str = Field(default="r2")
    checksum: str
    encryption_key_id: Optional[str] = None
    encryption_algorithm: EncryptionAlgorithm = Field(
        default=EncryptionAlgorithm.AES_256_GCM
    )
    retention_policy: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""

    filename: Optional[str] = Field(None, min_length=1, max_length=1000)
    access_level: Optional[str] = None
    classification: Optional[DataClassification] = None
    language: Optional[str] = Field(None, max_length=10)
    tags: Optional[List[str]] = None
    extraction_status: Optional[DocumentStatus] = None
    processing_status: Optional[DocumentStatus] = None
    dlp_status: Optional[DocumentStatus] = None
    processing_duration_ms: Optional[int] = None
    retention_policy: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentResponse(DocumentBase):
    """Schema for document response."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    checksum: str
    content_hash: Optional[str]
    storage_path: str
    storage_bucket: str
    storage_provider: str
    extraction_status: DocumentStatus
    processing_status: DocumentStatus
    dlp_status: DocumentStatus
    processing_duration_ms: Optional[int]
    created_by: uuid.UUID
    encryption_key_id: Optional[str]
    encryption_algorithm: EncryptionAlgorithm
    retention_policy: Dict[str, Any]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    deleted_at: Optional[datetime]

    # Computed properties
    is_processing_complete: bool
    has_failed: bool
    processing_progress: float

    class Config:
        from_attributes = True


class DocumentChunkBase(BaseModel):
    """Base document chunk schema."""

    chunk_index: int = Field(..., ge=0)
    content: str = Field(..., min_length=1)
    chunk_type: str = Field(default="text")
    language: str = Field(default="en", max_length=10)


class DocumentChunkCreate(DocumentChunkBase):
    """Schema for creating a document chunk."""

    document_id: uuid.UUID
    token_count: Optional[int] = Field(None, ge=0)
    source_page_number: Optional[int] = Field(None, ge=0)
    source_section: Optional[str] = Field(None, max_length=255)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentChunkUpdate(BaseModel):
    """Schema for updating a document chunk."""

    content: Optional[str] = Field(None, min_length=1)
    chunk_type: Optional[str] = None
    token_count: Optional[int] = Field(None, ge=0)
    embedding_model: Optional[str] = None
    embedding_dimensions: Optional[int] = Field(None, gt=0)
    embedding_status: Optional[DocumentStatus] = None
    processing_time_ms: Optional[int] = Field(None, ge=0)
    language: Optional[str] = Field(None, max_length=10)
    metadata: Optional[Dict[str, Any]] = None


class DocumentChunkResponse(DocumentChunkBase):
    """Schema for document chunk response."""

    id: uuid.UUID
    document_id: uuid.UUID
    tenant_id: uuid.UUID
    content_length: int
    token_count: Optional[int]
    source_page_number: Optional[int]
    source_section: Optional[str]
    embedding_model: Optional[str]
    embedding_dimensions: Optional[int]
    embedding_status: DocumentStatus
    processing_time_ms: Optional[int]
    checksum: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    # Computed properties
    has_embedding: bool
    is_embedding_processing_complete: bool
    has_embedding_failed: bool

    class Config:
        from_attributes = True


# Query and filter schemas
class DocumentFilter(BaseModel):
    """Schema for document filtering."""

    content_type: Optional[str] = None
    extraction_status: Optional[DocumentStatus] = None
    processing_status: Optional[DocumentStatus] = None
    dlp_status: Optional[DocumentStatus] = None
    access_level: Optional[str] = None
    classification: Optional[DataClassification] = None
    language: Optional[str] = None
    tags: Optional[List[str]] = None
    created_by: Optional[uuid.UUID] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    search: Optional[str] = None


class DocumentChunkFilter(BaseModel):
    """Schema for document chunk filtering."""

    document_id: Optional[uuid.UUID] = None
    chunk_type: Optional[str] = None
    embedding_status: Optional[DocumentStatus] = None
    embedding_model: Optional[str] = None
    language: Optional[str] = None
    min_token_count: Optional[int] = Field(None, ge=0)
    max_token_count: Optional[int] = Field(None, ge=0)
    search: Optional[str] = None
