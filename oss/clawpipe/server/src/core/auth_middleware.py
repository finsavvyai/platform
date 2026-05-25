#!/usr/bin/env python3
"""
FinSavvyAI Auth Middleware

Request key extraction, auth-mode resolution, and authentication decorator.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger("finsavvyai.auth")


def get_api_key_from_request(request) -> Optional[str]:
    """Extract API key from request headers."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    api_key = request.headers.get("X-API-Key")
    if api_key:
        return api_key.strip()

    return None


def resolve_auth_mode(config) -> str:
    """Resolve effective auth mode from env vars and config.

    Priority:
      1. FINSAVVYAI_AUTH_MODE env var (highest)
      2. FINSAVVYAI_AUTH_ENABLED env var (legacy compat)
      3. config api.auth_mode
    """
    env_mode = os.getenv("FINSAVVYAI_AUTH_MODE")
    if env_mode is not None:
        return env_mode.lower()

    env_auth = os.getenv("FINSAVVYAI_AUTH_ENABLED")
    if env_auth is not None:
        return "service" if env_auth.lower() == "true" else "none"

    return config.get("api.auth_mode", "service")


def require_auth(handler):
    """Decorator to require API key authentication."""

    async def wrapper(request):
        # Skip auth for health checks
        if request.path in ["/health", "/"]:
            return await handler(request)

        from src.core.config import ClusterConfig

        config = ClusterConfig()
        mode = resolve_auth_mode(config)

        if mode == "none":
            return await handler(request)

        api_key = get_api_key_from_request(request)
        if not api_key:
            if mode == "dev":
                logger.warning("Dev mode: missing API key on %s", request.path)
                return await handler(request)
            from aiohttp import web

            return web.json_response(
                {
                    "error": "Unauthorized",
                    "message": "API key required. Include in Authorization: Bearer <key> header",
                },
                status=401,
            )

        from src.core.auth import APIKeyManager

        key_manager = APIKeyManager()
        if not key_manager.validate_key(api_key):
            if mode == "dev":
                logger.warning("Dev mode: invalid API key on %s", request.path)
                return await handler(request)
            from aiohttp import web

            return web.json_response(
                {"error": "Unauthorized", "message": "Invalid API key"},
                status=401,
            )

        return await handler(request)

    return wrapper
