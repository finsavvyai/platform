import { test, expect } from '@playwright/test';

test.describe('Legal Pages', () => {
  test('privacy policy loads with heading', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/privacy|data|information/i).first()).toBeVisible();
  });

  test('terms of service loads with heading', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/terms|service|agreement/i).first()).toBeVisible();
  });

  test('legal pages have content sections', async ({ page }) => {
    await page.goto('/privacy');
    // Privacy page should have multiple sections
    const headings = page.locator('h2, h3');
    const count = await headings.count();
    expect(count).toBeGreaterThan(2);
  });

  test('terms page has content sections', async ({ page }) => {
    await page.goto('/terms');
    const headings = page.locator('h2, h3');
    const count = await headings.count();
    expect(count).toBeGreaterThan(2);
  });

  test('footer has legal links', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    // Check for any legal-related links in footer
    const allLinks = footer.locator('a');
    const count = await allLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
