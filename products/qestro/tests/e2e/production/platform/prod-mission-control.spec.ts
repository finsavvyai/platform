/**
 * Production E2E tests for the Mission Control page.
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

test.describe.serial('Mission Control', () => {
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

  test('navigate via sidebar to /mission-control', async () => {
    await navigateSidebar(page, 'Mission Control', /\/mission-control/);
    await expect(page).toHaveURL(/\/mission-control/);
  });

  test('Ingest Ticket tab is visible', async () => {
    const tab = page.getByRole('tab', { name: /ingest ticket/i }).or(
      page.getByRole('button', { name: /ingest ticket/i }),
    ).or(page.getByText(/ingest ticket/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test('Deploy Scout tab is visible and clickable', async () => {
    const tab = page.getByRole('tab', { name: /deploy scout/i }).or(
      page.getByRole('button', { name: /deploy scout/i }),
    ).or(page.getByText(/deploy scout/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
    await tab.first().click();
    await page.waitForTimeout(300);
  });

  test('Onboard Repo tab is visible and clickable', async () => {
    const tab = page.getByRole('tab', { name: /onboard repo/i }).or(
      page.getByRole('button', { name: /onboard repo/i }),
    ).or(page.getByText(/onboard repo/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
    await tab.first().click();
    await page.waitForTimeout(300);
    // Switch back to Ingest Ticket for subsequent tests
    const ingestTab = page.getByText(/ingest ticket/i).first();
    await ingestTab.click();
    await page.waitForTimeout(300);
  });

  test('textarea input is visible', async () => {
    const textarea = page.locator('textarea');
    await expect(textarea.first()).toBeVisible({ timeout: 10000 });
  });

  test('Initialize Mission button is visible', async () => {
    const btn = page.getByRole('button', { name: /initialize mission/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('button disabled when input is empty', async () => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('');
    const btn = page.getByRole('button', { name: /initialize mission/i });
    const isDisabled = await btn.first().isDisabled();
    const hasDisabledClass = await btn.first().evaluate(
      (el) => el.classList.contains('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        (el as HTMLButtonElement).disabled,
    );
    expect(isDisabled || hasDisabledClass).toBeTruthy();
  });

  test('Active Mandates section is visible', async () => {
    const section = page.getByText(/active mandate/i).or(
      page.getByText(/active mission/i),
    );
    await expect(section.first()).toBeVisible({ timeout: 10000 });
  });

  test('mission cards with status badges', async () => {
    const cards = page.locator(
      '[class*="card"], [class*="mission"], [class*="mandate"]',
    ).filter({ hasText: /pending|active|completed|in.progress|running/i });
    const count = await cards.count();
    if (count > 0) {
      await expect(cards.first()).toBeVisible({ timeout: 10000 });
    } else {
      // Empty state is also acceptable
      const empty = page.getByText(/no.*mission|no.*mandate|empty/i);
      await expect(empty.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('click a mission card reveals detail section', async () => {
    const cards = page.locator(
      '[class*="card"], [class*="mission"], [class*="mandate"]',
    ).filter({ hasText: /pending|active|completed|in.progress|running/i });
    const count = await cards.count();
    if (count > 0) {
      await cards.first().click();
      await page.waitForTimeout(500);
      const detail = page.locator(
        '[class*="detail"], [class*="panel"], [class*="expanded"]',
      );
      await expect(detail.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
