import { visualTest as test, expect, stabilizePage, SCREENSHOT_TOLERANCE } from './fixtures';
import { applyMocks, DASHBOARD_HOME_MOCKS } from './mocks';

/**
 * Visual regression: /dashboard home.
 *
 * Scenario: authenticated user with empty instance state (no agents yet).
 * This catches regressions in the dashboard shell, sidebar, stat cards,
 * and empty-state CTAs.
 */

test.describe('Visual — Dashboard Home', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    storageState: './e2e/.auth/user.json',
  });

  test.beforeEach(async ({ page }) => {
    await applyMocks(page, DASHBOARD_HOME_MOCKS);
  });

  test('dashboard home — empty instance state', async ({ page }) => {
    await page.goto('/dashboard');
    await stabilizePage(page);

    await expect(page).toHaveScreenshot('dashboard-home-empty.png', SCREENSHOT_TOLERANCE);
  });

  test('dashboard home — sidebar only', async ({ page }) => {
    await page.goto('/dashboard');
    await stabilizePage(page);

    const sidebar = page.locator('nav, aside').first();
    await expect(sidebar).toHaveScreenshot('dashboard-sidebar.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('dashboard security page', async ({ page }) => {
    await page.goto('/dashboard/security');
    await stabilizePage(page);

    await expect(page).toHaveScreenshot('dashboard-security.png', SCREENSHOT_TOLERANCE);
  });
});
