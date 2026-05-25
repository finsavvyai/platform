# AMLIQ v2 — Sprint Plan

## Quality Gates (Enforced Every Sprint)

**G1: Zero Mocks** — No mock data, no setTimeout fakes, no hardcoded responses. Every handler calls a real DB repo. Every React hook calls a real API endpoint. CI blocks merge if any file imports from /mocks/ or contains setTimeout for fake data.

**G2: Full Test Coverage** — Every Go file has a _test.go counterpart. Table-driven tests only. Every React component has .test.tsx. Minimum 80% line coverage. CI enforces.

**G3: Browser Test Flows** — Every feature ships with a Chrome Extension test flow doc in tests/chrome-flows/. Step-by-step persona walkthrough with expected results at each step.

**G4: 100-Line Limit** — Every file (Go, TS, TSX) must be <=100 lines including blanks and comments. CI lint fails if any file exceeds 100 lines. No exceptions.

**G5: Persona Stories** — Every task references a persona user story. Format: "As [Persona], I want [goal] so that [benefit]". PR template includes Persona field.

**G6: Multi-Tenant** — Every feature is tenant-scoped. All queries filter by tenant_id. All configs are per-org. No hardcoded list sources. No global state.

**G7: No Panics** — Zero panic() in production code. All errors returned, never swallowed. grep -r 'panic(' fails build (except _test.go).

**G8: Interface Limit** — Max 3 methods per interface. Prefer composition of small interfaces.

**G9: Real Integration** — Sprint exit requires a recorded browser walkthrough proving the feature works end-to-end.

**G10: API Contract** — Every new endpoint has OpenAPI spec entry before implementation. openapi.yaml updated in same PR as handler.

---

## Personas

| ID | Name | Role | Org Type | Country/Regulation |
|----|------|------|----------|-------------------|
| P01 | Sarah Cohen | Compliance Officer | Israeli Bank (Bank Leumi) | Israel — IMPA, Bank of Israel |
| P02 | Alex Petrov | Developer (API) | EU Fintech | EU — 5AMLD/6AMLD, EBA |
| P03 | Maria Santos | AML Analyst | Brazilian Remittance | Brazil — COAF, BACEN |
| P04 | David Kim | CTO | Korean Crypto Exchange | South Korea — FSC/FSS |
| P05 | Lisa Wang | Product Manager | US Money Transmitter | USA — FinCEN, BSA/AML, OFAC |
| P06 | Rachel Goldberg | Billing Admin | Multi-country PSP | Multi-jurisdiction |
| P07 | Yael Levi | Regulator (Auditor) | Israel IMPA Inspector | Israel — IMPA Directive 411 |
| P08 | James O'Brien | QA Engineer | UK Payment Institution | UK — FCA, OFSI |
| P09 | Michael Torres | Enterprise Admin | Global Bank (500+ users) | Global — FATF member |
| P10 | Emma Nakamura | New User (Onboarding) | Japanese Securities Firm | Japan — JFSA |

---

## Per-Organization Dynamic Config Model

Each organization independently configures all of the following. No hardcoded defaults. Everything stored in tenants table with JSONB config column.

```
org_id:                  UUID
org_name:                string
country:                 string (ISO 3166)
regulation_framework:    string[] ("IMPA", "5AMLD", "FATF", etc.)

enabled_lists[]:
  list_id:               string ("ofac_sdn", "un_consolidated", etc.)
  list_source_url:       URL (default source)
  custom_source_url:     URL (org-provided override, e.g. nbctf.mod.gov.il)
  parser_type:           enum (ofac | un | eu | uk | swiss | israeli | custom_csv)
  sync_schedule:         cron ("0 */6 * * *" = every 6h)
  sync_enabled:          bool
  last_synced_at:        timestamp
  entity_count:          int
  etag:                  string

default_match_threshold: float 0-100 (e.g. 85.0)
per_list_thresholds:     map[list_id]float (e.g. {ofac: 90, israeli_mod: 80})
match_weights:           map[layer]float (must sum to 100)
auto_dismiss_below:      float (e.g. 40.0)
auto_escalate_above:     float (e.g. 95.0)

screening_mode:          enum (realtime | batch | both)
batch_schedule:          cron
max_batch_size:          int

il_nbctf_url:            URL (Israeli National Bureau for Counter Terror Financing)
il_boi_reporting:        bool
il_impa_directive:       string
eu_high_risk_countries:  string[]
custom_pep_list_url:     URL

alert_email:             string
webhook_url:             URL
webhook_events:          string[] ("match_found", "list_updated", "batch_complete")
```

