/**
 * Production E2E tests for the AI Center page.
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

test.describe.serial('Analytics — AI Center', () => {
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

  test('navigates to AI Center via sidebar', async () => {
    await navigateSidebar(page, 'AI Center', /\/ai-center/);
    await expect(page).toHaveURL(/\/ai-center/);
  });

  test('hero banner with status dot is visible', async () => {
    const hero = page.locator('[class*="hero"], [class*="banner"], section').first();
    await expect(hero).toBeVisible({ timeout: 10000 });
    const statusDot = page.locator(
      '[class*="status"], [class*="dot"], [class*="indicator"]',
    ).first();
    await expect(statusDot).toBeVisible({ timeout: 10000 });
  });

  test('refresh button is visible', async () => {
    const btn = page.getByRole('button', { name: /refresh/i })
      .or(page.locator('button:has-text("Refresh")'));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('four metric cards are visible', async () => {
    const metrics = [
      /tests run today/i,
      /ai healed/i,
      /success rate/i,
      /agent uptime/i,
    ];
    for (const metric of metrics) {
      await expect(
        page.getByText(metric).first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('Quick Actions grid is visible', async () => {
    const section = page.getByText(/quick actions/i).first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('Run Test Suite tile is visible', async () => {
    await expect(
      page.getByText(/run test suite/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Generate Tests tile is visible', async () => {
    await expect(
      page.getByText(/generate tests/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Record Flow tile is visible', async () => {
    await expect(
      page.getByText(/record flow/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Recent AI Activity feed section is visible', async () => {
    const feed = page.getByText(/recent ai activity/i)
      .or(page.getByText(/ai activity/i))
      .first();
    await expect(feed).toBeVisible({ timeout: 10000 });
  });

  test('activity items are rendered in feed', async () => {
    const items = page.locator(
      '[class*="activity"] li, [class*="feed"] > div, [class*="activity-item"]',
    );
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    expect(await items.count()).toBeGreaterThanOrEqual(1);
  });
});
