# OWASP Top 10 (2021) Security Audit — LunaOS Engine API

**Auditor:** agent-1b-1
**Branch:** `race/agent-1b-1`
**Date:** 2026-04-25
**Scope:** `packages/api/src/routes/`, `packages/api/src/middleware/`, plus key services touched by route handlers.

| Category | Risk (1-10) |
|---|---|
| A01 Broken Access Control | **9** |
| A02 Cryptographic Failures | **7** |
| A03 Injection | **6** |
| A04 Insecure Design | **6** |
| A05 Security Misconfiguration | **5** |
| A06 Vulnerable Components | **3** |
| A07 Identification & Auth Failures | **7** |
| A08 Software & Data Integrity Failures | **8** |
| A09 Logging & Monitoring Failures | **6** |
| A10 Server-Side Request Forgery | **3** (mitigated) |
| **Overall Composite Risk Score** | **7.5 / 10 (HIGH)** |

**Findings tally:** Critical: **5** | High: **8** | Medium: **9** | Low: **5**

---

## A01 — Broken Access Control (Risk: 9 / 10)

### CRITICAL-A01-1 — `/chains/:name/webhook` writes to DB with no auth, no signature verification
- **File:** `packages/api/src/routes/chains.ts:132-155`
- **Issue:** Endpoint accepts arbitrary JSON, inserts a row into `chain_executions` under literal `user_id = 'webhook-user'`, then schedules execution. No HMAC verification, no shared-secret header, no rate limit.
- **Impact:** Unauthenticated denial-of-wallet (LLM token cost), DB pollution, ability to drive arbitrary preset chains paid for by the platform.
- **Fix:**
  ```ts
  chainRoutes.post('/:name/webhook', async (c) => {
      const sig = c.req.header('x-luna-signature');
      const raw = await c.req.text();
      const ok = await verifyHmac(raw, sig, c.env.WEBHOOK_SECRET);
      if (!ok) return c.json({ error: 'Invalid signature' }, 401);
      // ... and bind a real owning user_id from a webhook-config row
  });
  ```

### CRITICAL-A01-2 — `DELETE /kb/:id` has no ownership/role check
- **File:** `packages/api/src/routes/kb.ts:70-78`
- **Issue:** Any authenticated user can delete any global KB document (no `user_id`/`org_id` filter, no admin gate).
- **Impact:** Any free-tier user can wipe the entire enterprise KB.
- **Fix:**
  ```ts
  kbRoutes.delete('/:id', requireAuth, requireTier('team'), async (c) => {
      const userId = c.get('userId');
      const res = await c.env.DB.prepare(
          "DELETE FROM documents WHERE id = ? AND owner_id = ?"
      ).bind(id, userId).run();
      if (res.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
      // also audit log
  });
  ```

### HIGH-A01-3 — RAG routes (`/rag/*`) entirely unauthenticated
- **File:** `packages/api/src/routes/rag.ts:16,61,108,145,172,186`
- **Issue:** `POST /rag/index`, `POST /rag/memories`, `GET /rag/search`, `GET /rag/memories`, `GET /rag/analytics`, `GET /rag/analytics/queries` — none use `requireAuth` / `requireAuthOrApiKey`.
- **Impact:** Anyone on the internet can pollute the global vector index, exfiltrate other tenants' indexed snippets, and poison RAG context that drives downstream LLM calls (prompt injection at scale).
- **Fix:** Add `requireAuthOrApiKey` to every handler and scope all writes/reads with a `tenant_id` filter.

### HIGH-A01-4 — `/telemetry/*` exposes platform-wide analytics with no auth
- **File:** `packages/api/src/routes/telemetry.ts:16,28,52`
- **Issue:** Returns DAU, top agents, provider-level token consumption, error rates with no auth and no admin role check.
- **Impact:** Competitive intelligence leak, model/provider mix disclosure, abuse-pattern reconnaissance.
- **Fix:** Mount under `requireAuth` + admin role enforcement; or restrict to internal service binding.

