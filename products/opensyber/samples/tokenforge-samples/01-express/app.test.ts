/**
 * Tests: Express.js + TokenForge cloud API middleware
 *
 * Validates:
 * - Middleware calls /v1/edge/verify with correct payload
 * - Skip paths bypass verification
 * - Allow status sets req.tf with correct data
 * - Block status returns 401
 * - API failure degrades gracefully (bound=false, score=0)
 * - Sensitive ops require elevated trust
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMockFetch, installFailingFetch } from '../helpers/mock-fetch.js';
import { createMiddleware, profileHandler, deleteAccountHandler } from './app.js';

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    path: '/profile',
    method: 'GET',
    headers: {
      'x-tf-signature': 'sig123',
      'x-tf-nonce': 'nonce123',
      'x-tf-timestamp': '1700000000',
      'x-tf-device-id': 'device-001',
      'user-agent': 'TestAgent/1.0',
    },
    ip: '192.168.1.100',
    tf: undefined as unknown,
    ...overrides,
  };
}

function makeRes() {
  let statusCode = 200;
  let body: unknown = null;
  return {
    status(code: number) { statusCode = code; return this; },
    json(data: unknown) { body = data; },
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

describe('Express + TokenForge Middleware', () => {
  let mockFetch: ReturnType<typeof installMockFetch>;

  beforeEach(() => {
    mockFetch = installMockFetch();
  });

  afterEach(() => {
    mockFetch.restore();
  });

  it('should skip verification for paths in skipPaths', async () => {
    const mw = createMiddleware('tf_test_key', 'http://localhost:9999');
    const req = makeReq({ path: '/health' });
    const res = makeRes();
    let nextCalled = false;

    await mw(req as never, res as never, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(mockFetch.getCallCount()).toBe(0);
  });

  it('should skip verification for wildcard paths', async () => {
    const mw = createMiddleware('tf_test_key', 'http://localhost:9999');
    const req = makeReq({ path: '/public/docs' });
    const res = makeRes();
    let nextCalled = false;

    await mw(req as never, res as never, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(mockFetch.getCallCount()).toBe(0);
  });

  it('should call /v1/edge/verify with correct payload', async () => {
    const mw = createMiddleware('tf_test_key', 'http://localhost:9999');
    const req = makeReq();
    const res = makeRes();

    await mw(req as never, res as never, () => {});

    expect(mockFetch.getCallCount()).toBe(1);
    const body = mockFetch.getLastBody();
    expect(body).toMatchObject({
      path: '/profile',
      method: 'GET',
      headers: {
        signature: 'sig123',
        nonce: 'nonce123',
        timestamp: '1700000000',
        deviceId: 'device-001',
      },
    });
  });

  it('should set req.tf on allow status', async () => {
    mockFetch.setResponse({
      status: 'allow',
      trustScore: 95,
      deviceId: 'device-001',
      bound: true,
    });

    const mw = createMiddleware('tf_test_key', 'http://localhost:9999');
    const req = makeReq();
    const res = makeRes();

    await mw(req as never, res as never, () => {});

    expect(req.tf).toEqual({
      bound: true,
      trustScore: 95,
      deviceId: 'device-001',
    });
  });

  it('should return 401 on block status', async () => {
    mockFetch.setResponse({
      status: 'block',
      trustScore: 10,
      deviceId: null,
      bound: false,
      reason: 'session_revoked',
    });

    const mw = createMiddleware('tf_test_key', 'http://localhost:9999');
    const req = makeReq();
    const res = makeRes();

    await mw(req as never, res as never, () => {});

    expect(res.getStatus()).toBe(401);
    expect(res.getBody()).toMatchObject({
      error: 'session_blocked',
      reason: 'session_revoked',
    });
  });

  it('should degrade gracefully when API fails', async () => {
    mockFetch.restore();
    const failMock = installFailingFetch();
    const mw = createMiddleware('tf_test_key', 'http://localhost:9999');
    const req = makeReq();
    const res = makeRes();
    let nextCalled = false;

    await mw(req as never, res as never, () => { nextCalled = true; });
    failMock.restore();

    expect(nextCalled).toBe(true);
    expect(req.tf).toEqual({
      bound: false,
      trustScore: 0,
      deviceId: null,
    });
  });

  it('should allow profile access with bound device', async () => {
    const req = makeReq({
      tf: { bound: true, trustScore: 95, deviceId: 'device-001' },
    });
    const res = makeRes();

    profileHandler(req as never, res as never);

    expect(res.getBody()).toMatchObject({
      deviceBound: true,
      trustScore: 95,
      deviceId: 'device-001',
    });
  });

  it('should reject account deletion with low trust', async () => {
    const req = makeReq({
      path: '/account/delete',
      method: 'DELETE',
      tf: { bound: true, trustScore: 60, deviceId: 'device-001' },
    });
    const res = makeRes();

    deleteAccountHandler(req as never, res as never);

    expect(res.getStatus()).toBe(403);
    expect(res.getBody()).toMatchObject({
      error: 'elevated_trust_required',
    });
  });

  it('should allow account deletion with high trust', async () => {
    const req = makeReq({
      path: '/account/delete',
      method: 'DELETE',
      tf: { bound: true, trustScore: 95, deviceId: 'device-001' },
    });
    const res = makeRes();

    deleteAccountHandler(req as never, res as never);

    expect(res.getBody()).toMatchObject({ deleted: true });
  });
});
