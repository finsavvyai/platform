"""ELO ranking logic and in-memory stores for Model Arena."""

import math
from collections import defaultdict
from typing import Dict

# ── In-memory store (replace with DB for production) ──────────────────────────

_battles: Dict[str, dict] = {}
_votes: list = []
_elo: Dict[str, float] = defaultdict(lambda: 1200.0)
_match_count: Dict[str, int] = defaultdict(int)

_K = 32  # ELO K-factor


def _expected(rating_a: float, rating_b: float) -> float:
    """Expected score for player A given both ratings."""
    return 1.0 / (1.0 + math.pow(10, (rating_b - rating_a) / 400))


def _update_elo(winner: str, loser: str, tie: bool = False) -> None:
    """Update ELO ratings after a match."""
    ea = _expected(_elo[winner], _elo[loser])
    eb = _expected(_elo[loser], _elo[winner])
    score_a, score_b = (0.5, 0.5) if tie else (1.0, 0.0)
    _elo[winner] += _K * (score_a - ea)
    _elo[loser] += _K * (score_b - eb)
    _match_count[winner] += 1
    _match_count[loser] += 1


def _compute_win_rate(model: str) -> float:
    """Compute win rate percentage for a model."""
    model_votes = [v for v in _votes if model in (v["model_a"], v["model_b"])]
    if not model_votes:
        return 0.0
    wins = sum(
        1 for v in model_votes
        if (v["winner_model"] == model)
    )
    return round(wins / len(model_votes) * 100, 1)
