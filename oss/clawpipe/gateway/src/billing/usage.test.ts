/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  getProjectTier, getDailyUsage, isWithinLimits, trackUsage, checkRateLimit,
} from './usage';
import type { Env } from '../types';

class MemKV {
  store = new Map<string, string>();
  ttls = new Map<string, number>();
  async get(k: string): Promise<string | null> { return this.store.get(k) ?? null; }
  async put(k: string, v: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(k, v);
    if (opts?.expirationTtl) this.ttls.set(k, opts.expirationTtl);
  }
}

function makeDB(opts: {
  tier?: string;
  usage?: { tokens_in: number; tokens_out: number; total_calls: number };
}) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('SELECT tier')) {
            return ({ tier: opts.tier ?? 'free' } as unknown) as T;
          }
          if (sql.includes('SUM(tokens_in)')) {
            return ((opts.usage ?? { tokens_in: 0, tokens_out: 0, total_calls: 0 }) as unknown) as T;
          }
          return null;
        },
      }),
    }),
  };
}

function mkEnv(opts: { tier?: string; usage?: { tokens_in: number; tokens_out: number; total_calls: number }; kv?: MemKV } = {}): Env {
  return {
    DB: makeDB(opts) as unknown as D1Database,
    CACHE: (opts.kv ?? new MemKV()) as unknown as KVNamespace,
  } as Env;
}

describe('getProjectTier', () => {
  it('returns the tier from D1', async () => {
    const env = mkEnv({ tier: 'growth' });
    expect(await getProjectTier(env, 'p1')).toBe('growth');
  });

  it('defaults to free when row missing', async () => {
    const env = {
      DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database,
      CACHE: new MemKV() as unknown as KVNamespace,
    } as Env;
    expect(await getProjectTier(env, 'p1')).toBe('free');
  });
});

describe('getDailyUsage', () => {
  it('returns usage with limit + remaining for free tier', async () => {
    const env = mkEnv({ tier: 'free', usage: { tokens_in: 100, tokens_out: 50, total_calls: 250 } });
    const r = await getDailyUsage(env, 'p1');
    expect(r.tokensIn).toBe(100);
    expect(r.tokensOut).toBe(50);
    expect(r.totalCalls).toBe(250);
    expect(r.limitCalls).toBe(1000);
    expect(r.remaining).toBe(750);
  });

  it('returns -1 remaining for unlimited (enterprise) tier', async () => {
    const env = mkEnv({ tier: 'enterprise', usage: { tokens_in: 0, tokens_out: 0, total_calls: 99999 } });
    const r = await getDailyUsage(env, 'p1');
    expect(r.limitCalls).toBe(-1);
    expect(r.remaining).toBe(-1);
  });

  it('clamps remaining at 0 when over limit', async () => {
    const env = mkEnv({ tier: 'free', usage: { tokens_in: 0, tokens_out: 0, total_calls: 5000 } });
    const r = await getDailyUsage(env, 'p1');
    expect(r.remaining).toBe(0);
  });
});

describe('isWithinLimits', () => {
  it('true when remaining > 0', async () => {
    const env = mkEnv({ tier: 'free', usage: { tokens_in: 0, tokens_out: 0, total_calls: 100 } });
    expect(await isWithinLimits(env, 'p1')).toBe(true);
  });
  it('false when at limit', async () => {
    const env = mkEnv({ tier: 'free', usage: { tokens_in: 0, tokens_out: 0, total_calls: 1000 } });
    expect(await isWithinLimits(env, 'p1')).toBe(false);
  });
  it('always true for unlimited tier', async () => {
    const env = mkEnv({ tier: 'enterprise', usage: { tokens_in: 0, tokens_out: 0, total_calls: 9_999_999 } });
    expect(await isWithinLimits(env, 'p1')).toBe(true);
  });
});

describe('trackUsage', () => {
  it('initializes counter to 1 when KV empty', async () => {
    const kv = new MemKV();
    const env = mkEnv({ kv });
    await trackUsage(env, 'p1', 0, 0);
    const today = new Date().toISOString().slice(0, 10);
    expect(kv.store.get(`usage:p1:${today}`)).toBe('1');
  });
  it('increments existing counter', async () => {
    const kv = new MemKV();
    const today = new Date().toISOString().slice(0, 10);
    await kv.put(`usage:p1:${today}`, '7');
    const env = mkEnv({ kv });
    await trackUsage(env, 'p1', 0, 0);
    expect(kv.store.get(`usage:p1:${today}`)).toBe('8');
  });
  it('sets TTL of 48 hours', async () => {
    const kv = new MemKV();
    const env = mkEnv({ kv });
    await trackUsage(env, 'p1', 0, 0);
    const today = new Date().toISOString().slice(0, 10);
    expect(kv.ttls.get(`usage:p1:${today}`)).toBe(172_800);
  });
});

describe('checkRateLimit (KV-based fast path)', () => {
  it('returns allowed=true, limit=-1 for unlimited tier', async () => {
    const env = mkEnv({ tier: 'enterprise' });
    const r = await checkRateLimit(env, 'p1');
    expect(r).toEqual({ allowed: true, used: 0, limit: -1 });
  });
  it('reads usage counter from KV', async () => {
    const kv = new MemKV();
    const today = new Date().toISOString().slice(0, 10);
    await kv.put(`usage:p1:${today}`, '500');
    const env = mkEnv({ tier: 'free', kv });
    const r = await checkRateLimit(env, 'p1');
    expect(r.used).toBe(500);
    expect(r.limit).toBe(1000);
    expect(r.allowed).toBe(true);
  });
  it('disallows once at the daily cap', async () => {
    const kv = new MemKV();
    const today = new Date().toISOString().slice(0, 10);
    await kv.put(`usage:p1:${today}`, '1000');
    const env = mkEnv({ tier: 'free', kv });
    const r = await checkRateLimit(env, 'p1');
    expect(r.allowed).toBe(false);
  });
});