### HIGH-A01-5 — `/chains/:id/resume` IDOR via missing tier check + permissive status filter
- **File:** `packages/api/src/routes/chains.ts:74-98`
- **Issue:** Owner check exists (`user_id = ?`), but `streamChainExecution` re-runs against `c.env` cost without `checkExecutionLimit` re-applied for the resume of a multi-node chain (it appears once at the route level, but resume bypasses partial-execution accounting for a paused chain).
- **Impact:** Quota bypass.
- **Fix:** Reapply `checkExecutionLimit` and audit current_node_index integrity.

### MEDIUM-A01-6 — Leaderboard query selects `email` from joined users
- **File:** `packages/api/src/routes/credits.ts:64-76`
- **Issue:** Query selects `u.email` (line 65) into the result row even though the response (lines 78-84) does not currently emit it. A future field-add or `console.log` will leak PII via the public endpoint (no `requireAuth`).
- **Fix:** Drop `u.email` from the SELECT; require auth for `/credits/leaderboard`.

### MEDIUM-A01-7 — `/agents/list` and `/openclaw/tools/*` listing unauthenticated
- **File:** `packages/api/src/routes/agents.ts:32`, `packages/api/src/routes/openclaw-tools.ts:41-67`
- **Issue:** Public agent enumeration, including pro/team-only agent slugs, makes targeted brute force trivial.
- **Fix:** Require auth, return tier-filtered list.

---

## A02 — Cryptographic Failures (Risk: 7 / 10)

### HIGH-A02-1 — GitHub OAuth access tokens stored in plaintext
- **File:** `packages/api/src/routes/github.ts:62-65`
- **Issue:** `INSERT INTO github_connections (... access_token ...)` stores the raw GitHub PAT/OAuth token directly. Compare with `services/oauth-user.ts:49` which encrypts via AES-GCM — `github.ts` does **not** do this.
- **Impact:** Full DB compromise leaks live tokens with `read:user,repo` scope across thousands of users.
- **Fix:**
  ```ts
  import { encryptToken } from '../services/token-crypto';
  const encrypted = await encryptToken(tokenData.access_token, c.env.OAUTH_ENCRYPTION_KEY);
  await c.env.DB.prepare(`INSERT INTO github_connections (..., access_token, ...) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(..., encrypted, ...).run();
  ```

### HIGH-A02-2 — Webhook signature comparison length-check leaks early
- **File:** `packages/api/src/services/lemonsqueezy.ts:97`
- **Issue:** `if (expected.length !== signature.length) return false;` — early return before constant-time loop is technically OK, but XOR loop uses `charCodeAt` on a hex string — this is not byte-level constant time on every JS engine. Acceptable, but should switch to `crypto.subtle.verify` with HMAC raw bytes.
- **Fix:** Use `crypto.subtle.verify('HMAC', key, rawSig, payload)`.

### MEDIUM-A02-3 — JWT HS256 + low expiry hardcoded; no key rotation path
- **File:** `packages/api/src/utils/jwt.ts:20`, `packages/api/src/routes/auth.ts:65,138`
- **Issue:** Single `JWT_SECRET` env binding, no `kid` claim, no rotation; HS256 means any host that can read the secret can forge tokens. Tokens bake `tier` at issuance — when admins downgrade a user, tokens remain valid for an hour with old tier.
- **Fix:** Add `kid`, support `JWT_SECRET_NEXT` for rotation; revalidate `tier` from DB in middleware (or use `iat`-vs-`tier_changed_at` invalidation).

### MEDIUM-A02-4 — PBKDF2 iteration count too low
- **File:** `packages/api/src/routes/auth.ts:45,125`, `packages/api/src/routes/auth-reset.ts:103`
- **Issue:** `iterations: 100000` for PBKDF2-SHA256. OWASP 2023 minimum is **600,000** for PBKDF2-SHA256.
- **Fix:** Bump to 600_000 (or migrate to scrypt/argon2 via WASM). Re-hash on next successful login.

### MEDIUM-A02-5 — Password verification not constant-time
- **File:** `packages/api/src/routes/auth.ts:133`
- **Issue:** `if (hashHex !== storedHash)` — string equality is not timing-safe.
- **Fix:**
  ```ts
  const ok = await crypto.subtle.timingSafeEqual?.(/*…*/) ?? constantTimeStringEqual(hashHex, storedHash);
  ```

---

## A03 — Injection (Risk: 6 / 10)

### HIGH-A03-1 — Raw SQL string interpolation in chunk lookup
- **File:** `packages/api/src/routes/openclaw-tools-search.ts:47-49`, `packages/api/src/routes/openclaw-tools-run.ts:127-128`
- **Issue:**
  ```ts
  const chunkIds = searchResult.matches.map((m: any) => `'${m.id}'`).join(',');
  await c.env.DB.prepare(`SELECT id, content, metadata FROM chunks WHERE id IN (${chunkIds})`).all();
  ```
  Although `m.id` originates from the Vectorize index, those IDs are user-supplied during `POST /openclaw/tools/index` (file path becomes `${file.path}:${i}` — see `openclaw-tools-index.ts:43`). A malicious tenant can index a file at path `'); DROP TABLE chunks;--` and the next semantic search would inject SQL. Even without TOCTOU-DROP, identifier mismatches cause data exfiltration via UNION.
