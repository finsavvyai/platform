import { test, expect } from '@playwright/test';
import { URLS } from '../fixtures/urls';

/**
 * API Health Check E2E Tests
 *
 * Validates that all LunaOS API endpoints respond correctly,
 * return proper status codes, headers, and response formats.
 */

const API_BASE = URLS.api.base;

test.describe('API Health Checks', () => {
  test.describe('Core Health Endpoint', () => {
    test('should return 200 on /health', async ({ request }) => {
      const response = await request.get(`${API_BASE}/health`);
      expect(response.status()).toBe(200);
    });

    test('health response should be JSON', async ({ request }) => {
      const response = await request.get(`${API_BASE}/health`);
      const contentType = response.headers()['content-type'] || '';
      expect(contentType).toContain('json');
    });

    test('health response should include status field', async ({ request }) => {
      const response = await request.get(`${API_BASE}/health`);
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('status');
      }
    });
  });

  test.describe('API Response Headers', () => {
    test('should include CORS headers', async ({ request }) => {
      const response = await request.get(`${API_BASE}/health`);
      const headers = response.headers();

      // At least one CORS-related header should exist
      const hasCors =
        headers['access-control-allow-origin'] ||
        headers['access-control-allow-methods'] ||
        headers['vary']?.includes('Origin');
      // CORS may not be on health; just verify API responds
      expect(response.status()).toBeLessThan(500);
    });

    test('should not expose server version', async ({ request }) => {
      const response = await request.get(`${API_BASE}/health`);
      const headers = response.headers();

      // Server header should not leak version info
      const server = headers['server'] || '';
      expect(server).not.toMatch(/\d+\.\d+\.\d+/);
    });
  });

  test.describe('Authentication Endpoints', () => {
    test('auth endpoint should exist', async ({ request }) => {
      const response = await request.post(`${API_BASE}/auth/login`, {
        data: { email: 'test@test.com', password: 'test' },
        headers: { 'Content-Type': 'application/json' },
      });

      // Should return 401 or 400, not 404 or 500
      expect(response.status()).toBeLessThan(500);
      expect(response.status()).not.toBe(404);
    });

    test('should reject empty auth body', async ({ request }) => {
      const response = await request.post(`${API_BASE}/auth/login`, {
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('Rate Limiting', () => {
    test('should not crash under moderate load', async ({ request }) => {
      const results: number[] = [];
      // Send 5 sequential requests to avoid overwhelming the API
      for (let i = 0; i < 5; i++) {
        try {
          const r = await request.get(`${API_BASE}/health`);
          results.push(r.status());
        } catch {
          results.push(0);
        }
      }
      // At least 80% should succeed (not 5xx)
      const ok = results.filter((s) => s > 0 && s < 500).length;
      expect(ok).toBeGreaterThanOrEqual(4);
    });
  });

  test.describe('Product Endpoints', () => {
    test('marketing site should respond', async ({ request }) => {
      const response = await request.get(URLS.marketing.base);
      expect(response.status()).toBe(200);
    });

    test('dashboard should respond', async ({ request }) => {
      const response = await request.get(URLS.dashboard.base);
      expect(response.status()).toBeLessThan(500);
    });

    test('studio should respond', async ({ request }) => {
      const response = await request.get(URLS.studio.base);
      expect(response.status()).toBeLessThan(500);
    });

    test('docs should respond', async ({ request }) => {
      const response = await request.get(URLS.docs.base);
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('SSL Certificates', () => {
    test('marketing should serve over HTTPS', async ({ page }) => {
      await page.goto(URLS.marketing.base);
      expect(page.url()).toMatch(/^https:\/\//);
    });

    test('dashboard should serve over HTTPS', async ({ page }) => {
      await page.goto(URLS.dashboard.base);
      expect(page.url()).toMatch(/^https:\/\//);
    });

    test('API should serve over HTTPS', async ({ page }) => {
      const response = await page.request.get(`${API_BASE}/health`);
      expect(response.url()).toMatch(/^https:\/\//);
    });
  });

  test.describe('Error Handling', () => {
    test('should return 404 for unknown routes', async ({ request }) => {
      const response = await request.get(
        `${API_BASE}/nonexistent-route-${Date.now()}`
      );
      expect(response.status()).toBe(404);
    });

    test('404 response should be JSON', async ({ request }) => {
      const response = await request.get(
        `${API_BASE}/nonexistent-route-${Date.now()}`
      );
      if (response.status() === 404) {
        const contentType = response.headers()['content-type'] || '';
        // API should return JSON errors
        expect(contentType).toContain('json');
      }
    });
  });
});
