/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { handleLogsList, handleLogDetail } from './logs';
import type { Env } from './types';

interface LogRow {
  id: string; created_at: string; provider: string; model: string;
  tokens_in: number; tokens_out: number; latency_ms: number; cost: number;
  cached: number; boosted: number; prompt_hash: string;
}

function makeDB(rows: LogRow[] = [], countTotal = 0) {
  const queryLogs: LogRow[][] = [];
  const queryCounts: Array<{ total: number }> = [];
  let firstRow: LogRow | null = null;
  let hasCacheEntry = false;

  const dbInstance = {
    _setFirstRow: (r: LogRow | null, cacheEntry = false) => {
      firstRow = r;
      hasCacheEntry = cacheEntry;
    },
    prepare: (sql: string) => ({
      bind: (..._binds: unknown[]) => ({
        all: async <T>(): Promise<{ results: T[] }> => ({ results: rows as unknown as T[] }),
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('COUNT(*)')) return { total: countTotal } as T;
          if (sql.includes('cache_entries')) return (hasCacheEntry ? { id: 'ce1', prompt_hash: 'h' } : null) as T;
          return firstRow as unknown as T;
        },
        catch: (fn: (e: Error) => null) => ({
          // for the cacheEntry lookup with .catch()
        }),
      }),
    }),
  };

  return dbInstance;
}

// Minimal DB with chaining for handleLogDetail's cache lookup
function makeDetailDB(logRow: LogRow | null, cacheEntry: unknown = null) {
  return {
    prepare: (sql: string) => ({
      bind: (..._binds: unknown[]) => {
        if (sql.includes('cache_entries')) {
          return {
            first: () => ({
              catch: (fn: (e: Error) => null) => Promise.resolve(cacheEntry),
            }),
          };
        }
        return {
          first: async <T>(): Promise<T | null> => logRow as unknown as T,
          all: async <T>(): Promise<{ results: T[] }> => ({ results: [] }),
        };
      },
    }),
  };
}

function makeEnv(db: unknown): Env {
  return { DB: db as D1Database, CACHE: {} as KVNamespace, ENVIRONMENT: 'test' } as unknown as Env;
}

const sampleLog: LogRow = {
  id: 'req1', created_at: '2026-04-28T10:00:00Z', provider: 'openai', model: 'gpt-4',
  tokens_in: 100, tokens_out: 200, latency_ms: 300, cost: 0.0042,
  cached: 0, boosted: 0, prompt_hash: 'abc123',
};

