/**
 * E2E Test: Dashboard Navigation
 * Tests dashboard functionality and navigation flows
 */

import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';
import { mockDashboardAPIs } from '../fixtures/dashboard.fixture';
import {
  waitForNetworkIdle,
  checkConsoleErrors,
  assertNoJSErrors,
} from '../utils/test-helpers';

test.describe('Dashboard Navigation', () => {
  let consoleErrors: string[];
  const dashboardHeading = /Release Dashboard/i;
  const navLink = (
    page: import('@playwright/test').Page,
    name: string,
    href: string
  ) => page.locator(`a[href="${href}"]:visible`).or(page.getByRole('link', { name })).first();

  test.beforeEach(async ({ page }) => {
    consoleErrors = await checkConsoleErrors(page);
    await mockAuth(page);
    await mockDashboardAPIs(page);
    await page.goto('/');
    await waitForNetworkIdle(page);
    await hideOverlays(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoJSErrors(page, consoleErrors);
  });

  test('should display dashboard after auth', async ({ page }) => {
    const path = new URL(page.url()).pathname;
    expect(path === '/' || path.includes('/dashboard')).toBeTruthy();

    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await expect(navLink(page, 'Test Cases', '/cases')).toBeVisible();
  });

  test('should navigate to Test Cases page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await navLink(page, 'Test Cases', '/cases').click();
    await waitForNetworkIdle(page);
    await page.waitForURL(/\/cases/, { timeout: 10000 });
    expect(page.url()).toContain('/cases');
  });

  test('should render the Analytics release gate', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await page.goto('/insights');
    await page.waitForURL(/\/insights/, { timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: 'Analytics is hidden in the current production release.' })
    ).toBeVisible();
  });

  test('should navigate to Settings page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await navLink(page, 'Settings', '/settings').click();
    await waitForNetworkIdle(page);
    await page.waitForURL(/\/settings/, { timeout: 10000 });
    expect(page.url()).toContain('/settings');
  });

  test('should have logout button in sidebar', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    const logoutButton = page.getByRole('button', { name: 'Logout' }).first();
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
  });

  test('should navigate back to dashboard from other pages', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await navLink(page, 'Test Cases', '/cases').click();
    await page.waitForURL(/\/cases/, { timeout: 10000 });

    await navLink(page, 'Dashboard', '/').click();
    await waitForNetworkIdle(page);

    const path = new URL(page.url()).pathname;
    expect(path === '/').toBeTruthy();
  });

  test('should maintain state across page reloads', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await page.reload();
    await waitForNetworkIdle(page);

    const path = new URL(page.url()).pathname;
    expect(path === '/' || path.includes('/dashboard')).toBeTruthy();
  });

  test('should handle browser back/forward buttons', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await navLink(page, 'Test Cases', '/cases').click();
    await page.waitForURL(/\/cases/, { timeout: 10000 });

    await page.goBack();
    await waitForNetworkIdle(page);

    const path = new URL(page.url()).pathname;
    expect(path === '/').toBeTruthy();

    await page.goForward();
    await waitForNetworkIdle(page);

    expect(page.url()).toContain('/cases');
  });

  test('should handle slow network conditions', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: dashboardHeading, level: 2 })
    ).toBeVisible({ timeout: 10000 });

    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await navLink(page, 'Test Cases', '/cases').click();
    await page.waitForURL(/\/cases/, { timeout: 30000 });
  });
});
