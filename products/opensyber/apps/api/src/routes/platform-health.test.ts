/**
 * Platform Health Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/auth.js', async () => {
  const { createMiddleware } = await vi.importActual('hono/factory');
  return {
    authMiddleware: createMiddleware(async (c: any, next: any) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      c.set('userId', 'user-1');
      await next();
    }),
  };
});

vi.mock('../middleware/db.js', async () => {
  const { createMiddleware } = await vi.importActual('hono/factory');
  return {
    dbMiddleware: createMiddleware(async (_c: any, next: any) => {
      await next();
    }),
  };
});

import { platformHealthRoutes } from './platform-health.js';

function createTestApp() {
  const app = new Hono();
  app.route('/api/platform', platformHealthRoutes);
  return app;
}

describe('Platform Health Routes', () => {
  it('GET /health returns platform health', async () => {
    const app = createTestApp();
    const res = await app.request('/api/platform/health', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.overall).toBe('healthy');
    expect(body.data.subsystems.length).toBeGreaterThanOrEqual(6);
    expect(body.data.uptimePercent).toBe(100);
  });

  it('returns 401 without auth', async () => {
    const app = createTestApp();
    const res = await app.request('/api/platform/health');
    expect(res.status).toBe(401);
  });
});
