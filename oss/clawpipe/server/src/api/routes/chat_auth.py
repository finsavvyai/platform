"""Auth helpers for chat completions route."""

import hashlib
import time

from aiohttp import web

from src.core.audit import AuditAction, get_audit_logger
from src.core.auth import get_api_key_from_request


async def check_chat_auth(gateway, request):
    """Validate API auth for chat requests when auth is enabled."""
    if not gateway.config.get("api.auth_enabled", False):
        return None

    request_id = request.get("request_id", "unknown")
    audit = get_audit_logger("gateway")
    api_key = get_api_key_from_request(request)
    if not api_key:
        audit.log(
            AuditAction.AUTH_FAILURE,
            resource="/v1/chat/completions",
            detail={"reason": "missing_key"},
            outcome="failure",
            client_ip=request.remote,
        )
        return web.json_response(
            {"error": "Unauthorized", "message": "API key required"},
            status=401,
        )

    key_hash = hashlib.sha256(api_key.encode()).hexdigest()[:16]
    now = time.monotonic()
    cached_expiry = gateway._auth_cache.get(key_hash)
    if not (cached_expiry and now < cached_expiry):
        from src.core.auth import APIKeyManager

        key_manager = APIKeyManager()
        if not key_manager.validate_key(api_key):
            gateway._auth_cache.pop(key_hash, None)
            audit.log(
                AuditAction.AUTH_FAILURE,
                actor=api_key[:16] if len(api_key) >= 16 else "unknown",
                resource="/v1/chat/completions",
                detail={"reason": "invalid_key"},
                outcome="failure",
                client_ip=request.remote,
            )
            return web.json_response(
                {"error": "Unauthorized", "message": "Invalid API key"},
                status=401,
            )
        gateway._auth_cache[key_hash] = now + gateway._auth_cache_ttl

    audit.log(
        AuditAction.AUTH_SUCCESS,
        actor=api_key[:16],
        resource="/v1/chat/completions",
        detail={"request_id": request_id},
        client_ip=request.remote,
    )
    return None
