/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeAnalytics, routeObservability, routePrompts } from './routes';
import type { Env } from './types';

vi.mock('./analytics', () => ({
  handleOverview: vi.fn().mockResolvedValue(new Response('overview')),
  handleProviders: vi.fn().mockResolvedValue(new Response('providers')),
  handleCacheAnalytics: vi.fn().mockResolvedValue(new Response('cache')),
  handleRouteAnalytics: vi.fn().mockResolvedValue(new Response('routes')),
  handleCostTrend: vi.fn().mockResolvedValue(new Response('cost-trend')),
  handleSavingsByTask: vi.fn().mockResolvedValue(new Response('savings-by-task')),
}));
vi.mock('./logs', () => ({
  handleLogsList: vi.fn().mockResolvedValue(new Response('logs')),
  handleLogDetail: vi.fn().mockResolvedValue(new Response('detail')),
}));
vi.mock('./webhooks', () => ({
  handleWebhookCreate: vi.fn().mockResolvedValue(new Response('w-create')),
  handleWebhookList: vi.fn().mockResolvedValue(new Response('w-list')),
  handleWebhookDelete: vi.fn().mockResolvedValue(new Response('w-del')),
}));
vi.mock('./prompts', () => ({
  listPrompts: vi.fn().mockResolvedValue(new Response('p-list')),
  createPrompt: vi.fn().mockResolvedValue(new Response('p-create')),
  createVersion: vi.fn().mockResolvedValue(new Response('p-v-create')),
  listVersions: vi.fn().mockResolvedValue(new Response('p-v-list')),
  renderPrompt: vi.fn().mockResolvedValue(new Response('p-render')),
}));
vi.mock('./quality', () => ({
  handlePostQuality: vi.fn(),
  handleGetQualityTrend: vi.fn().mockResolvedValue(new Response('quality')),
}));

const env = {} as Env;

describe('routeAnalytics', () => {
  it.each([
    ['overview', 'overview'], ['providers', 'providers'], ['cache', 'cache'],
    ['routes', 'routes'], ['cost-trend', 'cost-trend'], ['savings-by-task', 'savings-by-task'],
    ['quality', 'quality'],
  ])('routes /v1/analytics/%s', async (endpoint, expectedBody) => {
    const res = await routeAnalytics(`/v1/analytics/${endpoint}`, env, 'p1');
    expect(await res.text()).toBe(expectedBody);
  });

  it('404 on unknown analytics endpoint', async () => {
    const res = await routeAnalytics('/v1/analytics/nope', env, 'p1');
    expect(res.status).toBe(404);
  });
});

describe('routeObservability', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /v1/logs -> handleLogsList', async () => {
    const res = await routeObservability(new Request('https://x.test/v1/logs'), env, '/v1/logs', 'p1');
    expect(await res!.text()).toBe('logs');
  });
  it('GET /v1/logs/:id -> handleLogDetail', async () => {
    const res = await routeObservability(new Request('https://x.test/v1/logs/abc'), env, '/v1/logs/abc', 'p1');
    expect(await res!.text()).toBe('detail');
  });
  it('POST /v1/webhooks -> handleWebhookCreate', async () => {
    const res = await routeObservability(new Request('https://x.test/v1/webhooks', { method: 'POST' }), env, '/v1/webhooks', 'p1');
    expect(await res!.text()).toBe('w-create');
  });
  it('GET /v1/webhooks -> handleWebhookList', async () => {
    const res = await routeObservability(new Request('https://x.test/v1/webhooks'), env, '/v1/webhooks', 'p1');
    expect(await res!.text()).toBe('w-list');
  });
  it('DELETE /v1/webhooks/:id -> handleWebhookDelete', async () => {
    const res = await routeObservability(new Request('https://x.test/v1/webhooks/abc', { method: 'DELETE' }), env, '/v1/webhooks/abc', 'p1');
    expect(await res!.text()).toBe('w-del');
  });
  it('returns null for unrelated paths', async () => {
    const res = await routeObservability(new Request('https://x.test/v1/prompt'), env, '/v1/prompt', 'p1');
    expect(res).toBeNull();
  });
});

describe('routePrompts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /v1/prompts -> listPrompts', async () => {
    const res = await routePrompts(new Request('https://x.test/v1/prompts'), env, '/v1/prompts', 'p1');
    expect(await res!.text()).toBe('p-list');
  });
  it('POST /v1/prompts -> createPrompt', async () => {
    const res = await routePrompts(new Request('https://x.test/v1/prompts', { method: 'POST' }), env, '/v1/prompts', 'p1');
    expect(await res!.text()).toBe('p-create');
  });
  it('GET /v1/prompts/:id/versions -> listVersions', async () => {
    const res = await routePrompts(new Request('https://x.test/v1/prompts/p/versions'), env, '/v1/prompts/p/versions', 'p1');
    expect(await res!.text()).toBe('p-v-list');
  });
  it('POST /v1/prompts/:id/versions -> createVersion', async () => {
    const res = await routePrompts(new Request('https://x.test/v1/prompts/p/versions', { method: 'POST' }), env, '/v1/prompts/p/versions', 'p1');
    expect(await res!.text()).toBe('p-v-create');
  });
  it('POST /v1/prompts/:id/render -> renderPrompt', async () => {
    const res = await routePrompts(new Request('https://x.test/v1/prompts/p/render', { method: 'POST' }), env, '/v1/prompts/p/render', 'p1');
    expect(await res!.text()).toBe('p-render');
  });
  it('returns null for unrelated paths', async () => {
    const res = await routePrompts(new Request('https://x.test/v1/foo'), env, '/v1/foo', 'p1');
    expect(res).toBeNull();
  });
});
