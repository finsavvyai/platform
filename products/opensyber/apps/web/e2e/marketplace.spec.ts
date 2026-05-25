import { test, expect } from '@playwright/test';

test.describe('Skill Marketplace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    // Wait for heading to confirm page loaded; skip if CF blocks
    try {
      await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      const bodyText = await page.textContent('body').catch(() => '');
      if (bodyText?.includes('security verification') || bodyText?.includes('Cloudflare')) {
        test.skip(true, 'Cloudflare bot protection blocked headless browser');
      }
    }
  });

  test('page loads with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /skills.*attack vector covered/i
    );
  });

  test('category filter tabs are present', async ({ page }) => {
    const categories = ['All', 'Security', 'CI/CD', 'AI Agents'];
    for (const category of categories) {
      await expect(page.getByRole('link', { name: category }).first()).toBeVisible();
    }
  });

  test('clicking a category filter updates URL', async ({ page }) => {
    await page.getByRole('link', { name: 'Security' }).first().click();
    await expect(page).toHaveURL(/category=security/);
  });

  test('clicking All tab returns to marketplace', async ({ page }) => {
    // Skip if Cloudflare bot protection intercepts
    const bodyText = await page.textContent('body').catch(() => '');
    if (
      bodyText?.includes('security verification') ||
      bodyText?.includes('Checking your browser') ||
      bodyText?.includes('Just a moment')
    ) {
      test.skip(true, 'Cloudflare bot protection blocked headless browser');
      return;
    }

    // Wait for categories to render before clicking
    await expect(page.getByRole('link', { name: 'Security' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('link', { name: 'Security' }).first().click();
    await expect(page).toHaveURL(/category=security/, { timeout: 10_000 });
    await page.getByRole('link', { name: 'All', exact: true }).first().click();
    await expect(page).toHaveURL(/\/marketplace/, { timeout: 10_000 });
  });

  test('skill cards or empty state is shown', async ({ page }) => {
    const skillCards = page.locator('a[href^="/marketplace/"]');
    const emptyState = page.getByText(/no skills found/i);
    const hasSkills = (await skillCards.count()) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasSkills || hasEmpty).toBe(true);
  });
});
