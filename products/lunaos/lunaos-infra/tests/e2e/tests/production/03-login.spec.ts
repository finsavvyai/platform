import { test, expect } from '@playwright/test';

/**
 * Production Test: Login Flow
 *
 * Existing customers log into agents.lunaos.ai.
 * Uses real production form selectors (id="email", id="password").
 */

const DASHBOARD = 'https://agents.lunaos.ai';

test.describe('Login Flow — agents.lunaos.ai', () => {
  test('login page loads with form fields', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/login/`);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login form has correct placeholders', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/login/`);
    await expect(page.locator('#email')).toHaveAttribute(
      'placeholder', 'you@company.com'
    );
  });

  test('empty submit stays on login page', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/login/`);
    await page.locator('button[type="submit"]').click();
    expect(page.url()).toContain('/auth/login');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/login/`);
    await page.locator('#email').fill('fake@nobody.com');
    await page.locator('#password').fill('WrongPassword123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Should remain on login or show an error message
    const onLogin = page.url().includes('/auth/login');
    const hasError = (await page.locator(
      '[class*="error"], [class*="red"], [role="alert"]'
    ).count()) > 0;
    expect(onLogin || hasError).toBe(true);
  });

  test('has link to signup page', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/login/`);
    const signupLink = page.locator('a[href*="signup"]');
    await expect(signupLink).toBeVisible();
  });

  test('has LunaOS branding', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/login/`);
    await page.waitForLoadState('networkidle');
    // Dashboard nav has LunaOS text in gradient span
    const branding = page.getByText('LunaOS').first();
    await expect(branding).toBeVisible();
  });

  test('login page renders dark theme', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/login/`);
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const luminance = 0.299 * +match[1] + 0.587 * +match[2] + 0.114 * +match[3];
      expect(luminance).toBeLessThan(50); // Very dark background
    }
  });
});
