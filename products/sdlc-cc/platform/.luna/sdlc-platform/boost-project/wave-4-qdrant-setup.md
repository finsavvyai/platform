# Wave 4 — Qdrant Tier-2 Vector Store Setup

Status: implemented (shadow-mode off by default)
Owner: RAG service (`services/rag/app/vector_stores/`)
Primary store: **pgvector** (unchanged, source of truth)
Secondary store: **Qdrant** (tier-2 read-optimized)

## Goal

Introduce Qdrant as a tier-2 vector store behind a uniform
`VectorStore` interface so the RAG retrieval path can opportunistically
serve reads from a low-latency Rust-based engine while keeping
pgvector's ACID guarantees and RLS enforcement intact.

## When to use Qdrant vs pgvector

| Workload                                  | Store       | Why                                               |
|-------------------------------------------|-------------|---------------------------------------------------|
| Document ingestion, source-of-truth writes| pgvector    | ACID, RLS, multi-row txn, joins with metadata     |
| Tenant metadata, policy joins, audit      | pgvector    | SQL semantics, foreign keys, existing migrations  |
| Tenant with > 1M vectors                  | Qdrant      | HNSW recall + latency better than pgvector at scale|
| Hot retrieval paths (p95 < 50 ms target)  | Qdrant      | Rust core, gRPC, payload indexes                  |
| Long-tail tenants (< 100k vectors)        | pgvector    | Latency already adequate, avoid dual-write cost   |
| OLTP deletes (GDPR erase, tenant purge)   | pgvector (+ mirrored delete via dual-writer) | Transactional |

Rule of thumb: **pgvector first, Qdrant when size or latency demands it.**

## Architecture

```
                 upsert                      search
  caller -> DualWriteVectorStore  ------>  DualWriteVectorStore
              |                                 |
              |-- primary  : PgvectorStore      |-- if QDRANT_ENABLED:
              |              (source of truth)  |     try Qdrant -> fallback pgvector
              \-- secondary: QdrantVectorStore  \-- else: pgvector
```

- `app/vector_stores/base.py`          — abstract `VectorStore` interface
- `app/vector_stores/pgvector_store.py` — façade over existing pgvector path
- `app/vector_stores/qdrant_store.py`   — async qdrant-client wrapper
- `app/vector_stores/dual_writer.py`    — coordinator + circuit breaker

### Dual-write strategy

1. Every upsert goes to pgvector **first** and is considered durable on
   pgvector success.
2. If `QDRANT_ENABLED=true`, the same batch is mirrored into Qdrant in
   batches of 100. Qdrant failures never break the primary write — they
   only increment the circuit breaker.
3. Reads (when enabled) hit Qdrant first and fall back to pgvector on
   any exception or empty result set.
4. Deletes mirror to both; Qdrant delete failures are logged only.

### Shadow mode

`QDRANT_SHADOW_READ=true` turns on parallel comparison reads. pgvector
stays authoritative for the returned hits, but the dual writer fetches
the equivalent top-k from Qdrant and logs overlap / Jaccard similarity.
Use this to validate recall parity before flipping `QDRANT_ENABLED`.

Log line:

```
qdrant_shadow_compare top_k=10 overlap=8 jaccard=0.667 ref=pgvector other=qdrant
```

### Circuit breaker

Implemented in `dual_writer._CircuitBreaker`:

- Threshold: **5 failures in 60 s**
- Cool-down: **5 minutes**
- While open, Qdrant reads/writes short-circuit to no-op; pgvector
  continues serving uninterrupted.

## Migration path

1. **Wave 4a — install**: deploy Qdrant via
   `deployments/qdrant/docker-compose.yml`, leave `QDRANT_ENABLED=false`.
2. **Wave 4b — shadow**: set `QDRANT_SHADOW_READ=true`. Run nightly
   evals and track `qdrant_shadow_compare` Jaccard across tenants.
3. **Wave 4c — dual-read**: enable `QDRANT_ENABLED=true` for a single
   pilot tenant. Monitor p95 latency, error rate, and circuit-breaker
   events.
4. **Wave 4d — tiered default**: enable `QDRANT_ENABLED=true` globally
   for tenants with > 1 M vectors. Keep pgvector as fallback.
5. **Wave 4e — optional primary promotion**: *not* in this wave.
   pgvector remains source of truth; any promotion would require a
   separate ADR and data-durability plan.

## Rollback

Set `QDRANT_ENABLED=false` and restart / hot-reload the RAG service.
All retrieval paths revert to pure pgvector within one request cycle.
No data loss: pgvector was never demoted.

For full removal: stop the Qdrant container; the circuit breaker will
open on the next request and the dual writer will serve pgvector only.

## Environment variables

| Variable             | Default                  | Purpose                              |
|----------------------|--------------------------|--------------------------------------|
| `QDRANT_ENABLED`     | `false`                  | Enable dual-write + Qdrant reads     |
| `QDRANT_SHADOW_READ` | `false`                  | Log Qdrant vs pgvector divergence    |
| `QDRANT_URL`         | `http://localhost:6333`  | Qdrant HTTP endpoint                 |
| `QDRANT_API_KEY`     | _(unset)_                | Optional Qdrant API key              |
| `QDRANT_COLLECTION`  | `rag_chunks`             | Collection name                      |
| `QDRANT_VECTOR_DIM`  | `1536`                   | Embedding dimension                  |

## Acceptance checklist

- [x] `VectorStore` abstract base and three adapters land under `app/vector_stores/`.
- [x] All vector_stores files under 200 lines.
- [x] `qdrant-client>=1.7.0` added to `services/rag/requirements.txt`.
- [x] `deployments/qdrant/docker-compose.yml` with healthcheck + volumes.
- [x] Feature-flagged: default behavior identical to pre-wave pgvector.
- [x] Circuit breaker prevents cascading failures from Qdrant outages.
- [x] Shadow mode logs divergence without affecting results.
- [x] No existing pgvector code path removed or disrupted.
