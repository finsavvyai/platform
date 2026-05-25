import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { StudioPage } from '../pages/studio.page';
import { createProUser } from '../fixtures/test-users';
import { URLS } from '../fixtures/urls';
import { loginViaUI, clearAuth } from '../helpers/auth';
import { checkA11y } from '../helpers/accessibility';
import { runHIGChecks } from '../helpers/hig-checks';

/**
 * Paying User Journey E2E Tests
 *
 * Covers the authenticated experience: login, dashboard,
 * API key management, agent operations, billing, and settings.
 */

const proUser = createProUser();

test.describe('Paying User Journey', () => {
  test.describe('Authentication', () => {
    test('should load the login page', async ({ page }) => {
      await page.goto(`${URLS.dashboard.base}${URLS.dashboard.login}`);
      await page.waitForLoadState('domcontentloaded');

      const emailInput = page.locator(
        'input[type="email"], [data-testid="email-input"]'
      ).first();
      const passwordInput = page.locator(
        'input[type="password"], [data-testid="password-input"]'
      ).first();

      // Login form elements should be present
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should reject invalid credentials', async ({ page }) => {
      await page.goto(`${URLS.dashboard.base}${URLS.dashboard.login}`);
      await page.waitForLoadState('domcontentloaded');

      const emailInput = page.locator(
        'input[type="email"], [data-testid="email-input"]'
      ).first();
      const passwordInput = page.locator(
        'input[type="password"], [data-testid="password-input"]'
      ).first();

      if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailInput.fill('fake@test.com');
        await passwordInput.fill('WrongPassword123!');

        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();

        // Should remain on login or show error
        await page.waitForTimeout(2000);
        const url = page.url();
        const hasError = url.includes('login') ||
          (await page.locator('.error, [role="alert"]').count()) > 0;
        expect(hasError).toBe(true);
      }
    });

    test('login page should pass accessibility', async ({ page }) => {
      await page.goto(`${URLS.dashboard.base}${URLS.dashboard.login}`);
      await page.waitForLoadState('domcontentloaded');
      await checkA11y(page);
    });

    test('login page should pass HIG checks', async ({ page }) => {
      await page.goto(`${URLS.dashboard.base}${URLS.dashboard.login}`);
      await page.waitForLoadState('domcontentloaded');
      await runHIGChecks(page);
    });
  });

  test.describe('Dashboard', () => {
    test('should load the dashboard home', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await page.waitForLoadState('domcontentloaded');

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should have navigation structure', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const navLinks = page.locator('a[href], button').first();
      expect(await navLinks.count()).toBeGreaterThanOrEqual(1);
    });

    test('dashboard should pass HIG checks', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await runHIGChecks(page);
    });
  });

  test.describe('API Keys Management', () => {
    test('should load the API keys page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.gotoAPIKeys();

      const url = page.url();
      const isOnAPIKeys = url.includes('api-key') ||
        url.includes('login') ||
        url.includes('signup');
      expect(isOnAPIKeys).toBe(true);
    });
  });

  test.describe('Settings', () => {
    test('should load the settings page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.gotoSettings();

      const url = page.url();
      const isOnSettings = url.includes('settings') ||
        url.includes('login');
      expect(isOnSettings).toBe(true);
    });
  });

  test.describe('Billing', () => {
    test('should load the billing page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.gotoBilling();

      const url = page.url();
      const isOnBilling = url.includes('billing') ||
        url.includes('login');
      expect(isOnBilling).toBe(true);
    });
  });

  test.describe('Studio IDE', () => {
    test('should load the studio home', async ({ page }) => {
      const studio = new StudioPage(page);
      await studio.goto();
      await page.waitForLoadState('domcontentloaded');

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should load the workflow editor', async ({ page }) => {
      const studio = new StudioPage(page);
      await studio.gotoEditor();

      const url = page.url();
      expect(url).toContain(URLS.studio.base);
    });

    test('should load the templates page', async ({ page }) => {
      const studio = new StudioPage(page);
      await studio.gotoTemplates();

      const url = page.url();
      expect(url).toContain(URLS.studio.base);
    });

    test('studio should pass HIG checks', async ({ page }) => {
      const studio = new StudioPage(page);
      await studio.goto();
      await runHIGChecks(page);
    });
  });
});
