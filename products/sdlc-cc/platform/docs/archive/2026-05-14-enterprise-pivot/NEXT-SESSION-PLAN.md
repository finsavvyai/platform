# Next Session Plan — INTEGRATION-DEBT closeout

> **REPO STATUS (2026-05-14, re-audit):** Active. The 2026-05-13
> "PAUSED, ported to aegis" banner was aspirational — `aegis/` has
> no `cmd/sdlc-api` binary, so the bucket work below remains
> runnable here against `services/gateway/`. The 2026-05-14
> re-audit closed buckets A–E and ~half of F (see
> [INTEGRATION-DEBT.md](INTEGRATION-DEBT.md)); buckets still open
> are Day 24 (SSO ACS), Day 31 (LS lifecycle), and the per-vendor
> OAuth app registrations (Days 40-47).

Created: 2026-04-30 (after integration-debt sweep #1).

## Related docs

- **`docs/CLAUDE-TEAM-DROP-IN-GAPS.md`** — separate spike for
  productizing SDLC as a Claude Team PII gateway. P0 there is
  Anthropic-compatible `/v1/messages` + SSE streaming + per-tenant
  BYOK. That work is *not* in this plan; it's a 3–4 week
  productization milestone after the integration debt closes.

## Where we are

Phase 1: **10 ✅ / 0 🟡 / 5 🔴**
Phase 2: **11 ✅ / 7 🟡 / 13 🔴**

Most code-level wiring is now done. The remaining 🟡 / 🔴 items split
into six buckets:

- **A. Pure code work** — can ship in one session.
- **B. Migrations into staging/CI** — code is ready, needs Ops to run.
- **C. External-creds blockers** — needs a vendor account, IdP config,
  LemonSqueezy product id, real domain, or Docker-in-CI.
- **D. Day 31 LemonSqueezy port** — port from OpenSyber + TenantIQ
  patterns into the gateway. Same shared LS store across portfolio.
- **E. ClawPipe / claw-gateway wiring** — sibling cost-optimization
  gateway from the OpenClaw family. Code-only; one env var to enable.
- **F. OpenSyber portfolio integrations** — additive reuse from the
  sibling project (TokenForge sessions, PipeWarden ingestion,
  register-project.sh, claw-sdk).

---

## Bucket A — pure code work (do these first)

These are all 🟡 items where the primitive exists but the request
path doesn't call it, or where we left a follow-up TODO this session.

### A1. Day 24 — SAML ACS route + per-tenant SP keypair (4–6 hours)

**Goal**: complete the SAML round-trip so `GET /sso/{tenant}/login`
redirects to the IdP and `POST /sso/{tenant}/acs` mints a session.

Steps:
1. Build `sso.PerTenantProvider` factory: takes `*PgxLoader` + the
   tenant id, calls `LoadSPKeypair(row.SPKeyPEM, row.SPCertPEM)`,
   constructs a `SAMLProvider` per request.
2. Add `routes.go` mounts:
   - `GET /sso/{tenant_id}/login` → `provider.MakeAuthRequest`,
     302 to IdP.
   - `POST /sso/{tenant_id}/acs` → `provider.ValidateResponse`,
     mint a JWT via existing `services.JWTService`, set cookie or
     return token in response.
3. Wire SSORedirector's `SSOURLFunc` (currently a stub returning "")
   to call `/sso/{tenant_id}/login`.
4. Test: integration test using `crewjam/saml`'s test IdP fixtures.

Files:
- `services/gateway/internal/infrastructure/sso/per_tenant.go` (new)
- `services/gateway/internal/interfaces/http/handlers/sso_acs.go` (new)
- `services/gateway/internal/interfaces/http/routes/routes.go` (edit)
- `services/gateway/internal/interfaces/http/handlers/sso_redirect.go` (edit)

### A2. Day 12 — AppendCritical at remaining mutation sites (1–2 hours)

**Goal**: every admin mutation lands in `audit_logs` synchronously.
Currently only `rate_limit:update` flows through `AppendCritical`.

Sites to wire:
- API key rotate / revoke (`/v1/api-keys/{id}/{rotate,revoke}`)
- Policy create / update / delete (`/v1/policies`)
- Tenant CMEK rotation (`/admin/tenants/{id}/cmek/rotate`)
- SCIM user/group create/update/delete (`/scim/v2/Users`)
- Domain register / verify / delete (`/api/v1/domains`)

Each gets a 5-line block: build `audit.Row`, call `AppendCritical`.
Failure should fail the request (admin mutating actions must not
silently drop their audit row).

### A3. Day 53 — projects RBAC gates + admin-ui page (3 hours)

**Goal**: gate `/v1/projects` mutations behind `projects:{read,write,delete}`
permissions and ship a basic admin-ui page.

Steps:
1. Wrap routes in `MountProjects` with `RequirePermission`:
   - `GET /v1/projects` — `projects:read`
   - `POST /v1/projects` — `projects:write`
   - `PUT /v1/projects/{id}` — `projects:write`
   - `DELETE /v1/projects/{id}` — `projects:delete`
   - `POST /v1/projects/{id}/members` — `projects:write`
2. Add migration 027 that seeds the three permissions onto the
   default `admin` and `member` roles.
3. Build `services/admin-ui/app/projects/page.tsx` with list + create
   modal (Radix Dialog + TanStack Query mutation against `/v1/projects`).

### A4. Day 54 — session_recordings capture hook (2–3 hours)

**Goal**: every `/v1/chat` and (later) RAG-query response writes a
recording row when the tenant has `recording_enabled=true`.

Steps:
1. `infrastructure/record/PgxStore` writes to the `session_recordings`
   table from migration 017.
2. Hook into `app/handlers/llm/chat.go::Chat` after `Tracker.Record`:
   when tenant config opts in, write recording with prompt + redacted
   response + token counts.
3. Add `GET /admin/recordings/{id}` for playback (admin RBAC only).
4. Test: integration test asserts a chat call writes one row when
   enabled, zero when disabled.

### A5. Day 14 — full BullMQ v5 migration (2–3 hours, optional)

Currently we map the env policy onto Bull v3. Migrating to BullMQ
unlocks the per-attempt custom backoff (30s/2m/10m/1h/4h) the policy
exposes. This is opt-in — Bull v3 works for now.

If we go: replace `import Bull from 'bull'` with
`import { Queue, Worker } from 'bullmq'`, swap `.process()` calls for
`new Worker()`, plug `processingQueueOptions(policyFromEnv())` and
`processingWorkerOptions(policyFromEnv())` directly. Existing tests
under `services/document-processor/tests/queue/` already validate the
v5 shape.

---

## Bucket B — migrations into staging/CI (Ops, 30 min total)

The migration files live in `database/migrations/` and the gate is
already wired in `.github/workflows/migrations.yml`. What's needed:

1. **Apply 009 / 010 / 012 / 015 / 024 / 025 / 026 to staging Postgres.**
   - 009: audit_log immutable trigger (Day 12)
   - 010: rbac (Day 21)
   - 012: spend_limits + spend_events (Day 28-29)
   - 015: tenant_dlp_policy (Day 34)
   - 024: scim_users + scim_groups (Day 23, this session)
   - 025: tenant_domains (Day 25, this session)
   - 026: tenant_saml_config (Day 24, this session)

2. **Verify CI runs `migrations.yml` against the in-cluster DB on
   every PR.** Currently the workflow exists but we haven't confirmed
   it gates merges.

3. **Seed model_pricing for the configured Anthropic + OpenAI models.**
   Without rows in this table, `spend.Tracker.Record` no-ops.

---

## Bucket C — external-creds blockers (defer with explicit owners)

These cannot ship without an external action. Drop into the team
backlog with the listed asks.

| Day | Item | Blocker | Owner |
| --- | --- | --- | --- |
| 8 | E2E test against docker-compose stack | Docker daemon in CI runner | Ops |
| 16 | DR `restore.sh` against real Postgres | Spin up a sacrificial RDS | Ops |
| 17 | DR runbooks (redis/s3/secrets) | One drill per backend | Ops |
| 19 | k6 load tests | Staging URL + auth token | Ops |
| 31 | LemonSqueezy invoicing — see Bucket D below | LS store id + API key + variant ids | Finance + Eng |
| 37 | TLS hardening | Cipher policy + TLS 1.3 enforcement at the LB | Ops |
| 40-47 | Connector OAuth round-trip | Real OAuth apps registered with each vendor | Eng + Vendor |
| 51 | Codex code-action agent | Not started — needs scoping | Eng |

---

## Bucket D — Day 31 LemonSqueezy port (4–6 hours, code only)

**Decision update (2026-04-30)**: sdlc-platform now runs a **dual
billing stack**. The remote already shipped a Stripe-based invoicing
path at `internal/infrastructure/billing/` (commit 41cd43d):
`invoice.go`, `discount.go`, `cron.go` (MonthlyCron firing in the
first 3 days of each month), `pdf_generator.go`, `stripe_uploader.go`,
95.3% line coverage. That stack handles **Pilot ($15-25K trial)** and
**Enterprise (custom contracts)** — high-touch invoicing where
LemonSqueezy is a poor fit.

Bucket D ships LemonSqueezy alongside it for **self-serve
subscriptions** (Startup $99, Business $499 from
`landing-page/components/Pricing.tsx`). The two stacks share the
`tenant_billing` row but write through different driver modules.

Both **OpenSyber** and **TenantIQ** ship working LemonSqueezy
implementations we can port; gateway is Go/Chi/Postgres so we port
the *pattern* from their TypeScript reference impls.

### Reference impls to port

| Project | File | What to lift |
| --- | --- | --- |
| OpenSyber | `apps/api/src/routes/webhooks-lemonsqueezy.ts` (130 LOC) | webhook orchestration, store_id check, idempotency cache, event dispatch |
| OpenSyber | `apps/api/src/routes/handlers/lemonsqueezy-handlers.ts` (133 LOC) | per-event handlers (created/updated/cancelled/expired/payment_failed), grace period, plan sync |
| TenantIQ | `apps/api/src/lib/lemonsqueezy.ts` (139 LOC) | `verifyWebhookSignature` constant-time HMAC, `createCheckout` REST call, `tierFromVariantId` map |
| TenantIQ | `apps/api/src/lib/billing-webhook-handlers.ts` (152 LOC) | cleaner event handler split |
| TenantIQ | `apps/api/src/api/billing/checkout.ts` (146 LOC) | POST /billing/checkout shape |

### Steps for sdlc-platform

1. **Migration 027 — billing tables**:
   - `tenant_billing` (tenant_id PK, ls_customer_id, ls_subscription_id,
     stripe_customer_id, stripe_subscription_id, plan,
     billing_source enum {`lemonsqueezy`, `stripe_invoice`},
     status, payment_grace_until, updated_at)
   - `billing_events` (id, tenant_id, source, event_name, event_id,
     raw_body, received_at — append-only audit trail; `source` lets
     us replay LS-only or Stripe-only events independently)
   - The Stripe invoicing path already runs MonthlyCron via
     `infrastructure/billing/cron.go`; this migration lifts the
     (currently in-memory) state into Postgres so both stacks share
     one tenant view.

2. **`internal/infrastructure/billing/lemonsqueezy/` package** (≤200 LOC per file):
   - `client.go` — `Client.CreateCheckout(orgID, email, tier, cycle)`,
     `Client.GetSubscription(id)`, `Client.CancelSubscription(id)`.
     Uses `Bearer` auth + `application/vnd.api+json`.
   - `signature.go` — `VerifySignature(payload, signature, secret) bool`
     using `crypto/hmac` + `subtle.ConstantTimeCompare`.
   - `webhook.go` — handler that:
     - reads X-Signature header
     - verifies via `signature.go`
     - hashes the raw body (sha256) and stores in Redis
       `ls:webhook:seen:<hex>` with 7-day TTL for idempotency
     - validates `meta.store_id` and `data.attributes.product_id`
     - dispatches by `meta.event_name`
   - `handlers.go` — one func per LS event type. Each writes to
     `tenant_billing` + `billing_events`.

3. **`internal/app/handlers/billing/`**:
   - `POST /v1/billing/checkout` — RBAC `billing:write`. Body:
     `{tier: "team"|"business", cycle: "monthly"|"annual"}`. Returns
     LS hosted-checkout URL.
   - `POST /v1/billing/portal` — RBAC `billing:write`. Returns LS
     customer-portal URL for the tenant's `ls_customer_id`.
   - `POST /webhooks/lemonsqueezy` — public (signature-gated).
   - `GET /v1/billing` — RBAC `billing:read`. Returns current plan,
     status, renewal date, grace period if any.

4. **Plan enforcement hook** in chain.go: when a tenant's
   `tenant_billing.plan = 'free'` and `payment_grace_until` is past,
   /v1/chat 402 with the existing spend-cap shape so the UX matches
   what we already serve. Re-uses the same RFC-7807 envelope.

5. **Env config** (mirroring TenantIQ's `LSConfig`):
   ```
   LEMONSQUEEZY_API_KEY=...                     # shared portfolio key
   LEMONSQUEEZY_STORE_ID=...                    # SAME as OpenSyber + TenantIQ
   LEMONSQUEEZY_WEBHOOK_SECRET=...              # shared signing secret
   SDLC_LS_PRODUCT_ID=...                       # ★ this product only
   LEMONSQUEEZY_VARIANT_TEAM=...
   LEMONSQUEEZY_VARIANT_BUSINESS=...
   LEMONSQUEEZY_VARIANT_TEAM_ANNUAL=...
   LEMONSQUEEZY_VARIANT_BUSINESS_ANNUAL=...
   ```
   Pilot tier ships via manual invoice (no LS variant). Enterprise
   stays sales-led (no LS variant).

### Shared-store implications

LemonSqueezy webhooks are **store-level** — every webhook URL
configured on the store receives every event for every product.
Since sdlc-platform shares the store with OpenSyber + TenantIQ,
the webhook handler MUST filter by product_id or it will trample
sibling-product subscriptions.

Implementation contract (mandatory):

1. **Verify signature first** (otherwise an attacker forges a
   product_id we own).
2. **Verify `meta.store_id`** matches `LEMONSQUEEZY_STORE_ID` (this
   is now a sanity check, not isolation — same store across all
   three products).
3. **Filter on `data.attributes.product_id`** — if it doesn't
   equal `SDLC_LS_PRODUCT_ID`, return `{received: true, ignored: true}`
   with HTTP 200. Do NOT 401/403 — the event legitimately belongs
   to the store, just to a different product. OpenSyber already
   does this exact filter; copy the pattern verbatim.
4. **Idempotency cache key includes product**:
   `ls:webhook:seen:sdlc:<sha256-of-body>` so OpenSyber's webhook
   firing on the same event doesn't poison our cache (and vice
   versa — each product gets its own keyspace prefix).
5. **`custom_data.product`** in the checkout creation: stamp
   `"sdlc"` so support-side incident triage can tell at a glance
   which product an LS event belongs to.

### Cross-portfolio coordination

When this lands, three projects share one webhook secret. To rotate
safely:
- Coordinate rotation with OpenSyber + TenantIQ in one window.
- Update `LEMONSQUEEZY_WEBHOOK_SECRET` in all three environments
  before flipping it in the LS dashboard.
- Add a runbook entry under `docs/runbooks/lemonsqueezy-rotation.md`.

API key rotation is independent — each product can rotate its own
read-only API call usage if needed (only the webhook secret is
shared).

6. **Tests**:
   - Signature verify: golden vector + tampered body returns false
   - Webhook idempotency: same hash twice returns 200 + duplicate flag
   - Foreign store_id rejected with 401 (sanity)
   - Foreign product_id (e.g. OpenSyber's product) returns 200
     `{ignored: true}` and writes nothing to `tenant_billing`
   - Each event handler asserts the resulting `tenant_billing` row
   - Checkout call mocks the LS REST endpoint with httptest

### What we don't need to port

- OpenSyber's `referredBy` referral credits — out of scope for B2B SDLC
- OpenSyber's instance-suspension logic — sdlc-platform suspends via
  the existing spend.Check 402 path, not by deleting resources
- TenantIQ's per-tier `instance_limit` — sdlc-platform uses
  spend caps + DLP policy instead

### Deliverable shape after Bucket D

A real customer can hit `/v1/billing/checkout?tier=team`, complete
LS checkout, the webhook updates `tenant_billing`, the gateway
gates `/v1/chat` against their plan + grace period, and the admin
UI Billing page (port of OpenSyber `apps/web/src/app/admin/billing/page.tsx`)
shows the current state.

For 40-47 specifically: the registry registers 6 connectors, but
`/admin/connectors` returns metadata only. To complete:
- Create OAuth app in each vendor console (Google Workspace,
  Slack, GitHub, Zendesk, ServiceNow, HubSpot)
- Drop client_id/secret into env vars (`GOOGLE_CLIENT_ID`, etc.)
- Verify `mountConnectorOAuth`'s `AuthorizeURL` produces a working
  consent screen for each vendor.
- Existing scheduled routine `trig_0191DCVP65ZzJyXdKGoFCjyS` fires
  2026-05-13 to verify this — keep that scheduled run.

---

## Bucket E — ClawPipe / claw-gateway wiring (1.5 hours, code only)

**Decision context**: ClawPipe is the OpenClaw family's cost-
optimization gateway (21 LLM providers, semantic cache, 246
deterministic Booster rules, swarm orchestration, 15-plugin Guard
Registry, M365 intent classifier). Its README explicitly positions:
*"ClawPipe (cost) · sdlc.cc (compliance) · OpenSyber (security
agents) · TenantIQ (M365 for MSPs) — one signup"*. They're designed
to compose; this bucket lands the composition.

**Additional finding** from inspecting OpenSyber: a sibling Cloudflare
Worker called **claw-gateway** at `apps/claw-gateway/` is already
running as the *"shared LLM proxy for 43 portfolio projects"*. Its
`POST /v1/prompt` shape matches ClawPipe exactly (same body schema,
same `{prompt, provider, model, system?, maxTokens?, stream?, tools?}`).

**One adapter, two backends.** The Bucket E adapter takes a
configurable base URL; pointing at `api.clawpipe.ai` or
`<...>.workers.dev/claw-gateway` is a deploy-time choice. Document
both env-var values; let operators pick whichever is closer to their
data plane.

### Pattern — ClawPipe as a Provider behind SDLC

Customer → SDLC gateway → DLP/audit/RBAC → **ClawPipe** → 21
provider routing → ClawPipe → SDLC outbound DLP → customer.

ClawPipe sees redacted prompts only (compliance-safe). Customer
gets cost optimization + cache hits + smart routing without
re-engineering. SDLC stays the policy boundary; ClawPipe stays the
cost boundary.

Rejected: SDLC behind ClawPipe (wrong direction; ClawPipe is a
dispatcher), or parallel (needless complexity).

### Reference

- Sibling repo: `/Users/shaharsolomon/dev/projects/portfolio/clawpipe`
- API doc: `clawpipe/gateway/openapi.yaml`
- Endpoint: `POST /v1/prompt` with `Authorization: Bearer <key>`
  + `X-Project-Id: <project>`
- Request shape: `{prompt, provider, model, system?, maxTokens, temperature}`
  (single prompt string, system separate)
- Response shape: `{text, tokensIn, tokensOut, latencyMs}` plus
  optional cost meta `{boosted, cached, route, estimatedCostUsd}`

### Steps

1. **Adapter** at `services/gateway/internal/infrastructure/llm/clawpipe.go`
   implementing the existing `infllm.Provider` interface:
   - `NewClawPipe(apiKey, projectID, baseURL)` constructor.
   - `Generate(ctx, GenerateRequest)`: marshal our `Message[]` into
     ClawPipe's single-prompt+system shape, POST to `/v1/prompt`,
     unmarshal `text/tokensIn/tokensOut/latencyMs`.
   - Stream variant proxies `/v1/stream` SSE through unchanged
     (compatible with our planned A2 inline-DLP SSE work).

2. **Env sweep** in `cmd/server/llm_wiring.go::initLLMSuite`:
   ```go
   if key := os.Getenv("CLAWPIPE_API_KEY"); key != "" {
       providers = append(providers, infllm.NewClawPipe(
           key,
           os.Getenv("CLAWPIPE_PROJECT_ID"),
           os.Getenv("CLAWPIPE_BASE_URL"), // defaults to https://api.clawpipe.ai
       ))
       names = append(names, "clawpipe")
   }
   ```
   When both ClawPipe and direct providers are configured, ClawPipe
   lands first in `names` (cost-optimized primary; direct providers
   become fallbacks for ClawPipe outage).

3. **Spend tracking pass-through**: ClawPipe's response carries
   `tokensIn/Out + latencyMs`. Forward to existing
   `spend.Tracker.Record` so dashboards still attribute correctly.
   Bonus: when ClawPipe returns `cached: true`, persist a separate
   `cache_hit_count` metric on `spend_events` so the 402 hard-cap
   logic distinguishes real spend from cached spend (billing
   fairness).

4. **Tests**:
   - `clawpipe_test.go` with httptest mock: assert request shape,
     bearer header, project-id header, JSON unmarshal correctness.
   - Fallback chain test: when ClawPipe upstream returns 502, the
     chain advances to Anthropic and the request still succeeds.

### Bonus reuse opportunities (not minimum viable)

- **15-plugin Guard Registry + DLP pack**: ClawPipe has detection
  classes that close our "12+ classes" marketing gap honestly.
  Lift the regex pack into our `dlp.go` (family-shared codebase).
- **246 Booster rules**: deterministic prompt-shaping that could
  improve `/v1/chat` quality.
- **Semantic cache surface**: shared cache between ClawPipe and
  SDLC (Redis already present in both stacks).

These three are separate enterprise-tier features, not Bucket E.

### Env config

```
CLAWPIPE_API_KEY=cp_...               # one key per portfolio account
CLAWPIPE_PROJECT_ID=sdlc-prod         # tenant-isolated project id
CLAWPIPE_BASE_URL=https://api.clawpipe.ai  # optional; defaults shown
```

### Why slot it before Bucket D

Bucket D (LemonSqueezy) bills tenants for usage. Bucket E (ClawPipe)
reduces the underlying cost per call by 30–50% via routing + cache.
Land E first so the billing model is calibrated against the real
cost-per-token a tenant produces, not the pre-ClawPipe cost.

---

## Bucket F — OpenSyber portfolio integrations (additive, optional)

OpenSyber is the family's "secured AI agent" project (Q2 2026 launch,
82% ready per its tracker). Living at
`/Users/shaharsolomon/dev/projects/portfolio/opensyber`. It owns
shared portfolio infra that sdlc-platform should plug into rather
than reinvent.

