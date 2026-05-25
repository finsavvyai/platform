"""Channel management API routes — CRUD for channel configurations."""

import logging
import time
import uuid
from typing import Any, Dict

from aiohttp import web

from src.channels.credential_validator import validate_credentials

logger = logging.getLogger("finsavvyai.api.channels")

# In-memory channel store (production would use a database)
_channel_store: Dict[str, Dict[str, Any]] = {}


def _get_store() -> Dict[str, Dict[str, Any]]:
    return _channel_store


async def handle_list_channels(request: web.Request) -> web.Response:
    """GET /v1/channels — list all configured channels with health status."""
    store = _get_store()
    channels = []
    for cid, config in store.items():
        entry = {
            "id": cid,
            "type": config["type"],
            "name": config.get("name", ""),
            "status": config.get("status", "unknown"),
            "created_at": config.get("created_at", ""),
        }
        channels.append(entry)
    return web.json_response({"channels": channels, "total": len(channels)})


async def handle_add_channel(request: web.Request) -> web.Response:
    """POST /v1/channels — add a new channel configuration."""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON body"}, status=400)

    channel_type = data.get("type", "").strip().lower()
    if channel_type not in ("slack", "telegram", "whatsapp"):
        return web.json_response(
            {"error": "Invalid channel type. Must be: slack, telegram, whatsapp"},
            status=400,
        )

    name = data.get("name", f"{channel_type}-channel")
    credentials = data.get("credentials", {})
    if not credentials:
        return web.json_response(
            {"error": "Credentials are required"},
            status=400,
        )

    # Validate credentials in real time
    validation = await validate_credentials(channel_type, credentials)
    if not validation.get("valid"):
        return web.json_response(
            {
                "error": "Credential validation failed",
                "details": validation.get("error", "Unknown error"),
                "help": _credential_help(channel_type),
            },
            status=422,
        )

    channel_id = f"ch-{uuid.uuid4().hex[:8]}"
    store = _get_store()
    store[channel_id] = {
        "type": channel_type,
        "name": name,
        "credentials": credentials,
        "status": "connected",
        "created_at": time.time(),
        "validation": validation,
    }
    logger.info("Channel added: %s (%s)", channel_id, channel_type)
    return web.json_response(
        {"id": channel_id, "type": channel_type, "status": "connected", "validation": validation},
        status=201,
    )


async def handle_delete_channel(request: web.Request) -> web.Response:
    """DELETE /v1/channels/{id} — remove a channel."""
    channel_id = request.match_info.get("id", "")
    store = _get_store()
    if channel_id not in store:
        return web.json_response({"error": "Channel not found"}, status=404)
    del store[channel_id]
    logger.info("Channel removed: %s", channel_id)
    return web.json_response({"status": "deleted", "id": channel_id})


async def handle_test_channel(request: web.Request) -> web.Response:
    """POST /v1/channels/{id}/test — validate channel credentials."""
    channel_id = request.match_info.get("id", "")
    store = _get_store()
    config = store.get(channel_id)
    if not config:
        return web.json_response({"error": "Channel not found"}, status=404)

    validation = await validate_credentials(config["type"], config["credentials"])
    config["status"] = "connected" if validation.get("valid") else "error"
    return web.json_response({"id": channel_id, "validation": validation})


def _credential_help(channel_type: str) -> str:
    """Return actionable help text for credential errors."""
    help_text = {
        "slack": "Provide bot_token (xoxb-...) and signing_secret from Slack App settings",
        "telegram": "Provide bot_token from @BotFather",
        "whatsapp": "Provide webhook_url and verify_token from Meta Business settings",
    }
    return help_text.get(channel_type, "Check your credentials")


def register_channel_routes(app: web.Application) -> None:
    """Register channel management routes on the app."""
    app.router.add_get("/v1/channels", handle_list_channels)
    app.router.add_post("/v1/channels", handle_add_channel)
    app.router.add_delete("/v1/channels/{id}", handle_delete_channel)
    app.router.add_post("/v1/channels/{id}/test", handle_test_channel)
    logger.info("Channel management routes registered")
