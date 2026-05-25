# Phase 2 — Enterprise + OpenAI Business/Enterprise Parity (Days 21-55)

Goal: ship the feature set that lets sdlc.cc replace **both** Claude Team
Premium / Enterprise and ChatGPT Business / Enterprise as the
self-hosted compliance + AI platform.

Tracks:

- **A. Identity & Access** (Days 21-27)
- **B. Spend & Analytics** (Days 28-32)
- **C. Compliance Controls** (Days 33-38)
- **D. Connector Ecosystem** (Days 39-48)
- **E. Multi-Provider / Multi-Tier Routing** (Days 49-52)
- **F. Workspace Features** (Days 53-55)

---

## Track A — Identity & Access (Days 21-27)

### Day 21 — Fine-grained RBAC schema

**Goal:** ship a permission model that scales beyond `role IN ('admin','user')`.

**Files:** migration `010_rbac.sql`, `services/gateway/internal/domain/rbac/{model.go,evaluator.go,cache.go}`.

**Steps:** introduce `roles`, `permissions`, `role_permissions`, `user_roles`. Permission strings follow `resource:action[:scope]` (e.g., `audit:read:tenant`). Build evaluator with caching (Redis, 60s TTL). Policy: deny by default; explicit allow only.

**Tests:** matrix of role × permission × resource × scope; cache invalidation on role change.

**Verify:** `go test ./internal/domain/rbac/...`.

**Done when:** evaluator answers <1ms p99 on cache hit; deny-by-default verified.

**Prompt:**
> Add fine-grained RBAC to sdlc-platform. Migration 010 creates `roles`, `permissions`, `role_permissions`, `user_roles`. Permission strings follow `resource:action[:scope]`. Build a Go evaluator at `services/gateway/internal/domain/rbac/evaluator.go` with Redis cache (60s TTL). Deny-by-default. Tests cover the full role × permission matrix and cache invalidation on role change.

---

### Day 22 — RBAC enforcement middleware + admin UI

**Goal:** every gateway handler is protected by an RBAC check; admins manage roles in the UI.

**Files:** `services/gateway/internal/interfaces/http/middleware/rbac.go`, `services/admin-ui/src/app/dashboard/roles/page.tsx`.

**Steps:** middleware reads `required_permission` annotation (chi route metadata) and rejects with 403 on miss. Admin UI: list roles, edit permissions, assign to users. Audit log every change.

**Tests:** annotated handler enforced; missing annotation = compile-time fail (linter); UI flow round-trips.

**Done when:** every public handler has an RBAC annotation; permission changes propagate within 60s.

**Prompt:**
> Wire RBAC enforcement into every sdlc-platform gateway handler. Add a chi route annotation `required_permission` that the middleware in `internal/interfaces/http/middleware/rbac.go` reads. Reject with 403 on miss. Add a static linter check that fails CI if any handler lacks an annotation. Admin-ui at `/dashboard/roles/page.tsx` for role CRUD and user-role assignment. Audit log every permission change.

---

### Day 23 — SCIM 2.0 user/group provisioning

**Goal:** finish the partial SCIM scaffold so Okta/Azure AD/Google Workspace can provision users.

**Files:** `services/gateway/internal/infrastructure/scim/` (already 438 LOC — split into ≤200 each).

**Steps:** split into `users.go`, `groups.go`, `bulk.go`, `filter.go`. Implement `/scim/v2/Users` GET/POST/PUT/PATCH/DELETE, `/scim/v2/Groups` similarly, `/scim/v2/Bulk`. ETag concurrency. Filter parser supports `eq`, `co`, `sw`, `pr`. Authentication: bearer token issued per IdP integration.

**Tests:** Okta-provided SCIM compliance test suite passes; concurrent updates rejected with 412 Precondition Failed.

**Verify:** `go test ./internal/infrastructure/scim/...`; run Okta's SCIM test tool against staging.

**Done when:** Okta SCIM compliance suite is green; provisioning round-trip works for a real Okta tenant.

**Prompt:**
> Finish SCIM 2.0 provisioning in sdlc-platform. The existing `internal/infrastructure/scim/scim.go` is 438 LOC — split into `users.go`, `groups.go`, `bulk.go`, `filter.go` (≤200 LOC each). Implement Users + Groups GET/POST/PUT/PATCH/DELETE plus Bulk. ETag concurrency. Filter parser with `eq/co/sw/pr`. Bearer-token auth issued per IdP. Run Okta's SCIM compliance suite against staging until green.

