import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from './fixtures/auth.fixture';
import { mockDashboardAPIs } from './fixtures/dashboard.fixture';

test.describe('Dashboard', () => {
  const navLink = (
    page: import('@playwright/test').Page,
    name: string,
    href: string
  ) => page.locator(`a[href="${href}"]:visible`).or(page.getByRole('link', { name })).first();

  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
  });

  test('should display dashboard overview', async ({ page }) => {
    const summaryGrid = page.locator('.dashboard-container > .grid').first();

    await expect(
      page.getByRole('heading', { name: 'Release Dashboard', level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.dashboard-container')).toBeVisible();

    await expect(summaryGrid.getByText('Projects', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Test Cases', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Run Coverage', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Jira-ready Artifacts', { exact: true })).toBeVisible();
  });

  test('should display dashboard elements', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Release Dashboard', level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await expect(navLink(page, 'Test Cases', '/cases')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Activity', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Execution Overview', level: 3 })).toBeVisible();
  });

  test('should navigate from dashboard via sidebar', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Release Dashboard', level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await navLink(page, 'Test Cases', '/cases').click();
    await expect(page).toHaveURL(/\/cases/);
  });

  test('should show Run Diagnostics button', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Release Dashboard', level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('button:has-text("Run Diagnostics")')
    ).toBeVisible();
  });

  test('should show dashboard shortcuts', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Release Dashboard', level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: 'Record New Flow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View test runs' })).toBeVisible();
  });

  test('should show system status', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Release Dashboard', level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/System status:/i)).toBeVisible();
  });
});
