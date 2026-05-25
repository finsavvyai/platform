# No-Bluff Report — aegis

Scope: last 10 commits (`595bf43..199a97e`) + changed `*.md`.
Date: 2026-04-27.
Mode: interactive.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 2 |
| Medium   | 1 |
| Low      | 0 |

Verified-clean claims (sample): `TaskRegistry`, `CryptoSyncSvc`, `LoadCryptoInto`, `PopulateFingerprintsByList`, route `POST /api/v1/admin/lists/{id}/sync-fingerprints`, `bestWordMatchTokens`, `titlePrefixes`, `entity_quick_search.go` + `entity_quick_search_tiers.go` split, `deleted_at IS NULL` filter, `singleWord` branch, `enforcer.RecordUsage` + `statusRecorder`, IL parser registrations + SPARQL URLs, 23 positives + 23 negatives seed sets in `data/benchmark/`.

---

## B1 — Critical: Phantom public claim

**Where**
- Commit `199a97e` body: `Backs the public claim of "~90% fewer false positives than World-Check" with reproducible numbers.`
- `cmd/benchmark-fp/main.go:18`: same string in package docstring.

**Evidence**
- `grep -rn "fewer false positiv\|90%.*World-Check" README.md docs/` → no AMLIQ-authored public claim of this form anywhere.
- The only `90%` hit in docs is `docs/COMPETITIVE_LANDSCAPE.md:79`, an INDUSTRY problem statement (`"90% of screening alerts are false positives"`), NOT an AMLIQ-vs-World-Check comparative.
- No benchmark output exists yet (see B2), so the "reproducible numbers" do not exist.

**Why bluff** Cites a public claim that was never published, then says the cmd "backs" it. Self-referential — the cmd's docstring repeats the claim, the commit cites it as if external.

**Fix proposals**
- (a) Remove the sentence from commit body (history) — not feasible without rebase.
- (b) Soften `cmd/benchmark-fp/main.go:18` docstring to `Produces precision/recall/F1/FPR numbers for AMLIQ on a controlled dataset; comparable runs against World-Check require its API key.` (no comparative claim until benchmarked).
- (c) Add the public claim to `README.md` / `docs/COMPETITIVE_LANDSCAPE.md` AFTER running the benchmark and recording the actual ratio.

---

## B2 — High: Phantom output file + unverified metrics

**Where**
- Commit `199a97e` body: `writes a Markdown report at docs/benchmark/world-check-vs-amliq.md`.
- `cmd/benchmark-fp/main.go:16,30,73`: same path as default `--out`.

**Evidence**
- `ls docs/benchmark/` → `No such file or directory`. Report has never been generated and committed.
- Commit message uses present tense, implying the artifact exists.

**Why bluff** Reads as "we generated this report"; truth is "tool produces this file IF you run it". Borderline — the cmd does write the file at runtime — but the commit's adjacent claim of "reproducible numbers" elevates the bluff because no numbers were reproduced before the commit landed.

**Fix proposals**
- (a) Run `go run ./cmd/benchmark-fp -api-base $LIVE -api-key $KEY -out docs/benchmark/world-check-vs-amliq.md` against staging, commit the resulting `.md` so the path is no longer phantom.
- (b) Or rename docstrings to `Output (when run): docs/benchmark/world-check-vs-amliq.md` to remove the "already done" implication.

---

## B3 — High: Bench regressions claimed to fail CI but no assertion exists

**Where**
- Commit `56b30d7` body: `Future regressions to any of these numbers — especially new allocs on the cached paths — should fail the benchmark expectations.`

**Evidence**
- `internal/screening/engine_bench_test.go` contains plain `testing.B` benchmarks (`BenchmarkScreen50Candidates`, `BenchmarkNormalize_Cached`, `BenchmarkPhoneticCodes_Cached`).
- Zero `b.Fatal` / threshold assertions. `go test ./...` does not run benchmarks. Nothing in CI consumes their output.
- The "180µs/op, 588KB, 1261 allocs" / "9 ns/op, 0 allocs" numbers are commit-message-only; not enforced anywhere.

**Why bluff** Claims a regression-gate that does not exist.

**Fix proposals**
- (a) Add a `TestNormalizeCachedAllocs` / `TestPhoneticCachedAllocs` using `testing.AllocsPerRun` with hard caps (e.g. `if got > 1 { t.Fatalf(...) }`) — actually fails CI if cached path regresses.
- (b) Or rewrite commit msg framing in future commits: `Numbers are reference values for manual `go test -bench` runs; not CI-enforced.`

---

## B4 — Medium: Mayor count disagrees between commit and code

**Where**
- Commit `419b00c` body: `Wikidata SPARQL pulls 178 Israeli mayors`.
- `internal/ingestion/wikidata_il_mayors.go:14`: `Coverage: ~250 living/historical mayors`.

**Evidence**
- Commit asserts a specific count (178). Code's own comment says ~250. One of them is wrong; no run output is committed to adjudicate.
- Total math: `178 + 1184 + 580 = 1942 ≈ "~1,940 new IL entities"` from commit; if mayors=250 the total would be ~2014.

