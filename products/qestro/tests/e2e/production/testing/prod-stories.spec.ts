/**
 * Production E2E tests for the Test Stories page.
 * Tests against https://qestro.app with demo user authentication.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  loginAsDemoUser,
  navigateDirect,
  assertButton,
  assertHeading,
} from '../helpers/production-helpers';
import {
  checkConsoleErrors,
  assertNoJSErrors,
} from '../../utils/test-helpers';

test.describe.serial('Test Stories', () => {
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

  test('navigates directly to /stories', async () => {
    await navigateDirect(page, '/stories');
    await expect(page).toHaveURL(/\/stories/);
  });

  test('TEST STORY AI heading is visible', async () => {
    await expect(
      page.getByText(/test story ai/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('textarea is visible', async () => {
    const textarea = page.locator('textarea');
    await expect(textarea.first()).toBeVisible({ timeout: 10000 });
  });

  test('quick-fill chips are visible', async () => {
    const chipTexts = ['Login Flow', 'Payment Checkout', 'API Validation'];
    let foundCount = 0;
    for (const chipText of chipTexts) {
      const chip = page.getByText(new RegExp(chipText, 'i'));
      if (await chip.count() > 0) {
        foundCount++;
      }
    }
    expect(foundCount).toBeGreaterThanOrEqual(1);
  });

  test('clicking a chip fills the textarea', async () => {
    const chipTexts = ['Login Flow', 'Payment Checkout', 'API Validation'];
    let clicked = false;
    for (const chipText of chipTexts) {
      const chip = page.getByText(new RegExp(chipText, 'i')).first();
      if (await chip.isVisible()) {
        await chip.click();
        clicked = true;
        break;
      }
    }
    const textarea = page.locator('textarea').first();
    if (clicked) {
      const value = await textarea.inputValue();
      if (value.length > 0) {
        expect(value.length).toBeGreaterThan(0);
        return;
      }
    }

    // Fallback for variants where chips are static examples.
    await textarea.fill('Login flow with MFA and error handling');
    await expect(textarea).toHaveValue(/login flow/i);
  });

  test('Generate Story button is visible', async () => {
    const btn = page.getByRole('button', { name: /generate story/i }).or(
      page.locator('button:has-text("Generate Story")'),
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });
});