### F1. register-project.sh integration (15 min)

OpenSyber ships `apps/claw-gateway/scripts/register-project.sh` which
provisions a portfolio project record + project API key in the shared
claw-gateway. Running it once for sdlc lets us hit the shared LLM
proxy without standing up our own API-key surface.

```bash
cd ~/dev/projects/portfolio/opensyber/apps/claw-gateway
./scripts/register-project.sh sdlc "SDLC Platform"
```

Deliverable: a `cp_sdlc_xxx` API key + project id, dropped into
sdlc-platform's gateway env as `CLAWPIPE_API_KEY` / `CLAWPIPE_PROJECT_ID`.

### F2. TokenForge device-bound sessions (3 hours)

OpenSyber's `apps/tokenforge-api/` ships device-bound ECDSA P-256
session tokens with non-extractable WebCrypto keys (`@opensyber/tokenforge`).
Currently sdlc-platform's `chain.go` step 6a runs the fingerprint
middleware in extract-only mode because the gateway is JWT-only and
has nowhere to store an expected hash. TokenForge provides that
session store.

Replaces: `cmd/auth-server` session-refresh enforcement (currently
the only place we hard-enforce fingerprints).
Adds: per-device key binding so a stolen JWT cannot be replayed from
a different browser.

Effort: ~3h. Library import + wire on the auth refresh path. Keeps
the JWT surface unchanged (TokenForge sits orthogonally).

