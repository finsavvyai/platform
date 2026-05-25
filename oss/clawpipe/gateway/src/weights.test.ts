/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { handleGetWeights, handlePutWeights } from './weights';
import type { Env } from './types';

interface DBState {
  rows?: object[];
  batched?: number;
}

function makeDB(state: DBState) {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ results: state.rows ?? [] }),
    run: async () => ({ success: true }),
  };
  return {
    prepare: () => stmt,
    batch: async (arr: unknown[]) => { state.batched = arr.length; return []; },
  };
}

const mkEnv = (state: DBState = {}): Env => ({ DB: makeDB(state) as unknown as D1Database } as Env);

describe('handleGetWeights', () => {
  it('returns weights mapped to camelCase', async () => {
    const env = mkEnv({ rows: [
      { provider: 'openai', model: 'gpt-4o', total_calls: 100, avg_latency_ms: 500, avg_tokens_out: 200, score: 0.9 },
    ] });
    const body = await (await handleGetWeights(env, 'p1')).json() as { weights: Array<{ totalCalls: number; avgLatencyMs: number; score: number }> };
    expect(body.weights).toHaveLength(1);
    expect(body.weights[0].totalCalls).toBe(100);
    expect(body.weights[0].avgLatencyMs).toBe(500);
    expect(body.weights[0].score).toBe(0.9);
  });
  it('returns empty when no rows', async () => {
    const body = await (await handleGetWeights(mkEnv(), 'p1')).json() as { weights: unknown[] };
    expect(body.weights).toEqual([]);
  });
});

function jsonReq(body: unknown): Request {
  return new Request('https://x.test/v1/weights', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) });
}

describe('handlePutWeights', () => {
  it('400 on invalid JSON', async () => {
    expect((await handlePutWeights(jsonReq('not-json'), mkEnv(), 'p1')).status).toBe(400);
  });
  it('400 when weights is not an array', async () => {
    expect((await handlePutWeights(jsonReq({}), mkEnv(), 'p1')).status).toBe(400);
  });
  it('200 + saved=N when array provided', async () => {
    const state: DBState = {};
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    const res = await handlePutWeights(jsonReq({ weights: [
      { provider: 'openai', model: 'gpt-4o', totalCalls: 1, avgLatencyMs: 1, avgTokensOut: 1, score: 0.5 },
      { provider: 'groq',   model: 'llama',  totalCalls: 2, avgLatencyMs: 2, avgTokensOut: 2, score: 0.6 },
    ] }), env, 'p1');
    const body = await res.json() as { saved: number };
    expect(body.saved).toBe(2);
    expect(state.batched).toBe(2);
  });
  it('200 with saved=0 on empty array (no batch call)', async () => {
    const state: DBState = {};
    const env = { DB: makeDB(state) as unknown as D1Database } as Env;
    const res = await handlePutWeights(jsonReq({ weights: [] }), env, 'p1');
    const body = await res.json() as { saved: number };
    expect(body.saved).toBe(0);
    expect(state.batched).toBeUndefined();
  });
});
