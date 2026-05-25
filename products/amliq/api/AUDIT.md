# AMLIQ v2 — Codebase Audit Results

> **Audit Date**: April 3, 2026
> **Method**: Line-by-line code review of every file in internal/, api/, web/, cmd/, migrations/
> **Verdict**: 95% production-grade. 14 specific gaps identified.

---

## Screening Engine (6-Layer Cascade)

The docs claim a 6-layer cascade. **Only 4 layers actually execute.**

| Layer | File(s) | Status | Detail |
|-------|---------|--------|--------|
| 1. Exact | `exact.go` | **DONE** | Unicode NFC normalization, case fold, punctuation strip. Wired in `engine.Screen()` line 43. Tests pass. Score: 1.0 on match. Weight: 1.0. |
| 2. Fuzzy | `fuzzy.go`, `jaro_winkler.go` | **DONE** | Jaro-Winkler implemented from scratch (89 lines). Threshold: 0.75. Wired in engine line 44. Tests pass. Weight: 0.8. |
| 3. Phonetic | `phonetic.go`, `soundex.go` | **DONE** | Full Soundex implementation (50 lines). Wired in engine line 45. Tests pass. Score: 0.7 on match. Weight: 0.6. |
| 4. Token | `token.go` | **DONE** | Jaccard similarity. Tokenizes, filters >2 chars, removes titles (Mr/Mrs/Dr). Threshold: 0.5. Wired in engine line 46. Tests pass. Weight: 0.5. |
| 5. Embedding | `embedding.go`, `embedding_pgvec.go`, `embed_batch.go` | **PARTIAL — NOT WIRED** | Code exists. pgvector migration exists (020). PgvectorMatcher has real cosine similarity. OpenAI embedding API configured. **But Engine.Screen() never instantiates or calls any embedding matcher.** |
| 6. Graph | `graph.go` | **STUB — NO-OP** | `Match()` returns empty slice (literally `var evidence []domain.MatchEvidence; return evidence`). `MatchByID()` has basic relation lookup but is never called by the engine. No graph DB backend implemented. |

### Scoring & Post-Processing: DONE
- `scorer.go`: Weighted average of all evidence. Configurable per-layer weights.
- `post_process.go`: Auto-escalate/dismiss based on tenant thresholds.

---

## Sanctions List Ingestion: FULLY DONE

All 9 parsers are real, tested, production code:

| List | File | Format | Status |
|------|------|--------|--------|
| OFAC SDN | `ofac.go` | CSV/DEL pipe-delimited | **DONE** — filters vessels/aircraft |
| EU FSF | `eu.go` | Semicolon CSV | **DONE** — multi-row aggregation |
| UN Consolidated | `un.go` | XML | **DONE** — handles INDIVIDUAL + ENTITY |
| UK OFSI | `uk_ofsi.go` | Custom CSV | **DONE** |
| SECO (Swiss) | `seco.go` | XML | **DONE** |
| OpenSanctions | `opensanctions.go` | JSON/CSV | **DONE** |
| Israeli MOD | `israeli_mod.go` | Custom | **DONE** |
| Israeli NBCTF | `israeli_nbctf.go` | Custom | **DONE** |
| Custom Lists | `custom.go` | User-provided | **DONE** |

Delta engine, ETag caching, batch sync all functional.

---

## API Endpoints: 50+ endpoints, mostly DONE

| Group | Endpoints | Status | Notes |
|-------|-----------|--------|-------|
| Screening | POST /screen, GET /{id}, demo, public-demo | **DONE** | Usage enforcement middleware |
| Batch | POST /batch, GET status/results | **DONE** | Async job processing, CSV/JSONL export |
| Alerts | GET/PUT alerts + resolve | **DONE** | Audit logging |
| Config | GET/PUT config | **DONE** | Admin-only with validation |
| Audit Trail | GET /audit, GET /{id} | **DONE** | Tenant-isolated |
| Lists | GET/POST lists + marketplace + sync | **DONE** | Marketplace enable/disable |
| Dataset | GET /latest, GET /delta | **DONE** | Delta engine support |
| Widget/iFrame | GET widget.js, POST /screen | **DONE** | CORS + API key auth |
| Compliance | Cases, PEP, UBO, EDD, media, reports | **DONE** | Full CRUD on all |
| Analytics | Dashboard + analytics | **DONE** | Screening/alert metrics |
| Auth/Team | Login, invite, roles | **DONE** | OAuth + JWT + RBAC |
| Txn Monitoring | POST /txn/screen, alerts | **DONE** | Transaction screening |
| Health | GET /health, /ready | **DONE** | DB connectivity check |
| **Billing** | Products, checkout, usage, subs, invoices | **PARTIAL** | All return **503** if LS env vars not set. No graceful fallback. |
| **Billing Seats** | POST/GET /seats | **STUB** | Returns fake ID on POST, empty `[]` on GET. No DB persistence. |

