import { test, expect } from '@playwright/test';

/**
 * Hits the Worker (or backend) directly — not proxied through Vite.
 * Requires API at PLAYWRIGHT_API_URL (default http://127.0.0.1:8000), e.g. `npm run dev:backend`.
 */
const apiBase = (process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

test.describe('smoke-api', () => {
  test('@api-smoke GET /health', async ({ request }) => {
    test.skip(
      !process.env.CI && !process.env.PLAYWRIGHT_REQUIRE_API,
      'Set PLAYWRIGHT_REQUIRE_API=1 (or run in CI) to require backend API health locally.',
    );
    const res = await request.get(`${apiBase}/health`, { timeout: 15_000 });
    expect(res.ok(), `expected 2xx from ${apiBase}/health, got ${res.status()}`).toBeTruthy();
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('status');
  });

  test('@api-smoke production platform routes exist and require auth', async ({ request }) => {
    test.skip(
      !process.env.CI && !process.env.PLAYWRIGHT_REQUIRE_API,
      'Set PLAYWRIGHT_REQUIRE_API=1 (or run in CI) to require backend API route checks locally.',
    );

    const checks = [
      { method: 'get' as const, path: '/api/api-testing/collections' },
      { method: 'get' as const, path: '/api/devices' },
      { method: 'post' as const, path: '/api/testgen/repository-scan', data: {} },
    ];

    for (const check of checks) {
      const res = check.method === 'post'
        ? await request.post(`${apiBase}${check.path}`, { data: check.data, timeout: 15_000 })
        : await request.get(`${apiBase}${check.path}`, { timeout: 15_000 });
      expect(res.status(), `${check.path} must be deployed and protected, not missing`).not.toBe(404);
      expect([401, 403], `${check.path} should reject anonymous access`).toContain(res.status());
    }
  });
});
