# TokenForge — Session Security Layer

## Architecture & Technical Specification

**Version:** 1.0
**Date:** February 27, 2026
**Author:** Shachar Solomon
**Status:** Phase 1 — Embedded in ClawShield

---

## 1. THE PROBLEM

MFA protects the login. Nothing protects the session.

After a user authenticates (even with passkeys, TOTP, or biometrics), the application issues a session token. That token IS the user's identity for every subsequent request. Steal the token, become the user.

### Attack Vectors That Bypass MFA

| Attack | How It Works | MFA Helps? |
|--------|-------------|------------|
| AiTM Phishing (Evilginx) | Proxy sits between user and real login, captures token after MFA completes | No |
| XSS Cookie Theft | Injected script reads document.cookie and exfiltrates | No |
| Browser Extension Malware | Extension with cookie permissions reads all session cookies | No |
| Session Fixation | Attacker pre-sets session ID, user authenticates with it | No |
| Token from Logs/Memory | Token leaked in server logs, browser memory dump, or debug output | No |
| Man-in-the-Browser | Malware hooks browser APIs to intercept tokens in real-time | No |

### The Industry Gap

- **Clerk, Auth0, Supabase Auth, Firebase Auth** → handle identity and authentication
- **Nobody** → handles post-authentication session integrity with device binding
- **Google DBSC** → proposed standard, Chrome-only, not yet widely available
- **TokenForge** → fills this gap today, works with any auth provider

---

## 2. THE SOLUTION

TokenForge is a session security middleware that makes stolen tokens useless by cryptographically binding them to the device that created them.

### Core Principle

```
Traditional Session:
  Cookie = "session_abc123" → Anyone with this string IS the user

TokenForge Session:
  Cookie = "session_abc123" + must prove possession of device-bound private key
  → Stolen cookie alone is worthless
```

### How It Works

```
┌─────────────────────────────────────────────────────┐
│                  User's Browser                      │
│                                                      │
│  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │ Auth Provider│  │ TokenForge Client SDK        │  │
│  │ (Clerk/Auth0)│  │                              │  │
│  │             │  │  1. Generate ECDSA P-256     │  │
│  │  Login +    │  │     keypair (non-extractable) │  │
│  │  MFA        │  │  2. Store in IndexedDB       │  │
│  │  ↓          │  │  3. Sign challenge on each   │  │
│  │  Session    │  │     request                  │  │
│  │  Token      │  │  4. Send signature in header │  │
│  └──────┬──────┘  └──────────────┬───────────────┘  │
│         │                        │                   │
└─────────┼────────────────────────┼───────────────────┘
          │                        │
          ▼                        ▼
┌─────────────────────────────────────────────────────┐
│              TokenForge Server Middleware             │
│  (Cloudflare Worker / Express middleware / etc.)      │
│                                                      │
│  1. Receive session token + signature + nonce        │
│  2. Lookup public key bound to this session          │
│  3. Verify signature over challenge nonce            │
│  4. Check trust signals (IP, geo, user-agent)        │
│  5. Compute trust score (0-100)                      │
│  6. If score < threshold → force step-up auth        │
│  7. If signature invalid → revoke session            │
│  8. Log everything for security dashboard            │
│                                                      │
│  Storage: D1/Postgres for sessions, KV for nonces    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 Your Application                     │
│  Request arrives ONLY if TokenForge approves it      │
└─────────────────────────────────────────────────────┘
```

---

## 3. SECURITY MODEL

### 3.1 Device-Bound Keys (Web Crypto API)

```typescript
// Key generation — runs once after successful authentication
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,  // NON-EXTRACTABLE — this is critical
  ['sign', 'verify']
);
```

**Why non-extractable matters:**
- The private key NEVER exists as a readable value
- JavaScript cannot access the raw key bytes
- XSS attacks cannot steal the key — they can only get a CryptoKey handle
- The CryptoKey handle is bound to the browser's origin and crypto engine
- Even `JSON.stringify(keyPair.privateKey)` returns `{}`