---

### Day 24 — SAML SSO + OIDC + MFA

**Goal:** customers can SSO via SAML or OIDC; gateway enforces MFA per tenant policy.

**Files:** `services/gateway/internal/infrastructure/sso/{saml.go,oidc.go,mfa.go}`, admin UI for IdP config.

**Steps:** SAML via `crewjam/saml`; OIDC via `coreos/go-oidc`. Per-tenant IdP config in DB, encrypted. MFA: TOTP, WebAuthn, Duo. Step-up auth: high-risk actions (key rotation, retention change) demand fresh MFA <5min.

**Tests:** SAML round-trip with a self-hosted SimpleSAMLphp IdP; OIDC with Auth0 test tenant; MFA enforcement on step-up actions.

**Done when:** an admin can connect Okta via SAML and Azure AD via OIDC and force MFA on key rotation.

**Prompt:**
> Add SAML SSO, OIDC SSO, and MFA enforcement to sdlc-platform. Use `crewjam/saml` and `coreos/go-oidc`. Per-tenant IdP config encrypted at rest. MFA: TOTP, WebAuthn, Duo Push. Step-up auth on high-risk actions (key rotation, retention change) requires fresh MFA <5 minutes old. Test with SimpleSAMLphp + Auth0 test tenants.

---

### Day 25 — Domain verification + automatic SSO redirect

**Goal:** customers verify domain ownership; users on a verified domain are auto-redirected to their tenant's SSO.

**Files:** `services/gateway/internal/infrastructure/domain_verification/`, admin UI flow.

**Steps:** verify via DNS TXT record or `.well-known/sdlc-cc-verification` HTTP file. Once verified, login email matches → redirect to tenant SSO. Re-verify quarterly or on suspicion.

**Tests:** TXT verification round-trip; HTTP verification with a mock server; expiry triggers re-verification.

**Done when:** domain owners can self-verify, and logins for verified domains route to SSO automatically.

**Prompt:**
> Add domain verification to sdlc-platform. Customers verify ownership via DNS TXT record or `.well-known/sdlc-cc-verification`. Once verified, login email match auto-redirects to the tenant's configured SSO. Re-verify quarterly. Tests cover both verification methods, expiry, and the auto-redirect path.

---

### Day 26 — IP allowlist (per tenant, per API key)

**Goal:** tenants configure CIDR allowlists; requests outside are rejected.

**Files:** `services/gateway/internal/infrastructure/network/ip_allowlist.go` (the existing `ip_blocker.go` is for blocklist), migration `011_ip_allowlist.sql`.

**Steps:** schema: `ip_allowlists(tenant_id, api_key_id, cidr, label, created_at)`. Middleware checks request IP against tenant + key allowlist; falls back to tenant-wide if key has none. CloudFlare proxy honored via `CF-Connecting-IP`. Admin UI to manage CIDRs.

**Tests:** allowed CIDR passes; blocked CIDR returns 403; CloudFlare-proxied requests honor `CF-Connecting-IP`.

**Done when:** an admin can set `10.0.0.0/8` on a key and requests from `192.168.x` to that key return 403.

**Prompt:**
> Add per-tenant per-API-key IP allowlist enforcement to sdlc-platform. Migration 011 creates `ip_allowlists`. Middleware checks request IP against tenant + key allowlist (falls back to tenant-wide). Honor `CF-Connecting-IP` for CloudFlare-proxied requests. Admin UI to manage CIDRs. Tests cover allowed/blocked/proxied paths.

---

### Day 27 — Network-level access control (private link / VPC peering)

**Goal:** customers can require all traffic to flow over a private link (AWS PrivateLink, Azure Private Link, GCP Private Service Connect).

**Files:** `deployments/network/` (Terraform modules), `docs/runbooks/private-link-onboarding.md`.

**Steps:** Terraform modules for PrivateLink endpoints; gateway enforces `X-Forwarded-Source: private-link` requirement when tenant has `network_mode = 'private_only'`. Docs walk customer through creating their endpoint.

**Tests:** end-to-end test in AWS staging with a PrivateLink endpoint; public-internet request rejected with 403 when `network_mode = 'private_only'`.

