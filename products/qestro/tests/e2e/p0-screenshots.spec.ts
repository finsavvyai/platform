import { test } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = 'test-results/p0-screenshots';

test.describe('P0 Visual Audit — Screenshot All Pages', () => {

  test('1. Login page', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login.png`, fullPage: true });
  });

  test('2. Register page', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-register.png`, fullPage: true });
  });

  test('3. Privacy page', async ({ page }) => {
    await page.goto(`${BASE}/privacy`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-privacy.png`, fullPage: true });
  });

  test('4. Terms page', async ({ page }) => {
    await page.goto(`${BASE}/terms`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-terms.png`, fullPage: true });
  });

  test('5. Dashboard (after login)', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('test@qestro.io');
      await page.locator('input[type="password"], input[name="password"]').first().fill('test123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      if (page.url().includes('/login')) {
        await page.evaluate(() => {
          localStorage.setItem('accessToken', 'mock-jwt-access-test');
          localStorage.setItem('refreshToken', 'mock-jwt-refresh-test');
        });
        await page.goto(`${BASE}/`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-dashboard.png`, fullPage: true });
  });

  test('6. 404 page', async ({ page }) => {
    // Set auth tokens so we get past ProtectedRoute
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'mock-jwt-access-test');
      localStorage.setItem('refreshToken', 'mock-jwt-refresh-test');
    });
    await page.goto(`${BASE}/nonexistent-page-xyz`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-404.png`, fullPage: true });
  });

  test('7. Settings page', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'mock-jwt-access-test');
      localStorage.setItem('refreshToken', 'mock-jwt-refresh-test');
    });
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-settings.png`, fullPage: true });
  });

  test('8. Billing page', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'mock-jwt-access-test');
      localStorage.setItem('refreshToken', 'mock-jwt-refresh-test');
    });
    await page.goto(`${BASE}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-billing.png`, fullPage: true });
  });
});
