# Changelog

All notable changes to TokenForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-08

### General Availability

First stable release. The protocol surface is locked; subsequent 1.x releases
are backward-compatible additions only. SemVer applies from this release on.

#### What's new since 0.1.x

**Sprint 36 — Workforce SSO (replaces Cisco Duo $9/u/mo Premier tier):**
- 5 OIDC IdP integrations: Okta, Microsoft Entra (Azure AD), Google Workspace,
  Auth0, generic OIDC. JWKS cache with 24-hour freshness + stale-fallback.
- SAML 2.0 SP metadata + Assertion Consumer Service. Multi-IdP per tenant.
- Workforce subjects table with email/displayName extraction; xmlsoap claim
  fallback for Microsoft AD FS / Azure AD compatibility.

**Sprint 37 — DBSC Protocol (W3C device-bound session credentials):**
- Aligned with W3C DBSC draft + Chrome 146 native rollout (April 2026).
- POST `/v1/dbsc/challenge` — register/refresh/step_up purposes, TTL clamped 15-300s.
- POST `/v1/dbsc/register` — JWS-signed challenge response, ECDSA P-256.
- POST `/v1/dbsc/refresh` — bound-cookie rotation with risk-engine action gates.
- POST `/v1/dbsc/sessions/:id/revoke` — admin soft-revoke with audit reason.
- GET `/.well-known/tokenforge/jwks` — public verifier keys, 5-min edge cache.
- GET `/.well-known/tokenforge/dbsc` — service descriptor for browser SDK
  auto-discovery.
- Per-tenant policy engine with `if_any` / `then` rules; supports geo, ASN,
  fingerprint, sensitive-path conditions; `block` / `step_up` / `revoke_session`
  actions.

**Sprint 39 — AitM Detection + Per-Route Step-Up:**
- Real-time AitM heuristics: origin mismatch, UA drift, IP-country jump,
  resolution swap, ASN change. 9 signals scored 0-100.
- Per-tenant step-up policies via `tf_tenants.step_up_actions` JSON column.
- Path-level `requireFreshSig` + `requireWebAuthn` per documented action.
- Action signing (action-verify.ts): 5-second-fresh JWS for sensitive
  operations like `transfer`, `delete-account`, `change-mfa`.
- Step-up flow: TOTP, Email OTP, WebAuthn passkey factors. OTP wrong-code
  does NOT consume the OTP (anti-burn guard).

**Sprint 35 — SSE / Network Egress (Cisco Secure Access alternative):**
- Self-host stack: Squid + e2guardian + Unbound RPZ + Kasm RBI.
- `tf_signing_keys` schema; well-known JWKS endpoint serves real keys.

**Cross-cutting hardening:**
- Webhook dispatch with HMAC-SHA256 signing, secret rotation grace window,
  retry schedule [1s, 4s, 15s], stable X-TF-Delivery-Id across retries.
- WebAuthn (Sprint E1): hardware-bound passkey alongside ECDSA P-256.
- TLS exporter binding (RFC 9266) where workerd exposes it.
- UTC-anchored month boundaries across all usage/quota/compliance routes.

**Coverage at GA:**
- `@opensyber/tokenforge`: 544 unit tests, all green
- `@opensyber/tokenforge-api` (server): 796 integration tests, all green
- TypeScript strict mode, `tsc --noEmit` clean
- 200-line file cap enforced across `src/`

#### Breaking changes from 0.1.x

None. The 0.1.x exports remain. Additions only:
- `@opensyber/tokenforge/server/internal` — DBSC + step-up + action-verify
- `@opensyber/tokenforge/webhooks` — receiver-side verifyWebhookSignature

#### Hosted service tiers (unchanged from 0.1.x):
- Free: 1,000 verifications/month
- Pro: $49/mo — 50,000 verifications/month
- Team: $199/mo — 250,000 verifications/month
- Enterprise: custom

---

## [0.1.0] — 2026-03-25

### Initial Release

TokenForge is now available as a public npm package for preventing session hijacking, token theft, and related post-authentication attacks through device-bound session security.

#### Core Features

- **Device-Bound Session Security**: ECDSA P-256 cryptographic key binding on every request after login
- **Zero-Configuration Client**: Single script tag auto-generates keys, binds sessions, and signs all `fetch()` requests
- **Real-Time Trust Scoring**: 7-signal anomaly detection system (0-100 score) with configurable thresholds:
  - Signature verification (30%)
  - IP address consistency (15%)
  - Geolocation matching (15%)
  - Browser fingerprint (15%)
  - Request velocity analysis (10%)
  - Clock skew detection (10%)
  - Nonce replay protection (5%)
- **Replay Attack Prevention**: Nonce validation prevents request replay attacks
- **Server-Side Verification**: All cryptographic verification runs on TokenForge infrastructure (no client-side crypto needed)

#### Framework Adapters

- **Express**: `@opensyber/tokenforge/express` middleware
- **Next.js**: `@opensyber/tokenforge/nextjs` middleware wrapper
- **Fastify**: `@opensyber/tokenforge/fastify` plugin
- **Hono**: `@opensyber/tokenforge/hono` middleware

#### React Integration

- **React Hooks**: `TokenForgeProvider` and `useTokenForge()` for React 18+
- **Component-level Configuration**: Flexible API base and session ID provider

#### Client SDKs

TokenForge client SDKs available in 6 languages (published separately):

- **TypeScript/MCP**: Full-featured reference implementation
- **Python**: Native Python client with async support
- **Go**: Standard Go library with configurable HTTP client
- **Kotlin**: Android/JVM integration
- **Swift**: iOS/macOS integration
- **React Native**: Cross-platform mobile development

#### Storage Abstractions

- **Modular Storage Layer**: Interfaces for custom session storage implementations
- **Built-in Adapters** (optional):
  - D1 (Cloudflare Workers)
  - PostgreSQL
  - Redis
  - Generic in-memory storage

#### Export Map

- `@opensyber/tokenforge` — Main barrel export
- `@opensyber/tokenforge/client` — Client SDK
- `@opensyber/tokenforge/server` — Server verification
- `@opensyber/tokenforge/react` — React hooks and provider
- `@opensyber/tokenforge/shared` — Type definitions
- `@opensyber/tokenforge/express` — Express middleware
- `@opensyber/tokenforge/nextjs` — Next.js middleware
- `@opensyber/tokenforge/fastify` — Fastify plugin
- `@opensyber/tokenforge/hono` — Hono middleware
- `@opensyber/tokenforge/storage` — Storage layer abstractions

#### Security Properties

- **Protects Against**:
  - Session hijacking via stolen cookies
  - Attacker-in-the-Middle (AiTM) relay proxies
  - XSS token exfiltration
  - Token replay attacks
  - Anomalous request patterns
- **No Single Point of Failure**: Device key never leaves client, server verification independent
- **Auth Provider Agnostic**: Works with any auth system (Clerk, Auth.js, Firebase, custom JWT, etc.)

#### Documentation

- Comprehensive README with quick-start examples
- Framework-specific integration guides
- Trust scoring signal definitions
- Pricing information (free tier: 1,000 verifications/month)

#### License

Client SDK: MIT | Server verification requires API key from [tokenforge.opensyber.cloud](https://tokenforge.opensyber.cloud)

---

**Links:**
- Documentation: https://tokenforge.opensyber.cloud
- Repository: https://github.com/opensyber/tokenforge
- npm: https://www.npmjs.com/package/@opensyber/tokenforge