---

## Sprint 1: Foundation (Weeks 1-2)

### Epic: Database Layer

**S1-01** Set up pgx connection pool + migration runner
- Persona: As Sarah (P01), I need my screening data persisted so I can audit matches across days
- Deliverable: internal/storage/pool.go + pool_test.go
- Gates: G2 G4 G6 G7
- Browser Test: docker-compose up → psql connects → migrations run

**S1-02** EntityRepository (PG) — Create, GetByID, Search, Delete
- Persona: As Alex (P02), I need entities stored so my API queries return real sanctions data
- Deliverable: internal/storage/pg_entity.go + pg_entity_test.go
- Gates: G1 G2 G4 G6
- Browser Test: Query PG directly: SELECT * FROM entities WHERE tenant_id=X

**S1-03** ScreeningRepository (PG) — Store screening results + matches
- Persona: As Maria (P03), I need screening results saved so I can review them for COAF reporting
- Deliverable: internal/storage/pg_screening.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Run screen → check screening_results table has row

**S1-04** AlertRepository (PG) — CRUD + status transitions
- Persona: As Maria (P03), I need alerts persisted so I can track my resolution queue across sessions
- Deliverable: internal/storage/pg_alert.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Create alert → update status → verify in PG

**S1-05** AuditRepository (PG) — append-only audit log
- Persona: As Yael (P07), I need an immutable audit trail for IMPA inspection compliance
- Deliverable: internal/storage/pg_audit.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Perform actions → verify audit_entries table logs each

**S1-06** TenantRepository (PG) — CRUD + config storage
- Persona: As Michael (P09), I need tenant records so each subsidiary has its own config
- Deliverable: internal/storage/pg_tenant.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Create 2 tenants → verify isolation in PG

### Epic: Auth & Security

**S1-07** JWT middleware — validate token, extract tenant_id + role
- Persona: As Sarah (P01), I need secure login so only authorized compliance staff see screening data
- Deliverable: api/middleware_jwt.go + test
- Gates: G2 G4 G7
- Browser Test: Send request with/without token → verify 401/200

**S1-08** API Key middleware — validate key, extract tenant, log usage
- Persona: As Alex (P02), I need API key auth so my server-to-server integration is secure
- Deliverable: api/middleware_apikey.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Call with valid/invalid key → verify tenant extraction

**S1-09** Rate limiter — per-tenant token bucket, configurable limits
- Persona: As David (P04), I need rate limiting so one tenant can't overwhelm the system
- Deliverable: api/middleware_rate.go + test
- Gates: G2 G4 G6
- Browser Test: Send 100 rapid requests → verify 429 after limit

### Epic: Tenant Config

**S1-10** Tenant config domain model — lists, thresholds, schedules per org
- Persona: As Emma (P10), I need to configure which lists to screen against during onboarding
- Deliverable: internal/domain/tenant_config.go + test
- Gates: G2 G4 G5 G6
- Browser Test: Create config with 3 lists, different thresholds → validate

### S1 Quality Gate Exit

All PG repos have real queries (zero mocks). All tests pass with dockerized PG. Every file <=100 lines. Auth blocks unauthorized requests. Full walkthrough: start docker → run migrations → CRUD all entities → auth blocks invalid tokens.

---

## Sprint 2: Core Screening API (Weeks 3-4)

### Epic: Screen Endpoint

**S2-01** Wire Screen handler → Engine → PG (real end-to-end)
- Persona: As Sarah (P01), I want to screen a customer name and get real matches from OFAC + Israeli MOD lists
- Deliverable: api/handler_screen.go + test
- Gates: G1 G2 G4 G6
- Browser Test: POST /screen {name:'Mohammad Ali'} → get real matches from PG entities

**S2-02** Tenant-aware screening: use org's enabled lists + thresholds
- Persona: As Emma (P10), I configured 85% threshold and 3 lists — screening should respect my config
- Deliverable: api/handler_screen.go
- Gates: G1 G6
- Browser Test: Screen same name with 2 different tenant configs → different results

**S2-03** Per-list match threshold: each list has its own confidence cutoff
- Persona: As Sarah (P01), OFAC needs 90% match but Israeli MOD only needs 80% due to transliteration
- Deliverable: internal/screening/engine.go
- Gates: G1 G6
- Browser Test: Configure OFAC=90, MOD=80 → verify thresholds applied per-list

