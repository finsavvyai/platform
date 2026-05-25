import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv } from '../test/helpers.js';
import { gatewayAuthMiddleware } from './gateway-auth.js';
import { Hono } from 'hono';

describe('Gateway Auth Middleware', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();

    // Pre-store gateway token
    await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_1', 'valid-token');

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', gatewayAuthMiddleware);
    app.get('/test', (c) => c.json({ ok: true }));
  });

  it('returns 401 when no headers provided', async () => {
    const res = await app.request('/test', {}, mockEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('Missing');
  });

  it('returns 401 when only X-Gateway-Token is provided', async () => {
    const res = await app.request(
      '/test',
      { headers: { 'X-Gateway-Token': 'valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when only X-Instance-Id is provided', async () => {
    const res = await app.request(
      '/test',
      { headers: { 'X-Instance-Id': 'inst_1' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when token does not match stored value', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await app.request(
      '/test',
      {
        headers: {
          'X-Gateway-Token': 'wrong-token',
          'X-Instance-Id': 'inst_1',
        },
      },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.message).toContain('Invalid');
    expect(consoleWarnSpy).toHaveBeenCalledWith('[GatewayAuth] Token mismatch for instance inst_1');
  });

  it('returns 401 when instance ID has no stored token', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await app.request(
      '/test',
      {
        headers: {
          'X-Gateway-Token': 'valid-token',
          'X-Instance-Id': 'inst_unknown',
        },
      },
      mockEnv,
    );
    expect(res.status).toBe(401);
    expect(consoleWarnSpy).toHaveBeenCalledWith('[GatewayAuth] Token mismatch for instance inst_unknown');
  });

  it('passes through when token matches', async () => {
    const res = await app.request(
      '/test',
      {
        headers: {
          'X-Gateway-Token': 'valid-token',
          'X-Instance-Id': 'inst_1',
        },
      },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
  });
});
