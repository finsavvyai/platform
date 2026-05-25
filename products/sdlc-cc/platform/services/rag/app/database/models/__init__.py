"""
Database models package for the RAG service.

This package provides SQLAlchemy models with proper validation, relationships,
and business logic methods for multi-tenant RAG application.
"""

from .base import (
    # Base classes and mixins
    Base,
    TimestampMixin,
    UUIDMixin,
    TenantMixin,
    SoftDeleteMixin,
    # Enums
    TenantStatus,
    UserRole,
    DocumentStatus,
    PolicyType,
    EncryptionAlgorithm,
    DataClassification,
    AuditAction,
    # Core models
    Tenant,
    User,
    UserSession,
    Document,
    DocumentChunk,
    DocumentProcessingJob,
    EmbeddingJob,
    Policy,
    PolicyEvaluation,
    APIKey,
    TokenUsage,
    DocumentAccessLog,
    AuditLog,
)

from .extended import (
    # View/Materialized models
    TenantStatistics,
    DocumentProcessingQueue,
)

__all__ = [
    # Base classes
    "Base",
    "TimestampMixin",
    "UUIDMixin",
    "TenantMixin",
    "SoftDeleteMixin",
    # Enums
    "TenantStatus",
    "UserRole",
    "DocumentStatus",
    "PolicyType",
    "EncryptionAlgorithm",
    "DataClassification",
    "AuditAction",
    # Core models
    "Tenant",
    "User",
    "UserSession",
    "Document",
    "DocumentChunk",
    "DocumentProcessingJob",
    "EmbeddingJob",
    "Policy",
    "PolicyEvaluation",
    "APIKey",
    "TokenUsage",
    "DocumentAccessLog",
    "AuditLog",
    # View models
    "TenantStatistics",
    "DocumentProcessingQueue",
]

# Version information
__version__ = "1.0.0"
__author__ = "SDLC.ai Team"
__description__ = "Database models for RAG service with multi-tenant support"
