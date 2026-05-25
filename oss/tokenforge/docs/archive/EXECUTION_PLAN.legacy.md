# TokenForge — Execution Plan

## Phase 1: Build Inside ClawShield (Days 1-10)
## Phase 2: Extract as Standalone Product (Days 11-18)

---

## STRATEGY

TokenForge is built as a package INSIDE the ClawShield monorepo first. It lives in `packages/tokenforge/`. This means:

- It's immediately usable by ClawShield
- It's already structured as an importable package
- Extracting to standalone npm package later is a copy + publish
- ClawShield gets a killer security feature that no competitor has
- You validate the technology with real users before spinning it out

### Monorepo Location

```
clawshield/
├── packages/
│   ├── tokenforge/              ← NEW
│   │   ├── src/
│   │   │   ├── client/          — Browser SDK
│   │   │   │   ├── index.ts
│   │   │   │   ├── crypto.ts
│   │   │   │   ├── signer.ts
│   │   │   │   ├── interceptor.ts
│   │   │   │   ├── binding.ts
│   │   │   │   └── storage.ts
│   │   │   ├── server/          — Hono middleware
│   │   │   │   ├── index.ts
│   │   │   │   ├── middleware.ts
│   │   │   │   ├── crypto.ts
│   │   │   │   ├── trust-score.ts
│   │   │   │   ├── binding.ts
│   │   │   │   └── step-up.ts
│   │   │   ├── react/           — React hooks
│   │   │   │   ├── index.ts
│   │   │   │   └── provider.tsx
│   │   │   └── shared/          — Shared types
│   │   │       └── types.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   ├── db/                      — Add migration for TF tables
│   ├── shared/
│   └── ui/
```

---

## PHASE 1: BUILD INSIDE CLAWSHIELD

### Day 1 — Package Setup + DB Schema

**Goal:** TokenForge package scaffolded, database tables created, types defined
**Agent:** Claude Code
**Estimated Hours:** 3h

**Tasks:**

1. Create `packages/tokenforge/` directory structure as shown above
2. Create `packages/tokenforge/package.json`:
   ```json
   {
     "name": "@clawshield/tokenforge",
     "version": "0.1.0",
     "private": true,
     "exports": {
       "./client": "./src/client/index.ts",
       "./server": "./src/server/index.ts",
       "./react": "./src/react/index.ts"
     }
   }
   ```
3. Create `packages/tokenforge/tsconfig.json` extending root config
4. Create D1 migration file `packages/db/migrations/XXX_tokenforge_tables.sql`:
   - `device_sessions` table (schema from ARCHITECTURE.md section 5)
   - `security_events` table
   - `step_up_challenges` table
   - All indexes
5. Create `packages/tokenforge/src/shared/types.ts` with all TypeScript interfaces
6. Run migration against local D1: `wrangler d1 execute clawshield --local --file=...`
7. Verify tables created correctly

**Claude Code Prompt:**
```
Read /path/to/tokenforge/docs/ARCHITECTURE.md sections 5 and 6.
Create the tokenforge package in packages/tokenforge/ with the directory 
structure shown. Create the D1 migration with all tables and indexes.
Create the shared types file. Run the migration locally.
```

---

### Day 2 — Server Crypto + Trust Score Engine

**Goal:** Server-side cryptographic verification and trust scoring working
**Agent:** Claude Code
**Estimated Hours:** 3h

**Tasks:**

1. Implement `packages/tokenforge/src/server/crypto.ts`:
   - `importPublicKey(jwkString)` — import JWK public key
   - `verifySignature(publicKey, signature, payload)` — ECDSA P-256 verification
   - `base64UrlToArrayBuffer()` helper
   - Full implementation in SERVER_MIDDLEWARE.md section 2
2. Implement `packages/tokenforge/src/server/trust-score.ts`:
   - `TrustScoreEngine` class with `compute()` and `getDropReasons()`
   - All signal weights from ARCHITECTURE.md section 3.3
   - `sameSubnet()` helper for IP comparison
   - Full implementation in SERVER_MIDDLEWARE.md section 3
3. Write tests:
   - Test signature verification with known keypair
   - Test trust score computation with various signal combinations
   - Test edge cases: missing signals, IPv6, etc.

**Claude Code Prompt:**
```
Read /path/to/tokenforge/docs/SERVER_MIDDLEWARE.md sections 2 and 3.
Implement the server crypto utilities and trust score engine.
Write tests using vitest. The crypto module should work in 
Cloudflare Workers (Web Crypto API, not Node crypto).
```

---

### Day 3 — Client SDK Core

**Goal:** Browser SDK generates keys, stores them, signs requests
**Agent:** Claude Code
**Estimated Hours:** 4h

