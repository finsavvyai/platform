/**
 * Production E2E tests for the Dashboard page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  assertButton,
  assertHeading,
  SIDEBAR_SEL,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('Dashboard', () => {
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

  test('AI COMMAND CENTER heading is visible', async () => {
    await assertHeading(page, /ai command center/i);
  });

  test('system status indicator is present', async () => {
    const main = page.locator('main, [role="main"]').first();
    await expect(
      main.getByText(/system status/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Run Diagnostics button is visible and clickable', async () => {
    await assertButton(page, 'Run Diagnostics');
  });

  test('Auto-Pilot Mode toggle is visible', async () => {
    await expect(
      page.getByText(/auto-pilot/i).first(),
    ).toBeVisible({ timeout: 10000 });
    const toggle = page.locator(
      '[role="switch"], input[type="checkbox"], button:has-text("Auto-Pilot")',
    );
    await expect(toggle.first()).toBeVisible({ timeout: 10000 });
  });

  test('four stat cards are visible', async () => {
    const cards = [
      /test coverage/i,
      /self-healing/i,
      /generated cases/i,
      /security score/i,
    ];
    for (const label of cards) {
      await expect(
        page.getByText(label).first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('Global Execution Map section is visible', async () => {
    const main = page.locator('main, [role="main"]').first();
    await expect(
      main.getByText(/global execution map/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Web, Mobile, and API filter tabs are present', async () => {
    const mapSection = page.locator('main, [role="main"]').first().locator('section, div').filter({
      has: page.locator('text=/global execution map/i'),
    }).first();
    for (const label of ['Web', 'Mobile', 'API']) {
      await expect(mapSection.getByText(new RegExp(`^${label}$`, 'i')).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('LIVE FEED section is visible', async () => {
    const main = page.locator('main, [role="main"]').first();
    await expect(
      main.getByText(/live feed/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('View All Activity button is visible', async () => {
    await expect(
      page.getByText(/view all activity/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('MCP / Tool Ecosystem section is visible', async () => {
    // Dashboard has "TOOL ECOSYSTEM (MCP)" heading
    const main = page.locator('main, [role="main"]').first();
    await expect(
      main.getByText(/tool ecosystem|mcp ecosystem/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Refresh Tools button is clickable', async () => {
    const btn = page.getByRole('button', { name: /refresh tools/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
  });

  test('MCP tool card JIRA_SYNC is visible', async () => {
    await expect(
      page.getByText(/jira_sync/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('MCP tool card GITHUB_ANALYZER is visible', async () => {
    await expect(
      page.getByText(/github_analyzer/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
