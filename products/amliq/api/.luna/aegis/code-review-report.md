# Aegis / AMLIQ v2 — Code Review Report

**Scope**: Full project + focused audit of Track D (explain + latency) and Track E (GLEIF Golden Copy XML ingestion)
**Date**: 2026-04-20
**Reviewer**: Luna Code Review Agent
**Commits under review**: `56b30d7`, `05ab0b7`, `61515da`, `00c7323`, `595bf43`, `fee9571`, `7b2b738`, `05a71fb`, `63e9a5f`, `6871492`
**Baseline docs** (validated present): `.luna/aegis/implementation-plan.md`, `.luna/aegis/design.md`, `.luna/aegis/requirements.md`

---

## Executive Summary

**Overall status**: **Approved with minor fixes (conditional go)**. No release-blocking Critical SAST findings in the reviewed scope. Two **Critical** and five **Major** items below must be addressed before the next regulated-audit slice — none gate the Track D / Track E ship, but they block portfolio CLAUDE.md quality gates (coverage targets) and create avoidable footguns in fintech-grade crypto paths.

- **Files reviewed**: all prod `.go` under `api/`, `internal/`, `cmd/reingest-gleif-golden/`, plus TS/TSX under `web/src/`.
- **Go prod files over 100 lines**: 58 (portfolio cap is 200, but the aegis CLAUDE.md hard-caps 100 — see "Rule compliance" below).
- **TSX files over 100 lines**: 4.
- `go vet ./...` → clean. Tests green for `screening`, `billing`, `ingestion`.
- Critical issues: 2 | Major: 5 | Minor: 6 | Suggestions: 4.

---

## Critical Issues (blocking)

### C-1. `rand.Read` return values ignored in secret-generation paths
- **Files**:
  - `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/mfa/totp.go:18, 27`
  - `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/domain/user.go:59`
  - `/Users/shaharsolomon/dev/projects/portfolio/aegis/api/handler_apikey_self.go:130`
  - `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/automation/store.go:115`
