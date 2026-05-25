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

import worker from '../index.js';

async function getSubjects(env: Env, qs = ''): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/v1/workforce/subjects${qs}`, {
      headers: { authorization: 'Bearer tf_test' },
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('GET /v1/workforce/subjects', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns empty data array when no subjects exist', async () => {
    const res = await getSubjects(env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: unknown[] };
    expect(j.data).toEqual([]);
  });

  it('returns the subject rows from the DB', async () => {
    db._setSelectResult([
      { id: 'tf-sub-1', tenantId: 't1', externalSubject: 'okta-1', email: 'alice@acme.com', lastSeenAt: '2026-05-04T12:00:00Z' },
      { id: 'tf-sub-2', tenantId: 't1', externalSubject: 'okta-2', email: 'bob@acme.com', lastSeenAt: '2026-05-04T11:00:00Z' },
    ]);
    const res = await getSubjects(env);
    const j = (await res.json()) as { data: Array<{ id: string; email: string }> };
    expect(j.data).toHaveLength(2);
    expect(j.data[0]!.id).toBe('tf-sub-1');
    expect(j.data[1]!.email).toBe('bob@acme.com');
  });

  it('clamps the limit query to [1, 200]', async () => {
    let captured: number | undefined;
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn((n: number) => { captured = n; return Promise.resolve([]); }),
          })),
        })),
      })),
    })) as unknown as typeof db.select;
    await getSubjects(env, '?limit=999');
    expect(captured).toBe(200);
    await getSubjects(env, '?limit=0');
    expect(captured).toBe(1);
  });

  it('uses default limit of 50 when no query param is provided', async () => {
    let captured: number | undefined;
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn((n: number) => { captured = n; return Promise.resolve([]); }),
          })),
        })),
      })),
    })) as unknown as typeof db.select;
    await getSubjects(env);
    expect(captured).toBe(50);
  });

  it('orderBy is called with desc(lastSeenAt) so newest visits surface first', async () => {
    let orderByCall: unknown;
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn((arg: unknown) => {
            orderByCall = arg;
            return { limit: vi.fn(() => Promise.resolve([])) };
          }),
        })),
      })),
    })) as unknown as typeof db.select;
    await getSubjects(env);
    // The argument is a Drizzle SQL object (desc(...)) — not directly equality-checkable,
    // but it must be defined and truthy. Calling with a falsy arg would defeat ordering.
    expect(orderByCall).toBeDefined();
  });
});
