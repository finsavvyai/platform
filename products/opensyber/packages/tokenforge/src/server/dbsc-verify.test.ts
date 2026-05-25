import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from './storage/memory.js';
import type { TokenForgeServerOptions, DeviceSession, DbscConfig } from '../shared/types.js';
import type { TfRequestContext, DbscFlags } from './verify.js';
import { hashFingerprint } from './trust-score.js';
import { issueBoundCookie, BOUND_COOKIE_NAME } from './bound-cookie.js';

vi.mock('./crypto.js', () => ({
  importPublicKey: vi.fn().mockResolvedValue({} as CryptoKey),
  verifySignature: vi.fn().mockResolvedValue(true),
}));

const { verifyRequest } = await import('./verify.js');

const UA = 'Mozilla/5.0 TestAgent';
const DBSC_ON: DbscConfig = { enabled: true, rotationInterval: 300 };

function makeOptions(storage: MemoryStorage, dbsc?: DbscConfig): TokenForgeServerOptions {
  return {
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    skipPaths: ['/health'],
    sensitiveOps: [],
    dbsc,
  };
}

const TS_NOW = () => String(Math.floor(Date.now() / 1000));
const V1_HDRS = (cookie?: string) => ({
  signature: 'valid-sig', nonce: `n-${Math.random()}`,
  timestamp: TS_NOW(), deviceId: 'dev-1', cookie: cookie ?? null,
});

function makeCtx(overrides: Partial<TfRequestContext> = {}): TfRequestContext {
  return {
    path: '/api/data', method: 'GET', userId: 'user-1', sessionId: 'sess-1',
    ipAddress: '1.2.3.4', countryCode: 'US', userAgent: UA, headers: V1_HDRS(), ...overrides,
  };
}

function makeSession(overrides: Partial<DeviceSession> = {}): DeviceSession {
  const now = new Date().toISOString();
  return {
    id: 'dev-1', session_id: 'sess-1', user_id: 'user-1', public_key: '{}',
    device_fingerprint: hashFingerprint(UA), ip_address: '1.2.3.4',
    country_code: 'US', trust_score: 100, bound_at: now, last_verified_at: now,
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
    revoked: 0, revoked_reason: null, created_at: now,
    ...overrides,
  };
}

