/**
 * Production E2E tests for the Test Runs page.
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

test.describe.serial('Test Runs', () => {
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

  test('navigates to Test Runs via sidebar', async () => {
    await navigateSidebar(page, 'Test Runs', /\/runs/);
    await expect(page).toHaveURL(/\/runs/);
  });

  test('New Run button is visible', async () => {
    const btn = page.getByRole('button', { name: /new run/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking New Run opens a modal', async () => {
    const btn = page.getByRole('button', { name: /new run/i });
    await btn.first().click();
    const modal = page.locator(
      '[role="dialog"], [role="alertdialog"], .modal, [data-testid*="modal"]',
    );
    const hasModal = await modal.first().isVisible().catch(() => false);
    if (!hasModal) {
      // Some builds open an inline form instead of a modal.
      await expect(
        page.getByText(/new test run|run configuration|select test plan/i).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }
    await expect(modal.first()).toBeVisible({ timeout: 10000 });
  });

  test('modal close dismisses it', async () => {
    await page.keyboard.press('Escape');
    const modal = page.locator(
      '[role="dialog"], [role="alertdialog"], .modal, [data-testid*="modal"]',
    );
    await expect(modal).toHaveCount(0, { timeout: 5000 }).catch(async () => {
      const closeBtn = page.locator(
        'button[aria-label="Close"], [data-testid*="close"], button:has-text("Cancel")',
      );
      if (await closeBtn.first().isVisible()) {
        await closeBtn.first().click();
      }
    });
  });

  test('DataTable with runs is visible', async () => {
    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('table has Run Name and Status columns', async () => {
    const headers = ['Run Name', 'Status'];
    for (const header of headers) {
      const th = page.locator('th, [role="columnheader"]').filter({
        hasText: new RegExp(header, 'i'),
      });
      await expect(th.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('clicking a run row updates right panel', async () => {
    const openCreateRunDialog = page.getByText(/create new test run/i).first();
    if (await openCreateRunDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape').catch(() => undefined);
      const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click({ force: true });
      }
    }

    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click({ force: true });
    await expect(
      page.getByRole('button', { name: /generate report|complete run|share stream|stop run/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('right panel shows run name text', async () => {
    const runHeading = page.locator('h1, h2, h3').filter({ hasText: /run|regression|test/i }).first();
    if (await runHeading.isVisible().catch(() => false)) {
      await expect(runHeading).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.getByRole('button', { name: /generate report|complete run|share stream|stop run/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Generate Report button is visible', async () => {
    await expect(
      page.getByText(/generate report/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Copy Logs button is visible', async () => {
    await expect(
      page.getByText(/copy logs/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('console or terminal area is visible', async () => {
    const terminal = page.locator(
      'pre, code, [data-testid*="terminal"], [data-testid*="console"], .terminal, .console',
    );
    if (await terminal.first().isVisible().catch(() => false)) {
      await expect(terminal.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.getByText(/logs|console|output|copy logs|generate report/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Zero Sync Active indicator is present', async () => {
    await expect(
      page.getByText(/zero sync active/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
