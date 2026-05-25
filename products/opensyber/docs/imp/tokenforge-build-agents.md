# TokenForge — Complete Build Prompts
> Claude Code Agent Instructions
> Run agents L1–L6 in parallel
> Full product build from architecture spec

---

## WHAT TOKENFORGE IS

```
The problem:
  MFA protects the login moment.
  After authentication, everything rides on a session token.
  Steal the token — via phishing, XSS, browser extensions, malware —
  and MFA is completely irrelevant. The attacker IS the user.

The solution:
  TokenForge generates a non-extractable ECDSA P-256 keypair
  in the browser via Web Crypto API.
  The private key can NEVER be read by JavaScript.
  Not by XSS. Not by extensions. Not by anyone.
  Every request must include a cryptographic signature
  proving it comes from the original device.
  A stolen cookie without the device-bound key is worthless.

The mission:
  "MFA protects the login. TokenForge protects everything after."

Build strategy:
  Phase 1: Build as packages/tokenforge/ inside OpenSyber/ClawShield monorepo
  Phase 2: Extract to standalone npm packages + product site

Stack:
  Browser SDK: TypeScript + Web Crypto API + IndexedDB
  Server middleware: Hono 4 (Cloudflare Workers)
  Storage: Cloudflare D1 (sessions) + KV (nonces)
  Site: SvelteKit 2 on Cloudflare Pages (same pattern as OpenSyber)
  Design: Dark theme, same tokens as OpenSyber
```

---

## CORE ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                  User's Browser                      │
│                                                      │
│  Auth Provider (Better Auth / Clerk / custom)        │
│    Login + MFA → Session Token                       │
│         ↓                                            │
│  TokenForge Client SDK                               │
│    1. Generate ECDSA P-256 keypair (non-extractable) │
│    2. Store private key in IndexedDB                 │
│    3. Send public key to server (binding)            │
│    4. Sign challenge nonce on EVERY request          │
│    5. Attach X-TF-Signature header automatically     │
└─────────────────────┬───────────────────────────────┘
                      │ Session cookie + signature + nonce
                      ▼
┌─────────────────────────────────────────────────────┐
│          TokenForge Server Middleware                 │
│  (Cloudflare Worker / Hono middleware)               │
│                                                      │
│  1. Receive: session token + signature + nonce       │
│  2. Lookup: public key bound to this session         │
│  3. Verify: ECDSA signature over challenge nonce     │
│  4. Score: 7 trust signals → 0-100 trust score       │
│  5. Decide: allow / step-up / revoke                 │
│  6. Log: every decision to security dashboard        │
└─────────────────────┬───────────────────────────────┘
                      ↓
              Your Application
              (Request arrives only if TokenForge approves)
```

---

## TRUST SCORE ENGINE

```
Signal              Weight   Description
────────────────────────────────────────────────────────
Signature Valid       40     Device-bound key proof-of-possession
IP Consistency        15     Same IP as session creation
Geo Consistency       15     Same country/region (CF headers)
User-Agent Match      10     Same browser fingerprint
Request Velocity      10     Normal request frequency pattern
Time of Day            5     Matches user's normal activity window
Nonce Freshness        5     Challenge response within 60s window

Score → Action:
  80–100  Allow — normal operation
  60–79   Allow + flag — log for review, no user impact
  40–59   Step-up — require re-authentication prompt
  0–39    Revoke — session terminated, force full re-login
```

---

# ══════════════════════════════════════
# AGENT L1 — DATABASE SCHEMA + SEED
# Everything TokenForge stores
# ══════════════════════════════════════

```prompt
You are building TokenForge, a device-bound session security system.
Stack: Cloudflare D1 + Drizzle ORM.

YOUR TASK: Create the complete D1 schema for TokenForge.

FILE: packages/tokenforge/migrations/0001_init.sql

