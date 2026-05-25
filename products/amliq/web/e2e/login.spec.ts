import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders login form with email and password', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to AMLIQ')).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows sign up link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Start free trial' })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route('**/api/v1/auth/login', route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        }),
      }),
    );
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill('bad@test.com');
    await page.getByPlaceholder('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('redirects to dashboard on success', async ({ page }) => {
    await page.route('**/api/v1/auth/login', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'fake.jwt.token',
            user: { id: '1', email: 'a@b.com', role: 'admin', tenant_id: 'tnt_abc' },
          },
        }),
      }),
    );
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: '1', email: 'a@b.com', role: 'admin', tenant_id: 'tnt_abc' },
        }),
      }),
    );
    await page.route('**/api/v1/**', route => {
      if (route.request().url().includes('/auth/')) return route.fallback();
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' });
    });
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill('admin@aegis.test');
    await page.getByPlaceholder('Password').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');
  });
});
