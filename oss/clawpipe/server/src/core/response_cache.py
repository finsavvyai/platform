#!/usr/bin/env python3
"""
Response Cache Layer for LLM Gateway

LRU cache with TTL for LLM API responses. Hash-based key generation
from request parameters. Tracks cache hit/miss metrics.
"""

import hashlib
import json
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class CacheEntry:
    """Single cache entry with TTL tracking."""
    value: Any
    timestamp: float
    ttl: int

    def is_expired(self) -> bool:
        """Check if entry has exceeded TTL."""
        return time.time() - self.timestamp > self.ttl


class ResponseCache:
    """LRU cache with TTL for response caching."""

    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        """
        Initialize cache.

        Args:
            max_size: Maximum number of entries in cache
            default_ttl: Default time-to-live in seconds
        """
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._hits = 0
        self._misses = 0

    def _generate_key(self, request_params: Dict[str, Any]) -> str:
        """
        Generate cache key from request parameters.

        Hash-based key generation excluding variable fields (timestamps, IDs).
        """
        # Normalize params - exclude non-deterministic fields
        normalized = {}
        for key, value in request_params.items():
            if key not in ("timestamp", "request_id", "correlation_id"):
                if isinstance(value, (dict, list)):
                    normalized[key] = json.dumps(value, sort_keys=True)
                else:
                    normalized[key] = str(value)

        # Create hash
        key_str = json.dumps(normalized, sort_keys=True)
        hash_obj = hashlib.sha256(key_str.encode())
        return hash_obj.hexdigest()

    def get(self, request_params: Dict[str, Any]) -> Optional[Any]:
        """
        Retrieve cached response if available and not expired.

        Args:
            request_params: Request parameters to use as cache key

        Returns:
            Cached response or None if not found/expired
        """
        key = self._generate_key(request_params)

        if key not in self._cache:
            self._misses += 1
            return None

        entry = self._cache[key]
        if entry.is_expired():
            del self._cache[key]
            self._misses += 1
            return None

        # Move to end (LRU)
        self._cache.move_to_end(key)
        self._hits += 1
        return entry.value

    def set(
        self,
        request_params: Dict[str, Any],
        response: Any,
        ttl: Optional[int] = None
    ) -> None:
        """
        Cache a response.

        Args:
            request_params: Request parameters for cache key
            response: Response to cache
            ttl: Time-to-live in seconds (uses default if None)
        """
        key = self._generate_key(request_params)
        ttl = ttl or self.default_ttl

        # If key exists, remove it first
        if key in self._cache:
            del self._cache[key]

        # Add new entry
        entry = CacheEntry(
            value=response,
            timestamp=time.time(),
            ttl=ttl
        )
        self._cache[key] = entry

        # Enforce max size - remove oldest (first) item if needed
        if len(self._cache) > self.max_size:
            self._cache.popitem(last=False)

    def clear(self) -> None:
        """Clear all entries."""
        self._cache.clear()

    def get_metrics(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self._hits + self._misses
        hit_rate = (
            self._hits / total_requests * 100
            if total_requests > 0
            else 0
        )

        return {
            "hits": self._hits,
            "misses": self._misses,
            "total_requests": total_requests,
            "hit_rate_percent": round(hit_rate, 2),
            "current_size": len(self._cache),
            "max_size": self.max_size,
        }

    def reset_metrics(self) -> None:
        """Reset hit/miss counters."""
        self._hits = 0
        self._misses = 0
