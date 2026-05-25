/**
 * Production E2E tests for the API Studio page.
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

test.describe.serial('API Studio', () => {
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

  test('navigate via sidebar to /api-studio', async () => {
    await navigateSidebar(page, 'API Studio', /\/api-studio/);
    await expect(page).toHaveURL(/\/api-studio/);
  });

  test('collections sidebar is visible', async () => {
    const sidebar = page.locator(
      '[class*="collection"], [data-testid*="collection"], aside, nav',
    ).filter({ hasText: /collection/i });
    const hasSidebar = await sidebar.first().isVisible().catch(() => false);
    if (!hasSidebar) {
      await expect(
        page.getByText(/collections?/i).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });
  });

  test('search input in sidebar is visible', async () => {
    const search = page.locator(
      'input[placeholder*="earch"], input[type="search"]',
    );
    await expect(search.first()).toBeVisible({ timeout: 10000 });
  });

  test('HTTP method dropdown is visible', async () => {
    const method = page.locator(
      'select, [role="combobox"], button',
    ).filter({ hasText: /GET|POST|PUT|DELETE|PATCH/i });
    await expect(method.first()).toBeVisible({ timeout: 10000 });
  });

  test('URL input bar is visible', async () => {
    const urlInput = page.locator(
      'input[placeholder*="URL"], input[placeholder*="url"], input[placeholder*="endpoint"], input[placeholder*="Enter"]',
    );
    await expect(urlInput.first()).toBeVisible({ timeout: 10000 });
  });

  test('Send button is visible', async () => {
    const btn = page.getByRole('button', { name: /send/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('Save button is visible', async () => {
    const btn = page.getByRole('button', { name: /save/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('request tabs Body, Headers, Auth, Tests are visible', async () => {
    const tabs = ['Body', 'Headers', 'Auth', 'Tests'];
    for (const tab of tabs) {
      const el = page.getByRole('tab', { name: tab }).or(
        page.getByRole('button', { name: tab }),
      );
      await expect(el.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('click Tests tab reveals script area', async () => {
    const testsTab = page.getByRole('tab', { name: 'Tests' }).or(
      page.getByRole('button', { name: 'Tests' }),
    );
    await testsTab.first().click();
    const scriptArea = page.locator(
      'textarea, [class*="editor"], [class*="code"], pre, [role="textbox"]',
    );
    await expect(scriptArea.first()).toBeVisible({ timeout: 10000 });
  });

  test('Import button is visible', async () => {
    const btn = page.getByRole('button', { name: /import/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
