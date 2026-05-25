/**
 * REAL Integration Test: Full Device Binding → Verification Flow
 *
 * Exercises the complete flow with real crypto and real MemoryStorage:
 * 1. Generate keypair (simulating browser client)
 * 2. Export public key and create a device session in storage
 * 3. Sign a request with the private key
 * 4. Run verifyRequest() which imports the key, verifies sig, computes trust
 * 5. Verify trust score is 100 (all signals match)
 *
 * NO MOCKS. Real crypto, real storage, real trust scoring.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { verifyRequest, type TfRequestContext } from '../../packages/tokenforge/src/server/verify.js';
import { MemoryStorage } from '../../packages/tokenforge/src/server/storage/memory.js';
import { hashFingerprint } from '../../packages/tokenforge/src/server/trust-score.js';
import type { TokenForgeServerOptions, DeviceSession } from '../../packages/tokenforge/src/shared/types.js';
import { generateKeyPair, exportPublicKeyJwk, signPayload, generateNonce } from './crypto-helpers.js';

function makeOptions(storage: MemoryStorage): TokenForgeServerOptions {
  return {
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    skipPaths: ['/health'],
    sensitiveOps: ['DELETE /admin/user'],
  };
}

describe('Real Binding → Verification Flow', () => {
  let storage: MemoryStorage;
  let keyPair: CryptoKeyPair;
  let publicKeyJwk: string;
  const sessionId = 'real-session-001';
  const userId = 'real-user-001';
  const deviceId = 'real-device-001';
  const ip = '192.168.1.50';
  const country = 'US';
  const ua = 'RealTestBrowser/1.0';

  beforeEach(async () => {
    storage = new MemoryStorage();
    keyPair = await generateKeyPair();
    publicKeyJwk = await exportPublicKeyJwk(keyPair);

    // Simulate bind: server stores session with real public key
    const now = new Date();
    const session: DeviceSession = {
      id: deviceId,
      session_id: sessionId,
      user_id: userId,
      public_key: publicKeyJwk,
      device_fingerprint: hashFingerprint(ua),
      ip_address: ip,
      country_code: country,
      trust_score: 100,
      bound_at: now.toISOString(),
      last_verified_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 86400000).toISOString(),
      revoked: 0,
      revoked_reason: null,
      created_at: now.toISOString(),
    };
    await storage.createSession(session);
  });

  it('should verify a real signed request and return trust 100', async () => {
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);

    const ctx: TfRequestContext = {
      path: '/api/data',
      method: 'GET',
      userId,
      sessionId,
      ipAddress: ip,
      countryCode: country,
      userAgent: ua,
      headers: {
        signature,
        nonce,
        timestamp: String(timestamp),
        deviceId,
      },
    };

    const result = await verifyRequest(ctx, makeOptions(storage));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.trustScore).toBe(100);
      expect(result.deviceId).toBe(deviceId);
      expect(result.bound).toBe(true);
    }
  });

  it('should reject a forged signature (wrong private key)', async () => {
    const attackerKeys = await generateKeyPair();
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    // Attacker signs with their own key
    const signature = await signPayload(attackerKeys.privateKey, sessionId, nonce, timestamp);

    const ctx: TfRequestContext = {
      path: '/api/data',
      method: 'GET',
      userId,
      sessionId,
      ipAddress: ip,
      countryCode: country,
      userAgent: ua,
      headers: { signature, nonce, timestamp: String(timestamp), deviceId },
    };

    const result = await verifyRequest(ctx, makeOptions(storage));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.body.error).toBe('signature_invalid');
    }
  });

  it('should detect nonce replay on second use', async () => {
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);

    const ctx: TfRequestContext = {
      path: '/api/data',
      method: 'GET',
      userId,
      sessionId,
      ipAddress: ip,
      countryCode: country,
      userAgent: ua,
      headers: { signature, nonce, timestamp: String(timestamp), deviceId },
    };

    // First request: should pass
    const result1 = await verifyRequest(ctx, makeOptions(storage));
    expect(result1.status).toBe('ok');

    // Second request with SAME nonce: should fail
    const sig2 = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);
    const ctx2 = { ...ctx, headers: { ...ctx.headers, signature: sig2 } };
    const result2 = await verifyRequest(ctx2, makeOptions(storage));
    expect(result2.status).toBe('error');
    if (result2.status === 'error') {
      expect(result2.body.error).toBe('nonce_replay');
    }
  });

  it('should reject expired timestamps', async () => {
    const nonce = generateNonce();
    const oldTimestamp = Math.floor(Date.now() / 1000) - 200; // 200s ago
    const signature = await signPayload(keyPair.privateKey, sessionId, nonce, oldTimestamp);

    const ctx: TfRequestContext = {
      path: '/api/data',
      method: 'GET',
      userId,
      sessionId,
      ipAddress: ip,
      countryCode: country,
      userAgent: ua,
      headers: { signature, nonce, timestamp: String(oldTimestamp), deviceId },
    };

    const result = await verifyRequest(ctx, makeOptions(storage));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.body.error).toBe('request_expired');
    }
  });

  it('should reduce trust score when IP changes', async () => {
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);

    const ctx: TfRequestContext = {
      path: '/api/data',
      method: 'GET',
      userId,
      sessionId,
      ipAddress: '10.0.0.99', // different IP
      countryCode: country,
      userAgent: ua,
      headers: { signature, nonce, timestamp: String(timestamp), deviceId },
    };

    const result = await verifyRequest(ctx, makeOptions(storage));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.trustScore).toBeLessThan(100);
      expect(result.trustScore).toBeGreaterThanOrEqual(80); // still allowed
    }
  });

  it('should trigger step-up when IP + geo + fingerprint change', async () => {
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);

    const ctx: TfRequestContext = {
      path: '/api/data',
      method: 'GET',
      userId,
      sessionId,
      ipAddress: '45.33.32.1',    // different IP
      countryCode: 'RU',           // different country
      userAgent: 'DifferentAgent', // different fingerprint
      headers: { signature, nonce, timestamp: String(timestamp), deviceId },
    };

    const result = await verifyRequest(ctx, makeOptions(storage));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.body.error).toBe('step_up_required');
    }
  });
});
