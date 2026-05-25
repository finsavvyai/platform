> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 7: TokenForge — Landing Page, Dashboard & Billing (2 weeks)

## Goal
TokenForge has its own website, developer dashboard, usage tracking,
and SaaS billing. A developer can sign up, get an API key, integrate
in 10 minutes, and see live session data.

## Dependencies
- Sprint 6 complete (standalone package, all adapters)

## Tasks

### 7.1 TokenForge Landing Page
- [x] Create `apps/tokenforge-web/` — new Next.js app in monorepo:
  - Domain: `tokenforge.dev`
  - Deployed to Cloudflare Workers via OpenNext
- [x] Landing page sections (10 sections, each in own component):
  - HeroSection: "Your auth stops at login. We protect everything after."
  - ProblemSection: 3 threat cards (AiTM, XSS, session hijacking)
  - HowItWorksSection: 3-step visual (Bind → Sign → Verify)
  - TrustScoreSection: 7 signals with animated bars
  - CodeExampleSection: client + server code blocks side by side
  - FrameworksSection: Hono, Express, Next.js, Fastify + storage adapters
  - ComparisonSection: vs Google DBSC, session cookies, device fingerprinting
  - PricingSection: Free / Pro / Team / Enterprise cards
  - FaqSection: 6 accordion items
  - FooterSection: links + "Built by OpenSyber"
- [x] Apple HIG design: dark theme, SF-style spacing, Framer Motion animations
- [x] Write tests for landing page components (19 tests)

### 7.2 Developer Dashboard
- [x] Create dashboard pages in `apps/tokenforge-web/`:
  - `/dashboard` — overview: 4 stat cards, usage chart, recent sessions
  - `/dashboard/sessions` — sortable table, revoke, pagination
  - `/dashboard/events` — filterable event feed with severity colors
  - `/dashboard/settings` — API key management + webhook config
  - `/dashboard/docs` — inline quick start guide with code blocks
- [x] Dashboard components:
  - `SessionsTable.tsx` — sortable, trust score colors, revoke with confirmation
  - `EventsFeed.tsx` — severity-colored cards, expandable details, filters
  - `UsageChart.tsx` — pure CSS bar chart (no recharts dependency)
  - `ApiKeyManager.tsx` — generate, copy-to-clipboard, revoke
  - `WebhookConfig.tsx` — URL input, event checkboxes
  - `CodeBlock.tsx` — syntax-highlighted code with copy button
  - `RecentSessionsList.tsx` — compact session list for overview
  - `DashboardUserSection.tsx` — user info + plan display
- [x] Write tests for all dashboard components (34 tests)

### 7.3 TokenForge API (Multi-Tenant)
- [x] Create `apps/tokenforge-api/` — new Cloudflare Worker (Hono):
  - Shared D1 database with tenant scoping in application code
  - Auth: API key (`tf_xxx`) → SHA-256 hash lookup in `tf_api_keys`
- [x] Endpoints:
  - `POST /v1/bind` — device binding with Zod validation
  - `POST /v1/verify` — server-side signature verification + trust score
  - `GET /v1/sessions` — list sessions (cursor pagination)
  - `GET /v1/sessions/:id` — get single session
  - `DELETE /v1/sessions/:id` — revoke session
  - `GET /v1/events` — security events (filters: eventType, userId)
  - `GET /v1/usage` — current billing period stats
  - `GET /v1/usage/daily` — 30-day daily breakdown
  - `GET /v1/tenant` — tenant info, plan, subscription
  - `POST /v1/tenant/api-keys` — generate API key (raw shown once)
  - `GET /v1/tenant/api-keys` — list keys (prefix only)
  - `DELETE /v1/tenant/api-keys/:id` — revoke API key
  - `GET /health` — health check (no auth)
- [x] Multi-tenant DB schema (migration 0007):
  - `tf_tenants` — id, name, slug, plan, subscription IDs
  - `tf_api_keys` — tenantId, keyHash, keyPrefix, active/expired
  - `tf_usage` — tenantId, date, verification/bind/stepUp counts
  - Added `tenantId` to existing device_sessions, tf_security_events, step_up_challenges
