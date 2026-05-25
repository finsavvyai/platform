/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  handleWebhookCreate, handleWebhookList, handleWebhookDelete, deliverEvent,
} from './webhooks';
import type { Env } from './types';

interface FakeRow {
  id: string; project_id: string; url: string;
  events: string; threshold: number | null; created_at: string;
}

interface DBState {
  rows: FakeRow[];
  inserts: Array<{ binds: unknown[] }>;
  deletedSuccess?: boolean;
  deletedChanges?: number;
}

function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        all: async (): Promise<{ results: FakeRow[] }> => {
          return { results: state.rows.filter((r) => r.project_id === binds[0]) };
        },
        run: async () => {
          if (sql.startsWith('INSERT')) {
            state.inserts.push({ binds });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE')) {
            const before = state.rows.length;
            state.rows = state.rows.filter((r) => !(r.id === binds[0] && r.project_id === binds[1]));
            return {
              success: state.deletedSuccess ?? true,
              meta: { changes: state.deletedChanges ?? (before - state.rows.length) },
            };
          }
          return { success: true };
        },
      }),
    }),
  };
}

function mkEnv(state: Partial<DBState> = {}): Env {
  const s: DBState = { rows: [], inserts: [], ...state };
  return { DB: makeDB(s) as unknown as D1Database } as Env;
}

function jsonReq(body: unknown): Request {
  return new Request('https://x.test/v1/webhooks', {
    method: 'POST', body: JSON.stringify(body),
  });
}

describe('handleWebhookCreate', () => {
  it('400 on invalid JSON body', async () => {
    const req = new Request('https://x.test/v1/webhooks', { method: 'POST', body: 'not-json' });
    const res = await handleWebhookCreate(req, mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('400 on missing url', async () => {
    const res = await handleWebhookCreate(jsonReq({ events: ['cost_spike'] }), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('400 on non-http(s) url', async () => {
    const res = await handleWebhookCreate(jsonReq({ url: 'ftp://x.test', events: ['cost_spike'] }), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('400 on no valid events', async () => {
    const res = await handleWebhookCreate(jsonReq({ url: 'https://x.test/', events: ['nope'] }), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('201 on success and inserts a row', async () => {
    const env = mkEnv();
    const res = await handleWebhookCreate(jsonReq({
      url: 'https://x.test/hook', events: ['cost_spike', 'rate_limit_hit'], threshold: 100,
    }), env, 'p1');
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; events: string[]; threshold: number };
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.events).toEqual(['cost_spike', 'rate_limit_hit']);
    expect(body.threshold).toBe(100);
  });

  it('drops invalid events but keeps the valid ones', async () => {
    const env = mkEnv();
    const res = await handleWebhookCreate(jsonReq({
      url: 'https://x.test/', events: ['cost_spike', 'totally-fake'],
    }), env, 'p1');
    expect(res.status).toBe(201);
    const body = await res.json() as { events: string[] };
    expect(body.events).toEqual(['cost_spike']);
  });
});

describe('handleWebhookList', () => {
  it('returns webhooks scoped to the project, with parsed events', async () => {
    const env = mkEnv({
      rows: [
        { id: 'w1', project_id: 'p1', url: 'https://a/', events: '["cost_spike"]', threshold: null, created_at: '2026-01-01' },
        { id: 'w2', project_id: 'p2', url: 'https://b/', events: '["rate_limit_hit"]', threshold: 10, created_at: '2026-01-02' },
      ],
    });
    const res = await handleWebhookList(env, 'p1');
    const body = await res.json() as { webhooks: Array<{ id: string; events: string[] }> };
    expect(body.webhooks).toHaveLength(1);
    expect(body.webhooks[0].id).toBe('w1');
    expect(body.webhooks[0].events).toEqual(['cost_spike']);
  });
});

describe('handleWebhookDelete', () => {
  it('204 on found row', async () => {
    const state: DBState = {
      rows: [{ id: 'w1', project_id: 'p1', url: 'https://a/', events: '[]', threshold: null, created_at: '' }],
      inserts: [],
    };
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    const res = await handleWebhookDelete(env, 'p1', 'w1');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('404 when not found', async () => {
    const env = mkEnv();
    const res = await handleWebhookDelete(env, 'p1', 'missing');
    expect(res.status).toBe(404);
  });
});

const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls: Array<{ url: string; init: RequestInit }> = [];

function mockFetch() {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init: init ?? {} });
    return new Response('ok', { status: 200 });
  }) as typeof fetch;
}

describe('deliverEvent', () => {
  beforeEach(() => { fetchCalls = []; mockFetch(); });
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  it('posts to every matching hook for the project', async () => {
    const env = mkEnv({
      rows: [
        { id: 'w1', project_id: 'p1', url: 'https://a.test/', events: '["cost_spike"]', threshold: null, created_at: '' },
        { id: 'w2', project_id: 'p1', url: 'https://b.test/', events: '["rate_limit_hit"]', threshold: null, created_at: '' },
        { id: 'w3', project_id: 'p1', url: 'https://c.test/', events: '["cost_spike"]', threshold: null, created_at: '' },
      ],
    });
    await deliverEvent(env, 'p1', 'cost_spike', { foo: 'bar' });
    const urls = fetchCalls.map((c) => c.url).sort();
    expect(urls).toEqual(['https://a.test/', 'https://c.test/']);
  });

  it('sends Slack-shaped payload to slack.com URLs', async () => {
    const env = mkEnv({
      rows: [{ id: 'w1', project_id: 'p1', url: 'https://hooks.slack.com/services/abc', events: '["cost_spike"]', threshold: null, created_at: '' }],
    });
    await deliverEvent(env, 'p1', 'cost_spike', { x: 1 });
    const body = JSON.parse(fetchCalls[0].init.body as string) as { blocks: unknown[] };
    expect(Array.isArray(body.blocks)).toBe(true);
  });

  it('swallows errors silently (non-blocking)', async () => {
    globalThis.fetch = (async () => { throw new Error('network'); }) as typeof fetch;
    const env = mkEnv({
      rows: [{ id: 'w1', project_id: 'p1', url: 'https://x.test/', events: '["cost_spike"]', threshold: null, created_at: '' }],
    });
    await expect(deliverEvent(env, 'p1', 'cost_spike', {})).resolves.toBeUndefined();
  });
});
