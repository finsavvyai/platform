# TokenForge Server Middleware

## Implementation Specification

---

## 1. HONO MIDDLEWARE (ClawShield Phase 1)

```typescript
// packages/tokenforge/src/middleware.ts

import { Context, Next, MiddlewareHandler } from 'hono';
import { importPublicKey, verifySignature } from './crypto';
import { TrustScoreEngine } from './trust-score';

export interface TokenForgeOptions {
  storage: {
    sessions: D1Database;    // device_sessions + security_events tables
    nonces: KVNamespace;     // nonce dedup with TTL
  };
  trustThresholds: {
    allow: number;           // >= this score: request proceeds (default: 80)
    stepUp: number;          // >= this score: step-up required (default: 40)
    // below stepUp: session revoked
  };
  sessionMaxAge: number;     // seconds (default: 86400 = 24h)
  nonceExpiry: number;       // seconds (default: 60)
  skipPaths?: string[];      // paths that skip TokenForge verification
  sensitiveOps?: string[];   // paths requiring elevated trust (>90)
  onSecurityEvent?: (event: SecurityEvent) => Promise<void>;
}

export interface SecurityEvent {
  sessionId: string;
  userId: string;
  eventType: string;
  trustScoreBefore: number;
  trustScoreAfter: number;
  ipAddress: string;
  countryCode: string;
  userAgent: string;
  metadata: Record<string, unknown>;
}

export function tokenForgeMiddleware(options: TokenForgeOptions): MiddlewareHandler {
  const trustEngine = new TrustScoreEngine();
  
  return async (c: Context, next: Next) => {
    // Skip excluded paths
    if (shouldSkip(c.req.path, options.skipPaths)) {
      return next();
    }
    
    // Skip the binding endpoint itself
    if (c.req.path === '/api/tf/bind' && c.req.method === 'POST') {
      return next();
    }
    
    // Extract TokenForge headers
    const signature = c.req.header('X-TF-Signature');
    const nonce = c.req.header('X-TF-Nonce');
    const timestamp = c.req.header('X-TF-Timestamp');
    const deviceId = c.req.header('X-TF-Device-ID');
    
    // If no TokenForge headers, client hasn't bound yet
    // Allow the request but with degraded trust (fingerprint-only mode)
    if (!signature || !nonce || !timestamp || !deviceId) {
      // Set a flag for downstream handlers
      c.set('tf_bound', false);
      c.set('tf_trust_score', 0);
      
      // For sensitive operations, always require binding
      if (isSensitiveOp(c.req.path, c.req.method, options.sensitiveOps)) {
        return c.json({
          error: 'device_binding_required',
          action: 'bind',
          message: 'This operation requires device verification'
        }, 403);
      }
      
      return next();
    }
    
    // Get the auth provider's session/user (set by Clerk middleware)
    const clerkAuth = c.get('clerkAuth');
    if (!clerkAuth?.userId) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    
    // 1. NONCE VALIDATION — prevent replay attacks
    const nonceKey = `nonce:${nonce}`;
    const nonceUsed = await options.storage.nonces.get(nonceKey);
    if (nonceUsed) {
      await logSecurityEvent(options, c, clerkAuth, 'NONCE_REPLAY', { nonce });
      return c.json({ error: 'nonce_replay', action: 'session_revoked' }, 401);
    }
    // Mark nonce as used (auto-expires via KV TTL)
    await options.storage.nonces.put(nonceKey, '1', {
      expirationTtl: options.nonceExpiry * 2
    });
    
    // 2. TIMESTAMP VALIDATION — prevent stale requests
    const requestTimestamp = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTimestamp) > options.nonceExpiry) {
      await logSecurityEvent(options, c, clerkAuth, 'TIMESTAMP_SKEW', {
        requestTime: requestTimestamp,
        serverTime: now,
        skew: Math.abs(now - requestTimestamp)
      });
      return c.json({ error: 'request_expired', action: 'retry' }, 400);
    }
    
    // 3. LOOKUP DEVICE SESSION
    const deviceSession = await options.storage.sessions
      .prepare(`
        SELECT * FROM device_sessions 
        WHERE session_id = ? AND id = ? AND revoked = 0
      `)
      .bind(clerkAuth.sessionId, deviceId)
      .first();
    
    if (!deviceSession) {
      await logSecurityEvent(options, c, clerkAuth, 'DEVICE_NOT_FOUND', { deviceId });
      return c.json({ error: 'device_not_bound', action: 'rebind' }, 401);
    }
    
    // 4. CHECK SESSION EXPIRY
    if (new Date(deviceSession.expires_at as string) < new Date()) {
      await logSecurityEvent(options, c, clerkAuth, 'SESSION_EXPIRED', { deviceId });
      return c.json({ error: 'session_expired', action: 'reauth' }, 401);
    }
    
    // 5. VERIFY SIGNATURE
    const publicKey = await importPublicKey(deviceSession.public_key as string);
    const payload = `${clerkAuth.sessionId}:${nonce}:${timestamp}`;
    const isValid = await verifySignature(publicKey, signature, payload);
    
    if (!isValid) {
      await logSecurityEvent(options, c, clerkAuth, 'SIGNATURE_INVALID', {
        deviceId,
        payload: payload.substring(0, 50) // truncate for logging
      });
      
      // Revoke the session — someone is trying to use a stolen token
      await revokeSession(options.storage.sessions, deviceId, 'invalid_signature');
      
      return c.json({ error: 'signature_invalid', action: 'session_revoked' }, 401);
    }
    
    // 6. COMPUTE TRUST SCORE
    const trustScore = trustEngine.compute({
      signatureValid: true,
      ipAddress: c.req.header('cf-connecting-ip') || '',
      originalIp: deviceSession.ip_address as string,
      countryCode: c.req.header('cf-ipcountry') || '',
      originalCountry: deviceSession.country_code as string,
      userAgent: c.req.header('user-agent') || '',
      originalFingerprint: deviceSession.device_fingerprint as string,
      requestTimestamp: requestTimestamp,
      sessionCreatedAt: new Date(deviceSession.bound_at as string).getTime() / 1000,
    });
    
    // 7. ACT ON TRUST SCORE
    const previousScore = deviceSession.trust_score as number;
    
    // Update stored trust score
    await options.storage.sessions
      .prepare(`
        UPDATE device_sessions 
        SET trust_score = ?, last_verified_at = datetime('now')
        WHERE id = ?
      `)
      .bind(trustScore, deviceId)
      .run();
    
    if (trustScore < options.trustThresholds.stepUp) {
      // Trust too low — revoke session
      await revokeSession(options.storage.sessions, deviceId, 'trust_score_critical');
      await logSecurityEvent(options, c, clerkAuth, 'SESSION_REVOKED', {
        trustScore, previousScore, reason: 'trust_score_below_threshold'
      });
      return c.json({ error: 'trust_too_low', action: 'session_revoked' }, 401);
    }
    
    if (trustScore < options.trustThresholds.allow) {
      // Suspicious — require step-up authentication
      await logSecurityEvent(options, c, clerkAuth, 'STEP_UP_TRIGGERED', {
        trustScore, previousScore
      });
      return c.json({
        error: 'step_up_required',
        action: 'step_up_required',
        reason: trustEngine.getDropReasons(trustScore),
        trustScore
      }, 403);
    }
    
    // Elevated trust required for sensitive operations
    if (isSensitiveOp(c.req.path, c.req.method, options.sensitiveOps) && trustScore < 90) {
      return c.json({
        error: 'elevated_trust_required',
        action: 'step_up_required',
        reason: 'sensitive_operation',
        trustScore
      }, 403);
    }
    
    // 8. ALL GOOD — set context for downstream handlers
    c.set('tf_bound', true);
    c.set('tf_trust_score', trustScore);
    c.set('tf_device_id', deviceId);
    
    // Log trust score changes for monitoring
    if (Math.abs(trustScore - previousScore) > 10) {
      await logSecurityEvent(options, c, clerkAuth, 'TRUST_SCORE_CHANGE', {
        trustScore, previousScore, delta: trustScore - previousScore
      });
    }
    
    await next();
  };
}

// --- HELPER FUNCTIONS ---

async function revokeSession(db: D1Database, deviceId: string, reason: string) {
  await db.prepare(`
    UPDATE device_sessions 
    SET revoked = 1, revoked_reason = ?
    WHERE id = ?
  `).bind(reason, deviceId).run();
}

async function logSecurityEvent(
  options: TokenForgeOptions,
  c: Context,
  auth: { userId: string; sessionId: string },
  eventType: string,
  metadata: Record<string, unknown>
) {
  const event: SecurityEvent = {
    sessionId: auth.sessionId,
    userId: auth.userId,
    eventType,
    trustScoreBefore: 0,
    trustScoreAfter: 0,
    ipAddress: c.req.header('cf-connecting-ip') || '',
    countryCode: c.req.header('cf-ipcountry') || '',
    userAgent: c.req.header('user-agent') || '',
    metadata,
  };
  
  // Fire async — don't block the request
  options.onSecurityEvent?.(event).catch(console.error);
  
  // Also store in D1 for dashboard
  await options.storage.sessions.prepare(`
    INSERT INTO security_events 
    (id, session_id, user_id, event_type, ip_address, country_code, user_agent, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(),
    auth.sessionId,
    auth.userId,
    eventType,
    event.ipAddress,
    event.countryCode,
    event.userAgent,
    JSON.stringify(metadata)
  ).run();
}

