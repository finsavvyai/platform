#!/usr/bin/env python3
"""
API Versioning Strategy for FinSavvyAI

Supports URL-based versioning (/v1/, /v2/) with:
- Deprecation headers on older versions
- Sunset dates for retired versions
- Version negotiation via Accept-Version header
- Automatic redirect from unversioned paths
"""

from datetime import datetime
from enum import Enum
from typing import Dict, Optional

from aiohttp import web

from src.core.logger import get_logger

logger = get_logger()

# Current API versions
CURRENT_VERSION = "v1"
SUPPORTED_VERSIONS = ["v1"]
DEPRECATED_VERSIONS: Dict[str, str] = {}  # version -> sunset date (ISO 8601)
LATEST_VERSION = "v1"


class APIVersion(Enum):
    V1 = "v1"


def get_version_from_path(path: str) -> Optional[str]:
    """Extract API version from URL path."""
    parts = path.strip("/").split("/")
    if parts and parts[0] in SUPPORTED_VERSIONS:
        return parts[0]
    return None


def get_version_from_header(request: web.Request) -> Optional[str]:
    """Extract API version from Accept-Version header."""
    version = request.headers.get("Accept-Version")
    if version and version in SUPPORTED_VERSIONS:
        return version
    return None


def strip_version_prefix(path: str, version: str) -> str:
    """Remove version prefix from path, returning the resource path."""
    prefix = f"/{version}/"
    if path.startswith(prefix):
        return "/" + path[len(prefix) :]
    return path


def add_version_headers(response: web.Response, version: str) -> web.Response:
    """Add API versioning headers to response."""
    response.headers["X-API-Version"] = version
    response.headers["X-API-Supported-Versions"] = ", ".join(SUPPORTED_VERSIONS)
    response.headers["X-API-Latest-Version"] = LATEST_VERSION

    # Add deprecation headers if version is deprecated
    if version in DEPRECATED_VERSIONS:
        sunset_date = DEPRECATED_VERSIONS[version]
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = sunset_date
        response.headers["Link"] = f'</{LATEST_VERSION}/>; rel="successor-version"'

    return response


def version_middleware_factory(supported_versions=None):
    """Create middleware that adds version headers to all API responses."""
    versions = supported_versions or SUPPORTED_VERSIONS

    @web.middleware
    async def version_middleware(request, handler):
        response = await handler(request)

        # Determine version from path
        version = get_version_from_path(request.path)
        if version and version in versions:
            add_version_headers(response, version)

        return response

    return version_middleware


def register_versioned_routes(app: web.Application, version: str, routes: list):
    """Register routes under a version prefix.

    Args:
        app: aiohttp Application
        version: Version string (e.g., "v1")
        routes: List of (method, path, handler) tuples.
                Paths should NOT include the version prefix.
    """
    for method, path, handler in routes:
        versioned_path = f"/{version}{path}"
        if method.upper() == "GET":
            app.router.add_get(versioned_path, handler)
        elif method.upper() == "POST":
            app.router.add_post(versioned_path, handler)
        elif method.upper() == "PUT":
            app.router.add_put(versioned_path, handler)
        elif method.upper() == "DELETE":
            app.router.add_delete(versioned_path, handler)
        elif method.upper() == "PATCH":
            app.router.add_patch(versioned_path, handler)

    logger.info(
        f"Registered {len(routes)} routes for API {version}",
        version=version,
        route_count=len(routes),
    )
