"""
Pydantic models for SDLC.ai SDK

Provides type-safe data models for all API requests and responses.
"""

from .base import BaseModel, TimestampModel, IDModel
from .auth import (
    AuthResponse,
    TokenInfo,
    LoginRequest,
    LoginResponse,
    OAuthTokenResponse,
)
from .user import (
    User,
    UserCreate,
    UserUpdate,
    UserListResponse,
    UserPermissions,
    UserRole,
)
from .tenant import (
    Tenant,
    TenantCreate,
    TenantUpdate,
    TenantListResponse,
    TenantSettings,
    TenantHierarchy,
)
from .document import (
    Document,
    DocumentUpload,
    DocumentProcessing,
    DocumentListResponse,
    DocumentMetadata,
    ExtractionResult,
)
from .rag import (
    RAGQuery,
    RAGResponse,
    RAGSource,
    RAGConfig,
    QueryRequest,
    HybridSearchRequest,
)
from .vector import (
    VectorSearchRequest,
    VectorSearchResponse,
    VectorResult,
    VectorBatchRequest,
    VectorSimilarity,
)
from .policy import (
    Policy,
    PolicyCreate,
    PolicyUpdate,
    PolicyRule,
    PolicyTest,
    PolicyTestResult,
    PolicyDeployment,
)
from .llm import (
    LLMChatRequest,
    LLMChatResponse,
    LLMMessage,
    LLMChoice,
    LLMUsage,
    LLMEmbeddingRequest,
    LLMEmbeddingResponse,
)
from .monitoring import (
    Metrics,
    MetricData,
    HealthCheck,
    HealthStatus,
    AuditLog,
    AuditEvent,
    PerformanceMetrics,
)

__all__ = [
    # Base models
    "BaseModel",
    "TimestampModel",
    "IDModel",
    # Auth models
    "AuthResponse",
    "TokenInfo",
    "LoginRequest",
    "LoginResponse",
    "OAuthTokenResponse",
    # User models
    "User",
    "UserCreate",
    "UserUpdate",
    "UserListResponse",
    "UserPermissions",
    "UserRole",
    # Tenant models
    "Tenant",
    "TenantCreate",
    "TenantUpdate",
    "TenantListResponse",
    "TenantSettings",
    "TenantHierarchy",
    # Document models
    "Document",
    "DocumentUpload",
    "DocumentProcessing",
    "DocumentListResponse",
    "DocumentMetadata",
    "ExtractionResult",
    # RAG models
    "RAGQuery",
    "RAGResponse",
    "RAGSource",
    "RAGConfig",
    "QueryRequest",
    "HybridSearchRequest",
    # Vector models
    "VectorSearchRequest",
    "VectorSearchResponse",
    "VectorResult",
    "VectorBatchRequest",
    "VectorSimilarity",
    # Policy models
    "Policy",
    "PolicyCreate",
    "PolicyUpdate",
    "PolicyRule",
    "PolicyTest",
    "PolicyTestResult",
    "PolicyDeployment",
    # LLM models
    "LLMChatRequest",
    "LLMChatResponse",
    "LLMMessage",
    "LLMChoice",
    "LLMUsage",
    "LLMEmbeddingRequest",
    "LLMEmbeddingResponse",
    # Monitoring models
    "Metrics",
    "MetricData",
    "HealthCheck",
    "HealthStatus",
    "AuditLog",
    "AuditEvent",
    "PerformanceMetrics",
]