**Tasks:**

1. Implement `packages/tokenforge/src/client/crypto.ts`:
   - `generateDeviceKeyPair()` — ECDSA P-256, non-extractable
   - `exportPublicKey()` — JWK export of public key only
   - Full implementation in CLIENT_SDK.md section 3
2. Implement `packages/tokenforge/src/client/storage.ts`:
   - IndexedDB wrapper for storing CryptoKey objects
   - `storeDeviceKey()`, `getDeviceKey()`, `clearDeviceKeys()`
   - Handle IndexedDB unavailability gracefully
3. Implement `packages/tokenforge/src/client/signer.ts`:
   - `signChallenge(privateKey, sessionId, nonce, timestamp)`
   - `generateNonce()` — crypto.getRandomValues
   - `arrayBufferToBase64Url()` helper
   - Full implementation in CLIENT_SDK.md section 4
4. Implement `packages/tokenforge/src/client/binding.ts`:
   - `bindDevice(apiBase, sessionId)` — full binding flow
   - Key generation → export public key → POST to server → store locally
   - Full implementation in CLIENT_SDK.md section 6
5. Write tests (jsdom/happy-dom for Web Crypto mocking)

**Claude Code Prompt:**
```
Read /path/to/tokenforge/docs/CLIENT_SDK.md sections 3, 4, 5, and 6.
Implement all client-side modules. Use Web Crypto API only (no Node crypto).
The key MUST be non-extractable — this is the security model.
Write tests. Handle browser compatibility edge cases.
```

---

### Day 4 — Client Fetch Interceptor + Main Entry

**Goal:** Automatic request signing via fetch interceptor, main SDK class
**Agent:** Claude Code
**Estimated Hours:** 3h

**Tasks:**

1. Implement `packages/tokenforge/src/client/interceptor.ts`:
   - `installFetchInterceptor()` — monkey-patch global fetch
   - Auto-attach X-TF-Signature, X-TF-Nonce, X-TF-Timestamp, X-TF-Device-ID
   - Handle step-up (403) and revocation (401) responses
   - Skip non-API paths
   - Full implementation in CLIENT_SDK.md section 5
2. Implement `packages/tokenforge/src/client/index.ts`:
   - `TokenForge` class — main SDK entry point
   - `init()`, `signRequest()`, `getDeviceId()`, `isBound()`, `clearKeys()`, `rebind()`
   - Wire together: crypto → storage → signer → interceptor → binding
   - Full API in CLIENT_SDK.md section 2
3. Export factory: `createTokenForge(config)`
4. Write integration test: init → bind → sign → verify round-trip

**Claude Code Prompt:**
```
Read /path/to/tokenforge/docs/CLIENT_SDK.md sections 2 and 5.
Implement the fetch interceptor and main TokenForge class.
Wire all modules together. The SDK should be framework-agnostic.
Write an integration test that tests the full flow.
```

---

### Day 5 — Server Middleware + Binding Endpoint

**Goal:** Hono middleware verifying every request, binding endpoint working
**Agent:** Claude Code
**Estimated Hours:** 4h

**Tasks:**

1. Implement `packages/tokenforge/src/server/middleware.ts`:
   - `tokenForgeMiddleware(options)` — full Hono middleware
   - Nonce validation via KV
   - Timestamp validation
   - Device session lookup from D1
   - Signature verification
   - Trust score computation and action
   - Security event logging
   - Full implementation in SERVER_MIDDLEWARE.md section 1
2. Implement `packages/tokenforge/src/server/binding.ts`:
   - POST `/api/tf/bind` — receive public key, store in D1
   - GET `/api/tf/sessions` — list active sessions
   - DELETE `/api/tf/sessions/:id` — revoke session
   - GET `/api/tf/events` — security events
   - Full implementation in SERVER_MIDDLEWARE.md section 4
3. Create `packages/tokenforge/src/server/index.ts` — export everything
4. Write tests against miniflare (local CF Workers runtime)

**Claude Code Prompt:**
```
Read /path/to/tokenforge/docs/SERVER_MIDDLEWARE.md sections 1 and 4.
Implement the Hono middleware and all binding/session endpoints.
Use D1 for sessions, KV for nonces. Test with miniflare.
Ensure middleware integrates after Clerk auth middleware.
```

---

### Day 6 — Step-Up Auth Flow

**Goal:** Step-up authentication working end-to-end
**Agent:** Claude Code
**Estimated Hours:** 3h

**Tasks:**

1. Implement `packages/tokenforge/src/server/step-up.ts`:
   - POST `/api/tf/step-up/initiate` — create challenge
   - POST `/api/tf/step-up/complete` — verify and restore trust
   - Support TOTP (via Clerk API) and email OTP (via KV + Resend)
   - Full implementation in SERVER_MIDDLEWARE.md section 5
