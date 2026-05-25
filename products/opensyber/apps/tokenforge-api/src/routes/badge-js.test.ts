import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import worker from '../index.js';

async function getBadge(env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/badge.js'),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('GET /badge.js', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
  });

  it('returns 200 with JavaScript content type', async () => {
    const res = await getBadge(env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/javascript');
  });

  it('sets Cache-Control public + max-age=3600 (1h CDN cacheable)', async () => {
    const res = await getBadge(env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('sets CORS Access-Control-Allow-Origin: * so cross-origin <script> can load', async () => {
    const res = await getBadge(env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('body is wrapped in an IIFE so it cannot leak globals onto the host page', async () => {
    const body = await (await getBadge(env)).text();
    expect(body.startsWith('(function(){')).toBe(true);
    expect(body.trimEnd().endsWith('})();')).toBe(true);
  });

  it('validates the data-tenant-id attribute against /^[a-zA-Z0-9_-]+$/ before injecting links', async () => {
    const body = await (await getBadge(env)).text();
    expect(body).toContain("/^[a-zA-Z0-9_-]+$/");
    expect(body).toContain('Invalid tenant ID format');
    expect(body).toContain('Missing data-tenant-id');
  });

  it('links to https://tokenforge.opensyber.cloud/trust/<tid> with target=_blank + noopener noreferrer', async () => {
    const body = await (await getBadge(env)).text();
    expect(body).toContain("'https://tokenforge.opensyber.cloud/trust/'");
    expect(body).toContain("badge.target='_blank';");
    expect(body).toContain("badge.rel='noopener noreferrer';");
  });

  it('attaches an aria-label so the badge is accessible to screen readers', async () => {
    const body = await (await getBadge(env)).text();
    expect(body).toContain('aria-label');
    expect(body).toContain('Protected by TokenForge');
  });
});