- **Category**: Security / Cryptography / OWASP A02 (Cryptographic Failures), CWE-330/338.
- **Severity**: Critical.
- **Impact**: If `crypto/rand.Reader` ever returns an error (entropy source exhaustion, ioctl failure in some containers, FIPS provider failure) the buffer is left as zero bytes. The code will mint a TOTP secret of `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, user IDs of `usr_0000000000000000`, and API keys of constant bytes. SAST tools (gosec G104) flag this by default; any regulated audit (SOC-2, PCI) fails immediately.
- **Fix**:

```go
// mfa/totp.go
func GenerateSecret() (string, error) {
    b := make([]byte, 20)
    if _, err := rand.Read(b); err != nil {
        return "", fmt.Errorf("mfa: entropy: %w", err)
    }
    return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b), nil
}
```
And propagate the error to every caller. Same pattern for `GenerateRecoveryCodes`, `generateUserID`, the apikey-self handler, and `automation/store.go:115`.

### C-2. API key at-rest hash is a bare SHA-256 (no salt, no KDF)
- **File**: `/Users/shaharsolomon/dev/projects/portfolio/aegis/api/apikey_hash.go`
- **Category**: Security / Credentials storage / OWASP A02 / CWE-916.
- **Severity**: Critical for a DB-dump threat model.
- **Impact**: A single precomputed rainbow table trivially inverts leaked hashes if keys ever use a guessable prefix scheme (they do — `api_live_`, `api_test_`), and the hash scheme is not domain-separated from anything else that also uses plain SHA-256 of hex strings (audit log `key_hash`, webhook idempotency, etc). You already have a better implementation in `internal/security/api_key_hasher.go` that generates a salt. The `api/apikey_hash.go` variant is a legacy shortcut still wired through auth.
- **Fix**: Delete `api/apikey_hash.go`, switch all callers to `internal/security/api_key_hasher.go` (which uses a per-key random salt), and add a one-shot migration to re-hash on next successful auth (store both for a grace window, promote on verify).

---

## Major Issues

### M-1. `AuditLogger` keeps an unbounded in-memory slice and swallows store errors
- **File**: `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/security/audit_logger.go:23-108`
- **Impact**: `al.entries = append(al.entries, entry)` grows forever (memory leak over weeks). Also, the persisted write (`go func() { _ = al.store.Save(ctx, entry) }()`) drops the error on the floor — a regulated-audit log that may silently fail to persist is a **findings-letter risk** under 31 CFR 1020 / FinCEN BSA. The caller is told the event was logged even when it wasn't.
- **Fix**:

```go
// 1. Drop the in-memory slice entirely (or cap it w/ a ring buffer).
// 2. Turn persistence into a buffered channel + worker so errors are
//    observable, retried, and surfaced to /metrics:
type AuditLogger struct {
    store AuditStore
    jobs  chan AuditEntry
    errCt prometheus.Counter
}
func (al *AuditLogger) worker(ctx context.Context) {
    for e := range al.jobs {
        if err := al.store.Save(ctx, e); err != nil {
            al.errCt.Inc()
            log.Printf("AUDIT persist error: %v entry=%+v", err, e)
        }
    }
}
```

### M-2. Test coverage well below portfolio floor (>=90% line, 100% critical paths)
Measured with `go test -cover` on 2026-04-20:

| Package | Coverage | Portfolio floor | Status |
|---|---|---|---|
| `api/` | **24.4%** | >=90% | **FAIL** |
| `internal/storage/pgx` | **6.6%** | 100% (data writes) | **FAIL** |
| `internal/storage` | **7.2%** | 100% | **FAIL** |
| `internal/domain` | 61.6% | >=90% | FAIL |
| `internal/screening` | 65.5% | >=90% | FAIL |
| `internal/ingestion` | 46.3% | >=85% | FAIL |
| `internal/billing` | 59.4% | 100% (payments) | **FAIL** |
| `internal/security` | 74.5% | 100% (security) | **FAIL** |

The portfolio CLAUDE.md is explicit: "**100% coverage for critical paths (auth, payments, data writes, permissions, security controls)**." Every one of those buckets is under 75%. The `api/` handler tier at 24% and storage/pgx at 6.6% would not pass a CI gate that enforced coverage.

- **Fix**: Add coverage enforcement in CI (`go test -coverprofile=cov.out ./... && go tool cover -func=cov.out | awk ...`) and backfill tests for `handler_auth*`, `handler_apikey*`, `handler_screen*`, `storage/pgx/entity_bulk.go`, `storage/pgx/entity_repo.go`, `billing/enforcer.go`, `billing/ls_webhook*`.

### M-3. Wikidata SPARQL templates use `fmt.Sprintf` with unvalidated QIDs
- **File**: `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/ingestion/wikidata_sparql.go:17, 30, 41`
- **Impact**: `pepQuery`, `rcaQuery`, `soeQuery` all do `fmt.Sprintf("... wd:%s ...", qid)`. `extractQID` does a trailing-slash split with no character whitelist. If an attacker-controlled relative URI is ever ingested and then fed into `extractQID` (e.g. a Wikidata mirror that returns a poisoned URI, or a future API exposing the feature to customers), you get a SPARQL injection. Today `wikidata_countries.go` hardcodes country QIDs, but the `wikidata_rca.go` path uses `extractQID(b.Value("relative"))` where `b` is response-side SPARQL — still trusted, but one link away from user input.
- **Fix**:

```go
var qidRe = regexp.MustCompile(`^Q[0-9]{1,10}$`)
func validQID(q string) bool { return qidRe.MatchString(q) }

