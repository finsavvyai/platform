"""
SDLC RAG Service - Main FastAPI Application

Production-ready RAG (Retrieval-Augmented Generation) service with:
- Comprehensive RAG workflow orchestration
- Async processing capabilities
- Health monitoring and metrics
- Performance optimization
- Error handling and recovery
- API versioning and documentation
- Security middleware
- Graceful shutdown handling
"""

import asyncio
import logging
import os
import signal
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any, Optional, AsyncGenerator

import uvicorn
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.utils import get_openapi
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

from app.core.config import get_settings
from app.core.error_handling import (
    setup_error_handlers,
)
from app.core.performance import PerformanceMiddleware, setup_performance_monitoring
from app.core.health_monitor import HealthMonitor
from app.core.lifecycle import LifecycleManager
from app.config.app_config import get_app_config
from app.api.router import api_router
from app.database.connection import init_database, close_database
from app.auth.middleware import AuthMiddleware
from app.observability.tracing import init_tracing, shutdown_tracing

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/tmp/rag-service.log"),
    ],
)

logger = logging.getLogger(__name__)

# Get settings
settings = get_settings()
app_config = get_app_config()

# Prometheus metrics
REQUEST_COUNT = Counter(
    "rag_service_requests_total",
    "Total number of requests",
    ["method", "endpoint", "status"],
)

REQUEST_DURATION = Histogram(
    "rag_service_request_duration_seconds",
    "Request duration in seconds",
    ["method", "endpoint"],
)

ACTIVE_CONNECTIONS = Gauge(
    "rag_service_active_connections", "Number of active connections"
)

PIPELINE_EXECUTIONS = Counter(
    "rag_pipeline_executions_total",
    "Total number of RAG pipeline executions",
    ["status"],
)

PIPELINE_DURATION = Histogram(
    "rag_pipeline_duration_seconds", "RAG pipeline execution duration in seconds"
)

