# Perfetto Trace Cookbook

Status: shipped. Helper lives at `scripts/trace-query.sh`; Make target
`make trace-query Q=<name>` is the contributor entry point. The three
canonical queries live under `scripts/perfetto/*.sql`.

Slice contract today (verified by greps in `internal/analysis/`):

| Slice                       | Emitted from                                      |
|-----------------------------|---------------------------------------------------|
| `pipewarden.scan`           | `internal/analysis/claude.go::AnalyzeRun`        |
| `pipewarden.dlp.validate`   | `internal/analysis/dlp.go::ValidateFindings`     |

Future regions (not wired yet) will extend the contract; queries
should be added under `scripts/perfetto/` with the same one-line
description-on-line-1 convention so `make trace-query` discovers them.

## Why Perfetto on top of `runtime/trace`

`docs/performance-tracing.md` already covers the existing
`go tool trace` flow (drag-drop into `ui.perfetto.dev` works for the UI
view). Perfetto's `trace_processor` adds a SQL surface on top so SREs
can answer questions like *"what is the P95 wall time of a scan
broken down by provider"* without clicking through a UI.

## Prerequisites

Install `trace_processor` once:

```bash
# Linux / WSL
curl -L https://get.perfetto.dev/trace_processor -o /usr/local/bin/trace_processor
chmod +x /usr/local/bin/trace_processor

# macOS
brew install perfetto    # exposes `trace_processor` on PATH
```

Capture a trace per `docs/performance-tracing.md` (`PIPEWARDEN_TRACE=1`,
default output `/tmp/pipewarden.trace`).

## Query 1 — Scan duration P50/P95/P99

`scripts/perfetto/scan_p95.sql` — overall scan latency percentiles.
Per-provider breakdown is deferred until a track-event emitter
(replacing `runtime/trace` Regions, which carry no args) lands.

## Query 2 — DLP fan-out per scan

`scripts/perfetto/finding_fanout.sql` — counts
`pipewarden.dlp.validate` child slices per `pipewarden.scan` parent.
A future per-finding emit region will let this count actual findings;
until then it tracks DLP phase fan-out as a proxy.

## Query 3 — GC stalls during DLP validate

`scripts/perfetto/gc_during_dlp.sql` — joins runtime/trace's `GC %`
slices to `pipewarden.dlp.validate` to surface allocation hot paths
in DLP regex compilation.

## Running locally

```bash
# Once N3 lands:
make trace-query Q=scan_p95
# Today (manual):
trace_processor /tmp/pipewarden.trace -q scripts/perfetto/scan_p95.sql
```

## Caveats

- Slice names (`pipewarden.scan`, `pipewarden.dlp.validate`) are
  emitted only when `PIPEWARDEN_TRACE=1`. Without that envvar these
  queries return zero rows.
- `runtime/trace` Regions carry only a name, no args. Per-provider
  breakdown queries are deferred until a track-event emitter lands.
- These queries are read-only; running them against a production
  trace cannot mutate state.
