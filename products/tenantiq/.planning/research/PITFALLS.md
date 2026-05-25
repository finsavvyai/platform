# Domain Pitfalls: TenantIQ — M365 MSP SaaS

**Domain:** M365 MSP SaaS on Cloudflare Workers
**Researched:** 2026-04-22
**Stack context:** Cloudflare Workers + Hono, D1 SQLite, KV, SvelteKit 5/Svelte 5, Microsoft Graph SDK, client_credentials daemon flow, Anthropic Claude AI

---

## Critical Pitfalls

Mistakes that cause rewrites, data breaches, or launch-blocking failures.

---

### Pitfall 1: Multi-Tenant Data Isolation Failure via Missing org_id Scope

**What goes wrong:** A query, join, background cron job, or async queue processor runs without a `WHERE org_id = ?` clause. Customer A receives Customer B's alerts, license data, or audit history. This is the most common catastrophic bug in shared-schema SaaS.

**Why it happens:**
- Copy-paste errors in new route handlers
- Cron jobs and queue processors that receive a raw record ID and query without re-asserting the org boundary
- JOIN operations where only the primary table is scoped; the joined table leaks

**Consequences:** Complete tenant data exposure. Regulatory violation (GDPR, SOC 2). Immediate churn from enterprise MSP customers. Possible breach notification obligation.

**Warning signs:**
- New route that doesn't call `c.get('orgId')` early
- Any raw SQL string in a cron/queue file that doesn't contain `org_id`
- Tests that pass a record ID without an org fixture

**Prevention:**
```typescript
// Mandatory pattern — every query must assert org boundary
const alert = await db
  .prepare('SELECT * FROM alerts WHERE id = ? AND org_id = ?')
  .bind(alertId, orgId)
  .first();
if (!alert) return c.json({ error: 'not found' }, 404); // never 403 — do not reveal existence
```
Lint rule: flag any `db.prepare` call in `routes/` or `cron/` that lacks `.bind(` containing `orgId`. Add a test fixture pattern that deliberately omits orgId and asserts 404.

**Phase:** Production Hardening (immediate), also enforce in every new feature phase.

---

### Pitfall 2: SAML IdP Certificate Expiry Causing Complete SSO Lockout

**What goes wrong:** An MSP customer's IdP (Okta, Entra, AD FS) rotates its SAML signing certificate on a 1–3 year schedule. TenantIQ stores the cert in the per-org SSO config at enrollment time. When the IdP rotates, SAML assertion signature validation fails silently or with a cryptic error — the customer's entire organization cannot log in.

**Why it happens:**
- Certificate stored as a static blob in the database at setup time
- No monitoring of cert expiry or metadata URL re-fetch
- Enterprise customers may not notify SaaS vendors of pending cert rotations

**Consequences:** All users of that org locked out. Escalation to on-call. Potential SLA breach. High-severity support incident.

**Warning signs:**
- SAML validation errors starting on a specific date (cert expiry date)
- Customer reports "SSO stopped working overnight"
- Error: `SAML signature verification failed` in auth logs

**Prevention:**
1. Store the IdP metadata URL alongside the cert — not just the cert blob
2. Schedule a daily cron that fetches all active IdP metadata URLs and checks `validUntil` on each X.509 cert
3. Alert the org admin 60 days, 30 days, and 7 days before expiry
4. Support dual-cert validation during transition: if the primary cert fails, attempt the secondary cert from refreshed metadata before rejecting the assertion
5. Keep at least one break-glass admin account using password auth per org

```typescript
// Cert expiry check in cron
const cert = parseCertificate(ssoConfig.idp_cert);
const expiresInDays = differenceInDays(cert.notAfter, new Date());
if (expiresInDays < 60) {
  await notifyOrgAdmin(orgId, { type: 'saml_cert_expiry', daysRemaining: expiresInDays });
}
```

**Phase:** Enterprise SSO phase — must be implemented before any customer enables SSO.

---

### Pitfall 3: JIT Provisioning Race Condition Creates Duplicate Accounts

**What goes wrong:** Two concurrent SAML assertions arrive for a new user (e.g., user opens two tabs simultaneously or IdP sends assertion twice). Both trigger JIT provisioning. Two DB inserts race. The user ends up with two accounts in the org, breaking RBAC assignment and producing orphaned records.

