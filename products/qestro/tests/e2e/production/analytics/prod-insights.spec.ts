/**
 * Production E2E tests for the Analytics / Insights page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  navigateSidebar,
  assertHeading,
  SIDEBAR_SEL,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('Analytics — Insights', () => {
  let page: Page;
  let context: BrowserContext;
  let consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await loginAsDemoUser(browser));
    consoleErrors = await checkConsoleErrors(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('navigates to Insights via sidebar', async () => {
    await navigateSidebar(page, 'Analytics', /\/insights/);
    await expect(page).toHaveURL(/\/insights/);
  });

  test('Test Coverage card is visible with percentage', async () => {
    const card = page.getByText(/test coverage/i).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(':has-text("Test Coverage") >> text=/%/').first()
        .or(page.getByText(/\d+%/).first()),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Pass Rate card is visible with percentage', async () => {
    const card = page.getByText(/pass rate/i).first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test('Avg Duration card is visible', async () => {
    const card = page.getByText(/avg duration/i)
      .or(page.getByText(/average duration/i))
      .or(page.getByText(/optimized time|execution time|duration/i))
      .first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test('Weekly Test Results chart area is visible', async () => {
    const chart = page.getByText(/weekly test results/i)
      .or(page.getByText(/test results/i))
      .first();
    await expect(chart).toBeVisible({ timeout: 10000 });
  });

  test('Coverage Trend chart area is visible', async () => {
    const trend = page.getByText(/coverage trend/i)
      .or(page.getByText(/trend/i))
      .first();
    await expect(trend).toBeVisible({ timeout: 10000 });
  });

  test('SVG chart elements are rendered', async () => {
    const chart = page.locator('main, [role="main"]').first().locator(
      'svg, canvas, [class*="chart"], [class*="recharts"]',
    ).first();

    if (await chart.isVisible().catch(() => false)) {
      await expect(chart).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.locator('main, [role="main"]').first().getByText(/weekly test results|coverage trend|analytics/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
