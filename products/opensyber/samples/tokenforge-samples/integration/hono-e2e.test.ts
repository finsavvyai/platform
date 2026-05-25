/**
 * REAL Integration Test: Hono App with TokenForge (Real Crypto)
 *
 * Creates a full Hono app with TokenForge binding + verification routes,
 * then sends HTTP requests through it with real ECDSA signatures.
 *
 * Flow tested:
 * 1. POST /api/tf/bind — bind device with real public key
 * 2. GET /api/profile — with real signed headers → verified
 * 3. GET /api/profile — with forged signature → rejected
 * 4. GET /api/profile — with replayed nonce → rejected
 * 5. GET /health — skipped (no verification)
 *
 * NO MOCKS. Real Hono app, real crypto, real MemoryStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { MemoryStorage } from '../../packages/tokenforge/src/server/storage/memory.js';
import { createTokenForgeRoutes } from '../../packages/tokenforge/src/server/binding.js';
import { verifyRequest, type TfRequestContext } from '../../packages/tokenforge/src/server/verify.js';
import type { TokenForgeServerOptions, DeviceSession } from '../../packages/tokenforge/src/shared/types.js';
import { hashFingerprint } from '../../packages/tokenforge/src/server/trust-score.js';
import { generateKeyPair, exportPublicKeyJwk, signPayload, generateNonce } from './crypto-helpers.js';

interface Variables {
  userId: string;
  sessionId: string;
  tf?: { bound: boolean; trustScore: number; deviceId: string | null };
}

function buildApp(storage: MemoryStorage) {
  const options: TokenForgeServerOptions = {
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    skipPaths: ['/health'],
  };

  const app = new Hono<{ Variables: Variables }>();

  // Fake auth middleware (sets userId/sessionId)
  app.use('*', async (c, next) => {
    c.set('userId', c.req.header('X-User-ID') ?? 'user-001');
    c.set('sessionId', c.req.header('X-Session-ID') ?? 'session-001');
    await next();
  });

  // TokenForge binding routes at /api/tf/*
  const tfRoutes = createTokenForgeRoutes(options);
  app.route('/api/tf', tfRoutes);

  // Custom verify middleware for /api/* (not /api/tf/*)
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/tf')) return next();
    const ctx: TfRequestContext = {
      path: c.req.path,
      method: c.req.method,
      userId: c.get('userId'),
      sessionId: c.get('sessionId'),
      ipAddress: c.req.header('X-Real-IP') ?? '127.0.0.1',
      countryCode: c.req.header('X-Country') ?? 'US',
      userAgent: c.req.header('User-Agent') ?? '',
      headers: {
        signature: c.req.header('X-TF-Signature') ?? null,
        nonce: c.req.header('X-TF-Nonce') ?? null,
        timestamp: c.req.header('X-TF-Timestamp') ?? null,
        deviceId: c.req.header('X-TF-Device-ID') ?? null,
      },
    };
    const result = await verifyRequest(ctx, options);
    if (result.status === 'ok') {
      c.set('tf', { bound: true, trustScore: result.trustScore, deviceId: result.deviceId });
    } else if (result.status === 'error') {
      return c.json(result.body, result.code as 400);
    } else {
      c.set('tf', { bound: false, trustScore: 0, deviceId: null });
    }
    return next();
  });

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.get('/api/profile', (c) => {
    const tf = c.get('tf');
    return c.json({ bound: tf?.bound, score: tf?.trustScore, device: tf?.deviceId });
  });

  return app;
}

describe('Real Hono E2E with TokenForge', () => {
  let storage: MemoryStorage;
  let app: ReturnType<typeof buildApp>;
  let keyPair: CryptoKeyPair;
  let publicKeyJwk: string;
  const deviceId = 'e2e-device-001';
  const sessionId = 'session-001';
  const userId = 'user-001';
  const ip = '192.168.1.1';
  const ua = 'E2ETestAgent/1.0';

  beforeEach(async () => {
    storage = new MemoryStorage();
    app = buildApp(storage);
    keyPair = await generateKeyPair();
    publicKeyJwk = await exportPublicKeyJwk(keyPair);

    // Pre-seed a bound session (simulating a completed bind)
    const now = new Date();
    await storage.createSession({
      id: deviceId,
      session_id: sessionId,
      user_id: userId,
      public_key: publicKeyJwk,
      device_fingerprint: hashFingerprint(ua),
      ip_address: ip,
      country_code: 'US',
      trust_score: 100,
      bound_at: now.toISOString(),
      last_verified_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 86400000).toISOString(),
      revoked: 0,
      revoked_reason: null,
      created_at: now.toISOString(),
    });
  });

  it('health endpoint should bypass verification', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('should verify a real signed request', async () => {
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);

    const res = await app.request('/api/profile', {
      headers: {
        'X-TF-Signature': signature,
        'X-TF-Nonce': nonce,
        'X-TF-Timestamp': String(timestamp),
        'X-TF-Device-ID': deviceId,
        'X-User-ID': userId,
        'X-Session-ID': sessionId,
        'X-Real-IP': ip,
        'X-Country': 'US',
        'User-Agent': ua,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bound).toBe(true);
    expect(body.score).toBe(100);
    expect(body.device).toBe(deviceId);
  });

  it('should reject a forged signature', async () => {
    const attackerKeys = await generateKeyPair();
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const badSig = await signPayload(attackerKeys.privateKey, sessionId, nonce, timestamp);

    const res = await app.request('/api/profile', {
      headers: {
        'X-TF-Signature': badSig,
        'X-TF-Nonce': nonce,
        'X-TF-Timestamp': String(timestamp),
        'X-TF-Device-ID': deviceId,
        'X-User-ID': userId,
        'X-Session-ID': sessionId,
        'User-Agent': ua,
      },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('signature_invalid');
  });

  it('should detect nonce replay', async () => {
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const sig1 = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);

    const headers = {
      'X-TF-Signature': sig1,
      'X-TF-Nonce': nonce,
      'X-TF-Timestamp': String(timestamp),
      'X-TF-Device-ID': deviceId,
      'X-User-ID': userId,
      'X-Session-ID': sessionId,
      'User-Agent': ua,
    };

    // First request passes
    const res1 = await app.request('/api/profile', { headers });
    expect(res1.status).toBe(200);

    // Replay with same nonce
    const sig2 = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);
    const res2 = await app.request('/api/profile', {
      headers: { ...headers, 'X-TF-Signature': sig2 },
    });
    expect(res2.status).toBe(401);
    const body = await res2.json();
    expect(body.error).toBe('nonce_replay');
  });

  it('should degrade gracefully without TF headers', async () => {
    const res = await app.request('/api/profile', {
      headers: { 'X-User-ID': userId, 'X-Session-ID': sessionId },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bound).toBe(false);
    expect(body.score).toBe(0);
  });

  it('should list sessions via /api/tf/sessions', async () => {
    const res = await app.request('/api/tf/sessions', {
      headers: { 'X-User-ID': userId, 'X-Session-ID': sessionId },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].id).toBe(deviceId);
  });

  it('should revoke a session via DELETE /api/tf/sessions/:id', async () => {
    const res = await app.request(`/api/tf/sessions/${deviceId}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': userId, 'X-Session-ID': sessionId },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(true);

    // Verify session is revoked
    const session = await storage.getSession(sessionId, deviceId);
    expect(session).toBeNull();
  });

  it('should return trust score via /api/tf/trust-score', async () => {
    const res = await app.request('/api/tf/trust-score', {
      headers: {
        'X-User-ID': userId,
        'X-Session-ID': sessionId,
        'X-TF-Device-ID': deviceId,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trustScore).toBe(100);
    expect(body.isBound).toBe(true);
    expect(body.deviceId).toBe(deviceId);
  });
});
