import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  tokenForgeMiddleware,
  requireFreshSig,
  type TokenForgeOptions,
} from './hono.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

function apiResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function appWithMw(opts: TokenForgeOptions): Hono {
  const app = new Hono();
  app.use('*', tokenForgeMiddleware(opts));
  app.get('/api/test', (c) => c.json({ tf: c.get('tf' as never) ?? null }));
  app.get('/health', (c) => c.text('ok'));
  app.post('/admin/delete', (c) => c.text('done'));
  return app;
}

describe('hono adapter — re-export contract', () => {
  it('exports tokenForgeMiddleware as a function', () => {
    expect(typeof tokenForgeMiddleware).toBe('function');
  });

  it('exports requireFreshSig as a function', () => {
    expect(typeof requireFreshSig).toBe('function');
  });
});

describe('hono adapter — tokenForgeMiddleware', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sets c.tf on successful verification (allow)', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({
      status: 'allow', trustScore: 92, deviceId: 'dev_1', bound: true,
    }));
    const app = appWithMw({ apiKey: 'tf_test' });
    const res = await app.request('/api/test');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tf: { trustScore: number; deviceId: string; bound: boolean } | null };
    expect(body.tf).toEqual({ bound: true, trustScore: 92, deviceId: 'dev_1' });
  });

  it('returns 401 session_blocked when API status is "block"', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({
      status: 'block', trustScore: 5, deviceId: null, bound: false, reason: 'nonce_replay',
    }));
    const app = appWithMw({ apiKey: 'tf_test' });
    const res = await app.request('/api/test');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; reason: string; trustScore: number };
    expect(body.error).toBe('session_blocked');
    expect(body.reason).toBe('nonce_replay');
    expect(body.trustScore).toBe(5);
  });

  it('degrades to bound=false when API returns non-OK', async () => {
    mockFetch.mockResolvedValueOnce(new Response('fail', { status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = appWithMw({ apiKey: 'tf_test' });
    const res = await app.request('/api/test');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tf: { bound: boolean; trustScore: number; deviceId: null } };
    expect(body.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('skips verification entirely for paths in skipPaths', async () => {
    const app = appWithMw({ apiKey: 'tf_test', skipPaths: ['/health'] });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends Authorization: Bearer <apiKey> on the verify call', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({
      status: 'degraded', trustScore: 0, deviceId: null, bound: false,
    }));
    const app = appWithMw({ apiKey: 'tf_key_xyz' });
    await app.request('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tf_key_xyz');
  });

  it('returns 403 step_up_required when sensitive op + trustScore<90', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({
      status: 'allow', trustScore: 75, deviceId: 'd1', bound: true,
    }));
    const app = appWithMw({
      apiKey: 'tf_test',
      sensitiveOps: ['POST /admin/delete'],
    });
    const res = await app.request('/admin/delete', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; action: string };
    expect(body.error).toBe('elevated_trust_required');
    expect(body.action).toBe('step_up_required');
  });
});

describe('hono adapter — requireFreshSig', () => {
  function appWithGate(min?: number, tf?: { trustScore: number }): Hono {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (tf) c.set('tf' as never, tf as never);
      await next();
    });
    app.use('/admin/*', requireFreshSig(min !== undefined ? { minTrustScore: min } : {}));
    app.get('/admin/x', (c) => c.text('ok'));
    app.get('/public', (c) => c.text('public'));
    return app;
  }

  it('passes through when trustScore meets the minimum', async () => {
    const res = await appWithGate(85, { trustScore: 85 }).request('/admin/x');
    expect(res.status).toBe(200);
  });

  it('returns 403 elevated_trust_required when below threshold', async () => {
    const res = await appWithGate(90, { trustScore: 50 }).request('/admin/x');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; trustScore: number };
    expect(body.error).toBe('elevated_trust_required');
    expect(body.trustScore).toBe(50);
  });

  it('returns 403 with trustScore=0 when tf context is missing', async () => {
    const res = await appWithGate(90).request('/admin/x');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { trustScore: number };
    expect(body.trustScore).toBe(0);
  });

  it('does not gate routes outside its mount point', async () => {
    const res = await appWithGate(90, { trustScore: 10 }).request('/public');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('public');
  });

  it('defaults the minimum to 90', async () => {
    const res = await appWithGate(undefined, { trustScore: 89 }).request('/admin/x');
    expect(res.status).toBe(403);
  });
});
