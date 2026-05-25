/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { loadHotEntries, pushToKv, warmCache, readWarm } from './kv-warming';
import type { Env } from './types';

interface Row { prompt_hash: string; response: string; project_id: string }

class MemKV {
  store = new Map<string, string>();
  ttls = new Map<string, number>();
  async get(k: string): Promise<string | null> { return this.store.get(k) ?? null; }
  async put(k: string, v: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(k, v);
    if (opts?.expirationTtl) this.ttls.set(k, opts.expirationTtl);
  }
}

function makeDB(rows: Row[], throws = false) {
  return {
    prepare: () => ({
      bind: () => ({
        all: async (): Promise<{ results: Row[] }> => {
          if (throws) throw new Error('d1 boom');
          return { results: rows };
        },
      }),
    }),
  };
}

function mkEnv(rows: Row[], kv: MemKV = new MemKV(), throws = false): Env {
  return {
    DB: makeDB(rows, throws) as unknown as D1Database,
    CACHE: kv as unknown as KVNamespace,
  } as Env;
}

describe('loadHotEntries', () => {
  it('returns rows from D1', async () => {
    const env = mkEnv([
      { prompt_hash: 'h1', response: 'r1', project_id: 'p1' },
      { prompt_hash: 'h2', response: 'r2', project_id: 'p1' },
    ]);
    const rows = await loadHotEntries(env);
    expect(rows).toHaveLength(2);
  });
});

describe('pushToKv', () => {
  it('writes one KV key per row with the warm: prefix', async () => {
    const kv = new MemKV();
    const env = mkEnv([], kv);
    const written = await pushToKv(env, [
      { prompt_hash: 'h1', response: 'r1', project_id: 'p1' },
      { prompt_hash: 'h2', response: 'r2', project_id: 'p2' },
    ]);
    expect(written).toBe(2);
    expect(kv.store.get('warm:p1:h1')).toBe('r1');
    expect(kv.store.get('warm:p2:h2')).toBe('r2');
  });

  it('skips rows with empty hash or response', async () => {
    const kv = new MemKV();
    const env = mkEnv([], kv);
    const written = await pushToKv(env, [
      { prompt_hash: '', response: 'r', project_id: 'p1' },
      { prompt_hash: 'h', response: '', project_id: 'p1' },
      { prompt_hash: 'h2', response: 'r2', project_id: 'p1' },
    ]);
    expect(written).toBe(1);
  });

  it('sets a TTL of 600s', async () => {
    const kv = new MemKV();
    const env = mkEnv([], kv);
    await pushToKv(env, [{ prompt_hash: 'h', response: 'r', project_id: 'p' }]);
    expect(kv.ttls.get('warm:p:h')).toBe(600);
  });
});

describe('warmCache', () => {
  it('returns counts on success', async () => {
    const kv = new MemKV();
    const env = mkEnv([
      { prompt_hash: 'h1', response: 'r1', project_id: 'p1' },
    ], kv);
    const r = await warmCache(env);
    expect(r).toEqual({ scanned: 1, written: 1 });
  });

  it('returns zero counts on D1 error (does not throw)', async () => {
    const env = mkEnv([], new MemKV(), true);
    const r = await warmCache(env);
    expect(r).toEqual({ scanned: 0, written: 0 });
  });
});

describe('readWarm', () => {
  it('reads back a key written by pushToKv', async () => {
    const kv = new MemKV();
    const env = mkEnv([], kv);
    await pushToKv(env, [{ prompt_hash: 'h', response: 'cached', project_id: 'p' }]);
    expect(await readWarm(env, 'p', 'h')).toBe('cached');
  });
  it('returns null on miss', async () => {
    const env = mkEnv([], new MemKV());
    expect(await readWarm(env, 'p', 'missing')).toBeNull();
  });
});
