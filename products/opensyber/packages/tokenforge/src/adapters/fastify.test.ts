import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenForgePlugin, requireFreshSig } from './fastify.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function apiResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('tokenForgePlugin', () => {
  beforeEach(() => mockFetch.mockReset());

  it('registers preHandler hook', () => {
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    const done = vi.fn();
    tokenForgePlugin(fastify as never, { apiKey: 'tf_test' }, done);
    expect(fastify.addHook).toHaveBeenCalledWith('preHandler', expect.any(Function));
    expect(fastify.decorateRequest).toHaveBeenCalledWith('tf', null);
    expect(done).toHaveBeenCalled();
  });

  it('sets req.tf on allow', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'allow', trustScore: 85, deviceId: 'dev_1', bound: true }));
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    tokenForgePlugin(fastify as never, { apiKey: 'tf_test' }, vi.fn());
    const handler = fastify.addHook.mock.calls[0][1];
    const req = { url: '/api/test', method: 'GET', headers: {}, ip: '127.0.0.1' };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler(req, reply);
    expect(req.tf).toEqual({ bound: true, trustScore: 85, deviceId: 'dev_1' });
  });

  it('sends 401 on block', async () => {
    mockFetch.mockResolvedValueOnce(apiResponse({ status: 'block', trustScore: 0, deviceId: null, bound: false, reason: 'replay' }));
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    tokenForgePlugin(fastify as never, { apiKey: 'tf_test' }, vi.fn());
    const handler = fastify.addHook.mock.calls[0][1];
    const req = { url: '/api/test', method: 'GET', headers: {} };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler(req, reply);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('skips paths', async () => {
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    tokenForgePlugin(fastify as never, { apiKey: 'tf_test', skipPaths: ['/health'] }, vi.fn());
    const handler = fastify.addHook.mock.calls[0][1];
    const req = { url: '/health', method: 'GET', headers: {} };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler(req, reply);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(req.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('skipPaths glob matches subpaths (/public/* matches /public/logo.png)', async () => {
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    tokenForgePlugin(fastify as never, { apiKey: 'tf_test', skipPaths: ['/public/*'] }, vi.fn());
    const handler = fastify.addHook.mock.calls[0][1];
    const req = { url: '/public/logo.png', method: 'GET', headers: {} };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler(req, reply);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(req.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
  });

  it('degrades when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    tokenForgePlugin(fastify as never, { apiKey: 'tf_test' }, vi.fn());
    const handler = fastify.addHook.mock.calls[0][1];
    const req = { url: '/api/test', method: 'GET', headers: {}, ip: '127.0.0.1' };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler(req, reply);
    // Asymmetric-degradation guard: same shape as 5xx fallback
    expect(req.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('sends Bearer <apiKey> in Authorization header (cross-adapter consistency)', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    mockFetch.mockImplementationOnce(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return apiResponse({ status: 'allow', trustScore: 85, deviceId: 'd1', bound: true });
    });
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    tokenForgePlugin(fastify as never, { apiKey: 'tf_secret_xyz' }, vi.fn());
    const handler = fastify.addHook.mock.calls[0][1];
    const req = { url: '/api/test', method: 'GET', headers: {}, ip: '127.0.0.1' };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler(req, reply);
    expect(capturedHeaders?.Authorization).toBe('Bearer tf_secret_xyz');
  });

  it('API non-ok (5xx) → req.tf set to degraded, hook returns without 401 (lines 97-98)', async () => {
    mockFetch.mockResolvedValueOnce(new Response('err', { status: 500 }));
    const fastify = { addHook: vi.fn(), decorateRequest: vi.fn() };
    tokenForgePlugin(fastify as never, { apiKey: 'tf_test' }, vi.fn());
    const handler = fastify.addHook.mock.calls[0][1];
    const req: { url: string; method: string; headers: Record<string, string>; ip: string; tf?: unknown } =
      { url: '/api/test', method: 'GET', headers: {}, ip: '127.0.0.1' };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler(req, reply);
    expect(req.tf).toEqual({ bound: false, trustScore: 0, deviceId: null });
    expect(reply.code).not.toHaveBeenCalled();
  });
});

describe('requireFreshSig', () => {
  it('passes through when trustScore meets the minimum', async () => {
    const gate = requireFreshSig({ minTrustScore: 90 });
    const req = { url: '/admin', method: 'GET', headers: {}, tf: { bound: true, trustScore: 95, deviceId: 'd1' } };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await gate(req as never, reply as never);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('rejects 403 when trustScore is below the minimum', async () => {
    const gate = requireFreshSig({ minTrustScore: 90 });
    const req = { url: '/admin', method: 'GET', headers: {}, tf: { bound: true, trustScore: 50, deviceId: 'd1' } };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await gate(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: 'elevated_trust_required',
      action: 'step_up_required',
      trustScore: 50,
    }));
  });

  it('rejects when req.tf is missing', async () => {
    const gate = requireFreshSig();
    const req = { url: '/admin', method: 'GET', headers: {} };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await gate(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('defaults the threshold to 90', async () => {
    const gate = requireFreshSig();
    const req = { url: '/admin', method: 'GET', headers: {}, tf: { bound: true, trustScore: 89, deviceId: 'd1' } };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await gate(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
