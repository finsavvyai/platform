"""Arena route handlers for models listing, leaderboard, and route setup."""

from aiohttp import web

from src.api.routes.arena.elo import (
    _battles,
    _compute_win_rate,
    _elo,
    _match_count,
    _votes,
)
from src.api.routes.arena.battle import (
    handle_arena_battle,
    handle_arena_vote,
)


async def handle_arena_models(request: web.Request) -> web.Response:
    """GET /v1/arena/models — list models available for arena battles."""
    gateway = request.app.get("gateway")
    models = []
    if gateway and getattr(gateway, "provider_registry", None):
        try:
            registry = gateway.provider_registry
            for name, provider in registry.providers.items():
                if getattr(provider, "is_available", lambda: True)():
                    models.append(
                        {"id": name, "object": "model", "arena_eligible": True},
                    )
        except Exception:
            pass
    if not models:
        models = [
            {"id": "gpt-3.5-turbo", "object": "model", "arena_eligible": True},
            {"id": "gpt-4", "object": "model", "arena_eligible": True},
            {"id": "claude-3-haiku-20240307", "object": "model", "arena_eligible": True},
            {"id": "llama3.2", "object": "model", "arena_eligible": True},
        ]
    return web.json_response(
        {"object": "list", "data": models, "total": len(models)},
    )


async def handle_arena_leaderboard(_request: web.Request) -> web.Response:
    """GET /v1/arena/leaderboard — ELO rankings."""
    rankings = sorted(
        [
            {
                "rank": 0,
                "model": model,
                "elo": round(elo, 1),
                "battles": _match_count[model],
                "win_rate": _compute_win_rate(model),
            }
            for model, elo in _elo.items()
        ],
        key=lambda x: x["elo"],
        reverse=True,
    )
    for i, row in enumerate(rankings, 1):
        row["rank"] = i

    return web.json_response(
        {
            "object": "arena.leaderboard",
            "total_battles": len(_battles),
            "total_votes": len(_votes),
            "rankings": rankings,
        }
    )


def setup_arena_routes(app: web.Application) -> None:
    """Register all arena routes on the given aiohttp app."""
    app.router.add_get("/v1/arena/models", handle_arena_models)
    app.router.add_post("/v1/arena/battle", handle_arena_battle)
    app.router.add_post("/v1/arena/vote", handle_arena_vote)
    app.router.add_get("/v1/arena/leaderboard", handle_arena_leaderboard)
