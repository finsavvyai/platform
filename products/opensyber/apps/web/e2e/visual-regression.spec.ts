import { authTest as test, expect } from './fixtures/auth';

/**
 * Visual regression tests — screenshot comparison.
 * First run: npx playwright test visual-regression --update-snapshots
 * Subsequent runs compare against golden screenshots.
 */
test.describe('Visual Regression — Public Pages', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('landing page desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('landing-desktop.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });

  test('pricing page desktop', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('pricing-desktop.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });

  test('marketplace page desktop', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('marketplace-desktop.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });
});

test.describe('Visual Regression — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('landing page mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('landing-mobile.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });
});

test.describe('Visual Regression — Dashboard', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('dashboard overview', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      maxDiffPixelRatio: 0.03,
      fullPage: false,
    });
  });

  test('security dashboard', async ({ page }) => {
    await page.goto('/dashboard/security');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('security-dashboard.png', {
      maxDiffPixelRatio: 0.03,
      fullPage: false,
    });
  });
});
