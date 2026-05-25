# Wave 1 — Langfuse LLM Observability

Langfuse (https://github.com/langfuse/langfuse) gives the SDLC platform
per-call visibility into every LLM invocation: trace tree, input/output,
token usage, latency, cost, tenant / user attribution, and prompt-injection
signals. This wave integrates it into:

- `services/rag/` (Python) — via the official `langfuse` SDK.
- `services/llm-gateway/` (Go) — via a small native HTTP client in
  `internal/observability/langfuse.go` since no official Go SDK exists.

Both integrations are **opt-in via env vars** and a complete no-op when the
feature is disabled, so merging this wave has zero runtime cost.

## Env var reference

| Variable              | Required | Default                        | Notes                                   |
|-----------------------|----------|--------------------------------|-----------------------------------------|
| `LANGFUSE_ENABLED`    | yes      | `false`                        | Truthy values: `1`, `true`, `yes`, `on` |
| `LANGFUSE_HOST`       | no       | `https://cloud.langfuse.com`   | Point at your self-hosted deployment    |
| `LANGFUSE_PUBLIC_KEY` | yes      | —                              | From Langfuse project settings          |
| `LANGFUSE_SECRET_KEY` | yes      | —                              | From Langfuse project settings          |

If any required var is missing, both services log a single debug line and
skip all tracing calls.

## Self-hosting with Docker Compose

Langfuse ships as two services (web + worker) plus Postgres and ClickHouse.
The minimal docker-compose snippet below is enough for development. For
production, use the official Helm chart or Terraform module.

```yaml
# docker-compose.langfuse.yml
services:
  langfuse-db:
    image: postgres:16
    environment:
      POSTGRES_USER: langfuse
      POSTGRES_PASSWORD: langfuse
      POSTGRES_DB: langfuse
    volumes:
      - langfuse_db:/var/lib/postgresql/data
    restart: unless-stopped

  langfuse:
    image: langfuse/langfuse:2
    depends_on: [langfuse-db]
    ports:
      - "3030:3000"
    environment:
      DATABASE_URL: postgresql://langfuse:langfuse@langfuse-db:5432/langfuse
      NEXTAUTH_URL: http://localhost:3030
      NEXTAUTH_SECRET: change-me-in-prod
      SALT: change-me-in-prod
      TELEMETRY_ENABLED: "false"
    restart: unless-stopped

volumes:
  langfuse_db:
```

Bring it up:

```bash
docker compose -f docker-compose.langfuse.yml up -d
open http://localhost:3030
```

1. Create an account (first user becomes owner).
2. Create a project → copy the **public key** and **secret key**.
3. Set them in each service's `.env` file and set `LANGFUSE_ENABLED=true`.
4. Restart the gateway / RAG service and trigger an LLM call.
5. Traces should appear in the Langfuse UI within a few seconds (Go client
   flushes every 5 s or every 100 events).

## Wiring points

### RAG (Python)
- `services/rag/app/observability/langfuse_client.py` — singleton +
  `trace_llm_call()` helper.
- `services/rag/app/services/llm/llm_manager.py` — records every
  successful `complete()` with provider, model, latency, and token usage.
- `services/rag/requirements.txt` — adds `langfuse>=2.0.0`.

### LLM Gateway (Go)
- `services/llm-gateway/internal/observability/langfuse.go` — client
  struct and `TraceGeneration(ctx, name, input, output, metadata)`.
- `services/llm-gateway/internal/observability/langfuse_transport.go` —
  event structs, batching loop, HTTP flush.
- `services/llm-gateway/internal/llm/gateway.go` — instantiates the
  client inside `NewGateway`.
- `services/llm-gateway/internal/llm/gateway_trace.go` — `traceCompletion`
  helper and `Close()` for graceful shutdown.
- `services/llm-gateway/config.yaml` — new `monitoring.langfuse` block.

## Graceful shutdown

Call `gateway.Close()` on service stop so the background flush drains any
queued events. The RAG service exposes `app.observability.langfuse_client.flush()`
for the same purpose.

## Verification checklist

- [ ] `LANGFUSE_ENABLED=false` → no tracing, existing tests pass unchanged.
- [ ] `LANGFUSE_ENABLED=true` + valid keys → traces show up in UI.
- [ ] Invalid keys → gateway logs a warning once, continues serving.
- [ ] High-QPS test → Go client batches into ≤100-event POSTs.
- [ ] Shutdown → no events lost (Close() drains buffer).
