# Quick Wins — sdlc-platform

Generated: 2026-05-01.

Each item < 1 hour, code-only, no external creds.

## 1. flakestress weekly cron (30 min)
Add `.github/workflows/flakestress.yml`:
```yaml
on: { schedule: [{ cron: '0 4 * * 0' }] }  # Sunday 04:00 UTC
jobs:
  detect-flakes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.24' }
      - run: go install github.com/bradfitz/flakestress@latest
      - run: cd services/gateway && flakestress -n 50 ./...
```
Catches flakes in our 80+ new behavior tests before customers do.

## 2. Perfetto OTel exporter env var (30 min)
The chain already uses `go.opentelemetry.io/otel`. Switch the
exporter target via env:
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317  # local Tempo
```
Then `https://ui.perfetto.dev` reads the trace dump. No code change
needed for v1; just document the workflow in
`docs/runbooks/perfetto-tracing.md`.

## 3. llamafile health probe (45 min)
Add `/health/llamafile` that probes `LLAMAFILE_HTTP_URL/health`.
Returns 200 when the local fallback is reachable; admin UI uses
this to show "DR fallback ready" badge. Reuses the existing
`internal/infrastructure/health` registry.

## 4. Agent of Empires connector parallelism — read-only sweep (45 min)
Read their `cmd/agent-of-empires/main.go` and document which
patterns apply to our connector framework in
`docs/notes/aoe-patterns.md`. No code change yet; just a written
plan tied to integration-plan.md sprint 2 step 4.

## 5. Reference-architecture skim (1 hour total)
30 min each, no code:
- `ruflo/orchestrator.py` — note any patterns we should adopt for
  the routing layer.
- `flow-nexus/web/marketplace.tsx` — note any UX idioms for the
  connector marketplace.
- `Dossier/context.go` — note any context-control patterns for the
  future `/admin/policy-graph` view.

Output: one shared `docs/notes/reference-arch-skim.md` with bullet
points of "we should consider" per project.

## 6. Move Recharts deprecation note (5 min)
Recharts `^2.8.0` is still on v2; v3 is GA. Pin in `package.json`
or schedule a `/schedule` follow-up to upgrade. (Out-of-scope today,
flag it.)

## What's NOT a quick win

- Tailscale embed: 2 days; needs a runbook + admin UI toggle.
- llamafile adapter: 1 day; needs sidecar deployment manifest +
  fallback chain wiring + integration test.
- Perfetto chain-step instrumentation: 0.5 day; not 1 hour.

## Triggering this list

Drop straight into next milestone backlog. Pick item 1 to land
this week (no creds, no infra, fully automated). Items 2-6 are
opportunistic.
