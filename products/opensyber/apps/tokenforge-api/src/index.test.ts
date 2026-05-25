import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from './test/helpers.js';
import type { Env } from './types.js';

vi.mock('./lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import worker from './index.js';

async function workerRequest(
  path: string,
  init: RequestInit = {},
  env: Env,
): Promise<Response> {
  const url = `http://localhost${path}`;
  const req = new Request(url, init);
  return worker.fetch(
    req,
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('TokenForge API (index.ts)', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    const mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('GET / returns API info', async () => {
    const res = await workerRequest('/', {}, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.name).toBe('TokenForge API');
    expect(body.version).toBe('0.1.0');
  });

  it('GET /health returns healthy', async () => {
    const res = await workerRequest('/health', {}, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('healthy');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await workerRequest('/nonexistent', {}, mockEnv);
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('not_found');
    expect(body.message).toBe('Not found');
  });

  it('returns 401 for /v1/* routes without auth', async () => {
    const res = await workerRequest('/v1/sessions', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('CORS headers are set for tokenforge.opensyber.cloud', async () => {
    mockEnv.ENVIRONMENT = 'production';
    const res = await workerRequest('/', {
      headers: { Origin: 'https://tokenforge.opensyber.cloud' },
    }, mockEnv);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://tokenforge.opensyber.cloud',
    );
  });

  it('CORS allows localhost in non-production', async () => {
    mockEnv.ENVIRONMENT = 'development';
    const res = await workerRequest('/', {
      headers: { Origin: 'http://localhost:3000' },
    }, mockEnv);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000',
    );
  });

  it('exports a fetch handler', () => {
    expect(worker.fetch).toBeDefined();
    expect(typeof worker.fetch).toBe('function');
  });

  it('exports a scheduled handler (Cloudflare cron entrypoint)', () => {
    expect(worker.scheduled).toBeDefined();
    expect(typeof worker.scheduled).toBe('function');
  });

  it('emits all 6 OWASP-recommended security response headers', async () => {
    const res = await workerRequest('/', {}, mockEnv);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers.get('X-XSS-Protection')).toBe('0');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('GET / response includes the docs URL pointer', async () => {
    const res = await workerRequest('/', {}, mockEnv);
    const body = (await res.json()) as { docs: string };
    expect(body.docs).toBe('https://tokenforge.opensyber.cloud/docs/api');
  });

  it('CORS rejects untrusted origin (Access-Control-Allow-Origin not set to attacker.example)', async () => {
    mockEnv.ENVIRONMENT = 'production';
    const res = await workerRequest('/', {
      headers: { Origin: 'https://attacker.example' },
    }, mockEnv);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://attacker.example');
  });
});
