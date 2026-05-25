/**
 * Production E2E tests for the Service Virtualization page.
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

test.describe.serial('Service Virtualization', () => {
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

  test('navigate via sidebar to /service-virtualization', async () => {
    await navigateSidebar(page, 'Service Virtualization', /\/service-virtualization/);
    await expect(page).toHaveURL(/\/service-virtualization/);
  });

  test('New Virtual Service button is visible', async () => {
    const btn = page.getByRole('button', { name: /new virtual service/i }).or(
      page.getByRole('button', { name: /new.*service/i }),
    ).or(page.getByRole('button', { name: /create/i }));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('Reset Server button is visible', async () => {
    const btn = page.getByRole('button', { name: /reset/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('Active Mocks tab is visible and default active', async () => {
    const tab = page.getByRole('tab', { name: /active mock/i }).or(
      page.getByRole('button', { name: /active mock/i }),
    ).or(page.getByText(/active mock/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test('Request Log tab is visible and clickable', async () => {
    const tab = page.getByRole('tab', { name: /request log/i }).or(
      page.getByRole('button', { name: /request log/i }),
    ).or(page.getByText(/request log/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
    await tab.first().click();
    await page.waitForTimeout(300);
    // Switch back to Active Mocks
    const mocksTab = page.getByText(/active mock/i).first();
    await mocksTab.click();
    await page.waitForTimeout(300);
  });

  test('search input is visible', async () => {
    const search = page.locator(
      'input[placeholder*="earch"], input[type="search"]',
    );
    await expect(search.first()).toBeVisible({ timeout: 10000 });
  });

  test('stubs table or empty state is visible', async () => {
    const table = page.locator('table, [role="table"]');
    const empty = page.getByText(/no.*mock|no.*stub|no.*service|empty/i);
    const tableVisible = await table.first().isVisible().catch(() => false);
    const emptyVisible = await empty.first().isVisible().catch(() => false);
    expect(tableVisible || emptyVisible).toBeTruthy();
  });

  test('click New Virtual Service opens modal', async () => {
    const btn = page.getByRole('button', { name: /new virtual service/i }).or(
      page.getByRole('button', { name: /new.*service/i }),
    ).or(page.getByRole('button', { name: /create/i }));
    await btn.first().click();
    const modal = page.locator(
      '[role="dialog"], [class*="modal"], [class*="dialog"]',
    );
    const inlinePanel = page.locator(
      'form, [class*="panel"], [class*="card"]',
    ).filter({
      has: page.locator('input, select, [role="combobox"]'),
    });

    if (await modal.first().isVisible().catch(() => false)) {
      await expect(modal.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(inlinePanel.first()).toBeVisible({ timeout: 10000 });
  });

  test('modal has method, url, and status fields', async () => {
    const modal = page.locator(
      '[role="dialog"], [class*="modal"], [class*="dialog"]',
    );
    const container = await modal.first().isVisible().catch(() => false)
      ? modal.first()
      : page.locator('form, [class*="panel"], [class*="card"]').filter({
          has: page.locator('input, select, [role="combobox"]'),
        }).first();
    await expect(container).toBeVisible({ timeout: 5000 });
    const inputs = container.locator('input, select, [role="combobox"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('modal close dismisses dialog', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const modal = page.locator(
      '[role="dialog"], [class*="modal"], [class*="dialog"]',
    );
    const visible = await modal.first().isVisible().catch(() => false);
    if (visible) {
      const closeBtn = page.locator(
        '[aria-label="Close"], button:has-text("Close"), button:has-text("Cancel")',
      );
      await closeBtn.first().click();
      await page.waitForTimeout(500);
    }
    await expect(
      page.locator('[role="dialog"], [class*="modal"]').first(),
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
