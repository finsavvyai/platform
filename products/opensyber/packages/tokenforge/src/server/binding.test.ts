import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTokenForgeRoutes } from './binding.js';
import type { TokenForgeServerOptions, DeviceSession } from '../shared/types.js';

interface State {
  sessions: Map<string, DeviceSession>;
  events: Array<Record<string, unknown>>;
  revokeCalls: Array<{ sessionId: string; reason: string }>;
  revokeUserCalls: string[];
}

function makeStorage(state: State): TokenForgeServerOptions['storage'] {
  return {
    createSession: vi.fn(async (s: DeviceSession) => { state.sessions.set(s.id, s); }),
    getSession: vi.fn(async (_sessionId: string, deviceId: string) =>
      state.sessions.get(deviceId) ?? null,
    ),
    listUserSessions: vi.fn(async (userId: string) =>
      Array.from(state.sessions.values()).filter((s) => s.user_id === userId),
    ),
    revokeSession: vi.fn(async (sessionId: string, reason: string) => {
      state.revokeCalls.push({ sessionId, reason });
    }),
    revokeUserSessions: vi.fn(async (userId: string) => {
      state.revokeUserCalls.push(userId);
    }),
    listEvents: vi.fn(async () => state.events),
    logEvent: vi.fn(async (e: Record<string, unknown>) => { state.events.push(e); }),
  } as unknown as TokenForgeServerOptions['storage'];
}

function buildApp(state: State, userId: string | null, sessionId: string | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (userId) c.set('userId', userId);
    if (sessionId) c.set('sessionId', sessionId);
    await next();
  });
  const opts: TokenForgeServerOptions = {
    storage: makeStorage(state),
    sessionMaxAge: 86400,
  } as TokenForgeServerOptions;
  app.route('/tf', createTokenForgeRoutes(opts));
  return app;
}

const baseState = (): State => ({
  sessions: new Map(),
  events: [],
  revokeCalls: [],
  revokeUserCalls: [],
});

const validJwk = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' };

describe('createTokenForgeRoutes /bind', () => {
  let state: State;
  beforeEach(() => { state = baseState(); });

  it('returns 401 unauthorized when userId/sessionId missing', async () => {
    const app = buildApp(state, null, null);
    const res = await app.request('/tf/bind', {
      method: 'POST',
      body: JSON.stringify({ publicKey: validJwk, sessionId: 's1', metadata: {} }),
    });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('unauthorized');
  });

  it('returns 400 session_mismatch when body sessionId differs from set sessionId', async () => {
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/bind', {
      method: 'POST',
      body: JSON.stringify({ publicKey: validJwk, sessionId: 's-other', metadata: {} }),
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('session_mismatch');
  });

  it('returns 400 invalid_key_format for non-EC P-256 keys', async () => {
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/bind', {
      method: 'POST',
      body: JSON.stringify({
        publicKey: { kty: 'RSA', n: 'x', e: 'AQAB' },
        sessionId: 's1', metadata: {},
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_key_format');
  });

  it('binds happy path: returns deviceId, revokes prior, creates session, logs DEVICE_BOUND event', async () => {
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/bind', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '1.2.3.4', 'cf-ipcountry': 'US', 'user-agent': 'Test/1.0' },
      body: JSON.stringify({
        publicKey: validJwk,
        sessionId: 's1',
        metadata: { userAgent: 'Test/1.0' },
      }),
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { deviceId: string; expiresAt: string };
    expect(j.deviceId).toMatch(/^[a-f0-9]+$/);
    expect(state.revokeUserCalls).toContain('u1');
    expect(state.sessions.size).toBe(1);
    const event = state.events[0]!;
    expect(event.eventType).toBe('DEVICE_BOUND');
    expect(event.trustScoreAfter).toBe(100);
  });
});

describe('createTokenForgeRoutes /sessions and /events', () => {
  let state: State;
  beforeEach(() => { state = baseState(); });

  it('GET /sessions returns the user\'s active sessions', async () => {
    state.sessions.set('dev_1', {
      id: 'dev_1', user_id: 'u1', session_id: 's1', trust_score: 80,
    } as DeviceSession);
    state.sessions.set('dev_2', {
      id: 'dev_2', user_id: 'u-other', session_id: 's2', trust_score: 50,
    } as DeviceSession);
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/sessions');
    const j = (await res.json()) as { sessions: Array<{ id: string }> };
    expect(j.sessions).toHaveLength(1);
    expect(j.sessions[0]!.id).toBe('dev_1');
  });

  it('DELETE /sessions/:id revokes with user_revoked reason', async () => {
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/sessions/dev_1', { method: 'DELETE' });
    const j = (await res.json()) as { revoked: boolean };
    expect(j.revoked).toBe(true);
    expect(state.revokeCalls).toEqual([{ sessionId: 'dev_1', reason: 'user_revoked' }]);
  });
});

describe('createTokenForgeRoutes /trust-score', () => {
  let state: State;
  beforeEach(() => { state = baseState(); });

  it('returns 401 when userId missing', async () => {
    const app = buildApp(state, null, null);
    const res = await app.request('/tf/trust-score');
    expect(res.status).toBe(401);
  });

  it('returns isBound=false when X-TF-Device-ID header absent', async () => {
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/trust-score');
    const j = (await res.json()) as { trustScore: number; isBound: boolean; deviceId: string | null };
    expect(j.isBound).toBe(false);
    expect(j.deviceId).toBeNull();
    expect(j.trustScore).toBe(0);
  });

  it('returns the session\'s trust_score when bound', async () => {
    state.sessions.set('dev_42', {
      id: 'dev_42', user_id: 'u1', session_id: 's1', trust_score: 87,
    } as DeviceSession);
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/trust-score', {
      headers: { 'X-TF-Device-ID': 'dev_42' },
    });
    const j = (await res.json()) as { trustScore: number; isBound: boolean };
    expect(j.isBound).toBe(true);
    expect(j.trustScore).toBe(87);
  });
});