**Done when:** a customer in `private_only` mode cannot reach the gateway from the public internet.

**Prompt:**
> Add private-link enforcement to sdlc-platform. Add Terraform modules for AWS PrivateLink, Azure Private Link, and GCP PSC under `deployments/network/`. Gateway middleware enforces `X-Forwarded-Source: private-link` when the tenant has `network_mode = 'private_only'`. Docs walk customers through onboarding. End-to-end test in AWS staging confirms public-internet requests are rejected.

---

## Track B — Spend & Analytics (Days 28-32)

### Day 28 — Per-user and per-tenant spend tracking

**Goal:** every LLM call records tokens + dollar cost in a `spend_events` table.

**Files:** `services/gateway/internal/infrastructure/spend/{tracker.go,pricing.go}`, migration `012_spend_events.sql`.

**Steps:** schema includes `tenant_id, user_id, provider, model, prompt_tokens, completion_tokens, usd_cents, created_at`. Pricing table per model per provider, updateable. Async write via channel.

**Tests:** every LLM call produces exactly one spend event; pricing updates take effect in <60s.

**Done when:** spend events appear in real-time for a test query.

**Prompt:**
> Add spend tracking to sdlc-platform. Migration 012 creates `spend_events` and `model_pricing`. Every LLM call records tokens + USD cost via `internal/infrastructure/spend/tracker.go`. Pricing is hot-updatable. Async write via channel. Tests confirm every call produces exactly one event.

---

### Day 29 — Spend limits (per user, per tenant) with hard + soft caps

**Goal:** admins set monthly USD limits; soft cap warns, hard cap blocks.

**Files:** `services/gateway/internal/domain/spend/limiter.go`, admin UI controls.

**Steps:** schema `spend_limits(scope, scope_id, monthly_usd_cents, soft_cap_pct, hard_cap_pct)`. Middleware checks current month spend against limits; soft cap (default 80%) emits warning event; hard cap (100%) blocks with 402 Payment Required.

**Tests:** mocked spend at 79% passes silent; at 80-99% emits warning; at 100% blocks; rollover at month boundary.

**Done when:** an admin sets $1000/mo cap on a tenant, and the 1001st dollar of spend returns 402.

**Prompt:**
> Add spend limits to sdlc-platform. Schema `spend_limits` with scope (user/tenant), monthly USD cents, soft cap %, hard cap %. Middleware checks current-month spend on every LLM call. Soft cap emits a warning event (Slack/webhook). Hard cap returns 402 Payment Required. Admin UI to configure. Tests cover the 79/80/100/rollover boundaries.

---

### Day 30 — User analytics dashboard

**Goal:** admins see per-user / per-team usage: queries, tokens, cost, top models, latency.

**Files:** `services/admin-ui/src/app/dashboard/analytics/page.tsx`, gateway aggregation endpoints.

**Steps:** materialized views over `spend_events` refreshed every 5min. Endpoints for time-series + leaderboards. UI: charts via Recharts; CSV export. Privacy: respect tenant data isolation.

**Tests:** materialized view refresh is idempotent; aggregation endpoints respect tenant isolation; CSV export streams.

**Done when:** an admin sees the top 10 users by spend over the last 30 days in <2s.

**Prompt:**
> Build a usage analytics dashboard for sdlc-platform. Materialized views over `spend_events` refresh every 5 min. Gateway endpoints for time-series and leaderboards (per user, team, model). Admin-ui page at `/dashboard/analytics` with Recharts. CSV export streams. Tenant isolation enforced. Performance: top-10 by spend over 30 days <2s.

---

### Day 31 — Volume billing + invoicing

**Goal:** monthly invoices auto-generated; volume discounts auto-applied.

**Files:** `services/gateway/internal/infrastructure/billing/{invoice.go,discount.go}`, integration with Stripe/LemonSqueezy.

**Steps:** monthly cron generates invoice from `spend_events`; volume discount tiers configurable per contract; PDF invoice + Stripe metered usage upload.

**Tests:** discount thresholds applied correctly; PDF generated; Stripe webhook on payment captured.

**Done when:** end-of-month run generates a correct invoice for a fixture tenant with 1k requests across 3 models.