2. Implement client-side step-up handling:
   - When interceptor receives 403 with `step_up_required`, emit event
   - Client app shows appropriate UI (TOTP input, email OTP input)
3. Wire step-up routes into main Hono app
4. Test: trigger low trust score → step-up challenge → complete → score restored

**Claude Code Prompt:**
```
Read /path/to/tokenforge/docs/SERVER_MIDDLEWARE.md section 5.
Implement step-up auth flow — server endpoints and client-side handling.
Support TOTP via Clerk verification and email OTP via KV.
Test the full flow: trust drop → challenge → verify → restore.
```

---

### Day 7 — React Integration + Clerk Wiring

**Goal:** TokenForge wired into ClawShield's Next.js app with Clerk
**Agent:** Claude Code
**Estimated Hours:** 3h

**Tasks:**

1. Implement `packages/tokenforge/src/react/provider.tsx`:
   - `TokenForgeProvider` — wraps app, initializes SDK after Clerk auth
   - `useTokenForge()` hook — exposes isBound, deviceId, trustScore
   - Full implementation in CLIENT_SDK.md section 7
2. Wire into ClawShield's Next.js layout:
   - Add `<TokenForgeProvider>` inside `<ClerkProvider>`
   - Add TokenForge middleware to Hono API app
3. Add wrangler.toml bindings:
   - KV namespace for nonces: `TF_NONCES`
   - D1 already exists, just use additional tables
4. Test in dev: login via Clerk → automatic device binding → signed requests

**Claude Code Prompt:**
```
Read /path/to/tokenforge/docs/CLIENT_SDK.md section 7.
Create the React provider and useTokenForge hook.
Wire TokenForge into ClawShield's Next.js layout.tsx and Hono API.
Add KV namespace binding to wrangler.toml.
Test the full flow: Clerk login → device bind → signed API requests.
```

---

### Day 8 — Security Dashboard UI

**Goal:** Users can see active sessions, trust scores, security events
**Agent:** Claude Code + Cowork (for UI)
**Estimated Hours:** 4h

**Tasks:**

1. Create security dashboard page: `apps/web/app/dashboard/security/page.tsx`
2. Components needed:
   - **Active Sessions** — list of bound devices with trust scores, IP, location, last active
   - **Revoke Session** — button to kill any session
   - **Security Events Feed** — timeline of events (bindings, anomalies, step-ups)
   - **Trust Score Gauge** — visual indicator for current session
3. API integration — call `/api/tf/sessions` and `/api/tf/events`
4. Real-time trust score display using `useTokenForge()` hook
5. Add "Security" tab to dashboard navigation

**Claude Code Prompt:**
```
Create a security dashboard page at apps/web/app/dashboard/security/page.tsx.
Use shadcn/ui components. Show: active sessions with trust scores,
session revocation buttons, security events timeline, current trust 
score gauge. Call the TokenForge API endpoints. Add to dashboard nav.
```

---

### Day 9 — Step-Up Auth UI + Edge Cases

**Goal:** Step-up auth modal works, all edge cases handled
**Agent:** Claude Code
**Estimated Hours:** 3h

**Tasks:**

1. Create step-up auth modal component:
   - Triggered by `onStepUpRequired` event from TokenForge SDK
   - Shows TOTP input or email OTP input
   - Calls step-up endpoints
   - Dismisses on success, shows error on failure
2. Handle edge cases:
   - New browser / cleared cookies → graceful re-binding
   - Multiple tabs open → shared IndexedDB key, no conflicts
   - Session expires during use → clean redirect to login
   - Incognito mode → detect and re-bind each session
   - WebCrypto unavailable (old browsers) → fingerprint-only fallback
   - D1 query failures → graceful degradation (allow request, log error)
3. Add error boundary for TokenForge failures — app should never crash

**Claude Code Prompt:**
```
Create a step-up authentication modal triggered by TokenForge events.
Handle all edge cases: new browser, cleared cookies, multiple tabs, 
session expiry, incognito mode, WebCrypto unavailable.
Add error boundaries. App must never crash due to TokenForge failures.
```

---

### Day 10 — Testing, Hardening, Documentation

**Goal:** Full test coverage, security hardening, internal documentation
**Agent:** Claude Code
**Estimated Hours:** 4h

**Tasks:**

1. End-to-end tests:
   - Full flow: signup → login → bind → use → trust drop → step-up → recover
   - Attack simulation: replay stolen token → verify rejection
   - Attack simulation: modify signature → verify rejection
   - Attack simulation: IP change → verify trust drop
