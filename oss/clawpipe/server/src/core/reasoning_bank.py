"""ReasoningBank — KV-based prompt/response cache for token savings."""

import hashlib
import json
import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("finsavvyai.reasoning_bank")


class ReasoningBank:
    """Cache repeated prompt patterns to save ~30% tokens.

    Keys are content-hashed from (model, messages, temperature).
    Values are cached responses with TTL.
    """

    def __init__(self, max_entries: int = 10_000, default_ttl: int = 3600) -> None:
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._max_entries = max_entries
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    def _make_key(self, model: str, messages: list, temperature: float) -> str:
        """Create a deterministic cache key from request parameters."""
        content = json.dumps(
            {"model": model, "messages": messages, "temperature": temperature},
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    def get(
        self, model: str, messages: list, temperature: float
    ) -> Optional[Dict[str, Any]]:
        """Look up a cached response. Returns None on miss or expiry."""
        key = self._make_key(model, messages, temperature)
        entry = self._cache.get(key)
        if entry is None:
            self._misses += 1
            return None

        if time.monotonic() > entry["expires_at"]:
            del self._cache[key]
            self._misses += 1
            return None

        self._hits += 1
        entry["access_count"] += 1
        logger.debug("ReasoningBank HIT", key=key[:8])
        return entry["response"]

    def put(
        self,
        model: str,
        messages: list,
        temperature: float,
        response: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> None:
        """Store a response in the cache."""
        if self._should_skip_cache(temperature, messages):
            return

        self._evict_if_full()
        key = self._make_key(model, messages, temperature)
        self._cache[key] = {
            "response": response,
            "expires_at": time.monotonic() + (ttl or self._default_ttl),
            "created_at": time.monotonic(),
            "access_count": 0,
        }
        logger.debug("ReasoningBank PUT", key=key[:8])

    def _should_skip_cache(self, temperature: float, messages: list) -> bool:
        """Skip caching for high-temperature or very short requests."""
        if temperature > 0.9:
            return True
        total_content = sum(len(str(m.get("content", ""))) for m in messages)
        if total_content < 10:
            return True
        return False

    def _evict_if_full(self) -> None:
        """Evict oldest entries when cache is full."""
        if len(self._cache) < self._max_entries:
            return
        sorted_keys = sorted(
            self._cache.keys(),
            key=lambda k: self._cache[k]["created_at"],
        )
        for key in sorted_keys[: len(sorted_keys) // 4]:
            del self._cache[key]

    @property
    def stats(self) -> Dict[str, Any]:
        total = self._hits + self._misses
        return {
            "entries": len(self._cache),
            "max_entries": self._max_entries,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total else 0.0,
            "estimated_token_savings_pct": round(
                (self._hits / total) * 30, 1
            ) if total else 0.0,
        }

    def clear(self) -> None:
        self._cache.clear()
        self._hits = 0
        self._misses = 0


# Singleton
_bank: Optional[ReasoningBank] = None


def get_reasoning_bank() -> ReasoningBank:
    """Get or create the singleton ReasoningBank."""
    global _bank
    if _bank is None:
        _bank = ReasoningBank()
    return _bank
