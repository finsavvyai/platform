"""
API endpoints for external integrations (OpenClaw webhook, integration status).

Keep file under 200 lines.
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Request, Header, HTTPException, status

from app.core.integrations_config import get_openclaw_settings, get_openhands_settings
from app.integrations.openclaw_webhook import (
    verify_signature,
    is_duplicate,
    parse_incoming,
    process_incoming,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post("/openclaw/incoming")
async def openclaw_incoming(
    request: Request,
    x_openclaw_signature: str | None = Header(default=None, alias="X-OpenClaw-Signature"),
) -> Dict[str, Any]:
    """Receive incoming messages from OpenClaw. Requires OPENCLAW_ENABLED and valid signature."""
    settings = get_openclaw_settings()
    if not settings.ENABLED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OpenClaw integration disabled")
    body = await request.body()
    if not verify_signature(body, x_openclaw_signature, settings.WEBHOOK_SECRET):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")
    parsed = parse_incoming(data)
    message_id = parsed.get("message_id")
    if message_id and await is_duplicate(message_id):
        return {"received": True, "duplicate": True, "message_id": message_id}
    result = await process_incoming(parsed)
    return result


@router.get("/status")
async def integrations_status() -> Dict[str, Any]:
    """Status of embedded integrations (internal use)."""
    openclaw = get_openclaw_settings()
    openhands = get_openhands_settings()
    return {
        "openclaw": {
            "enabled": openclaw.ENABLED,
            "webhook_configured": bool(openclaw.WEBHOOK_SECRET),
            "outbound_configured": bool(openclaw.API_URL and openclaw.API_KEY),
        },
        "openhands": {
            "enabled": openhands.ENABLED,
            "mode": openhands.MODE,
            "configured": bool(openhands.API_KEY and (openhands.API_URL or openhands.MODE == "sdk")),
        },
    }
