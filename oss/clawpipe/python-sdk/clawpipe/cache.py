"""ReasoningBank Cache -- client-side in-memory prompt cache.

Hash-based deduplication with TTL expiry and LRU eviction.
"""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class CacheEntry:
    """A single cache entry."""

    value: str
    created_at: float
    hits: int = 0


@dataclass
class CacheStats:
    """Cache performance statistics."""

    size: int
    hits: int
    misses: int
    hit_rate: str
    total_saved: int


class Cache:
    """In-memory prompt cache with TTL and LRU eviction."""

    def __init__(self, ttl_ms: int = 300_000, max_entries: int = 10_000) -> None:
        self._store: dict[str, CacheEntry] = {}
        self._ttl_ms = ttl_ms
        self._max_entries = max_entries
        self._total_hits = 0
        self._total_misses = 0

    def key(self, prompt: str, options: Any = None) -> str:
        """Generate a cache key from prompt and options."""
        raw = json.dumps({"prompt": prompt, "options": options or {}}, sort_keys=True)
        return self._hash(raw)

    def get(self, cache_key: str) -> Optional[str]:
        """Get a cached value. Returns None if missing or expired."""
        entry = self._store.get(cache_key)
        if entry is None:
            self._total_misses += 1
            return None

        elapsed_ms = (time.time() - entry.created_at) * 1000
        if elapsed_ms > self._ttl_ms:
            del self._store[cache_key]
            self._total_misses += 1
            return None

        entry.hits += 1
        self._total_hits += 1
        return entry.value

    def set(self, cache_key: str, value: str) -> None:
        """Store a value in cache."""
        self._evict_if_full()
        self._store[cache_key] = CacheEntry(
            value=value,
            created_at=time.time(),
            hits=0,
        )

    def has(self, cache_key: str) -> bool:
        """Check if a key exists and is not expired."""
        entry = self._store.get(cache_key)
        if entry is None:
            return False
        elapsed_ms = (time.time() - entry.created_at) * 1000
        if elapsed_ms > self._ttl_ms:
            del self._store[cache_key]
            return False
        return True

    def delete(self, cache_key: str) -> bool:
        """Remove a specific entry."""
        if cache_key in self._store:
            del self._store[cache_key]
            return True
        return False

    def clear(self) -> None:
        """Clear all cached entries."""
        self._store.clear()
        self._total_hits = 0
        self._total_misses = 0

    def stats(self) -> CacheStats:
        """Get cache performance stats."""
        total = self._total_hits + self._total_misses
        hit_rate = f"{(self._total_hits / total * 100):.1f}" if total > 0 else "0.0"
        return CacheStats(
            size=len(self._store),
            hits=self._total_hits,
            misses=self._total_misses,
            hit_rate=f"{hit_rate}%",
            total_saved=self._total_hits,
        )

    def prune(self) -> int:
        """Remove expired entries."""
        now = time.time()
        expired = [
            k
            for k, entry in self._store.items()
            if (now - entry.created_at) * 1000 > self._ttl_ms
        ]
        for k in expired:
            del self._store[k]
        return len(expired)

    @staticmethod
    def _hash(input_str: str) -> str:
        """djb2 hash algorithm."""
        h = 5381
        for c in input_str:
            h = ((h << 5) + h + ord(c)) & 0xFFFFFFFF
        return f"cp_{h:x}"

    def _evict_if_full(self) -> None:
        """Evict least-hit entries when cache is full."""
        if len(self._store) < self._max_entries:
            return
        entries = sorted(self._store.items(), key=lambda x: x[1].hits)
        to_remove = math.ceil(self._max_entries * 0.1)
        for i in range(min(to_remove, len(entries))):
            del self._store[entries[i][0]]
