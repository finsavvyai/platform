/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, withProviderTimeout, PROVIDER_TIMEOUT_MS } from './rate-limit';
import type { Env } from './types';

function makeKV(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const puts: Array<{ key: string; value: string; options?: unknown }> = [];
  return {
    get: async (key: string): Promise<string | null> => store.get(key) ?? null,
    put: async (key: string, value: string, options?: unknown): Promise<void> => {
      store.set(key, value);
      puts.push({ key, value, options });
    },
    _store: store,
    _puts: puts,
  };
}

function makeEnv(kv: ReturnType<typeof makeKV>): Env {
  return { CACHE: kv as unknown as KVNamespace, DB: {} as D1Database, ENVIRONMENT: 'test' } as unknown as Env;
}

describe('checkRateLimit', () => {
  it('allows request when count is 0', async () => {
    const kv = makeKV();
    const result = await checkRateLimit(makeEnv(kv), 'proj1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999); // 1000 - 0 - 1
  });

  it('increments counter on each call', async () => {
    const kv = makeKV();
    const env = makeEnv(kv);
    const r1 = await checkRateLimit(env, 'proj1');
    const r2 = await checkRateLimit(env, 'proj1');
    expect(r1.remaining).toBe(999);
    expect(r2.remaining).toBe(998);
  });

  it('blocks when count is at limit', async () => {
    // Pre-seed at 1000
    const day = new Date().toISOString().slice(0, 10);
    const kv = makeKV({ [`rl:project:proj2:${day}`]: '1000' });
    const result = await checkRateLimit(makeEnv(kv), 'proj2');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('stores count with expirationTtl of 90000', async () => {
    const kv = makeKV();
    await checkRateLimit(makeEnv(kv), 'proj3');
    const lastPut = kv._puts[kv._puts.length - 1];
    expect((lastPut.options as { expirationTtl: number }).expirationTtl).toBe(90_000);
  });

  it('uses today\'s date in the KV key', async () => {
    const kv = makeKV();
    await checkRateLimit(makeEnv(kv), 'proj4');
    const day = new Date().toISOString().slice(0, 10);
    const lastPut = kv._puts[kv._puts.length - 1];
    expect(lastPut.key).toBe(`rl:project:proj4:${day}`);
  });

  it('treats count just below limit as allowed', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const kv = makeKV({ [`rl:project:proj5:${day}`]: '999' });
    const result = await checkRateLimit(makeEnv(kv), 'proj5');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});

describe('withProviderTimeout', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('resolves when promise resolves before timeout', async () => {
    const result = await withProviderTimeout(Promise.resolve('done'), 5000);
    expect(result).toBe('done');
  });

  it('rejects when promise times out', async () => {
    vi.useFakeTimers();
    const never = new Promise<string>(() => { /* never resolves */ });
    const race = withProviderTimeout(never, 100);
    vi.advanceTimersByTime(200);
    await expect(race).rejects.toThrow(/timed out/i);
  });

  it('PROVIDER_TIMEOUT_MS is 30000', () => {
    expect(PROVIDER_TIMEOUT_MS).toBe(30_000);
  });

  it('rejects with message containing ms value', async () => {
    vi.useFakeTimers();
    const never = new Promise<string>(() => { /* never resolves */ });
    const race = withProviderTimeout(never, 12345);
    vi.advanceTimersByTime(20000);
    await expect(race).rejects.toThrow('12345ms');
  });
});
