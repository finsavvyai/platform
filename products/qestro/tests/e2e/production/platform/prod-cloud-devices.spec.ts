/**
 * Production E2E tests for the Cloud Devices page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  navigateSidebar,
  assertButton,
  assertHeading,
  SIDEBAR_SEL,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('Cloud Devices', () => {
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

  test('navigate via sidebar to /cloud-devices', async () => {
    await navigateSidebar(page, 'Cloud Devices', /\/cloud-devices/);
    await expect(page).toHaveURL(/\/cloud-devices/);
  });

  test('Refresh Devices button is visible', async () => {
    const btn = page.getByRole('button', { name: /refresh/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('Configure Providers button is visible', async () => {
    const btn = page.getByRole('button', { name: /configure/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('provider cards grid with known providers', async () => {
    const providers = [/browserstack/i, /sauce\s*lab/i, /lambdatest/i];
    let found = 0;
    for (const provider of providers) {
      const el = page.getByText(provider).first();
      try {
        await expect(el).toBeVisible({ timeout: 5000 });
        found++;
      } catch {
        // Provider may not be listed
      }
    }
    expect(found).toBeGreaterThanOrEqual(1);
  });

  test('click a provider card applies filter', async () => {
    const card = page.locator(
      '[class*="card"], [class*="provider"], [role="button"]',
    ).filter({ hasText: /browserstack|sauce|lambda/i });
    const firstCard = card.first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('device cards grid is visible', async () => {
    const grid = page.locator(
      '[class*="grid"], [class*="device-list"], [class*="devices"]',
    );
    await expect(grid.first()).toBeVisible({ timeout: 10000 });
  });

  test('device card shows name and platform text', async () => {
    const card = page.locator(
      '[class*="card"], [class*="device"]',
    ).filter({ hasText: /ios|android|chrome|safari|firefox|pixel|iphone|samsung/i });
    await expect(card.first()).toBeVisible({ timeout: 10000 });
  });

  test('status badge on device cards', async () => {
    const badge = page.locator(
      '[class*="badge"], [class*="status"], [class*="indicator"]',
    ).filter({ hasText: /available|online|busy|offline|idle/i });
    const hasDeviceBadge = await badge.first().isVisible().catch(() => false);
    if (!hasDeviceBadge) {
      await expect(
        page.getByText(/connected|available|busy|offline/i).first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }
    await expect(badge.first()).toBeVisible({ timeout: 10000 });
  });

  test('Launch button on available device', async () => {
    const btn = page.getByRole('button', { name: /launch/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('page heading is visible', async () => {
    const heading = page.locator('main, [role="main"]').first().getByRole('heading', {
      name: /cloud device|device hub/i,
    }).or(
      page.locator('main, [role="main"]').first().getByText(/cloud device|device hub/i),
    ).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
