"""Route registration for the API Gateway application."""

from src.api.routes.arena import (
    handle_arena_battle,
    handle_arena_leaderboard,
    handle_arena_models,
    handle_arena_vote,
)
from src.api.routes.compat import handle_compat
from src.api.routes.completions import handle_completions
from src.api.routes.docs import handle_docs, handle_openapi_spec
from src.api.routes.embeddings import handle_embeddings
from src.api.routes.health import handle_health
from src.api.routes.models import handle_models
from src.api.routes.notebook import setup_notebook_routes
from src.api.routes.presets import setup_preset_routes
from src.api.routes.ops import (
    handle_api_versions,
    handle_metrics,
    handle_options,
    handle_root,
    handle_traces,
)
from src.api.routes.a2a import setup_a2a_routes
from src.api.routes.ws import handle_ws_chat
from src.api.versioning import SUPPORTED_VERSIONS, register_versioned_routes


def register_gateway_routes(app, gateway):
    """Register all API routes on the given aiohttp application."""
    app.router.add_options("/{path:.*}", handle_options)
    api_routes = [
        ("POST", "/chat/completions", gateway._handle_chat_completions),
        ("POST", "/openclaw/wrapper", gateway._handle_openclaw_wrapper),
        ("GET", "/models", handle_models),
        ("POST", "/agent/decision", gateway._handle_agent_decision),
    ]
    for version in SUPPORTED_VERSIONS:
        register_versioned_routes(app, version, api_routes)
    app.router.add_post("/agent/decision", gateway._handle_agent_decision)
    app.router.add_post("/openclaw/wrapper", gateway._handle_openclaw_wrapper)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/v1/compat", handle_compat)
    app.router.add_get("/openapi.json", handle_openapi_spec)
    app.router.add_get("/docs", handle_docs)
    app.router.add_post("/v1/embeddings", handle_embeddings)
    app.router.add_post("/v1/completions", handle_completions)
    app.router.add_get("/v1/arena/models", handle_arena_models)
    app.router.add_post("/v1/arena/battle", handle_arena_battle)
    app.router.add_post("/v1/arena/vote", handle_arena_vote)
    app.router.add_get("/v1/arena/leaderboard", handle_arena_leaderboard)
    app.router.add_get("/metrics", handle_metrics)
    app.router.add_get("/traces", handle_traces)
    app.router.add_get("/api/versions", handle_api_versions)
    app.router.add_get("/", handle_root)
    app.router.add_get("/v1/ws/chat/completions", handle_ws_chat)
    setup_notebook_routes(app)
    setup_preset_routes(app)
    setup_a2a_routes(app)
