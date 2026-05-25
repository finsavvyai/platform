import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDb, createMockEnv } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import worker from '../index.js';

async function request(path: string, init: RequestInit = {}, env: Env) {
  const req = new Request(`http://localhost${path}`, init);
  return worker.fetch(req, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
}

describe('Trust Event Route', () => {
  let env: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
  });

  it('POST /api/trust/events returns 400 for invalid events', async () => {
    const res = await request('/api/trust/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'invalid_event',
        path: '/trust/inst_1',
        occurredAt: '2026-03-07T12:00:00.000Z',
        attribution: { sessionId: 'trust_session' },
      }),
    }, env);

    expect(res.status).toBe(400);
  });

  it('POST /api/trust/events persists valid trust events', async () => {
    const res = await request('/api/trust/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vitest Browser',
        'CF-IPCountry': 'US',
      },
      body: JSON.stringify({
        event: 'trust_start_trial',
        instanceId: 'inst_1',
        instanceName: 'Prod Agent',
        score: 91,
        grade: 'A',
        path: '/pricing?via=trust-page',
        occurredAt: '2026-03-07T12:00:00.000Z',
        attribution: {
          sessionId: 'trust_session',
          source: 'linkedin',
          medium: 'social',
          campaign: 'spring_launch',
          ref: 'REF-123',
          referrerHost: 'www.linkedin.com',
          landingPath: '/trust/inst_1',
          firstSeenAt: '2026-03-07T11:59:00.000Z',
        },
      }),
    }, env);

    expect(res.status).toBe(202);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb._insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      event: 'trust_start_trial',
      instanceId: 'inst_1',
      sessionId: 'trust_session',
      source: 'linkedin',
      countryCode: 'US',
      userAgent: 'Vitest Browser',
    }));
  });
});