- [x] Middleware: tenant auth + usage limit (110% hard cap, X-Usage-Remaining header)
- [x] Write tests for all API endpoints (102 tests)

### 7.4 Usage Tracking & Billing
- [x] Track per-tenant usage (upsert pattern per day)
- [x] Plan limits enforcement:
  - Free: 1,000 verifications/month
  - Pro: 50,000 / Team: 250,000 / Enterprise: unlimited
- [x] LemonSqueezy integration:
  - Webhook handler with HMAC-SHA256 signature verification
  - Handles: subscription_created, updated, cancelled, payment_success, payment_failed
  - Variant ID → plan mapping
- [x] Overage handling:
  - Email warning at 80% via Resend API (with KV dedup)
  - Hard limit: 429 at 110% usage
- [x] Hourly usage cron for monitoring and warnings
- [x] Write tests for billing and usage (51 tests across webhook, handler, cron, utils)

### 7.5 npm Publishing Pipeline
- [x] Set up npm publish workflow (package.json configured with files, exports, prepublishOnly)
- [ ] Create changeset config (deferred — requires npm account)
- [x] Write README.md for npm package
- [x] Add JSDoc comments to all public exports
- [x] Verify `npm pack` produces clean package

### 7.6 Integration Examples
- [x] Create `examples/` directory with 4 framework examples
- [x] Each example: working app + README (Express, Hono, Next.js, Fastify)

### 7.7 Wire TokenForge into OpenSyber
- [x] Add `tokenForgeMiddleware` to OpenSyber API (`apps/api/src/index.ts`):
  - Applied after CORS, before rate limiting
  - Skips: `/health`, `/webhooks/*`, `/api/agent/*`, `/api/tf/*`, `/api/badges/*`
  - Trust thresholds: allow=50, stepUp=30
  - Sensitive ops: DELETE instances, POST secrets
- [x] Add `X-TF-*` headers to CORS allowHeaders
- [x] Add `TrustScoreIndicator` to dashboard sidebar
- [x] Write tests: CORS header test, degraded mode test (2 new API tests)

## TokenForge Pricing
| Plan | Price | Verifications/mo | Sessions | Support |
|---|---|---|---|---|
| Free | $0 | 1,000 | 100 | Community |
| Pro | $49/mo | 50,000 | 5,000 | Email |
| Team | $199/mo | 250,000 | 25,000 | Priority |
| Enterprise | Custom | Unlimited | Unlimited | Dedicated |

## Definition of Done
- [x] tokenforge.dev landing page built (10 sections, Framer Motion, dark theme)
- [x] Developer dashboard: overview, sessions, events, settings, docs
- [x] Multi-tenant API with 13 endpoints
- [x] Billing via LemonSqueezy webhooks + usage limits
- [x] TokenForge wired into OpenSyber API and Web
- [x] All new code has tests (>80% coverage)
- [ ] npm packages published (requires npm account setup)
- [x] Integration examples (Express, Hono, Next.js, Fastify)

## Test Results (Final)
| Package | Test Files | Tests |
|---|---|---|
| tokenforge (SDK) | 10 | 118 |
| agent | 11 | 134 |
| api | 29 | 441 |
| tokenforge-api | 19 | 102 |
| tokenforge-web | 7 | 53 |
| web | 27 | 223 |
| **Total** | **103** | **1,071** |

## Estimated Effort
| Task | Days | Status |
|---|---|---|
| 7.1 Landing page | 2 | Done |
| 7.2 Developer dashboard | 2 | Done |
| 7.3 Multi-tenant API | 2 | Done |
| 7.4 Usage tracking + billing | 1 | Done |
| 7.5 npm publishing | 1 | Done (publish deferred) |
| 7.6 Integration examples | 1 | Done |
| 7.7 Wire into OpenSyber | 1 | Done |
| **Total** | **10 days** | **7/7 Complete** |