**Prompt:**
> Add monthly invoicing + volume discounts to sdlc-platform. Cron job aggregates `spend_events` end-of-month. Volume discount tiers configurable per contract. Generate PDF invoice + push metered usage to Stripe. Tests cover discount thresholds, PDF generation, and Stripe webhook handling on payment.

---

### Day 32 — Compliance API (read-only observability for SOC officers)

**Goal:** a stable, versioned API endpoint set that auditors can query for compliance evidence.

**Files:** `services/gateway/internal/interfaces/http/handlers/compliance/`, OpenAPI compliance.yaml.

**Steps:** endpoints for: `GET /compliance/audit-events`, `GET /compliance/access-controls`, `GET /compliance/data-flow`, `GET /compliance/retention-status`, `GET /compliance/dlp-events`. Read-only API key with `compliance:read` permission only. Rate-limited separately. Schema versioned.

**Tests:** every endpoint returns valid JSON for a fixture tenant; permission gate enforced; deprecated fields return with `Deprecation` header.

**Done when:** a SOC auditor can pull a 30-day SOC2-evidence report via 5 API calls.

**Prompt:**
> Build a Compliance API for sdlc-platform: read-only endpoints under `/compliance/*` returning audit events, access controls, data flow, retention status, and DLP events. Versioned schema. Compliance-only API key permission. Rate-limited separately. Tests confirm every endpoint returns valid JSON for fixtures and respects the permission gate. Deprecation headers on retired fields.

---

## Track C — Compliance Controls (Days 33-38)

### Day 33 — Custom data retention policies

**Goal:** tenants set retention windows per data type (chat history, documents, embeddings, audit logs).

**Files:** migration `013_retention_policies.sql`, `services/gateway/internal/domain/retention/`.

**Steps:** schema per `tenant_id × data_type`. Background sweeper runs daily, deletes rows past retention. Audit logs are append-only — for them, retention applies to *export* and *purge-on-request*, not row-delete during the legal-hold window. Policy change requires step-up MFA.

**Tests:** sweeper purges expired rows; audit hold window honored; policy change is audited and step-up-MFA-gated.

**Done when:** a tenant sets `chat_history = 30d`, and on day 31 the row is gone.

**Prompt:**
> Add custom data retention to sdlc-platform. Migration 013: `retention_policies(tenant_id, data_type, days, hold_until)`. Daily sweeper purges expired rows. Audit logs honor a legal-hold window before purge. Policy changes require step-up MFA and are audited. Tests confirm purge timing, hold window, and step-up enforcement.

---

### Day 34 — DLP scanning on inbound prompts

**Goal:** every prompt is scanned for PII (SSN, credit card, account numbers, ITIN, MRN) before forwarding to the LLM. Configurable mask/redact/block.

**Files:** `services/dlp/` (already exists), `services/gateway/internal/interfaces/http/middleware/dlp.go`.

**Steps:** Microsoft Presidio or self-trained patterns. Per-tenant policy: detect → mask | redact | block. Action audited. Mask preserves length; redact replaces with `[REDACTED:type]`.

**Tests:** synthetic prompt with SSN is masked/blocked per policy; performance overhead <50ms p95.

**Done when:** a tenant policy `block_pii=true` rejects a prompt containing `123-45-6789` with 422.

**Prompt:**
> Wire DLP middleware on inbound prompts in sdlc-platform. Use the existing `services/dlp/` engine via gateway middleware. Per-tenant policy: mask | redact | block on detection of SSN, credit card, account number, ITIN, MRN. Audit every action. Performance overhead <50ms p95. Tests confirm each policy outcome.

---

### Day 35 — DLP scanning on outbound responses (data exfiltration prevention)

**Goal:** LLM responses also scanned for PII before returning to the user.

**Files:** same DLP middleware, response leg.

**Steps:** scan completion text and any tool-call arguments. Block by default if response contains data the user lacks permission for.

**Tests:** RAG over a doc containing PII returns redacted text when policy says `redact`; permission mismatch blocks.

**Done when:** a prompt that successfully retrieves a doc with PII gets a redacted response when policy says so.

**Prompt:**
> Extend the sdlc-platform DLP middleware to scan outbound LLM responses for PII before returning to the user. Scan completion text and tool-call arguments. Block when the response contains data the user lacks permission for. Tests cover the redact path and the permission-mismatch block path.

---

### Day 36 — Encryption at rest audit

