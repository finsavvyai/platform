"""Minimal FastAPI app for legacy compatibility tests."""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.finsavvyai.api import routes as legacy_routes
from src.finsavvyai.middleware import rate_limiter as legacy_rate_limiter
from src.finsavvyai.security import auth as legacy_auth
from src.finsavvyai.services import cost_tracker

app = FastAPI(title="FinSavvyAI Legacy Compatibility")

_MODELS = [
    {"id": "gpt-4", "object": "model", "provider": "openai"},
    {"id": "claude-3-opus", "object": "model", "provider": "anthropic"},
]


class ChatMessage(BaseModel):
    """Legacy chat message schema."""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Legacy chat completion request schema."""

    model: str
    messages: list[ChatMessage]
    provider: Optional[str] = None
    track_cost: bool = False
    routing_chain: Optional[list[str]] = None


@app.get("/health")
async def health():
    """Legacy health route."""
    return {"status": "healthy"}


@app.get("/ready")
async def ready():
    """Legacy readiness route."""
    return {"status": "ready"}


@app.get("/alive")
async def alive():
    """Legacy liveness route."""
    return {"status": "alive"}


@app.get("/v1/models")
async def list_models(provider: str | None = None):
    """Return a small static model catalog."""
    data = [model for model in _MODELS if provider in (None, model["provider"])]
    return {"object": "list", "data": data}


@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatRequest,
    authorization: str | None = Header(default=None),
):
    """Legacy chat completions route used only by compatibility tests."""
    if not await legacy_rate_limiter.check_limit():
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        if not legacy_auth.verify_api_key(token):
            raise HTTPException(status_code=401, detail="Invalid API key")

    if request.model == "invalid-model":
        raise HTTPException(status_code=400, detail="Invalid model")
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    try:
        if request.track_cost:
            await cost_tracker.track_request(request.model)
        result = await legacy_routes.handle_request(request)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return JSONResponse(
        content={"choices": [{"message": {"content": "ok"}}], "result": result},
        headers={"X-RateLimit-Limit": "100"},
    )
