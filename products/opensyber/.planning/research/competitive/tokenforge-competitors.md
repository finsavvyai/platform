# TokenForge Competitive Intelligence — Auth & Session Security

> **Scope**: Analysis of 5 auth/session-security competitors vs. TokenForge's device-bound ECDSA P-256 non-extractable Web Crypto session SDK.
> **Prepared**: April 2026 | **Owner**: OpenSyber portfolio
> **TokenForge positioning**: "Step-up auth + session-theft prevention for developers. Bind every session to a device cryptographically — not just to a cookie."

---

## Competitive Landscape Summary

| Competitor | Device binding? | Crypto primitive | Non-extractable? | Dev-first SDK shape | Price signal |
|---|---|---|---|---|---|
| **Auth0 (Okta)** | Yes via DPoP (OAuth tokens) + DBSC roadmap | ECDSA via DPoP JWT | Browser-dependent (not SDK-enforced) | Heavy CIAM platform | $35–$240/mo + MAU overage |
| **WorkOS** | No (cookie + JWT only) | None | No | Enterprise SSO-first | Free <1M MAU, $2.5K/M MAU after |
| **Clerk** | No (session JWT + rotate) | None crypto-bound | No | Best DX for React/Next.js | $25 + $0.02/MAU beyond 10K MRU |
| **Stytch** | Device fingerprinting (fraud signal) | Hash-based fingerprint | N/A (not crypto) | Polyglot SDKs | $0.01/MAU consumer, $0.05 B2B |
| **Keyri** | Yes, ECDSA on mobile | ECDSA, non-extractable | Yes (mobile keychain) | Mobile-first QR | Free <1K MAU, usage-based |

---

## Auth0 (Okta)

