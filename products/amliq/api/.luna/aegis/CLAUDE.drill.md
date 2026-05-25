# Anti-Bluff Drill — aegis

Scoped guardrails. Loaded by sessions that opt in. Reversible — delete
this file to drop the round's lessons.

CI runner for aegis is **PushCI** (`pushci.yml` at repo root), NOT
GitHub Actions. There is no `.github/workflows/` directory. All CI
guardrails reference pushci.yml.

---

## Round 1 — 2026-04-27

### GUARD-1 — Phantom CI / phantom infra

Before claiming a CI step exists ("runs SAST", "blocks on Critical",
"dependabot enabled", "secret scanning on PR"), grep `pushci.yml` for
the actual stage. If the stage is not present, write
`[NOT YET WIRED IN pushci.yml]` instead of describing the gate as if
it runs.

What `pushci.yml` actually has today (2026-04-27):
- `test-go` stage: `go test -cover -race ./api/... ./cmd/... ./internal/... ./pkg/... ./tests/...`
- `build` stage: `go build -o bin/api ./cmd/api` + `bin/worker`
- No SAST. No dep-vuln scan. No secret scan. No license scan.

Implication: any portfolio-CLAUDE rule about security scanning is
aspirational, not enforced. Say so.

### GUARD-2 — Hyperbolic perf claims

Never write "Nx faster", "major overhaul", "production-ready",
"comprehensive", or any speedup multiplier without a before/after
benchmark output committed to the repo. Replace with the concrete
mechanism:

  Bad:  "10x faster screening"
  Good: "preallocates evidence slice to len(candidates), avoiding
         ~5 reallocations per matcher per screen (commit 61515da)"

Reference output: `docs/perf/benchmarks-2026-04-27.txt`.

### GUARD-3 — Stale defaults after in-session fix

When release notes or docs reference a default value (CLI flag, env
var, config), re-grep the source file in the same turn. Do not quote
a default from memory of an earlier file version in the same
conversation. The fix that just landed is the source of truth.

### GUARD-4 — Numeric coverage / count claims

Specific counts ("178 mayors", "298 judges", "1,184 MKs") must cite:

  (a) a `// Last counted YYYY-MM-DD: <n>` comment in the source file, or
  (b) a fixture or test file with the count baked in, or
  (c) a captured live-source response committed under `docs/sources/`.

Otherwise hedge: "~order-of-magnitude N (source-dependent, not
re-verified on YYYY-MM-DD)".

If a coverage estimate in source disagrees with the live source by
>20%, treat the comment as stale and update it before quoting from
either side.

### GUARD-5 — CI-enforcement claims

"CI fails on regression" requires a `t.Fatalf` / `t.Errorf` in a
`Test*` function (Go benchmarks `Benchmark*` are NOT run by
`go test ./...` and therefore do NOT gate pushci's `test-go` stage).

Verify with `grep -n 't\.Fatalf\|t\.Errorf' <file>` before the claim.

Today's actual gates (Test*, not Benchmark*):
- `internal/screening/cached_allocs_test.go`
  - `TestNormalizeCachedAllocs` — 0 allocs/op cap
  - `TestPhoneticCodesCachedAllocs` — 0 allocs/op cap
- `internal/screening/screen_allocs_test.go`
  - `TestScreen50CandidatesAllocBudget` — 1800 allocs/op cap. Baseline:
    1261 allocs/op without `-race`; ~1597 allocs/op under `-race` (the
    mode pushci's `test-go` stage runs in). Cap covers the
    race-instrumented baseline + ~13% headroom.

These run inside pushci's `test-go` stage and fail builds on regression.

### GUARD-6 — Live-source disagreements (added retroactively)

When the audit re-runs a live source (Wikidata SPARQL, Knesset OData,
OpenSanctions API) and the count disagrees with the source-file
estimate by >20%, that is a bluff in the source comment, not just a
documentation drift. Update the comment in the same commit as the
audit run. Do not let stale estimates linger.

When a live source was unreachable at last verification ("hedged"),
the next session that runs in the same project must retry the source
before quoting the hedged number. If retry succeeds, replace the hedge
with the verified count + new date in the same turn. Do not let
hedges harden into permanent text.

---

## Round 3 — 2026-04-28

Re-drill on the hardened state from Round 1+2. Score: 22/22 claims =
100% (threshold 95%) — PASS.

New finding from this round (a drill-meta bluff):

### GUARD-7 — Drill guardrails themselves go stale

This file (`.luna/aegis/CLAUDE.drill.md`) is part of the codebase. Its
own quoted constants (alloc caps, baselines, file paths) drift the
moment a follow-up commit changes them. Round 3 caught GUARD-5 still
quoting `1500 allocs/op cap (baseline 1261)` after commit `280dcc3`
raised the cap to 1800 with race-baseline 1597 — the very GUARD-3
("stale defaults") violation we wrote the rule against, in the rule
file itself.

Whenever a commit changes a number GUARD-5 (or any GUARD-N) quotes,
update this file in the same commit. The guardrail file is not
write-once — it tracks the codebase like a spec.

Recorded fixes from this round:
- GUARD-5 numbers: 1500 → 1800 cap; baseline split into
  `1261 (no-race) / ~1597 (-race)`.
- GUARD-6 amended with the "retry hedged sources next session" clause
  after B6 (Knesset count) closed today on retry from yesterday's
  hedge.
