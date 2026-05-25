# Performance reference numbers

Source-of-truth output from `go test -bench` runs, committed so any
claim about screening speed/alloc behaviour can be cross-referenced.

| File | Captured | Hardware |
|------|----------|----------|
| `benchmarks-2026-04-27.txt` | 2026-04-27 | Apple M4 Max, darwin/arm64 |

Reproduce locally:

```
go test -run='^$' \
    -bench='BenchmarkScreen50Candidates|BenchmarkNormalize_Cached|BenchmarkPhoneticCodes_Cached' \
    -benchmem -benchtime=2s -count=3 ./internal/screening/
```

CI gating lives in `Test*` functions (benchmarks themselves do not
gate pushci's `test-go` stage):

- `internal/screening/cached_allocs_test.go` — 0-alloc cap on cached
  Normalizer + phonetic paths.
- `internal/screening/screen_allocs_test.go` — 1800-alloc cap on the
  full `Screen50Candidates` hot path. Baseline: 1261 allocs/op
  without `-race`; ~1597 allocs/op under `-race` (the mode pushci's
  `test-go` stage runs in). Cap accommodates race-instrumented
  overhead while still catching doubling-class regressions.
