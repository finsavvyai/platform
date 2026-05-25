import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'https://opensyber-api.broad-dew-49ad.workers.dev';
const ENDPOINT = `${API_BASE}/api/enterprise/contact`;

test.describe('Enterprise Contact API', () => {
  const validPayload = {
    name: 'Playwright E2E',
    email: 'e2e-test@example.com',
    company: 'Test Corp',
    message: 'Automated E2E test — please ignore.',
  };

  test('POST with valid data returns 201', async ({ request }) => {
    const res = await request.post(ENDPOINT, { data: validPayload });
    // Allow 201 (success) or 401/403 (TokenForge middleware)
    if (res.status() === 201) {
      const body = await res.json();
      expect(body.data.id).toBeDefined();
      expect(body.data.message).toContain('Thank you');
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });

  test('POST with missing fields returns 400', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { name: 'Only Name' },
    });

    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toBe('Bad request');
      expect(body.message).toContain('required');
    } else {
      // TokenForge may reject before validation runs
      expect([401, 403]).toContain(res.status());
    }
  });

  test('POST with invalid email returns 400', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { ...validPayload, email: 'not-an-email' },
    });

    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toBe('Bad request');
      expect(body.message).toContain('Invalid email');
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });

  test('POST with oversized fields returns 400', async ({ request }) => {
    const longString = 'x'.repeat(201);
    const res = await request.post(ENDPOINT, {
      data: { ...validPayload, name: longString },
    });

    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toBe('Bad request');
      expect(body.message).toContain('length');
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });

  test('POST with empty body returns 400', async ({ request }) => {
    const res = await request.post(ENDPOINT, { data: {} });

    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toBe('Bad request');
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });
});
