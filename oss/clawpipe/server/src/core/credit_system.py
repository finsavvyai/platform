"""Credit System — usage tracking and gamification for API tiers."""

import logging
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.credit_system")


TIER_LIMITS = {
    "free": {"daily_requests": 100, "daily_tokens": 50_000, "credits_per_request": 1},
    "pro": {"daily_requests": 10_000, "daily_tokens": 5_000_000, "credits_per_request": 2},
    "enterprise": {"daily_requests": -1, "daily_tokens": -1, "credits_per_request": 3},
}

ACHIEVEMENTS = {
    "first_request": {"name": "First Steps", "desc": "Made your first API request", "threshold": 1},
    "hundred_requests": {"name": "Getting Serious", "desc": "100 API requests", "threshold": 100},
    "thousand_requests": {"name": "Power User", "desc": "1,000 API requests", "threshold": 1_000},
    "first_cache_hit": {"name": "Cache Master", "desc": "First ReasoningBank cache hit", "threshold": 1},
    "first_failover": {"name": "Resilient", "desc": "First successful provider failover", "threshold": 1},
    "ten_models": {"name": "Model Explorer", "desc": "Used 10 different models", "threshold": 10},
}


class UserCredits:
    """Track credits and achievements for a single user/API key."""

    __slots__ = ("total_credits", "total_requests", "daily_requests", "daily_tokens",
                 "models_used", "achievements", "last_reset_day", "cache_hits", "failovers")

    def __init__(self) -> None:
        self.total_credits: int = 0
        self.total_requests: int = 0
        self.daily_requests: int = 0
        self.daily_tokens: int = 0
        self.models_used: set = set()
        self.achievements: List[str] = []
        self.last_reset_day: int = 0
        self.cache_hits: int = 0
        self.failovers: int = 0


class CreditSystem:
    """Gamified usage tracking across API keys."""

    def __init__(self) -> None:
        self._users: Dict[str, UserCredits] = defaultdict(UserCredits)

    def _current_day(self) -> int:
        return int(time.time()) // 86400

    def _maybe_reset_daily(self, user: UserCredits) -> None:
        today = self._current_day()
        if user.last_reset_day != today:
            user.daily_requests = 0
            user.daily_tokens = 0
            user.last_reset_day = today

    def check_quota(self, api_key: str, tier: str = "free") -> Dict[str, Any]:
        """Check if the user has remaining quota."""
        user = self._users[api_key]
        self._maybe_reset_daily(user)
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

        if limits["daily_requests"] == -1:
            return {"allowed": True, "remaining": -1}

        remaining = limits["daily_requests"] - user.daily_requests
        return {
            "allowed": remaining > 0,
            "remaining": max(remaining, 0),
            "limit": limits["daily_requests"],
        }

    def record_request(
        self,
        api_key: str,
        tier: str = "free",
        model: str = "",
        tokens_used: int = 0,
        cache_hit: bool = False,
        failover: bool = False,
    ) -> Dict[str, Any]:
        """Record a request and return any new achievements."""
        user = self._users[api_key]
        self._maybe_reset_daily(user)
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

        user.total_requests += 1
        user.daily_requests += 1
        user.daily_tokens += tokens_used
        user.total_credits += limits["credits_per_request"]
        if model:
            user.models_used.add(model)
        if cache_hit:
            user.cache_hits += 1
        if failover:
            user.failovers += 1

        new_achievements = self._check_achievements(user)
        return {"new_achievements": new_achievements} if new_achievements else {}

    def _check_achievements(self, user: UserCredits) -> List[Dict[str, str]]:
        """Check and award new achievements."""
        new = []
        checks = {
            "first_request": user.total_requests,
            "hundred_requests": user.total_requests,
            "thousand_requests": user.total_requests,
            "first_cache_hit": user.cache_hits,
            "first_failover": user.failovers,
            "ten_models": len(user.models_used),
        }
        for key, value in checks.items():
            if key not in user.achievements and value >= ACHIEVEMENTS[key]["threshold"]:
                user.achievements.append(key)
                achievement = ACHIEVEMENTS[key]
                new.append({"id": key, "name": achievement["name"], "desc": achievement["desc"]})
                logger.info("Achievement unlocked: %s", key)
        return new

    def get_user_stats(self, api_key: str) -> Dict[str, Any]:
        """Get stats for a specific user."""
        user = self._users[api_key]
        self._maybe_reset_daily(user)
        return {
            "total_credits": user.total_credits,
            "total_requests": user.total_requests,
            "daily_requests": user.daily_requests,
            "models_used": len(user.models_used),
            "achievements": [
                {**ACHIEVEMENTS[a], "id": a} for a in user.achievements
            ],
            "cache_hits": user.cache_hits,
        }

    @property
    def stats(self) -> Dict[str, Any]:
        total_users = len(self._users)
        total_requests = sum(u.total_requests for u in self._users.values())
        total_credits = sum(u.total_credits for u in self._users.values())
        return {
            "total_users": total_users,
            "total_requests": total_requests,
            "total_credits": total_credits,
        }


# Singleton
_system: Optional[CreditSystem] = None


def get_credit_system() -> CreditSystem:
    global _system
    if _system is None:
        _system = CreditSystem()
    return _system
