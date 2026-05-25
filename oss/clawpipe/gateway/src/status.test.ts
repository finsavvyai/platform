/** Tests for GET /v1/status — public status handler. */

import { describe, it, expect } from 'vitest';
import { handlePublicStatus, percentile } from './status';
import type { Env } from './types';

// --- helpers ----------------------------------------------------------------

interface KvStore { [k: string]: string }

function makeKV(initial: KvStore = {}) {
  const store: KvStore = { ...initial };
  return {
    store,
    get: async (k: string) => store[k] ?? null,
    put: async (k: string, v: string, _opts?: unknown) => { store[k] = v; },
    delete: async (k: string) => { delete store[k]; },
  };
}

interface LatencyRow { latency_ms: number }
interface CountRow { n: number }
interface ErrorRow { errors: number; total: number }

type MockRow = LatencyRow | CountRow | ErrorRow | null;

/** Build a minimal D1 mock whose `.first()` and `.all()` return predictable data. */
function makeDb(opts: {
  latencies?: number[];
  errRow24?: ErrorRow;
  errRow30?: ErrorRow;
  volRow?: CountRow;
  throws?: boolean;
} = {}) {
  let callIdx = 0;
  const db = {
    prepare: (_sql: string) => ({
      bind: (_arg: unknown) => ({
        all: async (): Promise<{ results: LatencyRow[] }> => {
          if (opts.throws) throw new Error('db error');
          return { results: (opts.latencies ?? []).map((ms) => ({ latency_ms: ms })) };
        },
        first: async (): Promise<MockRow> => {
          if (opts.throws) throw new Error('db error');
          callIdx++;
          // first bind-first call → error row 24h; second → error row 30d; third → vol
          if (callIdx === 1) return opts.errRow24 ?? { errors: 0, total: 0 };
          if (callIdx === 2) return opts.errRow30 ?? { errors: 0, total: 0 };
          return opts.volRow ?? { n: 0 };
        },
      }),
      first: async (): Promise<MockRow> => null,
      all: async () => ({ results: [] as LatencyRow[] }),
    }),
  };
  return db;
}

function makeEnv(db: ReturnType<typeof makeDb>, kv: ReturnType<typeof makeKV>): Env {
  return { DB: db as unknown as D1Database, CACHE: kv as unknown as KVNamespace } as Env;
}

// --- percentile -------------------------------------------------------------

describe('percentile()', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([], 95)).toBe(0);
  });

  it('returns the single element for any pct when length = 1', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  it('computes p95 correctly from synthetic latencies', () => {
    // 20 values: 1..20. p95 index = ceil(0.95*20)-1 = ceil(19)-1 = 19-1 = 18 → value 19
    const arr = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(arr, 95)).toBe(19);
  });

  it('computes p50 correctly for even-length sorted array', () => {
    const arr = [10, 20, 30, 40];
    // p50: ceil(0.5*4)-1 = 2-1 = 1 → value 20
    expect(percentile(arr, 50)).toBe(20);
  });
});

// --- handlePublicStatus -----------------------------------------------------

describe('handlePublicStatus — shape', () => {
  it('returns 200 with correct JSON shape', async () => {
    const db = makeDb({
      latencies: [100, 200, 300],
      errRow24: { errors: 1, total: 10 },
      errRow30: { errors: 5, total: 100 },
      volRow: { n: 10 },
    });
    const kv = makeKV();
    const res = await handlePublicStatus(makeEnv(db, kv));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.p50_ms).toBe('number');
    expect(typeof body.p95_ms).toBe('number');
    expect(typeof body.error_rate).toBe('number');
    expect(typeof body.uptime_30d).toBe('number');
    expect(typeof body.requests_24h).toBe('number');
    expect(typeof body.generated_at).toBe('string');
  });

  it('CORS header is present on success', async () => {
    const db = makeDb({ volRow: { n: 5 } });
    const kv = makeKV();
    const res = await handlePublicStatus(makeEnv(db, kv));
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('handlePublicStatus — KV cache', () => {
  it('cache MISS writes to KV', async () => {
    const db = makeDb({ latencies: [50, 100], volRow: { n: 2 } });
    const kv = makeKV();
    const res = await handlePublicStatus(makeEnv(db, kv));
    expect(res.headers.get('x-status-cache')).toBe('MISS');
    expect(kv.store['status:public:v1']).toBeDefined();
  });

  it('cache HIT returns immediately without hitting db mock', async () => {
    const cached: Record<string, unknown> = {
      p50_ms: 55, p95_ms: 99, error_rate: 0.01, uptime_30d: 0.99,
      requests_24h: 500, generated_at: '2026-05-01T00:00:00.000Z',
    };
    const kv = makeKV({ 'status:public:v1': JSON.stringify(cached) });
    // db that throws if accessed — should never be reached
    const db = makeDb({ throws: true });
    const res = await handlePublicStatus(makeEnv(db, kv));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-status-cache')).toBe('HIT');
    const body = await res.json() as Record<string, unknown>;
    expect(body.p50_ms).toBe(55);
  });
});

describe('handlePublicStatus — zero-data safety', () => {
  it('returns zeros, not NaN, when requests table is empty', async () => {
    const db = makeDb({
      latencies: [],
      errRow24: { errors: 0, total: 0 },
      errRow30: { errors: 0, total: 0 },
      volRow: { n: 0 },
    });
    const kv = makeKV();
    const res = await handlePublicStatus(makeEnv(db, kv));
    const body = await res.json() as Record<string, number>;
    expect(isNaN(body.p50_ms)).toBe(false);
    expect(isNaN(body.p95_ms)).toBe(false);
    expect(isNaN(body.error_rate)).toBe(false);
    expect(isNaN(body.uptime_30d)).toBe(false);
    expect(body.p50_ms).toBe(0);
    expect(body.p95_ms).toBe(0);
    expect(body.error_rate).toBe(0);
  });
});

describe('handlePublicStatus — privacy', () => {
  it('response does not contain project_id or tenant data', async () => {
    const db = makeDb({ latencies: [80], volRow: { n: 1 } });
    const kv = makeKV();
    const res = await handlePublicStatus(makeEnv(db, kv));
    const text = await res.text();
    expect(text).not.toMatch(/project_?id/i);
    expect(text).not.toMatch(/api[_-]?key/i);
    expect(text).not.toMatch(/email/i);
  });
});

describe('handlePublicStatus — db error', () => {
  it('returns 500 on DB failure', async () => {
    const db = makeDb({ throws: true });
    const kv = makeKV(); // empty cache so handler must query db
    const res = await handlePublicStatus(makeEnv(db, kv));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('status_unavailable');
  });
});
