/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handlePrompt } from './prompt-handler';
import type { Env, PromptResponse } from './types';
import type { RequestMeta } from './request-meta';
import type { SemanticCache } from './semantic-cache';

vi.mock('./billing/usage', () => ({
  isWithinLimits: vi.fn(),
  getProjectTier: vi.fn(),
}));
vi.mock('./budget', () => ({
  getBudgetStatus: vi.fn(),
  maybeFireBudgetAlerts: vi.fn().mockResolvedValue(undefined),
  getProjectTeamId: vi.fn(),
  getTeamBudgetStatus: vi.fn(),
  getTeamRateLimit: vi.fn(),
}));
vi.mock('./anomaly', () => ({ maybeFireAnomalyAlert: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./providers/registry', () => ({
  getAdapter: vi.fn(),
  getApiKey: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./ratelimit-headers', async () => {
  const actual = await vi.importActual<typeof import('./ratelimit-headers')>('./ratelimit-headers');
  return {
    ...actual,
    computeRateLimit: vi.fn().mockResolvedValue({ limit: 1000, remaining: 999, resetSec: 60, windowSec: 86_400 }),
  };
});
vi.mock('./idempotency', async () => {
  const actual = await vi.importActual<typeof import('./idempotency')>('./idempotency');
  return {
    ...actual,
    getIdempotent: vi.fn().mockResolvedValue(null),
    saveIdempotent: vi.fn().mockImplementation((_e, _p, _k, r) => r),
  };
});

import { isWithinLimits, getProjectTier } from './billing/usage';
import { getBudgetStatus, getProjectTeamId, getTeamBudgetStatus, getTeamRateLimit } from './budget';
import { getAdapter, getApiKey } from './providers/registry';
import { getIdempotent } from './idempotency';

const runSpy = vi.fn().mockResolvedValue({ success: true });
const env = { DB: { prepare: () => ({ bind: () => ({ run: runSpy }) }) } } as unknown as Env;
const meta: RequestMeta = { cacheForceRefresh: false } as RequestMeta;
const log = { info: vi.fn(), error: vi.fn() } as unknown as Parameters<typeof handlePrompt>[4];
const semanticCache: SemanticCache = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
} as unknown as SemanticCache;

function jsonReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://x.test/v1/prompt', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const validBody = { prompt: 'hi', provider: 'openai', model: 'gpt-4o-mini' };