### F3. PipeWarden findings ingestion (2 hours)

OpenSyber's `apps/api/src/routes/integrations/pipewarden.ts` ingests
SAST/DAST findings from PipeWarden via HMAC-SHA256-signed webhook.
The findings flow into an AI-triage skill that scores severity +
suggests remediation.

Reusable pattern for sdlc-platform:
- `POST /webhooks/pipewarden` with HMAC-SHA256 verification (we
  already have `webhooks.Sign` from Day 38; reuse).
- Findings table reuses our `audit_logs` immutable Writer or a new
  `security_findings` table (migration 028 candidate).
- Triage hook calls our LLM `/v1/chat` with a "score + suggest"
  prompt. ClawPipe (Bucket E) routes to whichever LLM is cheapest.

Why integrate: positions sdlc as the compliance-aware backend for
PipeWarden findings in regulated orgs. Parallel to OpenSyber's role
(security agents) without overlap.

### F4. Skill marketplace cross-pollination (defer)

OpenSyber has a runnable skill marketplace at `apps/web/src/app/marketplace/`
+ `packages/skill-sdk`. Our connector framework (Day 39-48) is
spiritually similar (registered metadata + OAuth flow). Long-term we
should align on one skill format + one marketplace surface, not two
parallel UIs.

Doc-only for now. Decision item: do we adopt OpenSyber's `SKILL.md` +
manifest format for our connectors, or run two surfaces?