**Goal:** every storage layer is encrypted at rest with documented evidence.

**Files:** `docs/security/encryption-at-rest.md`, infra Terraform updates.

**Steps:** audit Postgres (TDE or LUKS), Redis (RDB encryption), S3 (SSE-KMS), Vault, secrets manager. Document keys, rotation, and HSM-backing where applicable. Add a CI check that running config matches policy.

**Tests:** automated check confirms encryption is on for all stores; alerts if a new bucket is created without SSE.

**Done when:** every storage layer has documented encryption with a passing CI check.

**Prompt:**
> Audit and document encryption at rest for every sdlc-platform storage layer (Postgres, Redis, S3, Vault, secrets manager). Update Terraform to ensure SSE-KMS on S3 and TDE/LUKS on Postgres. Add a CI check that fails if a storage resource is created without encryption. Document keys, rotation cadence, and HSM-backing in `docs/security/encryption-at-rest.md`.

---

### Day 37 — TLS hardening + mTLS between services

**Goal:** all internal service-to-service traffic uses mTLS. External TLS is 1.2 minimum, 1.3 preferred.

**Files:** `services/gateway/internal/infrastructure/mtls/` (already exists), service configs.

**Steps:** generate per-service certs via internal CA (e.g., HashiCorp Vault PKI). Auto-rotate every 90 days. External TLS via Let's Encrypt + HSTS preload. Disable TLS 1.1 and below.

**Tests:** mTLS handshake succeeds; without client cert, internal calls are rejected; external HSTS header present and preload-eligible.

**Done when:** all internal traffic is mTLS; external scan (`testssl.sh`) returns A+.

**Prompt:**
> Harden TLS in sdlc-platform. Internal service-to-service: mTLS via Vault PKI, certs rotate every 90 days. External: TLS 1.2 minimum, 1.3 preferred, HSTS preload-eligible. Disable TLS 1.1 and below. Tests confirm mTLS handshake works and unauthenticated internal calls fail. External `testssl.sh` scan must report A+.

---

### Day 38 — Webhook delivery reliability (signed, retried, idempotent)

**Goal:** every outbound webhook is signed (HMAC-SHA256), retried with exponential backoff, and idempotent on the receiver side.

**Files:** `services/gateway/internal/infrastructure/webhooks/`, admin UI for webhook management.

**Steps:** signed payloads with timestamp + nonce; receivers reject replays. Retry: 30s/2m/10m/1h/4h, max 5. DLQ for terminal failures. Admin UI to inspect delivery history.

**Tests:** signature verification round-trips; replayed payloads rejected; retry sequence executes; DLQ entry on persistent failure.

**Done when:** a webhook to a flaky endpoint eventually lands or DLQs cleanly.

**Prompt:**
> Add reliable webhook delivery to sdlc-platform. Sign payloads with HMAC-SHA256 + timestamp + nonce. Retry with 30s/2m/10m/1h/4h backoff (max 5 attempts), then DLQ. Admin UI to inspect delivery history and replay from DLQ. Tests cover signing, replay rejection, retry sequence, and DLQ.

---

## Track D — Connector Ecosystem (Days 39-48)

### Day 39 — Connector framework (plugin spec + registry)

**Goal:** a stable plugin contract so each connector is a small, isolated module.

**Files:** `services/gateway/internal/connectors/{connector.go,registry.go}`, `packages/connectors-spec/`.

**Steps:** define `Connector` interface: `Authenticate`, `ListResources`, `Fetch`, `Search`, `Watch`. Registry loads built-in + user-installed connectors. Per-connector RBAC scope.

**Tests:** spec compliance test runs against a fake connector; registry handles add/remove cleanly.

**Done when:** the framework supports two test connectors that round-trip auth + fetch.

**Prompt:**
> Build a connector framework for sdlc-platform. Define `Connector` interface in `internal/connectors/connector.go` with Authenticate, ListResources, Fetch, Search, Watch. Registry at `internal/connectors/registry.go` loads built-in + user-installed connectors. Per-connector RBAC scope. Add a fake connector to verify the spec. Document the spec in `packages/connectors-spec/README.md`.

---

### Day 40 — Connector: Google Workspace (Drive + Docs + Sheets)

**Goal:** users link a Google Workspace account; sdlc.cc indexes their Drive into the RAG corpus.