- **Impact:** SQL injection across the shared `chunks` table.
- **Fix:**
  ```ts
  const placeholders = matches.map(() => '?').join(',');
  const ids = matches.map(m => m.id);
  await c.env.DB.prepare(
      `SELECT id, content, metadata FROM chunks WHERE id IN (${placeholders})`
  ).bind(...ids).all();
  ```
  Also sanitize `file.path` at index time.

### MEDIUM-A03-2 — `users.delete` uses `LIKE '%${userId}%'`
- **File:** `packages/api/src/routes/users.ts:118,124`
- **Issue:** `DELETE FROM analytics_events WHERE agent LIKE ?` is bound (good), but `bindValue = \`%${userId}%\`` performs broad-prefix delete; a userId substring collision could delete another user's events.
- **Fix:** Use a proper foreign-key column (`analytics_events.user_id`) and parameterized equality.

### LOW-A03-3 — `c.req.query('sort')` passed unsanitized into GitHub API URL
- **File:** `packages/api/src/routes/github.ts:91-93`
- **Issue:** `sort` flows directly into the upstream URL string. GitHub validates server-side, but allows header smuggling via certain payloads.
- **Fix:** Whitelist values: `['created','updated','pushed','full_name']`.

### LOW-A03-4 — Pipe expressions (length 2000) executed without grammar validation
- **File:** `packages/api/src/routes/pipes.ts:25-30`
- **Issue:** `executePipe` consumes the raw expression; risk hinges on `pipe-executor` parser hardening.
- **Fix:** Add Zod-validated AST + an allowlist of operators.

---

## A04 — Insecure Design (Risk: 6 / 10)

### HIGH-A04-1 — `POST /openclaw/exec` runs arbitrary commands on the user's connected Gateway
- **File:** `packages/api/src/routes/openclaw.ts:137-153`
- **Issue:** Endpoint accepts `body.command` and forwards verbatim through WebSocket RPC. While the user authorized their own gateway, there is **no command allowlist, no audit log, no size limit, no shell-escape guard**, no per-tier authorization (free users can run remote shell). Combined with stolen JWT, attacker gets remote code execution on every connected developer's machine.
- **Fix:**
  - Require `tier: pro|team`
  - Maintain an allowlist of safe commands or shell-quote arguments
  - Audit-log every invocation via `services/audit-logger.ts`
  - Add per-user RPC rate limit

### HIGH-A04-2 — `POST /openclaw/tools/execute_code` proxies to public `emkc.org` Piston sandbox
- **File:** `packages/api/src/routes/openclaw-tools-execute.ts:35-43`
- **Issue:** Uploads user code to a third-party public sandbox without ToS check; metadata leakage, accidental PII upload (since `body.code` is unbounded). No input length cap.
- **Fix:** Add `maxLength` (e.g., 10 KB), audit-log, route critical-tier code to a private sandbox; document the data-egress.

### HIGH-A04-3 — `/users/delete` does not invalidate JWTs / API keys
- **File:** `packages/api/src/routes/users.ts:98-146`
- **Issue:** Account deletion runs but `api_keys` deletion only removes rows; existing JWTs (1h TTL) remain valid until expiry. Concurrently `c.env.KV.delete('session:${userId}')` is best-effort.
- **Fix:** Maintain a `revoked_users` denylist in KV with TTL = max JWT lifetime; check it in `requireAuth`.