**Why it happens:**
- JIT provisioning is a lookup-then-insert pattern that is not atomic by default
- D1 is single-threaded per database but two Worker invocations can run in parallel against the same database
- SQLite has no native `INSERT OR IGNORE ... RETURNING` equivalent that is safe across concurrent processes without a UNIQUE constraint enforced at the DB level

**Consequences:** Duplicate user accounts, wrong role assignments, audit log gaps.

**Warning signs:**
- User row count for an org exceeds expected headcount immediately after SSO rollout
- Duplicate email addresses in `users` or `org_members` table
- Inconsistent permission behavior for newly provisioned users

**Prevention:**
```sql
-- Schema-level protection (migration required before SSO launch)
CREATE UNIQUE INDEX uq_org_member_email ON org_members(org_id, email);
```
```typescript
// Application-level: upsert pattern, never plain INSERT
await db.prepare(`
  INSERT INTO org_members (org_id, email, name, role, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(org_id, email) DO UPDATE SET name = excluded.name
`).bind(orgId, email, name, role, Date.now()).run();
```
Add a unique constraint migration before SSO goes live. Test with a load test that fires 10 concurrent SAML assertions for the same new user.

**Phase:** Enterprise SSO phase, schema migration required first.

---

### Pitfall 4: Microsoft Graph client_credentials Token Not Stored Per Tenant — Thundering Herd on Refresh

**What goes wrong:** The app fetches a new `client_credentials` access token for every Graph API call (or on every Worker cold start) instead of caching per-tenant. At 50 tenants, this means 50 simultaneous token requests to `login.microsoftonline.com` on every cron tick. Token endpoint throttling, latency spikes, and AADSTS errors follow.

**Why it happens:**
- Access tokens are obtained inside the request handler and not cached
- Worker cold starts do not share in-memory state across isolates
- Developers assume token acquisition is "free" — it is not

**Consequences:** 429 from AAD token endpoint. Cron jobs failing for multiple tenants simultaneously. Latency spikes on sync operations.

**Warning signs:**
- Token acquisition errors in logs during cron runs
- AAD sign-in logs showing high volume of `client_credentials` grants at cron interval
- Graph calls succeeding intermittently

**Prevention:**
```typescript
// Cache token in KV keyed by tenantId, check expiry before re-acquiring
const cacheKey = `graph_token:${tenantId}`;
const cached = await kv.get(cacheKey, 'json') as { token: string; exp: number } | null;
if (cached && cached.exp > Date.now() + 60_000) return cached.token;

const token = await acquireClientCredentialsToken(tenantId);
await kv.put(cacheKey, JSON.stringify({ token, exp: Date.now() + 3500_000 }), { expirationTtl: 3500 });
return token;
```
KV read latency (~1ms at same PoP) is negligible. Token is valid for ~1 hour; cache for 58 minutes to give buffer. Never cache in Workers memory alone — does not persist across isolates.

**Phase:** Graph API reliability hardening (pre-launch), verify against live remit.co.il tenant.

---

### Pitfall 5: Microsoft Graph Throttling During Multi-Tenant Bulk Sync (429 Cascades)

**What goes wrong:** A cron fires and triggers a full sync for all connected tenants in parallel. Each sync issues 5–15 Graph API calls (users, licenses, sign-in logs, security score, etc.). At 20+ tenants, this is 100–300 simultaneous Graph requests. Throttling kicks in (429 with `Retry-After`). Naive retry logic hammers the endpoint again. Cascade failure locks out all tenants for the duration.

**Why it happens:**
- Throttle limits apply per app+tenant combination, not globally, but AAD token endpoint has its own rate limit
- `Retry-After` header is ignored; code retries immediately
- All tenants scheduled at the same cron minute

**Consequences:** Partial or complete sync failure for all tenants. Stale dashboard data. Missed anomaly detection windows.

**Warning signs:**
- `429` errors appearing in logs at cron time
- Error response body contains `application is being throttled`
- Sync durations spiking without completing

**Prevention:**
1. Serialize heavy sync across tenants — process one tenant per queue message, not all at once
2. Honor `Retry-After` header — extract and `waitUntil` the delay before retry
3. Use delta queries (`/users/delta`, `/groups/delta`) instead of full enumerations after first sync
4. Stagger cron offsets across tenants — distribute syncs across a 30-minute window

```typescript
// Respect Retry-After in Graph fetch wrapper
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') ?? '30', 10);
  await scheduler.wait(retryAfter * 1000); // Cloudflare Workflows or queue delay
  return graphFetch(url, opts, retries - 1);
}
```

**Phase:** Pre-launch production hardening. Critical before scaling beyond 10 tenants.

---

### Pitfall 6: D1 Single-Threaded Query Contention Under Cron + Live Request Load

**What goes wrong:** D1 processes queries one at a time per database. During a cron scan (which may issue 20–50 sequential queries for a single tenant's CIS benchmark run), concurrent user requests queue behind it. At low tenant counts this is invisible. At 30+ tenants or during a compliance scan with JOIN-heavy control evaluation, user-facing requests time out waiting for D1.

**Why it happens:**
- D1 is explicitly single-threaded: "Each individual D1 database inherently single-threaded" (Cloudflare docs)
- A complex CIS scan joins `tenants`, `cis_scans`, `control_status`, `users_cache` — easily 10–30ms of wall-clock query time
- All 15 tables live in a single D1 database — no isolation between hot paths

**Consequences:** Dashboard load latency degrades under scan load. User-facing API timeouts. KPI dashboards show stale data.

**Warning signs:**
- P99 API latency spikes during scheduled scron windows
- D1 query duration increasing over time as table rows grow
- CIS scan triggers correlating with frontend "slow" reports

**Prevention:**
1. Index aggressively — every `WHERE org_id = ?` + filter column needs a compound index
2. Offload CIS scans to Cloudflare Queues — break into per-control messages so no single Worker holds D1 open for the full scan duration
3. Long-term: shard heavy read tables (`users_cache`, `alerts`) into a separate D1 database if contention becomes measurable
4. Avoid `SELECT *` on wide tables — always project the needed columns

```sql
-- Required indexes before launch (check against schema-d1.ts)
CREATE INDEX idx_alerts_org_created ON alerts(org_id, created_at DESC);
CREATE INDEX idx_control_status_scan ON control_status(scan_id, org_id);
CREATE INDEX idx_users_cache_org ON users_cache(org_id, last_sync DESC);
```

**Phase:** Production hardening + Storage Analytics phase (expected to add heavy queries).

---

## Moderate Pitfalls

---

### Pitfall 7: Cloudflare KV Cache Serving Stale Tokens After Tenant Disconnection

**What goes wrong:** An MSP revokes a tenant's Graph credentials or the tenant admin removes the enterprise app. The KV-cached access token (valid for up to 58 minutes) continues to be returned by the token cache, causing Graph calls to fail with 401 for up to an hour after revocation without a clear error to the user.

**Why it happens:** KV has eventual consistency and does not support instant global purge with guaranteed propagation. A KV `delete` propagates within ~60 seconds but the previously cached value may still be served from edge nodes that have not yet expired their local cache.

**Warning signs:** Graph calls returning 401 after tenant disconnect. Admin reporting "tenant shows as connected but data isn't syncing."

**Prevention:**
- After tenant disconnect/credential revocation, write a sentinel key `graph_token_revoked:{tenantId}` with a short TTL
- Check for revocation sentinel before returning cached token
- Treat 401 from Graph as a signal to clear cached token and notify admin — do not retry silently
- Use KV TTL of 55 minutes max (not 58) to reduce stale window

**Phase:** Production hardening.

---

### Pitfall 8: AADSTS700016 — Multi-Tenant App Not Provisioned in Customer Tenant

**What goes wrong:** MSP connects a new customer tenant via admin consent URL. The consent completes (200 redirect), but subsequent Graph calls return `AADSTS700016: Application was not found in the directory`. This happens when the admin consent was granted but the service principal was not fully provisioned before the first API call fires.

**Why it happens:** Admin consent provisioning has eventual consistency on Microsoft's side — the enterprise application object in the customer tenant may take 5–30 seconds to appear after consent redirect returns. If the onboarding flow immediately attempts a Graph call, it races the provisioning.

**Warning signs:** Onboarding completes UI flow but first sync fails. Error message contains `AADSTS700016`. Issue disappears on retry 30 seconds later.

**Prevention:**
```typescript
// After receiving admin consent callback, delay first Graph call
// and retry with backoff before surfacing error to user
async function verifyTenantProvisioned(tenantId: string, maxAttempts = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await graphClient.api('/organization').get();
      return true;
    } catch (e) {
      if (isAADSTS700016(e) && i < maxAttempts - 1) {
        await sleep(5000 * (i + 1)); // 5s, 10s, 15s, 20s
        continue;
      }
      throw e;
    }
  }
  return false;
}
```
This pattern is already observed in production with remit.co.il — codify it in the Graph client wrapper.

**Phase:** Tenant onboarding (immediate, already known issue).

---

### Pitfall 9: Cloudflare Workers 30-Second CPU Limit Killing CIS Scans

**What goes wrong:** A full CIS benchmark scan evaluates 100+ controls, each potentially requiring a Graph API call. Even with parallelism, synchronous processing inside a single Worker invocation risks hitting the 30-second CPU time limit (paid plan default; 5-minute absolute cap only available with explicit Cloudflare configuration). The Worker is killed mid-scan, leaving an incomplete `cis_scans` record with no `completed_at`.

**Why it happens:**
- CIS scan triggers as a single cron handler
- Each control evaluation requires JSON parsing, policy comparison, and D1 writes — these count as CPU time
- Anthropic Claude API calls do not count as CPU time (awaiting network), but post-processing the response does

**Consequences:** Corrupted scan state. Dashboard shows scan "in progress" indefinitely. CIS score is not updated.

**Warning signs:** `cis_scans` rows with `status = 'running'` older than 5 minutes. Worker logs showing timeout errors at the cron endpoint.

**Prevention:**
1. The cron handler should only dispatch — create a scan record and enqueue one queue message per control group
2. Each queue consumer processes a batch of 10–20 controls and writes results
3. A final aggregator message computes the total score and marks the scan complete
4. Add a watchdog cron (hourly) that marks scans older than 30 minutes as `failed`

```typescript
// Cron handler: dispatch only
export async function triggerCISScan(env: Env, tenantId: string) {
  const scanId = await createScanRecord(env.DB, tenantId);
  const batches = chunkControls(ALL_CONTROL_IDS, 15);
  for (const batch of batches) {
    await env.SCAN_QUEUE.send({ scanId, tenantId, controlIds: batch });
  }
}
```

**Phase:** CIS benchmark reliability (existing feature, hardening needed pre-launch).

---

### Pitfall 10: Microsoft Graph Delta Token Expiry Breaking Incremental Sync

**What goes wrong:** TenantIQ stores a Graph delta token after each user/group sync to enable incremental updates. Delta tokens expire after a period (typically 7 days of inactivity, sometimes shorter). If no sync runs for 7+ days (e.g., a customer pauses, or a cron fails silently), the next sync returns `410 Gone` on the delta endpoint. Without handling, the sync silently fails or crashes.

**Why it happens:** Delta tokens are time-limited. The expiry period is not documented as a fixed value by Microsoft — it varies by resource type and can change.

**Warning signs:** Sync logs showing `410` HTTP status from Graph. `users_cache` table not updated for > 7 days for a tenant. Alerts based on stale user data.

**Prevention:**
```typescript
// Delta sync with fallback to full sync
async function syncUsers(tenantId: string) {
  const deltaToken = await kv.get(`delta:users:${tenantId}`);
  try {
    const url = deltaToken
      ? `https://graph.microsoft.com/v1.0/users/delta?$deltatoken=${deltaToken}`
      : 'https://graph.microsoft.com/v1.0/users/delta';
    const result = await graphFetch(url, tenantId);
    await kv.put(`delta:users:${tenantId}`, result.deltaLink.split('deltatoken=')[1]);
    return result;
  } catch (e) {
    if (e.status === 410) {
      // Delta token expired — fall back to full sync, clear stored token
      await kv.delete(`delta:users:${tenantId}`);
      return syncUsers(tenantId); // recursive, no deltaToken this time
    }
    throw e;
  }
}
```

**Phase:** Graph sync reliability (pre-launch hardening).

---

### Pitfall 11: OIDC SSO — Missing `state` Parameter Validation Enables CSRF

**What goes wrong:** The OIDC authorization code flow redirect does not validate the `state` parameter on callback. An attacker crafts a malicious OIDC callback URL that completes authentication against their own token, logging a victim into the attacker's session (login CSRF).

**Why it happens:** Developers skip `state` validation assuming the IdP handles security. The `state` is an application-level CSRF token, not enforced by the IdP.

**Consequences:** Account takeover via session fixation. SAML 2.0 has similar `RelayState` validation requirements.

**Warning signs:** Auth callback handler does not read or validate a `state` cookie. No test covers mismatched `state` returning 400.

**Prevention:**
```typescript
// On initiating SSO flow
const state = crypto.randomUUID();
setCookie(c, 'sso_state', state, { httpOnly: true, sameSite: 'Lax', maxAge: 300 });
redirectToIdP(state);

