/** Tests for /v1/index — public, anonymized, KV-cached. */

import { describe, it, expect } from 'vitest';
import { handleClawpipeIndex, periodTag } from './clawpipe-index';
import type { Env } from './types';

interface KvStore { [k: string]: string }

function makeKV(initial: KvStore = {}) {
  const store: KvStore = { ...initial };
  return {
    store,
    get: async (k: string) => store[k] ?? null,
    put: async (k: string, v: string) => { store[k] = v; },
    delete: async (k: string) => { delete store[k]; },
  };
}

interface AggReturn { total_prompts: number; cached_count: number; boosted_count: number; baseline_avg: number; total_cost: number }

function makeDb(opts: { agg?: AggReturn; providers?: Array<{ provider: string; calls: number }>; throws?: boolean } = {}) {
  let dbCalls = 0;
  const db = {
    prepare: (sql: string) => ({
      bind: () => ({ first: async () => { dbCalls++; if (opts.throws) throw new Error('db down'); return null; } }),
      first: async () => {
        dbCalls++;
        if (opts.throws) throw new Error('db down');
        return opts.agg ?? null;
      },
      all: async () => {
        dbCalls++;
        if (opts.throws) throw new Error('db down');
        if (sql.includes('GROUP BY provider')) {
          return { results: opts.providers ?? [] };
        }
        return { results: [] };
      },
    }),
  };
  return { db, getDbCalls: () => dbCalls };
}

function envWith(db: ReturnType<typeof makeDb>['db'], kv: ReturnType<typeof makeKV>): Env {
  return { DB: db, CACHE: kv } as unknown as Env;
}

describe('periodTag', () => {
  it('returns YYYY-MM-week-N format', () => {
    const t = periodTag(new Date('2026-04-25T00:00:00Z'));
    expect(t).toMatch(/^2026-04-week-\d+$/);
  });
});

describe('handleClawpipeIndex — fresh compute path', () => {
  it('returns expected shape from D1', async () => {
    const { db } = makeDb({
      agg: { total_prompts: 100, cached_count: 30, boosted_count: 10, baseline_avg: 0.01, total_cost: 0.6 },
      providers: [{ provider: 'openai', calls: 60 }, { provider: 'anthropic', calls: 40 }],
    });
    const kv = makeKV();
    const res = await handleClawpipeIndex(envWith(db, kv));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-clawpipe-index-cache')).toBe('MISS');
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('period');
    expect(body).toHaveProperty('totalPrompts', 100);
    expect(body).toHaveProperty('totalSavedUsd');
    expect(body).toHaveProperty('totalLLMCallsSkipped', 40);
    expect(body).toHaveProperty('avgCacheHitRate');
    expect(body).toHaveProperty('providerMix');
    expect(body).toHaveProperty('lastUpdated');
    // Total saved = baseline (0.01 * 100 = 1.00) - actual (0.6) = 0.40
    expect(body.totalSavedUsd).toBeCloseTo(0.40, 2);
  });

  it('writes cache after computing', async () => {
    const { db } = makeDb({
      agg: { total_prompts: 10, cached_count: 5, boosted_count: 0, baseline_avg: 0.02, total_cost: 0.10 },
      providers: [{ provider: 'openai', calls: 10 }],
    });
    const kv = makeKV();
    await handleClawpipeIndex(envWith(db, kv));
    expect(kv.store['clawpipe:index:v1']).toBeDefined();
  });
});

describe('handleClawpipeIndex — KV cache hit path', () => {
  it('does NOT touch D1 when cache populated', async () => {
    const cachedBody = JSON.stringify({
      period: '2026-04-week-17', totalPrompts: 999, totalSavedUsd: 12.34,
      totalLLMCallsSkipped: 100, avgCacheHitRate: 0.5, providerMix: [],
      lastUpdated: '2026-04-26T00:00:00.000Z',
    });
    const { db, getDbCalls } = makeDb();
    const kv = makeKV({ 'clawpipe:index:v1': cachedBody });
    const res = await handleClawpipeIndex(envWith(db, kv));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-clawpipe-index-cache')).toBe('HIT');
    expect(getDbCalls()).toBe(0);
    const body = await res.json() as { totalPrompts: number };
    expect(body.totalPrompts).toBe(999);
  });
});

describe('handleClawpipeIndex — privacy', () => {
  it('does not leak project-level identifiers', async () => {
    const { db } = makeDb({
      agg: { total_prompts: 5, cached_count: 1, boosted_count: 1, baseline_avg: 0.01, total_cost: 0.03 },
      providers: [{ provider: 'openai', calls: 5 }],
    });
    const kv = makeKV();
    const res = await handleClawpipeIndex(envWith(db, kv));
    const text = await res.text();
    expect(text).not.toMatch(/projectId/i);
    expect(text).not.toMatch(/project_id/i);
    expect(text).not.toMatch(/api[_-]?key/i);
    expect(text).not.toMatch(/customer/i);
    expect(text).not.toMatch(/email/i);
  });
});
