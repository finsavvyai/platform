"""
OpenClaw incoming webhook handler: verify signature, idempotency, create task/chat.

Keep file under 200 lines. Called from API endpoint.
"""

import hashlib
import hmac
import logging
from typing import Any, Dict, Optional

from app.core.integrations_config import get_openclaw_settings
from app.core.redis import redis_client

logger = logging.getLogger(__name__)
IDEMPOTENCY_TTL_SECONDS = 86400
IDEMPOTENCY_KEY_PREFIX = "openclaw:idempotency:"


def verify_signature(payload: bytes, signature_header: Optional[str], secret: Optional[str]) -> bool:
    if not secret or not signature_header:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())


async def is_duplicate(message_id: str) -> bool:
    key = f"{IDEMPOTENCY_KEY_PREFIX}{message_id}"
    try:
        existing = await redis_client.get(key, deserialize=False)
        return existing is not None
    except Exception as e:
        logger.warning("Redis idempotency check failed: %s", e)
        return False


async def set_idempotency_done(message_id: str) -> None:
    key = f"{IDEMPOTENCY_KEY_PREFIX}{message_id}"
    try:
        await redis_client.set(key, "1", expire=IDEMPOTENCY_TTL_SECONDS, serialize=False)
    except Exception as e:
        logger.warning("Redis idempotency set failed: %s", e)


def parse_incoming(body: Dict[str, Any]) -> Dict[str, Any]:
    """Extract message_id, channel_id, user_id, text, tenant mapping hints."""
    message_id = body.get("message_id") or body.get("id") or body.get("event_id")
    channel_id = body.get("channel_id") or body.get("channel")
    user_id = body.get("user_id") or body.get("user") or body.get("sender_id")
    text = body.get("text") or body.get("message") or body.get("content") or ""
    if isinstance(text, dict):
        text = text.get("text") or text.get("body") or ""
    return {
        "message_id": str(message_id) if message_id else None,
        "channel_id": str(channel_id) if channel_id else None,
        "user_id": str(user_id) if user_id else None,
        "text": str(text).strip(),
        "raw": body,
    }


async def process_incoming(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create task or chat message from OpenClaw payload. Returns summary for response.
    Minimal implementation: log and return; full implementation would enqueue to task/chat.
    """
    message_id = parsed.get("message_id")
    text = parsed.get("text")
    logger.info("OpenClaw incoming message_id=%s text_len=%s", message_id, len(text or ""))
    await set_idempotency_done(message_id or "unknown")
    return {
        "received": True,
        "message_id": message_id,
        "action": "logged",
        "note": "Task/chat enqueue can be wired to workflow or chat API here",
    }
