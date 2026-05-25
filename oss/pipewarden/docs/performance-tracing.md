# Performance Tracing

PipeWarden ships with opt-in runtime tracing so you can see goroutine-level timelines for every scan, DLP call, and policy evaluation. Under the hood it uses Go's stdlib `runtime/trace` — zero dependencies, no collector required.

## When to reach for it

- A pipeline scan got slow after a release and you want to see *where*
- Enterprise+ customer reports p95 regression and you need evidence
- You're sizing a new tier's resource limits and need real numbers
- Before adding a cache, so you can measure the actual miss latency

## Quick start

```bash
# Terminal 1 — start server with tracing enabled
PIPEWARDEN_TRACE=1 PIPEWARDEN_TRACE_PATH=/tmp/pw.trace ./bin/pipewarden

# Terminal 2 — drive representative traffic for 20s
./bin/pipewarden trace --duration 20s --out /tmp/pw.trace

# (Ctrl-C the server when done — the trace flushes on shutdown)

go tool trace /tmp/pw.trace
# → opens browser at http://127.0.0.1:<port>/trace
```

### Flags

| Flag        | Default                  | Meaning                                            |
|-------------|--------------------------|----------------------------------------------------|
| `--url`     | `http://localhost:8080`  | Base URL of the running server                     |
| `--duration`| `20s`                    | How long to drive traffic                          |
| `--out`     | `/tmp/pipewarden.trace`  | Expected trace path (must match server env var)    |
| `--open`    | `false`                  | Auto-invoke `go tool trace` after capture          |

## What gets traced

Six hot paths carry `runtime/trace` tasks. When tracing is off, the call-site overhead is a single nil-check — safe to leave permanently in place.

| Task name            | Path                                 | Sub-regions                                                        |
|----------------------|--------------------------------------|--------------------------------------------------------------------|
| `RunAnalysis`        | `POST /api/v1/analysis/run`          | `ProviderFetch`, `ClaudeAnalyze`, `PersistFindings`                |
| `QuickAnalysis`      | `POST /api/v1/analysis/quick`        | `ProviderFetch`, `HeuristicAnalyze`, `PersistFindings`             |
| `ScanDLP`            | `POST /api/v1/dlp/scan`              | `DLPScan`                                                          |
| `EvaluatePolicy`     | `POST /api/v1/policy/evaluate`       | (nested via policy engine)                                         |
| `CreateFixPRBatch`   | `POST /api/v1/findings/fix/pr/batch` | `CreateFixPR-worker` (×N parallel, Agent-of-Empires fan-out)       |
| *tracing Task* root  | `main.go`                            | Wraps the process lifecycle                                        |

To add another trace point in your own handler:

```go
import "github.com/finsavvyai/pipewarden/internal/tracing"

func (h *Handlers) MyHotPath(w http.ResponseWriter, r *http.Request) {
    ctx, end := tracing.Task(r.Context(), "MyHotPath")
    defer end()

    endDB := tracing.Region(ctx, "DatabaseRead")
    rows, err := h.db.Query(...)
    endDB()
    // ...
}
```

Task() and Region() are inert when `PIPEWARDEN_TRACE` is unset — safe to leave everywhere.

## Reading a trace

`go tool trace` serves an interactive HTML UI. The views you'll want most:

- **View trace** → goroutine timeline. Filter by `Task` to see just your handler invocations.
- **Goroutine analysis** → identifies goroutines blocked on syscalls, locks, network.
- **Synchronization blocking profile** → which mutexes are contended.
- **Network blocking profile** → which HTTP calls are slow (Claude API? GitHub API?).
- **Syscall blocking profile** → SQLite write stalls show up here.

## Baseline expectations (as of v1.1.x on M-series / modern Linux)

| Task          | p50     | p95     | Dominant region                   |
|---------------|---------|---------|-----------------------------------|
| QuickAnalysis |  60 ms  | 180 ms  | `ProviderFetch` (GitHub API)      |
| RunAnalysis   | 900 ms  | 2.4 s   | `ClaudeAnalyze` (LLM token gen)   |
| ScanDLP       |   4 ms  |  12 ms  | `DLPScan` (regex over 200kB body) |
| EvaluatePolicy|  15 ms  |  55 ms  | policy eval + finding fetch       |
| BatchFixPR(10 findings, 4 workers) | 18 s | 35 s | serial GitHub API calls per worker |

Treat these as ballpark — they come from a single benchmark machine. **Measure on your own hardware before quoting.**

## Continuous capture in production

Don't leave `PIPEWARDEN_TRACE=1` on all the time — trace files grow ~1 MB/min/goroutine. For production timelines:

```bash
# Helm — override envs for a 30-minute capture window
helm upgrade pipewarden ./deploy/helm/pipewarden \
    --reuse-values \
    --set-string extraEnv.PIPEWARDEN_TRACE=1 \
    --set-string extraEnv.PIPEWARDEN_TRACE_PATH=/app/data/pw-$(date +%s).trace

# wait 30 minutes, then:
kubectl cp pipewarden-xxx:/app/data/pw-*.trace ./pw.trace
helm upgrade pipewarden ./deploy/helm/pipewarden --reuse-values --set extraEnv.PIPEWARDEN_TRACE=
```

## Related

- `make trace` — Makefile target that starts the server with `PIPEWARDEN_TRACE=1` and the right env vars
- `internal/tracing/` — package source, including the inert-when-off Task and Region helpers
- `docs/benchmarks/offline-llm.md` — scoring rubric that consumes trace data

## Download a trace from a running server

Once tracing is on (`PIPEWARDEN_TRACE=1`), the server exposes the most
recent trace at:

```
GET /api/v1/trace/latest
```

Response is the raw `runtime/trace` binary with
`Content-Disposition: attachment; filename="pipewarden.trace"` and an
`X-Trace-Active: <bool>` header that tells you whether tracing is still
running. 404 with a hint message if no trace has been recorded yet.

```bash
curl -OJ http://localhost:8080/api/v1/trace/latest
go tool trace pipewarden.trace      # local viewer
```

### Perfetto-compatible workflow

`runtime/trace` files are *not* native Perfetto traces but convert cleanly:

1. Download the trace via the endpoint above.
2. Convert with [`gotraceui`](https://github.com/dominikh/gotraceui)
   (`gotraceui -export-perfetto pipewarden.trace > pipewarden.pftrace`)
   or any other `runtime/trace` → Perfetto bridge.
3. Drag-drop the `.pftrace` file into [`ui.perfetto.dev`](https://ui.perfetto.dev).
4. Run SQL queries on the trace data (Perfetto's killer feature) without
   adding a server-side telemetry pipeline.

## Not included (yet)

- Server-side Perfetto exporter: `gotraceui` handles conversion today;
  a built-in `pipewarden trace export --perfetto` command is queued in
  `.luna/pipewarden/boost/integration-plan.md` item B1.
- Remote ingestion (OTel OTLP): deliberately out of scope until a customer
  asks. Ingesting traces into a third-party vendor re-introduces egress
  that defeats the air-gap story.
