/**
 * Regression test for the 3 endpoints that leaked data unauthenticated.
 * Ensures we never ship an "auth optional" middleware on these again.
 */
import { test, expect } from '@playwright/test';

const API = process.env.E2E_API_URL || 'https://api.qestro.app';

const PROTECTED = [
  '/api/projects',
  '/api/test-cases',
  '/api/dashboard/stats',
  '/api/test-plans',
  '/api/runs',
  '/api/cycles',
  '/api/insights/overview',
];

test.describe('Protected endpoints require JWT', () => {
  for (const path of PROTECTED) {
    test(`GET ${path} returns 401 without auth`, async ({ request }) => {
      const r = await request.get(`${API}${path}`);
      expect(r.status()).toBe(401);
    });

    test(`GET ${path} returns 401 with invalid token`, async ({ request }) => {
      const r = await request.get(`${API}${path}`, {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(r.status()).toBe(401);
    });
  }
});

test.describe('Public endpoints stay public', () => {
  const PUBLIC = ['/api/health', '/api/auth/providers'];
  for (const path of PUBLIC) {
    test(`GET ${path} returns 200 without auth`, async ({ request }) => {
      const r = await request.get(`${API}${path}`);
      expect(r.status()).toBe(200);
    });
  }
});
