import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import worker from '../index.js';

async function request(path: string, env: Env) {
  const req = new Request(`http://localhost${path}`);
  return worker.fetch(req, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
}

describe('Security Headers Middleware', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    const mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
  });

  it('includes X-Content-Type-Options: nosniff', async () => {
    const res = await request('/health', env);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('includes X-Frame-Options: DENY', async () => {
    const res = await request('/health', env);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('includes Strict-Transport-Security', async () => {
    const res = await request('/health', env);
    const hsts = res.headers.get('Strict-Transport-Security');
    expect(hsts).toContain('max-age=31536000');
  });

  it('includes Content-Security-Policy', async () => {
    const res = await request('/health', env);
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
  });

  it('includes Referrer-Policy', async () => {
    const res = await request('/health', env);
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('includes X-DNS-Prefetch-Control', async () => {
    const res = await request('/health', env);
    expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('off');
  });

  it('includes Permissions-Policy', async () => {
    const res = await request('/health', env);
    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });
});
