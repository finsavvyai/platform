"""
Main FastAPI application for Universal Dependency Platform.
"""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request
from starlette.responses import Response
from udp.api.v1 import api_router
from udp.core.config import settings
from udp.infrastructure.database import close_db, init_db
from udp.monitoring.logging_config import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Initialize Sentry if DSN is provided
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
        environment="production" if not settings.DEBUG else "development",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    logger.info("Starting Universal Dependency Platform...")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Add startup tasks here
    logger.info("Application startup complete")

    yield

    # Cleanup
    logger.info("Shutting down Universal Dependency Platform...")
    await close_db()
    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise-grade dependency management platform with intelligent workflow orchestration",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Add security middleware stack
from ..api.middleware.error_handler import ErrorHandlerMiddleware
from ..api.middleware.security import (
    AuditLoggingMiddleware,
    RateLimitMiddleware,
    RequestValidationMiddleware,
    SecurityHeadersMiddleware,
)
from ..api.middleware.security import (
    CORSMiddleware as CustomCORSMiddleware,
)

# Add error handler first (outermost middleware - catches all errors)
app.add_middleware(ErrorHandlerMiddleware)

# Add audit logging
app.add_middleware(AuditLoggingMiddleware)

# Add request validation
app.add_middleware(RequestValidationMiddleware)

# Add rate limiting
app.add_middleware(RateLimitMiddleware)

# Add custom CORS middleware
app.add_middleware(
    CustomCORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
)

# Add security headers
app.add_middleware(SecurityHeadersMiddleware, https_enabled=not settings.DEBUG)

# Add FastAPI CORS middleware as fallback
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware for security
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "*.upm.com"]
    )


# Include API routers
app.include_router(api_router, prefix=settings.API_V1_STR)

# Include WebSocket router
from udp.api.websocket import router as websocket_router

app.include_router(websocket_router)

# Include website routes (no prefix for marketing pages)
from udp.api.routes.website import router as website_router

app.include_router(website_router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing information."""
    import time

    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time:.4f}s"
    )

    response.headers["X-Process-Time"] = str(process_time)
    return response


@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns basic health status without checking dependencies.
    This is a lightweight check for load balancers.
    """
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": "development" if settings.DEBUG else "production",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/ready")
async def readiness_check():
    """
    Readiness check endpoint.

    Checks database and Redis connectivity to determine if the
    application is ready to handle requests.
    """
    checks = {"status": "ready", "checks": {}}

    # Check database connectivity
    try:
        from udp.infrastructure.database import get_async_session

        async with get_async_session() as session:
            # Simple query to test connection
            from sqlalchemy import text

            result = await session.execute(text("SELECT 1"))
            checks["checks"]["database"] = "ok"
    except Exception as e:
        checks["status"] = "not_ready"
        checks["checks"]["database"] = f"error: {str(e)}"
        logger.warning(f"Database readiness check failed: {e}")

    # Check Redis connectivity
    try:
        from udp.infrastructure.redis import get_redis_client

        redis_client = await get_redis_client()
        await redis_client.ping()
        checks["checks"]["redis"] = "ok"
    except Exception as e:
        checks["status"] = "not_ready"
        checks["checks"]["redis"] = f"error: {str(e)}"
        logger.warning(f"Redis readiness check failed: {e}")

    # Overall ready status
    if all(v == "ok" for v in checks["checks"].values()):
        checks["status"] = "ready"
    else:
        checks["status"] = "not_ready"

    return checks


@app.get("/metrics")
async def metrics():
    """
    Prometheus metrics endpoint.

    Exposes Prometheus metrics in the standard text format.
    Includes both system metrics and custom UPM business metrics.
    """
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

    # Include custom UPM metrics

    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/")
async def root(request: Request):
    """Root endpoint - serves landing page."""
    import os
    from pathlib import Path

    from fastapi.templating import Jinja2Templates

    # Calculate template directory - go up from src/udp/api/main.py to project root
    # Path: src/udp/api/main.py -> src/udp/api -> src/udp -> src -> project_root
    project_root = Path(__file__).parent.parent.parent.parent
    templates_dir = project_root / "templates" / "website"

    # Fallback to current working directory if path calculation fails
    if not templates_dir.exists():
        cwd = Path(os.getcwd())
        templates_dir = cwd / "templates" / "website"
        if not templates_dir.exists():
            # Last resort: try relative to current file
            templates_dir = (
                Path(__file__).parent.parent.parent.parent / "templates" / "website"
            )

    templates = Jinja2Templates(directory=str(templates_dir))
    return templates.TemplateResponse("index.html", {"request": request})


def create_app() -> FastAPI:
    """Application factory for testing and programmatic use."""
    return app


def run_server(host: str = "0.0.0.0", port: int = 8040):
    """Run the FastAPI server."""
    import uvicorn

    uvicorn.run(
        "udp.api.main:app",
        host=host,
        port=port,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    run_server()
