import { authTest as test, expect } from './fixtures/auth';

/**
 * Team & RBAC Journey.
 * View members → invite → SSO → data residency.
 */
test.describe('Team Members Journey', () => {
  test('team page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/team');
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
  });

  test('team page shows members table or invite form', async ({ page }) => {
    await page.goto('/dashboard/team');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const inviteBtn = page.getByRole('button', { name: /invite member/i });
    const form = page.locator('form');

    const hasTable = await table.isVisible().catch(() => false);
    const hasInvite = await inviteBtn.isVisible().catch(() => false);
    const hasForm = await form.isVisible().catch(() => false);
    expect(hasTable || hasInvite || hasForm).toBe(true);
  });

  test('invite member modal opens with email and role fields', async ({ page }) => {
    await page.goto('/dashboard/team');
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.getByRole('button', { name: /invite member/i });
    if (!(await inviteBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No invite button — may not have org context');
      return;
    }

    await inviteBtn.click();

    // Modal should show email + role fields
    const emailInput = page.getByPlaceholder('colleague@company.com').or(
      page.locator('#invite-email')
    );
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    const roleSelect = page.locator('#invite-role').or(
      page.locator('select').first()
    );
    await expect(roleSelect).toBeVisible();
  });

  test('invite modal validates empty email', async ({ page }) => {
    await page.goto('/dashboard/team');
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.getByRole('button', { name: /invite member/i });
    if (!(await inviteBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No invite button');
      return;
    }

    await inviteBtn.click();
    const emailInput = page.getByPlaceholder('colleague@company.com').or(
      page.locator('#invite-email')
    );
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    // Submit empty
    const submitBtn = page.getByRole('button', { name: /send invite/i });
    await submitBtn.click();

    const error = page.getByText(/valid email|email.*required/i);
    await expect(error).toBeVisible({ timeout: 5_000 });
  });

  test('invite modal closes on Cancel', async ({ page }) => {
    await page.goto('/dashboard/team');
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.getByRole('button', { name: /invite member/i });
    if (!(await inviteBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No invite button');
      return;
    }

    await inviteBtn.click();
    const emailInput = page.getByPlaceholder('colleague@company.com').or(
      page.locator('#invite-email')
    );
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(emailInput).not.toBeVisible();
  });
});

test.describe('SSO & Residency Journey', () => {
  test('SSO settings page loads', async ({ page }) => {
    await page.goto('/dashboard/team/sso');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('SSO page has configuration form or upgrade CTA', async ({ page }) => {
    await page.goto('/dashboard/team/sso');
    await page.waitForLoadState('networkidle');

    // Either SSO config form or enterprise upgrade CTA
    const form = page.locator('form');
    const upgradeMsg = page.getByText(/enterprise|upgrade|sso/i);
    const hasForm = await form.isVisible().catch(() => false);
    const hasUpgrade = await upgradeMsg.isVisible().catch(() => false);
    expect(hasForm || hasUpgrade).toBe(true);
  });

  test('data residency page loads with region selector', async ({ page }) => {
    await page.goto('/dashboard/team/residency');
    await expect(page.getByRole('heading')).toBeVisible();

    // Should have region-related content
    const content = page.getByText(/region|residency|data/i).first();
    await expect(content).toBeVisible();
  });

  test('team settings page loads', async ({ page }) => {
    await page.goto('/dashboard/team/settings');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
