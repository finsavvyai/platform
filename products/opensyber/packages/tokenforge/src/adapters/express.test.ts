import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenForgeMiddleware, requireFreshSig } from './express.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function apiResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return { path: '/api/test', method: 'GET', headers: { 'user-agent': 'test' }, ip: '127.0.0.1', ...overrides };
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn();
  return res;
}

describe('tokenForgeMiddleware', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sets req.tf on successful verification', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'allow', trustScore: 92, deviceId: 'dev_1', bound: true }));
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const req = makeReq();
    const next = vi.fn();
    await mw(req as never, makeRes() as never, next);
    expect((req as Record<string, unknown>).tf).toEqual({ bound: true, trustScore: 92, deviceId: 'dev_1' });
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 on block', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'block', trustScore: 10, deviceId: null, bound: false, reason: 'nonce_replay' }));
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const res = makeRes();
    const next = vi.fn();
    await mw(makeReq() as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('degrades on API error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('error', { status: 500 }));
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const req = makeReq();
    const next = vi.fn();
    await mw(req as never, makeRes() as never, next);
    expect((req as Record<string, unknown>).tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(next).toHaveBeenCalled();
  });

  it('skips paths', async () => {
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test', skipPaths: ['/health'] });
    const next = vi.fn();
    await mw(makeReq({ path: '/health' }) as never, makeRes() as never, next);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('sends API key in Authorization header', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'degraded', trustScore: 0, deviceId: null, bound: false }));
    const mw = tokenForgeMiddleware({ apiKey: 'tf_key_123' });
    await mw(makeReq() as never, makeRes() as never, vi.fn());
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tf_key_123');
  });

  it('skipPaths glob matches subpaths (/public/* matches /public/logo.png)', async () => {
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test', skipPaths: ['/public/*'] });
    const next = vi.fn();
    await mw(makeReq({ path: '/public/logo.png' }) as never, makeRes() as never, next);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('degrades when fetch throws (network error / DNS failure)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    const mw = tokenForgeMiddleware({ apiKey: 'tf_test' });
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    await mw(req as never, res as never, next);
    // Asymmetric-degradation guard: same shape as 5xx fallback,
    // and next() is called (not res.status).
    expect((req as Record<string, unknown>).tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireFreshSig', () => {
  it('passes through when trustScore meets the minimum', () => {
    const gate = requireFreshSig({ minTrustScore: 90 });
    const req = makeReq({ tf: { bound: true, trustScore: 95, deviceId: 'd1' } });
    const res = makeRes();
    const next = vi.fn();
    gate(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects 403 when trustScore is below the minimum', () => {
    const gate = requireFreshSig({ minTrustScore: 90 });
    const req = makeReq({ tf: { bound: true, trustScore: 60, deviceId: 'd1' } });
    const res = makeRes();
    const next = vi.fn();
    gate(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      error: 'elevated_trust_required',
      action: 'step_up_required',
      trustScore: 60,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when req.tf is missing entirely', () => {
    const gate = requireFreshSig();
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    gate(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults the threshold to 90', () => {
    const gate = requireFreshSig();
    const req = makeReq({ tf: { bound: true, trustScore: 89, deviceId: 'd1' } });
    const res = makeRes();
    gate(req as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
