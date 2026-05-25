"""Abstract base class for vector stores used by the RAG service.

All adapters (pgvector, Qdrant, dual-writer) implement this interface.
The interface is intentionally narrow: upsert, search, delete, count.
Higher-level concerns (reranking, hybrid, query expansion) stay in the
existing `context_retrieval` / `vector_search_service` layers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence


@dataclass
class VectorRecord:
    """A single vector + payload to be upserted into a store."""

    id: str
    vector: Sequence[float]
    payload: Dict[str, Any] = field(default_factory=dict)
    # Tenant id is duplicated into payload for filtering, but kept explicit
    # to make multi-tenant enforcement auditable at the boundary.
    tenant_id: Optional[str] = None

    def to_payload(self) -> Dict[str, Any]:
        merged = dict(self.payload)
        if self.tenant_id is not None:
            merged.setdefault("tenant_id", self.tenant_id)
        return merged


@dataclass
class VectorSearchHit:
    """A single hit returned from a vector search."""

    id: str
    score: float
    payload: Dict[str, Any] = field(default_factory=dict)
    # Source indicates which backend produced the hit; used by the dual
    # writer in shadow mode to attribute divergence.
    source: str = "unknown"


class VectorStore(ABC):
    """Abstract vector store interface.

    Implementations MUST enforce tenant isolation via the `filters`
    argument on `search` and via the `tenant_id` on `VectorRecord`.
    Implementations SHOULD be safe to call concurrently.
    """

    name: str = "base"

    @abstractmethod
    async def upsert(self, records: Sequence[VectorRecord]) -> int:
        """Insert or update a batch of vectors. Returns count written."""

    @abstractmethod
    async def search(
        self,
        query_vector: Sequence[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[VectorSearchHit]:
        """Nearest-neighbor search. `filters` is a backend-neutral dict.

        Backends translate common keys (tenant_id, source, content_type,
        language) to their native filter DSL. Unknown keys SHOULD be
        passed through best-effort or ignored with a debug log.
        """

    @abstractmethod
    async def delete(self, ids: Sequence[str]) -> int:
        """Delete vectors by id. Returns count deleted."""

    @abstractmethod
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Return number of vectors, optionally filtered."""

    async def health_check(self) -> bool:
        """Default health check returns True; override for real probes."""
        return True

    async def close(self) -> None:
        """Release any underlying resources. Default is a no-op."""
        return None