Run with: wrangler d1 execute tokenforge-db --file=packages/tokenforge/migrations/0001_init.sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Device sessions: one row per device-session binding
CREATE TABLE IF NOT EXISTS device_sessions (
  id TEXT PRIMARY KEY,                    -- uuid

  -- Session linkage (from auth provider)
  session_id TEXT NOT NULL,              -- auth provider session ID
  user_id TEXT NOT NULL,                 -- auth provider user ID
  org_id TEXT,                           -- optional org context

  -- Device identity
  device_id TEXT NOT NULL UNIQUE,        -- generated UUID, stored in browser
  device_fingerprint TEXT,               -- browser fingerprint hash
  user_agent TEXT,                       -- User-Agent at binding time

  -- Cryptographic binding
  public_key_jwk TEXT NOT NULL,          -- ECDSA P-256 public key (JWK format)
  public_key_hash TEXT NOT NULL,         -- SHA-256 of public key (quick lookup)

  -- Network context at binding time
  bound_ip TEXT NOT NULL,                -- IP at session creation
  bound_country TEXT,                    -- CF-IPCountry at binding
  bound_city TEXT,                       -- CF-IPCity if available

  -- Trust state
  trust_score INTEGER DEFAULT 100,       -- current trust score (0-100)
  trust_flags TEXT DEFAULT '[]',         -- JSON array of active trust flags
  step_up_required INTEGER DEFAULT 0,    -- 1 = pending step-up auth
  is_revoked INTEGER DEFAULT 0,          -- 1 = permanently revoked
  revoke_reason TEXT,                    -- why this session was revoked

  -- Lifecycle
  key_rotates_at TEXT,                   -- when key should be rotated (30 days)
  expires_at TEXT NOT NULL,              -- session expiry
  last_seen_at TEXT,                     -- last successful request
  request_count INTEGER DEFAULT 0,       -- total requests from this device
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Security events: every trust decision logged
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  device_session_id TEXT NOT NULL REFERENCES device_sessions(id),
  user_id TEXT NOT NULL,

  -- What happened
  event_type TEXT NOT NULL CHECK(event_type IN (
    'binding_created',    -- new device bound
    'request_allowed',    -- normal approved request
    'request_flagged',    -- allowed but logged (score 60-79)
    'step_up_triggered',  -- re-auth required (score 40-59)
    'session_revoked',    -- session terminated (score <40)
    'key_rotated',        -- keypair rotated (30-day cycle)
    'ip_change',          -- IP address changed
    'geo_change',         -- country/region changed
    'velocity_anomaly',   -- unusual request frequency
    'replay_attempt',     -- nonce reuse detected
    'signature_invalid',  -- bad ECDSA signature
    'nonce_expired',      -- nonce too old (>60s)
    'step_up_completed',  -- user completed re-auth
    'step_up_failed'      -- user failed re-auth
  )),

  -- Trust context at event time
  trust_score INTEGER,                   -- score when event fired
  trust_signals TEXT,                    -- JSON: which signals triggered
  request_ip TEXT,                       -- IP for this specific request
  request_country TEXT,

  -- Request context
  http_method TEXT,
  request_path TEXT,
  response_action TEXT CHECK(response_action IN ('allow','flag','step_up','revoke')),

  severity TEXT DEFAULT 'INFO' CHECK(severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  metadata TEXT DEFAULT '{}',           -- JSON: additional context
  created_at TEXT DEFAULT (datetime('now'))
);

-- Nonce registry: prevent replay attacks
-- TTL managed by KV, but D1 used for audit
CREATE TABLE IF NOT EXISTS nonce_log (
  nonce TEXT PRIMARY KEY,
  device_session_id TEXT NOT NULL REFERENCES device_sessions(id),
  used_at TEXT DEFAULT (datetime('now')),
  request_path TEXT,
  expires_at TEXT NOT NULL              -- cleanup reference
);

-- Step-up challenges: pending re-auth requests
CREATE TABLE IF NOT EXISTS step_up_challenges (
  id TEXT PRIMARY KEY,
  device_session_id TEXT NOT NULL REFERENCES device_sessions(id),
  challenge_token TEXT NOT NULL UNIQUE, -- sent to client, must be returned
  reason TEXT NOT NULL,                 -- why step-up was triggered
  expires_at TEXT NOT NULL,             -- challenge expires in 5 minutes
  completed_at TEXT,                    -- when user completed re-auth
  failed_at TEXT,                       -- when user failed re-auth
  created_at TEXT DEFAULT (datetime('now'))
);

-- API keys: for server-to-server or CLI usage
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                   -- "Production server", "CI/CD"
  key_hash TEXT NOT NULL UNIQUE,        -- SHA-256 of the actual key
  key_prefix TEXT NOT NULL,             -- first 8 chars for display: "tf_live_"
  scopes TEXT DEFAULT '["read"]',       -- JSON array of allowed scopes
  last_used_at TEXT,
  expires_at TEXT,
  is_revoked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Orgs: multi-tenant support
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free',
  trust_policy TEXT,                    -- JSON: custom trust thresholds
  allowed_countries TEXT,               -- JSON: geo restrictions
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ds_session ON device_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ds_user ON device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ds_device ON device_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_ds_key_hash ON device_sessions(public_key_hash);
CREATE INDEX IF NOT EXISTS idx_se_device ON security_events(device_session_id);
CREATE INDEX IF NOT EXISTS idx_se_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_se_created ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_nonce ON nonce_log(nonce);

WHEN DONE: output "AGENT L1 COMPLETE — database schema ready"
```

---

# ══════════════════════════════════════
# AGENT L2 — CLIENT SDK (Browser)
# packages/tokenforge/src/client/
# The npm package: @tokenforge/client
# ══════════════════════════════════════

```prompt
You are building the TokenForge browser SDK.
This is a TypeScript package that developers install in their web apps.
It handles: key generation, signing, fetch interception, React hooks.

The core innovation: private keys are NON-EXTRACTABLE via Web Crypto API.
XSS cannot steal them. Extensions cannot steal them. Nobody can.

PACKAGE: packages/tokenforge/
  package.json name: "@tokenforge/client"
  entry: src/client/index.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/client/crypto.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const
const DB_NAME = 'tokenforge-v1'
const STORE_NAME = 'device_keys'

export interface DeviceKey {
  deviceId: string
  keyPair: CryptoKeyPair    // private key is NON-EXTRACTABLE
  sessionId: string
  boundAt: number
  expiresAt: number
}

// Generate ECDSA P-256 keypair.
// false = NON-EXTRACTABLE — the private key can never be read.
// This is the entire security model.
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    KEY_ALGORITHM,
    false,          // NON-EXTRACTABLE — critical
    ['sign', 'verify']
  )
}

// Export public key as JWK (safe to send to server)
export async function exportPublicKey(keyPair: CryptoKeyPair): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', keyPair.publicKey)
}

// Import public key from JWK (for server-side verification)
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    KEY_ALGORITHM,
    true,
    ['verify']
  )
}

// Sign a challenge string with the device private key
// Returns base64url-encoded signature
export async function signChallenge(
  privateKey: CryptoKey,
  challenge: string
): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(challenge)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    data
  )
  return bufferToBase64url(signature)
}

// Verify a signature (used in server SDK, exported for testing)
export async function verifySignature(
  publicKey: CryptoKey,
  challenge: string,
  signatureBase64url: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(challenge)
    const signature = base64urlToBuffer(signatureBase64url)
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      signature,
      data
    )
  } catch {
    return false
  }
}

