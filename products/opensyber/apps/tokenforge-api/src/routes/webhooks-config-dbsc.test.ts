import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
}));

vi.mock('../middleware/usage-limit.js', () => ({
  usageLimit: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import worker from '../index.js';

async function workerRequest(
  path: string,
  init: RequestInit,
  env: Env,
): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('Webhook config — DBSC event allowlist', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('accepts dbsc.risk_signal as a subscribed event', async () => {
    mockDb._setSelectResult([]);
    const res = await workerRequest(
      '/v1/webhooks',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: 'https://example.com/hook',
          events: ['dbsc.risk_signal', 'dbsc.policy_block'],
          secret: 'whsec_abcdef0123456789abcdef0123456789',
        }),
      },
      mockEnv,
    );
    expect(res.status).toBeLessThan(500);
    expect(res.status).not.toBe(400);
  });

  it('rejects an unknown dbsc event name', async () => {
    mockDb._setSelectResult([]);
    const res = await workerRequest(
      '/v1/webhooks',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: 'https://example.com/hook',
          events: ['dbsc.not_a_real_event'],
          secret: 'whsec_abcdef0123456789abcdef0123456789',
        }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
  });
});