**Files:** `services/gateway/internal/connectors/google/`.

**Steps:** OAuth 2.0 flow with `drive.readonly`, `documents.readonly`, `spreadsheets.readonly` scopes. Incremental sync via `pageToken`. Document text extracted via Google Drive export API. Embeddings created in pgvector.

**Tests:** OAuth round-trip; incremental sync picks up only changed docs; revoking access removes embeddings within 24h.

**Done when:** a user can link Drive, see their docs in search results, and unlink to wipe.

**Prompt:**
> Implement the Google Workspace connector for sdlc-platform under `internal/connectors/google/`. OAuth 2.0 with read-only Drive/Docs/Sheets scopes. Incremental sync via pageToken. Text extracted via Drive export API and embedded into pgvector. Tests cover the OAuth round-trip, incremental sync delta detection, and revocation cleanup within 24h.

---

### Day 41 — Connector: Microsoft 365 (SharePoint + OneDrive + Teams)

**Goal:** parity with Google Workspace for Microsoft tenants.

**Files:** `services/gateway/internal/connectors/microsoft365/`.

**Steps:** Graph API; same incremental sync pattern. SharePoint sites + OneDrive + Teams files + (read-only) Teams chats with explicit consent.

**Tests:** Graph API mocked happy path + revocation.

**Done when:** customer with Microsoft 365 can index SharePoint with the same UX as Google.

**Prompt:**
> Implement the Microsoft 365 connector for sdlc-platform under `internal/connectors/microsoft365/`. Use Microsoft Graph API for SharePoint, OneDrive, Teams files, and (with explicit per-tenant consent) Teams chat. Incremental sync. Tests cover Graph mocked round-trip and revocation.

---

### Day 42 — Connector: Slack

**Goal:** index Slack workspaces (per channel) for RAG; respect Slack permissions.

**Files:** `services/gateway/internal/connectors/slack/`.

**Steps:** Slack OAuth + Events API. Index public channels by default; private channels only on explicit channel-by-channel admin opt-in. Respect message-level deletes.

**Tests:** message indexed within 30s of post; deleted message removed within 60s; admin opt-in required for private.

**Done when:** an admin can opt-in `#general` and see messages searchable in RAG.

**Prompt:**
> Implement the Slack connector for sdlc-platform under `internal/connectors/slack/`. OAuth + Events API. Index public channels by default; private channels only on per-channel admin opt-in. Respect message deletes within 60s. Tests cover index latency, delete propagation, and the consent gate for private channels.

---

### Day 43 — Connector: GitHub (issues + PRs + code search)

**Goal:** index GitHub repos for RAG; integrate with Codex-style code workflows.

**Files:** `services/gateway/internal/connectors/github/`.

**Steps:** GitHub App auth (not PAT). Scope: read access to selected repos. Index issues, PRs, and code (limited to selected repos). Webhook for incremental updates.

**Tests:** App install round-trip; webhook delivers within 30s; un-install removes embeddings.

**Done when:** a repo's issues and PRs are searchable in RAG within 30s of post.

**Prompt:**
> Implement the GitHub connector for sdlc-platform under `internal/connectors/github/`. GitHub App (not PAT) with read access to selected repos. Index issues, PRs, and code from selected repos. Webhook for incremental updates within 30s. Uninstall removes embeddings. Tests cover install/webhook/uninstall.

---

### Day 44 — Connector: Atlassian (Jira + Confluence)

**Goal:** index Jira tickets and Confluence pages.

**Files:** `services/gateway/internal/connectors/atlassian/`.

**Steps:** Atlassian Connect (Jira/Confluence Cloud) or PAT (Server). Incremental via `updated > timestamp`.

**Tests:** ticket transition triggers re-index within 60s; page edit re-indexes.

**Done when:** Jira ticket comments are searchable in RAG within 60s.

**Prompt:**
> Implement the Atlassian connector for sdlc-platform under `internal/connectors/atlassian/`. Support Jira and Confluence Cloud (Connect) and Server (PAT). Incremental via `updated > timestamp`. Tests cover transitions, edits, and re-index latency.

---

### Day 45 — Connector: Notion

**Goal:** index Notion workspaces.

**Files:** `services/gateway/internal/connectors/notion/`.

**Steps:** Notion OAuth. Index databases + pages user grants access to.

