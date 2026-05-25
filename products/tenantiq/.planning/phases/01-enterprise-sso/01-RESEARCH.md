# Phase 1: Enterprise SSO — Research

**Researched:** 2026-04-22
**Domain:** SAML 2.0 / OIDC authentication on Cloudflare Workers + Hono
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SSO-01 | Org admin can configure a SAML 2.0 IdP (Okta, Entra) per org via the Settings UI | `sso_connections` table + CRUD routes already exist; settings UI SSO tab is missing |
| SSO-02 | Org admin can configure an OIDC IdP per org via the Settings UI | Same CRUD layer covers OIDC; `provider` column accepts `'oidc'` |
| SSO-03 | User can sign in via their org's configured SSO provider (SAML or OIDC) | Requires `sso-login.ts` + `sso-callback.ts` — neither exists yet |
| SSO-04 | First-time SSO user is automatically provisioned (JIT) with correct role and org membership | Requires `sso-jit.ts`; `platform_users.auth_provider` column exists; unique index on `(organization_id, email)` must be verified before launch |
| SSO-05 | Platform alerts org admin when IdP signing cert expires within 60/30/7 days | Daily cron reads `sso_connections.certificate` or re-fetches `metadata_url`; diff against `Date.now()` |
| SSO-06 | SSO login flow uses CSRF-protected state parameter (nonce stored in KV with 300s TTL) | Pattern mirrors existing `auth:state:{state}` KV nonce in `auth-callback.ts`; use `sso:state:{nonce}` key prefix |

</phase_requirements>

---

## Summary

Phase 1 is a **backend-heavy** phase. The data layer (D1 `sso_connections` table) and the CRUD management API (`GET/POST/PATCH/DELETE /api/sso`) are complete and fully tested. What is missing is the authentication flow itself: the initiation endpoint that redirects users to their IdP, the callback endpoints that validate SAML assertions and OIDC tokens, the JIT provisioning logic that creates accounts on first login, and the cert-expiry cron that prevents lockouts.

The existing codebase provides a strong foundation: `jose` (already installed) handles all OIDC JWT verification via `createRemoteJWKSet` + `jwtVerify`. The `signToken()` + `sessionCookieValue()` helpers in `auth-session.ts` are the exact session bridge needed after assertion validation — new SSO flow reuses them directly. The CSRF nonce pattern in `auth-callback.ts` (`auth:state:{state}` KV key) is the template for the SSO `sso:state:{nonce}` pattern required by SSO-06.

SAML XML parsing on Workers is the one area requiring care. `@xmldom/xmldom` + `xml-crypto` are Workers-compatible (pure JS) but must be validated under `wrangler dev` before committing. Per STATE.md, the team decision is WorkOS SDK for MVP because it eliminates the XML parsing risk entirely, at the cost of $125/connection/month (acceptable for the first 10-15 enterprise orgs).

**Primary recommendation:** Use WorkOS SDK (`@workos-inc/node-sdk`) for Phase 1. It is edge-compatible (fetch-based), eliminates the `samlify` CVE surface and XML parsing complexity, and reduces implementation to OAuth 2.0 token exchange that `jose` already handles. Re-evaluate self-hosted before scaling past 15 enterprise orgs.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@workos-inc/node-sdk` | `^7.x` | Managed SAML + OIDC broker | Edge-compatible (fetch-based); no XML parsing; handles cert rotation; $125/connection |
| `jose` | `^5.x` (already installed) | OIDC JWT verification + JWKS + session signing | Already used for HS256/RS256 session tokens; `createRemoteJWKSet` is Workers-native |

### Supporting (self-hosted SAML path — only if WorkOS is rejected)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@xmldom/xmldom` | `^0.8.x` | Pure-JS XML DOM parser | Required if parsing SAML XML on Workers without WorkOS |
| `xml-crypto` | `^3.x` | XML signature verification | Required peer of any raw SAML path; uses SubtleCrypto in v3 |
| `samlify` | `>=2.10.0` ONLY | SAML 2.0 SP/IdP library | **Never use <2.10.0** — CVE-2025-47949 CVSS 9.9 auth bypass |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WorkOS SDK | BoxyHQ/Ory SAML Jackson | Jackson is a Docker service, not an edge library — wrong for Workers |
| WorkOS SDK | `samlify` >=2.10.0 | Workers compat unconfirmed; XML parsing risk; CVE history |
| WorkOS SDK | Auth0 / Okta Workforce | 3-10x more expensive at enterprise tier |

