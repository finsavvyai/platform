import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  tokenForgeMiddleware,
  shouldSkip,
  isSensitiveOp,
} from './middleware-internal.js';
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

describe('shouldSkip', () => {
  it('returns false when skipPaths undefined', () => {
    expect(shouldSkip('/anything')).toBe(false);
  });
  it('matches exact path', () => {
    expect(shouldSkip('/health', ['/health'])).toBe(true);
    expect(shouldSkip('/health/x', ['/health'])).toBe(false);
  });
  it('matches wildcard suffix', () => {
    expect(shouldSkip('/api/public/foo', ['/api/public/*'])).toBe(true);
  });
  it('returns false on no match', () => {
    expect(shouldSkip('/api/private', ['/api/public/*', '/health'])).toBe(false);
  });
});

describe('isSensitiveOp', () => {
  it('returns false when sensitiveOps undefined', () => {
    expect(isSensitiveOp('/x', 'POST')).toBe(false);
  });
  it('matches exact "METHOD path"', () => {
    expect(isSensitiveOp('/api/agents/123', 'DELETE', ['DELETE /api/agents/123'])).toBe(true);
  });
  it('matches wildcard path with method', () => {
    expect(isSensitiveOp('/api/agents/abc', 'DELETE', ['DELETE /api/agents/*'])).toBe(true);
    expect(isSensitiveOp('/api/agents/abc/sub', 'DELETE', ['DELETE /api/agents/*'])).toBe(false);
  });
  it('rejects when method differs', () => {
    expect(isSensitiveOp('/api/agents/123', 'GET', ['DELETE /api/agents/*'])).toBe(false);
  });
});

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
    c.set('userId', 'u1');
    c.set('sessionId', 's1');
    await next();
  });
  const merged: TokenForgeServerOptions = {
    storage: makeStorage(state),
    nonceExpiry: 60,
    trustThresholds: { stepUp: 40, allow: 80 },
    ...opts,
  } as TokenForgeServerOptions;
  app.use('*', tokenForgeMiddleware(merged));
  app.get('/protected', (c) => c.json({ ok: true, bound: c.get('tf_bound') }));
  app.delete('/api/agents/:id', (c) => c.json({ deleted: true }));
  return app;
}

const baseState = (): MwState => ({
  hasNonce: false, session: null, events: [],
  revokeCalls: [], trustScoreUpdates: [],
});

const validSession = (over: Partial<DeviceSession> = {}): DeviceSession => ({
  id: 'dev_1', user_id: 'u1', session_id: 's1',
  public_key: 'jwk-stub',
  device_fingerprint: '', ip_address: '1.2.3.4', country_code: 'US',
  trust_score: 100,
  bound_at: new Date(Date.now() - 60_000).toISOString(),
  last_verified_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  revoked: 0, revoked_reason: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  ...over,
});

const validHeaders = () => ({
  'X-TF-Signature': 'sig-stub',
  'X-TF-Nonce': `n-${Math.random()}`,
  'X-TF-Timestamp': String(Math.floor(Date.now() / 1000)),
  'X-TF-Device-ID': 'dev_1',
});

describe('tokenForgeMiddleware', () => {
  let state: MwState;

  beforeEach(() => {
    state = baseState();
    mockVerifySignature.mockResolvedValue(true);
  });

  it('passes when X-TF-* headers absent and path is non-sensitive', async () => {
    const app = buildApp({}, state);
    const res = await app.request('/protected');
    expect(res.status).toBe(200);
    const j = (await res.json()) as { bound: boolean };
    expect(j.bound).toBe(false);
  });

  it('returns 403 device_binding_required when sensitive op + missing headers', async () => {
    const app = buildApp({ sensitiveOps: ['DELETE /api/agents/*'] }, state);
    const res = await app.request('/api/agents/x', { method: 'DELETE' });
    expect(res.status).toBe(403);
    expect((await res.json() as { error: string }).error).toBe('device_binding_required');
  });

  it('returns 401 nonce_replay when nonce already seen', async () => {
    state.hasNonce = true;
    state.session = validSession();
    const app = buildApp({}, state);
    const res = await app.request('/protected', { headers: validHeaders() });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('nonce_replay');
  });

  it('returns 401 device_not_bound when storage returns no session', async () => {
    state.session = null;
    const app = buildApp({}, state);
    const res = await app.request('/protected', { headers: validHeaders() });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('device_not_bound');
  });

  it('revokes session and returns 401 signature_invalid when sig fails', async () => {
    state.session = validSession();
    mockVerifySignature.mockResolvedValueOnce(false);
    const app = buildApp({}, state);
    const res = await app.request('/protected', { headers: validHeaders() });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('signature_invalid');
    expect(state.revokeCalls).toContain('dev_1');
  });

  it('passes happy path: tf_bound=true and trust score persisted', async () => {
    const ua = 'Mozilla/5.0 Match';
    state.session = validSession({ device_fingerprint: hashFingerprint(ua) });
    const app = buildApp({}, state);
    const res = await app.request('/protected', {
      headers: {
        ...validHeaders(),
        'cf-connecting-ip': '1.2.3.4',
        'cf-ipcountry': 'US',
        'user-agent': ua,
      },
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { bound: boolean };
    expect(j.bound).toBe(true);
    expect(state.trustScoreUpdates).toHaveLength(1);
    expect(state.trustScoreUpdates[0]!.deviceId).toBe('dev_1');
  });
});
