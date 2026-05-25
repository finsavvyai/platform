# TokenForge — Implementation Specification

**Audience:** Claude Code (implementation agent) and Shachar.
**Goal:** Build TokenForge as a single product with two deployment modes — **Customer Mode** (B2C session security for SaaS/fintech end-users) and **Workforce Mode** (B2B employee session security competing with Cisco Duo Passport) — sharing the same protocol, server, and SDK.
**Stack (locked in to match other Shachar products):** SvelteKit 2.15 + Svelte 5 on Cloudflare Pages, Hono 4 on Cloudflare Workers, Cloudflare D1 + Drizzle ORM, Better Auth (for TokenForge's own admin console), LemonSqueezy (billing), Resend (email).
**Standard alignment:** W3C Device Bound Session Credentials (DBSC). Native DBSC where supported (Chrome 146+ on Windows TPM, macOS Secure Enclave coming), Web Crypto ECDSA P-256 non-extractable fallback everywhere else.

---

## 1. Mission & one-line positioning

> **TokenForge is the developer-first, DBSC-aligned session security primitive that makes stolen cookies useless — for both your customers and your employees.**

Customer mode lives where Cisco Duo cannot reach: customer-facing apps, fintech logins, SaaS end-users. Workforce mode goes head-to-head with Duo Passport's Session Theft Protection but at developer-friendly pricing, with an open protocol, and self-serve onboarding.

**Anti-positioning (do not become):** an IdP, an MFA vendor, an SSO product, a directory. TokenForge wraps *existing* identity (Better Auth, Clerk, Auth0, Okta, Entra, custom JWT) and adds device-bound session protection on top.

---

## 2. Architectural overview

```
┌───────────────────────────────────────────────────────────────┐
│                    Customer's web app                         │
│  ┌──────────────────┐         ┌─────────────────────────┐     │
│  │ Their identity   │         │ @tokenforge/browser SDK │     │
│  │ (Better Auth /   │ ─────▶  │ - Web Crypto / DBSC      │     │
│  │  Clerk / custom) │         │ - Cookie+key management  │     │
│  └──────────────────┘         └────────────┬────────────┘     │
│           │                                │                  │
│  ┌────────▼──────────────────┐    ┌────────▼────────────┐     │
│  │ Their backend             │    │ Refresh requests     │     │
│  │ + @tokenforge/hono        │    │ Sec-Session-Response │     │
│  │   middleware              │    │ headers              │     │
│  └────────────┬──────────────┘    └────────┬─────────────┘    │
└───────────────┼──────────────────────────────┼───────────────┘
                │ /registerSession             │ /refresh
                │ (server-to-server, API key)  │ (client-to-server, signed)
                ▼                              ▼
┌───────────────────────────────────────────────────────────────┐
│              TokenForge Hono Worker (api.tokenforge.dev)      │
│  - Session registration  - Refresh + nonce signing            │
│  - Risk signals          - AitM detection                     │
│  - Policy engine         - Audit log                          │
└───────────────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
                           Cloudflare D1 + Drizzle
```

Two **server-side endpoints** are the entire wire protocol surface:
1. `POST /v1/sessions/register` — server-to-server, called by the customer's backend after their own auth succeeds. Takes a public key + identity claim, returns short-lived bound cookies.
2. `POST /v1/sessions/refresh` — client-to-server, called by the browser when the short-lived cookie expires. Takes a signed nonce, returns refreshed cookies.

Everything else (admin console, policies, dashboards, billing) is value-add layered on top of these two endpoints.

---

## 3. Protocol — DBSC-aligned with Web Crypto fallback

### 3.1 Wire format

We follow the W3C DBSC spec exactly, so apps that integrate TokenForge today get native browser DBSC for free when Chrome/Edge/Safari ship it. Headers, JWT shapes, and endpoint contracts are spec-compliant.

**Registration response from the app's login handler (set by middleware):**
```http
HTTP/1.1 200 OK
Sec-Session-Registration: (ES256);path="/.well-known/tokenforge/register";challenge="b64-nonce"
```

**Browser POSTs to the registration path** (or, in fallback mode, the SDK does it explicitly):
```http
POST /.well-known/tokenforge/register
Content-Type: application/jwt

eyJhbGciOiJFUzI1NiIsInR5cCI6Imp3dCIsImp3ayI6...   <-- contains the public key + signed challenge
```

**Server response binds a session:**
```json
{
  "session_identifier": "tf_sess_01HXY...",
  "refresh_url": "https://api.tokenforge.dev/v1/sessions/refresh",
  "scope": { "origin": "https://app.example.com", "include_site": true },
  "credentials": [
    { "type": "cookie", "name": "tf_bound", "attributes": "Secure;HttpOnly;SameSite=Lax;Path=/" }
  ]
}
```

The browser stores the session config and binds the private key to it. The short-lived cookie (`tf_bound`) is set with a TTL of **5 minutes by default**. After expiry, the browser pauses the next request and signs a fresh nonce against `/refresh`.

### 3.2 Key generation — three tiers

In priority order, the SDK selects the strongest available:

1. **Native DBSC** (browser-managed, hardware-backed via TPM/Secure Enclave). Detect via `navigator.deviceBoundSession` or feature header. No custom code path; the browser handles refresh.
2. **WebAuthn-bound** (high assurance). Generate a passkey-style credential with `userVerification: "discouraged"` for silent signing. Used for B2B Workforce mode where the org wants stronger guarantees.
3. **Web Crypto ECDSA P-256** (universal fallback). `crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])` — `extractable: false` means the private key never leaves the browser's key store. Stored under an opaque handle in IndexedDB.

The server accepts all three over the same JWT-signed wire format. The session record stores `binding_class: 'native_dbsc' | 'webauthn' | 'webcrypto'` for risk scoring.

### 3.3 Refresh flow

```
Browser                                    TokenForge Worker
   │                                            │
   │  Request to app, tf_bound expired          │
   │ ─────────────────────────────────────────▶ │
   │                                            │
   │  401 + Sec-Session-Challenge: <nonce>      │
   │ ◀───────────────────────────────────────── │
   │                                            │
   │  Sign nonce w/ private key                 │
   │  POST /v1/sessions/refresh                 │
   │  Authorization: DPoP <signed_jwt>          │
   │ ─────────────────────────────────────────▶ │
   │                                            │
   │  Verify signature against stored pub key   │
   │  Issue new short-lived tf_bound cookie     │
   │  + emit risk signals if anomalous          │
   │ ◀───────────────────────────────────────── │
```

Nonce TTL: 30 seconds. Replay protection: nonces are single-use, stored in Workers KV with the session ID as namespace.

### 3.4 AitM detection signals

Every refresh emits these signals to the audit log; the policy engine can act on them:
- TLS exporter binding mismatch (if available)
- Geo-IP delta from registration
- ASN change
- User-Agent fingerprint drift (loose match)
- Time-since-last-refresh anomaly (Evilginx typically replays in seconds)
- Concurrent refresh from multiple IPs
- Round-trip latency vs. baseline

---

## 4. Repo layout

Monorepo, pnpm workspaces. One repo: `tokenforge`.

```
tokenforge/
├── apps/
│   ├── api/              # Hono Worker — the actual product
│   ├── dashboard/        # SvelteKit admin console (tokenforge.dev/app)
│   └── marketing/        # SvelteKit marketing site (tokenforge.dev)
├── packages/
│   ├── browser/          # @tokenforge/browser — client SDK (TS, ESM)
│   ├── hono/             # @tokenforge/hono — Hono middleware
│   ├── express/          # @tokenforge/express — Express middleware (later)
│   ├── sveltekit/        # @tokenforge/sveltekit — hooks (later)
│   ├── protocol/         # shared types, JWT helpers, DBSC schema
│   └── db/               # Drizzle schema + migrations (D1)
├── infra/
│   └── wrangler/         # Wrangler configs per env
└── docs/                 # mdsvex docs site
```

---

## 5. Database schema (Drizzle, D1)

`packages/db/src/schema.ts`:

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// A TokenForge customer (the developer/company using TokenForge)
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),                    // tnt_*
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  plan: text("plan", { enum: ["free", "pro", "scale", "workforce"] }).notNull().default("free"),
  lemonSubId: text("lemon_sub_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// An "app" = one origin protected by TokenForge
// Customer mode: one app per product the tenant ships
// Workforce mode: one app per workforce deployment (the IdP integration)
export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(),                    // app_*
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  mode: text("mode", { enum: ["customer", "workforce"] }).notNull(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),               // https://app.example.com
  apiKeyHash: text("api_key_hash").notNull(),     // bcrypt hash; live key shown once
  shortCookieTtlSec: integer("short_cookie_ttl_sec").notNull().default(300),
  longCookieTtlSec: integer("long_cookie_ttl_sec").notNull().default(2592000),
  // Workforce-only:
  idpType: text("idp_type", { enum: ["none", "oidc", "saml"] }).notNull().default("none"),
  idpConfig: text("idp_config", { mode: "json" }),
  enforcePolicy: integer("enforce_policy", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => ({
  tenantIdx: index("apps_tenant_idx").on(t.tenantId),
  originIdx: index("apps_origin_idx").on(t.origin),
}));

// End-users protected by the app. Identity is owned by the customer's app —
// we only store an opaque `subject` they tell us about.
export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),                    // sub_*
  appId: text("app_id").notNull().references(() => apps.id),
  externalSubject: text("external_subject").notNull(),  // their user ID
  metadata: text("metadata", { mode: "json" }),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
}, (t) => ({
  appSubjectIdx: index("subjects_app_subject_idx").on(t.appId, t.externalSubject),
}));