### F5. Auth.js cross-project login (defer until Bucket A1 ships)

OpenSyber's `packages/auth` (Auth.js) provides Google + GitHub +
LinkedIn + Microsoft OAuth out of the box. Our SAML ACS work in
Bucket A1 covers enterprise SSO; consumer/freemium sign-up could
reuse OpenSyber's Auth.js shell for the "one signup" promise in the
family README.

Effort: ~1d. Adds /auth/* surface alongside existing /sso/*.
Recommendation: defer until Claude Team beta milestone has
self-serve signup as a P1.

### Bucket F estimate

F1 alone: 15 min, do it next session as a pre-flight before E.
F2: 3h on top of E (post-Day 1, pre-Day 2).
F3: 2h on Day 2 if time allows; otherwise next milestone.
F4 + F5: doc-only this milestone; revisit at Claude Team beta.

---

## Suggested order for next session (1.5 working days)

### Day 1 — wiring + SSO (8h)

1. **Morning (3h)**: Bucket A2 (AppendCritical) + A3 (projects RBAC).
   Touches audit + admin-ui — closes two roadmap gaps and exercises
   real migrations 009/010 on staging.
2. **Midday (3h)**: Bucket A1 (SAML ACS). Highest-value remaining
   integration; unlocks per-tenant SSO without external creds (use
   crewjam fixtures for tests).
3. **Afternoon (2h)**: Bucket B (migration apply to staging) +
   verify CI gates. Confirm spend tracker actually charges after
   model_pricing seed.

### Day 2 — cost layer + billing + recordings (8h)

4. **Pre-flight (15m)**: Bucket F1 — run OpenSyber's
   `register-project.sh` to provision sdlc as a claw-gateway project.
   Drops `CLAWPIPE_API_KEY` + `CLAWPIPE_PROJECT_ID` into env.
5. **Morning slot 1 (1.5h)**: Bucket E (ClawPipe wiring). Adapter +
   env sweep + httptest. Lands the cost layer before billing so
   Bucket D's pricing reflects post-ClawPipe cost-per-token.
6. **Morning slot 2 (4h)**: Bucket D (LemonSqueezy port). Migration
   027 + `infrastructure/billing/lemonsqueezy/` package + handlers
   + chain gate. End with httptest-mocked webhook test green.
7. **Afternoon (2h)**: Bucket A4 (session_recordings capture).
   Hooks into chat handler post-Tracker.

If Bucket F2/F3 land in this session: bump end-of-cycle by ~3-5h.
Otherwise defer to the milestone after.

### End-of-cycle (1h)

8. Update INTEGRATION-DEBT.md to reflect new ✅ states; tag any new
   follow-ups; commit per batch with conventional messages.

After this day, INTEGRATION-DEBT.md should sit at:
- Phase 1: 10 ✅ / 0 🟡 / 5 🔴 (unchanged — all 🔴 are external)
- Phase 2: 14 ✅ / 4 🟡 / 13 🔴

Day 54 (recordings) becomes the only 🟡 needing pure-code work; the
rest of the 🟡 list is awaiting external creds.

---

## Verification checklist (run at session end)

- [ ] `go build ./...` green in `services/gateway`
- [ ] `go test ./...` green in `services/gateway`
- [ ] `npx tsc --noEmit` green in `services/realtime` and
      `services/admin-ui`
- [ ] `pytest -q` green in `services/rag` (coverage may be low; the
      pre-existing 90% gate needs separate work — out of scope)
- [ ] One integration test per shipped item (target: 4 new tests)
- [ ] INTEGRATION-DEBT.md updated with line-by-line ✅ / 🟡 / 🔴
      status and the date of the sweep
- [ ] Commit per batch with conventional message; no `phase-N-complete`
      tags until every Done-when bullet is walked

---

## Open questions for the human

1. ~~**Stripe vs LemonSqueezy**~~ — **resolved: LemonSqueezy** (port
   from OpenSyber + TenantIQ, see Bucket D).
2. **OpenAI vs Anthropic as primary** in the FallbackChain? Currently
   primary = whichever env var lands first. Worth pinning explicitly
   via `LLM_PRIMARY=anthropic|openai` env var.
3. **Recording retention default**: Day 54 needs a per-tenant retention
   window. Default 30 days unless told otherwise.
4. **Admin UI table styling**: Day 53 page should match the existing
   audit-logs / connectors pages. Confirm Radix + TanStack stack stays.
5. **LemonSqueezy variants**: which sdlc-platform tiers ship as LS
   variants vs sales-led? Plan assumes Team + Business via LS; Pilot
   manual invoice; Enterprise sales-led. Confirm.
6. ~~**Single LS store across portfolio?**~~ — **resolved: same
   store** as OpenSyber + TenantIQ. See Bucket D §"Shared-store
   implications" for what this means for the webhook handler.
