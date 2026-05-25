import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimitMiddleware } from './rate-limit.js';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockKV } from '../test/helpers.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildApp(tier?: Parameters<typeof rateLimitMiddleware>[0]) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', rateLimitMiddleware(tier));
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

async function hitN(
  app: ReturnType<typeof buildApp>,
  env: Env,
  n: number,
  headers: Record<string, string> = {},
): Promise<Response> {
  let res!: Response;
  for (let i = 0; i < n; i++) {
    res = await app.request('/test', { headers }, env);
  }
  return res;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('rateLimitMiddleware', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
  });

  // ── Public tier ────────────────────────────────────────────────────────

  describe('public tier (60 req/min)', () => {
    it('allows request under the limit and returns 200', async () => {
      const app = buildApp('public');
      const res = await app.request(
        '/test',
        { headers: { 'cf-connecting-ip': '1.2.3.4' } },
        mockEnv,
      );
      expect(res.status).toBe(200);
    });

    it('sets X-RateLimit-Limit to 60', async () => {
      const app = buildApp('public');
      const res = await app.request(
        '/test',
        { headers: { 'cf-connecting-ip': '1.2.3.4' } },
        mockEnv,
      );
      expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
    });

    it('sets X-RateLimit-Remaining to 59 on first request', async () => {
      const app = buildApp('public');
      const res = await app.request(
        '/test',
        { headers: { 'cf-connecting-ip': '1.2.3.4' } },
        mockEnv,
      );
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('59');
    });

    it('sets X-RateLimit-Reset to a future epoch second', async () => {
      const app = buildApp('public');
      const before = Math.ceil(Date.now() / 1000);
      const res = await app.request(
        '/test',
        { headers: { 'cf-connecting-ip': '1.2.3.4' } },
        mockEnv,
      );
      const reset = Number(res.headers.get('X-RateLimit-Reset'));
      expect(reset).toBeGreaterThanOrEqual(before + 60);
    });

    it('returns 429 when limit is exceeded', async () => {
      const app = buildApp('public');
      // exhaust exactly 60, then the 61st should fail
      const res = await hitN(app, mockEnv, 61, { 'cf-connecting-ip': '10.0.0.1' });
      expect(res.status).toBe(429);
    });

    it('returns error body when 429', async () => {
      const app = buildApp('public');
      const res = await hitN(app, mockEnv, 61, { 'cf-connecting-ip': '10.0.0.2' });
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('Too many requests');
      expect(body.message).toContain('Rate limit exceeded');
    });

    it('sets Retry-After header (>= 1) on 429', async () => {
      const app = buildApp('public');
      const res = await hitN(app, mockEnv, 61, { 'cf-connecting-ip': '10.0.0.3' });
      const retryAfter = Number(res.headers.get('Retry-After'));
      expect(retryAfter).toBeGreaterThanOrEqual(1);
    });

    it('sets X-RateLimit-Remaining to 0 at the limit', async () => {
      const app = buildApp('public');
      const res = await hitN(app, mockEnv, 60, { 'cf-connecting-ip': '10.0.0.4' });
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });

  // ── Authenticated tier ─────────────────────────────────────────────────

  describe('authenticated tier (300 req/min)', () => {
    it('sets X-RateLimit-Limit to 300', async () => {
      const app = buildApp('authenticated');
      // Inject userId via a pre-middleware
      const fullApp = new Hono<{ Bindings: Env; Variables: Variables }>();
      fullApp.use('*', async (c, next) => { c.set('userId', 'user_abc'); await next(); });
      fullApp.use('*', rateLimitMiddleware('authenticated'));
      fullApp.get('/test', (c) => c.json({ ok: true }));

      const res = await fullApp.request('/test', {}, mockEnv);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('300');
    });

    it('keys rate limit by userId, not IP', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });

      const fullApp = new Hono<{ Bindings: Env; Variables: Variables }>();
      fullApp.use('*', async (c, next) => { c.set('userId', 'user_xyz'); await next(); });
      fullApp.use('*', rateLimitMiddleware('authenticated'));
      fullApp.get('/test', (c) => c.json({ ok: true }));

      await fullApp.request('/test', { headers: { 'cf-connecting-ip': '1.2.3.4' } }, env);

      const putCalls = (cache.put as ReturnType<typeof vi.fn>).mock.calls;
      const kvKey: string = putCalls[0][0] as string;
      expect(kvKey).toContain('user_xyz');
      expect(kvKey).toContain('authenticated');
      expect(kvKey).not.toContain('1.2.3.4');
    });

    it('returns 429 only after 300 requests', async () => {
      const fullApp = new Hono<{ Bindings: Env; Variables: Variables }>();
      fullApp.use('*', async (c, next) => { c.set('userId', 'user_ratelimited'); await next(); });
      fullApp.use('*', rateLimitMiddleware('authenticated'));
      fullApp.get('/test', (c) => c.json({ ok: true }));

      const ok = await hitN(fullApp, mockEnv, 300);
      expect(ok.status).toBe(200);

      const blocked = await fullApp.request('/test', {}, mockEnv);
      expect(blocked.status).toBe(429);
    });
  });

  // ── Agent tier ─────────────────────────────────────────────────────────

  describe('agent tier (600 req/min)', () => {
    it('sets X-RateLimit-Limit to 600', async () => {
      const app = buildApp('agent');
      const res = await app.request(
        '/test',
        { headers: { 'X-Instance-Id': 'inst_001' } },
        mockEnv,
      );
      expect(res.headers.get('X-RateLimit-Limit')).toBe('600');
    });

    it('keys rate limit by X-Instance-Id header', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });
      const app = buildApp('agent');

      await app.request('/test', { headers: { 'X-Instance-Id': 'inst_007' } }, env);

      const putCalls = (cache.put as ReturnType<typeof vi.fn>).mock.calls;
      const kvKey: string = putCalls[0][0] as string;
      expect(kvKey).toContain('inst_007');
      expect(kvKey).toContain('agent');
    });

    it('returns 429 only after 600 requests', async () => {
      const app = buildApp('agent');
      const instHeaders = { 'X-Instance-Id': 'inst_heavy' };
      const ok = await hitN(app, mockEnv, 600, instHeaders);
      expect(ok.status).toBe(200);

      const blocked = await app.request('/test', { headers: instHeaders }, mockEnv);
      expect(blocked.status).toBe(429);
    });
  });

  // ── Client key resolution ──────────────────────────────────────────────

  describe('client key resolution (public tier)', () => {
    it('uses cf-connecting-ip when present', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });
      const app = buildApp('public');

      await app.request('/test', { headers: { 'cf-connecting-ip': '5.5.5.5' } }, env);

      const putKey: string = (cache.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(putKey).toContain('5.5.5.5');
    });

    it('falls back to x-forwarded-for when cf-connecting-ip is absent', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });
      const app = buildApp('public');

      await app.request('/test', { headers: { 'x-forwarded-for': '9.9.9.9, 1.1.1.1' } }, env);

      const putKey: string = (cache.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(putKey).toContain('9.9.9.9');
    });

    it('falls back to "unknown" when no IP headers are present', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });
      const app = buildApp('public');

      await app.request('/test', {}, env);

      const putKey: string = (cache.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(putKey).toContain('unknown');
    });

    it('prefers cf-connecting-ip over x-forwarded-for', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });
      const app = buildApp('public');

      await app.request(
        '/test',
        { headers: { 'cf-connecting-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' } },
        env,
      );

      const putKey: string = (cache.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(putKey).toContain('2.2.2.2');
      expect(putKey).not.toContain('3.3.3.3');
    });
  });

  // ── Window reset ───────────────────────────────────────────────────────

  describe('window reset behaviour', () => {
    it('resets counter after windowSeconds have elapsed', async () => {
      const NOW = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(NOW);

      const app = buildApp('public');
      const env = createMockEnv();
      const ipHeaders = { 'cf-connecting-ip': '7.7.7.7' };

      // First request — starts the window
      const first = await app.request('/test', { headers: ipHeaders }, env);
      expect(first.headers.get('X-RateLimit-Remaining')).toBe('59');

      // Advance time past the 60-second window
      vi.spyOn(Date, 'now').mockReturnValue(NOW + 61_000);

      // Counter should reset — remaining back to 59
      const afterReset = await app.request('/test', { headers: ipHeaders }, env);
      expect(afterReset.status).toBe(200);
      expect(afterReset.headers.get('X-RateLimit-Remaining')).toBe('59');

      vi.restoreAllMocks();
    });

    it('does not reset counter before windowSeconds have elapsed', async () => {
      const NOW = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(NOW);

      const app = buildApp('public');
      const env = createMockEnv();
      const ipHeaders = { 'cf-connecting-ip': '8.8.8.8' };

      await app.request('/test', { headers: ipHeaders }, env);

      // Advance time but stay within the window
      vi.spyOn(Date, 'now').mockReturnValue(NOW + 30_000);

      const res = await app.request('/test', { headers: ipHeaders }, env);
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('58');

      vi.restoreAllMocks();
    });
  });

  // ── KV storage ─────────────────────────────────────────────────────────

  describe('KV storage', () => {
    it('stores updated counter with correct TTL', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });
      const app = buildApp('public');

      await app.request('/test', { headers: { 'cf-connecting-ip': '4.4.4.4' } }, env);

      const putCalls = (cache.put as ReturnType<typeof vi.fn>).mock.calls;
      expect(putCalls).toHaveLength(1);
      // TTL should be windowSeconds (60) + 10
      expect(putCalls[0][2]).toEqual({ expirationTtl: 70 });
    });

    it('calls CACHE.get with the correct key format', async () => {
      const cache = createMockKV();
      const env = createMockEnv({ CACHE: cache });
      const app = buildApp('public');

      await app.request('/test', { headers: { 'cf-connecting-ip': '6.6.6.6' } }, env);

      const getCalls = (cache.get as ReturnType<typeof vi.fn>).mock.calls;
      expect(getCalls[0][0]).toBe('ratelimit:public:6.6.6.6');
    });

    it('defaults to public tier when an unknown tier string is supplied', async () => {
      // TypeScript won't allow bad tier, but JS callers might pass one
      const app = (rateLimitMiddleware as unknown as (t: string) => ReturnType<typeof rateLimitMiddleware>)('unknown-tier');
      const fullApp = new Hono<{ Bindings: Env; Variables: Variables }>();
      fullApp.use('*', app);
      fullApp.get('/test', (c) => c.json({ ok: true }));

      const res = await fullApp.request(
        '/test',
        { headers: { 'cf-connecting-ip': '1.1.1.1' } },
        mockEnv,
      );
      expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
    });
  });
});