### Epic: Alerts

**S2-04** Wire Alerts handler → AlertRepo (list, get, resolve, dismiss)
- Persona: As Maria (P03), I need to see my alert queue and resolve matches with disposition notes
- Deliverable: api/handler_alerts.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Screen → alert created → GET /alerts → resolve → verify audit

**S2-05** Auto-escalate/auto-dismiss based on tenant thresholds
- Persona: As Sarah (P01), matches above 95% should auto-escalate to urgent; below 40% auto-dismiss
- Deliverable: internal/screening/post_process.go
- Gates: G1 G6
- Browser Test: Screen → verify auto-escalate at 96%, auto-dismiss at 35%

### Epic: Supporting Endpoints

**S2-06** Wire Lists handler → real entity counts + metadata from PG
- Persona: As Lisa (P05), I want to see which lists are loaded, how many entities, last sync time
- Deliverable: api/handler_lists.go + test
- Gates: G1 G2 G4
- Browser Test: GET /lists → verify real counts match PG

**S2-07** Wire Analytics → aggregate queries (screenings/day, alerts/status)
- Persona: As Lisa (P05), I need a dashboard showing screening volume and alert resolution rates
- Deliverable: api/handler_analytics.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Run 10 screenings → GET /analytics → verify counts match

**S2-08** Wire Audit handler → real audit log with filters
- Persona: As Yael (P07), I need to view all actions taken by compliance staff for IMPA inspection
- Deliverable: api/handler_audit.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Perform actions → GET /audit?action=resolve → verify entries

**S2-09** Tenant config CRUD: GET/PUT /config (lists, thresholds, schedules)
- Persona: As Emma (P10), I want to update my match thresholds and add a new list source
- Deliverable: api/handler_config.go + test
- Gates: G1 G2 G4 G6
- Browser Test: PUT /config → change threshold → screen → verify new threshold used

### S2 Quality Gate Exit

POST /screen returns real matches from PG. Alert lifecycle works. Analytics show real data. Config changes affect screening. Zero mock data anywhere. End-to-end: login → screen → get matches → create alert → resolve → view audit → check analytics.

---

## Sprint 3: List Sync Worker (Weeks 5-6)

### Epic: Worker Pipeline

**S3-01** Wire syncLists: fetcher → parser → delta → PG upsert (per-tenant)
- Persona: As Sarah (P01), lists must auto-update so I'm screening against latest OFAC data
- Deliverable: cmd/worker/sync.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Start worker → wait for sync → verify entities in PG match source

**S3-02** Per-org scheduling: each tenant's lists sync on their own cron
- Persona: As David (P04), my Korean exchange needs hourly OFAC sync but daily UN sync
- Deliverable: cmd/worker/scheduler.go + test
- Gates: G1 G6
- Browser Test: Set org1=6h, org2=24h → verify different sync times

**S3-03** Custom list source: org provides URL, we fetch + parse with specified parser
- Persona: As Sarah (P01), I need to add https://nbctf.mod.gov.il as a custom Israeli terror list source
- Deliverable: cmd/worker/custom_fetch.go + test
- Gates: G1 G6
- Browser Test: Add custom URL to org config → trigger sync → verify entities loaded

**S3-04** Israeli-specific fetcher: NBCTF terror list + Bank of Israel watchlist
- Persona: As Sarah (P01), I need the Israeli National Bureau for Counter Terror Financing list auto-fetched
- Deliverable: internal/ingestion/parser_israel.go + test
- Gates: G1 G2 G4
- Browser Test: Fetch from NBCTF URL → parse → verify Israeli entities in PG

**S3-05** Delta apply: upsert new, update changed, soft-delete removed entities
- Persona: As Alex (P02), when OFAC updates, I need only the changes applied, not a full re-import
- Deliverable: internal/ingestion/apply_delta.go + test
- Gates: G1 G2 G4
- Browser Test: Load list v1 → load list v2 → verify only delta applied

**S3-06** List metadata: last_synced, etag, entity_count, next_sync per list per org
- Persona: As Lisa (P05), I want to see when each list was last synced and when next sync happens
- Deliverable: internal/storage/pg_list_meta.go + test
- Gates: G1 G2 G4 G6
- Browser Test: GET /lists → verify sync timestamps and counts are real

