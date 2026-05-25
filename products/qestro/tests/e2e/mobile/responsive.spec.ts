import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';
import { mockDashboardAPIs } from '../fixtures/dashboard.fixture';

test.describe('Mobile Responsive Design', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockDashboardAPIs(page);
    await page.goto('/');
    await hideOverlays(page);
  });

  test('Dashboard should adapt layout for mobile', async ({ page }) => {
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole('heading', { name: 'Release Dashboard', level: 2 })
    ).toBeVisible();

    const sidebarBox = await page.locator('nav').first().boundingBox().catch(() => null);
    if (sidebarBox) {
      expect(sidebarBox.width).toBeLessThan(393);
    }

    await expect(page.getByText('Projects')).toBeVisible();
  });

  test('Dashboard should display stat cards on mobile', async ({ page }) => {
    const summaryGrid = page.locator('.dashboard-container > .grid').first();

    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });

    await expect(summaryGrid.getByText('Projects', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Test Cases', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Run Coverage', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Jira-ready Artifacts', { exact: true })).toBeVisible();
  });

  test('Dashboard action buttons should be accessible on mobile', async ({ page }) => {
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: 'Run Diagnostics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record New Flow' })).toBeVisible();
  });

  test('Mobile navigation should expose released routes', async ({ page }) => {
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('nav[aria-label="Mobile navigation"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Test Cases' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Test Runs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Recording Studio' })).toBeVisible();
  });
});
