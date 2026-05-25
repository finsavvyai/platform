"""Worker node auth middleware factory."""

import logging

import aiohttp.web

from src.core.auth import APIKeyManager
from src.core.auth_middleware import get_api_key_from_request, resolve_auth_mode

logger = logging.getLogger("finsavvyai.worker.auth")

_PUBLIC_PATHS = {"/health", "/status", "/metrics", "/"}


def worker_auth_middleware(cluster_config):
    """Return an aiohttp middleware that enforces auth on worker endpoints."""

    @aiohttp.web.middleware
    async def middleware(request: aiohttp.web.Request, handler):
        if request.method == "OPTIONS" or request.path in _PUBLIC_PATHS:
            return await handler(request)

        mode = resolve_auth_mode(cluster_config)
        if mode == "none":
            return await handler(request)

        api_key = get_api_key_from_request(request)
        if not api_key:
            if mode == "dev":
                logger.warning("Dev mode: missing key on %s", request.path)
                return await handler(request)
            return aiohttp.web.json_response(
                {"error": "Unauthorized", "message": "API key required"},
                status=401,
            )

        if not APIKeyManager().validate_key(api_key):
            if mode == "dev":
                logger.warning("Dev mode: invalid key on %s", request.path)
                return await handler(request)
            return aiohttp.web.json_response(
                {"error": "Unauthorized", "message": "Invalid API key"},
                status=401,
            )

        return await handler(request)

    return middleware