**S3-07** Manual sync trigger: POST /lists/{id}/sync (per-tenant)
- Persona: As Sarah (P01), I need to force-sync a list immediately when I hear about new OFAC additions
- Deliverable: api/handler_lists.go
- Gates: G1 G6
- Browser Test: POST /lists/ofac/sync → verify sync runs → entities updated

### Epic: Entity Search

**S3-08** Full-text entity search: PG tsvector + trigram index
- Persona: As James (P08), I need to search entities by partial name to verify matching accuracy
- Deliverable: internal/storage/pg_entity_search.go + test
- Gates: G1 G2 G4
- Browser Test: GET /entities?q=moham → returns Mohammad variants

### Epic: Docker

**S3-09** Docker Compose: API + Worker + PG + Redis (full stack)
- Persona: As Alex (P02), I need one command to run the full stack locally for integration testing
- Deliverable: docker-compose.yml + Makefile
- Gates: G4
- Browser Test: make docker-up → all services healthy → screen works

### S3 Quality Gate Exit

Worker syncs real lists from real URLs into PG. Per-org schedules work. Israeli NBCTF list fetches. Custom URLs work. Delta updates work. Zero mocks. Full flow: configure org with 3 lists → worker syncs all 3 → screen against synced data → verify matches.

---

## Sprint 4: Frontend Integration (Weeks 7-8)

### Epic: API Client

**S4-01** Typed fetch client with JWT auth + error handling
- Persona: As Sarah (P01), the dashboard must authenticate me and show my data securely
- Deliverable: web/src/api/client.ts + test
- Gates: G1 G2 G4
- Browser Test: Open browser → fetch interceptor adds JWT → verify auth header

**S4-02** Real API hooks: useScreening, useAlerts, useLists, useAnalytics
- Persona: As Lisa (P05), all dashboard pages must show live data from the API, not fake data
- Deliverable: web/src/hooks/useScreening.ts + test
- Gates: G1 G2 G4
- Browser Test: Open each page → verify network tab shows real API calls

### Epic: Auth Flow

**S4-03** Login + signup pages with JWT token flow
- Persona: As Emma (P10), I need to create an account, login, and see my org's dashboard
- Deliverable: web/src/pages/Login.tsx + test
- Gates: G1 G2 G4 G5
- Browser Test: Register → login → verify JWT stored → dashboard loads

**S4-04** Auth context + protected routes + role-based visibility
- Persona: As Yael (P07), I should only see audit pages, not config or billing (auditor role)
- Deliverable: web/src/context/AuthContext.tsx + test
- Gates: G1 G2 G4 G6
- Browser Test: Login as auditor → verify only audit routes visible

### Epic: Live Pages (Kill All Mocks)

**S4-05** ScreenEntity: real API call → real results → real match cards
- Persona: As Sarah (P01), I enter 'Mohammad Ali' and get real matches with confidence scores from my configured lists
- Deliverable: web/src/pages/ScreenEntity.tsx (rewrite)
- Gates: G1 G4 G5
- Browser Test: Type name → submit → verify results match API response

**S4-06** Alerts page: real queue → resolve/dismiss → audit logged
- Persona: As Maria (P03), I see my real alert queue, click resolve, add notes, see it in audit
- Deliverable: web/src/pages/Alerts.tsx (rewrite)
- Gates: G1 G4 G5
- Browser Test: View alerts → resolve one → check audit page shows entry

**S4-07** Analytics + Lists pages connected to real API
- Persona: As Lisa (P05), the analytics dashboard shows my actual screening volume for this month
- Deliverable: web/src/pages/Analytics.tsx + Lists.tsx
- Gates: G1 G4
- Browser Test: Verify charts show real data matching API responses

**S4-08** Config page: edit lists, thresholds, schedules per org
- Persona: As Emma (P10), I can add/remove lists, set per-list thresholds, configure sync schedules
- Deliverable: web/src/pages/Config.tsx (rewrite)
- Gates: G1 G4 G5 G6
- Browser Test: Change threshold → screen → verify new threshold affects results

### Epic: Error UX

**S4-09** Error boundaries + loading skeletons + empty states + toasts
- Persona: As Emma (P10), I see a loading spinner while data loads and a clear error if something fails
- Deliverable: web/src/components/ErrorBoundary.tsx + Toast.tsx
- Gates: G2 G4
- Browser Test: Disconnect API → verify error boundary catches → reconnect → verify recovery

