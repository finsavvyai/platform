"""Rate limiting middleware using token bucket algorithm."""

import aiohttp.web
from aiohttp import web

from src.core.rate_limiter import get_client_identifier


def rate_limit_middleware_factory(rate_limiter, config):
    """Return rate-limiting middleware bound to the given limiter and config."""

    @aiohttp.web.middleware
    async def rate_limit_middleware(request, handler):
        _no_rate_limit = {"/health", "/", "/metrics", "/docs", "/openapi.json", "/api/versions"}
        if request.path in _no_rate_limit:
            return await handler(request)

        if config.get("api.rate_limit_enabled", True):
            client_id = get_client_identifier(request)
            allowed, remaining = rate_limiter.is_allowed(client_id)

            if not allowed:
                return web.json_response(
                    {
                        "error": "Rate limit exceeded",
                        "message": (
                            f"Too many requests. Limit: {rate_limiter.max_requests} "
                            f"per {rate_limiter.window_seconds}s"
                        ),
                    },
                    status=429,
                    headers={
                        "X-RateLimit-Limit": str(rate_limiter.max_requests),
                        "X-RateLimit-Remaining": "0",
                        "Retry-After": str(rate_limiter.window_seconds),
                    },
                )

            response = await handler(request)
            response.headers["X-RateLimit-Limit"] = str(rate_limiter.max_requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            return response

        return await handler(request)

    return rate_limit_middleware