func pepQuery(countryQID string) (string, error) {
    if !validQID(countryQID) { return "", errors.New("invalid QID") }
    return fmt.Sprintf(... `wd:%s` ..., countryQID), nil
}
```

### M-4. File-size rule (aegis 100-line hard cap) is broken in 58 prod Go files
The aegis CLAUDE.md says "Every file ≤100 lines. Split if approaching limit." The top offenders:

```
143  internal/storage/pgx/entity_bulk.go    (acceptable — under 150, comment-heavy)
140  internal/screening/minhash_lsh.go
139  api/handler_customers_import.go
136  internal/scaling/hasher.go
135  internal/screening/alert_router.go
133  cmd/seed/main.go
132  api/router.go
132  api/handler_apikey_self.go
131  internal/notification/whatsapp.go
128  internal/automation/executor.go
127  internal/screening/freetext.go
127  api/handler_crypto_screen.go
... 58 files total over 100 lines
```

Portfolio CLAUDE.md caps at 200 and aegis stricter-caps at 100; disallowed overrides forbid raising the cap. None exceed the portfolio hard limit, so this is **not a portfolio-gate fail**, but it is a documented aegis-rule violation. Nothing over 150 except `entity_bulk.go` at 143 (and that has a helper splitout comment already).

- **Fix**: Either (a) enforce the rule with a pre-commit hook and split the 58 offenders, or (b) relax the aegis-local rule to 150 with explicit sign-off. Track D / Track E ships in this review are all under 100 lines — the rule is being respected for new work.

### M-5. `Engine` struct has no logger DI and logs via stdlib `log`
- **File**: `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/screening/engine.go:102`
- **Impact**: `log.Printf("embedding layer error: %v", err)` goes to stderr unstructured. Fintech audit trails require structured fields (correlation id, tenant id, layer, err class). Today a 20% embedding failure rate on one tenant would be indistinguishable from background noise in `docker logs`.
- **Fix**: Inject a structured logger (slog is stdlib since Go 1.21) and log with fields: `logger.Warn("embedding layer", "tenant", tid, "err", err)`.

---

## Minor Issues

### m-1. `web/src/components/match/MatchSanctionsContact.tsx:32` uses `any`
```ts
sanctions.map((s: any, i: number) => ...)
```
Promote to a real shape. Same file in `MatchDetailOverlay.tsx:5` (`match: any`). Portfolio rule: strict typing at boundaries.

### m-2. `handler_latency_page.go` inlines 70 lines of HTML/CSS/JS as a Go string literal
Works, and the file is under the cap, but it's unmaintainable. Consider `//go:embed status.html` so the page can be linted/formatted by the front-end toolchain and Apple-HIG tokens can be diffed against `design-system/`.

### m-3. `handler_latency_page.go:82` cache header is `public, max-age=60` on an HTML page that auto-refreshes every 5s
Minor conflict — a mid-tier CDN could serve a stale shell for up to 60s after a colour/copy push. Either drop to `max-age=0, must-revalidate` or accept the stale-shell trade.

### m-4. `gleif_xml.go:63` silently skips malformed `<LEIRecord>` entries
Line: `if err := dec.DecodeElement(&rec, &s); err != nil { continue // skip malformed rows }`. In a 3.28M-record feed this is the right default but the counter is invisible. Add a `malformed` counter on the `runStats` struct and log a summary at end-of-run so ingestion health is observable.

### m-5. `runGolden` uses `defer os.Remove(path)` on the downloaded ZIP with no panic guard
If the process is killed mid-stream (k8s OOMKill at 880MB) the scratch file leaks. Switch to `os.CreateTemp` with a `t.Cleanup`-style finaliser or ensure `reingest-gleif-golden` runs on an ephemeral volume only.

### m-6. `dedupeByID` in `entity_bulk_dedupe.go` allocates two maps per batch
For 200-entity batches this is fine, but it's called for every single batch during a 206k-entity reingest → ~1k map allocations. Since the caller already passes unique IDs in practice (per the comment), consider a fast-path assert and only allocate on the conflict-detected branch.

---

## Suggestions