### S4 Quality Gate Exit

Every page calls real API. Delete all /mocks/ folder. Zero setTimeout fakes. Auth flow works. Config changes reflect immediately. Login → screen → get real results → resolve alert → check analytics → update config → screen again with new config.

---

## Sprint 5: Billing & Config (Weeks 9-10)

### Epic: LemonSqueezy Integration

**S5-01** CreateCheckout — real LS API call, return checkout URL
- Persona: As Emma (P10), I click 'Upgrade' and get redirected to a real payment page
- Deliverable: internal/billing/lemonsqueezy.go + test
- Gates: G1 G2 G4
- Browser Test: Click upgrade → verify redirect to LS checkout URL

**S5-02** GetSubscription + UpdateSubscription — real LS API calls
- Persona: As Rachel (P06), I need to see current subscription status and change plans
- Deliverable: internal/billing/lemonsqueezy.go
- Gates: G1 G2 G4
- Browser Test: GET /billing → shows real LS subscription data

**S5-03** Webhook handler: sub.created/updated/cancelled + HMAC verification
- Persona: As Rachel (P06), when I cancel in LemonSqueezy portal, my AMLIQ access updates automatically
- Deliverable: api/handler_webhook.go + test
- Gates: G1 G2 G4 G7
- Browser Test: Send test webhook → verify subscription status updated in PG

### Epic: Usage & Enforcement

**S5-04** SubscriptionRepository + UsageRepository (PG)
- Persona: As Rachel (P06), I need usage tracked per org per month for billing reconciliation
- Deliverable: internal/storage/pg_subscription.go + pg_usage.go
- Gates: G1 G2 G4 G6
- Browser Test: Screen 100 times → verify usage_records table has 100 entries

**S5-05** Usage enforcement: block screening when plan limit exceeded
- Persona: As David (P04), if I exceed my Starter plan's 1000 screens/month, I should get a 402 error
- Deliverable: internal/billing/enforcer.go (rewire)
- Gates: G1 G2 G6
- Browser Test: Screen until limit → verify 402 response → upgrade → verify unblocked

**S5-06** Tenant config: match weights validation (must sum to 100)
- Persona: As Sarah (P01), when I adjust match layer weights, the system validates they sum to 100%
- Deliverable: api/handler_config.go
- Gates: G1 G7
- Browser Test: PUT weights summing to 90 → verify 400 error

### Epic: Frontend

**S5-07** Billing page: real subscription, usage meter, upgrade/downgrade
- Persona: As Rachel (P06), I see my real usage (screens used/remaining) and can upgrade my plan
- Deliverable: web/src/pages/Billing.tsx (rewrite)
- Gates: G1 G4 G5
- Browser Test: View billing → verify usage matches API → click upgrade → checkout loads

**S5-08** Onboarding wizard: select country → suggested lists → set thresholds → first screen
- Persona: As Emma (P10), on first login I pick Japan, system suggests OFAC+UN+JFSA lists, I set 80% threshold, run first screen
- Deliverable: web/src/pages/Onboarding.tsx + test
- Gates: G1 G4 G5 G6
- Browser Test: New user → wizard → pick lists → set config → screen → verify it works

### S5 Quality Gate Exit

LS checkout creates real URL. Webhooks process real events. Usage tracked and enforced. Onboarding wizard works end-to-end. New user → onboarding → select lists → configure → screen → hit limit → upgrade → screen again.

---

## Sprint 6: Batch & Advanced Features (Weeks 11-12)

### Epic: Batch Screening

**S6-01** Batch endpoint: POST /batch (CSV/JSON upload, per-tenant lists)
- Persona: As Alex (P02), I upload 10K entities as CSV and get all screened against my configured lists
- Deliverable: api/handler_batch.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Upload CSV → verify batch job created → poll status

**S6-02** Background batch worker: process queue, per-tenant config
- Persona: As Alex (P02), my batch runs in background using my org's thresholds and list selection
- Deliverable: cmd/worker/batch.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Submit batch → worker processes → results downloadable

**S6-03** Batch status + results download (CSV/JSON)
- Persona: As Alex (P02), I poll batch status and download results when complete
- Deliverable: api/handler_batch.go
- Gates: G1 G4
- Browser Test: GET /batch/{id}/status → GET /batch/{id}/results → verify CSV

### Epic: Embedding Layer