Source: [auth0.com](https://auth0.com), [Okta CIAM](https://www.okta.com/products/customer-identity/), [Auth0 DPoP](https://auth0.com/docs/secure/sender-constraining/demonstrating-proof-of-possession-dpop), [Adaptive MFA](https://dev.auth0.com/docs/secure/multi-factor-authentication/adaptive-mfa/enable-adaptive-mfa)

- **Positioning tagline**: *"Get best-in-class customer identity, with security built in."* — Okta Customer Identity Cloud.
- **Primary persona**: Mid-market to enterprise CIAM buyers (B2C, B2B, B2E). Developer-friendly but increasingly enterprise-led since the Okta acquisition.
- **Core auth surface**: Username/password, social OAuth (30+ providers), SAML SSO, OIDC, passwordless (magic link, SMS, WebAuthn), passkeys, MFA (TOTP, push, WebAuthn), adaptive MFA, M2M tokens.
- **Device binding specifics**:
  - **DPoP (Demonstrating Proof of Possession)** — access/refresh tokens are cryptographically sender-constrained to a client key pair; the private key signs a JWT proof per request. Prevents stolen-token replay. ([auth0.com/blog/protect-your-access-tokens-with-dpop](https://auth0.com/blog/protect-your-access-tokens-with-dpop/))
  - **Adaptive MFA** — "New Device" assessor with TTL 1–365 days (default 30). Device "remembrance" is risk-scored, not cryptographic.
  - **DBSC (Device Bound Session Credentials)** — Auth0 references but does not yet ship first-party DBSC; relies on browser (Chrome 146 on Windows, activated April 9, 2026). ([FIDO Alliance DBSC/DPoP white paper](https://fidoalliance.org/white-paper-dbsc-dpop-as-complementary-technologies-to-fido-authentication/))
  - Non-extractable key storage is **browser-dependent**, not SDK-enforced.
- **Pricing model**: Free up to 25K MAU (2026 update), Essentials $35/mo, Professional $240/mo, Enterprise custom (~$30K+ ARR). Known "MAU growth penalty"; per-connection SSO fees $5K–$34K. ([auth0pricing.com](https://auth0pricing.com/))
- **SDK coverage**: SPA JS, Node, Python, Go, Java, .NET, PHP, Ruby, React, Angular, Vue, iOS (Swift), Android (Kotlin), React Native, Flutter.
- **Compliance**: SOC 2 Type II, ISO 27001, HIPAA, FedRAMP Moderate, PCI-DSS, GDPR.
- **Notable gaps vs. TokenForge**:
  - DPoP is OAuth-token-bound, not session-bound — **no per-request device attestation at the session layer**.
  - No Hono adapter; Next.js adapter exists but DPoP configuration is non-trivial.
  - No MCP integration.
  - Pricing penalizes the long-tail dev audience TokenForge targets.
- **Integration ecosystem**: Next.js (nextjs-auth0), Express, Rails, Laravel, Flask, Django, Spring. Hono is community-only.

---

## WorkOS

Source: [workos.com](https://workos.com), [WorkOS Pricing](https://workos.com/pricing), [Sessions docs](https://workos.com/docs/user-management/sessions), [Node SDK changelog](https://workos.com/changelog/improved-session-handling-in-the-node-sdk)

- **Positioning tagline**: *"Your app, Enterprise Ready."*
- **Primary persona**: YC-stage and growth B2B SaaS that need to bolt on SSO/SCIM quickly to close enterprise deals.
- **Core auth surface**: SAML/OIDC SSO (150+ IdPs), SCIM directory sync, magic link, OAuth social, MFA (TOTP, SMS), AuthKit hosted UI, audit logs.
- **Device binding specifics**:
  - **None.** Sessions are JWT access token + refresh token pair, stored as secure httpOnly cookies. Validated via JWKS.
  - Refresh tokens are rotated; no cryptographic binding to device, TPM, or secure enclave.
  - No DPoP, no DBSC, no passkey device-attestation in session layer.
- **Pricing model**: User Management free to **1M MAU**, then $2,500/mo per additional 1M. SSO priced per connection: $125/mo base, volume discounts to $65/mo at 51–100 connections. Audit logs $125/mo per SIEM + $99/mo per million events.
- **SDK coverage**: Node, Python, Ruby, Go, Java, PHP, .NET, Kotlin. Next.js and Remix first-party; "more framework support coming soon".
- **Compliance**: SOC 2 Type II, ISO 27001, HIPAA, GDPR, CCPA.
- **Notable gaps vs. TokenForge**:
  - **No session-theft prevention beyond rotation.** A stolen cookie = full session takeover.
  - No mobile SDKs (iOS/Android/RN) — browser/server only.
  - No Hono adapter, no MCP, limited framework depth beyond Next/Remix.
  - Missing: device attestation, ECDSA binding, passkey session challenge, step-up per action.
- **Integration ecosystem**: Strong Next.js and Remix; everything else is the base SDK.

---

## Clerk

Source: [clerk.com](https://clerk.com), [Session options](https://clerk.com/docs/authentication/configuration/session-options), [Android passkeys](https://clerk.com/docs/reference/android/passkeys), [Clerk vs Better Auth 2026](https://dev.to/thiago_alvarez_a7561753aa/clerk-vs-better-auth-2026-we-verified-every-price-so-you-dont-have-to-13pk)

- **Positioning tagline**: *"The most comprehensive User Management Platform"* — designed for React/Next.js dev experience.
- **Primary persona**: Indie devs and B2C/B2B startups building on Next.js, React Native, and Expo. Best-in-class DX is the wedge.
- **Core auth surface**: Email/password, social OAuth (Google/Apple/GitHub/etc.), magic link, SMS, email codes, passkeys, MFA (TOTP, backup codes, SMS), Enterprise SSO (SAML/OIDC) on paid plans, organizations, impersonation.
- **Device binding specifics**:
  - **None at the cryptographic layer.** Sessions are short-lived JWTs with Clerk-specific claims; validated via JWKS.
  - Session lifetime configurable (inactivity timeout, max lifetime default 7 days).
  - Passkeys for **login**, not for per-request session binding. Uses platform authenticators (Touch ID, Face ID, Windows Hello) at the WebAuthn layer only.
  - Multi-session (multiple accounts per browser) is a UX feature, not a security primitive.
  - No DPoP, no DBSC, no non-extractable session keys.
- **Pricing model**: Free up to 10K MRU (Monthly Retained Users — users returning 24h+ after signup). Pro $25/mo base + $0.02 per MAU beyond 10K. At 100K MAU ≈ $1,825/mo. MFA, passkeys, SSO are Pro-plan features.
- **SDK coverage**: Next.js (first-class), React, Remix, Expo/React Native (Mar 2026: native Google Sign-In with Credential Manager/ASAuthorization), iOS (SwiftUI native), Android (Jetpack Compose + Credential Manager), Node, Go, Ruby, Rails, Python, Chrome extension.
- **Compliance**: SOC 2 Type II, HIPAA (enterprise), GDPR, CCPA. ISO 27001 not publicly listed as of April 2026.
- **Notable gaps vs. TokenForge**:
  - **No device binding at all.** A leaked session JWT = takeover.
  - No MCP integration.
  - No Hono adapter (Clerk is Next/React-centric; Express is community).
  - No step-up auth with cryptographic device proof — passkey is sign-in only.
- **Integration ecosystem**: Next.js, Expo, Remix, Astro first-class. Framework depth lags outside of React ecosystem.

---

## Stytch

Source: [stytch.com](https://stytch.com), [Device Fingerprinting docs](https://stytch.com/docs/fraud/guides/device-fingerprinting/overview), [React Native SDK](https://www.npmjs.com/package/@stytch/react-native), [Stytch DFP announcement](https://siliconangle.com/2024/09/17/stytch-unveils-advanced-device-fingerprinting-features-enhance-application-security/), [DFP raw signals (2025.09.26)](https://changelog.stytch.com/announcements/2025-09-26-device-fingerprinting-raw-signals)

- **Positioning tagline**: *"A better way to build auth."* — positioned at the intersection of auth + fraud prevention.
- **Primary persona**: Consumer/fintech/B2B SaaS where bot fraud and account takeover matter (e.g., crypto, e-commerce, marketplaces).
- **Core auth surface**: Email/SMS magic links, passwords, passkeys, WebAuthn, OAuth, TOTP/SMS MFA, B2B SSO (SAML/OIDC), SCIM, organizations.
- **Device binding specifics**:
  - **Device Fingerprinting (DFP)** — collects browser/device attributes, synthesizes risk signals (bot, suspicious, trusted). Raw signals available since Sept 2025 for custom ML models.
  - "Protected Auth" enforces fingerprint-based decisions automatically.
  - **Fingerprint ≠ cryptographic binding.** Fingerprints are probabilistic identifiers, not tamper-proof. A stolen session cookie still works if the fingerprint matches the attacker's spoofed environment.
  - Biometric login supported on mobile (iOS 13+, Android 6+) — but that's device-side login, not session-layer attestation.
  - No ECDSA/non-extractable session keys, no DPoP.
- **Pricing model**: Consumer Auth — free <10K MAU, then $0.01/MAU (Essentials). B2B — $0.05/MAU (Growth). Device Fingerprinting priced separately by volume.
- **SDK coverage**: JS (browser), React, React Native (Expo + CLI), iOS (Swift), Android (Kotlin), Node, Python, Go, Ruby, Java. Polyglot breadth is a strength.
- **Compliance**: SOC 2 Type II, ISO 27001, HIPAA, GDPR, CCPA, PCI-DSS.
- **Notable gaps vs. TokenForge**:
  - Fingerprinting is fraud-signal, **not cryptographic session binding**. A well-crafted attack with matching fingerprint bypasses it.
  - No per-request session proof like DPoP.
  - No MCP integration.
  - No Hono adapter (has community wrappers only).
- **Integration ecosystem**: Strong polyglot, good Next.js and React Native support. Framework-adapter depth is mid-tier.

---

## Keyri

Source: [keyri.com](https://keyri.com), [Keyri Docs](https://docs.keyri.com/mobile-sdks), [iOS SDK](https://docs.keyri.com/mobile-sdks/ios), [Android SDK](https://github.com/Keyri-Co/keyri-android-whitelabel-sdk), [Keyri Pricing](https://keyri.com/pricing/), [Keyri SOC 2](https://www.keyri.com/keyri-is-now-soc2-compliant/)

- **Positioning tagline**: *"Secure fraud prevention and authentication platform for developers"* — device-bound passwordless, QR-first.
- **Primary persona**: Mobile-first consumer apps (fintech, crypto, high-fraud verticals) that want QR-based desktop login and device binding.
- **Core auth surface**: QR authentication (desktop ↔ mobile), mobile-app authentication, passwordless login, risk scoring, device fingerprinting, fraud prevention.
- **Device binding specifics** — **this is the closest competitor to TokenForge's crypto model**:
  - Mobile SDKs generate an **ECDSA key pair**; private key is **persistent on and non-extractable from the device**, stored in Keychain (iOS) / Keystore (Android).
  - Signing key pair is tied to an account identifier — the account is "bound" to the device.
  - QR login: desktop shows QR; mobile scans and signs the auth challenge with the bound key. Verifies both identity and device presence.
  - TPM/Secure Enclave backed on modern devices.
  - **Mobile-only.** No equivalent browser-side non-extractable key SDK — browser QR is just the scanner target.
- **Pricing model**: Free Developer plan up to 5K API calls or 1K MAU. Scaling plan usage-based, contact sales for enterprise. Far less documented than Auth0/Clerk.
- **SDK coverage**: iOS (Swift), Android (Kotlin), React Native. **No Go, no Python, no Swift server, no Hono/Express adapters, no MCP.**
- **Compliance**: SOC 2 Type II (achieved). ISO 27001 not listed publicly.
- **Notable gaps vs. TokenForge**:
  - **Mobile-first only.** Browser is a scan target, not a first-class device-bound session runtime. TokenForge's browser-side non-extractable Web Crypto key is a direct gap.
  - No server-side adapters (Hono/Express/Next.js) beyond REST API.
  - No step-up auth flow as a primitive — device binding is account-level, not per-action.
  - No MCP integration.
  - Smaller distribution — the mindshare fight is uphill.
- **Integration ecosystem**: Mobile SDKs + REST API. Thin at the framework layer.

---

## Differentiation Plan for TokenForge

### 5 Features to Lead With

1. **Device-bound ECDSA P-256 sessions on the web (not just mobile)** — TokenForge's non-extractable Web Crypto key in the browser is what Keyri offers on mobile but no one ships cleanly for the web. DPoP is the closest analog, but it's OAuth-token-scoped and complex. Lead message: **"Your session now costs an attacker a device, not a cookie."**
2. **Non-extractable keys end-to-end** — `extractable: false` on both browser (Web Crypto + IndexedDB) and mobile (Keychain/Keystore). Demonstrate with a live "steal the cookie" attack video where the stolen cookie is useless without the device-bound private key.
3. **Framework-deep adapters** — Hono, Express, Next.js, React bindings out of the box. Competitors skew Next.js-only (Clerk), enterprise-only (WorkOS), or heavy (Auth0). Hono + edge-first is the underserved niche.
4. **MCP integration for AI agent auth** — the only SDK in this lineup with first-class MCP. As AI agents need to hold session tokens, device-bound proofs become the only defensible primitive. Ship `@opensyber/tokenforge-mcp` as the flag.
5. **Step-up auth as a first-class primitive** — `requireDeviceProof()` middleware that challenges the bound key per high-risk action (billing, admin, data export). Auth0 charges enterprise prices for this; Clerk, WorkOS, Stytch don't offer it at all.

### 3 Positioning Angles

- **"The only dev-first device-binding SDK for the web."** Keyri owns mobile; TokenForge owns browser + mobile + edge server. One SDK family, Web Crypto-native, non-extractable by default.
- **"Post-password session security for AI agents."** As AI agents hold tokens on behalf of users, the blast radius of a stolen token is catastrophic. TokenForge's MCP + device-bound sessions become the compliance-grade answer. Tie into OpenSyber's agent narrative.
- **"DPoP for the rest of us."** DPoP is the IETF-blessed primitive but it's implementation-heavy and OAuth-scoped. TokenForge is the batteries-included, framework-adapter version — no RFC reading required.

### 2 Pricing Levers

- **Per-device, not per-MAU.** Charge $0.002 per bound device per month (free <10K devices). Penalizes the attacker's economic model (attackers need a device per bound session), not the customer's growth. Inverts Auth0's "growth penalty".
- **Free forever for <10K MAU + all adapters.** Clerk charges $25/mo for MFA/passkeys; TokenForge includes device binding, step-up, and every framework adapter free up to 10K MAU. Above that, usage-based on devices and step-up challenges, not raw MAU.

### 1 Bold Bet

**Open-source the core SDK (client + server adapters) under MIT, keep the managed device registry + threat intel hosted.** This is the Supabase/Clerk-alternative play. Competitors (Auth0, WorkOS, Clerk, Stytch, Keyri) are all closed. An open TokenForge client SDK becomes the de facto Web Crypto session-binding standard, and OpenSyber monetizes the hosted device registry, audit trail, and cross-tenant threat intel. Every security-conscious indie dev becomes a distribution node.

---

## Top Threat Ranking

| Rank | Competitor | Threat | Why |
|---|---|---|---|
| 1 | **Clerk** | Developer mindshare in React/Next.js ecosystem | TokenForge's natural buyer lives here |
| 2 | **Auth0** | DPoP is a technically credible device-binding story | If Okta ships DBSC/DPoP in dev SDKs, gap shrinks |
| 3 | **Keyri** | Only competitor with genuine non-extractable crypto binding | Closest match on the *security* axis, mobile-first only |
| 4 | **Stytch** | Fingerprinting muddies the "device binding" message | Buyers may conflate fraud signal with crypto proof |
| 5 | **WorkOS** | Enterprise SSO gravity drags the market | B2B buyers default-pick for the checkbox, not the security |

---

## Sources

- Auth0 DPoP: https://auth0.com/docs/secure/sender-constraining/demonstrating-proof-of-possession-dpop
- Auth0 blog — Protect Access Tokens with DPoP: https://auth0.com/blog/protect-your-access-tokens-with-dpop/
- Auth0 Adaptive MFA: https://dev.auth0.com/docs/secure/multi-factor-authentication/adaptive-mfa/enable-adaptive-mfa
- Auth0 Pricing Guide: https://auth0pricing.com/
- FIDO Alliance — DBSC/DPoP white paper: https://fidoalliance.org/white-paper-dbsc-dpop-as-complementary-technologies-to-fido-authentication/
- WorkOS Sessions: https://workos.com/docs/user-management/sessions
- WorkOS Pricing: https://workos.com/pricing
- WorkOS Node SDK session handling: https://workos.com/changelog/improved-session-handling-in-the-node-sdk
- Clerk Session Options: https://clerk.com/docs/authentication/configuration/session-options
- Clerk vs Better Auth pricing 2026: https://dev.to/thiago_alvarez_a7561753aa/clerk-vs-better-auth-2026-we-verified-every-price-so-you-dont-have-to-13pk
- Clerk Android Passkeys: https://clerk.com/docs/reference/android/passkeys
- Stytch Device Fingerprinting: https://stytch.com/docs/fraud/guides/device-fingerprinting/overview
- Stytch React Native SDK: https://www.npmjs.com/package/@stytch/react-native
- Stytch DFP raw signals: https://changelog.stytch.com/announcements/2025-09-26-device-fingerprinting-raw-signals
- Keyri Mobile SDKs: https://docs.keyri.com/mobile-sdks
- Keyri iOS SDK: https://docs.keyri.com/mobile-sdks/ios
- Keyri SOC 2 compliance: https://www.keyri.com/keyri-is-now-soc2-compliant/
- Keyri Pricing: https://keyri.com/pricing/
- DBSC W3C spec: https://github.com/w3c/webappsec-dbsc
- Chrome 146 DBSC on Windows (Apr 9, 2026): https://www.anavem.com/en/news/google/chrome-146-adds-device-bound-session-credentials-on-windows