function shouldSkip(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths) return false;
  return skipPaths.some(pattern => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}

function isSensitiveOp(path: string, method: string, sensitiveOps?: string[]): boolean {
  if (!sensitiveOps) return false;
  const key = `${method} ${path}`;
  return sensitiveOps.some(op => {
    if (op.includes('*')) {
      const [opMethod, opPath] = op.split(' ');
      if (opMethod !== method) return false;
      const regex = new RegExp('^' + opPath.replace(/\*/g, '[^/]+') + '$');
      return regex.test(path);
    }
    return key === op;
  });
}
```

---

## 2. CRYPTO UTILITIES (SERVER-SIDE)

```typescript
// packages/tokenforge/src/crypto.ts

/**
 * Import a JWK public key for signature verification.
 * This runs in Cloudflare Workers which has full Web Crypto support.
 */
export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
}

/**
 * Verify an ECDSA signature.
 * Returns true if the signature was produced by the corresponding private key.
 */
export async function verifySignature(
  publicKey: CryptoKey,
  signatureBase64Url: string,
  payload: string
): Promise<boolean> {
  try {
    const signatureBytes = base64UrlToArrayBuffer(signatureBase64Url);
    const payloadBytes = new TextEncoder().encode(payload);
    
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      signatureBytes,
      payloadBytes
    );
  } catch {
    return false;
  }
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

