"""Minimal legacy route helpers used by compatibility tests."""

from __future__ import annotations

from src.finsavvyai.services import routers


async def handle_request(request):
    """Route a chat request to the mocked legacy providers."""
    if request.provider == "openai":
        return routers.openai_client.ChatCompletion.create()
    if request.provider == "anthropic":
        return routers.anthropic_client.Message.create()
    if request.routing_chain:
        return {"routing_chain": request.routing_chain, "content": "ok"}
    return await routers.call_provider(request.model, request.messages)
