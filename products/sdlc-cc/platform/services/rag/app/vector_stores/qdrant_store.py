"""Qdrant adapter implementing the `VectorStore` interface.

Qdrant is used as a tier-2 read store for hot retrieval paths. pgvector
remains the source of truth. The adapter lazily creates the collection
if missing and batches upserts in groups of 100.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Sequence

from .base import VectorRecord, VectorSearchHit, VectorStore

logger = logging.getLogger(__name__)

_BATCH = 100
_DEFAULT_URL = "http://localhost:6333"
_DEFAULT_COLLECTION = "rag_chunks"
_DEFAULT_DIM = 1536


class QdrantVectorStore(VectorStore):
    """Async wrapper around `qdrant-client` for RAG retrieval."""

    name = "qdrant"

    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        collection: Optional[str] = None,
        vector_dim: Optional[int] = None,
    ) -> None:
        self.url = url or os.getenv("QDRANT_URL", _DEFAULT_URL)
        self.api_key = api_key or os.getenv("QDRANT_API_KEY") or None
        self.collection = collection or os.getenv(
            "QDRANT_COLLECTION", _DEFAULT_COLLECTION
        )
        self.vector_dim = int(
            vector_dim or os.getenv("QDRANT_VECTOR_DIM", _DEFAULT_DIM)
        )
        self._client = None
        self._ensured = False

    def _get_client(self):
        if self._client is None:
            from qdrant_client import AsyncQdrantClient  # local import

            self._client = AsyncQdrantClient(
                url=self.url, api_key=self.api_key, prefer_grpc=False
            )
        return self._client

    async def _ensure_collection(self) -> None:
        if self._ensured:
            return
        from qdrant_client.http import models as qm

        client = self._get_client()
        try:
            exists = await client.collection_exists(self.collection)
        except Exception as e:
            logger.warning(f"qdrant: collection_exists failed: {e}")
            exists = False
        if not exists:
            await client.create_collection(
                collection_name=self.collection,
                vectors_config=qm.VectorParams(
                    size=self.vector_dim, distance=qm.Distance.COSINE
                ),
            )
            logger.info(
                f"qdrant: created collection {self.collection} dim={self.vector_dim}"
            )
        self._ensured = True

    async def upsert(self, records: Sequence[VectorRecord]) -> int:
        if not records:
            return 0
        from qdrant_client.http import models as qm

        await self._ensure_collection()
        client = self._get_client()
        written = 0
        for i in range(0, len(records), _BATCH):
            chunk = records[i : i + _BATCH]
            points = [
                qm.PointStruct(
                    id=r.id, vector=list(r.vector), payload=r.to_payload()
                )
                for r in chunk
            ]
            await client.upsert(collection_name=self.collection, points=points)
            written += len(points)
        return written

    async def search(
        self,
        query_vector: Sequence[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[VectorSearchHit]:
        await self._ensure_collection()
        client = self._get_client()
        qfilter = self._build_filter(filters or {})
        results = await client.search(
            collection_name=self.collection,
            query_vector=list(query_vector),
            query_filter=qfilter,
            limit=top_k,
            with_payload=True,
        )
        return [
            VectorSearchHit(
                id=str(p.id),
                score=float(p.score),
                payload=dict(p.payload or {}),
                source="qdrant",
            )
            for p in results
        ]

    def _build_filter(self, filters: Dict[str, Any]):
        from qdrant_client.http import models as qm

        must = []
        for key, val in filters.items():
            if val is None:
                continue
            if isinstance(val, (list, tuple, set)):
                must.append(
                    qm.FieldCondition(
                        key=key, match=qm.MatchAny(any=list(val))
                    )
                )
            else:
                must.append(
                    qm.FieldCondition(key=key, match=qm.MatchValue(value=val))
                )
        return qm.Filter(must=must) if must else None

    async def delete(self, ids: Sequence[str]) -> int:
        if not ids:
            return 0
        from qdrant_client.http import models as qm

        await self._ensure_collection()
        client = self._get_client()
        await client.delete(
            collection_name=self.collection,
            points_selector=qm.PointIdsList(points=list(ids)),
        )
        return len(ids)

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        await self._ensure_collection()
        client = self._get_client()
        qfilter = self._build_filter(filters or {})
        res = await client.count(
            collection_name=self.collection,
            count_filter=qfilter,
            exact=False,
        )
        return int(getattr(res, "count", 0))

    async def health_check(self) -> bool:
        try:
            client = self._get_client()
            await client.get_collections()
            return True
        except Exception as e:
            logger.warning(f"qdrant health_check failed: {e}")
            return False

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:
                pass
            self._client = None
