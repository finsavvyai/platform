import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'https://opensyber-api.broad-dew-49ad.workers.dev';

test.describe('API Health & Public Endpoints', () => {
  test('GET / returns API info', async ({ request }) => {
    const res = await request.get(`${API_BASE}/`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      name: 'OpenSyber API',
      version: '0.3.0',
    });
    expect(body.docs).toBeDefined();
  });

  test('GET /health returns healthy status', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('opensyber-api');
    expect(body.timestamp).toBeDefined();
  });

  test('security headers are present on all responses', async ({ request }) => {
    const res = await request.get(`${API_BASE}/`);
    const headers = res.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toContain("default-src");
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-dns-prefetch-control']).toBe('off');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  test('CORS headers for opensyber.cloud origin', async ({ request }) => {
    const res = await request.fetch(`${API_BASE}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://opensyber.cloud',
        'Access-Control-Request-Method': 'GET',
      },
    });

    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe('https://opensyber.cloud');
  });

  test('GET /api/skills returns skills array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/skills`);
    // Allow 200 (success) or 401/403 (TokenForge middleware may block)
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.skills).toBeInstanceOf(Array);
    } else {
      // TokenForge device-binding may reject unauthenticated requests
      expect([401, 403]).toContain(res.status());
    }
  });

  test('404 for unknown route', async ({ request }) => {
    const res = await request.get(`${API_BASE}/nonexistent-route-xyz`);
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Not found');
  });
});
