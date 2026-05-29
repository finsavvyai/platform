"""
Main FastAPI application for SDLC.ai DLP Service.

This module sets up the FastAPI application with middleware, dependencies,
and route registration for the DLP management API.
"""

import logging
import time
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import structlog

from app.core.config import get_settings
from app.api.routes import (
    scans,
    policies,
    rules,
    patterns,
    violations,
    reports,
    health,
    metrics,
)
from app.services.real_time_scanner import get_real_time_scanner
from app.services.violation_reporter import get_violation_reporter

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    "dlp_requests_total",
    "Total DLP API requests",
    ["method", "endpoint", "status_code"],
)

REQUEST_DURATION = Histogram(
    "dlp_request_duration_seconds", "DLP API request duration", ["method", "endpoint"]
)

SCAN_DURATION = Histogram(
    "dlp_scan_duration_seconds", "DLP scan duration", ["scan_type", "content_type"]
)

VIOLATION_COUNT = Counter(
    "dlp_violations_total",
    "Total DLP violations detected",
    ["severity", "type", "tenant_id"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    settings = get_settings()

    # Startup
    logger.info("Starting DLP Service", version=settings.service_version)

    try:
        # Start real-time scanner
        scanner = get_real_time_scanner()
        await scanner.start()
        logger.info("Real-time scanner started")

        # Start violation reporter
        reporter = get_violation_reporter()
        await reporter.start()
        logger.info("Violation reporter started")

        logger.info("DLP Service startup completed")

    except Exception as e:
        logger.error("Failed to start DLP Service", error=str(e))
        raise

    yield

    # Shutdown
    logger.info("Shutting down DLP Service")

    try:
        # Stop services
        await scanner.stop()
        await reporter.stop()

        logger.info("DLP Service shutdown completed")

    except Exception as e:
        logger.error("Error during shutdown", error=str(e))


# Create FastAPI application
settings = get_settings()
app = FastAPI(
    title="SDLC.ai DLP Service API",
    description="Comprehensive Data Loss Prevention scanning pipeline with PII detection, regex pattern matching, ML-based content classification, and real-time violation reporting.",
    version=settings.service_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware
if settings.environment == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"],  # Configure based on your deployment
    )


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Request logging and metrics middleware."""
    start_time = time.time()

    # Generate request ID
    request_id = f"req_{int(time.time() * 1000)}_{id(request)}"

    # Log request
    logger.info(
        "Request started",
        request_id=request_id,
        method=request.method,
        url=str(request.url),
        client_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Update metrics
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status_code=response.status_code,
    ).inc()

    REQUEST_DURATION.labels(method=request.method, endpoint=request.url.path).observe(
        duration
    )

    # Log response
    logger.info(
        "Request completed",
        request_id=request_id,
        status_code=response.status_code,
        duration_ms=duration * 1000,
    )

    # Add request ID to response headers
    response.headers["X-Request-ID"] = request_id

    return response


@app.middleware("http")
async def error_handling_middleware(request: Request, call_next):
    """Global error handling middleware."""
    try:
        return await call_next(request)

    except Exception as e:
        logger.error(
            "Unhandled error",
            method=request.method,
            url=str(request.url),
            error=str(e),
            exc_info=True,
        )

        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "message": "An internal server error occurred",
                "request_id": request.headers.get("X-Request-ID"),
            },
        )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """404 error handler."""
    return JSONResponse(
        status_code=404,
        content={
            "error": "NotFound",
            "message": "The requested resource was not found",
            "path": str(request.url.path),
        },
    )


@app.exception_handler(422)
async def validation_error_handler(request: Request, exc):
    """422 validation error handler."""
    return JSONResponse(
        status_code=422,
        content={
            "error": "ValidationError",
            "message": "Invalid request parameters",
            "details": exc.errors() if hasattr(exc, "errors") else [],
        },
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.service_name,
        "version": settings.service_version,
        "timestamp": time.time(),
    }


# Metrics endpoint
@app.get("/metrics", tags=["Metrics"])
async def metrics():
    """Prometheus metrics endpoint."""
    if not settings.metrics_enabled:
        return JSONResponse(status_code=404, content={"error": "Metrics not enabled"})

    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


# Include API routes
api_prefix = settings.api_prefix

app.include_router(scans.router, prefix=f"{api_prefix}/scans", tags=["Scanning"])

app.include_router(policies.router, prefix=f"{api_prefix}/policies", tags=["Policies"])

app.include_router(rules.router, prefix=f"{api_prefix}/rules", tags=["Rules"])

app.include_router(patterns.router, prefix=f"{api_prefix}/patterns", tags=["Patterns"])

app.include_router(
    violations.router, prefix=f"{api_prefix}/violations", tags=["Violations"]
)

app.include_router(reports.router, prefix=f"{api_prefix}/reports", tags=["Reports"])

app.include_router(health.router, prefix=f"{api_prefix}/health", tags=["Health"])

app.include_router(metrics.router, prefix=f"{api_prefix}/metrics", tags=["Metrics"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=True,
    )
