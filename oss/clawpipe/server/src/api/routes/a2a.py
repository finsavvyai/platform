"""A2A (Agent-to-Agent) protocol endpoints + MCP discovery."""

import time
import uuid

from aiohttp import web

from src.core.agent_booster import get_agent_booster
from src.core.context_packing import get_context_packer
from src.core.credit_system import get_credit_system
from src.core.logger import get_logger
from src.core.reasoning_bank import get_reasoning_bank
from src.core.smart_router import get_smart_router

logger = get_logger()

# Agent Card — describes this agent's capabilities for A2A discovery
AGENT_CARD = {
    "name": "FinSavvyAI LLM Gateway",
    "description": "Multi-provider LLM routing with policy enforcement and governance",
    "version": "5.0.0",
    "protocol": "a2a/1.0",
    "capabilities": [
        "chat_completions",
        "embeddings",
        "streaming",
        "vision",
        "governance",
        "smart_routing",
        "context_packing",
        "reasoning_cache",
    ],
    "endpoints": {
        "chat": "/v1/chat/completions",
        "models": "/v1/models",
        "embeddings": "/v1/embeddings",
        "health": "/health",
        "agent_card": "/a2a/agent-card",
        "agent_invoke": "/a2a/invoke",
        "stats": "/v1/stats",
    },
    "authentication": {"type": "bearer", "header": "Authorization"},
    "providers": ["openai", "anthropic", "ollama", "lmstudio", "openclaw"],
}

# MCP Server Manifest
MCP_MANIFEST = {
    "schema_version": "v1",
    "name": "finsavvyai-llm-gateway",
    "description": "Drop-in OpenAI API replacement with multi-provider routing and governance",
    "tools": [
        {
            "name": "chat_completion",
            "description": "Send a chat completion request through the FinSavvyAI gateway",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "model": {"type": "string", "description": "Model to use"},
                    "messages": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "role": {"type": "string"},
                                "content": {"type": "string"},
                            },
                        },
                    },
                    "temperature": {"type": "number", "default": 0.7},
                    "max_tokens": {"type": "integer"},
                    "stream": {"type": "boolean", "default": False},
                },
                "required": ["model", "messages"],
            },
        },
        {
            "name": "list_models",
            "description": "List available LLM models across all providers",
            "inputSchema": {"type": "object", "properties": {}},
        },
    ],
}

# llms.txt — machine-readable AI discovery file
LLMS_TXT = """# FinSavvyAI LLM Gateway
> Drop-in OpenAI API replacement with multi-provider routing, governance, and policy enforcement.

## API
- Base URL: configurable (default http://localhost:8080)
- Auth: Bearer token via Authorization header
- OpenAI-compatible: POST /v1/chat/completions, GET /v1/models

## Features
- Multi-provider routing (OpenAI, Anthropic, Ollama, LM Studio)
- Smart Router with self-learning model selection
- ReasoningBank prompt cache (30% token savings)
- Context Packing (40-60% token savings)
- Agent Booster for deterministic transforms (sub-ms, $0)
- Policy engine (cost, safety, latency gates)
- Agent governance for OpenHands/autonomous agents
- Streaming, vision, embeddings support

## MCP
- Manifest: GET /.well-known/mcp.json
- A2A Agent Card: GET /a2a/agent-card
"""


async def handle_agent_card(request):
    """GET /a2a/agent-card — A2A protocol agent discovery."""
    return web.json_response(AGENT_CARD)


async def handle_a2a_invoke(request):
    """POST /a2a/invoke — A2A protocol task invocation."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    task_id = str(uuid.uuid4())
    action = body.get("action", "chat_completion")

    if action == "chat_completion":
        # Delegate to the main chat endpoint internally
        return web.json_response({
            "task_id": task_id,
            "status": "redirect",
            "message": "Use POST /v1/chat/completions directly for chat",
            "endpoint": "/v1/chat/completions",
        })
    elif action == "list_models":
        return web.json_response({
            "task_id": task_id,
            "status": "redirect",
            "endpoint": "/v1/models",
        })
    elif action == "health":
        return web.json_response({
            "task_id": task_id,
            "status": "redirect",
            "endpoint": "/health?verbose=true",
        })
    else:
        return web.json_response(
            {"error": f"Unknown action: {action}", "supported": ["chat_completion", "list_models", "health"]},
            status=400,
        )


async def handle_mcp_manifest(request):
    """GET /.well-known/mcp.json — MCP server manifest."""
    return web.json_response(MCP_MANIFEST)


async def handle_llms_txt(request):
    """GET /llms.txt — AI-readable discovery file."""
    return web.Response(text=LLMS_TXT, content_type="text/plain")


async def handle_stats(request):
    """GET /v1/stats — Intelligence features statistics."""
    return web.json_response({
        "reasoning_bank": get_reasoning_bank().stats,
        "context_packing": get_context_packer().stats,
        "smart_router": get_smart_router().stats,
        "agent_booster": get_agent_booster().stats,
        "credit_system": get_credit_system().stats,
        "timestamp": time.time(),
    })


def setup_a2a_routes(app):
    """Register A2A, MCP, and stats routes."""
    app.router.add_get("/a2a/agent-card", handle_agent_card)
    app.router.add_post("/a2a/invoke", handle_a2a_invoke)
    app.router.add_get("/.well-known/mcp.json", handle_mcp_manifest)
    app.router.add_get("/llms.txt", handle_llms_txt)
    app.router.add_get("/v1/stats", handle_stats)
