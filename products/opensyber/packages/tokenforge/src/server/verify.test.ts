import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from './storage/memory.js';
import type { TokenForgeServerOptions, DeviceSession } from '../shared/types.js';
import type { TfRequestContext } from './verify.js';
import { hashFingerprint } from './trust-score.js';

vi.mock('./crypto.js', () => ({
  importPublicKey: vi.fn().mockResolvedValue({} as CryptoKey),
  verifySignature: vi.fn().mockResolvedValue(true),
}));

const { verifyRequest } = await import('./verify.js');
const { verifySignature } = await import('./crypto.js');

const UA = 'Mozilla/5.0 TestAgent';
const NO_HEADERS = { signature: null, nonce: null, timestamp: null, deviceId: null };

function makeOptions(storage: MemoryStorage): TokenForgeServerOptions {
  return {
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    skipPaths: ['/health', '/public/*'],
    sensitiveOps: ['DELETE /api/account'],
  };
}

const TS_NOW = () => String(Math.floor(Date.now() / 1000));
const V1_HDRS = () => ({ signature: 'valid-sig', nonce: `n-${Math.random()}`, timestamp: TS_NOW(), deviceId: 'dev-1' });

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

function expectError(result: unknown, code: number, error: string): void {
  const r = result as { status: string; code: number; body: Record<string, unknown> };
  expect(r.status).toBe('error');
  expect(r.code).toBe(code);
  expect(r.body.error).toBe(error);
}

describe('verifyRequest', () => {
  let storage: MemoryStorage;
  let options: TokenForgeServerOptions;

  beforeEach(() => {
    storage = new MemoryStorage();
    options = makeOptions(storage);
    vi.mocked(verifySignature).mockResolvedValue(true);
  });

  it('skips excluded paths', async () => {
    const result = await verifyRequest(makeCtx({ path: '/health' }), options);
    expect(result.status).toBe('skip');
  });

  it('skips wildcard excluded paths', async () => {
    const result = await verifyRequest(makeCtx({ path: '/public/logo.png' }), options);
    expect(result.status).toBe('skip');
  });

  it('skips TF binding endpoint', async () => {
    const result = await verifyRequest(makeCtx({ path: '/api/tf/bind', method: 'POST' }), options);
    expect(result.status).toBe('skip');
  });

  it('skips all /api/tf/ paths', async () => {
    const result = await verifyRequest(makeCtx({ path: '/api/tf/score' }), options);
    expect(result.status).toBe('skip');
  });

  it('returns degraded when no TF headers', async () => {
    const result = await verifyRequest(makeCtx({ headers: NO_HEADERS }), options);
    expect(result.status).toBe('degraded');
  });

  it('returns 403 for sensitive ops without binding', async () => {
    const ctx = makeCtx({ path: '/api/account', method: 'DELETE', headers: NO_HEADERS });
    expectError(await verifyRequest(ctx, options), 403, 'device_binding_required');
  });

  it('returns 401 for missing auth (no userId)', async () => {
    expectError(await verifyRequest(makeCtx({ userId: null }), options), 401, 'unauthorized');
  });

  it('returns 401 for replay (used nonce)', async () => {
    await storage.storeNonce('replay-nonce', 120);
    const ctx = makeCtx({ headers: { ...V1_HDRS(), nonce: 'replay-nonce' } });
    expectError(await verifyRequest(ctx, options), 401, 'nonce_replay');
  });

  it('returns 400 for expired timestamp', async () => {
    const ctx = makeCtx({ headers: { ...V1_HDRS(), timestamp: String(Math.floor(Date.now() / 1000) - 300) } });
    expectError(await verifyRequest(ctx, options), 400, 'request_expired');
  });

  it('returns 401 for unknown device', async () => {
    expectError(await verifyRequest(makeCtx(), options), 401, 'device_not_bound');
  });

  it('returns 401 for expired session', async () => {
    await storage.createSession(makeSession({ expires_at: new Date(Date.now() - 1000).toISOString() }));
    expectError(await verifyRequest(makeCtx(), options), 401, 'session_expired');
  });

  it('returns ok with trustScore for valid v1 request (no version header)', async () => {
    await storage.createSession(makeSession());
    const result = await verifyRequest(makeCtx(), options);
    expect(result.status).toBe('ok');
    const ok = result as { status: 'ok'; trustScore: number; deviceId: string; bound: true };
    expect(ok.trustScore).toBe(100);
    expect(ok.deviceId).toBe('dev-1');
    expect(ok.bound).toBe(true);
  });

  it('returns ok for valid v2 request with body hash', async () => {
    await storage.createSession(makeSession());
    const ctx = makeCtx({
      method: 'POST', path: '/api/data', requestBody: '{"key":"value"}',
      headers: { ...V1_HDRS(), version: '2' },
    });
    expect((await verifyRequest(ctx, options)).status).toBe('ok');
  });

  it('returns ok for v2 GET request with empty body hash', async () => {
    await storage.createSession(makeSession());
    const ctx = makeCtx({
      method: 'GET', path: '/api/data', requestBody: null,
      headers: { ...V1_HDRS(), version: '2', bodyHash: null },
    });
    expect((await verifyRequest(ctx, options)).status).toBe('ok');
  });

  it('returns 401 when signature verification fails', async () => {
    vi.mocked(verifySignature).mockResolvedValue(false);
    await storage.createSession(makeSession());
    expectError(await verifyRequest(makeCtx(), options), 401, 'signature_invalid');
  });

  it('returns 401 for v2 request when body hash header mismatches actual body', async () => {
    await storage.createSession(makeSession());
    vi.mocked(verifySignature).mockResolvedValue(true);
    const badHash = 'deadbeef00000000000000000000000000000000000000000000000000000000';
    const ctx = makeCtx({
      method: 'POST', path: '/api/data', requestBody: '{"key":"tampered"}',
      headers: { ...V1_HDRS(), version: '2', bodyHash: badHash },
    });
    expectError(await verifyRequest(ctx, options), 401, 'signature_invalid');
  });

  it('revokes session + returns 401 trust_too_low when score drops below stepUp', async () => {
    await storage.createSession(makeSession());
    const optsStrict = { ...options, trustThresholds: { allow: 100, stepUp: 99 } };
    const ctx = makeCtx({
      ipAddress: '99.99.99.99', countryCode: 'RU', userAgent: 'Mozilla/5.0 CompletelyDifferent',
    });
    expectError(await verifyRequest(ctx, optsStrict), 401, 'trust_too_low');
    expectError(await verifyRequest(makeCtx(), optsStrict), 401, 'device_not_bound');
  });

  it('returns 403 step_up_required when score is in [stepUp, allow) band', async () => {
    await storage.createSession(makeSession());
    const optsTight = { ...options, trustThresholds: { allow: 99, stepUp: 40 } };
    const ctx = makeCtx({ ipAddress: '5.6.7.8' });
    expectError(await verifyRequest(ctx, optsTight), 403, 'step_up_required');
  });

  it('returns 403 elevated_trust_required for sensitive op with trustScore < 90', async () => {
    await storage.createSession(makeSession());
    const optsLoose = { ...options, trustThresholds: { allow: 50, stepUp: 40 } };
    const ctx = makeCtx({ path: '/api/account', method: 'DELETE', ipAddress: '5.6.7.8' });
    const r = await verifyRequest(ctx, optsLoose);
    const body = (r as { body: { error: string; reason: string } }).body;
    expect(body.error).toBe('elevated_trust_required');
    expect(body.reason).toBe('sensitive_operation');
  });
});