// IndexedDB storage for the keypair
// CryptoKey objects can be stored in IndexedDB — they remain non-extractable
export async function storeDeviceKey(key: DeviceKey): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(key, key.sessionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadDeviceKey(sessionId: string): Promise<DeviceKey | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(sessionId)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

export async function clearDeviceKey(sessionId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(sessionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Internal: open IndexedDB
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Utility: ArrayBuffer ↔ base64url
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/client/tokenforge.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { generateKeyPair, exportPublicKey, signChallenge, storeDeviceKey, loadDeviceKey, clearDeviceKey } from './crypto'

export interface TokenForgeConfig {
  apiBase: string                        // your API base URL
  getSessionId: () => string | null      // how to get current session ID
  onStepUpRequired?: (reason: string, challengeToken: string) => void
  onSessionRevoked?: (reason: string) => void
  onDeviceBound?: (deviceId: string) => void
  headers?: {
    signature?: string    // default: 'X-TF-Signature'
    nonce?: string        // default: 'X-TF-Nonce'
    timestamp?: string    // default: 'X-TF-Timestamp'
    deviceId?: string     // default: 'X-TF-Device-ID'
  }
  autoIntercept?: boolean               // default: true
  skipPaths?: string[]                  // paths that bypass signing
}

export class TokenForge {
  private config: Required<TokenForgeConfig>
  private originalFetch: typeof fetch
  private deviceKey: { deviceId: string; keyPair: CryptoKeyPair } | null = null

  constructor(config: TokenForgeConfig) {
    this.config = {
      autoIntercept: true,
      skipPaths: ['/sign-in', '/sign-up', '/api/auth'],
      headers: {
        signature: 'X-TF-Signature',
        nonce: 'X-TF-Nonce',
        timestamp: 'X-TF-Timestamp',
        deviceId: 'X-TF-Device-ID',
      },
      onStepUpRequired: () => {},
      onSessionRevoked: () => {},
      onDeviceBound: () => {},
      ...config,
      headers: { ...{ signature: 'X-TF-Signature', nonce: 'X-TF-Nonce', timestamp: 'X-TF-Timestamp', deviceId: 'X-TF-Device-ID' }, ...config.headers },
    }
    this.originalFetch = window.fetch.bind(window)
  }

  // Call after user authenticates
  async init(): Promise<void> {
    const sessionId = this.config.getSessionId()
    if (!sessionId) return

    // Try to load existing device key for this session
    const stored = await loadDeviceKey(sessionId)
    if (stored && stored.expiresAt > Date.now()) {
      this.deviceKey = { deviceId: stored.deviceId, keyPair: stored.keyPair }
      // Bind to server if not already bound
      await this.ensureBinding(sessionId, stored.deviceId, stored.keyPair)
    } else {
      // Generate new keypair for this session
      await this.bindNewDevice(sessionId)
    }

    if (this.config.autoIntercept) {
      this.interceptFetch()
    }
  }

  // Generate new keypair and bind to server
  private async bindNewDevice(sessionId: string): Promise<void> {
    const keyPair = await generateKeyPair()
    const deviceId = crypto.randomUUID()
    const publicKeyJwk = await exportPublicKey(keyPair)

    // Send public key to server for binding
    const response = await this.originalFetch(`${this.config.apiBase}/api/tokenforge/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        deviceId,
        publicKey: publicKeyJwk,
        userAgent: navigator.userAgent,
      }),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`TokenForge binding failed: ${response.status}`)
    }

    // Store device key in IndexedDB
    await storeDeviceKey({
      deviceId,
      keyPair,
      sessionId,
      boundAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    })

    this.deviceKey = { deviceId, keyPair }
    this.config.onDeviceBound(deviceId)
  }

  // Ensure server knows about this device (in case of server restart)
  private async ensureBinding(sessionId: string, deviceId: string, keyPair: CryptoKeyPair): Promise<void> {
    const publicKeyJwk = await exportPublicKey(keyPair)
    await this.originalFetch(`${this.config.apiBase}/api/tokenforge/ensure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, deviceId, publicKey: publicKeyJwk }),
      credentials: 'include',
    }).catch(() => {}) // Best effort — don't block on this
  }

  // Sign a request with the device key
  async signRequest(request: Request): Promise<Request> {
    if (!this.deviceKey) return request

    const nonce = crypto.randomUUID()
    const timestamp = Date.now().toString()
    const sessionId = this.config.getSessionId() ?? ''

    // Challenge = sessionId:nonce:timestamp:path
    const url = new URL(request.url)
    const challenge = `${sessionId}:${nonce}:${timestamp}:${url.pathname}`

    const signature = await signChallenge(this.deviceKey.keyPair.privateKey, challenge)

    const headers = new Headers(request.headers)
    headers.set(this.config.headers.signature!, signature)
    headers.set(this.config.headers.nonce!, nonce)
    headers.set(this.config.headers.timestamp!, timestamp)
    headers.set(this.config.headers.deviceId!, this.deviceKey.deviceId)

    return new Request(request, { headers })
  }

  // Intercept window.fetch to auto-sign all requests
  private interceptFetch(): void {
    const self = this

    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      const request = new Request(input, init)
      const url = new URL(request.url)

      // Skip paths that don't need signing
      const shouldSkip = self.config.skipPaths!.some(path =>
        url.pathname.startsWith(path)
      )
      if (shouldSkip || url.origin !== self.config.apiBase) {
        return self.originalFetch(input, init)
      }

      const signedRequest = await self.signRequest(request)
      const response = await self.originalFetch(signedRequest)

      // Handle server responses
      if (response.status === 401) {
        const data = await response.clone().json().catch(() => ({}))
        if (data.tokenforge === 'step_up_required') {
          self.config.onStepUpRequired!(data.reason, data.challengeToken)
        } else if (data.tokenforge === 'session_revoked') {
          await self.clearKeys()
          self.config.onSessionRevoked!(data.reason)
        }
      }

      return response
    }
  }

  getDeviceId(): string | null {
    return this.deviceKey?.deviceId ?? null
  }

  isBound(): boolean {
    return this.deviceKey !== null
  }

  async clearKeys(): Promise<void> {
    const sessionId = this.config.getSessionId()
    if (sessionId) await clearDeviceKey(sessionId)
    this.deviceKey = null
  }

  async rebind(): Promise<void> {
    const sessionId = this.config.getSessionId()
    if (!sessionId) return
    await this.clearKeys()
    await this.bindNewDevice(sessionId)
  }
}

// Factory
export function createTokenForge(config: TokenForgeConfig): TokenForge {
  return new TokenForge(config)
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/client/react.ts (React hooks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useCallback } from 'react'
import { TokenForge, TokenForgeConfig } from './tokenforge'

export function useTokenForge(config: TokenForgeConfig) {
  const [tf] = useState(() => new TokenForge(config))
  const [isBound, setIsBound] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [stepUpRequired, setStepUpRequired] = useState(false)
  const [stepUpReason, setStepUpReason] = useState('')

  useEffect(() => {
    const configWithCallbacks: TokenForgeConfig = {
      ...config,
      onDeviceBound: (id) => {
        setIsBound(true)
        setDeviceId(id)
        config.onDeviceBound?.(id)
      },
      onStepUpRequired: (reason, token) => {
        setStepUpRequired(true)
        setStepUpReason(reason)
        config.onStepUpRequired?.(reason, token)
      },
      onSessionRevoked: (reason) => {
        setIsBound(false)
        setDeviceId(null)
        config.onSessionRevoked?.(reason)
      },
    }
    tf.init().catch(console.error)
  }, [])

  const completeStepUp = useCallback(async () => {
    await tf.rebind()
    setStepUpRequired(false)
    setStepUpReason('')
  }, [tf])

  return { tf, isBound, deviceId, stepUpRequired, stepUpReason, completeStepUp }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/client/index.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export { TokenForge, createTokenForge } from './tokenforge'
export type { TokenForgeConfig } from './tokenforge'
export { useTokenForge } from './react'
export { generateKeyPair, exportPublicKey, signChallenge, verifySignature } from './crypto'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: packages/tokenforge/package.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "name": "@tokenforge/client",
  "version": "0.1.0",
  "description": "Device-bound session security via ECDSA P-256 keypairs",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./react": "./dist/react.js"
  },
  "keywords": ["session", "security", "device-binding", "ecdsa", "web-crypto"],
  "peerDependencies": {
    "react": ">=18"
  }
}

WHEN DONE: output "AGENT L2 COMPLETE — client SDK built"
```

---

# ══════════════════════════════════════
# AGENT L3 — SERVER MIDDLEWARE (Hono)
# packages/tokenforge/src/server/
# ══════════════════════════════════════

```prompt
You are building the TokenForge server middleware for Hono 4
on Cloudflare Workers. This is what verifies every request.

FILE: packages/tokenforge/src/server/middleware.ts
FILE: packages/tokenforge/src/server/trust-score.ts
FILE: packages/tokenforge/src/server/routes.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/server/trust-score.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TrustSignals {
  signatureValid: boolean           // weight: 40
  ipMatch: boolean                  // weight: 15 (vs binding IP)
  geoMatch: boolean                 // weight: 15 (vs binding country)
  userAgentMatch: boolean           // weight: 10
  velocityNormal: boolean           // weight: 10
  timeOfDayNormal: boolean          // weight: 5
  nonceFresh: boolean               // weight: 5
}

export interface TrustResult {
  score: number                     // 0-100
  action: 'allow' | 'flag' | 'step_up' | 'revoke'
  signals: TrustSignals
  flags: string[]                   // human-readable reasons
}

const WEIGHTS = {
  signatureValid: 40,
  ipMatch: 15,
  geoMatch: 15,
  userAgentMatch: 10,
  velocityNormal: 10,
  timeOfDayNormal: 5,
  nonceFresh: 5,
}

