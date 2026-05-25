import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

const { mockIssueChallenge } = vi.hoisted(() => ({ mockIssueChallenge: vi.fn() }));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, issueChallenge: mockIssueChallenge };
});

import worker from '../index.js';

async function postChallenge(body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/dbsc/challenge', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('POST /v1/dbsc/challenge', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
    mockIssueChallenge.mockResolvedValue({
      challenge: 'ch_random32bytes',
      record: {
        purpose: 'register',
        sessionId: null,
        expiresAt: '2026-05-03T01:00:00.000Z',
      },
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 invalid_payload when purpose is missing', async () => {
    const r = await postChallenge({}, env);
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('invalid_payload');
  });

  it('returns 400 session_id_required when purpose=refresh has no sessionId', async () => {
    const r = await postChallenge({ purpose: 'refresh' }, env);
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('session_id_required');
  });

  it('returns 400 session_id_required when purpose=step_up has no sessionId', async () => {
    const r = await postChallenge({ purpose: 'step_up' }, env);
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('session_id_required');
  });

  it('returns 200 + Sec-Session-Registration header on register-purpose request', async () => {
    const r = await postChallenge({ purpose: 'register' }, env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { challenge: string; purpose: string; expiresAt: string } };
    expect(j.data.challenge).toBe('ch_random32bytes');
    expect(j.data.purpose).toBe('register');
    expect(j.data.expiresAt).toBe('2026-05-03T01:00:00.000Z');
    const header = r.headers.get('Sec-Session-Registration');
    expect(header).toContain('(ES256)');
    expect(header).toContain('path="/v1/dbsc/register"');
    expect(header).toContain(`challenge="ch_random32bytes"`);
  });

  it('forwards ttlSeconds + sessionId + actionHash to issueChallenge', async () => {
    mockIssueChallenge.mockResolvedValueOnce({
      challenge: 'ch_x',
      record: { purpose: 'step_up', sessionId: 'tf-dbsc-1', expiresAt: '2026-05-03T01:00:00.000Z' },
    });
    await postChallenge({
      purpose: 'step_up',
      sessionId: 'tf-dbsc-1',
      actionHash: 'sha256:abc',
      ttlSeconds: 30,
    }, env);
    expect(mockIssueChallenge).toHaveBeenCalledTimes(1);
    const call = mockIssueChallenge.mock.calls[0]![1] as Record<string, unknown>;
    expect(call.tenantId).toBe('t1');
    expect(call.purpose).toBe('step_up');
    expect(call.sessionId).toBe('tf-dbsc-1');
    expect(call.actionHash).toBe('sha256:abc');
    expect(call.ttlSeconds).toBe(30);
  });
});
