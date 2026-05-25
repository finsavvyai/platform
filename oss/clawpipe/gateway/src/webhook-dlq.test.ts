/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  nextRetryAt, recordDelivery, markSuccess, markFailure,
  attemptDelivery, drainPending, replayDelivery, MAX_ATTEMPTS, BACKOFF_MS,
  type DeliveryRow,
} from './webhook-dlq';
import type { Env } from './types';

interface DBOps {
  inserts: Array<{ sql: string; binds: unknown[] }>;
  updates: Array<{ sql: string; binds: unknown[] }>;
}

function makeDB(opts: {
  pendingDue?: DeliveryRow[];
  webhooks?: Record<string, { url: string; secret: string | null }>;
  ops?: DBOps;
}) {
  const ops = opts.ops ?? { inserts: [], updates: [] };
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        all: async <T>(): Promise<{ results: T[] }> => {
          if (sql.includes('webhook_deliveries') && sql.includes("status = 'pending'")) {
            return { results: (opts.pendingDue ?? []) as unknown as T[] };
          }
          return { results: [] };
        },
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('FROM webhooks WHERE id = ?')) {
            const id = binds[0] as string;
            const hook = opts.webhooks?.[id];
            return hook ? (hook as unknown as T) : null;
          }
          if (sql.includes('FROM webhook_deliveries WHERE id = ?')) {
            return ({ id: binds[0], status: 'pending', attempts: 0 } as unknown) as T;
          }
          return null;
        },
        run: async (): Promise<{ success: true }> => {
          if (sql.startsWith('INSERT')) ops.inserts.push({ sql, binds });
          else if (sql.startsWith('UPDATE')) ops.updates.push({ sql, binds });
          return { success: true };
        },
      }),
    }),
  };
}

function mkEnv(db: ReturnType<typeof makeDB>): Env {
  return { DB: db as unknown as D1Database, CACHE: {} as KVNamespace } as Env;
}

describe('nextRetryAt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T00:00:00.000Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('returns null on the final attempt (>= MAX_ATTEMPTS)', () => {
    expect(nextRetryAt(MAX_ATTEMPTS)).toBeNull();
    expect(nextRetryAt(MAX_ATTEMPTS + 1)).toBeNull();
  });
  it('schedules the first retry 1 minute out', () => {
    expect(nextRetryAt(1)).toBe(new Date(Date.now() + BACKOFF_MS[1]).toISOString());
  });
  it('caps the backoff index at the last entry', () => {
    expect(nextRetryAt(4)).toBe(new Date(Date.now() + BACKOFF_MS[BACKOFF_MS.length - 1]).toISOString());
  });
});

describe('recordDelivery', () => {
  it('inserts a row and returns the generated id', async () => {
    const ops: DBOps = { inserts: [], updates: [] };
    const env = mkEnv(makeDB({ ops }));
    const id = await recordDelivery(env, 'h1', 'p1', 'anomaly.detected', '{}');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ops.inserts).toHaveLength(1);
    expect(ops.inserts[0].binds).toContain('h1');
    expect(ops.inserts[0].binds).toContain('p1');
  });
});

describe('markSuccess + markFailure', () => {
  it('markSuccess writes status=success', async () => {
    const ops: DBOps = { inserts: [], updates: [] };
    const env = mkEnv(makeDB({ ops }));
    await markSuccess(env, 'd1');
    expect(ops.updates[0].sql).toContain("'success'");
  });
  it('markFailure schedules pending when below MAX_ATTEMPTS', async () => {
    const ops: DBOps = { inserts: [], updates: [] };
    const env = mkEnv(makeDB({ ops }));
    const out = await markFailure(env, 'd1', 'HTTP 500', 1);
    expect(out).toBe('pending');
  });
  it('markFailure flips to dead after MAX_ATTEMPTS', async () => {
    const ops: DBOps = { inserts: [], updates: [] };
    const env = mkEnv(makeDB({ ops }));
    const out = await markFailure(env, 'd1', 'HTTP 500', MAX_ATTEMPTS);
    expect(out).toBe('dead');
  });
  it('truncates last_error to 500 chars', async () => {
    const ops: DBOps = { inserts: [], updates: [] };
    const env = mkEnv(makeDB({ ops }));
    await markFailure(env, 'd1', 'X'.repeat(2000), 1);
    const errBind = ops.updates[0].binds[1] as string;
    expect(errBind.length).toBe(500);
  });
});