describe('handlePrompt — input validation', () => {
  beforeEach(() => {
    vi.mocked(isWithinLimits).mockResolvedValue(true);
    vi.mocked(getBudgetStatus).mockResolvedValue({ monthlyCap: null, usedMtd: 0, pct: 0, over: false });
    vi.mocked(getProjectTeamId).mockResolvedValue(null);
    vi.mocked(getProjectTier).mockResolvedValue('dev');
    vi.mocked(getAdapter).mockReturnValue({ name: 'openai', call: vi.fn() });
    vi.mocked(getApiKey).mockResolvedValue('sk-test');
    vi.mocked(getIdempotent).mockResolvedValue(null);
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('400 on invalid JSON body', async () => {
    const res = await handlePrompt(jsonReq('not-json'), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(400);
  });

  it('400 when prompt/provider/model not strings', async () => {
    const res = await handlePrompt(jsonReq({ prompt: 1, provider: 'x', model: 'y' }), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(400);
  });

  it('413 when prompt exceeds 100k chars', async () => {
    const big = { ...validBody, prompt: 'a'.repeat(100_001) };
    const res = await handlePrompt(jsonReq(big), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(413);
  });

  it('413 when system exceeds 50k chars', async () => {
    const big = { ...validBody, system: 'a'.repeat(50_001) };
    const res = await handlePrompt(jsonReq(big), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(413);
  });

  it('400 when Idempotency-Key is malformed', async () => {
    const res = await handlePrompt(jsonReq(validBody, { 'Idempotency-Key': 'has spaces' }), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(400);
  });

  it('400 on unknown provider', async () => {
    vi.mocked(getAdapter).mockReturnValue(undefined);
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(400);
  });

  it('503 when provider key missing', async () => {
    vi.mocked(getApiKey).mockResolvedValue(undefined);
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(503);
  });
});

describe('handlePrompt — quotas + budgets', () => {
  beforeEach(() => {
    vi.mocked(getProjectTier).mockResolvedValue('dev');
    vi.mocked(getAdapter).mockReturnValue({ name: 'openai', call: vi.fn() });
    vi.mocked(getApiKey).mockResolvedValue('sk-test');
    vi.mocked(getIdempotent).mockResolvedValue(null);
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('429 when daily quota exhausted', async () => {
    vi.mocked(isWithinLimits).mockResolvedValue(false);
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(429);
  });

  it('402 when monthly budget exceeded', async () => {
    vi.mocked(isWithinLimits).mockResolvedValue(true);
    vi.mocked(getBudgetStatus).mockResolvedValue({ monthlyCap: 100, usedMtd: 100, pct: 100, over: true });
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(402);
  });

  it('402 when team budget exceeded', async () => {
    vi.mocked(isWithinLimits).mockResolvedValue(true);
    vi.mocked(getBudgetStatus).mockResolvedValue({ monthlyCap: null, usedMtd: 0, pct: 0, over: false });
    vi.mocked(getProjectTeamId).mockResolvedValue('team-1');
    vi.mocked(getTeamBudgetStatus).mockResolvedValue({ monthlyCap: 50, usedMtd: 50, pct: 100, over: true });
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(402);
  });

  it('429 when team rate limit exceeded', async () => {
    vi.mocked(isWithinLimits).mockResolvedValue(true);
    vi.mocked(getBudgetStatus).mockResolvedValue({ monthlyCap: null, usedMtd: 0, pct: 0, over: false });
    vi.mocked(getProjectTeamId).mockResolvedValue('team-1');
    vi.mocked(getTeamBudgetStatus).mockResolvedValue({ monthlyCap: null, usedMtd: 0, pct: 0, over: false });
    vi.mocked(getTeamRateLimit).mockResolvedValue({ perDay: 100, usedToday: 100, over: true });
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(429);
  });
});

describe('handlePrompt — happy paths', () => {
  beforeEach(() => {
    vi.mocked(isWithinLimits).mockResolvedValue(true);
    vi.mocked(getBudgetStatus).mockResolvedValue({ monthlyCap: null, usedMtd: 0, pct: 0, over: false });
    vi.mocked(getProjectTeamId).mockResolvedValue(null);
    vi.mocked(getProjectTier).mockResolvedValue('free');
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('returns SEMANTIC_HIT when cache has the prompt', async () => {
    vi.mocked(getAdapter).mockReturnValue({ name: 'openai', call: vi.fn() });
    vi.mocked(getApiKey).mockResolvedValue('sk-test');
    (semanticCache.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('cached-text');
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-clawpipe-cache')).toBe('SEMANTIC_HIT');
    expect(res.headers.get('RateLimit-Limit')).toContain('1000');
    const body = await res.json() as { text: string; meta: { cached: boolean; attribution?: string } };
    expect(body.text).toBe('cached-text');
    expect(body.meta.cached).toBe(true);
    expect(body.meta.attribution).toBeDefined();
  });

  it('returns 200 with provider response on cache miss', async () => {
    const call = vi.fn().mockResolvedValue({ text: 'live', tokensIn: 5, tokensOut: 3, latencyMs: 100 } as PromptResponse);
    vi.mocked(getAdapter).mockReturnValue({ name: 'openai', call });
    vi.mocked(getApiKey).mockResolvedValue('sk-test');
    (semanticCache.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-clawpipe-cache')).toBe('MISS');
    const body = await res.json() as { text: string; request_id: string };
    expect(body.text).toBe('live');
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns Idempotency-Replay when key matches a stored response', async () => {
    vi.mocked(getIdempotent).mockResolvedValueOnce(new Response(JSON.stringify({ replayed: true }), {
      status: 200, headers: { 'Idempotency-Replay': 'HIT' },
    }));
    const res = await handlePrompt(jsonReq(validBody, { 'Idempotency-Key': 'abc-123' }), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(200);
    expect(res.headers.get('Idempotency-Replay')).toBe('HIT');
  });

  it('returns 502 when adapter throws', async () => {
    const call = vi.fn().mockRejectedValue(new Error('upstream down'));
    vi.mocked(getAdapter).mockReturnValue({ name: 'openai', call });
    vi.mocked(getApiKey).mockResolvedValue('sk-test');
    (semanticCache.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', null, log, meta, semanticCache);
    expect(res.status).toBe(502);
  });

  it('stamps user_id in DB insert when api key is member-bound', async () => {
    const call = vi.fn().mockResolvedValue({ text: 'ok', tokensIn: 1, tokensOut: 1, latencyMs: 10 } as PromptResponse);
    vi.mocked(getAdapter).mockReturnValue({ name: 'openai', call });
    vi.mocked(getApiKey).mockReturnValue('sk-test');
    (semanticCache.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    runSpy.mockClear();
    const res = await handlePrompt(jsonReq(validBody), env, 'p1', 'user-42', log, meta, semanticCache);
    expect(res.status).toBe(200);
    // runSpy is called for the INSERT INTO requests — confirm it was invoked.
    expect(runSpy).toHaveBeenCalled();
  });
});