2. Security hardening:
   - Rate limit binding endpoint (max 5 binds per user per hour)
   - Rate limit step-up attempts (max 3 per challenge)
   - Ensure no PII in security event logs
   - Add CSP headers to prevent XSS
   - Audit all crypto operations for timing safety
3. Update ClawShield README with TokenForge section
4. Create `packages/tokenforge/README.md` — internal documentation

**Claude Code Prompt:**
```
Write comprehensive tests for TokenForge: unit tests for crypto,
trust scoring, middleware; integration tests for full flows;
security tests simulating attacks. Add rate limiting to binding
and step-up endpoints. Audit for security issues. Update docs.
```

---

## PHASE 2: EXTRACT AS STANDALONE PRODUCT (Days 11-18)

*Only start this after ClawShield has paying users validating TokenForge in production.*

### Day 11 — Package Extraction

- Copy `packages/tokenforge/` to new repo `tokenforge/`
- Replace D1-specific code with adapter pattern (D1, Postgres, Turso, PlanetScale)
- Replace KV-specific code with adapter pattern (KV, Redis, Upstash)
- Make Clerk optional — support any auth provider via `getSessionId` callback
- Create `@tokenforge/client`, `@tokenforge/server`, `@tokenforge/react` npm packages

### Day 12 — Framework Adapters

- Create `@tokenforge/hono` — Hono middleware adapter
- Create `@tokenforge/express` — Express middleware adapter
- Create `@tokenforge/nextjs` — Next.js middleware adapter
- Each adapter wraps the core middleware with framework-specific integration

### Day 13 — Multi-Tenant API

- Build standalone API (Hono on CF Workers)
- Multi-tenant: each customer gets isolated D1 database
- API key management for server-side SDKs
- Webhook notifications for security events

### Day 14 — Standalone Dashboard

- Fork ClawShield's security dashboard
- Add multi-tenant: customer selector, org management
- Add analytics: trust score trends, event distributions, session geography
- Add alerts configuration: email, Slack, webhook

### Day 15 — Billing + Landing Page

- Stripe integration with usage-based pricing:
  - Free: 1,000 verifications/month
  - Pro ($49/mo): 50,000 verifications/month
  - Enterprise: unlimited, SLA, dedicated support
- Landing page: problem → solution → demo → pricing → CTA

### Day 16 — Documentation Site

- Quick start guide (5-minute integration)
- API reference
- Framework-specific guides (Next.js, Express, Hono, Remix)
- Security whitepaper explaining the threat model
- Migration guide from cookie-only sessions

### Day 17 — SDK Polish + Testing

- TypeScript types perfect
- JSDoc on every public method
- Bundle size optimization (target < 5KB client SDK)
- Browser compatibility testing (Chrome, Firefox, Safari, Edge)
- Load testing (100K verifications/minute target)

### Day 18 — Launch Preparation

- npm publish all packages
- GitHub repos (client SDK open source, server SDK commercial)
- ProductHunt preparation
- HN "Show HN" post
- Security community outreach (write-up on AiTM defense)

---

## PRICING STRATEGY (Phase 2)

| Plan | Price | Verifications | Features |
|------|-------|---------------|----------|
| Free | $0 | 1,000/mo | Client SDK, basic trust scoring |
| Pro | $49/mo | 50,000/mo | Full trust engine, dashboard, alerts |
| Team | $199/mo | 250,000/mo | Multi-user, SSO, audit log export |
| Enterprise | Custom | Unlimited | SLA, dedicated support, custom trust rules, on-prem option |

---

## COMPETITIVE LANDSCAPE

| Solution | What It Does | Gap |
|----------|-------------|-----|
| Clerk/Auth0/Supabase | Authentication + session management | No device binding, no trust scoring |
| Google DBSC | Device-bound session cookies | Chrome-only, not GA, requires TPM |
| CrowdStrike Falcon | Endpoint detection | $$$, overkill for web sessions, not a middleware |
| Cloudflare Access | Zero-trust proxy | Org-level, not session-level binding |
| **TokenForge** | Post-auth session integrity | **Works today, any auth provider, any framework, edge-native** |

---

## SUCCESS METRICS

### Phase 1 (Inside ClawShield)
- [ ] Zero false positives blocking legitimate users
- [ ] Successfully blocks replayed session tokens in testing
- [ ] Trust score accurately detects IP/geo changes
- [ ] Step-up auth flow completes in < 30 seconds
- [ ] < 5ms added latency per request for signature verification
- [ ] Zero impact on ClawShield reliability (error boundary works)

### Phase 2 (Standalone Product)
- [ ] npm package < 5KB (client)
- [ ] 5-minute integration for new customers
- [ ] 100 GitHub stars in first month
- [ ] 10 paying customers in first 3 months
- [ ] Featured in security newsletter or blog
