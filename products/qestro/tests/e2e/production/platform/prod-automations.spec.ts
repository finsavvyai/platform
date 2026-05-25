/**
 * Production E2E tests for the Automations page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  navigateDirect,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('Automations', () => {
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

  test('navigate directly to /automation-runs', async () => {
    await navigateDirect(page, '/automation-runs');
    await expect(page).toHaveURL(/\/automation-runs/);
  });

  test('framework grid section is visible', async () => {
    const grid = page.locator(
      '[class*="grid"], [class*="framework"], section',
    ).filter({ hasText: /playwright|cypress|jest|selenium/i });
    await expect(grid.first()).toBeVisible({ timeout: 10000 });
  });

  test('Playwright tile is visible', async () => {
    await expect(
      page.getByText(/playwright/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Cypress tile is visible', async () => {
    await expect(
      page.getByText(/cypress/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Jest tile is visible', async () => {
    await expect(
      page.getByText(/jest/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Selenium tile is visible', async () => {
    await expect(
      page.getByText(/selenium/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Getting Started section is visible', async () => {
    await expect(
      page.getByText(/getting started/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
