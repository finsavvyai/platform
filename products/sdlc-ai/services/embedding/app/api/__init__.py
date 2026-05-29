"""
API layer package.

This package provides RESTful API endpoints for the embedding service
with FastAPI integration, authentication, and comprehensive documentation.
"""

from .main import app
from .routes import embedding_router, batch_router, admin_router, metrics_router
from .dependencies import get_embedding_service, get_current_user
from .middleware import logging_middleware, rate_limit_middleware, auth_middleware

__all__ = [
    "app",
    "embedding_router",
    "batch_router",
    "admin_router",
    "metrics_router",
    "get_embedding_service",
    "get_current_user",
    "logging_middleware",
    "rate_limit_middleware",
    "auth_middleware",
]
