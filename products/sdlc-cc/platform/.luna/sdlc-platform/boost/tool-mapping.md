# Tool Mapping — sdlc-platform

Generated: 2026-05-01.

## Strong matches (ship within 1 sprint)

### Perfetto — performance tracing for the Go gateway
- **Why**: Day 19 k6 load tests are 🔴 (no staging URL). Perfetto's
  Chrome-trace + SQL analysis gives us per-request flame graphs of
  the 14-step middleware chain without standing up a staging stack.
  Profile DLP detector latency, audit Writer queue depth, OPA
  evaluation cost, FallbackChain provider selection.
- **Stack fit**: Go gateway emits perfetto trace events natively
  via `go.opentelemetry.io/otel` exports (already in deps).
- **Effort**: ~0.5 day to wire OTel → Perfetto trace export.
- **Output**: SQL-queryable trace files in `traces/` dir + a CI
  job that flags p99 regressions.

### flakestress — surface flaky tests in our 80+ test suite
- **Why**: We just added ~80 behavior tests (Claude Team batch).
  Some will be flaky under load. flakestress runs each test N times
  in parallel and reports failure-rate clusters.
- **Stack fit**: Go-native; single binary.
- **Effort**: ~30 min to add a CI job `go-flakestress -n 100 ./...`.
- **Trigger**: Run weekly on main; alert if any test ≥1% flake.

### Tailscale — private-deployment tenant isolation
- **Why**: Day 26 IP allowlist (`tenants.network_mode='private_only'`)
  works at L7. Tailscale gives us L3 mesh: each enterprise tenant
  gets a tailnet, the gateway is a node, no public ingress at all
  for `private_only` tenants.
- **Stack fit**: Go-native (`tsnet` library) so the gateway can
  embed a Tailscale node directly.
- **Effort**: ~1 day for the embed + 1 day for a runbook + admin UI
  toggle.
- **Customer fit**: HIPAA / FINRA / FedRAMP tenants who already
  said no to public-internet ingress.

### llamafile — offline LLM fallback for DR scenarios
- **Why**: Our FallbackChain has Anthropic / OpenAI / Bedrock /
  Vertex / Azure — every option is cloud. When all of them are
  having a bad day, customer requests 502. llamafile (single-file
  llama.cpp executable) gives us an in-cluster fallback that runs
  even when WAN is dead.
- **Stack fit**: New `infllm.NewLlamafile` adapter behind a
  `LLAMAFILE_BINARY` env var.
- **Effort**: ~1 day for adapter + sidecar deployment manifest.
- **Quality tradeoff**: smaller models (e.g. Llama 3.1 8B) so the
  fallback is honest about reduced capability — surface via a
  `X-Provider: llamafile-fallback` header.

### Agent of Empires — pattern reference for connector parallelism
- **Why**: Day 39-48 connector framework registers 6 connectors
  (Google Workspace / Slack / GitHub / Zendesk / ServiceNow /
  HubSpot). Bulk re-sync runs serially today. Agent of Empires'
  git-worktree-per-agent pattern translates directly: spawn one
  isolated goroutine per (tenant, connector) for concurrent
  ingestion without cross-tenant data races.
- **Stack fit**: Pattern only, no library dependency.
- **Effort**: ~0.5 day to refactor connector ingest loop.

## Medium matches (next milestone)

### any-llm — already aligned, study for design refinement
- **Status**: We have FallbackChain that does what any-llm does.
  Worth reading their adapter shapes for any patterns we missed
  (e.g. retry classification, streaming back-pressure).
- **Action**: 30 min skim of their `provider.py` interface.

### RuVector — alternative vector store for RAG
- **Why**: pgvector is the current backend. RuVector adds
  self-learning weights + hybrid (semantic + keyword) search.
- **Stack fit**: Rust-native; would replace `vector-core` package
  which isn't yet runtime-active.
- **Effort**: ~3 days; not recommended unless customer asks for
  hybrid search specifically.

## No-fit (skip)

| Tool | Reason |
|---|---|
| Victory | admin-ui already uses Recharts |
| Voicebox | compliance gateway has no voice surface |
| LLaMA-Mesh | no 3D output need |
| 3DGRUT / PPISP | no rendering surface |
| nanoGPT / llm.c | we're a gateway, not training |
| Spacedrive | no desktop client |
| KarpathyTalk | wrong product class |
| Inbox Zero | wrong product class |
| GitNexus | dev metrics is out of scope |

## Reference architectures worth studying

- **ruflo** — self-learning agent orchestration patterns; could
  inform a smarter routing layer (currently `routing.NewDefault
  Policy()`)
- **flow-nexus** — gamified agentic platform patterns; useful for
  the connector marketplace UX direction
- **Dossier** — visual planning + context control patterns;
  inspiration for a future `/admin/policy-graph` view
