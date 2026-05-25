/**
 * Tests: TokenForge Server Verification Pipeline
 *
 * Validates the framework-agnostic verifyRequest() function that
 * all adapters delegate to. This is the most critical code path.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { verifyRequest, type TfRequestContext } from '../../packages/tokenforge/src/server/verify.js';
import { MemoryStorage } from '../../packages/tokenforge/src/server/storage/memory.js';
import type { TokenForgeServerOptions, DeviceSession } from '../../packages/tokenforge/src/shared/types.js';
import { hashFingerprint } from '../../packages/tokenforge/src/server/trust-score.js';

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

function makeCtx(overrides: Partial<TfRequestContext> = {}): TfRequestContext {
  return {
    path: '/api/data',
    method: 'GET',
    userId: 'user-001',
    sessionId: 'session-001',
    ipAddress: '192.168.1.100',
    countryCode: 'US',
    userAgent: 'TestBrowser/1.0',
    headers: {
      signature: 'valid-sig',
      nonce: 'unique-nonce-' + Math.random(),
      timestamp: String(Math.floor(Date.now() / 1000)),
      deviceId: 'device-001',
    },
    ...overrides,
  };
}

function seedStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  const now = new Date();
  const session: DeviceSession = {
    id: 'device-001',
    session_id: 'session-001',
    user_id: 'user-001',
    public_key: '{}',
    device_fingerprint: hashFingerprint('TestBrowser/1.0'),
    ip_address: '192.168.1.100',
    country_code: 'US',
    trust_score: 100,
    bound_at: now.toISOString(),
    last_verified_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 86400000).toISOString(),
    revoked: 0,
    revoked_reason: null,
    created_at: now.toISOString(),
  };
  storage.sessions.push(session);
  return storage;
}

describe('Verify Pipeline', () => {
  it('should skip paths in skipPaths list', async () => {
    const storage = new MemoryStorage();
    const result = await verifyRequest(
      makeCtx({ path: '/health' }),
      makeOptions(storage),
    );
    expect(result.status).toBe('skip');
  });

  it('should skip the /api/tf/bind endpoint', async () => {
    const storage = new MemoryStorage();
    const result = await verifyRequest(
      makeCtx({ path: '/api/tf/bind', method: 'POST' }),
      makeOptions(storage),
    );
    expect(result.status).toBe('skip');
  });

  it('should skip all /api/tf/* routes', async () => {
    const storage = new MemoryStorage();
    const result = await verifyRequest(
      makeCtx({ path: '/api/tf/sessions' }),
      makeOptions(storage),
    );
    expect(result.status).toBe('skip');
  });

  it('should degrade when no TF headers present (non-sensitive)', async () => {
    const storage = new MemoryStorage();
    const result = await verifyRequest(
      makeCtx({
        headers: { signature: null, nonce: null, timestamp: null, deviceId: null },
      }),
      makeOptions(storage),
    );
    expect(result.status).toBe('degraded');
  });

  it('should error when no TF headers on sensitive op', async () => {
    const storage = new MemoryStorage();
    const result = await verifyRequest(
      makeCtx({
        path: '/admin/user',
        method: 'DELETE',
        headers: { signature: null, nonce: null, timestamp: null, deviceId: null },
      }),
      makeOptions(storage),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe(403);
      expect(result.body.error).toBe('device_binding_required');
    }
  });

  it('should error when no userId/sessionId', async () => {
    const storage = seedStorage();
    const result = await verifyRequest(
      makeCtx({ userId: null, sessionId: null }),
      makeOptions(storage),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe(401);
    }
  });

  it('should detect nonce replay', async () => {
    const storage = seedStorage();
    const nonce = 'replay-nonce';
    await storage.storeNonce(nonce, 120);

    const result = await verifyRequest(
      makeCtx({ headers: { signature: 's', nonce, timestamp: '1700000000', deviceId: 'device-001' } }),
      makeOptions(storage),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.body.error).toBe('nonce_replay');
    }
  });

  it('should reject expired timestamps', async () => {
    const storage = seedStorage();
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 200);
    const result = await verifyRequest(
      makeCtx({
        headers: {
          signature: 's',
          nonce: 'fresh-nonce-' + Math.random(),
          timestamp: oldTimestamp,
          deviceId: 'device-001',
        },
      }),
      makeOptions(storage),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.body.error).toBe('request_expired');
    }
  });

  it('should reject when device session not found', async () => {
    const storage = seedStorage();
    const result = await verifyRequest(
      makeCtx({
        headers: {
          signature: 's',
          nonce: 'nonce-' + Math.random(),
          timestamp: String(Math.floor(Date.now() / 1000)),
          deviceId: 'unknown-device',
        },
      }),
      makeOptions(storage),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.body.error).toBe('device_not_bound');
    }
  });

  it('should reject expired sessions', async () => {
    const storage = new MemoryStorage();
    storage.sessions.push({
      id: 'device-001',
      session_id: 'session-001',
      user_id: 'user-001',
      public_key: '{}',
      device_fingerprint: null,
      ip_address: null,
      country_code: null,
      trust_score: 100,
      bound_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() - 3600000).toISOString(),
      revoked: 0,
      revoked_reason: null,
      created_at: new Date().toISOString(),
    });

    const result = await verifyRequest(
      makeCtx({
        headers: {
          signature: 's',
          nonce: 'nonce-' + Math.random(),
          timestamp: String(Math.floor(Date.now() / 1000)),
          deviceId: 'device-001',
        },
      }),
      makeOptions(storage),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.body.error).toBe('session_expired');
    }
  });
});
