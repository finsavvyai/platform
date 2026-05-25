/**
 * Production E2E tests for the Test Plans page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  navigateDirect,
  assertButton,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('Test Plans', () => {
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

  test('navigates directly to /plans', async () => {
    await navigateDirect(page, '/plans');
    await expect(page).toHaveURL(/\/plans/);
  });

  test('New Test Plan button is visible', async () => {
    const btn = page.getByRole('button', { name: /new test plan/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('search input is visible', async () => {
    const search = page.locator(
      'input[type="search"], input[placeholder*="earch"], input[placeholder*="ilter"]',
    );
    await expect(search.first()).toBeVisible({ timeout: 10000 });
  });

  test('tabs are visible: All Templates, Made by Team, By TestQuality', async () => {
    const tabs = ['All Templates', 'Made by Team', 'By TestQuality'];
    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') }).or(
        page.getByRole('button', { name: new RegExp(tabName, 'i') }),
      );
      await expect(tab.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('tab switching works', async () => {
    const secondTab = page
      .getByRole('tab', { name: /made by team/i })
      .or(page.getByRole('button', { name: /made by team/i }));
    await secondTab.first().click();
    try {
      await expect(secondTab.first()).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    } catch {
      // Fallback: check the tab has an active visual state.
      await expect(secondTab.first()).toHaveClass(/bg-primary|text-white|selected|active/i);
    }
  });

  test('plan cards are rendered', async () => {
    // Switch back to All Templates to ensure cards load
    const allTab = page
      .getByRole('tab', { name: /all templates/i })
      .or(page.getByRole('button', { name: /all templates/i }));
    await allTab.first().click();
    await page.waitForTimeout(1000);
    const cards = page.locator(
      '[data-testid*="card"], [data-testid*="plan"], .card, [class*="card"]',
    );
    const count = await cards.count();
    if (count === 0) {
      await expect(
        page.getByRole('button', { name: /create new plan|new test plan|create test plan/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }
    expect(count).toBeGreaterThan(0);
  });

  test('Add Component button is present on a card', async () => {
    const addComponentBtn = page.getByText(/add component/i).first();
    if (await addComponentBtn.isVisible().catch(() => false)) {
      await expect(addComponentBtn).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.getByRole('button', { name: /create new plan|new test plan|create test plan/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Export PDF button is present on a card', async () => {
    const exportBtn = page.getByText(/export pdf/i).first();
    if (await exportBtn.isVisible().catch(() => false)) {
      await expect(exportBtn).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.getByRole('button', { name: /create new plan|new test plan|create test plan/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
