"""FastAPI application for FinSavvyAI Wave 1.

Includes auth, payment, and landing page APIs.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.middleware.security_headers import SECURITY_HEADERS
from src.api.settings import get_settings
from src.auth.routes import router as auth_router
from src.landing.routes import router as landing_router
from src.payment.routes import router as payment_router

logger = logging.getLogger("finsavvyai.api")
LANDING_PAGE = Path(__file__).resolve().parents[2] / "landing-page" / "index.html"


def _prefers_html(request: Request) -> bool:
    accept = request.headers.get("accept", "").lower()
    return "text/html" in accept and "application/json" not in accept


def _error_response(status_code: int, detail: object) -> JSONResponse:
    """Return a normalized API error payload."""
    payload = detail if detail is not None else "Request failed"
    return JSONResponse(status_code=status_code, content={"detail": payload})


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context for FastAPI startup/shutdown."""
    settings = get_settings()
    settings.validate()
    logger.info("FinSavvyAI API starting up")
    yield
    logger.info("FinSavvyAI API shutting down")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    app = FastAPI(
        title="FinSavvyAI",
        description="Financial analysis with AI intelligence",
        version=settings.version,
        lifespan=lifespan,
    )

    cors_origins = ["*"] if settings.wildcard_cors else list(settings.cors_origins)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=settings.allow_credentials and not settings.wildcard_cors,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Webhook-Signature"],
    )

    # Include routers
    app.include_router(auth_router)
    app.include_router(payment_router)
    app.include_router(landing_router)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "service": "finsavvyai-api",
            "environment": settings.environment,
            "auth_enabled": settings.auth_enabled,
        }

    @app.get("/ready")
    async def readiness_check():
        """Readiness endpoint for deployments."""
        return {"status": "ready", "service": "finsavvyai-api"}

    @app.get("/alive")
    async def liveness_check():
        """Liveness endpoint for deployments."""
        return {"status": "alive", "service": "finsavvyai-api"}

    @app.get("/landing")
    async def landing_page():
        """Serve the production landing page."""
        if not LANDING_PAGE.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Landing page missing"
            )
        return FileResponse(LANDING_PAGE)

    @app.get("/")
    async def root(request: Request):
        """Root endpoint with API info or landing page for browsers."""
        if LANDING_PAGE.exists() and _prefers_html(request):
            return FileResponse(LANDING_PAGE)
        return {
            "name": "FinSavvyAI",
            "version": settings.version,
            "docs": "/docs",
            "openapi": "/openapi.json",
        }

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException):
        """Normalize HTTP exceptions as JSON responses."""
        return _error_response(exc.status_code, exc.detail)

    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(_: Request, exc: StarletteHTTPException):
        """Normalize Starlette-generated HTTP exceptions (e.g., 404)."""
        return _error_response(exc.status_code, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError):
        """Normalize request validation failures (422)."""
        return _error_response(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.errors())

    @app.exception_handler(Exception)
    async def global_exception_handler(_: Request, exc: Exception):
        """Global exception handler."""
        logger.exception("Unhandled exception")
        return _error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")

    return app