describe('verifyRequest — DBSC integration', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('DBSC enabled + valid cookie → ok with cookieValid: true', async () => {
    const cookie = await issueBoundCookie({ maxAgeSeconds: 300 });
    const session = makeSession({
      bound_cookie_hash: cookie.hash,
      bound_cookie_expires_at: cookie.expiresAt,
    });
    await storage.createSession(session);

    const cookieHeader = `${BOUND_COOKIE_NAME}=${cookie.value}`;
    const ctx = makeCtx({ headers: V1_HDRS(cookieHeader) });
    const result = await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    expect(result.status).toBe('ok');
    const ok = result as { status: 'ok'; dbsc?: DbscFlags };
    expect(ok.dbsc).toBeDefined();
    expect(ok.dbsc!.cookieValid).toBe(true);
    expect(ok.dbsc!.reason).toBeUndefined();
  });

  it('DBSC enabled + missing cookie → ok with degraded dbsc (cookie_missing)', async () => {
    await storage.createSession(makeSession({ bound_cookie_hash: 'stored-hash' }));
    const ctx = makeCtx({ headers: V1_HDRS(null) });
    const result = await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    expect(result.status).toBe('ok');
    const ok = result as { status: 'ok'; dbsc?: DbscFlags };
    expect(ok.dbsc).toBeDefined();
    expect(ok.dbsc!.cookieValid).toBe(false);
    expect(ok.dbsc!.reason).toBe('cookie_missing');
  });

  it('DBSC enabled + invalid cookie hash → ok with degraded dbsc (cookie_invalid)', async () => {
    const cookie = await issueBoundCookie({ maxAgeSeconds: 300 });
    await storage.createSession(makeSession({
      bound_cookie_hash: cookie.hash,
      bound_cookie_expires_at: cookie.expiresAt,
    }));

    // Send a different cookie value
    const wrongCookie = `${BOUND_COOKIE_NAME}=totally-wrong-value`;
    const ctx = makeCtx({ headers: V1_HDRS(wrongCookie) });
    const result = await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    expect(result.status).toBe('ok');
    const ok = result as { status: 'ok'; dbsc?: DbscFlags };
    expect(ok.dbsc).toBeDefined();
    expect(ok.dbsc!.cookieValid).toBe(false);
    expect(ok.dbsc!.reason).toBe('cookie_invalid');
  });

  it('DBSC disabled → skips cookie check entirely (no dbsc in result)', async () => {
    await storage.createSession(makeSession());
    const ctx = makeCtx();
    const result = await verifyRequest(ctx, makeOptions(storage));

    expect(result.status).toBe('ok');
    const ok = result as { status: 'ok'; dbsc?: DbscFlags };
    expect(ok.dbsc).toBeUndefined();
  });

  it('DBSC enabled + valid cookie near expiry → rotateCookie is true', async () => {
    const cookie = await issueBoundCookie({ maxAgeSeconds: 300 });
    // Set cookie to expire in 60s (less than half of 300s rotation interval)
    const nearExpiry = new Date(Date.now() + 60_000).toISOString();
    await storage.createSession(makeSession({
      bound_cookie_hash: cookie.hash,
      bound_cookie_expires_at: nearExpiry,
    }));

    const cookieHeader = `${BOUND_COOKIE_NAME}=${cookie.value}`;
    const ctx = makeCtx({ headers: V1_HDRS(cookieHeader) });
    const result = await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    expect(result.status).toBe('ok');
    const ok = result as { status: 'ok'; dbsc?: DbscFlags };
    expect(ok.dbsc!.cookieValid).toBe(true);
    expect(ok.dbsc!.rotateCookie).toBe(true);
  });

  it('DBSC enabled + valid cookie far from expiry → rotateCookie is false', async () => {
    const cookie = await issueBoundCookie({ maxAgeSeconds: 300 });
    // Cookie expires well in the future (more than half of rotationInterval)
    await storage.createSession(makeSession({
      bound_cookie_hash: cookie.hash,
      bound_cookie_expires_at: cookie.expiresAt,
    }));

    const cookieHeader = `${BOUND_COOKIE_NAME}=${cookie.value}`;
    const ctx = makeCtx({ headers: V1_HDRS(cookieHeader) });
    const result = await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    expect(result.status).toBe('ok');
    const ok = result as { status: 'ok'; dbsc?: DbscFlags };
    expect(ok.dbsc!.cookieValid).toBe(true);
    expect(ok.dbsc!.rotateCookie).toBe(false);
  });

  it('DBSC enabled + cookie missing → logs DBSC_COOKIE_MISSING event', async () => {
    await storage.createSession(makeSession({ bound_cookie_hash: 'stored-hash' }));
    const ctx = makeCtx({ headers: V1_HDRS(null) });
    await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    const events = storage.events.filter((e) => e.eventType === 'DBSC_COOKIE_MISSING');
    expect(events.length).toBe(1);
    expect(events[0]!.metadata.reason).toBe('cookie_missing');
  });

  it('DBSC enabled + invalid cookie → logs DBSC_COOKIE_INVALID event', async () => {
    const cookie = await issueBoundCookie({ maxAgeSeconds: 300 });
    await storage.createSession(makeSession({
      bound_cookie_hash: cookie.hash,
      bound_cookie_expires_at: cookie.expiresAt,
    }));

    const wrongCookie = `${BOUND_COOKIE_NAME}=bad-cookie-value`;
    const ctx = makeCtx({ headers: V1_HDRS(wrongCookie) });
    await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    const events = storage.events.filter((e) => e.eventType === 'DBSC_COOKIE_INVALID');
    expect(events.length).toBe(1);
    expect(events[0]!.metadata.reason).toBe('cookie_invalid');
  });

  it('DBSC never blocks when ECDSA passes — even with invalid cookie, status is ok', async () => {
    await storage.createSession(makeSession({ bound_cookie_hash: 'some-hash' }));
    const wrongCookie = `${BOUND_COOKIE_NAME}=wrong`;
    const ctx = makeCtx({ headers: V1_HDRS(wrongCookie) });
    const result = await verifyRequest(ctx, makeOptions(storage, DBSC_ON));

    // Status is ok (not error), DBSC is additive
    expect(result.status).toBe('ok');
  });
});
