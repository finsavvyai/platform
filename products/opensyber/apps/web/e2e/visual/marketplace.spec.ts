import { visualTest as test, expect, stabilizePage, SCREENSHOT_TOLERANCE } from './fixtures';
import { applyMocks, MARKETPLACE_MOCKS } from './mocks';

/**
 * Visual regression: /dashboard/marketplace.
 *
 * Covers the skill marketplace grid, empty state (no installed skills),
 * and suggested skills panel. Mocked with a stable set of two AI skills
 * so the card layout is deterministic.
 */

test.describe('Visual — Marketplace', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    storageState: './e2e/.auth/user.json',
  });

  test.beforeEach(async ({ page }) => {
    await applyMocks(page, MARKETPLACE_MOCKS);
  });

  test('marketplace grid — default view', async ({ page }) => {
    await page.goto('/dashboard/marketplace');
    await stabilizePage(page);

    await expect(page).toHaveScreenshot('marketplace-grid.png', SCREENSHOT_TOLERANCE);
  });

  test('marketplace — empty installed state', async ({ page }) => {
    await page.goto('/dashboard/marketplace?tab=installed');
    await stabilizePage(page);

    await expect(page).toHaveScreenshot('marketplace-empty-installed.png', SCREENSHOT_TOLERANCE);
  });

  test('marketplace — first skill card detail', async ({ page }) => {
    await page.goto('/dashboard/marketplace');
    await stabilizePage(page);

    const firstCard = page.locator('[class*="SkillCard"], [data-testid="skill-card"]').first();
    await expect(firstCard).toHaveScreenshot('marketplace-skill-card.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});