const ORIGINAL_FETCH = globalThis.fetch;
function mockFetch(handler: (url: string) => { status: number } | Error) {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const out = handler(String(url));
    if (out instanceof Error) throw out;
    return new Response('ok', { status: out.status });
  }) as typeof fetch;
}
function restoreFetch() { globalThis.fetch = ORIGINAL_FETCH; }

describe('attemptDelivery', () => {
  afterEach(restoreFetch);

  it('returns success when fetch is 2xx', async () => {
    mockFetch(() => ({ status: 200 }));
    const env = mkEnv(makeDB({ webhooks: { h1: { url: 'https://x.test/', secret: null } } }));
    const status = await attemptDelivery(env, {
      id: 'd1', webhook_id: 'h1', project_id: 'p1', event: 'anomaly.detected',
      payload: '{}', attempts: 0, max_attempts: 5, status: 'pending',
      last_error: null, next_retry_at: null,
    });
    expect(status).toBe('success');
  });

  it('returns pending when fetch is 5xx + attempt below MAX', async () => {
    mockFetch(() => ({ status: 500 }));
    const env = mkEnv(makeDB({ webhooks: { h1: { url: 'https://x.test/', secret: null } } }));
    const status = await attemptDelivery(env, {
      id: 'd1', webhook_id: 'h1', project_id: 'p1', event: 'anomaly.detected',
      payload: '{}', attempts: 0, max_attempts: 5, status: 'pending',
      last_error: null, next_retry_at: null,
    });
    expect(status).toBe('pending');
  });

  it('returns dead when network throws + attempt at MAX', async () => {
    mockFetch(() => new Error('boom'));
    const env = mkEnv(makeDB({ webhooks: { h1: { url: 'https://x.test/', secret: null } } }));
    const status = await attemptDelivery(env, {
      id: 'd1', webhook_id: 'h1', project_id: 'p1', event: 'anomaly.detected',
      payload: '{}', attempts: MAX_ATTEMPTS - 1, max_attempts: 5, status: 'pending',
      last_error: null, next_retry_at: null,
    });
    expect(status).toBe('dead');
  });

  it('marks pending when target webhook deleted mid-flight', async () => {
    mockFetch(() => ({ status: 200 }));
    const env = mkEnv(makeDB({ webhooks: {} })); // no hooks
    const status = await attemptDelivery(env, {
      id: 'd1', webhook_id: 'h-missing', project_id: 'p1', event: 'anomaly.detected',
      payload: '{}', attempts: 0, max_attempts: 5, status: 'pending',
      last_error: null, next_retry_at: null,
    });
    expect(status).toBe('pending');
  });
});

describe('drainPending', () => {
  afterEach(restoreFetch);

  it('returns zero counts when no rows due', async () => {
    const env = mkEnv(makeDB({ pendingDue: [] }));
    const r = await drainPending(env);
    expect(r).toEqual({ tried: 0, sent: 0, dead: 0 });
  });

  it('processes due rows and counts outcomes', async () => {
    let i = 0;
    mockFetch(() => {
      i++;
      return { status: i === 1 ? 200 : 500 };
    });
    const env = mkEnv(makeDB({
      pendingDue: [
        { id: 'd1', webhook_id: 'h1', project_id: 'p1', event: 'a', payload: '{}', attempts: 0, max_attempts: 5, status: 'pending', last_error: null, next_retry_at: null },
        { id: 'd2', webhook_id: 'h2', project_id: 'p1', event: 'a', payload: '{}', attempts: MAX_ATTEMPTS - 1, max_attempts: 5, status: 'pending', last_error: null, next_retry_at: null },
      ],
      webhooks: {
        h1: { url: 'https://a.test/', secret: null },
        h2: { url: 'https://b.test/', secret: null },
      },
    }));
    const r = await drainPending(env);
    expect(r.tried).toBe(2);
    expect(r.sent).toBe(1);
    expect(r.dead).toBe(1);
  });
});

describe('replayDelivery', () => {
  it('resets the row to pending with attempts=0', async () => {
    const ops: DBOps = { inserts: [], updates: [] };
    const env = mkEnv(makeDB({ ops }));
    await replayDelivery(env, 'd1');
    expect(ops.updates[0].sql).toContain("'pending'");
    expect(ops.updates[0].sql).toContain('attempts = 0');
  });
});
