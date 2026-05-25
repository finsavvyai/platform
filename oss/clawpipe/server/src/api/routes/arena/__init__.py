"""Model Arena — blind A/B comparison and leaderboard.

Endpoints:
  GET  /v1/arena/models       — list models available for arena battles
  POST /v1/arena/battle       — submit a prompt, get two anonymised responses
  POST /v1/arena/vote         — cast a vote for response A, B, or tie
  GET  /v1/arena/leaderboard  — ELO rankings
"""

from src.api.routes.arena.elo import (
    _battles,
    _compute_win_rate,
    _elo,
    _expected,
    _K,
    _match_count,
    _update_elo,
    _votes,
)
from src.api.routes.arena.battle import (
    _call_model_direct,
    handle_arena_battle,
    handle_arena_vote,
)
from src.api.routes.arena.routes import (
    handle_arena_leaderboard,
    handle_arena_models,
    setup_arena_routes,
)

__all__ = [
    "_battles",
    "_call_model_direct",
    "_compute_win_rate",
    "_elo",
    "_expected",
    "_K",
    "_match_count",
    "_update_elo",
    "_votes",
    "handle_arena_battle",
    "handle_arena_leaderboard",
    "handle_arena_models",
    "handle_arena_vote",
    "setup_arena_routes",
]