**Storage:** IndexedDB with origin isolation. Keys survive page refreshes and browser restarts but are isolated per origin.

### 3.2 Challenge-Response Protocol

```
For every authenticated request:

1. Client reads current nonce from response header or pre-fetched pool
2. Client constructs payload: `${sessionId}:${nonce}:${timestamp}`
3. Client signs payload with device-bound private key
4. Client sends: Cookie + X-TF-Signature + X-TF-Nonce + X-TF-Timestamp
5. Server looks up public key for session
6. Server verifies signature
7. Server checks nonce freshness (not reused, not expired)
8. Server checks timestamp skew (< 30 seconds)
9. Request proceeds or gets rejected
```

### 3.3 Trust Score Engine

Every request gets a trust score (0-100) based on multiple signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| Signature Valid | 40 | Device-bound key proof-of-possession |
| IP Consistency | 15 | Same IP as session creation |
| Geo Consistency | 15 | Same country/region (via CF headers) |
| User-Agent Match | 10 | Same browser fingerprint |
| Request Velocity | 10 | Normal request patterns |
| Time of Day | 5 | Matches user's normal activity window |
| Nonce Freshness | 5 | Challenge response within time window |

**Actions based on score:**

| Score Range | Action |
|------------|--------|
| 80-100 | Allow — normal operation |
| 60-79 | Allow + flag — log for review |
| 40-59 | Step-up — require re-authentication |
| 0-39 | Block — revoke session, force full re-login |

### 3.4 What TokenForge DOES and DOES NOT Protect Against

| Attack | Protected? | Why |
|--------|-----------|-----|
| AiTM phishing (Evilginx) | ✅ Yes | Attacker gets cookie but not the non-extractable private key |
| Cookie theft via XSS | ✅ Yes | Cookie alone is useless without device key signature |
| Cookie theft via network sniff | ✅ Yes | Same — cookie without key is worthless |
| Session replay from logs | ✅ Yes | Nonce prevents replay, key prevents forgery |
| Browser extension stealing cookies | ✅ Yes | Cookie insufficient without CryptoKey |
| Full browser takeover (RAT/malware) | ⚠️ Partial | Attacker could call sign() in-browser, but anomaly detection may catch behavioral differences |
| Physical device theft (unlocked) | ❌ No | Attacker has the device = has the key. Step-up auth helps here. |
| Compromised auth provider | ❌ No | Not our layer — we protect post-auth, not auth itself |

---

## 4. TECH STACK

### Phase 1: Embedded in ClawShield

| Component | Technology |
|-----------|-----------|
| Server Middleware | Hono middleware on Cloudflare Workers |
| Session Store | Cloudflare D1 (sessions table) |
| Nonce Store | Cloudflare KV (TTL-based, auto-expiring) |
| Public Key Store | Cloudflare D1 (device_keys table) |
| Client SDK | Vanilla TypeScript (framework-agnostic) |
| Trust Score Engine | TypeScript, runs in Worker |
| Security Event Log | Cloudflare R2 (batched JSON logs) |
| Dashboard | Part of ClawShield Next.js dashboard |

### Phase 2: Standalone Product

| Component | Technology |
|-----------|-----------|
| Server SDK | npm package — Express, Hono, Fastify, Next.js adapters |
| Edge Proxy | Optional Cloudflare Worker proxy mode |
| Client SDK | npm package — React, Vue, vanilla JS |
| API | Hono on Cloudflare Workers |
| Dashboard | Standalone Next.js app |
| Storage | Cloudflare D1 + KV + R2 (multi-tenant) |
| Billing | Stripe usage-based |

---

## 5. DATABASE SCHEMA