**Installation (WorkOS path):**
```bash
pnpm add @workos-inc/node-sdk --filter api
# jose already installed — no additional install for OIDC
```

**Installation (self-hosted SAML fallback — validate in wrangler dev first):**
```bash
# WARNING: pin to >=2.10.0 — CVE-2025-47949 is critical
pnpm add samlify@">=2.10.0" @xmldom/xmldom --filter api
```

---

## Architecture Patterns

### Existing Infrastructure (What Already Exists)

```
apps/api/src/routes/
├── sso.ts               # CRUD — GET/POST/PATCH/DELETE /api/sso  [COMPLETE]
├── sso-handlers.ts      # update + test handlers                  [COMPLETE]
├── sso-schemas.ts       # Zod schemas for CRUD                    [COMPLETE]
├── sso.test.ts          # 11 tests covering CRUD paths            [COMPLETE]
├── auth-session.ts      # signToken(), sessionCookieValue()       [COMPLETE]
└── auth-callback.ts     # KV nonce pattern (auth:state:{state})   [COMPLETE]

packages/db/src/schema-d1.ts
└── ssoConnections table: id, org_id, provider, display_name,
    domain, issuer_url, client_id, metadata_url, certificate,
    status, jit_enabled, created_at, updated_at              [COMPLETE]

platform_users table: id, organization_id, email, display_name,
    role, auth_provider, scope_level, last_login_at           [COMPLETE]
    — unique index: idx_platform_users_email ON (email) alone
    — WARNING: unique index is on email only, not (org_id, email)
    — this is a JIT race condition risk (see Pitfalls)
```

### New Files Required (Phase 1)

```
apps/api/src/routes/
├── sso-login.ts         # NEW: GET /api/sso/login/:domain → redirect to IdP
├── sso-callback.ts      # NEW: POST /api/sso/callback/saml + GET /api/sso/callback/oidc
└── sso-jit.ts           # NEW: JIT provisioning + session issuance

apps/api/src/cron/
└── sso-cert-monitor.ts  # NEW: daily cert expiry check + alert (SSO-05)

apps/web/src/routes/settings/
└── +page.svelte         # MODIFY: add SSO tab (SSO connections CRUD UI)
```

### Pattern 1: SSO Login Initiation

**What:** Domain lookup → build IdP redirect URL → store CSRF nonce in KV
**When to use:** `GET /api/sso/login/:domain` — no auth cookie required (public endpoint)

```typescript
// sso-login.ts
// Source: mirrors auth-callback.ts auth:state:{state} KV pattern
export async function handleSsoLogin(c: Context<AppEnv>) {
  const domain = c.req.param('domain');
  const conn = await c.env.DB.prepare(
    "SELECT * FROM sso_connections WHERE domain = ? AND status = 'active'"
  ).bind(domain).first<SsoConnection>();
  if (!conn) return c.json({ error: 'SSO not configured for this domain' }, 404);

  const nonce = crypto.randomUUID();
  await c.env.KV.put(
    `sso:state:${nonce}`,
    JSON.stringify({ orgId: conn.org_id, domain, connId: conn.id }),
    { expirationTtl: 300 }  // SSO-06: 300s TTL
  );

  if (conn.provider === 'saml') {
    // Build SAML AuthnRequest and redirect to IdP SSO URL
    // WorkOS path: use workos.sso.getAuthorizationUrl()
  } else {
    // OIDC: redirect to authorization_endpoint with state=nonce
    const authUrl = buildOidcAuthUrl(conn, nonce);
    return c.redirect(authUrl);
  }
}
```