---

## 3. TRUST SCORE ENGINE

```typescript
// packages/tokenforge/src/trust-score.ts

interface TrustSignals {
  signatureValid: boolean;
  ipAddress: string;
  originalIp: string;
  countryCode: string;
  originalCountry: string;
  userAgent: string;
  originalFingerprint: string;
  requestTimestamp: number;
  sessionCreatedAt: number;
}

interface ScoreBreakdown {
  signatureScore: number;      // 0 or 40
  ipScore: number;             // 0-15
  geoScore: number;            // 0-15
  fingerprintScore: number;    // 0-10
  velocityScore: number;       // 0-10
  timeScore: number;           // 0-5
  nonceScore: number;          // 0-5
  total: number;
  reasons: string[];
}

export class TrustScoreEngine {
  compute(signals: TrustSignals): number {
    const breakdown = this.computeBreakdown(signals);
    return breakdown.total;
  }
  
  getDropReasons(signals: TrustSignals): string[] {
    return this.computeBreakdown(signals).reasons;
  }
  
  private computeBreakdown(signals: TrustSignals): ScoreBreakdown {
    const reasons: string[] = [];
    
    // Signature (40 points) — binary, it's valid or it's not
    const signatureScore = signals.signatureValid ? 40 : 0;
    if (!signals.signatureValid) reasons.push('invalid_signature');
    
    // IP consistency (15 points)
    let ipScore = 0;
    if (signals.ipAddress === signals.originalIp) {
      ipScore = 15;
    } else if (this.sameSubnet(signals.ipAddress, signals.originalIp)) {
      ipScore = 10; // Same /24 subnet — probably same network
    } else {
      ipScore = 0;
      reasons.push('ip_changed');
    }
    
    // Geo consistency (15 points)
    let geoScore = 0;
    if (signals.countryCode === signals.originalCountry) {
      geoScore = 15;
    } else {
      geoScore = 0;
      reasons.push('geo_changed');
    }
    
    // Device fingerprint (10 points)
    const currentFingerprint = this.hashFingerprint(signals.userAgent);
    let fingerprintScore = 0;
    if (currentFingerprint === signals.originalFingerprint) {
      fingerprintScore = 10;
    } else {
      fingerprintScore = 0;
      reasons.push('device_fingerprint_changed');
    }
    
    // Velocity / timing (10 points) — based on session age
    // Brand new sessions get full score, very old sessions get less
    const sessionAge = signals.requestTimestamp - signals.sessionCreatedAt;
    let velocityScore = 10;
    if (sessionAge > 12 * 3600) velocityScore = 7;  // >12h old
    if (sessionAge > 20 * 3600) velocityScore = 5;  // >20h old
    
    // Time of day (5 points) — placeholder for ML-based patterns later
    const timeScore = 5; // default full score
    
    // Nonce freshness (5 points) — if we got here, nonce was valid
    const nonceScore = 5;
    
    const total = signatureScore + ipScore + geoScore + 
                  fingerprintScore + velocityScore + timeScore + nonceScore;
    
    return {
      signatureScore,
      ipScore,
      geoScore,
      fingerprintScore,
      velocityScore,
      timeScore,
      nonceScore,
      total,
      reasons,
    };
  }
  
  private sameSubnet(ip1: string, ip2: string): boolean {
    const parts1 = ip1.split('.');
    const parts2 = ip2.split('.');
    if (parts1.length !== 4 || parts2.length !== 4) return false;
    return parts1[0] === parts2[0] && 
           parts1[1] === parts2[1] && 
           parts1[2] === parts2[2];
  }
  
  private hashFingerprint(userAgent: string): string {
    // Simple hash for now — can be expanded with more signals
    let hash = 0;
    for (let i = 0; i < userAgent.length; i++) {
      const char = userAgent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}
```