```sql
-- Core session binding table
CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,          -- from auth provider (Clerk session ID)
  user_id TEXT NOT NULL,             -- from auth provider
  public_key TEXT NOT NULL,          -- ECDSA P-256 public key (JWK format)
  device_fingerprint TEXT,           -- UA + accept-language hash
  ip_address TEXT,                   -- IP at binding time
  country_code TEXT,                 -- CF-IPCountry at binding time
  trust_score INTEGER DEFAULT 100,   -- current trust score
  bound_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,          -- hard session expiry
  revoked INTEGER DEFAULT 0,
  revoked_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_device_sessions_session ON device_sessions(session_id);
CREATE INDEX idx_device_sessions_user ON device_sessions(user_id);
CREATE INDEX idx_device_sessions_expires ON device_sessions(expires_at);

-- Security events log
CREATE TABLE security_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- SIGNATURE_INVALID, IP_CHANGE, GEO_ANOMALY,
                                     -- TRUST_DROP, SESSION_REVOKED, STEP_UP_TRIGGERED,
                                     -- NONCE_REPLAY, DEVICE_MISMATCH
  trust_score_before INTEGER,
  trust_score_after INTEGER,
  ip_address TEXT,
  country_code TEXT,
  user_agent TEXT,
  metadata TEXT,                     -- JSON blob with event-specific data
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_security_events_session ON security_events(session_id);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created ON security_events(created_at);

-- Step-up auth challenges
CREATE TABLE step_up_challenges (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,              -- why step-up was triggered
  status TEXT DEFAULT 'pending',     -- pending, completed, expired, failed
  method TEXT,                       -- totp, passkey, email_otp
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX idx_step_up_session ON step_up_challenges(session_id);
```

---

## 6. API ENDPOINTS

### Internal API (used by ClawShield dashboard)

```
POST   /api/tf/bind              — Bind device key to session after auth
POST   /api/tf/verify            — Verify signature on each request (middleware)
POST   /api/tf/step-up/initiate  — Trigger step-up authentication
POST   /api/tf/step-up/complete  — Complete step-up challenge
DELETE /api/tf/sessions/:id      — Revoke a specific session
GET    /api/tf/sessions          — List active sessions for user
GET    /api/tf/events            — Security events for user/admin
GET    /api/tf/trust-score       — Current trust score for session
```

### Future Standalone API (Phase 2)

```
POST   /v1/bind                  — Bind device to session (multi-tenant)
POST   /v1/verify                — Verify request signature
GET    /v1/sessions              — List sessions
DELETE /v1/sessions/:id          — Revoke session
GET    /v1/events                — Security event stream
GET    /v1/analytics             — Trust score analytics
POST   /v1/webhooks              — Configure webhook notifications
```

---

## 7. INTEGRATION POINTS

### With Clerk (ClawShield Phase 1)

```typescript
// In ClawShield's Hono API — after Clerk middleware authenticates

import { clerkMiddleware } from '@hono/clerk-auth';
import { tokenForgeMiddleware } from './tokenforge/middleware';

const app = new Hono();

// 1. Clerk handles identity
app.use('*', clerkMiddleware());

// 2. TokenForge handles session integrity
app.use('*', tokenForgeMiddleware({
  storage: {
    sessions: env.D1,
    nonces: env.KV,
  },
  trustThresholds: {
    allow: 80,
    stepUp: 40,
    block: 0,
  },
  sessionMaxAge: 24 * 60 * 60, // 24 hours
  nonceExpiry: 60,              // 60 seconds
  skipPaths: ['/api/public/*', '/api/health'],
}));

// 3. Your app routes — only reached if both Clerk AND TokenForge approve
app.get('/api/instances', listInstances);
app.post('/api/instances', createInstance);
```

### With Any Auth Provider (Phase 2)

```typescript
// Express example
import { tokenForge } from '@tokenforge/express';

app.use(tokenForge({
  apiKey: process.env.TOKENFORGE_API_KEY,
  getSessionId: (req) => req.cookies.session_id,
  getUserId: (req) => req.user.id,
  onStepUpRequired: (req, res) => {
    res.status(403).json({ action: 'step_up_required' });
  },
  onBlocked: (req, res) => {
    res.status(401).json({ action: 'session_revoked' });
  },
}));
```