describe('handleLogsList', () => {
  it('returns 200 with logs and total', async () => {
    const db = {
      prepare: (_sql: string) => ({
        bind: (..._binds: unknown[]) => ({
          all: async () => ({ results: [sampleLog] }),
          first: async () => ({ total: 1 }),
        }),
      }),
    };
    const req = new Request('https://api.x.com/v1/logs');
    const res = await handleLogsList(req, makeEnv(db), 'proj1');
    expect(res.status).toBe(200);
    const json = await res.json() as { logs: unknown[]; total: number; hasMore: boolean };
    expect(json.total).toBe(1);
    expect(json.logs).toHaveLength(1);
    expect(json.hasMore).toBe(false);
  });

  it('applies filter params in query', async () => {
    const capturedSqls: string[] = [];
    const db = {
      prepare: (sql: string) => {
        capturedSqls.push(sql);
        return {
          bind: (..._binds: unknown[]) => ({
            all: async () => ({ results: [] }),
            first: async () => ({ total: 0 }),
          }),
        };
      },
    };
    const req = new Request('https://api.x.com/v1/logs?provider=openai&model=gpt-4&cached=true&boosted=false&from=2026-01-01&to=2026-12-31');
    await handleLogsList(req, makeEnv(db), 'proj1');
    const listSql = capturedSqls[0];
    expect(listSql).toContain('provider = ?');
    expect(listSql).toContain('model = ?');
    expect(listSql).toContain('cached = ?');
    expect(listSql).toContain('boosted = ?');
    expect(listSql).toContain('created_at >= ?');
    expect(listSql).toContain('created_at <= ?');
  });

  it('clamps limit to MAX_LIMIT=500', async () => {
    const capturedBinds: unknown[][] = [];
    const db = {
      prepare: (_sql: string) => ({
        bind: (...binds: unknown[]) => {
          capturedBinds.push(binds);
          return {
            all: async () => ({ results: [] }),
            first: async () => ({ total: 0 }),
          };
        },
      }),
    };
    const req = new Request('https://api.x.com/v1/logs?limit=9999');
    await handleLogsList(req, makeEnv(db), 'proj1');
    // The list query binds: ...params, limit, offset — limit should be 500
    const listBinds = capturedBinds[0];
    const limit = listBinds[listBinds.length - 2];
    expect(limit).toBe(500);
  });

  it('defaults limit to 50 when not provided', async () => {
    const capturedBinds: unknown[][] = [];
    const db = {
      prepare: (_sql: string) => ({
        bind: (...binds: unknown[]) => {
          capturedBinds.push(binds);
          return {
            all: async () => ({ results: [] }),
            first: async () => ({ total: 0 }),
          };
        },
      }),
    };
    const req = new Request('https://api.x.com/v1/logs');
    await handleLogsList(req, makeEnv(db), 'proj1');
    const listBinds = capturedBinds[0];
    expect(listBinds[listBinds.length - 2]).toBe(50);
  });

  it('maps cost to 4 decimal places', async () => {
    const row = { ...sampleLog, cost: 0.123456789 };
    const db = {
      prepare: (_sql: string) => ({
        bind: (..._binds: unknown[]) => ({
          all: async () => ({ results: [row] }),
          first: async () => ({ total: 1 }),
        }),
      }),
    };
    const req = new Request('https://api.x.com/v1/logs');
    const res = await handleLogsList(req, makeEnv(db), 'proj1');
    const json = await res.json() as { logs: Array<{ cost: number }> };
    expect(json.logs[0].cost).toBe(0.1235);
  });

  it('maps cached and boosted as booleans', async () => {
    const row = { ...sampleLog, cached: 1, boosted: 0 };
    const db = {
      prepare: (_sql: string) => ({
        bind: (..._binds: unknown[]) => ({
          all: async () => ({ results: [row] }),
          first: async () => ({ total: 1 }),
        }),
      }),
    };
    const req = new Request('https://api.x.com/v1/logs');
    const res = await handleLogsList(req, makeEnv(db), 'proj1');
    const json = await res.json() as { logs: Array<{ cached: boolean; boosted: boolean }> };
    expect(json.logs[0].cached).toBe(true);
    expect(json.logs[0].boosted).toBe(false);
  });

  it('indicates hasMore correctly', async () => {
    const db = {
      prepare: (_sql: string) => ({
        bind: (..._binds: unknown[]) => ({
          all: async () => ({ results: [sampleLog, sampleLog] }),
          first: async () => ({ total: 10 }),
        }),
      }),
    };
    const req = new Request('https://api.x.com/v1/logs?limit=2&offset=0');
    const res = await handleLogsList(req, makeEnv(db), 'proj1');
    const json = await res.json() as { hasMore: boolean };
    expect(json.hasMore).toBe(true);
  });
});

describe('handleLogDetail', () => {
  it('returns 404 when log not found', async () => {
    const db = makeDetailDB(null);
    const res = await handleLogDetail(makeEnv(db), 'proj1', 'nonexistent');
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('Log not found');
  });

  it('returns 200 with log data when found (not cached)', async () => {
    const db = makeDetailDB(sampleLog, null);
    const res = await handleLogDetail(makeEnv(db), 'proj1', 'req1');
    expect(res.status).toBe(200);
    const json = await res.json() as { log: { id: string }; cacheEntry: unknown };
    expect(json.log.id).toBe('req1');
    expect(json.cacheEntry).toBeNull();
  });

  it('includes cacheEntry when log is cached', async () => {
    const cachedRow = { ...sampleLog, cached: 1 };
    const cacheEntry = { id: 'ce1', prompt_hash: 'abc123', response: 'r', ttl: 3600 };
    const db = makeDetailDB(cachedRow, cacheEntry);
    const res = await handleLogDetail(makeEnv(db), 'proj1', 'req1');
    expect(res.status).toBe(200);
    const json = await res.json() as { log: { cached: boolean }; cacheEntry: unknown };
    expect(json.log.cached).toBe(true);
    expect(json.cacheEntry).toEqual(cacheEntry);
  });
});
