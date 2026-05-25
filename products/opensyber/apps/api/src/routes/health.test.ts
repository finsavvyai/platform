import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { health } from './health.js';
import type { Env, Variables } from '../types.js';

type AppEnv = { Bindings: Env; Variables: Variables };

function createMockEnv(overrides: Partial<Record<string, unknown>> = {}): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ 1: 1 }),
      }),
    } as unknown as D1Database,
    CACHE: {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as KVNamespace,
    STORAGE: {
      head: vi.fn().mockResolvedValue(null),
    } as unknown as R2Bucket,
    ...overrides,
  } as unknown as Env;
}

function createApp(env: Env) {
  const app = new Hono<AppEnv>();
  // Mount at /health to mirror production: app.route('/health', health)
  app.route('/health', health);
  return app;
}

describe('Health Route', () => {
  describe('Path Resolution', () => {
    it('responds at /health (not /health/health)', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('healthy');
    });

    it('returns 404 for /health/health (old broken path)', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health/health', {}, env);
      expect(res.status).toBe(404);
    });
  });

  describe('Healthy State — All Subsystems OK', () => {
    it('returns healthy with 200 when all subsystems pass', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.version).toBe('0.3.0');
      expect(body.timestamp).toBeDefined();
      expect(body.subsystems.d1.status).toBe('ok');
      expect(body.subsystems.kv.status).toBe('ok');
      expect(body.subsystems.r2.status).toBe('ok');
    });

    it('includes latency for each subsystem', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      const body = await res.json();

      expect(typeof body.subsystems.d1.latencyMs).toBe('number');
      expect(typeof body.subsystems.kv.latencyMs).toBe('number');
      expect(typeof body.subsystems.r2.latencyMs).toBe('number');
    });

    it('returns valid ISO timestamp', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      const body = await res.json();

      const parsed = new Date(body.timestamp);
      expect(parsed.toISOString()).toBe(body.timestamp);
    });
  });

  describe('Unhealthy State — D1 Failure', () => {
    it('returns 503 when D1 is down', async () => {
      const env = createMockEnv({
        DB: {
          prepare: vi.fn().mockReturnValue({
            first: vi.fn().mockRejectedValue(new Error('D1 connection failed')),
          }),
        },
      });
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.status).toBe('unhealthy');
      expect(body.subsystems.d1.status).toBe('error');
      expect(body.subsystems.d1.error).toBe('unreachable');
      // KV and R2 should still be ok
      expect(body.subsystems.kv.status).toBe('ok');
      expect(body.subsystems.r2.status).toBe('ok');
    });
  });

  describe('Unhealthy State — KV Failure', () => {
    it('returns 503 when KV is down', async () => {
      const env = createMockEnv({
        CACHE: {
          get: vi.fn().mockRejectedValue(new Error('KV timeout')),
        },
      });
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.status).toBe('unhealthy');
      expect(body.subsystems.kv.status).toBe('error');
      expect(body.subsystems.kv.error).toBe('unreachable');
    });
  });

  describe('Unhealthy State — R2 Failure', () => {
    it('returns 503 when R2 is down', async () => {
      const env = createMockEnv({
        STORAGE: {
          head: vi.fn().mockRejectedValue(new Error('R2 bucket not found')),
        },
      });
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.status).toBe('unhealthy');
      expect(body.subsystems.r2.status).toBe('error');
      expect(body.subsystems.r2.error).toBe('unreachable');
    });
  });

  describe('Unhealthy State — Multiple Failures', () => {
    it('returns 503 when all subsystems are down', async () => {
      const env = createMockEnv({
        DB: {
          prepare: vi.fn().mockReturnValue({
            first: vi.fn().mockRejectedValue(new Error('D1 down')),
          }),
        },
        CACHE: {
          get: vi.fn().mockRejectedValue(new Error('KV down')),
        },
        STORAGE: {
          head: vi.fn().mockRejectedValue(new Error('R2 down')),
        },
      });
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.status).toBe('unhealthy');
      expect(body.subsystems.d1.status).toBe('error');
      expect(body.subsystems.kv.status).toBe('error');
      expect(body.subsystems.r2.status).toBe('error');
    });
  });

  describe('Response Format', () => {
    it('returns JSON content type', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('response has all required fields', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      const body = await res.json();

      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('subsystems');
      expect(body.subsystems).toHaveProperty('d1');
      expect(body.subsystems).toHaveProperty('kv');
      expect(body.subsystems).toHaveProperty('r2');
    });

    it('does not leak error stack traces', async () => {
      const env = createMockEnv({
        DB: {
          prepare: vi.fn().mockReturnValue({
            first: vi.fn().mockRejectedValue(new Error('Connection refused\n    at Object.open')),
          }),
        },
      });
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      const body = await res.json();

      // Error message should be the message, not include stack
      expect(body.subsystems.d1.error).not.toContain('at Object');
    });
  });
});