### Pattern 2: OIDC Callback (Workers-native with jose)

**What:** Code exchange → id_token verification → JIT → session cookie
**When to use:** `GET /api/sso/callback/oidc?code=...&state=...`

```typescript
// sso-callback.ts (OIDC branch)
// Source: auth-session.ts signToken() + sessionCookieValue()
import { createRemoteJWKSet, jwtVerify } from 'jose';

const stateRaw = await c.env.KV.get(`sso:state:${returnedState}`);
if (!stateRaw) return c.json({ error: 'invalid or expired state' }, 400);
await c.env.KV.delete(`sso:state:${returnedState}`);  // one-time use

// Exchange code for tokens
const tokenRes = await fetch(conn.token_endpoint, {
  method: 'POST',
  body: new URLSearchParams({ grant_type: 'authorization_code', code, ... }),
});
const { id_token } = await tokenRes.json();

// Verify with JWKS (jose — Workers-native)
const JWKS = createRemoteJWKSet(new URL(`${conn.issuer_url}/.well-known/jwks.json`));
const { payload } = await jwtVerify(id_token, JWKS, {
  issuer: conn.issuer_url,
  audience: conn.client_id,
});

// JIT + session
const userId = await jitProvision(c.env.DB, conn.org_id, payload.email, payload.name);
const jwt = await signToken(c.env, { sub: userId, email: payload.email, orgId: conn.org_id, role: 'member' });
c.header('Set-Cookie', sessionCookieValue(c, jwt, 86400));
return c.redirect(`${c.env.FRONTEND_URL}/`);
```

### Pattern 3: SAML Callback (WorkOS path)

**What:** WorkOS validates assertion, returns profile — then same JIT + session bridge
**When to use:** `POST /api/sso/callback/saml` with WorkOS

```typescript
// sso-callback.ts (SAML/WorkOS branch)
import { WorkOS } from '@workos-inc/node-sdk';
const workos = new WorkOS(c.env.WORKOS_API_KEY);

// WorkOS exchanges the SAML code for a profile
const { profile } = await workos.sso.getProfileAndToken({ code });

const userId = await jitProvision(c.env.DB, orgId, profile.email, profile.firstName);
const jwt = await signToken(c.env, { sub: userId, email: profile.email, orgId, role: 'member' });
c.header('Set-Cookie', sessionCookieValue(c, jwt, 86400));
return c.redirect(`${c.env.FRONTEND_URL}/`);
```

### Pattern 4: JIT Provisioning (sso-jit.ts)

**What:** Upsert `platform_users` row on first SSO login
**When to use:** Called from both SAML and OIDC callback handlers

```typescript
// sso-jit.ts
// Source: ARCHITECTURE.md + platform_users schema inspection
export async function jitProvision(
  db: D1Database, orgId: string, email: string,
  name: string | null, role = 'member'
): Promise<string> {
  const existing = await db.prepare(
    'SELECT id FROM platform_users WHERE email = ? AND organization_id = ?'
  ).bind(email, orgId).first<{ id: string }>();
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  // Use INSERT OR IGNORE to be safe against race — unique index protects
  await db.prepare(`
    INSERT OR IGNORE INTO platform_users
      (id, organization_id, email, display_name, role, auth_provider, scope_level, created_at)
    VALUES (?, ?, ?, ?, ?, 'sso', 'admin', ?)
  `).bind(id, orgId, email, name ?? email, role, Date.now()).run();

  // Re-fetch in case OR IGNORE fired (concurrent insert)
  const row = await db.prepare(
    'SELECT id FROM platform_users WHERE email = ? AND organization_id = ?'
  ).bind(email, orgId).first<{ id: string }>();
  return row!.id;
}
```

### Pattern 5: Cert Expiry Cron (SSO-05)