// A bound session = one device + one subject + one app
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),                    // tf_sess_*
  appId: text("app_id").notNull().references(() => apps.id),
  subjectId: text("subject_id").notNull().references(() => subjects.id),
  publicKeyJwk: text("public_key_jwk", { mode: "json" }).notNull(),
  bindingClass: text("binding_class", { enum: ["native_dbsc", "webauthn", "webcrypto"] }).notNull(),
  origin: text("origin").notNull(),
  userAgent: text("user_agent"),
  ipFirst: text("ip_first"),
  geoFirst: text("geo_first"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastRefreshAt: integer("last_refresh_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  revokedReason: text("revoked_reason"),
}, (t) => ({
  appIdx: index("sessions_app_idx").on(t.appId),
  subjectIdx: index("sessions_subject_idx").on(t.subjectId),
  expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
}));

// Append-only audit log
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull(),
  sessionId: text("session_id"),
  type: text("type").notNull(),                   // 'register' | 'refresh' | 'revoke' | 'risk_signal' | 'policy_block'
  severity: text("severity", { enum: ["info", "warn", "critical"] }).notNull().default("info"),
  ip: text("ip"),
  geo: text("geo"),
  ua: text("ua"),
  payload: text("payload", { mode: "json" }),
  at: integer("at", { mode: "timestamp" }).notNull(),
}, (t) => ({
  appAtIdx: index("audit_app_at_idx").on(t.appId, t.at),
  sessionIdx: index("audit_session_idx").on(t.sessionId),
}));

