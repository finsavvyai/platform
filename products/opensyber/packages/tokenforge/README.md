# @opensyber/tokenforge

[![npm](https://img.shields.io/npm/v/@opensyber/tokenforge.svg)](https://www.npmjs.com/package/@opensyber/tokenforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE.md)

**Device-bound session security for the post-AiTM era.** W3C [DBSC](https://w3c.github.io/webappsec-dbsc/)–aligned, ECDSA P-256 + WebAuthn, drop-in for Auth0 / Okta / Clerk / Microsoft Entra ID. Every request after login is cryptographically signed with a device key that never leaves the browser. A stolen cookie without the device key is useless.

## Why this matters in 2026

- **Session hijacking attacks grew 127% YoY** ([Microsoft, May 2026](https://www.microsoft.com/en-us/security/blog/2026/05/04/breaking-the-code-multi-stage-code-of-conduct-phishing-campaign-leads-to-aitm-token-compromise/))
- Adversary-in-the-Middle (AiTM) toolkits — EvilProxy, Tycoon — bypass MFA in real time
- Chrome 146 (April 2026) shipped browser-native DBSC for Windows; macOS/Linux pending
- Auth0 and Okta's "session protection" features rely on IP/ASN/UA fingerprinting — defeated by VPN-equipped attackers. **TokenForge uses cryptographic device binding — defeats them.**

## Quick Start

### 1. Add the script tag (zero-code path)

```html
<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>
```

The script auto-generates ECDSA P-256 device keys (non-extractable, IndexedDB-stored), binds the session, and signs every `fetch()` request with `X-TF-Signature`, `X-TF-Nonce`, `X-TF-Timestamp` headers. On Chrome 146+ Windows it transparently uses the browser's native DBSC; on other browsers it polyfills via Web Crypto.

### 2. Add server middleware

```bash
npm install @opensyber/tokenforge
```

```ts
// Express
import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';
app.use(tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));
// req.tf.bound, req.tf.trustScore, req.tf.deviceId

// Next.js (App Router)
import { withTokenForge } from '@opensyber/tokenforge/nextjs';
export const GET = withTokenForge(handler, { apiKey: process.env.TOKENFORGE_API_KEY! });

// Fastify
import { tokenForgePlugin } from '@opensyber/tokenforge/fastify';
fastify.register(tokenForgePlugin, { apiKey: process.env.TOKENFORGE_API_KEY! });

// Hono
import { tokenForgeMiddleware } from '@opensyber/tokenforge/hono';
app.use('/api/*', tokenForgeMiddleware({ apiKey: env.TOKENFORGE_API_KEY }));
```

### 3. Get your API key

Sign up at [tokenforge.opensyber.cloud](https://tokenforge.opensyber.cloud) — free tier: 1,000 verifications/month, no credit card.

## What's new in v1.0.0 (May 2026)

This release graduates the protocol surface from beta. Subsequent 1.x is backward-compatible additions only.

### W3C DBSC protocol (Sprint 37)

Aligned with the W3C draft + Chrome 146 native rollout:

```
POST /v1/dbsc/challenge        — issue one-shot challenge (register/refresh/step_up)
POST /v1/dbsc/register         — bind device with JWS-signed challenge response
POST /v1/dbsc/refresh          — rotate bound cookie, run risk policy
POST /v1/dbsc/sessions/:id/revoke — admin soft-revoke
GET  /.well-known/tokenforge/jwks — public verifier keys (5-min edge cache)
GET  /.well-known/tokenforge/dbsc — service descriptor for SDK auto-discovery
```

### Workforce SSO replaces Cisco Duo Premier (Sprint 36)

Five OIDC IdPs + SAML 2.0:

```ts
import { exchangeSso } from '@opensyber/tokenforge/server/internal';

// After Okta / Entra / Google Workspace / Auth0 / generic OIDC login
const result = await exchangeSso(db, store, {
  tenantId, workforceAppId,
  idToken: req.body.idToken,  // from your IdP
  jwks,                        // cached via getJwks()
});
// result: { ok: true, subjectId, externalSubject, email, challenge, challengeExpiresAt }
```

JWKS cache: 24-hour freshness with stale-fallback when IdP is unreachable. xmlsoap claim namespace for Microsoft AD FS / Azure AD compatibility built in.

### AitM detection + per-route step-up (Sprint 39)

```ts
import { requireFreshSig } from '@opensyber/tokenforge/server';

app.use('/admin/*', requireFreshSig({ minTrustScore: 90 }));
app.use('/billing/*', requireFreshSig({
  minTrustScore: 95,
  requireWebAuthn: true,
}));
```

Per-tenant policy via `tf_tenants.step_up_actions` JSON:

```json
[
  { "path": "/admin/billing", "requireFreshSig": true, "freshSigMaxAgeSec": 30 },
  { "path": "/admin/*", "requireFreshSig": true, "requireWebAuthn": true }
]
```

Exact match wins over glob. Glob /admin/* matches /admin/users but not /admin (no segment past prefix).

### Action signing for sensitive operations

```ts
// Client
const sig = await tokenforge.signAction({
  action: 'transfer',
  body: { fromAccount, toAccount, amount },
});
fetch('/api/transfer', {
  method: 'POST',
  headers: { 'X-TF-Action-Signature': sig },
  body: JSON.stringify({ fromAccount, toAccount, amount }),
});
```

5-second freshness window. JWS claims include `actionHash` (SHA-256 over canonicalized body) so an attacker can't replay the signature with a different transfer amount.

### Webhook event stream

12 events, HMAC-SHA256 signed, retried with [1s, 4s, 15s] backoff, stable `X-TF-Delivery-Id` across retries:

```
session.bound          session.verified         session.revoked
trust_score.degraded   trust_score.critical     session.hijack_attempt
usage.cap_exceeded     dbsc.risk_signal         dbsc.policy_block
dbsc.session_step_up   dbsc.session_revoked     webhook.test
```

```ts
import { verifyWebhookSignature } from '@opensyber/tokenforge/webhooks';

app.post('/webhooks/tokenforge', async (c) => {
  const rawBody = await c.req.text();
  const ok = await verifyWebhookSignature({
    body: rawBody,
    signatureHeader: c.req.header('X-TF-Signature') ?? '',
    timestampHeader: c.req.header('X-TF-Timestamp') ?? '',
    secret: c.env.TOKENFORGE_WEBHOOK_SECRET,
  });
  if (!ok) return c.json({ error: 'bad_signature' }, 401);
  // handle event ...
});
```

Secret rotation grace window: 24 hours. Send the new secret while the old one stays valid; receivers verify against either.

## How it works

```
Browser                        TokenForge API                Your Server
  │                                │                              │
  │ 1. Generate ECDSA P-256        │                              │
  │    keypair (non-extractable)   │                              │
  │                                │                              │
  │ 2. POST /v1/dbsc/challenge ───>│                              │
  │ <─────── { challenge } ────────│                              │
  │                                │                              │
  │ 3. POST /v1/dbsc/register ────>│ Store public key             │
  │    + JWS over challenge        │                              │
  │ <─── { sessionId, deviceId } ──│                              │
  │                                │                              │
  │ 4. fetch('/api/data')          │                              │
  │    + X-TF-Signature ──────────────────────────────────────>   │
  │                                │                              │
  │                                │ <── POST /v1/edge/verify ──  │
  │                                │     Verify signature         │
  │                                │     Run AitM heuristics      │
  │                                │     Compute trust score      │
  │                                │ ──> { allow, score: 92 }     │
  │ <──────────────────────────────────── 200 OK ───────────────  │
```

The device key never leaves the client. The TokenForge service holds the public key + session metadata. Your server passes request context, gets back an allow/step_up/block decision.

## Trust score signals

| Signal | Weight | Detects |
|--------|--------|---------|
| Signature | 30 | Tampering, missing/wrong device key |
| IP Address | 15 | IP change since binding |
| Geo Location | 15 | Country mismatch |
| Fingerprint | 15 | Browser/device fingerprint drift |
| Velocity | 10 | Multiple IPs in short window |
| Timing | 10 | Clock skew beyond ±60s |
| Nonce | 5 | Replay attacks |

Score >= 80: `allow`. Score 40-79: `step_up`. Score < 40: `block`. Thresholds configurable per tenant.

## Drop-in for your existing IdP

TokenForge runs *after* authentication — bring your own IdP:

| IdP | Integration | Built-in support |
|---|---|---|
| **Microsoft Entra ID** | Custom Authentication Extension webhook | Roadmap M11 (Q3 2026) |
| **Auth0** | Auth0 Action snippet | Roadmap M14 — Marketplace listing pending review |
| **Okta** | Inline Hook + Custom Authenticator | Roadmap M15 — OIN listing pending review |
| **Clerk** | `@tokenforge/clerk-middleware` shim | Roadmap M16 |
| **Auth.js / NextAuth** | Works today via `@opensyber/tokenforge/nextjs` | ✅ |
| **Firebase Auth** | Works today via `@opensyber/tokenforge/express` | ✅ |
| **Supabase Auth** | Works today via `@opensyber/tokenforge/express` | ✅ |
| **Custom JWT** | Works today | ✅ |

## React integration

```tsx
import { TokenForgeProvider, useTokenForge } from '@opensyber/tokenforge/react';

function App() {
  return (
    <TokenForgeProvider config={{
      apiBase: '/api',
      getSessionId: () => getSession(),
    }}>
      <YourApp />
    </TokenForgeProvider>
  );
}

function ProtectedPage() {
  const { bound, trustScore, deviceId } = useTokenForge();
  if (!bound) return <BindButton />;
  return <Dashboard trustScore={trustScore} deviceId={deviceId} />;
}
```

## Self-hosted server

The server adapters work against your own database / KV — no hosted service required:

```ts
import { createTokenForgeRoutes } from '@opensyber/tokenforge/server';
import { D1Storage } from '@opensyber/tokenforge/server/storage';
// or PostgresStorage, RedisStorage, or implement the StorageInterface

const tf = createTokenForgeRoutes({
  storage: new D1Storage(env.DB),
  sessionMaxAge: 86400,
});
app.route('/api/tf', tf);
```

Storage backends shipped: D1 (Cloudflare Workers), PostgreSQL, Redis. Bring your own via `StorageInterface`.

## Compatibility

| Platform | Status |
|---|---|
| Chrome 146+ Windows | ✅ Native DBSC + polyfill fallback |
| Chrome 146+ macOS / Linux | ⏳ DBSC pending Google rollout; polyfill works today |
| Safari (macOS / iOS) | ✅ Polyfill via Web Crypto + IndexedDB |
| Firefox | ✅ Polyfill |
| Edge 146+ | ✅ Inherits Chromium DBSC |
| Node.js 18+ (server) | ✅ |
| Bun, Deno | ✅ |
| Cloudflare Workers | ✅ |

## Pricing (hosted service)

| Plan | Price | Verifications/mo |
|------|-------|-----------------|
| Free | $0 | 1,000 |
| Pro | $49/mo | 50,000 |
| Team | $199/mo | 250,000 |
| Enterprise | Custom | Unlimited + SLA |

The SDK code in this repository is MIT-licensed and runs against any storage backend — you can self-host without a TokenForge subscription.

## Examples & docs

- Full API reference: [tokenforge.opensyber.cloud/docs](https://tokenforge.opensyber.cloud/docs)
- DBSC protocol explainer: [tokenforge.opensyber.cloud/dbsc](https://tokenforge.opensyber.cloud/dbsc)
- Reference apps (Next.js, Express, Hono, Fastify): [github.com/opensyber/tokenforge-examples](https://github.com/opensyber/tokenforge-examples)

## Security disclosure

Security issues: `security@opensyber.cloud` (PGP key available). Coordinated disclosure within 90 days; CVE assignment for confirmed vulnerabilities.

## License

SDK: MIT (see [LICENSE.md](./LICENSE.md)). Hosted service requires API key — governed by [TokenForge Terms](https://tokenforge.opensyber.cloud/terms).
