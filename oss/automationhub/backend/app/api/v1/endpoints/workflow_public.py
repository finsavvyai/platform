"""
Public workflow endpoints (no auth). For share links and template gallery.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Request

from app.core.redis import redis_client

logger = logging.getLogger(__name__)
router = APIRouter()
SHARE_PREFIX = "workflow_share:"
DEMO_RATE_LIMIT = 10
DEMO_RATE_WINDOW = 60

DEMO_WORKFLOW = {
    "name": "Demo: Hello Automation",
    "description": "A simple demo workflow. Sign up to create and run your own.",
    "nodes": [
        {"id": "start-1", "type": "start", "name": "Start", "config": {}, "position": {"x": 100, "y": 100}},
        {"id": "end-1", "type": "end", "name": "End", "config": {}, "position": {"x": 300, "y": 100}},
    ],
    "connections": [
        {"source_node_id": "start-1", "source_output": "default", "target_node_id": "end-1", "target_input": "default"},
    ],
    "variables": {},
    "triggers": [],
    "settings": {},
}


async def _check_demo_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"demo_rate:{ip}"
    try:
        raw = await redis_client.get(key)
        count = int(raw) if raw else 0
        if count >= DEMO_RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Too many demo requests. Try again later.")
        await redis_client.set(key, str(count + 1), expire=DEMO_RATE_WINDOW)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Demo rate limit check failed: %s", e)


@router.get("/demo")
async def get_demo_workflow(request: Request):
    """Return read-only demo workflow. Rate-limited by IP."""
    await _check_demo_rate_limit(request)
    return DEMO_WORKFLOW


@router.get("/t/{token}")
async def get_shared_workflow(token: str):
    """Return workflow snapshot for a share token. Public."""
    key = f"{SHARE_PREFIX}{token}"
    raw = await redis_client.get(key)
    if not raw:
        raise HTTPException(status_code=404, detail="Link expired or invalid")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid data")
    return {
        "name": data.get("name", "Shared workflow"),
        "description": data.get("description"),
        "nodes": data.get("nodes", []),
        "connections": data.get("connections", []),
        "variables": data.get("variables", {}),
        "triggers": data.get("triggers", []),
        "settings": data.get("settings", {}),
    }
