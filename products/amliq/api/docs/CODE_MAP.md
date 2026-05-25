# CODE_MAP.md — Directory-to-Purpose Reference

## Root Level Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | **Read this first** — AI instruction file |
| `README.md` | Full project docs with examples |
| `Makefile` | Build + run commands (`make docker-up`, `make test`) |
| `Dockerfile` | Container image definition |
| `.env.example` | Environment variable template |
| `go.mod`, `go.sum` | Go dependencies |
| `docs/` | AI-friendly documentation (start here) |

## cmd/ — Entrypoints

```
cmd/
├── api/main.go          ← Start HTTP server on PORT=8080
│   └─ Loads config, creates repositories, starts server
└── worker/main.go       ← Background job processor
    └─ Processes batch screenings, list syncs asynchronously
```

**When to edit**: Never directly. Configure via environment variables (DATABASE_URL, PORT, etc).

## internal/domain/ — Value Objects & Entities

**Core concept**: Domain-driven design. Every type validates on construction.

| Type | File | What It Does |
|------|------|--------------|
| EntityID | `entity_id.go` | Sanctioned entity identifier (ent_123) |
| TenantID | `tenant_id.go` | Customer identifier (ten_456) |
| Name | `name.go` | Full name (GivenName, FamilyName) |
| Entity | `entity.go` | Sanctioned person/company/vessel (has names, identifiers) |
| ScreenRequest | `screen_request.go` | "Screen this entity" request |
| ScreenResponse | `screen_response.go` | Screening result (matches + explanation) |
| MatchResult | `match_result.go` | Single match with evidence |
| MatchEvidence | `evidence.go` | "Layer 2 found 92% similarity" |
| Confidence | `confidence.go` | Match confidence score (0-100) |
| Disposition | `disposition.go` | Action (NeedsReview, Accept, Reject) |
| MatchLayer | `match_layer.go` | Enum: Exact, Fuzzy, Phonetic, Token, Embedding, Graph |
| Alert | `alert.go` | High-confidence match requiring review |
| AlertStatus | `alert_status.go` | Enum: Pending, Resolved, FalsePositive |
| AlertPriority | `alert_priority.go` | Enum: Low, Medium, High, Critical |
| AuditEntry | `audit_entry.go` | Immutable audit log entry |
| AuditAction | `audit_action.go` | Enum: Create, Update, Delete, Resolve, etc |
| Subscription | `subscription.go` | Billing subscription |
| SubscriptionStatus | `subscription_status.go` | Enum: Active, Paused, Cancelled |
| Product | `product.go` | Enum: API, Dashboard, SDK, iFrame, Dataset |
| ProductTier | `product_tier.go` | Plan tier (Lite, Pro, Enterprise) |
| Plan | `plan.go` | Product + Tier + pricing |
| PlanTier | `plan_tier.go` | Tier features and limits |
| UsageMetric | `usage_metric.go` | What we measure (screenings, seats, api_calls) |
| UsageRecord | `usage_record.go` | "50 screenings this month" |
| PromoCode | `promo_code.go` | Discount code (AMLIQ_FREE, etc) |
| Invoice | `invoice.go` | Monthly/annual invoice |
| BillingEvent | `billing_event.go` | LemonSqueezy webhook event |
| APICredential | `api_credential.go` | API key with product prefix (api_sk_..., dash_sk_...) |
| DomainAllowlist | `domain_allowlist.go` | Whitelisted entities (won't match) |
| Seat | `seat.go` | Dashboard user seat |
| SeatLimit | `seat_limit.go` | Max seats per plan tier |
| TenantConfig | `tenant_config.go` | Screening weights, thresholds per customer |
| VesselDetails | `vessel.go` | Maritime vessel (IMO, MMSI, flag, tonnage) |
| PEPClassification | `pep_class.go` | Enum: Domestic, Foreign, InternationalOrg, SOE, RCA |
| CountryRiskEntry | `country_risk.go` | Country risk score (0.0-1.0) + level band |
| CountryRiskIndex | `country_risk.go` | Country risk lookup with tenant overrides |

**When to edit**: Add new domain model → create NewXxx.go with constructor, validation, test file.

## internal/screening/ — Matching Engine

**6-layer cascade architecture**: Each layer produces MatchEvidence objects.

| Layer | File | Algorithm | Speed | Use Case |
|-------|------|-----------|-------|----------|
| 1 Exact | `exact.go`, `normalizer.go` | Unicode norm + case fold | ~0.1ms | "JOHN SMITH" = "john smith" |
| 2 Fuzzy | `fuzzy.go`, `jaro_winkler.go` | Jaro-Winkler distance | ~1ms | "JOHN SMITH" ≈ "JON SMYTH" (85%) |
| 3 Phonetic | `phonetic.go`, `soundex.go` | Soundex algorithm | ~2ms | "Smith" ≈ "Smyth" |
| 4 Token | `token.go` | Jaccard similarity | ~3ms | Split names, compare tokens |
| 5 Embedding | `embedding.go`, `cosine.go` | Vector cosine | ~10ms | Semantic similarity |
| 6 Graph | `graph.go` | Relationship traversal | ~20ms | "Related to sanctioned person?" |
| Vessel | `vessel_matcher.go` | IMO/MMSI exact, name fuzzy | ~1ms | Maritime entity screening |
| PEP Classifier | `pep_matcher.go` | Classification + risk multiplier | <1ms | Risk-tier adjustment for PEPs |

| File | Purpose |
|------|---------|
| `engine.go` | Orchestrates 6 layers, short-circuits at threshold |
| `scorer.go` | Weighted combination of evidence → final Confidence |
| `explainer.go` | Generates "why did this match?" explanation |
| `matcher.go` | Base Matcher interface |
| `mathutil.go` | Float math utilities (for scoring) |

**When to edit**:
- Add new layer → create `my_layer.go` + `my_layer_test.go`
- Modify scoring → edit `scorer.go` weights
- Change explanation logic → edit `explainer.go`

## internal/ingestion/ — Sanctions List Parsers

**Parser registry pattern**: Pluggable parsers for different list formats.

| File | Format | Source |
|------|--------|--------|
| `ofac_parser.go` | OFAC SDN CSV | US Treasury |
| `ofac_vessel.go` | OFAC vessel/maritime records | US Treasury Maritime |
| `un_parser.go` | UN Security Council XML | UN |
| `eu_parser.go` | EU Consolidated Sanctions XML | EU |
| `uk_ofsi.go` | UK OFSI/FCDO Sanctions (UKSL) | UK |
| `swiss_parser.go` | Swiss SECO XML | Swiss |
| `israeli_parser.go` | Israeli Ministry XLSX | Israel |
| `ukrainian_parser.go` | Ukrainian SDFM CSV | Ukraine |
| `opensanctions_parser.go` | OpenSanctions JSON | opensanctions.org |
| `country_risk.go` | Country risk index building | CPI, FATF, Basel, WorldBank |
| `country_risk_cpi.go` | Corruption Perceptions Index | Transparency International |
| `pep_everypolitician.go` | PEP classification from EveryPolitician | EveryPolitician/WikiData |
| `gleif.go` | Legal Entity Identifier lookup | GLEIF (Global LEI Foundation) |
| `icij.go` | Investigative Journalism Bureau data | ICIJ databases |
| `opensanctions_premium.go` | Premium OpenSanctions bulk feed | opensanctions.org (premium) |
| `registry.go` | Parser lookup (map[ListSource]Parser) |
| `fetcher.go` | HTTP with ETag caching + retries |
| `delta.go` | Computes list changes (add/remove/modify) |

**When to edit**:
- New sanctions list → create `new_source_parser.go` + `new_source_parser_test.go`
- Register in `registry.go`

## internal/billing/ — LemonSqueezy Integration

| File | Purpose |
|------|---------|
| `lemonsqueezy_client.go` | HTTP client to LemonSqueezy API |
| `webhook_handler.go` | Process LemonSqueezy webhook events |
| `usage_metering.go` | Track usage per tenant/metric |
| `invoice_generator.go` | Generate invoices from usage |
| `subscription_manager.go` | Subscription lifecycle (create, pause, cancel) |

**When to edit**:
- New product → add to domain Product enum, update pricing tables
- New metric → add to domain UsageMetric enum, track in handlers
- Change webhook format → edit `webhook_handler.go`

## internal/storage/ — Repository Interfaces

**No database logic here**. Pure interfaces, implemented by backends.

| Interface | Methods | Used For |
|-----------|---------|----------|
| EntityRepository | Create, Get, List, Search, Delete | Sanctioned entities |
| ScreeningRepository | Create, Get, List, Update | Screening results |
| AlertRepository | Create, Get, List, Update, Resolve | High-confidence matches |
| AuditRepository | Append, List, Get | Immutable audit trail |
| TenantRepository | Create, Get, Update, List | Multi-tenancy config |
| SubscriptionRepository | Create, Get, List, Update, Cancel | Billing subscriptions |
| UsageRepository | Record, Sum, List | Usage tracking |

| Implementation File | Backend |
|---------------------|---------|
| `postgres.go` | PostgreSQL (production) |
| `memory.go` | In-memory (testing, dev) |

**When to edit**:
- New query type → add method to interface + both implementations
- Never add business logic (stays in handlers/services)

## internal/config/ — Configuration

| File | Purpose |
|------|---------|
| `config.go` | Load environment variables into Config struct |
| `validate.go` | Validate required config (DATABASE_URL, etc) |

**Environment variables**:
```
PORT=8080
HOST=0.0.0.0
DATABASE_URL=postgres://user:pass@localhost/aegis
REDIS_URL=redis://localhost:6379
TOKEN_SECRET=your-jwt-secret
TOKEN_EXPIRY=3600
```

## api/ — HTTP Handlers & Middleware

**Pattern**: One handler file per domain.

| File | Endpoints |
|------|-----------|
| `handler_screening.go` | POST /screen, POST /batch, GET /screenings/{id} |
| `handler_alerts.go` | GET /alerts, PUT /alerts/{id}/resolve |
| `handler_config.go` | GET /config, PUT /config |
| `handler_audit.go` | GET /audit, GET /audit/{id} |
| `handler_lists.go` | GET /lists, POST /lists/{id}/sync |
| `handler_billing.go` | GET /billing/products, POST /checkout, GET /usage |
| `handler_vessel.go` | POST /api/v1/vessel/screen |
| `handler_ubo_screen.go` | POST /api/v1/ubo/{id}/screen |
| `handler_country_risk.go` | GET /api/v1/country-risk/{code}, PUT override |
| `handler_health.go` | GET /health, GET /ready |
| `middleware_auth.go` | JWT + API key validation |
| `middleware_ratelimit.go` | Token bucket per API key |
| `middleware_tenant.go` | Extract tenant from request |
| `middleware_cors.go` | CORS headers |
| `router.go` | Route registration |
| `server.go` | HTTP server wrapper |
| `request.go` | Request parsing helpers |
| `response.go` | Response formatting helpers |

**When to edit**:
- New endpoint → create `handler_domain.go` + add route to `router.go`
- New middleware → create `middleware_feature.go` + add to server.go init

## web/ — React Frontend

| Directory | Purpose |
|-----------|---------|
| `web/src/pages/` | Full-page components (ScreeningPage, AlertsPage, etc) |
| `web/src/components/` | Reusable components (buttons, forms, charts) |
| `web/src/hooks/` | Custom hooks (useScreening, useAlerts, etc) |
| `web/src/api/` | API client wrappers |
| `web/src/types/` | TypeScript types (match domain types) |
| `web/src/styles/` | Global Tailwind setup + Apple HIG colors |
| `web/src/test/` | Test utilities, mocks |
| `web/public/` | Static assets |
| `web/vite.config.ts` | Vite bundler config |

### web/src/pages/

| File | Page | Route |
|------|------|-------|
| `ScreeningPage.tsx` | Screening dashboard | `/screening` |
| `AlertsPage.tsx` | Alert management | `/alerts` |
| `ConfigPage.tsx` | Screening config | `/config` |
| `BillingPage.tsx` | Subscription mgmt | `/billing` |
| `AnalyticsPage.tsx` | Metrics + charts | `/analytics` |
| `TeamPage.tsx` | Seat management | `/team` |

### web/src/components/

| Subdirectory | Components |
|--------------|-----------|
| `ui/` | Button, Input, Modal, Card, Badge, etc (Apple HIG) |
| `layout/` | Navbar, Sidebar, Layout wrapper |
| `screening/` | ScreeningForm, MatchResultCard |
| `alerts/` | AlertList, AlertDetail, ResolutionForm |
| `config/` | ConfigForm, WeightSliders, ThresholdSelector |
| `billing/` | SubscriptionCard, CheckoutForm, UsageChart |
| `charts/` | Dashboard charts (Recharts) |
| `data/` | Data tables with sorting/filtering |

**When to edit**:
- New page → create `web/src/pages/MyPage.tsx` + add route to App.tsx
- New component → create `web/src/components/category/MyComponent.tsx`
- Always responsive (test at 375px, 768px, 1024px)

## migrations/ — Database Schema

| File | Change |
|------|--------|
| `001_initial_schema.sql` | Create entities, screenings, alerts tables |
| `002_add_audit.sql` | Audit trail table with hash chain |
| `003_add_billing.sql` | Subscriptions, usage_records, invoices |
| `004_add_indexes.sql` | Performance indexes on common queries |
| `060_create_crypto_wallets.up.sql` | Blockchain address screening tables |
| `061_create_audit_events.up.sql` | Enhanced audit logging with compliance tracking |
| `062_country_risk.up.sql` | Country risk index table (240+ countries, scores, overrides) |
| `063_add_ubo_pep_tier.up.sql` | UBO classification, PEP tier mapping, risk multipliers |

**Naming**: `NNN_description.up.sql` / `NNN_description.down.sql` (N = 3-digit number)

**When to edit**: Schema changes → create new migration, never modify existing.

## Other Important Files

| File | Purpose |
|------|---------|
| `Makefile` | Common commands (docker-up, test, build) |
| `.cursorrules` | Cursor AI rules (file size, test pattern) |
| `.github/copilot-instructions.md` | GitHub Copilot instructions |
| `go.mod` | Go dependencies |
| `web/package.json` | npm dependencies |
| `web/vite.config.ts` | Frontend bundler config |

---

**Quick reference**: For any question "Where do I add/edit X?", find X in the table above.