**What:** Daily scan of all active `sso_connections` — check X.509 `validUntil`, alert at 60/30/7 days
**When to use:** `sso-cert-monitor.ts` cron handler

```typescript
// sso-cert-monitor.ts
// Source: PITFALLS.md Pitfall 2 + existing cron pattern in apps/api/src/cron/
export async function runSsoCertMonitor(env: Env) {
  const conns = await env.DB.prepare(
    "SELECT id, org_id, certificate, metadata_url FROM sso_connections WHERE status = 'active'"
  ).all<SsoConn>();

  for (const conn of conns.results) {
    let cert = conn.certificate;
    // Re-fetch metadata to get current cert (catches rotation)
    if (conn.metadata_url) {
      cert = await fetchCertFromMetadata(conn.metadata_url, env.KV);
    }
    if (!cert) continue;
    const expiresAt = parseCertExpiry(cert); // extract notAfter from X.509 PEM
    const daysLeft = Math.floor((expiresAt - Date.now()) / 86_400_000);
    if ([60, 30, 7].some(threshold => daysLeft <= threshold && daysLeft > threshold - 1)) {
      await createCertExpiryAlert(env.DB, conn.org_id, conn.id, daysLeft);
    }
  }
}
```

### Anti-Patterns to Avoid

- **SAML without CSRF state:** Never accept a SAML assertion without first verifying the `RelayState` nonce from KV. Same attack surface as OIDC login CSRF.
- **Storing cert blob only:** Always store `metadata_url` alongside the certificate. Re-fetch metadata in the cert-monitor cron to detect IdP-side rotation.
- **Plain `INSERT` in JIT:** Must use `INSERT OR IGNORE` + re-fetch, not a plain INSERT. Two concurrent SAML assertions for the same new user will race.
- **Querying `sso_connections` without `AND status = 'active'`:** Inactive connections must not be usable for login, even if the domain matches.
- **`sso-login.ts` behind `authMiddleware`:** The login initiation endpoint is public (user is not authenticated yet). Rate-limiting must be applied but not auth middleware.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SAML XML parsing + signature verification | Custom XML parser + SubtleCrypto signature check | WorkOS SDK or `samlify` >=2.10.0 | XML signature wrapping attacks (CVE-2025-47949), canonicalization edge cases |
| JWKS key rotation for OIDC | Periodic KV-backed JWKS cache | `jose.createRemoteJWKSet()` | Handles cache misses, key rotation, and RS256/ES256 automatically |
| IdP metadata URL SSRF prevention | Manual allowlist checking | Use existing `sso-handlers.ts` SSRF protection | Already implemented for the CRUD layer |
| X.509 cert parsing | Custom PEM/DER parser | Use `crypto.subtle.importKey` + `jose` cert utilities | SubtleCrypto parses X.509 natively on Workers |

**Key insight:** SAML security has a decades-long history of signature wrapping and XML canonicalization vulnerabilities. Do not build custom XML security logic. WorkOS offloads this entirely for Phase 1.

---

## Common Pitfalls

### Pitfall 1: JIT Race Condition — Duplicate Platform Users
**What goes wrong:** Two concurrent SAML assertions for a new user trigger two `INSERT` statements. D1 runs them in parallel across two Worker isolates.
**Why it happens:** Existing `idx_platform_users_email` unique index is on `email` alone (not `(organization_id, email)`). This means the index protects globally but the application assumes per-org uniqueness.
**How to avoid:** Use `INSERT OR IGNORE` in `jitProvision()` (Pattern 4 above). Always re-fetch after insert to get the authoritative ID. Add test that fires 5 concurrent JIT calls for same email+org.
**Warning signs:** User row count exceeds expected headcount after SSO rollout; duplicate entries in audit log.