# Global variables
lifecycle_manager: Optional[LifecycleManager] = None
health_monitor: Optional[HealthMonitor] = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.

    Handles startup and shutdown events for the FastAPI application.
    """
    global lifecycle_manager, health_monitor

    logger.info("Starting SDLC RAG Service...")

    try:
        # Initialize OpenLLMetry / OpenTelemetry GenAI tracing
        # No-op unless OTEL_ENABLED=true with an OTLP endpoint configured.
        init_tracing(service_name=getattr(settings, "app_name", None) or "sdlc-rag")

        # Initialize lifecycle manager
        lifecycle_manager = LifecycleManager()
        await lifecycle_manager.initialize()

        # Initialize health monitor
        health_monitor = HealthMonitor()
        await health_monitor.initialize()

        # Initialize database
        await init_database()

        # Setup performance monitoring
        await setup_performance_monitoring()

        # Initialize services
        await initialize_services()

        logger.info("SDLC RAG Service started successfully")

        yield

    except Exception as e:
        logger.error(f"Failed to start RAG Service: {e}")
        raise
    finally:
        logger.info("Shutting down SDLC RAG Service...")

        # Cleanup services
        await cleanup_services()

        # Close database connections
        await close_database()

        # Shutdown health monitor
        if health_monitor:
            await health_monitor.shutdown()

        # Shutdown lifecycle manager
        if lifecycle_manager:
            await lifecycle_manager.shutdown()

        # Flush OpenLLMetry / OTel spans before exit
        shutdown_tracing()

        logger.info("SDLC RAG Service shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="SDLC RAG Service",
    description="""
    Production-ready Retrieval-Augmented Generation (RAG) service for SDLC.ai platform.

    Features:
    - End-to-end RAG pipeline orchestration
    - Multi-model embedding support
    - Advanced context retrieval and assembly
    - Real-time streaming capabilities
    - Comprehensive error handling
    - Performance monitoring and optimization
    - Health monitoring and metrics
    - API versioning and documentation
    """,
    version=settings.app_version,
    docs_url=settings.docs_url if settings.is_development else None,
    redoc_url=settings.redoc_url if settings.is_development else None,
    openapi_url=settings.openapi_url if settings.is_development else None,
    lifespan=lifespan,
    contact={
        "name": "SDLC.ai Team",
        "email": "support@sdlc.cc",
        "url": "https://sdlc.cc",
    },
    license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
)


# Add middleware
def setup_middleware() -> None:
    """Setup all middleware for the application."""

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_methods,
        allow_headers=settings.cors_headers,
    )

    # Trusted host middleware (for production)
    if settings.is_production:
        trusted_hosts = os.environ.get(
            "TRUSTED_HOSTS", "sdlc.finsavvyai.com,api.sdlc.cc"
        ).split(",")
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=[h.strip() for h in trusted_hosts],
        )

    # GZip compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Performance monitoring middleware
    app.add_middleware(PerformanceMiddleware)

    # Authentication middleware
    if not settings.is_development:
        app.add_middleware(AuthMiddleware)

    logger.info("Middleware setup completed")


# Setup middleware
setup_middleware()

# Setup error handlers
setup_error_handlers(app)

# Include API router
app.include_router(api_router, prefix=settings.api_v1_prefix)


# Root endpoint
@app.get("/", tags=["Root"])
async def root() -> Dict[str, Any]:
    """
    Root endpoint providing basic service information.
    """
    return {
        "service": "SDLC RAG Service",
        "version": settings.app_version,
        "environment": settings.environment,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "healthy",
        "endpoints": {
            "api": settings.api_v1_prefix,
            "docs": settings.docs_url if settings.is_development else None,
            "health": "/health",
            "metrics": "/metrics",
            "openapi": settings.openapi_url if settings.is_development else None,
        },
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, Any]:
    """
    Comprehensive health check endpoint.

    Returns:
        Health status of all service components
    """
    if not health_monitor:
        return {
            "status": "unhealthy",
            "message": "Health monitor not initialized",
            "timestamp": datetime.utcnow().isoformat(),
        }

    health_result = await health_monitor.check_health()

    return {
        "status": health_result.status,
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.app_version,
        "checks": {
            check.name: {
                "status": check.status,
                "message": check.message,
                "response_time_ms": check.response_time_ms,
                "details": check.details,
            }
            for check in health_result.checks
        },
        "uptime_seconds": health_result.uptime_seconds,
        "performance_metrics": health_result.performance_metrics,
    }


# Metrics endpoint for Prometheus
@app.get("/metrics", tags=["Monitoring"])
async def metrics() -> Response:
    """
    Prometheus metrics endpoint.

    Returns:
        Prometheus-formatted metrics
    """
    if not settings.monitoring_enabled:
        raise HTTPException(status_code=404, detail="Metrics collection is disabled")

    # Update active connections gauge
    ACTIVE_CONNECTIONS.set(len(asyncio.all_tasks()))

    # Generate latest metrics
    metrics_data = generate_latest()

    return Response(
        content=metrics_data,
        media_type=CONTENT_TYPE_LATEST,
        headers={"Cache-Control": "no-cache"},
    )


# API info endpoint
@app.get("/info", tags=["Info"])
async def api_info() -> Dict[str, Any]:
    """
    API information endpoint.

    Returns:
        Detailed API information and configuration
    """
    return {
        "service": {
            "name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "debug": settings.debug,
        },
        "api": {
            "prefix": settings.api_v1_prefix,
            "version": "v1",
            "openapi_url": settings.openapi_url,
            "docs_url": settings.docs_url,
            "redoc_url": settings.redoc_url,
        },
        "features": {
            "rate_limiting": settings.rate_limit_enabled,
            "monitoring": settings.monitoring_enabled,
            "dlp_scanning": settings.dlp_enabled,
            "streaming": True,
            "batch_processing": True,
            "file_upload": True,
            "vector_search": True,
        },
        "performance": {
            "max_file_size_mb": settings.max_file_size // (1024 * 1024),
            "chunk_size": settings.chunk_size,
            "batch_size": settings.batch_size,
            "max_concurrent_batches": settings.max_concurrent_batches,
        },
        "models": {
            "embedding": settings.embedding_model,
            "sentence_transformer": settings.sentence_transformer_model,
            "openai_available": settings.openai_api_key is not None,
            "anthropic_available": settings.anthropic_api_key is not None,
        },
    }


# Custom OpenAPI schema
def custom_openapi() -> Dict[str, Any]:
    """
    Generate custom OpenAPI schema with additional information.
    """
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="SDLC RAG Service API",
        version=settings.app_version,
        description="Production-ready RAG service for SDLC.ai platform",
        routes=app.routes,
        servers=[
            {
                "url": f"http://{settings.host}:{settings.port}{settings.api_v1_prefix}",
                "description": "Development server",
            },
            {"url": "https://api.sdlc.cc/rag", "description": "Production server"},
        ],
    )

    # Add custom information
    openapi_schema["info"]["x-api-id"] = str(uuid.uuid4())
    openapi_schema["info"]["x-service-name"] = settings.app_name
    openapi_schema["info"]["x-environment"] = settings.environment

    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }

    # Add global security requirement (except for development)
    if not settings.is_development:
        openapi_schema["security"] = [{"bearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# Request/response logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    """
    Log all requests and responses.
    """
    start_time = time.time()

    # Generate request ID
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id

    # Log request
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} - "
        f"Client: {request.client.host if request.client else 'unknown'}"
    )

    # Process request
    try:
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log response
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Duration: {duration:.3f}s"
        )

        # Update metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()

        REQUEST_DURATION.labels(
            method=request.method, endpoint=request.url.path
        ).observe(duration)

        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration:.3f}"

        return response

    except Exception as e:
        duration = time.time() - start_time

        logger.error(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Error: {str(e)} - "
            f"Duration: {duration:.3f}s"
        )

        # Update metrics
        REQUEST_COUNT.labels(
            method=request.method, endpoint=request.url.path, status=500
        ).inc()

        raise


# Service initialization functions
async def initialize_services() -> None:
    """
    Initialize all service components.
    """
    logger.info("Initializing service components...")

    try:
        # Initialize embedding service
        # This would be done through dependency injection in production

        # Initialize vector search service
        # This would be done through dependency injection in production

        # Initialize background tasks
        # This would be done through dependency injection in production

        logger.info("Service components initialized successfully")

    except Exception as e:
        logger.error(f"Failed to initialize service components: {e}")
        raise


async def cleanup_services() -> None:
    """
    Cleanup all service components.
    """
    logger.info("Cleaning up service components...")

    try:
        # Cancel background tasks
        # This would be done through dependency injection in production

        # Close service connections
        # This would be done through dependency injection in production

        logger.info("Service components cleaned up successfully")

    except Exception as e:
        logger.error(f"Failed to cleanup service components: {e}")


# Graceful shutdown handling
def setup_signal_handlers() -> None:
    """
    Setup signal handlers for graceful shutdown.
    """

    def handle_signal(signum, frame):
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        # This will be handled by FastAPI's lifespan manager

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)


# Setup signal handlers
setup_signal_handlers()


# Development server configuration
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else settings.workers,
        log_level=settings.log_level.lower(),
        access_log=True,
        use_colors=True,
        limit_concurrency=1000,
        limit_max_requests=10000,
        timeout_keep_alive=30,
        ssl_keyfile=None,
        ssl_certfile=None,
    )
