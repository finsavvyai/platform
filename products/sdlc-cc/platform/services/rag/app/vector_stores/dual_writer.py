"""Dual-write vector store: pgvector (primary) + Qdrant (secondary).

Semantics
---------
- **Upsert**: always writes to pgvector. When `QDRANT_ENABLED=true`, also
  writes to Qdrant. Qdrant failures NEVER break the primary write.
- **Read**: if `QDRANT_ENABLED=true`, reads from Qdrant first and falls
  back to pgvector on any exception or empty result. Otherwise, reads
  from pgvector only.
- **Shadow mode**: when `QDRANT_SHADOW_READ=true` (and `QDRANT_ENABLED`
  is false or true), results are also fetched from Qdrant and compared
  to pgvector results; divergence is logged but pgvector remains
  authoritative for the returned hits.
- **Circuit breaker**: if Qdrant fails >= 5 times within 60 seconds, it
  is disabled for 5 minutes. During that window Qdrant reads/writes
  short-circuit to no-op.

Rollback: set `QDRANT_ENABLED=false`. The service falls back to pure
pgvector behavior immediately.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Sequence

from .base import VectorRecord, VectorSearchHit, VectorStore

logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class _CircuitBreaker:
    """Simple rolling-window circuit breaker for Qdrant."""

    def __init__(
        self,
        failure_threshold: int = 5,
        window_seconds: int = 60,
        cool_down_seconds: int = 300,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.window = window_seconds
        self.cool_down = cool_down_seconds
        self._failures: List[float] = []
        self._opened_at: Optional[float] = None

    def allow(self) -> bool:
        now = time.monotonic()
        if self._opened_at is not None:
            if now - self._opened_at >= self.cool_down:
                self._opened_at = None
                self._failures.clear()
                logger.info("qdrant circuit breaker: closed (cool-down elapsed)")
                return True
            return False
        return True

    def record_success(self) -> None:
        self._failures.clear()

    def record_failure(self) -> None:
        now = time.monotonic()
        self._failures = [t for t in self._failures if now - t <= self.window]
        self._failures.append(now)
        if len(self._failures) >= self.failure_threshold:
            self._opened_at = now
            logger.warning(
                "qdrant circuit breaker: OPEN (%d failures in %ds) — disabled for %ds",
                len(self._failures), self.window, self.cool_down,
            )


class DualWriteVectorStore(VectorStore):
    """Coordinates pgvector (primary) and Qdrant (secondary)."""

    name = "dual"

    def __init__(
        self,
        primary: VectorStore,
        secondary: Optional[VectorStore] = None,
        *,
        enabled: Optional[bool] = None,
        shadow_read: Optional[bool] = None,
    ) -> None:
        self.primary = primary
        self.secondary = secondary
        self.enabled = (
            _env_bool("QDRANT_ENABLED", False) if enabled is None else enabled
        )
        self.shadow_read = (
            _env_bool("QDRANT_SHADOW_READ", False)
            if shadow_read is None
            else shadow_read
        )
        self._breaker = _CircuitBreaker()

    def _qdrant_live(self) -> bool:
        return self.secondary is not None and self._breaker.allow()

    async def upsert(self, records: Sequence[VectorRecord]) -> int:
        written = await self.primary.upsert(records)
        if self.enabled and self._qdrant_live():
            try:
                await self.secondary.upsert(records)  # type: ignore[union-attr]
                self._breaker.record_success()
            except Exception as e:
                self._breaker.record_failure()
                logger.warning(f"dual_writer: qdrant upsert failed: {e}")
        return written

    async def search(
        self,
        query_vector: Sequence[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[VectorSearchHit]:
        if self.enabled and self._qdrant_live():
            try:
                hits = await self.secondary.search(  # type: ignore[union-attr]
                    query_vector, top_k=top_k, filters=filters
                )
                self._breaker.record_success()
                if hits:
                    if self.shadow_read:
                        await self._compare_shadow(query_vector, top_k, filters, hits)
                    return hits
            except Exception as e:
                self._breaker.record_failure()
                logger.warning(f"dual_writer: qdrant search failed, falling back: {e}")
        pg_hits = await self.primary.search(query_vector, top_k=top_k, filters=filters)
        if self.shadow_read and self._qdrant_live() and not self.enabled:
            await self._compare_shadow(query_vector, top_k, filters, pg_hits)
        return pg_hits

    async def _compare_shadow(
        self,
        query_vector: Sequence[float],
        top_k: int,
        filters: Optional[Dict[str, Any]],
        reference: List[VectorSearchHit],
    ) -> None:
        """Log divergence between Qdrant and pgvector. Non-authoritative."""
        try:
            other: List[VectorSearchHit] = []
            if reference and reference[0].source == "qdrant":
                other = await self.primary.search(query_vector, top_k=top_k, filters=filters)
            elif self.secondary is not None:
                other = await self.secondary.search(query_vector, top_k=top_k, filters=filters)
            ref_ids = [h.id for h in reference]
            oth_ids = [h.id for h in other]
            overlap = len(set(ref_ids) & set(oth_ids))
            jaccard = overlap / max(len(set(ref_ids) | set(oth_ids)), 1)
            logger.info(
                "qdrant_shadow_compare top_k=%d overlap=%d jaccard=%.3f ref=%s other=%s",
                top_k, overlap, jaccard,
                reference[0].source if reference else "?",
                other[0].source if other else "?",
            )
        except Exception as e:
            logger.debug(f"shadow compare failed: {e}")

    async def delete(self, ids: Sequence[str]) -> int:
        n = await self.primary.delete(ids)
        if self.enabled and self._qdrant_live():
            try:
                await self.secondary.delete(ids)  # type: ignore[union-attr]
                self._breaker.record_success()
            except Exception as e:
                self._breaker.record_failure()
                logger.warning(f"dual_writer: qdrant delete failed: {e}")
        return n

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        return await self.primary.count(filters)

    async def health_check(self) -> bool:
        return await self.primary.health_check()

    async def close(self) -> None:
        await self.primary.close()
        if self.secondary is not None:
            await self.secondary.close()
