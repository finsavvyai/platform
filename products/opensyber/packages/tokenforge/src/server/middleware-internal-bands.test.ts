/**
 * Trust-band coverage for tokenForgeMiddleware (lines 105-117 + 125-126
 * uncovered in middleware-internal.test.ts). Sibling file because the
 * parent test is at 185L. Pins the three band branches:
 *   trust < stepUp     → 401 trust_too_low + revokeSession + SESSION_REVOKED log
 *   stepUp <= trust < allow → 403 step_up_required + STEP_UP_TRIGGERED log
 *   bound + sensitive op + trust < 90 → 403 elevated_trust_required
 * Plus the score-change log when |trust - previous| > 10.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { tokenForgeMiddleware } from './middleware-internal.js';
import { hashFingerprint } from './trust-score.js';
import type { TokenForgeServerOptions, DeviceSession } from '../shared/types.js';

const { mockVerifySignature, mockImportPublicKey } = vi.hoisted(() => ({
  mockVerifySignature: vi.fn(),
  mockImportPublicKey: vi.fn(async () => ({}) as CryptoKey),
}));
vi.mock('./crypto.js', () => ({
  importPublicKey: mockImportPublicKey,
  verifySignature: mockVerifySignature,
}));

interface MwState {
  hasNonce: boolean;
  session: DeviceSession | null;
  events: Array<{ eventType: string }>;
  revokeCalls: string[];
  trustScoreUpdates: Array<{ deviceId: string; score: number }>;
}

function makeStorage(s: MwState): TokenForgeServerOptions['storage'] {
  return {
    hasNonce: vi.fn(async () => s.hasNonce),
    storeNonce: vi.fn(async () => undefined),
    getSession: vi.fn(async () => s.session),
    revokeSession: vi.fn(async (id: string) => { s.revokeCalls.push(id); }),
    updateTrustScore: vi.fn(async (deviceId: string, score: number) => {
      s.trustScoreUpdates.push({ deviceId, score });
    }),
    logEvent: vi.fn(async (e: { eventType: string }) => { s.events.push(e); }),
  } as unknown as TokenForgeServerOptions['storage'];
}

function buildApp(opts: Partial<TokenForgeServerOptions>, state: MwState) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', 'u1'); c.set('sessionId', 's1');
    await next();
  });
  const merged: TokenForgeServerOptions = {
    storage: makeStorage(state),
    nonceExpiry: 60,
    trustThresholds: { stepUp: 40, allow: 80 },
    ...opts,
  } as TokenForgeServerOptions;
  app.use('*', tokenForgeMiddleware(merged));
  app.get('/protected', (c) => c.json({ ok: true }));
  app.delete('/api/agents/:id', (c) => c.json({ deleted: true }));
  return app;
}

const baseState = (): MwState => ({
  hasNonce: false, session: null, events: [],
  revokeCalls: [], trustScoreUpdates: [],
});

const validSession = (over: Partial<DeviceSession> = {}): DeviceSession => ({
  id: 'dev_1', user_id: 'u1', session_id: 's1', public_key: 'jwk-stub',
  device_fingerprint: '', ip_address: '1.2.3.4', country_code: 'US',
  trust_score: 100,
  bound_at: new Date(Date.now() - 60_000).toISOString(),
  last_verified_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  revoked: 0, revoked_reason: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  ...over,
});

const validHeaders = (extra: Record<string, string> = {}) => ({
  'X-TF-Signature': 'sig-stub',
  'X-TF-Nonce': `n-${Math.random()}`,
  'X-TF-Timestamp': String(Math.floor(Date.now() / 1000)),
  'X-TF-Device-ID': 'dev_1',
  ...extra,
});

describe('tokenForgeMiddleware — trust band coverage', () => {
  let state: MwState;
  beforeEach(() => {
    state = baseState();
    mockVerifySignature.mockResolvedValue(true);
  });

  it('trust < stepUp → 401 trust_too_low + session revoked + SESSION_REVOKED log (line 105-109)', async () => {
    // Force band entry by setting stepUp=99 (any normal score lands below).
    state.session = validSession();
    const app = buildApp({ trustThresholds: { stepUp: 99, allow: 100 } }, state);
    const res = await app.request('/protected', { headers: validHeaders() });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string; action: string }).error).toBe('trust_too_low');
    expect(state.revokeCalls).toContain('dev_1');
    expect(state.events.some((e) => e.eventType === 'SESSION_REVOKED')).toBe(true);
  });

  it('stepUp <= trust < allow → 403 step_up_required + STEP_UP_TRIGGERED log (line 111-114)', async () => {
    // Tight thresholds: stepUp=40, allow=99 → almost any signal divergence
    // lands in the band. Different IP drops geo+IP score.
    state.session = validSession();
    const app = buildApp({ trustThresholds: { stepUp: 40, allow: 99 } }, state);
    const res = await app.request('/protected', {
      headers: validHeaders({ 'cf-connecting-ip': '99.99.99.99', 'cf-ipcountry': 'US' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; trustScore: number };
    expect(body.error).toBe('step_up_required');
    expect(state.events.some((e) => e.eventType === 'STEP_UP_TRIGGERED')).toBe(true);
  });

  it('bound + sensitive op + trust < 90 → 403 elevated_trust_required (line 116-118)', async () => {
    // Score lands in [stepUp, 90) for a sensitive route. allow=50 keeps
    // us out of step_up so we hit the sensitive-op gate at line 116.
    state.session = validSession();
    const app = buildApp(
      { trustThresholds: { stepUp: 40, allow: 50 }, sensitiveOps: ['DELETE /api/agents/dev_1'] },
      state,
    );
    const res = await app.request('/api/agents/dev_1', {
      method: 'DELETE',
      headers: validHeaders({ 'cf-connecting-ip': '5.6.7.8' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe('elevated_trust_required');
    expect(body.reason).toBe('sensitive_operation');
  });

  it('timestamp skew > nonceExpiry → 400 request_expired + TIMESTAMP_SKEW log (lines 58-63)', async () => {
    state.session = validSession();
    const app = buildApp({}, state);
    const farPast = String(Math.floor(Date.now() / 1000) - 600); // 10min skew, default nonceExpiry=60
    const res = await app.request('/protected', {
      headers: validHeaders({ 'X-TF-Timestamp': farPast }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('request_expired');
    expect(state.events.some((e) => e.eventType === 'TIMESTAMP_SKEW')).toBe(true);
  });

  it('session past expires_at → 401 session_expired + SESSION_EXPIRED log (lines 72-76)', async () => {
    state.session = validSession({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const app = buildApp({}, state);
    const res = await app.request('/protected', { headers: validHeaders() });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('session_expired');
    expect(state.events.some((e) => e.eventType === 'SESSION_EXPIRED')).toBe(true);
  });

  it('trust score change > 10 → TRUST_SCORE_CHANGE log emitted (line 125-126)', async () => {
    // Session previously scored 50; happy-path signals push to ~100 → delta > 10.
    const ua = 'Mozilla/5.0 Match';
    state.session = validSession({
      trust_score: 50,
      device_fingerprint: hashFingerprint(ua),
    });
    const app = buildApp({}, state);
    const res = await app.request('/protected', {
      headers: validHeaders({
        'cf-connecting-ip': '1.2.3.4', 'cf-ipcountry': 'US', 'user-agent': ua,
      }),
    });
    expect(res.status).toBe(200);
    expect(state.events.some((e) => e.eventType === 'TRUST_SCORE_CHANGE')).toBe(true);
  });
});