// Workforce-mode policies
export const policies = sqliteTable("policies", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull().references(() => apps.id),
  name: text("name").notNull(),
  rules: text("rules", { mode: "json" }).notNull(),  // see policy DSL below
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

### 5.1 Policy DSL (workforce mode)

Stored as JSON, evaluated on each refresh:

```json
{
  "if_any": [
    { "geo_country_in": ["RU", "KP", "IR"] },
    { "asn_in": ["TOR", "VPN_KNOWN"] },
    { "binding_class": "webcrypto", "and": { "sensitive_path": true } },
    { "concurrent_ips_gt": 1, "window_sec": 60 }
  ],
  "then": "step_up"
}
```

Actions: `allow | step_up | block | revoke_session`.

---

## 6. Server — Hono Worker endpoints

`apps/api/src/index.ts`:

### 6.1 Public surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/v1/sessions/register` | App API key (server-to-server) | Issue a bound session for an authenticated subject |
| `POST` | `/v1/sessions/refresh` | Signed nonce JWT (client) | Refresh short-lived cookie |
| `POST` | `/v1/sessions/:id/revoke` | App API key | Force-revoke a session |
| `GET` | `/v1/sessions` | App API key | List active sessions for a subject |
| `GET` | `/v1/risk/:sessionId` | App API key | Pull current risk signals for step-up decisions |
| `POST` | `/v1/webhooks` | Tenant API key | Register webhook for risk events |
| `GET` | `/.well-known/tokenforge/jwks` | Public | Public keys for verifying TokenForge-issued JWTs |
| `POST` | `/v1/sso/:appId/callback` | Workforce mode only | OIDC/SAML callback |

### 6.2 Register endpoint contract

```ts
// POST /v1/sessions/register
// Headers: X-TokenForge-Key: tfk_live_...
// Body:
{
  app_id: "app_abc",
  subject: "user_123",                  // their internal user ID
  subject_metadata?: { email?: string, name?: string, ... },
  public_key_jwk: { kty: "EC", crv: "P-256", x: "...", y: "..." },
  binding_class: "webcrypto" | "webauthn" | "native_dbsc",
  attestation?: string,                 // for native_dbsc / webauthn
  client_ip: "1.2.3.4",                 // forwarded by app
  user_agent: "..."
}

// Response:
{
  session_id: "tf_sess_...",
  short_cookie: { name: "tf_bound", value: "...", max_age: 300, attributes: "Secure;HttpOnly;SameSite=Lax;Path=/" },
  long_cookie: { name: "tf_session", value: "...", max_age: 2592000, attributes: "Secure;HttpOnly;SameSite=Lax;Path=/" },
  refresh_url: "https://api.tokenforge.dev/v1/sessions/refresh",
  challenge: "b64-nonce"
}
```

The customer's backend sets these cookies on its own response. **TokenForge cookies are first-party on the app's domain**, not on `tokenforge.dev` — this is critical for SameSite=Lax to work and for avoiding third-party cookie blocking.

### 6.3 Refresh endpoint contract

```ts
// POST /v1/sessions/refresh
// Body: a JWT signed by the bound private key
// Header: DPoP <jwt>  (we follow DPoP-style, RFC 9449)

// JWT payload:
{
  iss: "tf_sess_...",     // session ID
  iat: 1714200000,
  jti: "<server-issued nonce>",
  htu: "https://api.tokenforge.dev/v1/sessions/refresh",
  htm: "POST"
}

// Response:
{
  short_cookie: { ... },     // refreshed
  signals?: ["geo_drift", "asn_change"],
  action: "allow" | "step_up" | "block"
}
```

If `action === "step_up"`, the customer's app must re-verify identity (e.g., re-prompt for password / MFA / passkey) before continuing. The middleware exposes this as a clean callback.

### 6.4 Worker file structure

```
apps/api/src/
├── index.ts                # Hono app entry
├── routes/
│   ├── sessions.register.ts
│   ├── sessions.refresh.ts
│   ├── sessions.admin.ts
│   ├── sso.oidc.ts
│   ├── sso.saml.ts
│   └── well-known.ts
├── lib/
│   ├── jwt.ts              # JWS verify/sign (jose)
│   ├── crypto.ts           # ECDSA P-256 verify, JWK helpers
│   ├── dpop.ts             # DPoP-style proof verification
│   ├── nonce.ts            # KV-backed single-use nonce store
│   ├── risk.ts             # signal computation
│   └── policy.ts           # policy DSL evaluator
├── middleware/
│   ├── apiKey.ts           # tenant/app API key auth
│   ├── ratelimit.ts        # Cloudflare Workers ratelimit binding
│   └── audit.ts            # append to audit_events
└── db/                     # Drizzle client
```

---

## 7. Client SDK — `@tokenforge/browser`

Single ESM package, ~5KB gzipped target. Zero dependencies (no `jose` in browser — use Web Crypto directly).

### 7.1 Public API

```ts
import { TokenForge } from "@tokenforge/browser";

const tf = new TokenForge({
  appId: "app_abc",
  apiBase: "https://api.tokenforge.dev",   // optional, defaults
  preferDBSC: true,                        // try native DBSC first
  origin: window.location.origin
});

// After the app's own login finishes:
await tf.bind({ subject: "user_123" });   // generates key, calls /register via the app's backend

// Manually trigger a refresh check (usually automatic):
await tf.refreshIfNeeded();

// On logout:
await tf.unbind();

// Subscribe to step-up events:
tf.on("step_up_required", (signals) => { /* show MFA modal */ });
tf.on("session_revoked", (reason) => { /* force re-login */ });
```

### 7.2 Internals

- **Key storage:** non-extractable `CryptoKey` written to IndexedDB via `structuredClone` (browsers preserve `CryptoKey` references).
- **Native DBSC detection:** check `'deviceBoundSession' in navigator` and the response of an HTTP HEAD to `/refresh` for a feature header.
- **Refresh interception:** the SDK installs a `fetch` and `XMLHttpRequest` proxy. When a request to `app.origin` returns 401 with `Sec-Session-Challenge`, the SDK signs the nonce, replays the original request after refresh succeeds.
- **Crash safety:** if signing fails (TPM busy, key gone), surface a `binding_lost` event so the app can force re-auth instead of silently failing open.

### 7.3 Files

```
packages/browser/src/
├── index.ts
├── core/
│   ├── tokenforge.ts       # main class
│   ├── keystore.ts         # IndexedDB + CryptoKey
│   ├── signer.ts           # ECDSA sign DPoP-style JWT
│   └── interceptor.ts      # fetch/XHR proxy
├── transports/
│   ├── dbsc.ts             # native DBSC path
│   ├── webauthn.ts         # WebAuthn path
│   └── webcrypto.ts        # fallback path
└── types.ts
```

---

## 8. Hono middleware — `@tokenforge/hono`

The drop-in for the customer's backend. Three lines to integrate.

```ts
import { Hono } from "hono";
import { tokenforge } from "@tokenforge/hono";

const app = new Hono();

app.use("*", tokenforge({
  appId: process.env.TF_APP_ID!,
  apiKey: process.env.TF_API_KEY!,
  // Called after the app's own login succeeds; tells TF who the subject is
  onLogin: async (c) => ({ subject: c.get("user").id }),
  // Called when TF says step-up is required
  onStepUp: async (c, signals) => c.redirect("/auth/step-up"),
}));

app.post("/login", async (c) => {
  const user = await myAuth.login(c);
  await c.tokenforge.bind(user.id);    // sets cookies on the response
  return c.json({ ok: true });
});
```

The middleware:
1. Reads `tf_bound` from the request.
2. If present and unexpired, verifies and continues.
3. If expired, returns 401 with `Sec-Session-Challenge` so the SDK can refresh.
4. If a refresh signal indicates step-up, calls `onStepUp`.

---

## 9. Customer mode — what to ship in v1

Goal: a developer can sign up, get an API key, drop the SDK + middleware into their SaaS, and protect customer sessions in <10 minutes.

### v1 must-haves

- Self-serve signup (Better Auth on the dashboard)
- One-click app creation, copy-paste API key
- The two endpoints + the SDK + Hono middleware
- Free tier: 1 app, 1,000 MAU, last 7 days of audit
- Pro tier ($49/mo): 5 apps, 25k MAU, 30 days audit, webhooks
- Scale tier ($199/mo): unlimited apps, 250k MAU, 90 days audit, priority support
- Audit log viewer in dashboard
- Live session list per app
- Webhook for `risk_signal` and `session_revoked` events

### Customer mode does NOT include (v1)

- Policies (workforce only)
- SSO/SAML/OIDC connectors
- Admin console for end-users
- Device posture checks

---

## 10. Workforce mode — what to ship in v2

This is the Duo Passport competitor. Higher price point, sold to security teams.

### v2 must-haves

- OIDC connector (Okta, Entra, Google Workspace, Auth0)
- SAML connector
- Policy engine (the JSON DSL above)
- Geo + ASN risk scoring with MaxMind GeoLite2 (or Cloudflare's built-in `cf.country` / `cf.asOrganization`)
- Per-application policy assignment
- Admin console: users tab, sessions tab, policies tab, audit tab
- Step-up handler that integrates with the IdP's MFA (don't reinvent MFA)
- SCIM provisioning (optional v2.5)
- Compliance exports: SOC 2 evidence pack, audit log to S3/R2

### Pricing (workforce)

- Workforce Starter: $4/user/mo (up to 100 users)
- Workforce Pro: $7/user/mo (up to 1,000 users) — undercuts Duo Premier ($9)
- Workforce Enterprise: custom

The bet: you don't need Cisco's bundle if you already have Okta/Entra. You just need session theft protection layered on. Sell it as "Duo Passport, without the rest of Duo, at half the price."

---

## 11. Phased build plan (Claude Code agent-friendly)

Each phase = one Claude Code session, scoped to be completable in ~4–8 hours of agent time. Run them sequentially, not in parallel — earlier phases produce contracts the later ones consume.

### Phase 1 — Skeleton (1 session)
- Create monorepo, pnpm workspaces, TypeScript configs
- Set up Wrangler for `apps/api`, deploy a hello-world Worker to `api.tokenforge.dev`
- Set up D1 database, Drizzle schema from §5, run migrations
- Set up SvelteKit dashboard skeleton at `dashboard.tokenforge.dev` with Better Auth signup
- CI: GitHub Actions, deploy on push to main
- **Done when:** signup works, empty dashboard renders, `GET /v1/health` returns 200

### Phase 2 — Protocol primitives (1 session)
- `packages/protocol` — types, JWT helpers, JWK ↔ CryptoKey conversion
- `packages/db` — Drizzle client wrapper with helpers (`createApp`, `findSubject`, etc.)
- Unit tests for JWT signing/verification with `jose` in Node, manual interop test against Web Crypto in a browser fixture
- **Done when:** can round-trip a DPoP-style JWT signed in browser, verified in Worker

### Phase 3 — Register + refresh endpoints (1 session)
- Implement `/v1/sessions/register` and `/v1/sessions/refresh` per §6
- API key auth middleware
- Workers KV nonce store with 30s TTL
- Audit log writes
- Integration tests using Miniflare
- **Done when:** end-to-end round-trip works against a curl-driven test client

### Phase 4 — Browser SDK (1 session)
- `packages/browser` per §7
- Web Crypto path only (skip DBSC and WebAuthn for now)
- Demo HTML page in `apps/api/test/fixtures/demo.html`
- **Done when:** demo page can bind, refresh, and detect 401 step-up

### Phase 5 — Hono middleware + reference integration (1 session)
- `packages/hono` per §8
- Build a minimal example app in `examples/saas-demo` using Better Auth + the middleware
- Document the integration in `docs/`
- **Done when:** the example app shows TokenForge protecting a logged-in dashboard

### Phase 6 — Dashboard v1 (customer mode) (1 session)
- Apps list, create-app flow (one-time API key reveal)
- Session list per app (paginated, filterable by subject)
- Audit log viewer
- LemonSqueezy integration for Pro / Scale upgrade
- **Done when:** a tenant can sign up, create an app, see live sessions, upgrade plan

### Phase 7 — Risk signals + webhooks (1 session)
- Implement signals from §3.4
- Webhook delivery worker (queue-backed via Cloudflare Queues)
- Webhook signing (HMAC), retries, exponential backoff
- Dashboard UI for webhook config + test fire
- **Done when:** geo drift triggers a webhook to a configured endpoint

### Phase 8 — Native DBSC path (1 session)
- Implement `transports/dbsc.ts` — feature detection, `Sec-Session-Registration` header response from `/v1/sessions/register`
- Test on Chrome 146+ Windows with TPM
- Document fallback behavior
- **Done when:** Chrome 146+ uses native TPM-backed DBSC; older browsers fall back transparently

### Phase 9 — Workforce mode foundations (1 session)
- OIDC connector (use `oslo` or `arctic` for OIDC primitives)
- App-level mode toggle, IdP config UI
- Policy schema + evaluator (no UI yet)
- **Done when:** a workforce app can authenticate a user via Okta and bind a session

### Phase 10 — Workforce dashboard (1 session)
- Users tab (synced from IdP claims)
- Policies tab with form-based editor for the DSL
- Sessions tab with revoke action
- Compliance export (CSV + JSON)
- **Done when:** an admin can write a policy that blocks logins from RU and verify it works

### Phase 11 — SAML + SCIM (1 session)
- SAML SP via `samlify` or `@node-saml/passport-saml`
- SCIM 2.0 endpoints for provisioning
- **Done when:** Okta SAML + SCIM provisioning round-trip works

### Phase 12 — Polish + launch prep (1 session)
- Marketing site
- Docs site (mdsvex)
- OpenAPI spec autogen
- SDK published to npm
- Status page
- **Done when:** ready for HN / Product Hunt launch

---

## 12. Test plan

- **Unit:** every crypto helper, every JWT path, every policy DSL rule
- **Integration:** Miniflare-based tests of register → refresh → revoke
- **Browser:** Playwright suite covering the SDK on Chromium / Firefox / WebKit
- **Security:** test cases for replay attacks (reused nonce), wrong-key signatures, cross-app session reuse, expired short cookie + missing long cookie, malformed JWT
- **Load:** k6 against a staging Worker, target 1000 RPS sustained refresh
- **Compliance harness:** automated check that audit log is append-only, that PII isn't logged, that webhook signatures verify

---

## 13. Threat model (abbreviated)

In scope:
- Cookie theft via infostealer malware → mitigated: stolen cookie can't refresh without the bound key
- Adversary-in-the-middle (Evilginx-style) → partially mitigated: AitM detection signals + step-up; for full mitigation requires native DBSC + TLS exporter binding
- Cross-site cookie leak → mitigated: SameSite=Lax + first-party cookies on app origin
- Replay of refresh JWT → mitigated: single-use nonces in KV
- Compromised customer API key → mitigated: per-app keys, rotation flow, audit log

Out of scope (v1):
- Malware that owns the browser process at registration time (DBSC explicitly doesn't defend this)
- Malicious browser extensions with full cookie access during the live session
- Endpoint compromise (delegated to EDR vendors)
- The customer's own auth being broken (TokenForge protects sessions, not credentials)

---

## 14. Open questions for Shachar before Phase 1

1. **Domain:** confirm `tokenforge.dev` (or alternatives) — needs to be registered before Phase 1 closes.
2. **Cookie domain strategy:** confirm we want first-party cookies set by the customer's backend (recommended) vs. a CNAME-onto-TokenForge approach. The spec assumes the former.
3. **Free tier limits:** are 1k MAU + 7-day audit aggressive enough for adoption without bleeding compute?
4. **Workforce GTM:** do you want to gate workforce mode behind a "contact us" flow or self-serve from day one? Self-serve is easier to build but harder to support for security buyers.
5. **Brand split:** sell as one product (TokenForge with two modes) or two SKUs (TokenForge + TokenForge Workforce)? My read is one product, two modes — simpler positioning, single dashboard.
6. **OpenSyber/AMLIQ overlap:** TokenForge will eventually need to ship risk signals into a SIEM. Should we plan native AMLIQ / OpenSyber outbound webhook formats now, or treat them as just-another-webhook customers?

---

**End of spec.** Hand this file to Claude Code and start with Phase 1.
