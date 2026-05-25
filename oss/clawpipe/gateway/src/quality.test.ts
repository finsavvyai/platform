/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { handlePostQuality, handleGetQualityTrend } from './quality';
import type { Env } from './types';

function makeDB(opts: { rows?: object[]; throws?: boolean } = {}) {
  return {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: opts.rows ?? [] }),
        run: async () => { if (opts.throws) throw new Error('boom'); return { success: true }; },
      }),
    }),
  };
}
const mkEnv = (opts = {}) => ({ DB: makeDB(opts) as unknown as D1Database } as Env);

function jsonReq(body: unknown): Request {
  return new Request('https://x.test/v1/quality', { method: 'POST', body: JSON.stringify(body) });
}

describe('handlePostQuality', () => {
  it('400 on invalid JSON', async () => {
    const res = await handlePostQuality(jsonReq('not-json'), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });
  it.each<[Record<string, unknown>, string]>([
    [{ }, 'request_id'],
    [{ request_id: 'r1' }, 'model'],
    [{ request_id: 'r1', model: 'm', provider: 'p' }, 'score'],
    [{ request_id: 'r1', model: 'm', provider: 'p', score: 1.5 }, 'score'],
    [{ request_id: 'r1', model: 'm', provider: 'p', score: -0.1 }, 'score'],
  ])('400 on invalid payload %s', async (payload, _expected) => {
    const res = await handlePostQuality(jsonReq(payload), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });
  it('200 on valid payload', async () => {
    const res = await handlePostQuality(jsonReq({
      request_id: 'r1', model: 'gpt-4o', provider: 'openai', score: 0.85,
    }), mkEnv(), 'p1');
    expect(res.status).toBe(200);
  });
  it('500 on DB throw', async () => {
    const res = await handlePostQuality(jsonReq({
      request_id: 'r1', model: 'gpt-4o', provider: 'openai', score: 0.85,
    }), mkEnv({ throws: true }), 'p1');
    expect(res.status).toBe(500);
  });
});

describe('handleGetQualityTrend', () => {
  it('returns rows from D1', async () => {
    const env = mkEnv({ rows: [{ date: '2026-04-29', model: 'gpt-4o', provider: 'openai', avg_score: 0.9 }] });
    const res = await handleGetQualityTrend(new Request('https://x.test/'), env, 'p1');
    const body = await res.json() as Array<{ avg_score: number }>;
    expect(body[0].avg_score).toBe(0.9);
  });
});
