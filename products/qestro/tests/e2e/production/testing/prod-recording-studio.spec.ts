/**
 * Production E2E tests for the Recording Studio page.
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

test.describe.serial('Recording Studio', () => {
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

  test('navigates to Recording Studio via sidebar', async () => {
    await navigateSidebar(page, 'Recording Studio', /\/recording-studio/);
    await expect(page).toHaveURL(/\/recording-studio/);
  });

  test('stat cards are visible', async () => {
    const statCards = page.locator(
      '[class*="stat"], [class*="card"], [class*="metric"]',
    ).filter({ has: page.locator('text=/\\d+/') });
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('New Recording toggle or button is visible', async () => {
    const newRecording = page.getByRole('button', { name: /new recording/i }).or(
      page.locator('button:has-text("New Recording")'),
    ).or(page.getByText(/new recording/i));
    await expect(newRecording.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking toggle expands recording form', async () => {
    const toggle = page.getByRole('button', { name: /new recording/i }).or(
      page.locator('button:has-text("New Recording")'),
    );
    await toggle.first().click();
    // RecordingStudio uses a motion.div with ai-glass-card class (not a <form> element)
    const form = page.locator(
      'form, [class*="form"], [class*="expanded"], [class*="panel"], [class*="glass"], [class*="card"]',
    ).filter({ has: page.locator('input') });
    await expect(form.first()).toBeVisible({ timeout: 10000 });
  });

  test('URL input is visible in form', async () => {
    const urlInput = page.locator(
      'input[placeholder*="url" i], input[placeholder*="URL"], input[type="url"]',
    );
    await expect(urlInput.first()).toBeVisible({ timeout: 10000 });
  });

  test('name input is visible in form', async () => {
    // RecordingStudio name input has placeholder "e.g. Checkout Flow"
    const nameInput = page.locator(
      'input[placeholder*="name" i], input[placeholder*="title" i], input[placeholder*="Checkout" i], input[type="text"]',
    ).first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
  });

  test('framework toggle is visible', async () => {
    const frameworkToggle = page.getByText(/playwright/i).or(
      page.getByText(/cypress/i),
    );
    await expect(frameworkToggle.first()).toBeVisible({ timeout: 10000 });
  });

  test('viewport buttons are visible', async () => {
    const viewports = ['Desktop', 'Tablet', 'Mobile'];
    for (const vp of viewports) {
      const btn = page.getByRole('button', { name: new RegExp(vp, 'i') }).or(
        page.getByText(new RegExp(vp, 'i')),
      );
      await expect(btn.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('Start Recording button is visible', async () => {
    const btn = page.getByRole('button', { name: /start recording/i }).or(
      page.locator('button:has-text("Start Recording")'),
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('completed sessions grid or list is visible', async () => {
    const sessions = page.locator(
      '[class*="grid"], [class*="list"], table, [class*="session"]',
    ).or(page.getByText(/completed|recent|history|sessions/i));
    await expect(sessions.first()).toBeVisible({ timeout: 10000 });
  });
});
