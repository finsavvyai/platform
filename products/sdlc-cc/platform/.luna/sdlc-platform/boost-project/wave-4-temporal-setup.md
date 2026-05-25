# Wave 4 — Temporal Durable Workflows for Ingestion

**Status**: Scaffolded (2026-04-08)
**Owner**: Platform / RAG
**Location**: `services/rag/app/workflows/`
**Dev cluster**: `deployments/temporal/docker-compose.yml`

## Goal

Replace fragile Bull-queue retries in the document ingestion pipeline with
Temporal durable workflows. Ingestion is multi-stage, long-running, and
expensive to restart from scratch — exactly the workload Temporal exists for.

Bull queues kept in-memory state: if a worker restarted mid-embed we lost the
job's position and re-ran the entire pipeline. Temporal persists workflow
history to its own store, so a restart resumes from the last completed
activity with no extra engineering.

## Architecture

```
+---------------+        +----------------+        +------------------+
| FastAPI       |  gRPC  | Temporal       |  poll  | Ingestion Worker |
| /ingest POST  | -----> | Server         | <----> | (app/workflows/  |
| (client.py)   |        | (history + wf) |        |  worker.py)      |
+---------------+        +----------------+        +------------------+
                                                           |
                                                           | activities
                                                           v
                         +------------------+  +-------------------+
                         | download_document|  | extract_content   |
                         | (httpx stream)   |  | (IngestionService |
                         +------------------+  |  tiered router)   |
                                               +-------------------+
                                                           |
                                                           v
                         +------------------+  +-------------------+
                         | chunk_document   |->| embed_chunks      |
                         | (window slicing) |  | (embedding HTTP)  |
                         +------------------+  +-------------------+
                                                           |
                                                           v
                                               +-------------------+
                                               | index_document    |
                                               | (pgvector insert) |
                                               +-------------------+
```

The workflow body in `ingestion_workflow.py` is deterministic: it only
chains `execute_activity` calls and stores stage progress in instance fields
exposed via a Temporal query. All I/O happens in `activities.py`.

Importantly, the workflow **wraps** the existing `IngestionService` —
it does not replace it. Tier routing (MarkItDown / Unstructured / Docling)
stays exactly where Wave 3 left it.

## Files

| File | Role | Lines |
|------|------|-------|
| `app/workflows/__init__.py` | Package exports + `TASK_QUEUE` constant | ~40 |
| `app/workflows/ingestion_workflow.py` | `DocumentIngestionWorkflow`, retry policies, dataclasses | ~146 |
| `app/workflows/activities.py` | 5 activities: download/extract/chunk/embed/index | ~174 |
| `app/workflows/worker.py` | Worker entry point, graceful SIGTERM shutdown | ~84 |
| `app/workflows/client.py` | FastAPI helpers: start, status, cancel | ~118 |

All files are under the 200-line portfolio cap.

## Retry Policy Rationale

Three retry shapes, picked per activity:

- **`_NETWORK_RETRY`** (download, embed): 8 attempts, 2s -> 60s backoff.
  Network I/O sees the most transient failure: flaky CDNs, embedding API
  rate limits, DNS blips. Non-retryable on `ValueError` (bad URL) and
  `PermissionError` (403) — those will never succeed on retry.
- **`_CPU_RETRY`** (extract, chunk): 4 attempts, 1s -> 30s backoff. CPU
  failures are almost always deterministic — a corrupted PDF will fail the
  same way on attempt 4. `UnsupportedFormatError` short-circuits immediately.
- **`_INDEX_RETRY`** (index): 6 attempts, 2s -> 120s backoff. Database
  writes can fail on contention or transient connectivity but should
  **not** retry past `IntegrityError` (duplicate document — a bug, not a
  flake).

Every activity calls `activity.heartbeat()`. Long-running stages (download,
embed) heartbeat per chunk/batch so Temporal can detect a hung worker and
reassign the activity to a healthy one within 30-60 seconds.