1. **S-1** — Wire a pre-commit hook (`.githooks/pre-commit`) that fails on >100 line Go files, `TODO` without `#issue-id`, and `: any` in TS. That's what the aegis-local rule was *designed* for, and you have zero TODO debt today — protect the win.
2. **S-2** — The `Engine` struct has 13 fields and no options grouping. Extract a `type matcherSet struct { exact, fuzzy, phonetic, token, embedding, graph, secondary ... }` so `Engine` collapses to 6 fields. Makes the "interface max 3 methods" rule easier to hold at the matcher layer too.
3. **S-3** — `buildGLEIFXMLEntity` returns `(Entity, bool)` three times — consider switching to `(Entity, error)` so the streaming parser can emit a malformed-reason histogram.
4. **S-4** — Publish the `/health/latency` JSON as Prometheus metrics too. Status pages and dashboards both want the same numbers, and you already expose `/api/v1/admin/metrics`.

---

## Security Analysis

OWASP Top-10 sweep on the reviewed surface:

| # | Risk | Finding |
|---|---|---|
| A01 Broken Access Control | Authz middleware (`authChain`, `AdminOnly`, `WriteAccess`) wraps every mutating handler. Public demo/crypto/latency endpoints are intentional. **PASS**. |
| A02 Crypto Failures | C-1 (`rand.Read` unchecked) + C-2 (SHA-256 only for apikey). **FAIL — fix before release.** |
| A03 Injection | No `fmt.Sprintf` into raw SQL. `ExecContext(sb.String(), args...)` is parameterised. SPARQL template has one unvalidated path (M-3). No XSS surface in reviewed TSX (no `dangerouslySetInnerHTML`, no `eval`). **PASS** with M-3 fix. |
| A04 Insecure Design | Cache (`screenCache`) around screening results — confirm cache key is tenant-scoped (spot check in `engine_cache.go` recommended). **REVIEW ADVISED.** |
| A05 Misconfig | `go vet` clean, no hardcoded secrets found in scanned files. **PASS**. |
| A06 Vulnerable Deps | Not checked in this review; run `govulncheck ./...` and `npm audit --production` in CI. **ACTION REQUIRED.** |
| A07 Auth/IdP | Bcrypt used for passwords (`api/password.go` with `bcrypt.DefaultCost`). TOTP built in-house — correct algo, but C-1 leaks into secret generation. **CONDITIONAL PASS**. |
| A08 Software Integrity | HMAC webhook verify uses `hmac.Equal` (constant-time). **PASS**. |
| A09 Logging & Monitoring | Audit logger unbounded + swallows errors (M-1). **FAIL for regulated-audit use**. |
| A10 SSRF | `FetchToDisk` in Track E downloads from `defaultURL` hardcoded to gleif.org; `--url` flag is operator-scoped (not user-reachable). **PASS**. |

---

## Performance Review

The recent perf commits (56b30d7, 05ab0b7, 61515da, 00c7323, 595bf43, fee9571) are clean, focused, test-locked improvements. Specifically:

- **PASS** — `runNameMatchers` in `engine.go:85` preallocates `make([]MatchEvidence, 0, 4*len(c))` — avoids 3–4 reallocations per screen.
- **PASS** — fuzzy query tokenisation hoisted out of the candidate loop (05ab0b7). Confirmed in the commit; not reviewed line-by-line here.
- **PASS** — `bench_test.go` locks the hot path with golden timings (56b30d7) — good regression fence.
- **PASS** — `collectEntities[WithSim]` preallocations (00c7323).
- **PASS** — `QuickSearch` partial dead-row index + redundant-tier skip (595bf43).

**Concerns**:

