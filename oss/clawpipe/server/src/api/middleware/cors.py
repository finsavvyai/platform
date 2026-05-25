"""CORS middleware with configurable allowed origins."""

import os

import aiohttp.web


def cors_middleware_factory():
    """Return CORS middleware using FINSAVVYAI_CORS_ORIGINS env var."""
    allowed_origins = os.environ.get("FINSAVVYAI_CORS_ORIGINS", "*")

    @aiohttp.web.middleware
    async def cors_middleware(request, handler):
        if request.method == "OPTIONS":
            response = aiohttp.web.Response()
        else:
            response = await handler(request)

        origin = request.headers.get("Origin", "")
        if allowed_origins == "*":
            response.headers["Access-Control-Allow-Origin"] = "*"
        elif origin and origin in [o.strip() for o in allowed_origins.split(",")]:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"

        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-API-Key, X-Request-ID"
        )
        return response

    return cors_middleware