// On callback
const storedState = getCookie(c, 'sso_state');
const returnedState = c.req.query('state');
if (!storedState || storedState !== returnedState) {
  return c.json({ error: 'invalid state' }, 400);
}
deleteCookie(c, 'sso_state');
```

**Phase:** Enterprise SSO — implement at the same time as the OIDC callback handler, not after.

---

### Pitfall 12: LemonSqueezy Webhook Replay Not Idempotent

**What goes wrong:** LemonSqueezy may deliver the same webhook event more than once (network retries, their own retry logic). The `subscription.created` or `payment_successful` event handler runs twice, double-crediting plan quota, creating duplicate billing records, or assigning the wrong plan tier.

**Why it happens:** Webhook delivery is at-least-once by design in all billing providers. Without idempotency checks, duplicate processing occurs.

**Warning signs:** Org records with `plan_tier` written twice in audit log. LemonSqueezy dashboard showing successful delivery multiple times for the same event ID.

**Prevention:**
```typescript
// Store processed event IDs in D1 with a unique constraint
await db.prepare(`
  INSERT INTO processed_webhooks (event_id, processed_at)
  VALUES (?, ?)
  ON CONFLICT(event_id) DO NOTHING
`).bind(eventId, Date.now()).run();
// Only proceed if the INSERT actually affected rows
if (result.meta.changes === 0) return c.json({ ok: true }); // already processed
```

**Phase:** Production hardening (pre-launch, billing is a critical path).

---

## Minor Pitfalls

---

### Pitfall 13: Svelte 5 Runes — `$effect` Causing Infinite Loops on Dashboard Stores

**What goes wrong:** A `$effect` in a dashboard component reads a store value and also writes to a derived value or triggers a network request that updates the same store. In Svelte 5, `$effect` reruns whenever any reactive dependency changes — if the effect's side effect modifies a dependency, it loops.

**Why it happens:** `$effect` has stricter tracking than Svelte 4's `$:`. Effects that were safe in Svelte 4 can become infinite loops after migration.

**Prevention:**
- Keep `$effect` read-only against reactive state; trigger mutations through explicit event handlers
- Use `$effect.pre` for DOM-level operations, not for data fetching
- All API calls should be in `$derived` async patterns or event handlers, not `$effect`

**Phase:** Any Svelte frontend work (ongoing rule).

---

### Pitfall 14: Cloudflare Pages Deploying Stale Web Build Against New API Schema

**What goes wrong:** API is deployed with a new response shape (e.g., field renamed, new required field added). The web build on Cloudflare Pages is deployed separately and may lag 5–10 minutes. During that window, the live frontend sends requests expecting the old schema, causing silent failures or render errors.

**Why it happens:** API and web are deployed independently via separate CI steps with no synchronization gate.

**Prevention:**
- Version the API response schema — include a `v` field in responses or use a version header
- Gate the Pages deploy on API smoke tests passing: CI runs `curl /health` and `curl /api/v1/version` against the new Workers deploy before triggering Pages build
- For breaking schema changes, maintain backward compatibility for one release cycle

**Phase:** CI/CD hardening.

---

### Pitfall 15: PDF Export of Copilot Readiness Report Exceeding Workers Response Size Limit

**What goes wrong:** The Copilot Readiness report generates a multi-page PDF with score breakdowns, charts, and per-user tables. PDF generation via client-side libraries (e.g., `pdf-lib`) or server-side rendering is memory-intensive. A report for a 500-user tenant can produce a 5–15 MB payload. Workers have a 128 MB memory limit but response streaming for large payloads requires explicit handling.

**Why it happens:** PDF generation is assumed to be cheap; it is not. Workers are not designed for CPU-heavy document rendering.

**Prevention:**
- Generate PDFs in a Cloudflare Worker but stream to R2, return a signed R2 URL rather than the binary in the response body
- Use `c.stream()` with chunked transfer encoding if inline delivery is required
- Keep PDF templates minimal — avoid embedding base64 images inline; reference R2-hosted assets

**Phase:** Copilot Readiness Assessment phase.

---

## Phase-Specific Warnings

| Phase / Topic | Likely Pitfall | Mitigation |
|---------------|---------------|------------|
| Enterprise SSO (SAML/OIDC) | IdP cert expiry lockout | Pitfall 2 — metadata refresh cron + expiry alerts |
| Enterprise SSO (SAML/OIDC) | JIT provisioning duplicate accounts | Pitfall 3 — UNIQUE constraint on org+email before go-live |
| Enterprise SSO (OIDC callback) | Login CSRF via missing state validation | Pitfall 11 — state cookie check in callback handler |
| Tenant onboarding (admin consent) | AADSTS700016 race after consent | Pitfall 8 — provisioning delay + backoff retry |
| Graph API sync at scale | 429 thundering herd from cron | Pitfall 5 — queue-based dispatch, delta queries |
| Graph API sync at scale | Delta token expiry → silent failures | Pitfall 10 — 410 fallback to full sync |
| CIS benchmark scans | Worker CPU timeout mid-scan | Pitfall 9 — queue-per-control-batch pattern |
| Storage Analytics (new feature) | D1 contention from heavy analytical queries | Pitfall 6 — compound indexes + queue offload |
| Production hardening | tenant_id missing from cron/queue handlers | Pitfall 1 — review all cron/queue files for org_id |
| Production hardening | KV stale token after credential revocation | Pitfall 7 — revocation sentinel key pattern |
| Billing webhooks | Duplicate LemonSqueezy event processing | Pitfall 12 — idempotency table in D1 |
| Copilot Readiness Assessment | PDF generation blowing memory limit | Pitfall 15 — generate to R2, return signed URL |
| CI/CD hardening | Stale frontend against new API schema | Pitfall 14 — version API + smoke test gate |
| Any Svelte 5 work | `$effect` infinite loops | Pitfall 13 — no mutations of reactive state inside `$effect` |

---

## Sources

- [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling) — HIGH confidence (official)
- [Microsoft Graph throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits) — HIGH confidence (official)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) — HIGH confidence (official)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/) — HIGH confidence (official)
- [Higher CPU limits for Workers (March 2025)](https://developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/) — HIGH confidence (official changelog)
- [How KV works — eventual consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/) — HIGH confidence (official)
- [SAML certificates and SSO production failures — Scalekit](https://www.scalekit.com/blog/saml-certificates-the-hidden-reason-enterprise-sso-breaks) — MEDIUM confidence (verified against Entra docs)
- [JIT provisioning with SAML SSO — Clerk docs](https://clerk.com/docs/guides/configure/auth-strategies/enterprise-connections/jit-provisioning) — MEDIUM confidence (official vendor docs)
- [Multi-tenant leakage: when RLS fails — Medium/InstaTunnel](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c) — MEDIUM confidence (corroborated by multiple sources)
- [Microsoft Graph delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview) — HIGH confidence (official)
- [AADSTS700016 troubleshooting — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2145974/unable-to-authenticate-to-graph-api-using-client-c) — MEDIUM confidence (verified by team's own production experience with remit.co.il)
- [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide) — HIGH confidence (official)
- [Cloudflare D1 production after 6 months — DEV Community](https://dev.to/whoffagents/cloudflare-d1-sqlite-at-the-edge-after-6-months-in-production-551j) — MEDIUM confidence (practitioner report, consistent with official limits docs)
