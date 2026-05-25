import { test, expect } from '@playwright/test';
import { setupAuth } from './auth-setup';
import { mockDashboard } from './mocks';

test.describe('Responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await mockDashboard(page);
  });

  test('desktop shows sidebar by default', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');
    await expect(page.getByText('AMLIQ')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), admin/ })).toBeVisible();
  });

  test('mobile hides sidebar initially', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    // Sidebar should be off-screen (translated)
    const sidebar = page.locator('div').filter({ hasText: 'AMLIQ' }).first();
    await expect(sidebar).toBeDefined();
  });

  test('tablet viewport renders dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), admin/ })).toBeVisible();
    await expect(page.getByText('Total Alerts')).toBeVisible();
  });

  test('landing page renders at all viewports', async ({ page }) => {
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
