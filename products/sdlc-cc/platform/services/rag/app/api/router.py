"""
RAG Service API Router

Central API router that consolidates all RAG service endpoints with:
- Version management (v1, v2, etc.)
- API documentation with OpenAPI/Swagger
- Rate limiting integration
- Request/response validation
- Error handling middleware
- Comprehensive endpoint organization
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException
import logging

from app.core.config import get_settings
from app.api.endpoints.search import router as search_router
from app.api.endpoints.vector_search import router as vector_search_router
from app.api.endpoints.context import router as context_router
from app.api.endpoints.rag import router as rag_router
from app.api.endpoints.documents import router as documents_router
from app.api.endpoints.embeddings import router as embeddings_router
from app.api.endpoints.monitoring import router as monitoring_router

logger = logging.getLogger(__name__)
settings = get_settings()

# Create main API router
api_router = APIRouter()

# API version information
API_VERSIONS = {
    "v1": {
        "version": "1.0.0",
        "status": "stable",
        "deprecated": False,
        "description": "Initial stable API version with core RAG functionality",
    },
    "v2": {
        "version": "2.0.0",
        "status": "development",
        "deprecated": False,
        "description": "Enhanced API with advanced features and improved performance",
    },
}


# Include all endpoint routers
def include_routers() -> None:
    """Include all endpoint routers with proper prefixes and tags."""

    # Core RAG functionality
    api_router.include_router(
        rag_router,
        prefix="/rag",
        tags=["RAG Pipeline"],
        responses={
            404: {"description": "Pipeline not found"},
            422: {"description": "Validation error"},
            500: {"description": "Internal server error"},
        },
    )

    # Search functionality
    api_router.include_router(
        search_router,
        prefix="/search",
        tags=["Search"],
        responses={
            400: {"description": "Invalid search query"},
            404: {"description": "No results found"},
            422: {"description": "Validation error"},
        },
    )

    # Vector search functionality
    api_router.include_router(
        vector_search_router,
        prefix="/vector-search",
        tags=["Vector Search"],
        responses={
            400: {"description": "Invalid vector search request"},
            404: {"description": "Vector index not found"},
            422: {"description": "Validation error"},
        },
    )

    # Context retrieval and assembly
    api_router.include_router(
        context_router,
        prefix="/context",
        tags=["Context"],
        responses={
            400: {"description": "Invalid context request"},
            404: {"description": "Context not found"},
            422: {"description": "Validation error"},
        },
    )

    # Document processing
    api_router.include_router(
        documents_router,
        prefix="/documents",
        tags=["Documents"],
        responses={
            400: {"description": "Invalid document request"},
            413: {"description": "File too large"},
            422: {"description": "Validation error"},
        },
    )

    # Embedding services
    api_router.include_router(
        embeddings_router,
        prefix="/embeddings",
        tags=["Embeddings"],
        responses={
            400: {"description": "Invalid embedding request"},
            422: {"description": "Validation error"},
            429: {"description": "Rate limit exceeded"},
        },
    )

    # Monitoring and metrics
    api_router.include_router(
        monitoring_router,
        prefix="/monitoring",
        tags=["Monitoring"],
        responses={
            404: {"description": "Metrics not found"},
            500: {"description": "Monitoring service error"},
        },
    )


# Include all routers
include_routers()


# API information endpoints
@api_router.get("/versions", summary="Get API versions", tags=["API Info"])
async def get_api_versions() -> Dict[str, Any]:
    """
    Get available API versions and their status.

    Returns:
        Dictionary containing version information
    """
    return {
        "current_version": "v1",
        "available_versions": API_VERSIONS,
        "base_url": settings.api_v1_prefix,
        "documentation": {
            "swagger": f"{settings.docs_url}",
            "redoc": f"{settings.redoc_url}",
            "openapi": f"{settings.openapi_url}",
        }
        if settings.is_development
        else {},
    }


@api_router.get("/capabilities", summary="Get API capabilities", tags=["API Info"])
async def get_api_capabilities() -> Dict[str, Any]:
    """
    Get API capabilities and feature availability.

    Returns:
        Dictionary containing API capabilities
    """
    return {
        "rag_pipeline": {
            "available": True,
            "streaming": True,
            "batch_processing": True,
            "quality_assessment": True,
            "citation_processing": True,
            "query_understanding": True,
            "context_assembly": True,
        },
        "search": {
            "available": True,
            "semantic_search": True,
            "hybrid_search": True,
            "faceted_search": True,
            "filters": True,
            "pagination": True,
        },
        "vector_search": {
            "available": True,
            "similarity_search": True,
            "approximate_search": True,
            "multi_vector": True,
            "reranking": True,
        },
        "embeddings": {
            "available": True,
            "models": {
                "openai": settings.openai_api_key is not None,
                "anthropic": settings.anthropic_api_key is not None,
                "sentence_transformers": True,
            },
            "batch_processing": True,
            "async_processing": True,
        },
        "documents": {
            "upload": True,
            "processing": True,
            "chunking": True,
            "metadata_extraction": True,
            "formats": ["PDF", "DOCX", "TXT", "HTML", "MD", "JSON", "CSV"],
        },
        "monitoring": {
            "available": settings.monitoring_enabled,
            "metrics": True,
            "health_checks": True,
            "performance_tracking": True,
            "error_tracking": True,
        },
        "limits": {
            "max_file_size_mb": settings.max_file_size // (1024 * 1024),
            "chunk_size": settings.chunk_size,
            "batch_size": settings.batch_size,
            "max_concurrent_requests": 1000,
            "rate_limit_enabled": settings.rate_limit_enabled,
            "rate_limit_rpm": settings.rate_limit_requests_per_minute
            if settings.rate_limit_enabled
            else None,
        },
    }


@api_router.get("/endpoints", summary="Get all endpoints", tags=["API Info"])
async def get_all_endpoints() -> Dict[str, Any]:
    """
    Get all available API endpoints organized by category.

    Returns:
        Dictionary containing all endpoints
    """
    endpoints = {
        "rag": {
            "path": "/rag",
            "description": "End-to-end RAG pipeline operations",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/query",
                    "description": "Execute RAG query",
                    "summary": "Execute complete RAG pipeline for a given query",
                },
                {
                    "method": "POST",
                    "path": "/query/stream",
                    "description": "Execute RAG query with streaming",
                    "summary": "Execute RAG pipeline with real-time streaming updates",
                },
                {
                    "method": "GET",
                    "path": "/status/{pipeline_id}",
                    "description": "Get pipeline status",
                    "summary": "Check status of a running RAG pipeline",
                },
                {
                    "method": "DELETE",
                    "path": "/cancel/{pipeline_id}",
                    "description": "Cancel pipeline",
                    "summary": "Cancel a running RAG pipeline",
                },
                {
                    "method": "GET",
                    "path": "/metrics",
                    "description": "Get pipeline metrics",
                    "summary": "Get overall pipeline performance metrics",
                },
            ],
        },
        "search": {
            "path": "/search",
            "description": "Document and content search operations",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/query",
                    "description": "Search documents",
                    "summary": "Search documents using various search strategies",
                },
                {
                    "method": "POST",
                    "path": "/semantic",
                    "description": "Semantic search",
                    "summary": "Perform semantic search on documents",
                },
                {
                    "method": "POST",
                    "path": "/hybrid",
                    "description": "Hybrid search",
                    "summary": "Perform hybrid semantic + keyword search",
                },
                {
                    "method": "GET",
                    "path": "/suggestions",
                    "description": "Query suggestions",
                    "summary": "Get query suggestions based on partial input",
                },
            ],
        },
        "vector-search": {
            "path": "/vector-search",
            "description": "Vector similarity search operations",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/similar",
                    "description": "Find similar vectors",
                    "summary": "Find similar vectors based on embedding",
                },
                {
                    "method": "POST",
                    "path": "/batch",
                    "description": "Batch vector search",
                    "summary": "Perform multiple vector searches in parallel",
                },
                {
                    "method": "POST",
                    "path": "/rerank",
                    "description": "Rerank results",
                    "summary": "Rerank search results using custom scoring",
                },
            ],
        },
        "context": {
            "path": "/context",
            "description": "Context retrieval and assembly operations",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/retrieve",
                    "description": "Retrieve context",
                    "summary": "Retrieve relevant context for a query",
                },
                {
                    "method": "POST",
                    "path": "/assemble",
                    "description": "Assemble context",
                    "summary": "Assemble retrieved context into coherent response",
                },
                {
                    "method": "POST",
                    "path": "/quality",
                    "description": "Assess context quality",
                    "summary": "Assess quality of retrieved and assembled context",
                },
            ],
        },
        "documents": {
            "path": "/documents",
            "description": "Document processing and management operations",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/upload",
                    "description": "Upload document",
                    "summary": "Upload and process a document",
                },
                {
                    "method": "POST",
                    "path": "/batch-upload",
                    "description": "Batch upload documents",
                    "summary": "Upload multiple documents in parallel",
                },
                {
                    "method": "GET",
                    "path": "/",
                    "description": "List documents",
                    "summary": "List all processed documents",
                },
                {
                    "method": "GET",
                    "path": "/{document_id}",
                    "description": "Get document",
                    "summary": "Get document details and metadata",
                },
                {
                    "method": "DELETE",
                    "path": "/{document_id}",
                    "description": "Delete document",
                    "summary": "Delete a document and its embeddings",
                },
                {
                    "method": "POST",
                    "path": "/{document_id}/reprocess",
                    "description": "Reprocess document",
                    "summary": "Reprocess document with updated settings",
                },
            ],
        },
        "embeddings": {
            "path": "/embeddings",
            "description": "Text embedding generation and management",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/generate",
                    "description": "Generate embeddings",
                    "summary": "Generate embeddings for text input",
                },
                {
                    "method": "POST",
                    "path": "/batch",
                    "description": "Batch generate embeddings",
                    "summary": "Generate embeddings for multiple texts",
                },
                {
                    "method": "GET",
                    "path": "/models",
                    "description": "List models",
                    "summary": "List available embedding models",
                },
                {
                    "method": "POST",
                    "path": "/compare",
                    "description": "Compare models",
                    "summary": "Compare different embedding models",
                },
            ],
        },
        "monitoring": {
            "path": "/monitoring",
            "description": "Service monitoring and metrics",
            "endpoints": [
                {
                    "method": "GET",
                    "path": "/health",
                    "description": "Service health",
                    "summary": "Get comprehensive service health status",
                },
                {
                    "method": "GET",
                    "path": "/metrics",
                    "description": "Service metrics",
                    "summary": "Get detailed service performance metrics",
                },
                {
                    "method": "GET",
                    "path": "/errors",
                    "description": "Error summary",
                    "summary": "Get recent error summary and trends",
                },
                {
                    "method": "GET",
                    "path": "/performance",
                    "description": "Performance data",
                    "summary": "Get detailed performance analytics",
                },
            ],
        },
    }

    return {
        "api_version": "v1",
        "base_url": settings.api_v1_prefix,
        "endpoints": endpoints,
        "total_endpoints": sum(
            len(category["endpoints"]) for category in endpoints.values()
        ),
    }


# API usage and statistics
@api_router.get("/usage", summary="Get API usage statistics", tags=["API Info"])
async def get_api_usage() -> Dict[str, Any]:
    """
    Get API usage statistics and information.

    Returns:
        Dictionary containing usage statistics
    """
    # This would typically fetch real usage data from a monitoring service
    return {
        "service": {
            "name": settings.app_name,
            "version": settings.app_version,
            "uptime": "24h 15m 32s",  # Would be calculated from actual uptime
            "environment": settings.environment,
        },
        "usage": {
            "total_requests": 15420,
            "requests_today": 342,
            "active_pipelines": 5,
            "successful_queries": 14850,
            "failed_queries": 570,
            "avg_response_time_ms": 245.6,
            "success_rate": 96.3,
        },
        "resources": {
            "documents_processed": 1250,
            "total_embeddings": 45600,
            "storage_used_mb": 1024,
            "active_users": 45,
            "concurrent_requests": 12,
        },
        "performance": {
            "p50_response_time_ms": 180,
            "p95_response_time_ms": 450,
            "p99_response_time_ms": 800,
            "throughput_rpm": 342,
            "error_rate": 0.037,
        },
    }


# Error handling and debugging
@api_router.get(
    "/debug/endpoints", summary="Debug endpoint information", tags=["Debug"]
)
async def debug_endpoints() -> Dict[str, Any]:
    """
    Debug endpoint showing detailed routing information.

    Returns:
        Dictionary containing debug information
    """
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Debug mode is disabled")

    routes = []
    for route in api_router.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            routes.append(
                {
                    "path": route.path,
                    "methods": list(route.methods) if route.methods else [],
                    "name": route.name if hasattr(route, "name") else None,
                    "summary": route.summary if hasattr(route, "summary") else None,
                    "tags": route.tags if hasattr(route, "tags") else [],
                }
            )

    return {
        "router_info": {
            "prefix": "/api/v1",
            "total_routes": len(routes),
            "routes": routes,
        },
        "middleware": [
            "CORS",
            "TrustedHost",
            "GZip",
            "Performance",
            "Auth" if not settings.is_development else "Disabled (Development)",
        ],
        "settings": {
            "debug": settings.debug,
            "environment": settings.environment,
            "rate_limiting": settings.rate_limit_enabled,
            "monitoring": settings.monitoring_enabled,
            "docs_enabled": settings.is_development,
        },
    }


# Rate limiting information
@api_router.get("/rate-limits", summary="Get rate limit information", tags=["API Info"])
async def get_rate_limit_info() -> Dict[str, Any]:
    """
    Get rate limiting information and current limits.

    Returns:
        Dictionary containing rate limit information
    """
    return {
        "rate_limiting": {
            "enabled": settings.rate_limit_enabled,
            "requests_per_minute": settings.rate_limit_requests_per_minute,
            "burst_limit": settings.rate_limit_burst,
            "window_size": "1 minute",
        },
        "current_status": {
            "remaining_requests": 45,  # Would be calculated from actual usage
            "reset_time": "2024-01-20T15:31:00Z",  # Would be calculated
            "is_limited": False,
        },
        "tier_limits": {
            "free": {
                "requests_per_minute": 60,
                "requests_per_day": 1000,
                "concurrent_requests": 5,
            },
            "pro": {
                "requests_per_minute": 300,
                "requests_per_day": 10000,
                "concurrent_requests": 25,
            },
            "enterprise": {
                "requests_per_minute": 1000,
                "requests_per_day": 100000,
                "concurrent_requests": 100,
            },
        },
    }


# Feature flags
@api_router.get("/features", summary="Get feature flags", tags=["API Info"])
async def get_feature_flags() -> Dict[str, Any]:
    """
    Get current feature flag settings.

    Returns:
        Dictionary containing feature flags
    """
    return {
        "features": {
            "streaming_rag": True,
            "batch_processing": True,
            "query_understanding": True,
            "context_assembly": True,
            "quality_assessment": True,
            "citation_processing": True,
            "hybrid_search": True,
            "semantic_search": True,
            "vector_reranking": True,
            "document_upload": True,
            "async_processing": True,
            "rate_limiting": settings.rate_limit_enabled,
            "monitoring": settings.monitoring_enabled,
            "dlp_scanning": settings.dlp_enabled,
            "api_docs": settings.is_development,
            "debug_mode": settings.debug,
        },
        "experimental_features": {
            "multi_modal_rag": False,
            "graph_rag": False,
            "real_time_collaboration": False,
            "advanced_analytics": False,
        },
    }