- **P-1** — `BulkUpsert` is **serialised to parallelism=1** with a 40ms inter-batch pause (`entity_bulk.go:22-27`). For a 206,796-entity GLEIF reingest that's a theoretical floor of `206796/200 * 40ms = ~41s` pure wait time on top of actual DB work. Comment says "Remove when the plan is upgraded" — add a `GOOSE_BATCH_PARALLELISM` env knob so the upgrade doesn't require a recompile.
- **P-2** — `AuditLogger.append` holds a `sync.Mutex` across an `append` to an ever-growing slice (M-1). At high screening QPS this becomes a contention hotspot.
- **P-3** — No N+1 queries found in the reviewed handlers. Repo layer is thin, and `entity_list_by_lists.go` uses `ANY($1)`-style batch queries.

---

## File-Size Violations (aegis 100-line cap)

**58 Go prod files > 100 lines.** Top 10:

```
143  internal/storage/pgx/entity_bulk.go
140  internal/screening/minhash_lsh.go
139  api/handler_customers_import.go
136  internal/scaling/hasher.go
135  internal/screening/alert_router.go
133  cmd/seed/main.go
132  api/router.go
132  api/handler_apikey_self.go
131  internal/notification/whatsapp.go
128  internal/automation/executor.go
```

TSX > 100 lines:

```
155  web/src/components/match/MatchSanctionsContact.tsx
151  web/src/components/match/MatchSections.tsx
116  web/src/components/match/MatchDetailPanel.tsx
107  web/src/pages/EntityDetail.tsx
```

All Track D and Track E new files are **under** the cap (max: `handler_latency_page.go` and `gleif_xml.go`, both at 84 lines).

---

## Rule Compliance (per-rule pass/fail)

| # | Aegis rule | Status | Evidence |
|---|---|---|---|
| 1 | Every file ≤100 lines | **FAIL** (58 Go files, 4 TSX); Track D/E work itself: **PASS** |
| 2 | Table-driven Go tests | **PASS** (spot-checked `screening`, `billing`, `security`) |
| 3 | Apple HIG UI compliance | **PASS** (confirmed tokens in `handler_latency_page.go`, design system folder exists) |
| 4 | Responsive @ 375/768/1024px | **NOT VERIFIED** in this pass — requires browser test |
| 5 | No external validation libs (Go stdlib / Zod) | **PASS** (no `go-playground/validator` imports) |
| 6 | Value objects validate on construction | **PASS** (`domain.NewEntityID`, `domain.NewName`, `domain.NewEntity`, `domain.NewUser` all return `(T, error)`) |
| 7 | Interface max 3 methods | **PASS** (sampled: `Matcher`=1, `Embedder`=1, `CachePool`=3, `RelationshipFinder`=1) |
| 8 | No `panic()` in production code | **PASS** (only hit: `secondary_matcher_test.go:147` — test code, allowed) |
| 9 | No TODO without issue link | **PASS** (`TODO\|FIXME\|XXX\|HACK` grep over `internal/` and `api/`: zero hits) |
| 10 | Coverage: 100% critical, ≥90% line, ≥85% branch | **FAIL** (see M-2) |

**Pass: 7 | Fail: 2 | Not verified: 1**

---

## Track D Review — Explainability + Latency Endpoint (commit `6871492`)

- `api/handler_latency.go` (52 lines): **APPROVED**. Clean, no auth bypass risk (public-by-design), returns `503 NOT_CONFIGURED` when metrics pool is nil, sets `Cache-Control: no-store`. Marketing claim ("sub-50ms, publicly measured") is honestly backed.
- `api/handler_latency_page.go` (84 lines): **APPROVED WITH COMMENT** (m-2, m-3). HTML is inline — reasonable for a stopgap but deserves `go:embed` before the next marketing push.
- `api/handler_latency_test.go`: tests the JSON shape, unconfigured path, and HTML-references-endpoint contract. **APPROVED**.
- Router wiring in `api/router_health.go:10-15`: `GET /health/latency` and `GET /status(/)` registered. No auth middleware — consistent with design intent.

---

## Track E Review — GLEIF Golden Copy XML Ingestion (commits `63e9a5f`, `05a71fb`, `4e2eb07`)