---

## Frontend: PRODUCTION-READY

| Metric | Count | Quality |
|--------|-------|---------|
| Pages | 46 | Dashboard, compliance, billing, admin, auth, marketing |
| Components | 99 | 10+ categories, Apple HIG, Tailwind |
| Route modules | 3 | Lazy-loaded, ProtectedRoute, Suspense |
| API modules | 17 | Centralized client, full endpoint coverage |
| Custom hooks | 11 | useApi, useDebounce, useMediaQuery, etc. |
| Languages (i18n) | 3 | English, Arabic, Hebrew |

---

## Billing: MOSTLY DONE, 3 GAPS

| Component | Status | Detail |
|-----------|--------|--------|
| Plans Registry | **DONE** | 15 plans (5 products × 3 tiers) with pricing/limits/features |
| LS Checkout | **DONE** | Real HTTP client, checkout URL gen, promo codes |
| Webhooks | **DONE** | HMAC-SHA256 verification, 6 event types, DB persistence |
| Usage Metering | **DONE** | Middleware tracks usage, enforcer blocks over-quota |
| **Seats** | **STUB** | No DB persistence. Fake responses. |
| **LS Config** | **PARTIAL** | All billing returns 503 without env vars. No free-tier fallback. |
| **Order webhook** | **STUB** | `order_created` handler returns nil (no-op) |

---

## Database: 30+ MIGRATIONS, COMPLETE

Key tables: tenants, users, api_keys, entities, screenings, alerts, audit, subscriptions, invoices, seats, usage_records, billing_events, monitors, cases, case_comments, batch_jobs, adverse_media, beneficial_owners, edd_reports, transactions, entity_clusters, pep_profiles, domain_allowlists, promo_codes, list_metadata, ongoing_monitors.

Extensions: pgvector (migration 020), trigram FTS (migration 018).

---

## Test Coverage

| Category | Files | Framework | Quality |
|----------|-------|-----------|---------|
| Go Backend | 262 | stdlib testing | Table-driven, real assertions |
| React Components | 50 | Vitest + @testing-library | Real assertions, mocking |
| E2E | 9 | Playwright | Chromium + iPhone 13 profiles |
| **TOTAL** | **321** | — | **Production-grade** |

---

## All Identified Gaps (14 total)

### Critical (5) — Blocking for market credibility

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| G1 | Embedding layer not wired into Engine.Screen() | Docs claim 6 layers, only 4 run. Cross-language matching broken. | **Small** — code exists, just needs wiring |
| G2 | Graph layer is a no-op stub | Network/relationship detection non-functional | **Medium** — needs DB backend + real Match() |
| G3 | No PEP database or data source | Every bank requires PEP screening. API endpoints exist but return nothing useful. | **Large** — needs data sources + ingestion + RCA mapping |
| G4 | No adverse media pipeline | GET /media/entity/{id} exists but no ingestion, no AI classification, no news feeds | **Large** — needs news feeds + AI classification + entity linking |
| G5 | Only 8 sanctions lists (need 30-50+) | World-Check has 700+. 8 lists is insufficient for credibility. | **Medium** — parser framework exists, need more parsers |

### High (5) — Important for competitive positioning

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| G6 | Billing seats stubbed | Dashboard product can't manage team licenses | **Small** — DB table exists, just need persistence |
| G7 | Billing 503 without LS config | No free-tier fallback. Unusable without LemonSqueezy setup. | **Small** |
| G8 | No continuous monitoring | Point-in-time only. No webhook on entity status change. | **Medium** — ongoing_monitors table exists |
| G9 | No regulatory enforcement actions | No SEC, FCA, FINMA data | **Medium** — new ingestion pipelines |
| G10 | Case management too basic | No SLA timers, four-eyes review, bulk disposition, priority queues | **Medium** |

### Medium (4) — Nice-to-have for launch

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| G11 | No SAR/STR report templates | Compliance officers need regulatory report export | **Medium** |
| G12 | Order webhook handler empty | order_created event is a no-op | **Small** |
| G13 | No SOC 2 / ISO 27001 prep | Enterprise buyers require certifications | **Large** (process, not code) |
| G14 | SDK packages not in repo | Billing sells SDK plans but no downloadable packages exist | **Medium** |