### Pitfall 2: SAML IdP Cert Expiry → Total SSO Lockout
**What goes wrong:** IdP rotates signing certificate (typical 1–3 year cycle). Stored cert in D1 becomes invalid. All SAML assertions fail signature verification. Entire org locked out.
**Why it happens:** Certificate stored as static blob at enrollment; no monitoring.
**How to avoid:** Implement `sso-cert-monitor.ts` (SSO-05) before any org enables SAML. Store `metadata_url` always. Alert at 60/30/7 days. Support dual-cert validation during transition window.
**Warning signs:** `SAML signature verification failed` errors starting on a specific date.

### Pitfall 3: Missing CSRF State Validation → Login CSRF
**What goes wrong:** Attacker crafts a SAML/OIDC callback URL that logs victim into attacker's account (session fixation).
**Why it happens:** `state` parameter is not validated against the KV-stored nonce.
**How to avoid:** Every callback handler must read `sso:state:{nonce}` from KV before processing. Return HTTP 400 if key is missing or expired. Delete key after first use (one-time nonce).
**Warning signs:** No test covering mismatched state returning 400.

### Pitfall 4: `sso-login.ts` Accidentally Behind `authMiddleware`
**What goes wrong:** The login initiation endpoint requires a valid session cookie, making SSO inaccessible to unauthenticated users.
**Why it happens:** Copy-paste from other route registrations that always apply `authMiddleware`.
**How to avoid:** Register `sso-login` and `sso-callback` routes WITHOUT `authMiddleware`. Apply only `rateLimitMiddleware`. Follow the `ssoRoutes.use('*', rateLimitMiddleware(...))` pattern from the existing `sso.ts` — but do NOT add `authMiddleware` to these new public routes.

### Pitfall 5: Workers-Incompatible samlify (if self-hosted)
**What goes wrong:** `samlify` or `xml-crypto` pulls in `node:crypto` or `node:buffer` APIs not available in the Workers runtime without `nodejs_compat` flag. Wrangler build fails or runtime throws.
**Why it happens:** Many XML/crypto libraries assume Node.js environment.
**How to avoid:** If WorkOS is not used, validate `samlify` >=2.10.0 under `wrangler dev` before writing any business logic. Add `compatibility_flags = ["nodejs_compat"]` to `wrangler.toml` only if needed and after verifying no side effects on other routes.

---

## Code Examples

### CSRF State Nonce Pattern (verified from auth-callback.ts)
```typescript
// On login initiation — store nonce in KV (300s TTL per SSO-06)
const nonce = crypto.randomUUID();
await c.env.KV.put(
  `sso:state:${nonce}`,
  JSON.stringify({ orgId: conn.org_id, domain, connId: conn.id }),
  { expirationTtl: 300 }
);

// On callback — validate and consume nonce
const stateParam = c.req.query('state');
if (!stateParam) return c.json({ error: 'missing state' }, 400);
const stored = await c.env.KV.get(`sso:state:${stateParam}`);
if (!stored) return c.json({ error: 'invalid or expired state' }, 400);
await c.env.KV.delete(`sso:state:${stateParam}`); // one-time use
const { orgId, connId } = JSON.parse(stored);
```

### Session Bridge (verified from auth-session.ts)
```typescript
// After JIT provisioning — issue session using existing helpers
import { signToken, sessionCookieValue } from './auth-session';

const jwt = await signToken(c.env, {
  sub: userId, email, orgId,
  tenantIds: [], role: 'member',
});
c.header('Set-Cookie', sessionCookieValue(c, jwt, 86_400));
return c.redirect(`${c.env.FRONTEND_URL}/`);
```

### OIDC Token Verification (jose — Workers-native)
```typescript
// Source: STACK.md + jose official Workers support
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL(`${conn.issuerUrl}/.well-known/jwks.json`));
const { payload } = await jwtVerify(idToken, JWKS, {
  issuer: conn.issuerUrl,
  audience: conn.clientId,
});
// payload.email, payload.name, payload.sub are now available
```