---

## 4. BINDING ENDPOINT

```typescript
// apps/api/src/routes/tokenforge.ts

import { Hono } from 'hono';

const tf = new Hono();

/**
 * POST /api/tf/bind
 * 
 * Called by client SDK after authentication.
 * Receives the public key and binds it to the current session.
 */
tf.post('/bind', async (c) => {
  const auth = c.get('clerkAuth');
  if (!auth?.userId || !auth?.sessionId) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const body = await c.req.json();
  const { publicKey, sessionId, metadata } = body;
  
  // Validate session ID matches Clerk's
  if (sessionId !== auth.sessionId) {
    return c.json({ error: 'session_mismatch' }, 400);
  }
  
  // Validate public key format
  if (!publicKey?.kty || publicKey.kty !== 'EC' || publicKey.crv !== 'P-256') {
    return c.json({ error: 'invalid_key_format' }, 400);
  }
  
  // Generate device ID
  const deviceId = crypto.randomUUID().replace(/-/g, '');
  
  // Compute device fingerprint from metadata
  const fingerprint = hashMetadata(metadata);
  
  // Store binding
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  await c.env.D1.prepare(`
    INSERT INTO device_sessions 
    (id, session_id, user_id, public_key, device_fingerprint, 
     ip_address, country_code, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    deviceId,
    auth.sessionId,
    auth.userId,
    JSON.stringify(publicKey),
    fingerprint,
    c.req.header('cf-connecting-ip') || '',
    c.req.header('cf-ipcountry') || '',
    expiresAt
  ).run();
  
  // Log binding event
  await c.env.D1.prepare(`
    INSERT INTO security_events 
    (id, session_id, user_id, event_type, ip_address, country_code, user_agent, metadata, created_at)
    VALUES (?, ?, ?, 'DEVICE_BOUND', ?, ?, ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(),
    auth.sessionId,
    auth.userId,
    c.req.header('cf-connecting-ip') || '',
    c.req.header('cf-ipcountry') || '',
    c.req.header('user-agent') || '',
    JSON.stringify({ deviceId, fingerprint, metadata })
  ).run();
  
  return c.json({ deviceId, expiresAt });
});

/**
 * GET /api/tf/sessions
 * 
 * List active sessions for the current user.
 * Used by security dashboard.
 */
tf.get('/sessions', async (c) => {
  const auth = c.get('clerkAuth');
  if (!auth?.userId) return c.json({ error: 'unauthorized' }, 401);
  
  const sessions = await c.env.D1.prepare(`
    SELECT id, session_id, device_fingerprint, ip_address, country_code,
           trust_score, bound_at, last_verified_at, expires_at, revoked
    FROM device_sessions 
    WHERE user_id = ?
    ORDER BY bound_at DESC
    LIMIT 20
  `).bind(auth.userId).all();
  
  return c.json({ sessions: sessions.results });
});

/**
 * DELETE /api/tf/sessions/:id
 * 
 * Revoke a specific session.
 */
tf.delete('/sessions/:id', async (c) => {
  const auth = c.get('clerkAuth');
  if (!auth?.userId) return c.json({ error: 'unauthorized' }, 401);
  
  const deviceId = c.req.param('id');
  
  await c.env.D1.prepare(`
    UPDATE device_sessions 
    SET revoked = 1, revoked_reason = 'user_revoked'
    WHERE id = ? AND user_id = ?
  `).bind(deviceId, auth.userId).run();
  
  return c.json({ revoked: true });
});

/**
 * GET /api/tf/events
 * 
 * Security events for dashboard.
 */
tf.get('/events', async (c) => {
  const auth = c.get('clerkAuth');
  if (!auth?.userId) return c.json({ error: 'unauthorized' }, 401);
  
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  
  const events = await c.env.D1.prepare(`
    SELECT * FROM security_events 
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(auth.userId, limit, offset).all();
  
  return c.json({ events: events.results });
});