**Tests:** OAuth round-trip; updated page re-indexes.

**Done when:** a Notion workspace's pages are searchable.

**Prompt:**
> Implement the Notion connector for sdlc-platform under `internal/connectors/notion/`. Notion OAuth. Index databases + pages with granted access. Tests cover OAuth, update re-index, and revocation.

---

### Day 46 — Connector: Salesforce

**Goal:** index Salesforce records (Accounts, Contacts, Opportunities, Cases).

**Files:** `services/gateway/internal/connectors/salesforce/`.

**Steps:** Salesforce OAuth + REST/Bulk API. Per-object opt-in. Respect FLS (Field-Level Security).

**Tests:** OAuth + bulk pull + FLS enforcement.

**Done when:** an admin can index Accounts, and a user without FLS to a field cannot retrieve that field via RAG.

**Prompt:**
> Implement the Salesforce connector for sdlc-platform under `internal/connectors/salesforce/`. Salesforce OAuth + Bulk API. Per-object opt-in. Strictly enforce Field-Level Security on retrieval. Tests confirm FLS enforcement: a user without access to a field cannot retrieve it via RAG.

---

### Day 47 — Connector: Zendesk + ServiceNow + HubSpot (CRM/CS hub)

**Goal:** parity for the CRM / customer-support category.

**Files:** `services/gateway/internal/connectors/{zendesk,servicenow,hubspot}/`.

**Steps:** OAuth or token auth per vendor. Incremental sync. Permission scoping.

**Done when:** all three connectors round-trip auth and basic indexing.

**Prompt:**
> Implement Zendesk, ServiceNow, and HubSpot connectors for sdlc-platform. Use vendor OAuth or token auth. Incremental sync. Permission scoping. Tests round-trip auth + basic indexing for each.

---

### Day 48 — Connector marketplace UI

**Goal:** admins browse and install connectors from a marketplace UI.

**Files:** `services/admin-ui/src/app/dashboard/connectors/`.

**Steps:** list available connectors (built-in + community); per-connector OAuth/install flow; per-connector status (synced/syncing/errored); audit log every install/uninstall.

**Tests:** install round-trip; status updates real-time; uninstall removes embeddings.

**Done when:** an admin can install Slack from the marketplace in <30s and see it sync.

**Prompt:**
> Build a connector marketplace UI in sdlc-platform admin-ui. List available connectors (built-in + community). Per-connector OAuth/install flow with status (synced/syncing/errored). Audit log install/uninstall. Tests cover round-trip install, real-time status, and uninstall cleanup.

---

## Track E — Multi-Provider / Multi-Tier Routing (Days 49-52)

### Day 49 — LLM provider abstraction + fallback chain

**Goal:** a single internal API hits Anthropic, OpenAI, Google, AWS Bedrock, Azure OpenAI; failure auto-routes to fallback.

**Files:** `services/gateway/internal/infrastructure/llm/{provider.go,anthropic.go,openai.go,bedrock.go,fallback.go}`.

**Steps:** Provider interface (Generate, Embed, Stream). Each impl handles auth + retries + token counting. Fallback chain configured per tenant.

**Tests:** provider mock returns 5xx → fallback engages within 1s; token count is consistent across providers.

**Done when:** primary provider going down for 5 minutes does not cause user-visible errors.

**Prompt:**
> Build an LLM provider abstraction in sdlc-platform: Anthropic, OpenAI, Google, Bedrock, Azure OpenAI. Provider interface in `internal/infrastructure/llm/provider.go`. Per-tenant fallback chain. Tests confirm a primary 5xx triggers fallback within 1s and that token counts are consistent across providers.

---

### Day 50 — Cost-tier routing (cheap / balanced / premium)

**Goal:** policy decides which model tier to use based on prompt class, user role, and current spend.

**Files:** `services/gateway/internal/domain/routing/{policy.go,classifier.go}`.

**Steps:** classifier determines prompt complexity (length, intent, attachment count); policy maps complexity × user-role × spend-headroom to a model tier. Tier overrides via header.

**Tests:** simple-classification prompt routes to cheap tier; complex prompt to premium; admin can override.

**Done when:** 70% of test prompts route to cheap tier; latency improves; cost drops vs always-premium baseline.

