import { test as base, expect } from '@playwright/test';

/** Shared fixture that seeds auth state and mocks common API responses. */
export const test = base.extend<{ authedPage: void }>({
  authedPage: [async ({ page }, use) => {
    // Seed a valid JWT token in localStorage before navigating
    await page.addInitScript(() => {
      const fakeToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.' +
        btoa(JSON.stringify({
          tenant_id: 'tnt_abcdefghijkl', user_id: 'user_1',
          role: 'admin', exp: Date.now() / 1000 + 3600,
        })) + '.fakesig';
      localStorage.setItem('amliq_token', fakeToken);
    });

    // Mock /api/v1/auth/me to return a valid user
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
    await use();
  }, { auto: false }],
});

export { expect };