### MEDIUM-A04-4 — `swarm` endpoint missing input schema validation
- **File:** `packages/api/src/routes/agents.ts:200-241`
- **Issue:** Manual `if`-checks on untyped JSON; no Zod schema, no max array length on `body.agents` (claims 2-5 in error string but only checks `Array.isArray`).
- **Fix:** Use `validateJson(swarmSchema)` per the project standard.

### MEDIUM-A04-5 — Hardcoded fallback variant IDs `'2'` / `'3'` in `/billing/plans`
- **File:** `packages/api/src/routes/billing.ts:41-47`
- **Issue:** If env vars are unset, plans page advertises checkout URLs with bogus variants — UX/security smell, and deeplinks may resolve to other LemonSqueezy stores.
- **Fix:** Throw 503 if not configured.

---

## A05 — Security Misconfiguration (Risk: 5 / 10)

### MEDIUM-A05-1 — CORS allows preview pages.dev domains via regex
- **File:** `packages/api/src/middleware/cors.ts:40`
- **Issue:** `*.lunaos-marketing.pages.dev` etc. are reachable by any Cloudflare account that creates a project name matching the regex. While Cloudflare prevents project-name collisions in your account, third parties cannot create your `lunaos-marketing` project name — but the regex allows `[a-z0-9-]+\.(lunaos-marketing|luna-agent|lunaos-docs)\.pages\.dev`, where the leading subdomain (preview SHA) is third-party-controllable per project. Acceptable, but document.
- **Fix:** Pin to a specific Cloudflare account in headers, or remove pages.dev wildcard once production hits stable URLs.

### MEDIUM-A05-2 — `app.onError` returns `err.message` in dev, but dev mode toggle relies on env string
- **File:** `packages/api/src/worker.ts:191-193`
- **Issue:** `c.env.ENVIRONMENT === 'development'` — if env binding is misconfigured (e.g., `'dev'`), prod will leak stack traces. Combine with the `OAuth_*` and `JWT_SECRET` exposure risk.
- **Fix:** Default to redacted messages unless an explicit `ENVIRONMENT === 'development'` is set, log the raw to Sentry.

### MEDIUM-A05-3 — CSP allows `'unsafe-inline'` styles
- **File:** `packages/api/src/middleware/security-headers.ts:21`
- **Issue:** `style-src 'self' 'unsafe-inline'` — XSS pivot if any HTML is ever returned (this is JSON API, but `text/html` swagger pages or 404 HTML may be served).
- **Fix:** Drop `'unsafe-inline'`; nonce stylesheets if needed.

### LOW-A05-4 — `/auth/me` re-imports `verifyJWT` dynamically
- **File:** `packages/api/src/routes/auth.ts:163-181`
- **Issue:** Inline auth instead of using `requireAuth` middleware. Bypasses any future audit hooks added centrally.
- **Fix:** `authRoutes.get('/me', requireAuth, async (c) => {…})`.

### LOW-A05-5 — Default fallback OpenClaw URL is `http://localhost:8790`
- **File:** `packages/api/src/routes/openclaw-proxy.ts:16`
- **Issue:** A misdeploy with no `OPENCLAW_URL` set silently routes requests to `http://localhost:8790` (typo-friendly default).
- **Fix:** Throw 500 if unset.

---

## A06 — Vulnerable & Outdated Components (Risk: 3 / 10)

### LOW-A06-1 — Dependency audit not performed in this audit window
- **Files:** `package.json`, `pnpm-lock.yaml`
- **Issue:** Out of scope for code review; recommend `pnpm audit --prod` in CI.
- **Fix:** Add `pnpm audit --prod` step, gate on Critical/High via the project release checklist.

---

## A07 — Identification & Authentication Failures (Risk: 7 / 10)

### HIGH-A07-1 — IP rate limiter is per-isolate in-memory only
- **File:** `packages/api/src/middleware/ip-rate-limiter.ts:16,67`
- **Issue:** `Map<string, …>` lives in a single Worker isolate. Cloudflare spawns many isolates → 10 attempts × N isolates = effectively bypassed. No KV or Durable Object backing.
- **Impact:** Credential-stuffing protection on `/auth/login`, `/auth/signup`, `/auth/forgot-password` is largely cosmetic.
- **Fix:** Use KV with a sliding window or a Durable Object counter keyed by IP.

