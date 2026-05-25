/** Tests for RFC 9239 RateLimit-* headers + tier-aware computation. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  secondsUntilUtcMidnight, applyRateLimitHeaders, withRateLimitHeaders,
  computeRateLimit, type RateLimitView,
} from './ratelimit-headers';
import type { Env } from './types';

class MemKV {
  store = new Map<string, string>();
  async get(k: string): Promise<string | null> { return this.store.get(k) ?? null; }
  async put(k: string, v: string): Promise<void> { this.store.set(k, v); }
}

class MemDB {
  constructor(private tier: string) {}
  prepare(_sql: string) {
    const tier = this.tier;
    return {
      bind() { return this; },
      async first<T>() { return ({ tier } as unknown) as T; },
    };
  }
}

function mkEnv(tier: string, kv: MemKV): Env {
  return {
    CACHE: kv as unknown as KVNamespace,
    DB: new MemDB(tier) as unknown as D1Database,
  } as Env;
}

describe('secondsUntilUtcMidnight', () => {
  it('returns 86400 at exactly UTC midnight', () => {
    const now = new Date(Date.UTC(2026, 3, 29, 0, 0, 0));
    expect(secondsUntilUtcMidnight(now)).toBe(86_400);
  });
  it('returns ~3600 at 23:00 UTC', () => {
    const now = new Date(Date.UTC(2026, 3, 29, 23, 0, 0));
    expect(secondsUntilUtcMidnight(now)).toBe(3600);
  });
  it('never returns negative', () => {
    const now = new Date(Date.UTC(2026, 3, 29, 23, 59, 59));
    expect(secondsUntilUtcMidnight(now)).toBeGreaterThanOrEqual(0);
  });
});

describe('applyRateLimitHeaders', () => {
  it('writes the three RateLimit-* headers in RFC 9239 form', () => {
    const headers = new Headers();
    const view: RateLimitView = { limit: 1000, remaining: 999, resetSec: 3600, windowSec: 86_400 };
    applyRateLimitHeaders(headers, view);
    expect(headers.get('RateLimit-Limit')).toBe('1000, 1000;w=86400');
    expect(headers.get('RateLimit-Remaining')).toBe('999');
    expect(headers.get('RateLimit-Reset')).toBe('3600');
  });
});

describe('withRateLimitHeaders', () => {
  it('preserves status + body + existing headers', async () => {
    const orig = new Response(JSON.stringify({ ok: 1 }), {
      status: 201, headers: { 'content-type': 'application/json', 'x-trace': 'abc' },
    });
    const view: RateLimitView = { limit: 100, remaining: 50, resetSec: 60, windowSec: 86_400 };
    const out = withRateLimitHeaders(orig, view);
    expect(out.status).toBe(201);
    expect(out.headers.get('x-trace')).toBe('abc');
    expect(out.headers.get('RateLimit-Remaining')).toBe('50');
    expect(await out.json()).toEqual({ ok: 1 });
  });
});

describe('computeRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 29, 12, 0, 0)));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('returns the free-tier ceiling 1000 when no usage stored', async () => {
    const kv = new MemKV();
    const env = mkEnv('free', kv);
    const view = await computeRateLimit(env, 'p1');
    expect(view.limit).toBe(1000);
    expect(view.remaining).toBe(1000);
    expect(view.windowSec).toBe(86_400);
    expect(view.resetSec).toBe(43_200); // 12h until midnight
  });

  it('subtracts current usage from the tier ceiling', async () => {
    const kv = new MemKV();
    await kv.put('usage:p1:2026-04-29', '347');
    const env = mkEnv('dev', kv);
    const view = await computeRateLimit(env, 'p1');
    expect(view.limit).toBe(15_000);
    expect(view.remaining).toBe(15_000 - 347);
  });

  it('clamps remaining to 0 when over usage', async () => {
    const kv = new MemKV();
    await kv.put('usage:p1:2026-04-29', '1500');
    const env = mkEnv('free', kv);
    const view = await computeRateLimit(env, 'p1');
    expect(view.remaining).toBe(0);
  });

  it('uses MAX_SAFE_INTEGER for enterprise unlimited tier', async () => {
    const kv = new MemKV();
    const env = mkEnv('enterprise', kv);
    const view = await computeRateLimit(env, 'p1');
    expect(view.limit).toBe(Number.MAX_SAFE_INTEGER);
  });
});
