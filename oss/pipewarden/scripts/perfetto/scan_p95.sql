-- scan_p95.sql — Scan duration P50/P95/P99.
--
-- Reads slices emitted by internal/tracing/runtime.go::Region when
-- PIPEWARDEN_TRACE=1. ClaudeAnalyzer.AnalyzeRun wraps a region named
-- `pipewarden.scan` (internal/analysis/claude.go); each slice is one
-- end-to-end Claude scan.
--
-- Conversion path: Go's runtime/trace output → gotraceui
--   (`gotraceui -export-perfetto`) → Perfetto .pftrace.
-- See docs/sre/trace-cookbook.md for setup. dur is in nanoseconds;
-- divide by 1e6 for milliseconds.
--
-- Per-provider breakdown is tracked separately as the runtime/trace
-- Region API does not carry args; once a track-event emitter lands,
-- swap in EXTRACT_ARG(arg_set_id, 'provider').

SELECT
  COUNT(*)                       AS scans,
  PERCENTILE(dur, 50) / 1e6      AS p50_ms,
  PERCENTILE(dur, 95) / 1e6      AS p95_ms,
  PERCENTILE(dur, 99) / 1e6      AS p99_ms
FROM slice
WHERE name = 'pipewarden.scan';