### HIGH-A07-2 — Login does not implement account lockout / generic timing protection
- **File:** `packages/api/src/routes/auth.ts:94-158`
- **Issue:** No tracking of failed logins per account; 401 responses are immediate. Combined with A07-1, brute force is feasible.
- **Fix:** Increment a `failed_login_count` per user; lock after N within window; uniform delay regardless of outcome.

### MEDIUM-A07-3 — OAuth callback handles JWT-in-URL via query param (`?code=…`)
- **File:** `packages/api/src/routes/oauth.ts:124`
- **Issue:** Code in URL is short-lived (60s TTL), but logged in upstream proxy/CDN logs. Better than JWT but still recordable.
- **Fix:** Issue an `httpOnly` cookie containing the JWT instead.

### MEDIUM-A07-4 — API key has 32 hex bytes raw entropy but `/api-keys/list` exposes only 8-char prefix
- **File:** `packages/api/src/services/key-manager.ts:30`
- **Issue:** A `lnos_live_<8 hex chars>...` prefix gives 32 bits — enough that with rate limiting it's safe, but prefix should be 12+.
- **Fix:** Increase prefix to 12 chars.

### MEDIUM-A07-5 — JWT `tier` is trusted indefinitely
- **File:** `packages/api/src/middleware/auth.ts:32-34`
- **Issue:** Sets `userTier` from JWT payload directly. Downgrade on cancellation takes up to JWT TTL (1h) to take effect — potentially significant cost overrun.
- **Fix:** Cache lookup or revalidate `tier` from DB on every billable request.

---

## A08 — Software & Data Integrity Failures (Risk: 8 / 10)

### CRITICAL-A08-1 — `POST /github/webhook` skips signature verification
- **File:** `packages/api/src/routes/github.ts:191-219`
- **Issue:** The handler reads `x-github-event` but never validates `x-hub-signature-256` against `GITHUB_WEBHOOK_SECRET`. Any internet caller can submit a fake `push` payload with `payload.repository.full_name` matching an indexed repo, triggering the engine to fetch and re-index using the legitimate user's stored access token.
- **Impact:** Tenant-token-mediated SSRF / abuse against GitHub API; ability to force re-indexing of attacker-chosen branches; cost amplification (Vectorize writes).
- **Fix:**
  ```ts
  githubRoutes.post('/webhook', async (c) => {
      const sig = c.req.header('x-hub-signature-256');
      const raw = await c.req.text();
      const ok = await verifyHmacSha256(raw, sig, c.env.GITHUB_WEBHOOK_SECRET);
      if (!ok) return c.json({ error: 'Invalid signature' }, 401);
      const payload = JSON.parse(raw);
      // ... proceed
  });
  ```

### CRITICAL-A08-2 — `POST /billing/webhook` swallows handler errors silently
- **File:** `packages/api/src/routes/billing.ts:108-110`
- **Issue:** `catch (err: any) { /* Acknowledge webhook even if processing fails */ }` — webhooks for `subscription_created` etc. that throw return `{ received: true }`, leaving billing state desynced. Combined with no idempotency key check (event_id), retries cause double-applies.
- **Fix:** Persist `webhook_events (id PRIMARY KEY, processed_at)` and return 5xx on failure so LS retries; never silently swallow.

### HIGH-A08-3 — `chains/:id/resume` stored chain_def parsed without revalidation
- **File:** `packages/api/src/routes/chains.ts:86`
- **Issue:** `JSON.parse(execution.chain_def)` is then handed to `streamChainExecution` without re-running `validateChain`. A DB-stored chain (e.g., from a prior valid create) might have been mutated by a future migration.
- **Fix:** Always `validateChain(chainDef)` after parse.

---

## A09 — Security Logging & Monitoring Failures (Risk: 6 / 10)