**S6-04** pgvector: store + index entity name embeddings
- Persona: As James (P08), embedding matching catches transliterated names that fuzzy matching misses
- Deliverable: migrations/015_pgvector.sql + storage
- Gates: G1 G2 G4
- Browser Test: Insert vectors → query nearest → verify cosine similarity

**S6-05** Embedding generation: OpenAI API or local model for name vectors
- Persona: As James (P08), entity names get auto-embedded on ingestion for semantic matching
- Deliverable: internal/screening/embed_gen.go + test
- Gates: G1 G2 G4
- Browser Test: Ingest entity → verify vector generated → screen → embedding layer fires

**S6-06** Wire embedding matcher with real vectors
- Persona: As James (P08), the embedding layer now returns real semantic matches, not framework stubs
- Deliverable: internal/screening/embedding.go
- Gates: G1 G2
- Browser Test: Screen transliterated name → verify embedding match found

### Epic: Dataset & Health

**S6-07** Dataset export: GET /dataset/latest + /dataset/delta?since=
- Persona: As Alex (P02), I can download the full sanctions dataset or just changes since my last sync
- Deliverable: api/handler_dataset.go + test
- Gates: G1 G2 G4 G6
- Browser Test: GET /dataset/latest → verify JSON matches PG entities

**S6-08** Health endpoints: /health (liveness) + /ready (DB+Redis check)
- Persona: As Michael (P09), I need health checks for Kubernetes probes and monitoring
- Deliverable: api/handler_health.go + test
- Gates: G2 G4
- Browser Test: GET /health → 200. Stop PG → GET /ready → 503

### S6 Quality Gate Exit

Batch processes 10K entities in <5min. Embeddings generate and match. Dataset export works. Health endpoints respond correctly. Upload 10K CSV → batch completes → download results → verify matches use embeddings.

---

## Sprint 7: Admin Dashboard & RBAC (Weeks 13-14)

### Epic: Admin API

**S7-01** Admin: list tenants + usage summary + screening history
- Persona: As Michael (P09), I need to see all organizations, their usage, and screening activity
- Deliverable: api/handler_admin.go + test
- Gates: G1 G2 G4 G6
- Browser Test: GET /admin/tenants → verify all orgs listed with real usage data

**S7-02** Admin: create/suspend/delete tenant + override config
- Persona: As Michael (P09), I can create a new org, set their plan, override their match thresholds
- Deliverable: api/handler_admin.go
- Gates: G1 G6
- Browser Test: Create tenant → override config → verify tenant uses overridden config

### Epic: Admin Dashboard UI

**S7-03** Admin React page: tenant list + search + usage charts
- Persona: As Michael (P09), I have a dashboard showing all tenants, usage trends, system health
- Deliverable: web/src/pages/admin/Tenants.tsx + test
- Gates: G1 G2 G4 G5
- Browser Test: Open admin → see all tenants → search by name → view usage chart

**S7-04** Admin tenant detail: config editor + screening log + usage meter
- Persona: As Michael (P09), I click a tenant and see their full config, screening history, and usage
- Deliverable: web/src/pages/admin/TenantDetail.tsx + test
- Gates: G1 G4 G5
- Browser Test: Click tenant → see config → edit threshold → verify saved

### Epic: Team & RBAC

**S7-05** Seat management: invite/revoke users + role assignment per org
- Persona: As Michael (P09), I manage who has access to each org's dashboard and their role
- Deliverable: api/handler_team.go + web/src/pages/Team.tsx
- Gates: G1 G2 G4 G6
- Browser Test: Invite user → assign Analyst role → verify they see only analyst pages

**S7-06** Role-based access: Admin/Analyst/Auditor/Viewer permissions
- Persona: As Yael (P07), as Auditor I can view everything but can't resolve alerts or change config
- Deliverable: api/middleware_rbac.go + test
- Gates: G1 G2 G4
- Browser Test: Login as Auditor → try PUT /config → verify 403 forbidden

**S7-07** System health page: DB connections, worker status, sync status per list
- Persona: As Michael (P09), I see a real-time system health dashboard showing DB, worker, sync status
- Deliverable: web/src/pages/admin/SystemHealth.tsx + test
- Gates: G1 G4
- Browser Test: Open health page → verify DB green → stop worker → verify status updates

### S7 Quality Gate Exit

Admin can manage all tenants. RBAC enforced. Team invites work. System health shows real metrics. Zero mock data. Admin: create tenant → set config → invite users → assign roles → verify RBAC → check system health.

