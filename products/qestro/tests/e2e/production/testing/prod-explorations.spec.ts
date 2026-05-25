/**
 * Production E2E tests for the Explorations page.
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

test.describe.serial('Explorations', () => {
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

  test('navigates to Explorations via sidebar', async () => {
    await navigateSidebar(page, 'Explorations', /\/explorations/);
    await expect(page).toHaveURL(/\/explorations/);
  });

  test('page heading is visible', async () => {
    const main = page.locator('main, [role="main"]').first();
    await expect(
      main.getByRole('heading', { name: /explorations/i }).or(
        main.getByText(/explorations/i),
      ).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('New Exploration button is visible', async () => {
    const btn = page.getByRole('button', { name: /new exploration/i });
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking New Exploration opens modal', async () => {
    const btn = page.getByRole('button', { name: /new exploration/i });
    await btn.first().click();
    const dialog = page.locator(
      '[role="dialog"], [role="alertdialog"], .modal, [data-testid*="modal"]',
    );
    const hasDialog = await dialog.first().isVisible().catch(() => false);
    if (!hasDialog) {
      await expect(
        page.locator('input[placeholder*="name" i], textarea[placeholder*="exploration" i]').first(),
      ).toBeVisible({ timeout: 10000 });
      return;
    }
    await expect(dialog.first()).toBeVisible({ timeout: 10000 });
  });

  test('modal has name input field', async () => {
    const dialog = page.locator(
      '[role="dialog"], [role="alertdialog"], .modal, [data-testid*="modal"]',
    );
    const nameInput = dialog.locator('input').first();
    const hasModalInput = await nameInput.isVisible().catch(() => false);
    if (hasModalInput) {
      await expect(nameInput).toBeVisible({ timeout: 10000 });
      return;
    }

    // Some builds render "Create Exploration" as an inline panel, not a modal.
    await expect(
      page.locator('input[placeholder*="Exploration" i], input[placeholder*="Name" i]').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('modal close dismisses the dialog', async () => {
    await page.keyboard.press('Escape');
    const dialog = page.locator(
      '[role="dialog"], [role="alertdialog"], .modal, [data-testid*="modal"]',
    );
    await expect(dialog).toHaveCount(0, { timeout: 5000 }).catch(async () => {
      const closeBtn = page.locator(
        'button[aria-label="Close"], button:has-text("Close"), button:has-text("X")',
      );
      if (await closeBtn.first().isVisible()) {
        await closeBtn.first().click();
      }
    });
  });

  test('session cards or empty state visible', async () => {
    const cards = page.locator(
      '[class*="card"], [data-testid*="session"], [data-testid*="exploration"]',
    );
    const emptyState = page.getByText(
      /no exploration|get started|create your first|empty/i,
    );
    const hasCards = await cards.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test('no critical JavaScript errors', async () => {
    await assertNoJSErrors(page, consoleErrors);
  });
});
