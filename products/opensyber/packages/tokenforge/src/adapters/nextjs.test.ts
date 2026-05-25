import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTokenForge, tokenForgeCheck, withFreshSig } from './nextjs.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function apiResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeRequest(path = '/api/test'): Request {
  return new Request(`https://example.com${path}`, {
    headers: { 'user-agent': 'test', 'x-tf-signature': 'sig', 'x-tf-device-id': 'dev_1' },
  });
}

describe('withTokenForge', () => {
  beforeEach(() => mockFetch.mockReset());

  it('passes TfContext to handler on allow', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'allow', trustScore: 90, deviceId: 'dev_1', bound: true }));
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withTokenForge(handler, { apiKey: 'tf_test' });
    await wrapped(makeRequest());
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bound: true, trustScore: 90, deviceId: 'dev_1' }),
    );
  });

  it('returns 401 on block', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'block', trustScore: 5, deviceId: null, bound: false, reason: 'revoked' }));
    const handler = vi.fn();
    const wrapped = withTokenForge(handler, { apiKey: 'tf_test' });
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('skipPaths exact match short-circuits to handler with degraded tf (no fetch)', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withTokenForge(handler, { apiKey: 'tf_test', skipPaths: ['/api/health'] });
    await wrapped(new Request('https://example.com/api/health'));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      { bound: false, trustScore: 0, deviceId: null },
    );
  });

  it('skipPaths glob /public/* matches subpaths (closes nextjs gap in cross-adapter trio)', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withTokenForge(handler, { apiKey: 'tf_test', skipPaths: ['/public/*'] });
    await wrapped(new Request('https://example.com/public/logo.png'));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it('degrades when fetch throws (network/DNS error) — same shape as 5xx fallback', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withTokenForge(handler, { apiKey: 'tf_test' });
    await wrapped(makeRequest());
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      { bound: false, trustScore: 0, deviceId: null },
    );
  });

  it('sends Bearer <apiKey> in Authorization header (cross-adapter consistency)', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    mockFetch.mockImplementationOnce(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return apiResponse({ status: 'allow', trustScore: 90, deviceId: 'd1', bound: true });
    });
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withTokenForge(handler, { apiKey: 'tf_secret_xyz' });
    await wrapped(makeRequest());
    expect(capturedHeaders?.Authorization).toBe('Bearer tf_secret_xyz');
  });

  it('degrades on API failure', async () => {
    mockFetch.mockResolvedValueOnce(new Response('err', { status: 500 }));
    const handler = vi.fn().mockResolvedValue(Response.json({}));
    const wrapped = withTokenForge(handler, { apiKey: 'tf_test' });
    await wrapped(makeRequest());
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bound: false, trustScore: 0 }),
    );
  });
});

describe('tokenForgeCheck', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns proceed:true on allow', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'allow', trustScore: 88, deviceId: 'dev_1', bound: true }));
    const result = await tokenForgeCheck(makeRequest(), { apiKey: 'tf_test' });
    expect(result.proceed).toBe(true);
    if (result.proceed) {
      expect(result.tf.trustScore).toBe(88);
    }
  });

  it('returns proceed:false on block', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'block', trustScore: 0, deviceId: null, bound: false, reason: 'expired' }));
    const result = await tokenForgeCheck(makeRequest(), { apiKey: 'tf_test' });
    expect(result.proceed).toBe(false);
  });

  it('skipPaths match → proceed:true with degraded tf (line 95)', async () => {
    const result = await tokenForgeCheck(
      new Request('https://example.com/api/health'),
      { apiKey: 'tf_test', skipPaths: ['/api/health'] },
    );
    expect(result.proceed).toBe(true);
    if (result.proceed) expect(result.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('API non-ok (5xx) → proceed:true with degraded tf (line 121)', async () => {
    mockFetch.mockResolvedValueOnce(new Response('err', { status: 500 }));
    const result = await tokenForgeCheck(makeRequest(), { apiKey: 'tf_test' });
    expect(result.proceed).toBe(true);
    if (result.proceed) expect(result.tf.bound).toBe(false);
  });
});

describe('withFreshSig', () => {
  const tfHigh = { bound: true, trustScore: 92, deviceId: 'dev_1' };
  const tfLow = { bound: true, trustScore: 50, deviceId: 'dev_1' };

  it('calls handler when trustScore meets default threshold (90)', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withFreshSig(handler);
    const res = await wrapped(makeRequest(), tfHigh);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.anything(), tfHigh);
  });

  it('returns 403 elevated_trust_required when trustScore is below default threshold', async () => {
    const handler = vi.fn();
    const wrapped = withFreshSig(handler);
    const res = await wrapped(makeRequest(), tfLow);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; action: string; trustScore: number };
    expect(body.error).toBe('elevated_trust_required');
    expect(body.action).toBe('step_up_required');
    expect(body.trustScore).toBe(50);
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects custom minTrustScore option', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withFreshSig(handler, { minTrustScore: 30 });
    const res = await wrapped(makeRequest(), tfLow);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('returns 403 when tf context is missing', async () => {
    const handler = vi.fn();
    const wrapped = withFreshSig(handler);
    const res = await wrapped(makeRequest(), undefined as never);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { trustScore: number };
    expect(body.trustScore).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('composes with withTokenForge so a low-score request never reaches admin handler', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'allow', trustScore: 50, deviceId: 'dev_1', bound: true }));
    const adminHandler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withTokenForge(withFreshSig(adminHandler, { minTrustScore: 90 }), { apiKey: 'tf_test' });
    const res = await wrapped(makeRequest('/api/admin'));
    expect(res.status).toBe(403);
    expect(adminHandler).not.toHaveBeenCalled();
  });

  it('exports a `requireFreshSig` alias identical to withFreshSig (cross-adapter naming parity)', async () => {
    // Per Sprint 39 — astro/express/fastify/hono/sveltekit all expose
    // `requireFreshSig`. Next.js historically used `withFreshSig` for
    // consistency with `withTokenForge`. Aliasing keeps the docs uniform
    // so a per-framework copy-paste snippet doesn't fork by adapter name.
    const mod = await import('./nextjs.js');
    expect(mod.requireFreshSig).toBe(mod.withFreshSig);

    // Behavioral pin: alias works identically — low score → 403
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = mod.requireFreshSig(handler, { minTrustScore: 90 });
    const res = await wrapped(makeRequest(), { bound: true, trustScore: 50, deviceId: 'd' });
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
