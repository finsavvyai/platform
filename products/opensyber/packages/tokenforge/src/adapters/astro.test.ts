import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenForgeMiddleware, requireFreshSig } from './astro.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function apiResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeContext(path = '/api/test') {
  return {
    request: new Request(`http://localhost${path}`),
    url: new URL(`http://localhost${path}`),
    locals: {} as { tf?: { bound: boolean; trustScore: number; deviceId: string | null } },
    clientAddress: '127.0.0.1',
  };
}

describe('astro tokenForgeMiddleware', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sets locals.tf on allow', async () => {
    mockFetch.mockResolvedValueOnce(
      apiResponse({ status: 'allow', trustScore: 80, deviceId: 'd1', bound: true }),
    );
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const ctx = makeContext();
    const next = vi.fn(async () => new Response('ok'));
    const res = await mw(ctx, next);
    expect(ctx.locals.tf).toEqual({ bound: true, trustScore: 80, deviceId: 'd1' });
    expect(next).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('returns 401 on block without calling next', async () => {
    mockFetch.mockResolvedValueOnce(
      apiResponse({ status: 'block', trustScore: 0, deviceId: null, bound: false, reason: 'replay' }),
    );
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const next = vi.fn(async () => new Response('ok'));
    const res = await mw(makeContext(), next);
    expect(res.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('skips configured paths', async () => {
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test', skipPaths: ['/health'] });
    const ctx = makeContext('/health');
    const next = vi.fn(async () => new Response('ok'));
    await mw(ctx, next);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(ctx.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('degrades on API error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('err', { status: 500 }));
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const ctx = makeContext();
    await mw(ctx, vi.fn(async () => new Response('ok')));
    expect(ctx.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('skipPaths glob matches subpaths (e.g. /public/* matches /public/logo.png)', async () => {
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test', skipPaths: ['/public/*'] });
    const ctx = makeContext('/public/logo.png');
    const next = vi.fn(async () => new Response('ok'));
    await mw(ctx, next);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(ctx.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('degrades when fetch throws (network error / DNS failure)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const ctx = makeContext();
    const next = vi.fn(async () => new Response('ok'));
    await mw(ctx, next);
    // catch block on source line 113 sets the same degraded shape
    expect(ctx.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(next).toHaveBeenCalled();
  });

  it('sends Bearer <apiKey> in Authorization header (real auth contract)', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    mockFetch.mockImplementationOnce(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return apiResponse({ status: 'allow', trustScore: 80, deviceId: 'd1', bound: true });
    });
    const mw = tokenForgeMiddleware({ apiKey: 'tf_secret_xyz' });
    await mw(makeContext(), vi.fn(async () => new Response('ok')));
    expect(capturedHeaders?.Authorization).toBe('Bearer tf_secret_xyz');
  });
});

describe('astro requireFreshSig', () => {
  it('returns null when trustScore meets the threshold', () => {
    const result = requireFreshSig({ tf: { bound: true, trustScore: 90, deviceId: 'd1' } });
    expect(result).toBeNull();
  });

  it('returns a 403 Response when below threshold', () => {
    const res = requireFreshSig(
      { tf: { bound: true, trustScore: 60, deviceId: 'd1' } },
      { minTrustScore: 90 },
    );
    expect(res).toBeInstanceOf(Response);
    expect(res?.status).toBe(403);
  });

  it('returns 403 when locals.tf is absent', () => {
    const res = requireFreshSig({});
    expect(res?.status).toBe(403);
  });
});