---

## Sprint 8: Polish & Launch (Weeks 15-16)

### Epic: iFrame Widget

**S8-01** Embeddable widget: widget.js + iframe screening component
- Persona: As David (P04), I embed a screening widget on my exchange's KYC page
- Deliverable: api/handler_iframe.go + static/widget.js
- Gates: G1 G4 G6
- Browser Test: Embed script on test page → verify widget renders → screen works

**S8-02** iFrame domain whitelist per tenant
- Persona: As David (P04), only my domains can embed the widget, not competitors
- Deliverable: api/middleware_iframe.go + test
- Gates: G1 G6
- Browser Test: Embed from allowed domain → works. Embed from other → blocked

### Epic: Invoicing

**S8-03** Invoice generation: monthly job + PDF + email delivery
- Persona: As Rachel (P06), I receive a monthly invoice PDF showing my usage and charges
- Deliverable: cmd/worker/invoices.go + internal/billing/invoice_pdf.go
- Gates: G1 G2 G4
- Browser Test: Trigger monthly job → verify PDF generated → verify email sent

### Epic: CI/CD

**S8-04** GitHub Actions: test + build + deploy (Go API + React frontend)
- Persona: As Alex (P02), every merge to main auto-deploys to production with zero downtime
- Deliverable: .github/workflows/ci.yml + deploy.yml
- Gates: G4
- Browser Test: Push to main → verify tests run → build succeeds → deploys

### Epic: Testing & Docs

**S8-05** Integration test suite: full API round-trips with dockerized PG
- Persona: As James (P08), integration tests cover every endpoint with real database queries
- Deliverable: tests/integration/ (all endpoints)
- Gates: G1 G2
- Browser Test: make test-integration → all pass → coverage >=80%

**S8-06** Load test: k6/vegeta, p95 <50ms for single screen, <5s for batch
- Persona: As David (P04), the system handles 1000 concurrent screens in <50ms p95
- Deliverable: tests/load/k6_screen.js
- Gates: G2
- Browser Test: Run k6 → verify p95 <50ms → no errors under 1000 RPS

**S8-07** OpenAPI spec + Swagger UI for all endpoints
- Persona: As Alex (P02), I need interactive API docs to build my integration
- Deliverable: docs/openapi.yaml + docs/swagger/
- Gates: G10
- Browser Test: Open /docs → verify all endpoints listed → try one → works

### S8 Quality Gate Exit

iFrame works on 3rd party sites. Invoices generate. CI/CD deploys automatically. Load test passes <50ms. API docs complete. ZERO MOCKS IN ENTIRE CODEBASE. Full production walkthrough: onboard → configure → sync lists → screen → resolve → batch → export → widget → billing.

---

## Sprint 9: Claude MCP Distribution (Weeks 17-18)

> Strategic context: `docs/PLAN_CLAUDE_MCP_DISTRIBUTION.md`. Triggered by
> Anthropic finserv briefing 2026-05-05. Goal: ship Aegis as published
> Claude MCP app + Cowork "Compliance Analyst" template so the product
> lives inside the analyst's M365/Outlook workflow rather than as a
> standalone dashboard.

### Epic: Public MCP Server

**S9-01** Public TLS hostname for MCP server
- Persona: As Alex (P02), I install Aegis MCP from one URL with one auth step
- Deliverable: deploy/mcp-edge.yaml (Cloudflare/render) + cmd/mcp-server/tls.go
- Gates: G1 G4 G6 G7
- Browser Test: `claude mcp add aegis https://mcp.amliq.io` → tools listed → screen_entity returns real result

**S9-02** OAuth2 token-based MCP auth, per-tenant scoping
- Persona: As Michael (P09), each subsidiary's MCP token only sees its own tenant data
- Deliverable: internal/mcp/auth.go + auth_test.go
- Gates: G1 G2 G4 G6 G7
- Browser Test: Two tokens for different tenants → tenant isolation verified in logs

**S9-03** Per-tool auth scopes (screen:read, pep:read, analyze:write)
- Persona: As Sarah (P01), my read-only MCP token can't trigger transaction analysis
- Deliverable: internal/mcp/scopes.go + test
- Gates: G2 G4 G6 G7
- Browser Test: Call analyze_transaction with screen:read token → 403 forbidden

