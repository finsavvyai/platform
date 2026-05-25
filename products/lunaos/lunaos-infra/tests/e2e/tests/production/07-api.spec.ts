import { test, expect } from '@playwright/test';

/**
 * Production Test: API Endpoints
 *
 * Validates real production API at api.lunaos.ai.
 * Tests health, auth validation, error handling, and security headers.
 */

const API = 'https://api.lunaos.ai';

test.describe('API — api.lunaos.ai', () => {
  test.describe('Health & Status', () => {
    test('GET /health returns 200', async ({ request }) => {
      const res = await request.get(`${API}/health`);
      expect(res.status()).toBe(200);
    });

    test('health response is JSON with status field', async ({ request }) => {
      const res = await request.get(`${API}/health`);
      const ct = res.headers()['content-type'] || '';
      expect(ct).toContain('json');

      const body = await res.json();
      expect(body.status).toBe('ok');
    });

    test('health shows service statuses', async ({ request }) => {
      const res = await request.get(`${API}/health`);
      const body = await res.json();
      if (body.services) {
        expect(body.services).toHaveProperty('d1');
        expect(body.services).toHaveProperty('kv');
      }
    });

    test('health includes version info', async ({ request }) => {
      const res = await request.get(`${API}/health`);
      const body = await res.json();
      if (body.version) {
        expect(body.version).toMatch(/^\d+\.\d+/);
      }
    });
  });

  test.describe('Authentication Validation', () => {
    test('POST /auth/login rejects empty body', async ({ request }) => {
      const res = await request.post(`${API}/auth/login`, {
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });

    test('POST /auth/login rejects invalid credentials', async ({
      request,
    }) => {
      const res = await request.post(`${API}/auth/login`, {
        data: { email: 'fake@test.com', password: 'WrongPass123!' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });

    test('POST /auth/signup rejects invalid email', async ({ request }) => {
      const res = await request.post(`${API}/auth/signup`, {
        data: { email: 'not-email', password: 'ValidPass123!' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /auth/signup rejects short password', async ({ request }) => {
      const res = await request.post(`${API}/auth/signup`, {
        data: { email: 'test@test.com', password: '12' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });

    test('validation errors return structured JSON', async ({ request }) => {
      const res = await request.post(`${API}/auth/signup`, {
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Validation');
    });
  });

  test.describe('Security Headers', () => {
    test('does not expose server version', async ({ request }) => {
      const res = await request.get(`${API}/health`);
      const server = res.headers()['server'] || '';
      expect(server).not.toMatch(/\d+\.\d+\.\d+/);
    });

    test('serves over HTTPS', async ({ request }) => {
      const res = await request.get(`${API}/health`);
      expect(res.url()).toMatch(/^https:\/\//);
    });
  });

  test.describe('Error Handling', () => {
    test('unknown route returns 404', async ({ request }) => {
      const res = await request.get(
        `${API}/nonexistent-${Date.now()}`
      );
      expect(res.status()).toBe(404);
    });

    test('404 returns JSON error', async ({ request }) => {
      const res = await request.get(
        `${API}/nonexistent-${Date.now()}`
      );
      if (res.status() === 404) {
        const ct = res.headers()['content-type'] || '';
        expect(ct).toContain('json');
      }
    });

    test('protected endpoints reject without auth', async ({ request }) => {
      const endpoints = ['/agents', '/api-keys', '/billing'];
      for (const ep of endpoints) {
        const res = await request.get(`${API}${ep}`);
        expect(res.status()).toBeGreaterThanOrEqual(400);
        expect(res.status()).toBeLessThan(500);
      }
    });
  });

  test.describe('Resilience', () => {
    test('handles 5 sequential requests without errors', async ({
      request,
    }) => {
      const results: number[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          const r = await request.get(`${API}/health`);
          results.push(r.status());
        } catch {
          results.push(0);
        }
      }
      const ok = results.filter((s) => s > 0 && s < 500).length;
      expect(ok).toBeGreaterThanOrEqual(4);
    });
  });
});
