"""
Workflow share and public template endpoints.
Enables share-by-link and duplicate-from-share for viral growth.
"""

import json
import logging
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.redis import redis_client
from app.schemas.auth import User
from app.services.workflow_engine import workflow_engine

logger = logging.getLogger(__name__)

router = APIRouter()
SHARE_PREFIX = "workflow_share:"
SHARE_TTL_DAYS = 7


class ShareResponse(BaseModel):
    share_url: str
    token: str
    expires_in_days: int = SHARE_TTL_DAYS


class FromShareRequest(BaseModel):
    token: str = Field(..., min_length=1)


@router.post("/{workflow_id}/share", response_model=ShareResponse)
async def create_share(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user),
):
    """Create a shareable link for a workflow. Link is public read-only."""
    workflow = await workflow_engine.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if workflow.created_by and workflow.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to share this workflow")
    token = secrets.token_urlsafe(24)
    payload = {
        "name": workflow.name,
        "description": workflow.description,
        "nodes": [n.dict() for n in workflow.nodes],
        "connections": [c.dict() for c in workflow.connections],
        "variables": workflow.variables,
        "triggers": workflow.triggers,
        "settings": workflow.settings,
    }
    key = f"{SHARE_PREFIX}{token}"
    await redis_client.set(key, json.dumps(payload, default=str), expire=86400 * SHARE_TTL_DAYS)
    share_url = f"/explore/t/{token}"
    return ShareResponse(share_url=share_url, token=token)


@router.post("/from-share")
async def duplicate_from_share(
    body: FromShareRequest,
    current_user: User = Depends(get_current_user),
):
    """Duplicate a shared workflow into the current user's account."""
    key = f"{SHARE_PREFIX}{body.token}"
    raw = await redis_client.get(key)
    if not raw:
        raise HTTPException(status_code=404, detail="Share link expired or invalid")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid share data")
    workflow_data = {
        "name": payload.get("name", "Copied workflow"),
        "description": payload.get("description"),
        "nodes": payload.get("nodes", []),
        "connections": payload.get("connections", []),
        "variables": payload.get("variables", {}),
        "triggers": payload.get("triggers", []),
        "settings": payload.get("settings", {}),
        "created_by": current_user.id,
    }
    new_id = await workflow_engine.create_workflow(workflow_data)
    return {"workflow_id": str(new_id), "message": "Workflow duplicated"}