### X.509 Cert Expiry Parse (Workers SubtleCrypto)
```typescript
// Parse PEM cert and extract notAfter date
async function parseCertExpiry(pemCert: string): Promise<number> {
  const der = pemToDer(pemCert); // strip headers, base64-decode
  const cert = await crypto.subtle.importKey(
    'spki', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']
  );
  // SubtleCrypto does not expose notAfter directly; use a lightweight ASN.1 parser
  // Alternative: store expiry as a separate column when saving certificate
  return extractNotAfterFromDer(der); // pure-JS ASN.1 walk
}
```

### Test Harness Pattern (verified from sso.test.ts)
```typescript
// The existing sso.test.ts pattern — reuse for new route files
const mockEnv = {
  DB: { prepare: mockPrepare } as unknown,
  KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn(), delete: vi.fn() } as unknown,
  JWT_SECRET: 'test-jwt-secret-key-minimum-32-characters-long',
  ENVIRONMENT: 'test',
} as unknown;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `samlify` any version | `samlify` >=2.10.0 only | CVE-2025-47949 patched April 2025 | Versions <2.10.0 allow full auth bypass — never use |
| Node.js `crypto` for XML sig | `xml-crypto` 3.x via SubtleCrypto | xml-crypto v3.x | Workers-compatible without `nodejs_compat` |
| WorkOS v6.x | WorkOS v7.x | Late 2025 | API surface changes; use `^7.x` |
| Cookie `SameSite=Strict` | `SameSite=Lax` | Existing project standard | `Strict` breaks OAuth/SSO redirects from IdP; `Lax` is correct for cross-origin IdP callbacks |

**Deprecated/outdated:**
- `passport-saml` / `node-saml`: Heavy Node.js API surface, not Workers-compatible without full `nodejs_compat` shim — do not use.
- `openid-client` npm: Requires Node.js `http` module. Use `jose` directly on Workers instead.

---

## Open Questions

1. **WorkOS connection model vs per-org domain routing**
   - What we know: WorkOS issues a `connection_id` per org; TenantIQ routes by `domain` in `sso_connections`
   - What's unclear: How WorkOS connection IDs map to TenantIQ's `org_id` — the `sso_connections` table has no `workos_connection_id` column
   - Recommendation: Add `workos_connection_id` column to `sso_connections` during Wave 0 setup, or store in the existing `issuer_url` field. Confirm during WorkOS SDK integration spike.

2. **`idx_platform_users_email` unique constraint scope**
   - What we know: The D1 schema defines `uniqueIndex('idx_platform_users_email').on(table.email)` — unique on email globally, not per org
   - What's unclear: Does TenantIQ intend one email address across ALL orgs (global uniqueness), or per-org uniqueness? The JIT pattern in ARCHITECTURE.md queries `WHERE email = ? AND organization_id = ?`
   - Recommendation: Treat as global uniqueness for now (email IS the identity). The `INSERT OR IGNORE` pattern handles races. If multi-org user support is needed post-launch, revisit.

3. **Frontend SSO tab scope**
   - What we know: `apps/web/src/routes/settings/+page.svelte` exists and must be modified
   - What's unclear: Whether the settings page already has a tab structure that SSO slots into, or requires new tab UI
   - Recommendation: Read the settings page during Wave 0 planning; budget for a new `SsoSettingsTab.svelte` component under 200 lines.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x with `environment: 'node'` |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npx vitest run src/routes/sso-login.test.ts src/routes/sso-callback.test.ts src/routes/sso-jit.test.ts src/cron/sso-cert-monitor.test.ts` |
