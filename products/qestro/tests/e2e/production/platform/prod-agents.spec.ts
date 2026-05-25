/**
 * Production E2E tests for the Agents page.
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

test.describe.serial('Agents', () => {
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

  test('navigate directly to /agents', async () => {
    await navigateDirect(page, '/agents');
    await expect(page).toHaveURL(/\/agents/);
  });

  test('The Architect agent card is visible', async () => {
    await expect(
      page.getByText(/the architect/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('The Novice agent card is visible', async () => {
    await expect(
      page.getByText(/the novice/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('The Power User agent card is visible', async () => {
    await expect(
      page.getByText(/the power user/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('The Hacker agent card is visible', async () => {
    await expect(
      page.getByText(/the hacker/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('The Scout agent card is visible', async () => {
    await expect(
      page.getByText(/the scout/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
