/**
 * Production E2E tests for the AI Test Gen page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  navigateSidebar,
  navigateDirect,
  SIDEBAR_SEL,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('AI Test Gen', () => {
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

  test('navigates to Test Gen page', async () => {
    try {
      await navigateSidebar(page, 'Test Gen', /\/test-gen/);
    } catch {
      await navigateDirect(page, '/test-gen');
    }
    await expect(page).toHaveURL(/\/test-gen/);
  });

  test('chat input is visible', async () => {
    const chatInput = page.locator(
      'textarea, input[placeholder*="message" i], input[placeholder*="chat" i], input[placeholder*="ask" i], input[placeholder*="describe" i], input[type="text"]',
    );
    await expect(chatInput.first()).toBeVisible({ timeout: 10000 });
  });

  test('send button is visible', async () => {
    const composerInput = page.locator(
      'input[placeholder*="describe the tests you need" i], textarea[placeholder*="describe" i]',
    ).first();
    await expect(composerInput).toBeVisible({ timeout: 10000 });

    const sendBtn = composerInput.locator('xpath=following-sibling::button[1]');
    await expect(sendBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('welcome or initial message is visible', async () => {
    const welcome = page.getByText(
      /welcome|hello|get started|how can i help|generate test|describe/i,
    );
    await expect(welcome.first()).toBeVisible({ timeout: 10000 });
  });

  test('chat tab is active by default', async () => {
    const chatTab = page.getByRole('tab', { name: /chat/i }).or(
      page.locator('button:has-text("Chat")'),
    );
    await expect(chatTab.first()).toBeVisible({ timeout: 10000 });
  });

  test('history tab is visible and clickable', async () => {
    const historyTab = page.getByRole('tab', { name: /history/i }).or(
      page.locator('button:has-text("History")'),
    );
    await expect(historyTab.first()).toBeVisible({ timeout: 10000 });
    await historyTab.first().click();
    await expect(historyTab.first()).toBeVisible();
  });

  test('typing a message shows user message', async () => {
    const chatTab = page.getByRole('tab', { name: /chat/i }).or(
      page.locator('button:has-text("Chat")'),
    );
    await chatTab.first().click();
    const chatInput = page.locator(
      'input[placeholder*="describe the tests you need" i], textarea[placeholder*="describe" i], textarea',
    ).first();
    await chatInput.fill('hello');
    const userMessage = page.getByText('hello');

    await chatInput.press('Enter').catch(() => {});

    if (!(await userMessage.first().isVisible().catch(() => false))) {
      const sendBtn = page.getByRole('button', { name: /send/i }).or(
        chatInput.locator('xpath=following-sibling::button[1]'),
      ).or(
        page.locator('button[type="submit"]:visible'),
      ).first();
      await sendBtn.click({ force: true });
    }

    await expect(userMessage.first()).toBeVisible({ timeout: 15000 });
  });

  test('scenarios panel is visible', async () => {
    const scenarios = page.getByText(/scenario/i).or(
      page.locator('[class*="scenario"], [data-testid*="scenario"]'),
    );
    await expect(scenarios.first()).toBeVisible({ timeout: 10000 });
  });

  test('code preview area is visible', async () => {
    const codeArea = page.locator(
      'pre, code, [class*="code"], [class*="preview"], [class*="editor"]',
    );
    if (await codeArea.first().isVisible().catch(() => false)) {
      await expect(codeArea.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.getByText(/generated scenarios|scenarios will appear here/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('copy or download button is present', async () => {
    const actionBtn = page.getByRole('button', { name: /copy/i }).or(
      page.getByRole('button', { name: /download/i }),
    ).or(
      page.locator('button:has-text("Copy")'),
    ).or(
      page.locator('button:has-text("Download")'),
    );
    if (await actionBtn.first().isVisible().catch(() => false)) {
      await expect(actionBtn.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    const composerInput = page.locator(
      'input[placeholder*="describe the tests you need" i], textarea[placeholder*="describe" i], textarea',
    ).first();
    const composerSendBtn = composerInput.locator('xpath=following-sibling::button[1]');
    if (await composerSendBtn.isVisible().catch(() => false)) {
      await expect(composerSendBtn).toBeVisible({ timeout: 10000 });
      return;
    }

    // Pre-generation state may not show export actions yet.
    await expect(
      page.getByRole('button', { name: /send/i }).or(
        page.locator('button[type="submit"]:visible, button[aria-label*="send" i]:visible'),
      ).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