**S9-04** MCP usage metering hook into LemonSqueezy enforcer
- Persona: As Rachel (P06), MCP calls count against the same plan as REST calls
- Deliverable: internal/billing/mcp_meter.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Free tier → 11th MCP screen → quota error returned via MCP envelope

**S9-05** Audit-log MCP resource (read-only stream per tenant)
- Persona: As Yael (P07), I can stream MCP audit events into my SIEM
- Deliverable: internal/mcp/resource_audit.go + test
- Gates: G1 G2 G4 G6
- Browser Test: Subscribe to resource → trigger 3 screens → 3 events received in order

**S9-06** server.json + manifest for MCP registries
- Persona: As Lisa (P05), Aegis is one search-and-install away in the Anthropic registry
- Deliverable: mcp/server.json + scripts/publish-mcp.sh (uses ll-mcp-publish)
- Gates: G10 G11
- Browser Test: Run script → entry visible on registry.modelcontextprotocol.io + Smithery + Glama

### Epic: Differentiation Tools

**S9-07** explain_match MCP tool — per-layer cascade with rationale
- Persona: As Yael (P07), I defend any match in audit by showing layer-by-layer evidence
- Deliverable: internal/mcp/tool_explain_match.go + test
- Gates: G1 G2 G4 G6 G10 G11
- Browser Test: Screen entity → take match_id → call explain_match → 6-layer breakdown with scores + matched substrings + NL rationale

**S9-08** monitor_entity MCP tool — register + webhook on list change
- Persona: As Maria (P03), I subscribe an entity once and get notified when their PEP tier changes
- Deliverable: internal/mcp/tool_monitor.go + internal/monitoring/registrar.go + test
- Gates: G1 G2 G4 G6 G10 G11
- Browser Test: Register entity → simulate list update → webhook fires with valid HMAC-SHA256 signature

### Epic: Cowork Compliance Template

**S9-09** Cowork agent template (Compliance Analyst)
- Persona: As Sarah (P01), I deploy the template and triage counterparties from Outlook on day 1
- Deliverable: cowork/compliance-analyst.yaml + docs/COWORK_TEMPLATE.md
- Gates: G10 G11
- Browser Test: Deploy in Cowork sandbox → forward email → Aegis screen_entity invoked → memo drafted in Word

**S9-10** Recorded end-to-end demo (email → screen → memo → monitor)
- Persona: As Lisa (P05), I have a 3-min demo that proves the M365 story to my CCO
- Deliverable: docs/demo/cowork-compliance.mp4 + transcript.md
- Gates: G9 G11
- Browser Test: Run demo with `luna-agents:ll-flow-record` → all 4 steps complete → upload artifacts

### S9 Quality Gate Exit

Public MCP server live with OAuth + per-tool scopes + tenant isolation + usage metering. `explain_match` and `monitor_entity` tools shipped and listed on Anthropic Official MCP Registry, Smithery, Glama. Cowork "Compliance Analyst" template runs end-to-end in Cowork sandbox with recorded demo. New gate **G11 MCP contract** active: every MCP tool has a recorded Claude-client transcript checked into `tests/mcp-transcripts/`.

---

## Timeline Summary

| Sprint | Weeks | Focus | Tasks | Key Milestone |
|--------|-------|-------|-------|---------------|
| S1 | 1-2 | Foundation | 10 | Real PG repos + auth middleware |
| S2 | 3-4 | Core API | 9 | Screening API returns real matches |
| S3 | 5-6 | List Sync | 9 | Worker syncs real lists per-org schedule |
| S4 | 7-8 | Frontend | 9 | All mocks deleted, real API everywhere |
| S5 | 9-10 | Billing | 8 | LemonSqueezy live, onboarding wizard |
| S6 | 11-12 | Advanced | 8 | Batch screening, embeddings, dataset |
| S7 | 13-14 | Admin | 7 | Admin dashboard, RBAC, team mgmt |
| S8 | 15-16 | Launch | 7 | iFrame, CI/CD, load tests, API docs |
| S9 | 17-18 | MCP Distribution | 10 | Public MCP server + 2 differentiation tools + Cowork template |

Total: ~100 developer-days across 18 weeks.

---

## Quality Gates (additions)

**G11 MCP contract** (added Sprint 9) — Every MCP tool ships with a recorded Claude-client transcript checked into `tests/mcp-transcripts/`. CI fails if a tool is registered in `mcp/server.json` without a corresponding transcript file.
