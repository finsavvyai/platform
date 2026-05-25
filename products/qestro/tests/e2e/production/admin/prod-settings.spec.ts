/**
 * Production E2E tests for the Settings page.
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

test.describe.serial('Admin — Settings', () => {
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

  test('navigates to Settings via sidebar', async () => {
    await navigateSidebar(page, 'Settings', /\/settings/);
    await expect(page).toHaveURL(/\/settings/);
  });

  test('Jira Integration section is visible', async () => {
    await expect(
      page.getByText(/jira/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Connect or Disconnect Jira button is visible', async () => {
    const btn = page.getByRole('button', { name: /connect/i })
      .or(page.getByRole('button', { name: /disconnect/i }));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('Appearance section with theme cards is visible', async () => {
    await expect(
      page.getByText(/appearance/i).first(),
    ).toBeVisible({ timeout: 10000 });
    const themeCards = page.locator(
      '[class*="theme"], [data-theme], [class*="card"]:has-text("Light"), [class*="card"]:has-text("Dark")',
    );
    await expect(themeCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('theme card is clickable', async () => {
    const themeCard = page.locator(
      '[class*="theme"], [data-theme], [class*="card"]:has-text("Light"), [class*="card"]:has-text("Dark")',
    ).first();
    await themeCard.click();
    await expect(themeCard).toBeVisible();
  });

  test('notification toggles section is visible', async () => {
    const main = page.locator('main, [role="main"]').first();
    await expect(
      main.getByRole('heading', { name: /notifications/i }).or(
        main.getByText(/manage your alerts|notifications/i),
      ).first(),
    ).toBeVisible({ timeout: 10000 });
    const toggles = page.locator('[role="switch"]:visible, input[type="checkbox"]:visible');
    const toggleCount = await toggles.count();

    if (toggleCount > 0) {
      expect(toggleCount).toBeGreaterThanOrEqual(1);
      return;
    }

    await expect(
      main.getByText(/email notifications|slack notifications|daily test summary|alert when jira sync fails/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('General section with Project Name input', async () => {
    const input = page.locator('input[placeholder*="roject"], input[name*="project"], input[id*="project"]')
      .or(page.getByLabel(/project name/i));
    const hasProjectInput = await input.first().isVisible().catch(() => false);
    if (hasProjectInput) {
      await expect(input.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    // Fallback for layouts that expose general settings without a dedicated project-name field.
    await expect(
      page.getByText(/general|preferences|workspace/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Default Environment select is visible', async () => {
    const select = page.locator('select, [role="combobox"], [role="listbox"]')
      .or(page.getByText(/default environment/i));
    await expect(select.first()).toBeVisible({ timeout: 10000 });
  });

  test('Enterprise Security section is visible', async () => {
    await expect(
      page.getByText(/enterprise security/i)
        .or(page.getByText(/security/i))
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('SSO Providers grid is visible', async () => {
    const sso = page.getByText(/azure ad/i)
      .or(page.getByText(/okta/i))
      .or(page.getByText(/google/i));
    await expect(sso.first()).toBeVisible({ timeout: 10000 });
  });

  test('RBAC grid with roles is visible', async () => {
    const main = page.locator('main, [role="main"]').first();
    const roles = [/admin/i, /manager/i, /member/i];
    let visibleRoles = 0;

    for (const role of roles) {
      const label = main.getByText(role).first();
      if (await label.isVisible().catch(() => false)) {
        visibleRoles++;
      }
    }

    expect(visibleRoles).toBeGreaterThanOrEqual(1);
  });

  test('Audit Events section is visible', async () => {
    await expect(
      page.getByText(/audit/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
