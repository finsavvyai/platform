# Show HN: TokenForge -- Device-bound session security that makes stolen cookies useless

Your MFA is great. But after login, a single stolen cookie gives an attacker full access. Evilginx, AitM phishing, infostealers -- they all steal session cookies, and MFA can't help because the user already authenticated.

TokenForge binds every session to a cryptographic key that never leaves the device. If someone steals your cookie, they can't use it -- every request requires a signature from the bound key.

**How it works:**

1. User logs in (your existing auth -- Clerk, Auth.js, Okta, whatever)
2. TokenForge generates an ECDSA P-256 non-extractable key in the browser
3. A short-lived cookie (5min TTL) is bound to that key
4. Every refresh requires a signed nonce -- no key, no refresh, stolen cookie dies in 5 minutes

**Integration: one script tag**

```html
<script src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_key"></script>
```

Or use the SDK with framework adapters (Hono, Express, Next.js, Fastify, SvelteKit, Astro).

**Two modes:**

- **Customer Mode**: Protect your SaaS end-users. Free tier: 1,000 MAU
- **Workforce Mode**: Compete with Cisco Duo Passport at $4-7/user/mo vs their $9. OIDC connectors for Okta, Entra, Google Workspace, Auth0. Policy DSL for geo-blocking, ASN restrictions, step-up rules

**Built on the W3C DBSC spec** (Device Bound Session Credentials). When Chrome ships native DBSC with TPM backing, TokenForge apps get hardware-backed keys for free -- same protocol, zero code changes.

**What's different from Duo Passport:**

- Self-serve (no sales call)
- Open protocol (W3C DBSC, not proprietary)
- Works for customer-facing apps (Duo only does workforce)
- Half the price for workforce mode
- 6 framework adapters + native SDKs (Go, Python, Kotlin, Swift, React Native)

**Stack:** Hono on Cloudflare Workers, D1 (SQLite), Web Crypto API. Full OpenAPI spec at tokenforge-api.opensyber.cloud/v1/openapi.json

**Open questions we'd love feedback on:**

1. Would you use device-bound sessions for customer-facing apps, or only internal workforce?
2. Is the one-script-tag DX compelling enough, or do you need the full SDK for real apps?
3. What's your biggest concern with session security post-authentication?

Live at: https://tokenforge.opensyber.cloud
Docs: https://tokenforge.opensyber.cloud/docs
Status: https://tokenforge.opensyber.cloud/status
OpenAPI: https://tokenforge-api.opensyber.cloud/v1/openapi.json
