# Integration Plan — sdlc-platform

Generated: 2026-05-01.

## Sequence (priority order)

### Sprint 1 (this week)

#### 1. Perfetto OTel exporter (0.5 day, before launch)
**Goal**: Per-request flame graph of the 14-step middleware chain
so we can ship the Claude Team launch with a known p99 latency
budget rather than hoping.

Steps:
1. Add `go.opentelemetry.io/otel/exporters/otlp/otlptrace` (already
   in the dep tree for OTel — verify).
2. Wire a span around each chain step in
   `services/gateway/internal/interfaces/http/middleware/chain.go`.
3. Export to `stdout` for local + a Tempo-compatible collector for
   staging.
4. Document `https://ui.perfetto.dev` upload workflow + a saved
   query: "p99 latency per chain step where path = /anthropic/v1/messages".

Acceptance: a flame graph showing the request hot path on a real
sample request.

#### 2. flakestress weekly run (30 min, before launch)
**Goal**: Catch flakes in the 80+ Claude Team tests before a
customer hits one.

Steps:
1. Add a `.github/workflows/flakestress.yml` that runs
   `go-flakestress -n 50 ./services/gateway/...` on a Sunday cron.
2. Fail the action if any test reports ≥1% flake rate.
3. Open auto-issue with the offending test names.

Acceptance: green run on first execution; the alert path tested
by manually flipping a test to `t.Fatal()` and verifying issue
opens.

### Sprint 2 (next week)

#### 3. llamafile DR fallback adapter (1 day)
**Goal**: When Anthropic + OpenAI + Bedrock + Vertex + Azure all
fail, the gateway still answers (with a clearly-labelled lower-
quality response).

Steps:
1. New `services/gateway/internal/infrastructure/llm/llamafile.go`
   implementing the `Provider` interface.
2. POST to `LLAMAFILE_HTTP_URL` (the binary's built-in server).
3. Response gets `X-Provider: llamafile-fallback` header so SDK
   callers can surface the degraded mode.
4. Add to env-sweep in `cmd/server/llm_wiring.go` as the LAST
   provider in `names` so it only fires when every cloud option
   has erred.
5. Sidecar deployment manifest at
   `deployments/k8s/llamafile-sidecar.yaml`.

Acceptance: kill the Anthropic httptest mock + confirm the chain
falls through to llamafile and returns a response.

#### 4. Agent of Empires pattern for connector ingest (0.5 day)
**Goal**: Bulk re-sync across connectors runs in parallel without
cross-tenant data races.

Steps:
1. Refactor `services/gateway/internal/connectors/registry.go`
   ingest loop to spawn one goroutine per (tenant, connector).
2. Per-goroutine context with tenant-scoped pgx connection.
3. Bounded parallelism via `golang.org/x/sync/semaphore` keyed by
   tenant id (so one tenant's heavy job doesn't starve others).

Acceptance: integration test that triggers 6 connector reindexes
across 3 tenants and asserts wall-clock time < 1.5x of a single
reindex.

### Sprint 3 (week 3)

#### 5. Tailscale embed for private_only tenants (2 days)
**Goal**: HIPAA / FINRA tenants get an L3 mesh option instead of
relying on L7 IP allowlists.

Steps:
1. Embed `tsnet` so the gateway is a Tailscale node.
2. Per-tenant tailnet name in `tenants.tailscale_tailnet`.
3. New `chain.go` step that gates `private_only` tenants on the
   tailscale-derived peer identity instead of CIDR.
4. Admin UI toggle: "Require Tailscale for private_only".
5. Runbook at `docs/runbooks/tailscale-private-deployments.md`.

Acceptance: a tailnet-scoped curl call succeeds; a public-internet
curl call (same JWT) fails with a clear 403.

## Parallel: study reference architectures (no code yet)

- **ruflo** — read the orchestrator loop. If their patterns map
  cleanly we can replace `routing.NewDefaultPolicy()` with a
  learning router that tracks per-tenant cost-vs-quality.
- **flow-nexus** — UX patterns for the connector marketplace.
- **Dossier** — context-control idiom for the future
  `/admin/policy-graph` visualizer.

## Rollout discipline

Each sprint item lands as one commit with conventional message
format `feat(<scope>): <summary> [Boost: <tool>]` so the
INTEGRATION-DEBT.md trail stays audit-friendly. Hooks into the
existing no-bluff watcher (commit hash is the verification anchor).

## Out of scope this milestone

- Voicebox / LLaMA-Mesh / 3DGRUT — wrong product surface
- nanoGPT / llm.c — we don't train
- Spacedrive / KarpathyTalk / Inbox Zero — wrong product class
- RuVector swap — pgvector works; only revisit if customer asks
  for hybrid search
- Victory chart lib — Recharts already in admin-ui deps