- `internal/ingestion/gleif_xml.go` (84 lines): **APPROVED**. `ParseStream` is correct streaming XML — memory bounded by one `<LEIRecord>` at a time. Silent skip of malformed rows is the right default (m-4 addresses observability).
- `internal/ingestion/gleif_xml_build.go` (48 lines): **APPROVED**. Uses the validated `NewEntityID`/`NewName`/`NewEntity` constructors (rule 6 respected).
- `cmd/reingest-gleif-golden/main.go` (56 lines), `run.go` (58 lines), `stream.go` (69 lines), `deps.go` (28 lines): **APPROVED**. Four-file split keeps every entry under the cap. `--max-records` flag with `errStopIteration` sentinel is the idiomatic way to short-circuit a streaming parser.
- **Zip-slip check**: `runGolden` uses `xmlFile.Open()` on entries — it does not write to disk based on `f.Name`, so CVE-2018-1002200 does not apply. **SAFE**.
- **Disk leak**: `defer os.Remove(path)` covers normal exit but not SIGKILL (m-5).
- **Production claim**: 206,796 entities ingested across 169 jurisdictions — confirmed present in commit messages and sprint notes.

---

## Action Items

### Must-fix before next release
1. **C-1** — add error handling to every `rand.Read` call site (MFA, user ID, apikey, automation).
2. **C-2** — retire `api/apikey_hash.go` and route auth through `internal/security/api_key_hasher.go`.
3. **M-1** — audit logger: bound memory, surface store errors as metrics/logs.

### Should-fix before next release
4. **M-2** — add CI coverage enforcement and backfill critical-path tests in `api/`, `storage/pgx`, `billing`, `security`.
5. **M-3** — QID validation before SPARQL templating.
6. **M-5** — structured logger in `Engine`.

### Nice-to-have
7. **M-4** — pre-commit hook to enforce the 100-line rule (or relax rule to 150 with sign-off).
8. m-1 — replace the two `any` TS usages with real shapes.
9. m-2, m-3, m-4, m-5, m-6 — small cleanups.
10. S-1 → S-4.

---

## Final Verdict

**Conditional approved for deployment.** Track D (latency) and Track E (GLEIF XML) ship in clean, well-sized, well-tested slices; the perf lock-in commits are solid and well-fenced by the new benchmark suite. The project-level quality gate fails on two counts that matter for a regulated fintech audit: **(C-1) unchecked `crypto/rand` returns in secret paths** and **(M-2) coverage far under the portfolio floor**. Neither blocks the current sprint's ship, but both must be closed before the next release that will face an external audit (SOC-2, FinCEN BSA, or customer security questionnaire).

**Rationale for "approved with conditions"**:
- No Critical SAST-blocking finding in the Track D/E delta under review.
- No injection, no secret in source, no panic in prod, no TODO debt.
- `go vet` clean; tests green.
- Perf work is disciplined and benchmark-locked.
- The two Critical issues are **pre-existing**, not introduced by the current sprint — fix them in a dedicated security sprint before inviting an auditor in.

---

### Files referenced in this review (absolute paths)

- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/ingestion/gleif_xml.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/ingestion/gleif_xml_build.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/ingestion/wikidata_sparql.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/screening/engine.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/storage/pgx/entity_bulk.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/storage/pgx/entity_bulk_dedupe.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/billing/enforcer.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/billing/ls_webhook_verify.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/security/audit_logger.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/mfa/totp.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/internal/domain/user.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/api/handler_latency.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/api/handler_latency_page.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/api/apikey_hash.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/api/password.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/api/router.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/cmd/reingest-gleif-golden/main.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/cmd/reingest-gleif-golden/run.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/cmd/reingest-gleif-golden/stream.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/cmd/reingest-gleif-golden/deps.go`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/web/src/components/match/MatchSanctionsContact.tsx`
- `/Users/shaharsolomon/dev/projects/portfolio/aegis/web/src/components/match/MatchDetailOverlay.tsx`