**Prompt:**
> Add cost-tier routing to sdlc-platform LLM gateway. Classifier in `internal/domain/routing/classifier.go` determines prompt complexity. Policy maps complexity × user-role × spend-headroom to a model tier (cheap/balanced/premium). Tier override via `X-Model-Tier` header. Benchmark: 70% of test prompts should route to cheap tier without quality regression.

---

### Day 51 — Codex-equivalent code-action workflows

**Goal:** sdlc.cc can execute structured code actions (apply patch, run tests, open PR) on user code repos via the connector.

**Files:** `services/agents/code/`.

**Steps:** sandboxed agent that uses the GitHub connector to read code, an LLM to plan, and structured tool calls to apply patches. Run inside an ephemeral worker container.

**Tests:** agent fixes a known-broken test in a fixture repo and opens a PR; tests pass.

**Done when:** a user can ask "fix the failing test in repo X" and sdlc.cc opens a working PR.

**Prompt:**
> Build a Codex-equivalent code-action agent for sdlc-platform under `services/agents/code/`. The agent uses the GitHub connector to read repo state, an LLM to plan, and structured tool calls (apply_patch, run_tests, open_pr) inside an ephemeral worker container. Tests confirm the agent fixes a fixture failing test and opens a working PR.

---

### Day 52 — Expanded context window (chunked + summarized for long inputs)

**Goal:** support inputs larger than any single model's context via chunking + hierarchical summarization.

**Files:** `services/rag/app/services/long_context.py`, gateway integration.

**Steps:** input >model context → chunk → summarize chunks → recursive summarize → fit in target model. Track loss-of-fidelity score.

**Tests:** 1M-token input produces a coherent answer; loss score documented.

**Done when:** users can submit 1M-token documents and get useful answers.

**Prompt:**
> Implement expanded context support in sdlc-platform RAG. When an input exceeds the target model's context, chunk → summarize → recursively summarize → fit. Track loss-of-fidelity. Tests confirm a 1M-token input produces a coherent answer with documented loss score.

---

## Track F — Workspace Features (Days 53-55)

### Day 53 — Shared projects + custom workspace assistants

**Goal:** users create projects with shared context, custom system prompts, custom connectors.

**Files:** `services/admin-ui/src/app/dashboard/projects/`, gateway domain `projects/`.

**Steps:** schema `projects(id, tenant_id, name, system_prompt, connector_ids, member_ids)`. Project-scoped queries inherit project context. RBAC at the project level.

**Tests:** project member sees project results; non-member 403; system prompt is enforced.

**Done when:** a team can create a "Q4 Roadmap" project with a custom system prompt and shared connectors.

**Prompt:**
> Add shared projects to sdlc-platform. Schema `projects` with system prompt, connector ids, and member ids. Queries scoped to a project use that project's context + system prompt + connectors. RBAC at the project level. Admin-ui at `/dashboard/projects/`. Tests confirm membership gating, system-prompt enforcement, and result scoping.

---

### Day 54 — Record mode (session recording for audit)

**Goal:** admins can record specific user sessions (with consent banner) for audit.

**Files:** `services/gateway/internal/infrastructure/record/`.

**Steps:** when record mode is active for a user, every prompt/response is stored verbatim in an encrypted, append-only store. Consent banner shown to the user. Recordings retained per tenant retention policy.

**Tests:** banner shown; recording stored; cannot disable mid-session without admin override.

**Done when:** an admin can record a contractor's session for compliance review.

**Prompt:**
> Add session recording (record mode) to sdlc-platform. When active, every prompt/response is stored encrypted and append-only. Show a consent banner. Cannot be disabled mid-session without admin override. Retention follows tenant policy. Tests cover banner, storage, and the disable gate.

---

### Day 55 — Phase 2 sign-off

**Goal:** confirm every Phase 2 deliverable; tag `phase-2-complete`.

**Steps:** check each Day 21-54 against criteria; update readiness doc; tag main.

**Done when:** readiness reflects new state (estimated 80%); tag exists.

**Prompt:**
> Review every Phase 2 deliverable in `docs/roadmap/phase-2-enterprise-parity.md`. Update `docs/PRODUCTION-READINESS.md` with the new state. Tag `phase-2-complete` only when all 34 days' criteria are met. List gaps and stop if any miss.

---

End of Phase 2. Tag: `phase-2-complete`. Estimated readiness: 80%.
