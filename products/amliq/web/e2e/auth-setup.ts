import type { Page } from '@playwright/test';

/** Injects auth token and mocks /auth/me for authenticated tests. */
export async function setupAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('amliq_token', 'fake.jwt.token');
  });
  await page.route('**/api/v1/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'user_1', email: 'admin@aegis.test',
          role: 'admin', tenant_id: 'tnt_abcdefghijkl',
        },
      }),
    }),
  );
}