export function calculateTrustScore(signals: TrustSignals): TrustResult {
  let score = 0
  const flags: string[] = []

  // Signature is the most critical signal
  // If invalid: score stays at 0 regardless of other signals
  if (!signals.signatureValid) {
    return {
      score: 0,
      action: 'revoke',
      signals,
      flags: ['Invalid device signature — possible stolen token or replay attack'],
    }
  }

  score += WEIGHTS.signatureValid

  if (signals.ipMatch) score += WEIGHTS.ipMatch
  else flags.push(`IP address changed from binding location`)

  if (signals.geoMatch) score += WEIGHTS.geoMatch
  else flags.push(`Geographic location changed`)

  if (signals.userAgentMatch) score += WEIGHTS.userAgentMatch
  else flags.push(`Browser fingerprint changed`)

  if (signals.velocityNormal) score += WEIGHTS.velocityNormal
  else flags.push(`Unusual request frequency detected`)

  if (signals.timeOfDayNormal) score += WEIGHTS.timeOfDayNormal
  else flags.push(`Request outside normal activity hours`)

  if (signals.nonceFresh) score += WEIGHTS.nonceFresh
  else flags.push(`Nonce expired or invalid`)

  let action: TrustResult['action']
  if (score >= 80) action = 'allow'
  else if (score >= 60) action = 'flag'
  else if (score >= 40) action = 'step_up'
  else action = 'revoke'

  return { score, action, signals, flags }
}

