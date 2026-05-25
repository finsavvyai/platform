/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleChatCompletions, routeModelToProvider, buildOAIResponse } from './chat-completions-route';
import type { Env } from './types';

vi.mock('./billing/usage', () => ({ isWithinLimits: vi.fn() }));
vi.mock('./budget', () => ({
  getBudgetStatus: vi.fn(),
  getProjectTeamId: vi.fn(),
  getTeamBudgetStatus: vi.fn(),
  getTeamRateLimit: vi.fn(),
}));
vi.mock('./providers/registry', () => ({
  getAdapter: vi.fn(),
  getApiKey: vi.fn(),
}));
vi.mock('./rate-limit', () => ({
  withProviderTimeout: vi.fn((p: Promise<unknown>) => p),
  PROVIDER_TIMEOUT_MS: 30_000,
}));

import { isWithinLimits } from './billing/usage';
import { getBudgetStatus, getProjectTeamId, getTeamBudgetStatus, getTeamRateLimit } from './budget';
import { getAdapter, getApiKey } from './providers/registry';

const makeEnv = (): Env => ({
  DB: { prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) } as unknown as D1Database,
  CACHE: {} as KVNamespace,
  ENVIRONMENT: 'test',
});

const makeRequest = (body: object, extraHeaders: Record<string, string> = {}): Request =>
  new Request('https://api.clawpipe.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.mocked(isWithinLimits).mockResolvedValue(true);
  vi.mocked(getBudgetStatus).mockResolvedValue({ over: false, monthlyCap: null, usedMtd: 0, pct: 0 });
  vi.mocked(getProjectTeamId).mockResolvedValue(null);
  vi.mocked(getTeamBudgetStatus).mockResolvedValue({ over: false, monthlyCap: null, usedMtd: 0, pct: 0 });
  vi.mocked(getTeamRateLimit).mockResolvedValue({ over: false });
});

describe('routeModelToProvider', () => {
  it('routes gpt-* to openai', () => expect(routeModelToProvider('gpt-4o')).toBe('openai'));
  it('routes gpt-3.5-turbo to openai', () => expect(routeModelToProvider('gpt-3.5-turbo')).toBe('openai'));
  it('routes claude-* to anthropic', () => expect(routeModelToProvider('claude-3-5-sonnet-20241022')).toBe('anthropic'));
  it('routes deepseek-* to deepseek', () => expect(routeModelToProvider('deepseek-chat')).toBe('deepseek'));
  it('routes gemini-* to gemini', () => expect(routeModelToProvider('gemini-1.5-pro')).toBe('gemini'));
  it('falls back unknown model to openai', () => expect(routeModelToProvider('unknown-model-x')).toBe('openai'));
});

describe('buildOAIResponse', () => {
  it('returns OpenAI-shaped response', () => {
    const res = buildOAIResponse('gpt-4o', 'Hello', 10, 5);
    expect(res.object).toBe('chat.completion');
    expect((res.choices as unknown[]).length).toBe(1);
    expect((res.usage as { total_tokens: number }).total_tokens).toBe(15);
  });
});

describe('handleChatCompletions', () => {
  it('returns 400 on missing messages', async () => {
    const req = makeRequest({ model: 'gpt-4o', messages: [] });
    const res = await handleChatCompletions(req, makeEnv(), 'proj1');
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('https://api.clawpipe.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await handleChatCompletions(req, makeEnv(), 'proj1');
    expect(res.status).toBe(400);
  });

  it('returns 429 when quota exceeded', async () => {
    vi.mocked(isWithinLimits).mockResolvedValue(false);
    const req = makeRequest({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    const res = await handleChatCompletions(req, makeEnv(), 'proj1');
    expect(res.status).toBe(429);
  });

  it('returns 402 when budget exceeded', async () => {
    vi.mocked(getBudgetStatus).mockResolvedValue({ over: true, monthlyCap: 10, usedMtd: 11, pct: 110 });
    const req = makeRequest({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    const res = await handleChatCompletions(req, makeEnv(), 'proj1');
    expect(res.status).toBe(402);
  });

  it('returns 503 when provider not configured', async () => {
    vi.mocked(getAdapter).mockReturnValue({ name: 'openai', call: vi.fn() });
    vi.mocked(getApiKey).mockReturnValue(undefined);
    const req = makeRequest({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    const res = await handleChatCompletions(req, makeEnv(), 'proj1');
    expect(res.status).toBe(503);
  });

  it('returns OpenAI-shaped 200 on success (gpt-* -> openai)', async () => {
    vi.mocked(getAdapter).mockReturnValue({
      name: 'openai',
      call: vi.fn().mockResolvedValue({ text: 'pong', tokensIn: 5, tokensOut: 1, latencyMs: 50 }),
    });
    vi.mocked(getApiKey).mockReturnValue('sk-test');
    const req = makeRequest({ model: 'gpt-4o', messages: [{ role: 'user', content: 'ping' }] });
    const res = await handleChatCompletions(req, makeEnv(), 'proj1');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.object).toBe('chat.completion');
    const choices = body.choices as Array<{ message: { content: string } }>;
    expect(choices[0].message.content).toBe('pong');
  });

  it('routes claude-* to anthropic adapter', async () => {
    const mockCall = vi.fn().mockResolvedValue({ text: 'hi', tokensIn: 3, tokensOut: 2, latencyMs: 30 });
    vi.mocked(getAdapter).mockImplementation((p) => p === 'anthropic' ? { name: 'anthropic', call: mockCall } : undefined);
    vi.mocked(getApiKey).mockReturnValue('sk-ant');
    const req = makeRequest({ model: 'claude-3-5-sonnet-20241022', messages: [{ role: 'user', content: 'hello' }] });
    await handleChatCompletions(req, makeEnv(), 'proj1');
    expect(vi.mocked(getAdapter)).toHaveBeenCalledWith('anthropic');
  });
});
