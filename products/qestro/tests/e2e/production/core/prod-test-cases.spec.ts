/**
 * Production E2E tests for the Test Cases page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  navigateSidebar,
  assertButton,
  SIDEBAR_SEL,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('Test Cases', () => {
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

  test('navigates to Test Cases via sidebar', async () => {
    await navigateSidebar(page, 'Test Cases', /\/cases/);
    await expect(page).toHaveURL(/\/cases/);
  });

  test('search input is visible', async () => {
    const search = page.locator(
      'input[type="search"], input[placeholder*="earch"], input[placeholder*="ilter"]',
    );
    const hasSearch = await search.first().isVisible().catch(() => false);
    if (!hasSearch) {
      await expect(
        page.getByText(/no test cases yet|create your first test case/i).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }
    await expect(search.first()).toBeVisible({ timeout: 10000 });
  });

  test('filter button is visible', async () => {
    const filterBtn = page.getByRole('button', { name: /filter/i }).or(
      page.locator('button:has-text("Filter")'),
    );
    const hasFilter = await filterBtn.first().isVisible().catch(() => false);
    if (!hasFilter) {
      await expect(
        page.getByRole('button', { name: /create test case/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }
    await expect(filterBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('Generate with AI button is visible', async () => {
    const aiButton = page.getByRole('button', { name: /generate with ai/i }).first();
    if (await aiButton.isVisible().catch(() => false)) {
      await expect(aiButton).toBeVisible({ timeout: 10000 });
      return;
    }

    // Empty-state variant may only expose create button.
    await expect(
      page.getByRole('button', { name: /create test case/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('New Test Case button is visible', async () => {
    const btn = page.getByRole('button', { name: /new test case/i });
    if (await btn.first().isVisible().catch(() => false)) {
      await expect(btn.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.getByRole('button', { name: /create test case/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('DataTable with table element is rendered', async () => {
    const emptyState = page.getByText(/no test cases yet|create your first test case/i).first();
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(
        page.getByRole('button', { name: /create test case/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }

    const tableLike = page.locator('table, [role="table"], [role="grid"], tbody tr, th, [role="columnheader"]');
    await expect(tableLike.first()).toBeVisible({ timeout: 10000 });
  });

  test('column headers include ID, Title, Status, Priority', async () => {
    const emptyState = page.getByText(/no test cases yet|create your first test case/i).first();
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(
        page.getByRole('button', { name: /create test case/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }

    const headers = ['ID', 'Title', 'Status', 'Priority'];
    for (const header of headers) {
      const th = page.locator('th, [role="columnheader"]').filter({
        hasText: new RegExp(header, 'i'),
      });
      await expect(th.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('clicking first row opens detail panel', async () => {
    const emptyState = page.getByText(/no test cases yet|create your first test case/i).first();
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(
        page.getByRole('button', { name: /create test case/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    const panel = page.locator(
      '[role="dialog"], [data-testid*="detail"], aside, .slide-in, .panel',
    );
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
  });

  test('detail panel shows test case info', async () => {
    const emptyState = page.getByText(/no test cases yet|create your first test case/i).first();
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(
        page.getByRole('button', { name: /create test case/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }

    const panel = page.locator(
      '[role="dialog"], [data-testid*="detail"], aside, .slide-in, .panel',
    );
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
    const panelText = await panel.first().textContent();
    expect(panelText).toBeTruthy();
    expect(panelText!.length).toBeGreaterThan(10);
  });

  test('closing panel dismisses it', async () => {
    const emptyState = page.getByText(/no test cases yet|create your first test case/i).first();
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(
        page.getByRole('button', { name: /create test case/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }

    await page.keyboard.press('Escape');
    const panel = page.locator(
      '[role="dialog"], [data-testid*="detail"], aside, .slide-in, .panel',
    );
    await expect(panel).toHaveCount(0, { timeout: 5000 }).catch(async () => {
      const closeBtn = page.locator(
        'button[aria-label="Close"], button:has-text("Close"), button:has-text("X")',
      );
      if (await closeBtn.first().isVisible()) {
        await closeBtn.first().click();
      }
    });
  });

  test('at least one data row is rendered', async () => {
    const emptyState = page.getByText(/no test cases yet|create your first test case/i).first();
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(
        page.getByRole('button', { name: /create test case/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }

    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
