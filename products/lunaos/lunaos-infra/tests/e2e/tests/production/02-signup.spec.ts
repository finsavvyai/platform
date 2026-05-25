import { test, expect } from '@playwright/test';

/**
 * Production Test: Signup Flow
 *
 * A new customer creates an account on agents.lunaos.ai.
 * Uses real production form selectors (id="name", id="email", id="password").
 */

const DASHBOARD = 'https://agents.lunaos.ai';
const API = 'https://api.lunaos.ai';

test.describe('Signup Flow — agents.lunaos.ai', () => {
  test('signup page loads with form fields', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/signup/`);
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('signup form shows correct placeholders', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/signup/`);
    await expect(page.locator('#name')).toHaveAttribute(
      'placeholder', 'Your name'
    );
    await expect(page.locator('#email')).toHaveAttribute(
      'placeholder', 'you@company.com'
    );
    await expect(page.locator('#password')).toHaveAttribute(
      'placeholder', 'Min 8 characters'
    );
  });

  test('empty form submission shows validation', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/signup/`);
    await page.locator('button[type="submit"]').click();
    // Should stay on signup page (HTML5 validation prevents submit)
    expect(page.url()).toContain('/auth/signup');
  });

  test('short password is rejected', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/signup/`);
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('short');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);

    // Should show error or stay on page
    const url = page.url();
    const hasError = url.includes('signup') ||
      (await page.locator('[class*="error"], [class*="red"]').count()) > 0;
    expect(hasError).toBe(true);
  });

  test('has link to login page', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/signup/`);
    const loginLink = page.locator('a[href*="login"]');
    await expect(loginLink).toBeVisible();
  });

  test('API rejects empty signup request', async ({ request }) => {
    const response = await request.post(`${API}/auth/signup`, {
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Validation');
    expect(body.details).toBeDefined();
  });

  test('API validates email format', async ({ request }) => {
    const response = await request.post(`${API}/auth/signup`, {
      data: { email: 'not-an-email', password: 'ValidPass123!' },
    });
    expect(response.status()).toBe(400);
  });

  test('API validates password length', async ({ request }) => {
    const response = await request.post(`${API}/auth/signup`, {
      data: { email: 'test@test.com', password: '123' },
    });
    expect(response.status()).toBe(400);
  });
});
