import { visualTest as test, expect, stabilizePage, SCREENSHOT_TOLERANCE } from './fixtures';
import { applyMocks, ADMIN_METRICS_MOCKS } from './mocks';

/**
 * Visual regression: /admin/metrics.
 *
 * Admin-only page with KPI cards, revenue charts, and org/user tables.
 * All numeric data is mocked to zero so the layout is deterministic.
 * Charts render with empty series and should show the zero-state axis.
 */

test.describe('Visual — Admin Metrics', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    storageState: './e2e/.auth/user.json',
  });

  test.beforeEach(async ({ page }) => {
    await applyMocks(page, ADMIN_METRICS_MOCKS);
  });

  test('admin metrics — empty state', async ({ page }) => {
    await page.goto('/admin/metrics');
    await stabilizePage(page);

    await expect(page).toHaveScreenshot('admin-metrics-empty.png', SCREENSHOT_TOLERANCE);
  });

  test('admin metrics — KPI cards section', async ({ page }) => {
    await page.goto('/admin/metrics');
    await stabilizePage(page);

    const kpiSection = page
      .locator('[data-testid="kpi-grid"], [class*="MetricCard"]')
      .first();
    await expect(kpiSection).toHaveScreenshot('admin-metrics-kpi.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('admin metrics — mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/metrics');
    await stabilizePage(page);

    await expect(page).toHaveScreenshot('admin-metrics-mobile.png', SCREENSHOT_TOLERANCE);
  });
});