**Why bluff** Specific count without reproducible source. Either the SPARQL was run once and got 178 (then code estimate is stale) or the number is fabricated.

**Fix proposals**
- (a) Run the SPARQL once, capture the row count in a comment in `wikidata_il_mayors.go` (`// Last counted 2026-04-XX: 178 rows.`), reconcile with the package docstring estimate.
- (b) If the SPARQL was never executed, update the commit narrative in a follow-up commit: drop the "178" specific and use the code's "~250" estimate band.

---

## What to do

Pick per item: `keep` / `remove` / `rewrite` / `auto-fix`. Auto-fix targets only `cmd/benchmark-fp/main.go` docstrings (B1, B2) and a new alloc-cap test (B3). B4 needs a real SPARQL run — cannot auto-fix.

---

## B5 — High: Judiciary count off by ~2× (found in drill follow-up)

**Where**
- `internal/ingestion/wikidata_il_judiciary.go:13` (pre-fix): `Coverage estimate from a count check: ~580–900 distinct persons.`
- Commit `419b00c` body: `~580+ IL judges/justices/central bankers`.

**Evidence (2026-04-27 live)**
- Ran the exact SPARQL from the source file's URL constant against
  `https://query.wikidata.org/sparql` →
  `{ "n": { "value": "298" } }` (distinct persons).
- 298 vs claimed 580 → claim is off by ~95%, well beyond drift.

**Why bluff** Quoted estimate that does not survive re-verification.

**Fix** Source comment now reads `298 distinct persons (last counted
2026-04-27 ... earlier estimate of ~580–900 was wrong — replaced
after live verification).`

---

## B6 — Medium: Knesset count not re-verifiable today

**Where**
- `internal/ingestion/knesset_odata.go:12`: `~1,184 current + historical Members of Knesset`.

**Evidence (2026-04-27)**
- `curl https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_Person/$count` returned the maintenance page URL, not a count.
- Cannot confirm or deny 1,184 today.

**Fix** Comment now records the inability to re-verify on 2026-04-27 explicitly: "live count not re-verified on 2026-04-27 — knesset.gov.il was returning a maintenance page".

**Update — 2026-04-28** Re-ran `curl https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_Person/$count` once the host came back online. Live response: `1184`. Code comment updated to record the verified count + the 2026-04-28 verification date. Hedge replaced with verified figure.

---

## Resolution — 2026-04-27

All 6 fixed in working tree:

| ID | Fix | Files |
|----|-----|-------|
| B1 | Removed phantom "public claim of ~90% fewer FPs" from package docstring + report template title + headline-metrics column. Report no longer claims a comparison it cannot make. | `cmd/benchmark-fp/main.go` |
| B2 | `--out` default now `""` (stdout); docstring states "no file is written until run, path does not pre-exist". Stdout path added in `writeReport`. | `cmd/benchmark-fp/main.go` |
| B3 | New `TestNormalizeCachedAllocs` + `TestPhoneticCodesCachedAllocs` (0-alloc cap) AND `TestScreen50CandidatesAllocBudget` (1500-alloc cap, baseline 1261). All run under `go test ./...` → gated by pushci `test-go` stage. Real bench output captured at `docs/perf/benchmarks-2026-04-27.txt`. | `internal/screening/cached_allocs_test.go`, `internal/screening/screen_allocs_test.go`, `docs/perf/benchmarks-2026-04-27.txt`, `docs/perf/README.md` |
| B4 | Live-verified mayor count = 178 against Wikidata SPARQL on 2026-04-27. Comment now reads "178 ... last counted 2026-04-27". | `internal/ingestion/wikidata_il_mayors.go` |
| B5 | Live-verified judiciary count = 298 against Wikidata SPARQL on 2026-04-27. Source comment was off by ~2×. Replaced with verified count + audit note. | `internal/ingestion/wikidata_il_judiciary.go` |
| B6 | 2026-04-27: Knesset OData live source returning maintenance page; comment hedged. 2026-04-28: host back online, live `$count` returned 1184 (matches prior figure). Comment now records the verified count + 2026-04-28 verification date. | `internal/ingestion/knesset_odata.go` |

Verification:
- `go build ./cmd/benchmark-fp/... ./internal/screening/... ./internal/ingestion/...` clean.
- `go test ./internal/screening/... ./internal/ingestion/...` PASS (incl. 3 new alloc-cap `Test*` functions).
- `grep "fewer false positiv\|public claim\|Refinitiv whitepaper"` on `cmd/benchmark-fp/main.go` → no hits.
- `go test -bench=...` real run captured 1261 allocs (Screen50), 0 allocs (cached). Numbers in commit `56b30d7` reproduce on Apple M4 Max — only the "CI gates this" claim was a bluff, not the numbers themselves.
- Live SPARQL counts: mayors=178, judges=298. Knesset OData on 2026-04-27 returned a maintenance page; on 2026-04-28 live `$count` returned 1184 (figure now verified, not hedged).
