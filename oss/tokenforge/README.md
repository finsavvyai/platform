# TokenForge

## Post-Authentication Session Security

**"Your auth provider handles identity. TokenForge handles session integrity."**

TokenForge makes stolen session tokens useless by cryptographically binding them to the device that created them. It works with any auth provider (Clerk, Auth0, Supabase, custom) and any framework (Hono, Express, Next.js).

---

## The Problem

MFA protects the login moment. After authentication, everything rides on a session token. Steal the token — via AiTM phishing, XSS, browser extensions, or malware — and MFA is irrelevant. The attacker IS the user.

## The Solution

TokenForge generates a non-extractable ECDSA keypair in the browser via Web Crypto API. The private key can never be read by JavaScript — not by XSS, not by extensions, not by anyone. Every request must include a cryptographic signature proving the request comes from the original device. A stolen cookie without the device-bound key is worthless.

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Full technical architecture, security model, database schema, API design |
| [CLIENT_SDK.md](./docs/CLIENT_SDK.md) | Browser SDK spec — key generation, signing, fetch interception, React hooks |
| [SERVER_MIDDLEWARE.md](./docs/SERVER_MIDDLEWARE.md) | Server middleware — Hono implementation, trust scoring, binding, step-up auth |
| [EXECUTION_PLAN.md](./docs/EXECUTION_PLAN.md) | Day-by-day build plan — Phase 1 (ClawShield) + Phase 2 (standalone product) |

---

## Build Strategy

**Phase 1:** Build as `packages/tokenforge/` inside the ClawShield monorepo. Ship as a ClawShield feature. Validate with real users.

**Phase 2:** Extract to standalone npm packages. Launch as independent product targeting CISOs and security-conscious teams.

---

## Quick Reference

### Client (Browser)
```typescript
import { createTokenForge } from '@tokenforge/client';

const tf = createTokenForge({
  apiBase: 'https://api.example.com',
  getSessionId: () => clerkSession.id,
  onStepUpRequired: (reason) => showStepUpModal(reason),
  onSessionRevoked: () => redirectToLogin(),
});

await tf.init(); // generates keypair, binds to session
// All fetch() calls are now automatically signed
```

### Server (Hono/Cloudflare Workers)
```typescript
import { tokenForgeMiddleware } from '@tokenforge/server';

app.use('*', clerkMiddleware());      // identity
app.use('*', tokenForgeMiddleware({   // session integrity
  storage: { sessions: env.D1, nonces: env.KV },
  trustThresholds: { allow: 80, stepUp: 40 },
}));
```

### React
```tsx
<ClerkProvider>
  <TokenForgeProvider>
    <App />
  </TokenForgeProvider>
</ClerkProvider>
```

---

## Security Model Summary

| Layer | What It Does |
|-------|-------------|
| Non-extractable ECDSA keys | Private key can't be stolen via XSS |
| Challenge-response signing | Every request proves device possession |
| Nonce validation | Prevents replay attacks |
| Trust score engine | Continuous risk assessment per request |
| Step-up auth | Re-verify when trust drops |
| Session revocation | Instant kill switch for compromised sessions |

---

## License

Phase 1: Part of ClawShield (proprietary)
Phase 2: Client SDK — MIT | Server SDK — Commercial
