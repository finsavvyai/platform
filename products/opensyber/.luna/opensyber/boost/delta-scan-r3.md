# OpenSyber Boost — Delta Scan Round 3

**Date**: 2026-04-28
**Baseline**: Round 2 delta (commit 169ee47, 2026-04-10)
**Current**: HEAD (commit 248d41d, after Sprints 35/37/38/39 G3a)
**Commits since R2**: 20+ (full sprint cycle E1, F, plus today's five-commit chain)

## Honest accounting — what Round 1/2 *claimed* vs. what's actually on disk

| Claim (COMPLETED.md) | Reality (2026-04-28) | Action |
|---|---|---|
| Victory charts (12 components, 76 tests) | ✅ on disk: `packages/ui/src/charts/{theme,gateway,security,admin}-charts.tsx` + `.test.tsx` | none |
| Vectorize search (`apps/api/src/services/vector-search.ts`) | ✅ exists | none |
| Perfetto trace (`apps/api/src/services/trace.ts`) | ✅ exists | none |
| flakestress nightly CI (`.github/workflows/flaky-detection.yml`) | ❌ **MISSING — `.github/workflows/` directory absent** | Flag bluff. Reinstate or remove claim. |
| Tailscale mesh (`apps/agent/src/services/tailscale.ts`) | ✅ exists | none |
| llamafile offline (`apps/agent/src/services/llamafile.ts`) | ✅ exists | none |

**No-bluff finding**: the flaky-detection workflow was reported "Done" but the `.github/workflows/` directory does not exist in the repo. This is the kind of "I claimed, didn't verify" gap the no-bluffing rule exists to catch. The other 7 of 8 Round 1 deliverables verify clean.

## Round 2 priority gaps — status after 18 days

| # | Gap | R2 Effort | Status (HEAD) | Notes |
|---|---|---|---|---|
| P0 | Embedding cache | 1h | **Open** | No `embedding.*cache` references in source |
| P1 | Edge caching layer | 2h | **Open** | No `caches.default.match` calls |
| P2 | Webhook retry queue | 4h | **Open** | Webhook dispatcher present (Sprint Apr 10), no retry queue |
| P3 | Skill rec via vectors | 2h | **Open** | Skill recommendations file may still use SIGNAL_RULES |
| P4 | Client error reporting | 2h | **Open** | No `Sentry.init` / `@sentry/nextjs` in apps/web |
| P5 | OTel standard export | 4h | **Open** | No `@opentelemetry` imports |
| P6 | Visual regression tests | 6h | **Open** | Playwright present, no screenshot-diff suites |

## New gaps surfaced by 2026-04-28 sprint chain

| Sprint | What shipped | Boost-tool match |
|---|---|---|
| 35 (SSE) | 4 admin tiles for SWG/RBI/WLP/DNS at `apps/web/src/app/admin/sse/page.tsx` | Victory charts can populate per-tenant traffic / block-rate / DLP-trip volume |
| 37 (DBSC) | Bound cookie + JWS verify + risk-signals service | Perfetto-traceable; latency budget is critical for refresh path |
| 38 (Adapter v2) | 6 framework adapters + quickstart docs | None directly; Voicebox could narrate quickstart video |
| 39 G3a (AitM) | Heuristic engine + telemetry endpoint + AitM event surface | **Victory charts** + **GitNexus-style anomaly timeline** for the deferred AitM dashboard tile (G3b) |

### Highest-leverage fresh integrations

1. **Victory charts → AitM dashboard tile** (G3b deferred)
   File: `apps/tokenforge-web/src/app/dashboard/threats/aitm/page.tsx`
   Data: anomaly histogram by kind, trust-score timeline per device, top-N drift events
   Why: G3b plan already calls for this; Victory already wired in `packages/ui/src/charts/`
   Effort: 3–4h

2. **Cloudflare Cache API → DBSC challenge / well-known JWKS**
   File: `apps/tokenforge-api/src/routes/well-known.ts` + `dbsc-challenge.ts`
   Why: well-known endpoints are read-heavy + immutable; cache-edge is free latency win
   Effort: 1h. Knocks Round 2 P1 + DBSC hot path simultaneously.

3. **Embedding cache → vector-search + skill rec**
   File: `apps/api/src/services/vector-search.ts` (extend)
   Why: identical queries regenerate embeddings; KV with 24h TTL is straightforward
   Effort: 1h. Round 2 P0.

4. **flakestress workflow — re-create the missing `.github/workflows/flaky-detection.yml`**
   Why: 800+ test files now (was 538 baseline); flake budget compounds
   Effort: 30min. Round 1 P3 reinstatement.

5. **Sentry → apps/web + apps/tokenforge-web**
   Why: client errors silent in prod; Q2 launch coming, need observability signal
   Effort: 2h. Round 2 P4.

## Codebase growth since Round 2

| Metric | R2 Baseline (Apr 10) | HEAD (Apr 28) | Delta |
|---|---|---|---|
| Migrations | 39 | 51 | +12 |
| Packages | 12 | 13 | +1 (orchestrators) |
| Apps | 8 | 8 | — |
| Test files | 623 | ~800+ | +180 |
| Sprint docs | 24 | 39 | +15 |

## Recommended Round 3 batch (P0-P4, ≤8h total)

| Priority | Item | Effort | Impact | Source |
|---|---|---|---|---|
| P0 | AitM dashboard tile (Sprint 39 G3b) using Victory | 3h | High — completes the customer-visible AitM story | Sprint 39 plan |
| P1 | Reinstate `.github/workflows/flaky-detection.yml` | 30min | Medium — CI hygiene + corrects bluff | Round 1 P3 |
| P2 | Cloudflare Cache API on `/.well-known/*` + `/v1/dbsc/challenge` | 1h | High — DBSC latency + cost reduction | Round 2 P1 |
| P3 | Embedding cache for vector-search | 1h | High — cost savings | Round 2 P0 |
| P4 | Sentry → apps/web + apps/tokenforge-web | 2h | Medium — pre-launch observability | Round 2 P4 |

Skip this round (defer to R4): OTel (P5), webhook retry queue (P2 — depends on existing dispatcher refactor), visual regression (P6 — heavy + spans frameworks).

## Why this batch

Q2 2026 Product Hunt launch is the forcing function. P0 (AitM tile) closes the AitM story that 39 G3a opened — without it, customers see telemetry data via API but no visual surface. P1–P3 are pure ops hygiene that compound. P4 closes the observability gap before traffic spikes.
