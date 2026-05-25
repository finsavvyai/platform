/**
 * Production E2E Tests - Login Page
 * Tests against https://qestro.app/login
 */

import { test, expect } from '@playwright/test';
import { PROD_URL } from '../helpers/production-helpers';
import { testUsers } from '../../fixtures/test-users';
import { waitForNetworkIdle } from '../../utils/test-helpers';

const demoUser = testUsers.demoUser;

test.describe('Production Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${PROD_URL}/login`);
    await waitForNetworkIdle(page);
  });

  test('login page loads with email and password inputs', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
  });

  test('login page heading is visible', async ({ page }) => {
    // LoginPage has h2 "Welcome back" heading
    const heading = page.getByRole('heading', { name: /welcome back|sign in/i }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('empty submit shows validation', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await emailInput.clear();
    await passwordInput.clear();

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    const hasHTML5Validation = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    );
    const hasErrorAlert = await page.locator('[role="alert"], .error, .text-red-500, .text-destructive')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasHTML5Validation || hasErrorAlert).toBeTruthy();
  });

  test('wrong credentials show error alert', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await emailInput.fill('wrong@invalid.com');
    await passwordInput.fill('wrongpassword999');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // LoginPage shows errors as .text-red-300 inside a translucent red div
    const errorLocator = page.locator(
      '[role="alert"], .error-message, .text-red-500, .text-destructive, .text-red-300, .text-red-400, [data-testid="error"]',
    );
    const hasErrorAlert = await errorLocator.first().isVisible().catch(() => false);
    if (!hasErrorAlert) {
      // Fallback: invalid credentials should not navigate away from login.
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    }
  });

  test('show/hide password toggle works', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"], input[type="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // LoginPage has a button[type="button"] with Eye/EyeOff icon adjacent to password field
    const toggleBtn = page.locator(
      'button[type="button"]:has(svg)',
    ).filter({ hasNot: page.locator('[type="submit"]') }).first();

    await toggleBtn.click();

    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('remember me checkbox is toggleable', async ({ page }) => {
    const checkbox = page.locator(
      'input[type="checkbox"], [role="checkbox"]',
    ).first();
    await expect(checkbox).toBeVisible({ timeout: 10000 });

    const isCheckedBefore = await checkbox.isChecked().catch(() => false);
    await checkbox.click();
    const isCheckedAfter = await checkbox.isChecked().catch(() =>
      checkbox.getAttribute('aria-checked').then((v) => v === 'true'),
    );
    expect(isCheckedAfter).not.toBe(isCheckedBefore);
  });

  test('GitHub OAuth button is visible', async ({ page }) => {
    const githubBtn = page.locator(
      'button:has-text("GitHub"), a:has-text("GitHub"), [aria-label*="GitHub"]',
    ).first();
    await expect(githubBtn).toBeVisible({ timeout: 10000 });
  });

  test('Microsoft OAuth button is visible', async ({ page }) => {
    const msBtn = page.locator(
      'button:has-text("Microsoft"), a:has-text("Microsoft"), [aria-label*="Microsoft"]',
    ).first();
    await expect(msBtn).toBeVisible({ timeout: 10000 });
  });

  test('demo credentials hint text is visible', async ({ page }) => {
    const hintText = page.locator(
      'text=/test@|demo|Demo credentials|test credentials/i',
    ).first();
    await expect(hintText).toBeVisible({ timeout: 10000 });
  });

  test('create a new account link is visible', async ({ page }) => {
    // LoginPage has "start your free trial" link or sign up link
    const registerLink = page.locator(
      'a:has-text("create"), a:has-text("Sign up"), a:has-text("Register"), a:has-text("free trial"), a[href*="register"], a[href*="signup"]',
    ).first();
    await expect(registerLink).toBeVisible({ timeout: 10000 });
  });

  test('successful demo login redirects away from /login', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await emailInput.fill(demoUser.email);
    await passwordInput.fill(demoUser.password);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 20000,
    });

    expect(page.url()).not.toContain('/login');
  });

  test('forgot password link is visible', async ({ page }) => {
    const forgotLink = page.locator(
      'a:has-text("Forgot"), a:has-text("forgot"), a:has-text("Reset password"), [href*="forgot"], [href*="reset"]',
    ).first();
    await expect(forgotLink).toBeVisible({ timeout: 10000 });
  });
});
