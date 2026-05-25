/**
 * Edge-case coverage for createTokenForgeRoutes (sibling of binding.test.ts
 * which already sits at 174L). Pins:
 *   - /trust-score DB-miss path (deviceId+sessionId set but session absent)
 *   - /events default limit=50 + offset=0 propagation to storage
 *   - 401 gate consistency across GET /sessions, GET /events, DELETE /sessions/:id
 *   - /bind deviceId format (32 lowercase hex)
 *   - getIpAddress callback overrides cf-connecting-ip
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTokenForgeRoutes } from './binding.js';
import type { TokenForgeServerOptions, DeviceSession } from '../shared/types.js';

interface State {
  sessions: Map<string, DeviceSession>;
  events: Array<Record<string, unknown>>;
  revokeUserCalls: string[];
}
const baseState = (): State => ({ sessions: new Map(), events: [], revokeUserCalls: [] });

function makeStorage(state: State): TokenForgeServerOptions['storage'] {
  return {
    createSession: vi.fn(async (s: DeviceSession) => { state.sessions.set(s.id, s); }),
    getSession: vi.fn(async (_sessionId: string, deviceId: string) => state.sessions.get(deviceId) ?? null),
    listUserSessions: vi.fn(async () => []),
    revokeSession: vi.fn(async () => undefined),
    revokeUserSessions: vi.fn(async (userId: string) => { state.revokeUserCalls.push(userId); }),
    listEvents: vi.fn(async () => state.events),
    logEvent: vi.fn(async (e: Record<string, unknown>) => { state.events.push(e); }),
  } as unknown as TokenForgeServerOptions['storage'];
}

function buildApp(state: State, userId: string | null, sessionId: string | null, optsOver: Partial<TokenForgeServerOptions> = {}) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (userId) c.set('userId', userId);
    if (sessionId) c.set('sessionId', sessionId);
    await next();
  });
  const opts: TokenForgeServerOptions = {
    storage: makeStorage(state), sessionMaxAge: 86400, ...optsOver,
  } as TokenForgeServerOptions;
  app.route('/tf', createTokenForgeRoutes(opts));
  return app;
}

const validJwk = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' };

describe('createTokenForgeRoutes — edge cases', () => {
  let state: State;
  beforeEach(() => { state = baseState(); });

  it('/trust-score returns isBound=false when device id set but DB miss', async () => {
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/trust-score', { headers: { 'X-TF-Device-ID': 'dev_missing' } });
    const j = (await res.json()) as { trustScore: number; isBound: boolean; deviceId: string | null };
    expect(j).toMatchObject({ isBound: false, trustScore: 0, deviceId: null });
  });

  it('GET /events default limit=50 + offset=0 propagates to storage.listEvents', async () => {
    let captured: { limit: number; offset: number } | undefined;
    const storage = {
      ...makeStorage(state),
      listEvents: vi.fn(async (_u: string, limit: number, offset: number) => {
        captured = { limit, offset };
        return [];
      }),
    } as TokenForgeServerOptions['storage'];
    const app = buildApp(state, 'u1', 's1', { storage });
    await app.request('/tf/events');
    expect(captured).toEqual({ limit: 50, offset: 0 });
  });

  it('GET /sessions, GET /events, DELETE /sessions/:id all return 401 without userId', async () => {
    const app = buildApp(state, null, null);
    expect((await app.request('/tf/sessions')).status).toBe(401);
    expect((await app.request('/tf/events')).status).toBe(401);
    expect((await app.request('/tf/sessions/dev_1', { method: 'DELETE' })).status).toBe(401);
  });

  it('/bind deviceId is exactly 32 lowercase hex chars (UUID with dashes stripped)', async () => {
    const app = buildApp(state, 'u1', 's1');
    const res = await app.request('/tf/bind', {
      method: 'POST',
      body: JSON.stringify({ publicKey: validJwk, sessionId: 's1', metadata: {} }),
    });
    const j = (await res.json()) as { deviceId: string };
    expect(j.deviceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('/bind: getIpAddress callback OVERRIDES cf-connecting-ip header (pluggable IP source)', async () => {
    const app = buildApp(state, 'u1', 's1', { getIpAddress: () => '10.0.0.99' });
    await app.request('/tf/bind', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ publicKey: validJwk, sessionId: 's1', metadata: {} }),
    });
    const session = Array.from(state.sessions.values())[0]!;
    expect(session.ip_address).toBe('10.0.0.99');
  });
});
