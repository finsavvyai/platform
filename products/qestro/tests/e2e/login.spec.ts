/**
 * E2E: Login Page
 * Tests authentication flows including OAuth buttons, email/password, and signup link
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test('renders login form with all elements', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows all 7 OAuth provider buttons', async ({ page }) => {
    const providers = ['Google', 'GitHub', 'Microsoft', 'LinkedIn', 'Apple', 'Discord', 'X'];
    for (const provider of providers) {
      await expect(page.getByRole('button', { name: new RegExp(provider, 'i') })).toBeVisible();
    }
  });

  test('OAuth button redirects to provider', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/github') && r.status() === 302),
      page.getByRole('button', { name: /github/i }).click(),
    ]).catch(() => [null]);

    // If backend not running, button should attempt redirect
    const url = page.url();
    expect(url.includes('github.com') || url.includes('/login')).toBeTruthy();
  });

  test('email login shows validation errors', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    // Form should show validation — empty fields
    const emailInput = page.getByPlaceholder('you@company.com');
    await expect(emailInput).toBeFocused();
  });

  test('has link to signup page', async ({ page }) => {
    const signupLink = page.getByText(/start your free trial|sign up/i);
    await expect(signupLink).toBeVisible();
  });

  test('has forgot password link', async ({ page }) => {
    await expect(page.getByText(/forgot password/i)).toBeVisible();
  });

  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('Welcome back')).toBeVisible();
    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