Deterministic workflow IDs (`ingest-{tenant}-{document}`) mean retrying the
same document dedupes at the server — no double-indexing if a client
mis-retries a FastAPI call.

## How to Run the Dev Cluster

```bash
# Start Temporal server + UI + backing Postgres
docker compose -f deployments/temporal/docker-compose.yml up -d

# Verify health
curl http://localhost:8233        # Temporal Web UI
grpc_health_probe -addr=localhost:7233   # optional

# Tear down
docker compose -f deployments/temporal/docker-compose.yml down -v
```

Ports:

- **7233**: gRPC API, used by workers and the FastAPI client.
- **8233**: Web UI, browse workflow history, query running executions,
  inspect retry attempts, download payloads.

## How to Start a Worker

```bash
cd services/rag
pip install -r requirements.txt   # pulls temporalio>=1.5.0

TEMPORAL_ADDRESS=localhost:7233 \
TEMPORAL_NAMESPACE=default \
EMBEDDING_ENDPOINT=http://localhost:8001/embed \
INDEX_ENDPOINT=http://localhost:8000/internal/index \
python -m app.workflows.worker
```

Environment variables:

| Var | Default | Purpose |
|-----|---------|---------|
| `TEMPORAL_ADDRESS` | `localhost:7233` | gRPC endpoint |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_MAX_ACTIVITIES` | `20` | Concurrent activities per worker |
| `EMBEDDING_ENDPOINT` | `http://embedding:8000/embed` | Embedding HTTP API |
| `INDEX_ENDPOINT` | `http://rag:8000/internal/index` | pgvector insert API |

For production, run multiple worker replicas on the same task queue
(`sdlc-rag-ingestion`) — Temporal load-balances work automatically. Split
embedding onto GPU nodes by running a second worker that only registers
`embed_chunks`.

## Kicking Off a Workflow from FastAPI

```python
from app.workflows import (
    DocumentIngestionRequest,
    start_ingestion_workflow,
    get_workflow_status,
    cancel_workflow,
)

request = DocumentIngestionRequest(
    file_url="https://...",
    tenant_id="acme",
    document_id="doc-123",
    strategy="auto",
    metadata={"source": "upload"},
)
workflow_id = await start_ingestion_workflow(request)
status = await get_workflow_status(workflow_id)
# ... later:
await cancel_workflow(workflow_id)
```

The status dict includes live stage progress (`download`, `extract`, `chunk`,
`embed`, `index`, `completed`) via a Temporal workflow query — no polling the
database.

## Monitoring via Temporal UI

Temporal Web UI at `http://localhost:8233` gives us:

- **Workflow list**: filter by namespace, type, status, tenant.
- **History view**: every activity attempt, retry, and failure with
  stack traces and input/output payloads.
- **Query inspector**: run the `status` query live against any running
  workflow to see which stage it's in.
- **Schedules tab** (Phase 2): add cron-style recurring ingestion for
  tenants with daily document drops.

For production, ship worker logs to the existing Langfuse / OTel stack
(Wave 1) — Temporal's history store handles orchestration visibility, our
telemetry stack handles application semantics.

## Definition of Done

- [x] Workflow + activities scaffolded, all files <= 200 lines
- [x] Retry policies parameterised per stage
- [x] Dev docker-compose cluster for local iteration
- [x] `temporalio>=1.5.0` added to `services/rag/requirements.txt`
- [ ] FastAPI endpoint wired to `start_ingestion_workflow`
- [ ] Integration test: start workflow, assert terminal status == COMPLETED
- [ ] Worker deployment manifest (K8s) in `deployments/k8b/`
- [ ] Migration plan from Bull queue: dual-write period, then cutover

## References

- Temporal Python SDK: https://github.com/temporalio/sdk-python
- Temporal server: https://github.com/temporalio/temporal
- Wave 3 ingestion pipeline: `./wave-3-ingestion-setup.md`
