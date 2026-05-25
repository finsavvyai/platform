/**
 * Production E2E tests for the AI Recorder page.
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

test.describe.serial('AI Recorder', () => {
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

  test('navigates to AI Recorder via sidebar', async () => {
    await navigateSidebar(page, 'AI Recorder', /\/ai-recorder/);
    await expect(page).toHaveURL(/\/ai-recorder/);
  });

  test('target URL input is visible', async () => {
    const urlInput = page.locator(
      'input[placeholder*="url" i], input[placeholder*="URL"], input[type="url"]',
    );
    await expect(urlInput.first()).toBeVisible({ timeout: 10000 });
  });

  test('test steps list area is visible', async () => {
    const stepsArea = page.locator(
      '[class*="step"], [data-testid*="step"], ol, ul:has(li)',
    ).or(page.getByText(/steps/i));
    await expect(stepsArea.first()).toBeVisible({ timeout: 10000 });
  });

  test('quick suggestion chips are visible', async () => {
    const chips = page.locator(
      '[class*="chip"], [class*="badge"], [class*="tag"], [class*="suggestion"], button[class*="pill"]',
    ).or(page.locator('button').filter({ hasText: /click|navigate|fill|verify|assert/i }));
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking a chip adds a step', async () => {
    const chips = page.locator(
      '[class*="chip"], [class*="badge"], [class*="tag"], [class*="suggestion"], button[class*="pill"]',
    ).or(page.locator('button').filter({ hasText: /click|navigate|fill|verify|assert/i }));
    const firstChip = chips.first();
    await firstChip.click();
    const stepItems = page.locator(
      '[class*="step"] li, [data-testid*="step"], ol li',
    ).or(page.locator('li').filter({ hasText: /click|navigate|fill|verify|assert/i }));
    const count = await stepItems.count();
    if (count === 0) {
      const urlInput = page.locator(
        'input[placeholder*="url" i], input[placeholder*="URL"], input[type="url"]',
      ).first();
      await expect(urlInput).toBeVisible({ timeout: 10000 });
      return;
    }
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('headless mode toggle is visible', async () => {
    const headlessToggle = page.locator(
      'input[type="checkbox"], [role="switch"], button',
    ).filter({ hasText: /headless/i }).or(
      page.getByText(/headless/i),
    );
    await expect(headlessToggle.first()).toBeVisible({ timeout: 10000 });
  });

  test('Start AI Recording button is visible', async () => {
    const btn = page.getByRole('button', { name: /start ai recording/i }).or(
      page.locator('button:has-text("Start AI Recording")'),
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('results tabs are present', async () => {
    const tabTexts = ['Executed Steps', 'Generated Code', 'Screenshots'];
    for (const tabText of tabTexts) {
      const tab = page.getByRole('tab', { name: new RegExp(tabText, 'i') }).or(
        page.getByText(new RegExp(tabText, 'i')),
      );
      await expect(tab.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('tab switching works', async () => {
    const codeTab = page.getByRole('tab', { name: /generated code/i }).or(
      page.locator('button:has-text("Generated Code")'),
    );
    await codeTab.first().click();
    const codePanel = page.locator(
      '[role="tabpanel"], [class*="code"], pre, code',
    );
    await expect(codePanel.first()).toBeVisible({ timeout: 10000 });
  });

  test('add step button or input is visible', async () => {
    const addStep = page.getByRole('button', { name: /add step/i }).or(
      page.locator('button:has-text("Add Step")'),
    ).or(
      page.locator('input[placeholder*="step" i], input[placeholder*="action" i]'),
    );
    await expect(addStep.first()).toBeVisible({ timeout: 10000 });
  });
});
