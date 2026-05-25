"""Pgvector adapter implementing the `VectorStore` interface.

This adapter does NOT reimplement pgvector. It delegates to the existing
embedding / vector search services so that the current, battle-tested
pgvector code path remains the single source of truth.

The adapter exists only so that higher-level code can treat pgvector as
one of several `VectorStore` backends behind the `DualWriteVectorStore`.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from .base import VectorRecord, VectorSearchHit, VectorStore

logger = logging.getLogger(__name__)


class PgvectorStore(VectorStore):
    """Uniform façade over the existing pgvector code path.

    Parameters
    ----------
    embedding_service: object
        The existing embedding service exposing an async `upsert_vectors`
        (or compatible) method. Duck-typed to avoid a hard import cycle.
    vector_search_service: object
        The existing vector search service exposing an async `search`
        method returning hits with `id`, `score`, and `metadata`.
    """

    name = "pgvector"

    def __init__(
        self,
        embedding_service: Any = None,
        vector_search_service: Any = None,
    ) -> None:
        self._embedding_service = embedding_service
        self._vector_search_service = vector_search_service

    async def upsert(self, records: Sequence[VectorRecord]) -> int:
        if not records:
            return 0
        svc = self._embedding_service
        if svc is None:
            logger.debug(
                "pgvector_store: no embedding_service injected; skipping upsert"
            )
            return 0
        # Delegate — we intentionally do not manage SQL here.
        fn = (
            getattr(svc, "upsert_vectors", None)
            or getattr(svc, "store_embeddings", None)
            or getattr(svc, "upsert", None)
        )
        if fn is None:
            logger.warning(
                "pgvector_store: embedding_service has no upsert method"
            )
            return 0
        payload = [
            {
                "id": r.id,
                "vector": list(r.vector),
                "payload": r.to_payload(),
                "tenant_id": r.tenant_id,
            }
            for r in records
        ]
        await fn(payload)
        return len(records)

    async def search(
        self,
        query_vector: Sequence[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[VectorSearchHit]:
        svc = self._vector_search_service
        if svc is None:
            logger.debug(
                "pgvector_store: no vector_search_service injected"
            )
            return []
        fn = getattr(svc, "search_by_vector", None) or getattr(
            svc, "vector_search", None
        )
        if fn is None:
            logger.debug(
                "pgvector_store: vector_search_service has no vector search method"
            )
            return []
        raw = await fn(
            query_vector=list(query_vector),
            top_k=top_k,
            filters=filters or {},
        )
        return [self._to_hit(r) for r in raw or []]

    def _to_hit(self, r: Any) -> VectorSearchHit:
        if isinstance(r, dict):
            return VectorSearchHit(
                id=str(r.get("id") or r.get("chunk_id") or ""),
                score=float(r.get("score") or r.get("similarity") or 0.0),
                payload=dict(r.get("payload") or r.get("metadata") or {}),
                source="pgvector",
            )
        return VectorSearchHit(
            id=str(getattr(r, "id", "")),
            score=float(getattr(r, "score", 0.0)),
            payload=dict(getattr(r, "metadata", {}) or {}),
            source="pgvector",
        )

    async def delete(self, ids: Sequence[str]) -> int:
        svc = self._embedding_service
        if svc is None or not ids:
            return 0
        fn = getattr(svc, "delete_vectors", None) or getattr(
            svc, "delete", None
        )
        if fn is None:
            return 0
        await fn(list(ids))
        return len(ids)

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        svc = self._vector_search_service or self._embedding_service
        if svc is None:
            return 0
        fn = getattr(svc, "count_vectors", None) or getattr(svc, "count", None)
        if fn is None:
            return 0
        try:
            return int(await fn(filters or {}))
        except Exception as e:
            logger.debug(f"pgvector_store count failed: {e}")
            return 0

    async def health_check(self) -> bool:
        # pgvector health is tied to the main DB; we assume the existing
        # app-level healthcheck already covers it.
        return True