export async function evaluateTrustSignals(
  session: any,           // device_sessions row
  request: {
    ip: string
    country: string
    userAgent: string
    nonce: string
    timestamp: string
    signatureValid: boolean
  },
  nonces: KVNamespace,
  recentRequestCount: number,
): Promise<TrustSignals> {

  // Check nonce freshness and uniqueness
  const timestampAge = Date.now() - parseInt(request.timestamp)
  const nonceKey = `nonce:${request.nonce}`
  const nonceSeen = await nonces.get(nonceKey)
  const nonceFresh = timestampAge < 60000 && !nonceSeen

  if (!nonceSeen) {
    // Mark nonce as used (TTL: 5 minutes)
    await nonces.put(nonceKey, '1', { expirationTtl: 300 })
  }

  // Check request velocity (>100 req/min = anomalous)
  const velocityNormal = recentRequestCount < 100

  // Check time of day (compare to binding time)
  const boundHour = new Date(session.created_at).getUTCHours()
  const currentHour = new Date().getUTCHours()
  const hourDiff = Math.abs(currentHour - boundHour)
  const timeOfDayNormal = hourDiff <= 6  // within 6 hours of usual time

  return {
    signatureValid: request.signatureValid,
    ipMatch: request.ip === session.bound_ip,
    geoMatch: request.country === session.bound_country,
    userAgentMatch: request.userAgent === session.user_agent,
    velocityNormal,
    timeOfDayNormal,
    nonceFresh,
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/server/middleware.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { MiddlewareHandler } from 'hono'
import { importPublicKey, verifySignature } from '../client/crypto'
import { calculateTrustScore, evaluateTrustSignals } from './trust-score'

export interface TokenForgeMiddlewareOptions {
  db: D1Database
  nonces: KVNamespace
  trustThresholds?: {
    allow?: number      // default: 80
    stepUp?: number     // default: 40
  }
  skipPaths?: string[]
  sensitiveOps?: string[]   // paths requiring score >= 90
  getSessionId: (c: any) => string | null
}

export function tokenForgeMiddleware(opts: TokenForgeMiddlewareOptions): MiddlewareHandler {
  return async (c, next) => {

    // Skip specified paths (login, public endpoints)
    const path = new URL(c.req.url).pathname
    if (opts.skipPaths?.some(p => path.startsWith(p))) {
      return next()
    }

    // Extract TokenForge headers
    const signature = c.req.header('X-TF-Signature')
    const nonce = c.req.header('X-TF-Nonce')
    const timestamp = c.req.header('X-TF-Timestamp')
    const deviceId = c.req.header('X-TF-Device-ID')
    const sessionId = opts.getSessionId(c)

    // No TokenForge headers → unauthenticated request
    // Let your auth middleware handle it
    if (!signature || !nonce || !timestamp || !deviceId || !sessionId) {
      return next()
    }

    // Load device session
    const session = await opts.db.prepare(
      `SELECT * FROM device_sessions WHERE device_id = ? AND session_id = ? AND is_revoked = 0`
    ).bind(deviceId, sessionId).first()

    if (!session) {
      return c.json({ error: 'Device not bound', tokenforge: 'not_bound' }, 401)
    }

    // Verify ECDSA signature
    const publicKey = await importPublicKey(JSON.parse(session.public_key_jwk as string))
    const challenge = `${sessionId}:${nonce}:${timestamp}:${path}`
    const signatureValid = await verifySignature(publicKey, challenge, signature)

    // Get recent request count for velocity check
    const recentCount = await opts.db.prepare(
      `SELECT COUNT(*) as cnt FROM security_events
       WHERE device_session_id = ? AND created_at > datetime('now', '-1 minute')`
    ).bind(session.id).first<{ cnt: number }>()

    // Evaluate all trust signals
    const signals = await evaluateTrustSignals(
      session,
      {
        ip: c.req.header('CF-Connecting-IP') ?? '',
        country: c.req.header('CF-IPCountry') ?? '',
        userAgent: c.req.header('User-Agent') ?? '',
        nonce,
        timestamp,
        signatureValid,
      },
      opts.nonces,
      recentCount?.cnt ?? 0,
    )

    const trust = calculateTrustScore(signals)

    // Sensitive operations need score >= 90
    if (opts.sensitiveOps?.some(p => path.startsWith(p)) && trust.score < 90) {
      await logSecurityEvent(opts.db, {
        deviceSessionId: session.id as string,
        userId: session.user_id as string,
        eventType: 'step_up_triggered',
        trustScore: trust.score,
        trustSignals: trust.signals,
        ip: signals.ipMatch ? session.bound_ip as string : c.req.header('CF-Connecting-IP') ?? '',
        path,
        method: c.req.method,
        action: 'step_up',
        severity: 'MEDIUM',
      })
      return c.json({ error: 'Step-up required for sensitive operation', tokenforge: 'step_up_required', reason: 'sensitive_operation' }, 401)
    }

    // Handle trust decision
    if (trust.action === 'revoke') {
      await opts.db.prepare(
        `UPDATE device_sessions SET is_revoked = 1, revoke_reason = ? WHERE id = ?`
      ).bind(trust.flags.join('; '), session.id).run()

      await logSecurityEvent(opts.db, {
        deviceSessionId: session.id as string,
        userId: session.user_id as string,
        eventType: 'session_revoked',
        trustScore: trust.score,
        trustSignals: trust.signals,
        ip: c.req.header('CF-Connecting-IP') ?? '',
        path, method: c.req.method,
        action: 'revoke',
        severity: signatureValid ? 'HIGH' : 'CRITICAL',
      })
      return c.json({ error: 'Session revoked', tokenforge: 'session_revoked', reason: trust.flags[0] }, 401)
    }

    if (trust.action === 'step_up') {
      const challengeToken = crypto.randomUUID()
      await opts.db.prepare(
        `INSERT INTO step_up_challenges (id, device_session_id, challenge_token, reason, expires_at)
         VALUES (?, ?, ?, ?, datetime('now', '+5 minutes'))`
      ).bind(crypto.randomUUID(), session.id, challengeToken, trust.flags[0]).run()

      await logSecurityEvent(opts.db, {
        deviceSessionId: session.id as string,
        userId: session.user_id as string,
        eventType: 'step_up_triggered',
        trustScore: trust.score,
        trustSignals: trust.signals,
        ip: c.req.header('CF-Connecting-IP') ?? '',
        path, method: c.req.method,
        action: 'step_up',
        severity: 'MEDIUM',
      })
      return c.json({ error: 'Step-up authentication required', tokenforge: 'step_up_required', reason: trust.flags[0], challengeToken }, 401)
    }

    // Update session last seen + request count
    await opts.db.prepare(
      `UPDATE device_sessions SET last_seen_at = datetime('now'),
       request_count = request_count + 1, trust_score = ? WHERE id = ?`
    ).bind(trust.score, session.id).run()

    // Log flagged requests
    if (trust.action === 'flag') {
      await logSecurityEvent(opts.db, {
        deviceSessionId: session.id as string,
        userId: session.user_id as string,
        eventType: 'request_flagged',
        trustScore: trust.score,
        trustSignals: trust.signals,
        ip: c.req.header('CF-Connecting-IP') ?? '',
        path, method: c.req.method,
        action: 'flag',
        severity: 'LOW',
      })
    }

    // Attach trust context to request
    c.set('tokenforge', {
      sessionId,
      deviceId,
      userId: session.user_id,
      trustScore: trust.score,
      trustAction: trust.action,
    })

    return next()
  }
}

async function logSecurityEvent(db: D1Database, params: {
  deviceSessionId: string
  userId: string
  eventType: string
  trustScore: number
  trustSignals: any
  ip: string
  path: string
  method: string
  action: string
  severity: string
}) {
  await db.prepare(
    `INSERT INTO security_events
     (id, device_session_id, user_id, event_type, trust_score, trust_signals,
      request_ip, http_method, request_path, response_action, severity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    params.deviceSessionId,
    params.userId,
    params.eventType,
    params.trustScore,
    JSON.stringify(params.trustSignals),
    params.ip,
    params.method,
    params.path,
    params.action,
    params.severity,
  ).run()
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE: src/server/routes.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Build these Hono API routes:

POST /api/tokenforge/bind
  Body: { sessionId, deviceId, publicKey (JWK), userAgent }
  → Validate: publicKey is valid ECDSA P-256 JWK
  → Create device_sessions record
  → Return: { success: true, deviceId, expiresAt }
  → Error if session already bound to different device (return existing binding)

POST /api/tokenforge/ensure
  Body: { sessionId, deviceId, publicKey (JWK) }
  → If session+device already bound: return 200 (idempotent)
  → If device changed: flag as suspicious, return existing binding

POST /api/tokenforge/step-up
  Body: { challengeToken, sessionId }
  → Validate challenge token is valid and not expired
  → Mark step_up_challenges.completed_at
  → Reset trust_score to 100
  → Return: { success: true }

POST /api/tokenforge/unbind
  Body: { sessionId }
  → Set is_revoked = 1
  → Return: { success: true }

GET /api/tokenforge/sessions
  → Return all device sessions for authenticated user
  → Include: deviceId, boundAt, lastSeen, trustScore, is_revoked

GET /api/tokenforge/events
  → Security events for authenticated user
  → Filterable by eventType, severity, date range

DELETE /api/tokenforge/sessions/:deviceId
  → Revoke a specific device session (user revokes from another device)

WHEN DONE: output "AGENT L3 COMPLETE — server middleware built"
```

---

# ══════════════════════════════════════
# AGENT L4 — TOKENFORGE PRODUCT SITE
# src/routes/ — SvelteKit marketing site
# ══════════════════════════════════════

```prompt
You are building the TokenForge product website.
TokenForge has no live site yet. Build it from scratch.
Same SvelteKit + dark theme pattern as opensyber.cloud.
Same design tokens. Different product, same mission family.

MISSION: "MFA protects the login. TokenForge protects everything after."

THE STORY:
  The average AiTM (Adversary-in-the-Middle) phishing attack
  bypasses MFA in under 2 minutes.
  74% of breaches in 2025 involved compromised credentials.
  Token theft doesn't care that you have MFA.
  TokenForge makes the stolen token useless.

PAGES TO BUILD:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE 1: src/routes/+page.svelte (Homepage)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<svelte:head>
  <title>TokenForge — Device-Bound Session Security</title>
  <meta name="description" content="MFA protects the login. TokenForge protects everything after. Cryptographically bind every session to the device that created it. Stolen tokens are worthless." />
</svelte:head>

HERO SECTION:
  Eyebrow (red incident badge):
    "AiTM phishing bypasses MFA in 2 minutes. Here's the fix."

  Headline: "Stolen tokens are worthless."
  Subline: "TokenForge cryptographically binds every session to
            the device that created it. A stolen cookie without
            the device-bound private key can't make a single request."

  CTA: [Start free — npm install] [See how it works →]

  Visual: Side-by-side comparison
    WITHOUT TOKENFORGE:
      Cookie: "session_abc123"
      Attacker steals cookie via AiTM phishing
      Cookie works from ANY machine
      MFA is completely irrelevant
      → BREACHED

    WITH TOKENFORGE:
      Cookie: "session_abc123" + must sign challenge with device key
      Attacker steals cookie
      No device key → signature check fails
      Score: 0/100 → session revoked immediately
      → PROTECTED


THE PROBLEM SECTION:
  Headline: "MFA doesn't protect your sessions."

  The AiTM attack walkthrough (numbered steps):
    1. Attacker sets up reverse proxy in front of your login page
    2. User enters credentials + completes MFA → everything forwarded
    3. Attacker captures the POST-MFA session cookie
    4. Attacker uses cookie from their own machine
    5. Your systems see a valid authenticated session
    6. MFA is completely irrelevant at this point

  Stats:
    "74% of 2025 breaches involved compromised identity (Expel)"
    "AiTM phishing kits available for $200 on dark web markets"
    "Average time to abuse stolen session: 17 minutes"
    "Average time to detect: 204 days"


HOW TOKENFORGE WORKS:

  Step 1: User logs in normally (any auth provider)
  Step 2: TokenForge generates ECDSA P-256 keypair in browser
           → Private key: non-extractable (lives in IndexedDB)
           → Public key: sent to server for registration
  Step 3: Every subsequent request includes:
           → Session cookie (same as before)
           → X-TF-Signature (ECDSA signature of challenge nonce)
           → X-TF-Nonce (prevents replay attacks)
  Step 4: Server verifies signature before allowing request
  Step 5: Stolen cookie without device key → score: 0 → revoked

  Interactive demo: show the trust score updating as signals change
    Start: all signals green, score 100
    Toggle: "IP changed" → score drops to 85 → action: flag
    Toggle: "Signature invalid" → score drops to 0 → action: revoke
    Reset button


TRUST SCORE SECTION:

  "Seven signals. One score. Zero exceptions."

  Show all 7 signals with weight:
    Signature Valid     40pts  "Was this request signed by the original device?"
    IP Consistent       15pts  "Same IP as session creation?"
    Geo Consistent      15pts  "Same country/region?"
    User-Agent Match    10pts  "Same browser?"
    Velocity Normal     10pts  "Normal request frequency?"
    Time of Day          5pts  "Normal activity hours?"
    Nonce Fresh          5pts  "Challenge response within 60 seconds?"

  Score → Action table:
    80-100  ✓ ALLOW      Normal operation
    60-79   ⚑ FLAG       Allow + log for review
    40-59   ⚠ STEP-UP   Re-authentication required
    0-39    ✗ REVOKE    Session terminated immediately


WHAT TOKENFORGE PROTECTS AGAINST:

  Card 1: AiTM Session Hijacking
    The attack: Steal session cookie via reverse proxy
    TokenForge: Stolen cookie fails signature check instantly
    Score: 0 → Revoked

  Card 2: Token Theft via XSS
    The attack: Inject JS that reads document.cookie
    TokenForge: Private key is non-extractable — JS cannot read it
    Result: Attacker has cookie but cannot sign requests

  Card 3: Credential Stuffing
    The attack: Replay stolen credentials from other breaches
    TokenForge: New login = new device binding required
    Score: 0 on first request without bound device

  Card 4: Session Fixation
    The attack: Force user to use attacker-controlled session ID
    TokenForge: Session must be bound to a device before requests work
    Unbound sessions fail immediately


QUICK START SECTION:

  "Four lines to protect every session."

  npm install @tokenforge/client

  // In your React/Svelte app (after login):
  const tf = createTokenForge({
    apiBase: 'https://your-api.com',
    getSessionId: () => yourAuth.getSessionId(),
    onStepUpRequired: (reason) => showStepUpModal(reason),
    onSessionRevoked: () => { logout(); toast.error('Session revoked') },
  })
  await tf.init()
  // That's it. All your fetch() calls are now signed automatically.

  // On your server (Hono):
  app.use('*', tokenForgeMiddleware({
    db: env.DB,
    nonces: env.NONCES,
    getSessionId: (c) => getCookie(c, 'session'),
  }))


PRICING SECTION:

  "Protect every session from $0."

  FREE (open source):
    Client SDK: @tokenforge/client (MIT)
    Self-hosted server middleware
    No limits on users or requests
    Community support

  CLOUD ($49/mo):
    Hosted TokenForge service
    Dashboard: sessions, trust scores, security events
    Slack + PagerDuty alerts on anomalies
    SOC 2 compliant audit logs
    99.9% SLA
    Email support

  ENTERPRISE (custom):
    All Cloud features
    Custom data residency
    SAML SSO
    Dedicated support
    SLA with financial backing


FOOTER:
  "TokenForge is part of the OpenSyber security ecosystem."
  Links: GitHub · npm · Docs · OpenSyber


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE 2: src/routes/docs/+page.svelte
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Simple documentation page with:
  Getting started (5 minute quickstart)
  Client SDK API reference
  Server middleware options
  Trust score configuration
  Browser compatibility table
  FAQ


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERACTIVE TRUST SCORE DEMO (key component)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/lib/components/TrustScoreDemo.svelte

  Shows a live trust score widget:
  - Score ring (big number, colored: green/amber/red)
  - 7 signal rows with toggle switches
  - Score recalculates as user toggles signals
  - Action badge updates (ALLOW / FLAG / STEP-UP / REVOKE)

  Default state: all signals on → score 100 → ALLOW (green)
  Toggle "Signature Valid" off → score 0 → REVOKE (red)
  Toggle "IP Match" off → score 85 → FLAG (amber)

  Code:

  let signals = {
    signatureValid: true,  // weight 40
    ipMatch: true,         // weight 15
    geoMatch: true,        // weight 15
    userAgentMatch: true,  // weight 10
    velocityNormal: true,  // weight 10
    timeOfDayNormal: true, // weight 5
    nonceFresh: true,      // weight 5
  }

  const weights = {
    signatureValid: 40, ipMatch: 15, geoMatch: 15,
    userAgentMatch: 10, velocityNormal: 10,
    timeOfDayNormal: 5, nonceFresh: 5
  }

  $: score = signals.signatureValid
    ? Object.entries(signals).reduce((sum, [k, v]) => sum + (v ? weights[k] : 0), 0)
    : 0

  $: action = score >= 80 ? 'ALLOW' : score >= 60 ? 'FLAG' : score >= 40 ? 'STEP-UP' : 'REVOKE'
  $: actionColor = action === 'ALLOW' ? 'green' : action === 'FLAG' ? 'amber' : 'red'


WHEN DONE: verify:
  ✓ Homepage loads with hero
  ✓ AiTM attack explanation is clear
  ✓ Trust score demo is interactive
  ✓ Quick start shows 4-line integration
  ✓ Pricing shows free/cloud/enterprise
  ✓ Same dark theme as opensyber.cloud

Output: "AGENT L4 COMPLETE — TokenForge product site built"
```

---

# ══════════════════════════════════════
# AGENT L5 — OPENSYBER TOKENFORGE SKILL
# Integrate TokenForge as an OpenSyber skill
# ══════════════════════════════════════

```prompt
You are adding TokenForge to the OpenSyber marketplace
as the "Session Integrity" skill.

This is the integration between the two products:
  OpenSyber monitors AI agents
  TokenForge monitors the sessions of the developers using them

FILE: Add to src/lib/data/skills.ts (OpenSyber):

{
  slug: 'session-integrity',
  name: 'Session Integrity (TokenForge)',
  icon: '🔑',
  category: 'security',
  version: '1.0.0',
  missionLine: 'Makes stolen session tokens useless.',
  description: 'Cryptographically binds developer sessions to their device using ECDSA P-256 keypairs. A stolen authentication cookie cannot make a single request without the device-bound private key. Monitors all sessions for trust anomalies: IP changes, geo changes, signature failures.',
  incidentTag: 'AiTM phishing prevention',
  incidentSeverity: 'critical',
  sourceLabel: 'SDK integration (npm install)',
  sourceType: 'sdk',
  planRequired: 'professional',
}

FILE: Create src/routes/marketplace/session-integrity/+page.svelte

This is a special skill detail page because it's a library integration,
not a GitHub App or agent sidecar. The setup flow is different.

PAGE CONTENT:

  Header: same structure as other skill detail pages
  Mission: "74% of 2025 breaches involved compromised identities.
            SessionForge makes token theft irrelevant."

  The attack it stops:
    "AiTM (Adversary-in-the-Middle) phishing captures session
     cookies after MFA. The attacker uses your cookie from their
     machine. Your systems can't tell the difference.
     TokenForge can. The request has no device signature — instant revoke."

  Quick start (3 steps):
    Step 1: Install the client SDK
      npm install @tokenforge/client
    Step 2: Initialize after login
      [code block — 8 lines]
    Step 3: Add server middleware
      [code block — 6 lines]

  What it monitors in OpenSyber dashboard:
    - Active developer sessions with trust scores
    - Sessions that triggered step-up auth
    - Revoked sessions and why
    - Geographic anomalies
    - Velocity anomalies

  Integration code blocks:

  CLIENT (SvelteKit / React / Vanilla):
  ─────────────────────────────────────
  import { createTokenForge } from '@tokenforge/client'

  // After user logs in
  const tf = createTokenForge({
    apiBase: 'https://api.your-app.com',
    getSessionId: () => getCookie('session'),
    onStepUpRequired: (reason) => {
      // Show re-auth modal to user
      showModal({ title: 'Verify it\'s you', reason })
    },
    onSessionRevoked: (reason) => {
      // Session was stolen or anomalous
      logout()
      toast.error('Session security event — please login again')
    },
  })

  await tf.init()  // Signs every fetch() automatically from here

  SERVER (Hono / Cloudflare Workers):
  ─────────────────────────────────────
  import { tokenForgeMiddleware } from '@tokenforge/server'

  app.use('/api/*', tokenForgeMiddleware({
    db: env.DB,
    nonces: env.NONCES,
    getSessionId: (c) => getCookie(c, 'session'),
    sensitiveOps: ['/api/payments', '/api/admin'],
  }))

  Dashboard integration:
    Add to OpenSyber dashboard:
    "Session Security" panel showing:
    - N sessions bound across N developers
    - N anomalies detected this week
    - N sessions revoked (with reasons)
    - Trust score distribution

FILE: Add to src/routes/dashboard/+page.svelte

Add "Session Integrity" widget:
  Sessions protected: N
  Trust score avg: 94/100
  Anomalies this week: N
  "Powered by TokenForge →"
  [View sessions →] → /dashboard/sessions

FILE: Create src/routes/dashboard/sessions/+page.svelte

  Table of all developer sessions:
    Developer | Device | Last seen | Trust score | IP | Status
    Color-coded rows: green (high trust), amber (flagged), red (revoked)
  
  Filters: active / flagged / revoked
  
  Row click → session detail:
    All security events for this session
    Trust score history (sparkline)
    Geographic map if multiple IPs

WHEN DONE: output "AGENT L5 COMPLETE — TokenForge skill in OpenSyber"
```

---

# ══════════════════════════════════════
# AGENT L6 — TOKENFORGE README + DOCS
# The open source face of the project
# ══════════════════════════════════════

```prompt
You are creating the TokenForge open source documentation.
This is what developers see on GitHub and npm.

FILE: packages/tokenforge/README.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
README STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# TokenForge

> MFA protects the login. TokenForge protects everything after.

[![npm version](badge)] [![license: MIT](badge)] [![TypeScript](badge)]

Cryptographically bind every user session to the device that created it.
A stolen session token is worthless without the device-bound private key.

---

## The Problem

AiTM (Adversary-in-the-Middle) phishing kits can capture authenticated
session cookies in under 2 minutes — bypassing MFA completely.
Infostealer malware targets session tokens directly.
Cookie theft doesn't care that you have MFA.

The stolen cookie, used from the attacker's machine, looks identical
to a legitimate request. Your logs show a valid authenticated session.
By the time someone notices, the damage is done.

## The Solution

TokenForge generates a non-extractable ECDSA P-256 keypair in the browser
using the Web Crypto API. The private key can never be read — not by XSS,
not by browser extensions, not by anything. It lives in IndexedDB and
can only be used for signing operations.

Every request must include an ECDSA signature over a server-provided nonce.
A stolen cookie without the device key fails immediately.
The trust score drops to 0. The session is revoked.

---

## Quick Start

### Install

npm install @tokenforge/client        # browser
npm install @tokenforge/server        # Cloudflare Workers / Hono

### Client (after user authenticates)

import { createTokenForge } from '@tokenforge/client'

const tf = createTokenForge({
  apiBase: 'https://api.example.com',
  getSessionId: () => document.cookie.match(/session=([^;]+)/)?.[1] ?? null,
  onStepUpRequired: (reason) => showReauthModal(reason),
  onSessionRevoked: (reason) => { logout(); alert('Session security event') },
})

await tf.init()
// All subsequent fetch() calls are signed automatically

### Server (Hono middleware)

import { tokenForgeMiddleware } from '@tokenforge/server'
import { Hono } from 'hono'

const app = new Hono()

app.use('/api/*', tokenForgeMiddleware({
  db: env.DB,               // Cloudflare D1
  nonces: env.NONCES,       // Cloudflare KV
  getSessionId: (c) => getCookie(c, 'session'),
}))

---

## How It Works

[diagram showing the full flow]

1. User logs in via your auth provider (Better Auth, Clerk, etc.)
2. TokenForge generates ECDSA P-256 keypair (non-extractable private key)
3. Public key registered with TokenForge server
4. Every request includes: Cookie + ECDSA signature + nonce + timestamp
5. Server verifies signature, evaluates 7 trust signals, returns trust score
6. Score < 40 or invalid signature → session revoked immediately

## Trust Score

Seven signals produce a score from 0 to 100:

| Signal | Weight | Description |
|--------|--------|-------------|
| Signature Valid | 40 | Device-bound key proof |
| IP Consistent | 15 | Same IP as session creation |
| Geo Consistent | 15 | Same country |
| User-Agent Match | 10 | Same browser |
| Velocity Normal | 10 | Normal request frequency |
| Time of Day | 5 | Normal activity hours |
| Nonce Fresh | 5 | Challenge within 60s |

| Score | Action |
|-------|--------|
| 80–100 | Allow |
| 60–79 | Allow + flag |
| 40–59 | Require re-authentication |
| 0–39 | Revoke session |

## What TokenForge Protects Against

| Attack | Protected? | How |
|--------|-----------|-----|
| AiTM session cookie theft | ✅ | Stolen cookie fails signature check |
| XSS cookie theft | ✅ | Private key is non-extractable |
| Infostealer malware | ✅ | Key bound to browser IndexedDB |
| Session fixation | ✅ | Unbound sessions fail immediately |
| Replay attacks | ✅ | Nonce invalidated after first use |

## Browser Support

Web Crypto API + IndexedDB required.
All modern browsers (Chrome 37+, Firefox 34+, Safari 11+, Edge 79+).
Graceful degradation to fingerprint-only mode for unsupported browsers.

## Framework Integration

Works with any auth provider: Better Auth, Clerk, Auth0, Supabase, custom.
Works with any framework: React, Svelte, Vue, Vanilla JS.
Server middleware available for: Hono, Express, Next.js API routes.

## License

MIT — use it everywhere. Commercial projects, open source, wherever.

## Part of the OpenSyber Security Ecosystem

TokenForge is maintained by [OpenSyber](https://opensyber.cloud).
It's also available as the "Session Integrity" skill in the
OpenSyber marketplace with dashboard monitoring and alerting.

---

ALSO CREATE:

packages/tokenforge/docs/ARCHITECTURE.md
  Full technical architecture document
  Security model explanation
  Database schema
  Challenge-response protocol

packages/tokenforge/docs/CLIENT_SDK.md
  Complete API reference for @tokenforge/client
  All config options with types
  React hooks documentation
  Browser compatibility notes

packages/tokenforge/docs/SERVER_MIDDLEWARE.md
  Complete API reference for @tokenforge/server
  Hono middleware options
  Trust score customization
  Step-up auth flow

packages/tokenforge/examples/react/
  Complete React example app with TokenForge

packages/tokenforge/examples/svelte/
  Complete SvelteKit example app with TokenForge

WHEN DONE: output "AGENT L6 COMPLETE — TokenForge docs and README ready"
```

---

# ══════════════════════════════════════
# MERGE AGENT — TOKENFORGE
# Run after L1–L6 all complete
# ══════════════════════════════════════

```prompt
All L1–L6 agents are complete. Verify TokenForge.

PACKAGE VERIFICATION:
  ✓ packages/tokenforge/src/client/crypto.ts exists
  ✓ generateKeyPair() uses false (non-extractable)
  ✓ signChallenge() and verifySignature() implemented
  ✓ IndexedDB storage with storeDeviceKey/loadDeviceKey
  ✓ packages/tokenforge/src/client/tokenforge.ts exists
  ✓ TokenForge class with init(), signRequest(), interceptFetch()
  ✓ Fetch interception attaches X-TF-Signature headers
  ✓ Step-up and revoke callbacks work
  ✓ packages/tokenforge/src/client/react.ts — useTokenForge hook
  ✓ packages/tokenforge/src/server/middleware.ts exists
  ✓ tokenForgeMiddleware() function exported
  ✓ 7 trust signals evaluated correctly
  ✓ Score < 40 → revoke response
  ✓ Score 40-59 → step_up response
  ✓ Signature invalid → score 0 → revoke
  ✓ packages/tokenforge/src/server/trust-score.ts exists
  ✓ calculateTrustScore() returns correct actions

DATABASE VERIFICATION:
  ✓ migrations/0001_init.sql runs without error
  ✓ device_sessions table created
  ✓ security_events table created
  ✓ nonce_log table created
  ✓ step_up_challenges table created

PRODUCT SITE VERIFICATION:
  ✓ Homepage loads
  ✓ Hero: "Stolen tokens are worthless"
  ✓ AiTM attack explanation is clear
  ✓ Trust score demo is interactive
  ✓ Toggles update score and action correctly
  ✓ Quick start code blocks present
  ✓ Pricing: Free (MIT) / Cloud ($49/mo) / Enterprise

OPENSYBER INTEGRATION:
  ✓ "Session Integrity" skill visible in marketplace
  ✓ /marketplace/session-integrity loads
  ✓ Integration code blocks are accurate
  ✓ Dashboard sessions widget added

README:
  ✓ packages/tokenforge/README.md exists
  ✓ 5-line quick start works
  ✓ Trust score table accurate
  ✓ Browser compatibility table present
  ✓ "Part of OpenSyber ecosystem" link

CRITICAL CHECK — non-extractable:
  Search for generateKey in crypto.ts
  Must show: false (non-extractable) as second argument
  If it shows true: CRITICAL BUG — fix immediately

If all pass, output:

════════════════════════════════════════
🔑 TOKENFORGE COMPLETE
════════════════════════════════════════

CLIENT SDK:
  ✓ @tokenforge/client — browser SDK
  ✓ Non-extractable ECDSA P-256 keypairs
  ✓ IndexedDB key storage
  ✓ Auto fetch() interception
  ✓ React hooks (useTokenForge)
  ✓ Step-up and revoke callbacks

SERVER MIDDLEWARE:
  ✓ @tokenforge/server — Hono middleware
  ✓ 7-signal trust score engine
  ✓ Replay attack prevention (nonce KV)
  ✓ Automatic session revocation
  ✓ Security event logging

PRODUCT SITE:
  ✓ Homepage with interactive trust score demo
  ✓ AiTM attack explanation
  ✓ Quick start with real code
  ✓ Pricing tiers

OPENSYBER INTEGRATION:
  ✓ Session Integrity skill in marketplace
  ✓ Dashboard session monitoring panel

OPEN SOURCE:
  ✓ README with 5-line quick start
  ✓ MIT license
  ✓ Architecture documentation

NEXT:
  1. npm publish @tokenforge/client (MIT, free)
  2. npm publish @tokenforge/server (MIT, free)
  3. Post to HN: "Show HN: I made stolen session cookies useless
     with a non-extractable ECDSA keypair"
  4. Submit to /r/netsec with AiTM attack explanation
  5. Add to OpenSyber pricing: Professional+ includes
     TokenForge Cloud monitoring
════════════════════════════════════════
```

---

## PARALLEL MAP

```
Run simultaneously (fully independent):
  L1 — Database schema
  L2 — Client SDK (browser)
  L3 — Server middleware (Hono)
  L4 — Product site (SvelteKit)
  L5 — OpenSyber integration (skill)
  L6 — README and documentation

Run last:
  Merge Agent — verification

Estimated parallel time: 60 minutes
```

## RELATIONSHIP TO OPENSYBER

```
OpenSyber:    Secures what AI AGENTS do
TokenForge:   Secures the SESSIONS of developers using AI agents

Together:
  OpenSyber monitors that claude-code isn't exfiltrating credentials
  TokenForge ensures the developer's session can't be hijacked
  to issue malicious commands to those same AI agents

The attack chain TokenForge + OpenSyber breaks:
  1. Attacker steals dev session via AiTM → TokenForge blocks
  2. Attacker poisons CLAUDE.md in PR → OpenSyber blocks
  3. Attacker compromises npm package → OpenSyber blocks
  4. Compromised agent calls IOC domain → OpenSyber blocks

Full stack protection. One ecosystem.
```

## THE HN POST (write exactly this)

```
Title:
  Show HN: I made stolen session cookies useless
  with a non-extractable browser key

Body:
  AiTM phishing bypasses MFA by stealing the session cookie
  AFTER authentication. The attacker uses your cookie from
  their machine — and your system can't tell the difference.

  TokenForge fixes this by binding every session to the device
  that created it using a non-extractable ECDSA P-256 keypair
  via the Web Crypto API.

  The private key literally cannot be read by JavaScript.
  XSS can't steal it. Browser extensions can't steal it.
  Malware running in the browser can't steal it.
  It can only be used for signing operations.

  Every request includes an ECDSA signature over a nonce.
  A stolen cookie without the device key scores 0/100
  and the session is revoked in the same request.

  It's MIT licensed. npm install @tokenforge/client.
  4 lines of code on the client, 6 on the server.

  [link to GitHub]

  Happy to explain the Web Crypto API non-extractable key
  trick if anyone's curious — it's elegant and under-used.
```
