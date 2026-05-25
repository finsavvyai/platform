import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenForgeHandle, requireFreshSig } from './sveltekit.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function apiResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeEvent(path = '/api/test', headers: Record<string, string> = {}) {
  return {
    request: new Request(`http://localhost${path}`, { headers }),
    url: new URL(`http://localhost${path}`),
    locals: {} as { tf?: { bound: boolean; trustScore: number; deviceId: string | null } },
    getClientAddress: () => '127.0.0.1',
  };
}

describe('tokenForgeHandle', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sets event.locals.tf on allow', async () => {
    mockFetch.mockResolvedValueOnce(
      apiResponse({ status: 'allow', trustScore: 85, deviceId: 'dev_1', bound: true }),
    );
    const handle = tokenForgeHandle({ apiKey: 'tf_test' });
    const event = makeEvent();
    const resolve = vi.fn(async () => new Response('ok'));
    const res = await handle({ event, resolve });
    expect(event.locals.tf).toEqual({ bound: true, trustScore: 85, deviceId: 'dev_1' });
    expect(resolve).toHaveBeenCalledWith(event);
    expect(res.status).toBe(200);
  });

  it('returns 401 on block without calling resolve', async () => {
    mockFetch.mockResolvedValueOnce(
      apiResponse({ status: 'block', trustScore: 0, deviceId: null, bound: false, reason: 'replay' }),
    );
    const handle = tokenForgeHandle({ apiKey: 'tf_test' });
    const event = makeEvent();
    const resolve = vi.fn(async () => new Response('ok'));
    const res = await handle({ event, resolve });
    expect(res.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('degrades on API error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('err', { status: 500 }));
    const handle = tokenForgeHandle({ apiKey: 'tf_test' });
    const event = makeEvent();
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve });
    expect(event.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(resolve).toHaveBeenCalled();
  });

  it('skips configured paths', async () => {
    const handle = tokenForgeHandle({ apiKey: 'tf_test', skipPaths: ['/health'] });
    const event = makeEvent('/health');
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(event.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('skipPaths glob matches subpaths (/public/* matches /public/logo.png)', async () => {
    const handle = tokenForgeHandle({ apiKey: 'tf_test', skipPaths: ['/public/*'] });
    const event = makeEvent('/public/logo.png');
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(event.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('degrades when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    const handle = tokenForgeHandle({ apiKey: 'tf_test' });
    const event = makeEvent();
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve });
    // Same shape as the !apiRes.ok branch — asymmetric-degradation guard
    expect(event.locals.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(resolve).toHaveBeenCalled();
  });

  it('sends Bearer <apiKey> in Authorization header (cross-adapter consistency)', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    mockFetch.mockImplementationOnce(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return apiResponse({ status: 'allow', trustScore: 85, deviceId: 'd1', bound: true });
    });
    const handle = tokenForgeHandle({ apiKey: 'tf_secret_xyz' });
    await handle({ event: makeEvent(), resolve: vi.fn(async () => new Response('ok')) });
    expect(capturedHeaders?.Authorization).toBe('Bearer tf_secret_xyz');
  });
});

describe('sveltekit requireFreshSig', () => {
  it('passes through on sufficient trustScore', () => {
    const event = { locals: { tf: { bound: true, trustScore: 95, deviceId: 'd1' } } };
    expect(() => requireFreshSig(event, { minTrustScore: 90 })).not.toThrow();
  });

  it('throws a 403 Response when below threshold', () => {
    const event = { locals: { tf: { bound: true, trustScore: 50, deviceId: 'd1' } } };
    let thrown: unknown;
    try { requireFreshSig(event, { minTrustScore: 90 }); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it('throws when locals.tf is missing', () => {
    const event = { locals: {} };
    expect(() => requireFreshSig(event)).toThrow();
  });
});