export { tf as tokenForgeRoutes };

function hashMetadata(metadata: Record<string, string>): string {
  const str = `${metadata?.userAgent}:${metadata?.language}:${metadata?.platform}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}
```

---

## 5. STEP-UP AUTH FLOW

```typescript
// apps/api/src/routes/step-up.ts

import { Hono } from 'hono';

const stepUp = new Hono();

/**
 * POST /api/tf/step-up/initiate
 * 
 * When trust score drops, server demands step-up auth.
 * This endpoint creates a challenge.
 */
stepUp.post('/initiate', async (c) => {
  const auth = c.get('clerkAuth');
  if (!auth?.userId) return c.json({ error: 'unauthorized' }, 401);
  
  const { method } = await c.req.json(); // 'totp' | 'passkey' | 'email_otp'
  
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
  
  await c.env.D1.prepare(`
    INSERT INTO step_up_challenges 
    (id, session_id, user_id, reason, method, expires_at)
    VALUES (?, ?, ?, 'trust_score_drop', ?, ?)
  `).bind(
    challengeId,
    auth.sessionId,
    auth.userId,
    method || 'totp',
    expiresAt
  ).run();
  
  // If method is email_otp, send OTP email via Resend
  if (method === 'email_otp') {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await c.env.KV.put(`step_up_otp:${challengeId}`, otp, { expirationTtl: 300 });
    // Send email (implementation depends on Resend setup)
    // await sendStepUpEmail(auth.userId, otp);
  }
  
  return c.json({ challengeId, method, expiresAt });
});

/**
 * POST /api/tf/step-up/complete
 * 
 * User completes step-up challenge.
 * Trust score is restored and session continues.
 */
stepUp.post('/complete', async (c) => {
  const auth = c.get('clerkAuth');
  if (!auth?.userId) return c.json({ error: 'unauthorized' }, 401);
  
  const { challengeId, code } = await c.req.json();
  
  // Verify challenge exists and belongs to user
  const challenge = await c.env.D1.prepare(`
    SELECT * FROM step_up_challenges 
    WHERE id = ? AND user_id = ? AND status = 'pending'
  `).bind(challengeId, auth.userId).first();
  
  if (!challenge) {
    return c.json({ error: 'invalid_challenge' }, 400);
  }
  
  if (new Date(challenge.expires_at as string) < new Date()) {
    return c.json({ error: 'challenge_expired' }, 400);
  }
  
  // Verify the code based on method
  let verified = false;
  
  if (challenge.method === 'totp') {
    // Verify via Clerk's TOTP verification
    // This would call Clerk's API to verify the TOTP code
    verified = await verifyTOTPWithClerk(auth.userId, code);
  } else if (challenge.method === 'email_otp') {
    const storedOtp = await c.env.KV.get(`step_up_otp:${challengeId}`);
    verified = storedOtp === code;
    if (verified) await c.env.KV.delete(`step_up_otp:${challengeId}`);
  }
  
  if (!verified) {
    await c.env.D1.prepare(`
      UPDATE step_up_challenges SET status = 'failed' WHERE id = ?
    `).bind(challengeId).run();
    return c.json({ error: 'verification_failed' }, 401);
  }
  
  // Mark challenge complete
  await c.env.D1.prepare(`
    UPDATE step_up_challenges 
    SET status = 'completed', completed_at = datetime('now')
    WHERE id = ?
  `).bind(challengeId).run();
  
  // Restore trust score on the device session
  const deviceId = c.req.header('X-TF-Device-ID');
  if (deviceId) {
    await c.env.D1.prepare(`
      UPDATE device_sessions SET trust_score = 100 WHERE id = ?
    `).bind(deviceId).run();
  }
  
  return c.json({ verified: true, trustScore: 100 });
});

export { stepUp as stepUpRoutes };

async function verifyTOTPWithClerk(userId: string, code: string): Promise<boolean> {
  // Placeholder — integrate with Clerk's TOTP verification API
  // https://clerk.com/docs/reference/backend-api/tag/Users#operation/VerifyTOTP
  return false;
}
```