| Full suite command | `cd apps/api && npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SSO-01 | POST /api/sso with SAML provider persists connection | unit | `npx vitest run src/routes/sso.test.ts` | ✅ exists |
| SSO-02 | POST /api/sso with OIDC provider persists connection | unit | `npx vitest run src/routes/sso.test.ts` | ✅ exists |
| SSO-03 (OIDC) | GET /api/sso/login/:domain redirects to IdP; GET /api/sso/callback/oidc issues session cookie | unit | `npx vitest run src/routes/sso-login.test.ts src/routes/sso-callback.test.ts` | ❌ Wave 0 |
| SSO-03 (SAML) | GET /api/sso/login/:domain for SAML builds AuthnRequest; POST /api/sso/callback/saml validates assertion | unit | `npx vitest run src/routes/sso-callback.test.ts` | ❌ Wave 0 |
| SSO-04 | First OIDC/SAML login creates platform_users row with correct org+role | unit | `npx vitest run src/routes/sso-jit.test.ts` | ❌ Wave 0 |
| SSO-04 | Concurrent JIT calls for same email+org produce exactly one row | unit (concurrent) | `npx vitest run src/routes/sso-jit.test.ts` | ❌ Wave 0 |
| SSO-05 | Cert expiry cron creates alert at 60/30/7 days remaining | unit | `npx vitest run src/cron/sso-cert-monitor.test.ts` | ❌ Wave 0 |
| SSO-05 | Cert expiry cron skips connections with no certificate or metadata_url | unit | `npx vitest run src/cron/sso-cert-monitor.test.ts` | ❌ Wave 0 |
| SSO-06 | Callback with missing state returns 400 | unit | `npx vitest run src/routes/sso-callback.test.ts` | ❌ Wave 0 |
| SSO-06 | Callback with replayed (already-consumed) state returns 400 | unit | `npx vitest run src/routes/sso-callback.test.ts` | ❌ Wave 0 |
| SSO-06 | KV nonce key has TTL of 300s | unit (mock KV.put spy) | `npx vitest run src/routes/sso-login.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Run the quick command above (new SSO files only, ~5s)
- **Per wave merge:** `cd apps/api && npx vitest run --coverage` — all 90% line / 85% branch thresholds must pass
- **Phase gate:** Full suite green + coverage thresholds met before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/routes/sso-login.test.ts` — covers SSO-03 login initiation + SSO-06 nonce TTL
- [ ] `apps/api/src/routes/sso-callback.test.ts` — covers SSO-03 callback, SSO-06 state validation, SSO-04 JIT trigger
- [ ] `apps/api/src/routes/sso-jit.test.ts` — covers SSO-04 JIT upsert, concurrent race scenario
- [ ] `apps/api/src/cron/sso-cert-monitor.test.ts` — covers SSO-05 alert thresholds
- [ ] Framework install: none needed — Vitest already configured

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `apps/api/src/routes/sso.ts`, `sso.test.ts`, `auth-session.ts`, `auth-callback.ts`
- Direct schema inspection: `packages/db/src/schema-d1.ts` (platform_users + sso_connections table definitions)
- `.planning/research/STACK.md` — WorkOS vs self-hosted analysis, OIDC jose pattern, runtime constraints
- `.planning/research/ARCHITECTURE.md` — component boundaries, JIT pattern, KV nonce key conventions
- `.planning/research/PITFALLS.md` — Pitfall 2 (cert expiry), Pitfall 3 (JIT race), Pitfall 11 (CSRF state)
- `.planning/STATE.md` — Locked decision: WorkOS SDK for MVP
- `jose` library: Workers-native JWKS + JWT, already in project

### Secondary (MEDIUM confidence)
- WorkOS Cloudflare SAML integration docs — https://workos.com/docs/integrations/cloudflare-saml
- CVE-2025-47949 samlify signature wrapping — https://github.com/advisories/GHSA-r683-v43c-6xqv

### Tertiary (LOW confidence)
- `@xmldom/xmldom` + `xml-crypto` Workers compat under wrangler dev — unvalidated; do not commit to self-hosted SAML path without live test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — WorkOS locked in STATE.md; `jose` verified in codebase
- Architecture: HIGH — existing files verified by direct source inspection; new file boundaries match ARCHITECTURE.md
- Pitfalls: HIGH — backed by source code inspection (unique index scope) + PITFALLS.md
- Validation: HIGH — Vitest config confirmed; existing test pattern in sso.test.ts verified

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (WorkOS SDK API surface is stable; jose is stable; D1 schema frozen for this milestone)