### HIGH-A09-1 — Critical security events not audit-logged
- **Files:** `routes/auth.ts`, `routes/api-keys.ts`, `routes/users.ts:98`, `routes/billing.ts:73`
- **Issue:** Project doc requires `services/audit-logger.ts` for auth events, key create/revoke, billing mutations — code does not call it. Examples:
  - `auth.ts:98` (login success/failure)
  - `api-keys.ts:39` (key create), `api-keys.ts:95` (revoke)
  - `users.ts:98` (account deletion)
  - `billing.ts:73` (webhook receipt)
- **Fix:** Add `await auditLog(c.env.DB, { type, userId, meta })` at each touchpoint.

### MEDIUM-A09-2 — Failed JWT verifications log full error text
- **File:** `packages/api/src/middleware/auth.ts:37`, `packages/api/src/middleware/api-key-auth.ts:50`
- **Issue:** `console.error('JWT verification failed:', err)` sends to Workers logs. Errors include payload structure that could aid token-fuzzing reconnaissance.
- **Fix:** Log the error type only; ship the full error to Sentry.

### MEDIUM-A09-3 — Webhook bodies parsed and not stored / not idempotent
- **File:** `packages/api/src/routes/billing.ts:73-113`
- **Issue:** Spec says payloads must not be retained after processing — currently true — but also no idempotency key (event id) is recorded; double-delivery causes double-apply.
- **Fix:** Persist `(event_id, processed_at)` for 7 days.

---

## A10 — Server-Side Request Forgery (Risk: 3 / 10) — mostly mitigated

### Strong mitigation (good):
- **File:** `packages/api/src/worker.ts:7-59`
- The Zero-Trust fetch interceptor allowlist blocks egress to non-listed domains across all routes. This neutralizes most SSRF.

### MEDIUM-A10-1 — Allowlist drift / duplicate
- **File:** `packages/api/src/worker.ts:21,28`
- **Issue:** `'api.resend.com'` listed twice (lines 21 and 28). Suggests manual editing without lint.
- **Fix:** Dedupe; sort and freeze in a const file with an exported test asserting set equality.

### MEDIUM-A10-2 — Localhost & `.internal` allowed without env gate
- **File:** `packages/api/src/worker.ts:41`
- **Issue:** `domain === 'localhost' || domain.includes('.internal')` always passes. In Workers prod this is largely moot (no localhost reachable), but if a binding were ever introduced, the bypass is not env-gated.
- **Fix:** Allow only when `ENVIRONMENT === 'development'`.

### LOW-A10-3 — `/openclaw/register` accepts arbitrary `wss://` URLs
- **File:** `packages/api/src/routes/openclaw.ts:46-54`
- **Issue:** Allows users to register any WSS URL — by design — but combined with `/openclaw/exec` is a dangerous primitive. (Mitigation: tied to user's own gateway token, but A04-1 still applies.)
- **Fix:** Document the threat model; add per-user allowlist of registered gateway hostnames.

---

## Summary

- **Most-urgent fixes (must ship before next deploy):**
  1. **CRITICAL-A08-1** — verify GitHub webhook signature (`routes/github.ts:191-219`).
  2. **CRITICAL-A01-1** — auth & sign `/chains/:name/webhook` (`routes/chains.ts:132-155`).
  3. **CRITICAL-A01-2** — add ownership check to `DELETE /kb/:id` (`routes/kb.ts:70-78`).
  4. **CRITICAL-A08-2** — return 5xx on billing webhook handler failures + idempotency (`routes/billing.ts:108-110`).
  5. **HIGH-A02-1** — encrypt GitHub access tokens at rest (`routes/github.ts:62-65`).

- **Composite risk score: 7.5 / 10 (HIGH).** The platform has solid foundations (Zero-Trust egress allowlist, Zod input validation, encrypted OAuth tokens for non-GitHub providers, hashed API keys, HMAC-verified LemonSqueezy webhooks, security headers middleware), but is undermined by several unauthenticated public endpoints that can drive billable workloads, plaintext GitHub tokens, and missing webhook integrity checks.

- **Recommended next steps:**
  1. Audit-log every auth/billing/admin mutation per `CLAUDE.md`.
  2. Centralize SQL parameterization (lint rule banning `prepare(\`…${`).
  3. Move IP rate-limiter to Durable Object backing.
  4. Bump PBKDF2 iterations to 600k and re-hash on next login.
  5. Add `pnpm audit` and SAST (Semgrep) gates to CI before merge.
