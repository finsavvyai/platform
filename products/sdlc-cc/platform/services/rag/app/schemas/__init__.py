"""
Pydantic schemas package for the RAG service.

This package provides Pydantic models for request/response validation,
data serialization, and API documentation.
"""

from .models import (
    # Base schemas
    BaseSchema,
    TimestampSchema,
    UUIDSchema,
    TenantScopedSchema,
    # Pagination
    PaginationParams,
    PaginatedResponse,
    # Tenant schemas
    TenantBase,
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantStats,
    # User schemas
    UserBase,
    UserCreate,
    UserUpdate,
    UserPasswordUpdate,
    UserResponse,
    UserStats,
    # Document schemas
    DocumentBase,
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentStats,
    StorageStats,
    # Document chunk schemas
    DocumentChunkBase,
    DocumentChunkCreate,
    DocumentChunkUpdate,
    DocumentChunkResponse,
    ChunkStats,
    EmbeddingProgress,
    # API Key schemas
    APIKeyBase,
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyResponse,
    # Search schemas
    VectorSearchRequest,
    HybridSearchRequest,
    SearchResult,
    SearchResponse,
    # Health check schemas
    HealthCheckResponse,
    DatabaseHealthCheck,
    # Error schemas
    ErrorResponse,
    ValidationErrorResponse,
)

__all__ = [
    # Base schemas
    "BaseSchema",
    "TimestampSchema",
    "UUIDSchema",
    "TenantScopedSchema",
    # Pagination
    "PaginationParams",
    "PaginatedResponse",
    # Tenant schemas
    "TenantBase",
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    "TenantStats",
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserPasswordUpdate",
    "UserResponse",
    "UserStats",
    # Document schemas
    "DocumentBase",
    "DocumentCreate",
    "DocumentUpdate",
    "DocumentResponse",
    "DocumentStats",
    "StorageStats",
    # Document chunk schemas
    "DocumentChunkBase",
    "DocumentChunkCreate",
    "DocumentChunkUpdate",
    "DocumentChunkResponse",
    "ChunkStats",
    "EmbeddingProgress",
    # API Key schemas
    "APIKeyBase",
    "APIKeyCreate",
    "APIKeyUpdate",
    "APIKeyResponse",
    # Search schemas
    "VectorSearchRequest",
    "HybridSearchRequest",
    "SearchResult",
    "SearchResponse",
    # Health check schemas
    "HealthCheckResponse",
    "DatabaseHealthCheck",
    # Error schemas
    "ErrorResponse",
    "ValidationErrorResponse",
]

# Version information
__version__ = "1.0.0"
__author__ = "SDLC.ai Team"
__description__ = "Pydantic validation schemas for RAG service"
