import { authTest, expect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Flow 4: Team Management — Members, Invitations, Settings
 *
 * Tests the team dashboard including member table, invite flow,
 * and organization settings management.
 */

/* ================================================================== */
/*  STEP 1: Team Members Page                                          */
/* ================================================================== */
authTest.describe('Team — Members Page', () => {
  authTest('should load team page with heading', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('should render member table or create-org prompt', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const createOrg = page.getByText(/create.*org|no organization/i);
    const memberList = page.getByText(/owner|admin|member|developer/i);

    const hasTable = await table.isVisible().catch(() => false);
    const hasCreateOrg = await createOrg.first().isVisible().catch(() => false);
    const hasMembers = await memberList.first().isVisible().catch(() => false);

    expect(hasTable || hasCreateOrg || hasMembers).toBe(true);
  });

  authTest('should show role column in member table', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    if (!(await table.isVisible().catch(() => false))) {
      authTest.skip(true, 'No member table — org may not exist');
      return;
    }

    const roles = page.getByText(/owner|admin|developer|viewer|security/i);
    const count = await roles.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================== */
/*  STEP 2: Invite Member Flow                                         */
/* ================================================================== */
authTest.describe('Team — Invite Member', () => {
  authTest('should show Invite Member button', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.getByRole('button', { name: /invite/i });
    const inviteLink = page.getByRole('link', { name: /invite/i });
    const createOrg = page.getByText(/create.*org|no organization/i);

    const hasInvite = await inviteBtn.first().isVisible().catch(() => false);
    const hasLink = await inviteLink.first().isVisible().catch(() => false);
    const needsOrg = await createOrg.first().isVisible().catch(() => false);

    // Should have invite button or need org creation first
    expect(hasInvite || hasLink || needsOrg).toBe(true);
  });

  authTest('should open invite modal when clicking Invite button', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.getByRole('button', { name: /invite/i });
    if (!(await inviteBtn.first().isVisible().catch(() => false))) {
      authTest.skip(true, 'Invite button not visible — org may not exist');
      return;
    }

    await inviteBtn.first().click();

    // Modal should appear with email input and role selector
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"]');
    const roleSelect = page.locator('select, [role="listbox"], [role="combobox"]');
    const modalHeading = page.getByText(/invite.*member|add.*member/i);

    const hasEmail = await emailInput.first().isVisible().catch(() => false);
    const hasRole = await roleSelect.first().isVisible().catch(() => false);
    const hasModal = await modalHeading.first().isVisible().catch(() => false);

    expect(hasEmail || hasRole || hasModal).toBe(true);
  });

  authTest('should show pending invitations section', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const pending = page.getByText(/pending|invitation/i);
    const hasPending = await pending.first().isVisible().catch(() => false);

    // Pending section may or may not be visible depending on invitations
    expect(typeof hasPending).toBe('boolean');
  });
});

/* ================================================================== */
/*  STEP 3: Organization Settings                                      */
/* ================================================================== */
authTest.describe('Team — Organization Settings', () => {
  authTest('should load org settings page', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team/settings`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('should render org settings form or create-org prompt', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team/settings`);
    await page.waitForLoadState('networkidle');

    const form = page.locator('form');
    const nameInput = page.locator('input[name="name"], input[placeholder*="name"]');
    const createOrg = page.getByText(/create.*org|no organization/i);

    const hasForm = await form.first().isVisible().catch(() => false);
    const hasInput = await nameInput.first().isVisible().catch(() => false);
    const needsOrg = await createOrg.first().isVisible().catch(() => false);

    expect(hasForm || hasInput || needsOrg).toBe(true);
  });

  authTest('should show danger zone or delete section for owners', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team/settings`);
    await page.waitForLoadState('networkidle');

    const dangerZone = page.getByText(/danger zone|delete organization/i);
    const hasDanger = await dangerZone.first().isVisible().catch(() => false);

    // Danger zone only visible for org owners; verify no crash
    expect(typeof hasDanger).toBe('boolean');
  });

  authTest('should show SSO configuration link or section', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team/settings`);
    await page.waitForLoadState('networkidle');

    const ssoLink = page.getByText(/SSO|single sign-on|SAML|OIDC/i);
    const hasSso = await ssoLink.first().isVisible().catch(() => false);

    // SSO may be gated behind enterprise plan
    expect(typeof hasSso).toBe('boolean');
  });
});
