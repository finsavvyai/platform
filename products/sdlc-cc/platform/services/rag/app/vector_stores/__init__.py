"""Vector store abstractions for the RAG service.

Provides a uniform interface (`VectorStore`) across multiple backends:

- `PgvectorStore`: source of truth (OLTP, ACID) — delegates to existing
  vector_search/context_retrieval paths. Does not reimplement pgvector.
- `QdrantVectorStore`: tier-2 read-optimized store for hot retrieval paths.
- `DualWriteVectorStore`: writes to pgvector (primary) and Qdrant (secondary),
  reads from Qdrant with pgvector fallback, supports shadow mode and a
  circuit breaker for Qdrant failures.

Feature flags (env):
- `QDRANT_ENABLED` (default `false`): enable dual-write + Qdrant reads.
- `QDRANT_SHADOW_READ` (default `false`): read from Qdrant for comparison
  against pgvector and log divergence; pgvector remains authoritative.
- `QDRANT_URL` (default `http://localhost:6333`)
- `QDRANT_API_KEY` (optional)
- `QDRANT_COLLECTION` (default `rag_chunks`)
- `QDRANT_VECTOR_DIM` (default `1536`)
"""

from .base import VectorRecord, VectorSearchHit, VectorStore
from .qdrant_store import QdrantVectorStore
from .pgvector_store import PgvectorStore
from .dual_writer import DualWriteVectorStore

__all__ = [
    "VectorRecord",
    "VectorSearchHit",
    "VectorStore",
    "QdrantVectorStore",
    "PgvectorStore",
    "DualWriteVectorStore",
]
