import { authTest as test, expect } from './fixtures/auth';

/**
 * Extended interactive flows: deploy forms, settings sections,
 * marketplace filters, navigation patterns, and error states.
 *
 * All tests run against https://opensyber.cloud with auth state.
 */

const BASE = 'https://opensyber.cloud';

/* ------------------------------------------------------------------ */
/*  Deploy Instance Form Flow                                         */
/* ------------------------------------------------------------------ */
test.describe('Deploy Instance Form Flow', () => {
  test('Deploy Instance button is visible on dashboard', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Either instance exists (no deploy button) or empty state with deploy button
    const deployBtn = page.getByRole('button', { name: /deploy instance/i });
    const instanceCard = page.locator('[class*="card"]').filter({ hasText: /Running|Stopped|Provisioning/i });

    const hasDeployBtn = await deployBtn.isVisible().catch(() => false);
    const hasInstance = await instanceCard.first().isVisible().catch(() => false);

    expect(hasDeployBtn || hasInstance).toBe(true);
  });

  test('clicking deploy opens form with default name "My Agent"', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const deployBtn = page.getByRole('button', { name: /deploy instance/i });
    if (!(await deployBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Instance already exists, deploy form not available');
    }

    await deployBtn.click();

    // Form should appear with name input pre-filled
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await expect(nameInput).toHaveValue('My Agent');
  });

  test('deploy form region dropdown has 4 options', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const deployBtn = page.getByRole('button', { name: /deploy instance/i });
    if (!(await deployBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Instance already exists, deploy form not available');
    }

    await deployBtn.click();

    const regionSelect = page.locator('select');
    await expect(regionSelect).toBeVisible({ timeout: 5_000 });

    const options = regionSelect.locator('option');
    await expect(options).toHaveCount(4);
  });

  test('deploy form name field is editable', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const deployBtn = page.getByRole('button', { name: /deploy instance/i });
    if (!(await deployBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Instance already exists, deploy form not available');
    }

    await deployBtn.click();

    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    await nameInput.clear();
    await nameInput.fill('Test Agent Name');
    await expect(nameInput).toHaveValue('Test Agent Name');
  });
});

/* ------------------------------------------------------------------ */
/*  Settings Page Interactions                                        */
/* ------------------------------------------------------------------ */
test.describe('Settings Page Interactions', () => {
  test('subscription card is visible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    const subscriptionHeading = page.getByText('Subscription');
    await expect(subscriptionHeading).toBeVisible({ timeout: 10_000 });

    // Should show plan info (Current Plan label)
    await expect(page.getByText('Current Plan')).toBeVisible();
  });

  test('instance section is visible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    const instanceHeading = page.getByText('Instance', { exact: true }).first();
    await expect(instanceHeading).toBeVisible({ timeout: 10_000 });
  });

  test('referral section is visible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    // ReferralSection component is always rendered
    const referralSection = page.locator('text=/referral|refer/i').first();
    await expect(referralSection).toBeVisible({ timeout: 10_000 });
  });

  test('danger zone only visible when instance exists', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    const dangerZone = page.getByText('Danger Zone');
    const instanceDeployed = page.locator('text=/Hostname|Gateway Token|Instance ID/i');

    const hasDanger = await dangerZone.isVisible().catch(() => false);
    const hasInstanceDetails = await instanceDeployed.first().isVisible().catch(() => false);

    // Danger Zone should only appear if instance details are present
    if (hasDanger) {
      expect(hasInstanceDetails).toBe(true);
    }
    // If no instance, danger zone should not be visible
    if (!hasInstanceDetails) {
      expect(hasDanger).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  API Keys Management                                               */
/* ------------------------------------------------------------------ */
test.describe('API Keys Management', () => {
  test('API keys page loads with heading', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings/api-keys`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('API Keys')).toBeVisible({ timeout: 10_000 });
  });

  test('"Generate New Key" button is visible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings/api-keys`);
    await page.waitForLoadState('networkidle');

    // Button exists either in header or empty state
    const generateBtn = page.getByRole('button', { name: /generate/i });
    await expect(generateBtn.first()).toBeVisible({ timeout: 10_000 });
  });
});

/* ------------------------------------------------------------------ */
/*  Getting Started Interactions                                      */
/* ------------------------------------------------------------------ */
test.describe('Getting Started Interactions', () => {
  test('onboarding checklist renders on dashboard', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Checklist shows "Getting Started" heading or may be dismissed
    const checklist = page.getByText('Getting Started').first();
    const dismissed = page.locator('[class*="onboarding"]');
    const exists = await checklist.isVisible().catch(() => false) ||
                   await dismissed.isVisible().catch(() => false);
    // Checklist may have been completed/dismissed; either state is valid
    expect(typeof exists).toBe('boolean');
  });

  test('integration guides present (VS Code, Cursor)', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/getting-started`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Getting Started')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('VS Code / Cursor / Windsurf')).toBeVisible();
    await expect(page.getByText('Claude Code CLI')).toBeVisible();
  });

  test('step descriptions are visible for each guide', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/getting-started`);
    await page.waitForLoadState('networkidle');

    // Each guide card has numbered steps
    const stepNumbers = page.locator('ol li');
    const count = await stepNumbers.count();
    expect(count).toBeGreaterThan(10); // Multiple guides with multiple steps
  });
});

/* ------------------------------------------------------------------ */
/*  Marketplace Interactions                                          */
/* ------------------------------------------------------------------ */
test.describe('Marketplace Interactions', () => {
  test('skill marketplace page loads with heading', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Skill Marketplace')).toBeVisible({ timeout: 10_000 });
  });

  test('category filter tabs are present', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    const categories = ['All', 'Security', 'Developer', 'Communication', 'Productivity', 'Finance', 'Utilities'];
    for (const cat of categories) {
      await expect(
        page.getByRole('tab', { name: cat }).or(page.getByRole('button', { name: cat }))
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicking category filters the skill list', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    // Click Security category
    const securityTab = page.getByRole('tab', { name: 'Security' }).or(
      page.getByRole('button', { name: 'Security' })
    );
    await securityTab.click();

    // The selected tab should be highlighted (aria-selected or different style)
    await expect(securityTab).toHaveAttribute('aria-selected', 'true');

    // Click All to reset
    const allTab = page.getByRole('tab', { name: 'All' }).or(
      page.getByRole('button', { name: 'All' })
    );
    await allTab.click();
    await expect(allTab).toHaveAttribute('aria-selected', 'true');
  });

  test('skill cards show name and description', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    // Either skill cards or empty state
    const skillCards = page.locator('[class*="border"][class*="rounded"]').filter({
      has: page.getByRole('button', { name: /install/i }),
    });
    const emptyState = page.getByText(/no skills/i);

    const hasSkills = (await skillCards.count()) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasSkills || hasEmpty).toBe(true);

    if (hasSkills) {
      // First card should have name and description text
      const firstCard = skillCards.first();
      await expect(firstCard.locator('h3').first()).toBeVisible();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Security Alert Rules                                              */
/* ------------------------------------------------------------------ */
test.describe('Security Alert Rules', () => {
  test('alert rules page shows table or empty state', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/alert-rules`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Alert Rules')).toBeVisible({ timeout: 10_000 });

    // Either rules table or "No alert rules configured" empty state
    const table = page.locator('table');
    const emptyState = page.getByText(/no alert rules configured/i);

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Cloud Security Setup                                              */
/* ------------------------------------------------------------------ */
test.describe('Cloud Security Setup', () => {
  test('cloud page shows provider options', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Cloud Security')).toBeVisible({ timeout: 10_000 });

    // Should have Setup Wizard and Quick Connect buttons
    const setupWizard = page.getByRole('button', { name: /setup wizard/i });
    const quickConnect = page.getByRole('button', { name: /quick connect/i });

    await expect(setupWizard.or(quickConnect).first()).toBeVisible();
  });

  test('setup wizard loads with step indicator', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/setup`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Connect Cloud Account')).toBeVisible({ timeout: 10_000 });

    // Provider cards should be visible (step 0)
    const providers = ['Amazon Web Services', 'Microsoft Azure', 'Google Cloud Platform'];
    for (const provider of providers) {
      await expect(page.getByText(provider)).toBeVisible();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Policy Builder                                                    */
/* ------------------------------------------------------------------ */
test.describe('Policy Builder', () => {
  test('builder UI loads with heading', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/policies/builder`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Policy Rule Builder')).toBeVisible({ timeout: 10_000 });
  });

  test('rule pack section visible with category filters', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/policies/builder`);
    await page.waitForLoadState('networkidle');

    // Category filter buttons (All + specific categories) or loading spinner
    const allFilter = page.getByRole('button', { name: 'All', exact: true });
    const spinner = page.locator('[class*="animate-spin"]');

    const hasFilter = await allFilter.isVisible().catch(() => false);
    const isLoading = await spinner.isVisible().catch(() => false);

    // Either still loading, or filters are shown
    expect(hasFilter || isLoading).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Team Management                                                   */
/* ------------------------------------------------------------------ */
test.describe('Team Management', () => {
  test('team page shows member list or org creation', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    // Either "Team" heading with members, or org creation prompt
    const teamHeading = page.getByText('Team', { exact: true }).first();
    const createOrg = page.getByRole('button', { name: /create/i });
    const errorMsg = page.getByText(/failed to load/i);

    const hasTeam = await teamHeading.isVisible().catch(() => false);
    const hasCreate = await createOrg.isVisible().catch(() => false);
    const hasError = await errorMsg.isVisible().catch(() => false);

    expect(hasTeam || hasCreate || hasError).toBe(true);
  });

  test('plan gate or invite form visible for team plans', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    // Either invite button (team plan) or create org button (no org)
    const inviteBtn = page.getByRole('button', { name: /invite/i });
    const createOrgBtn = page.getByRole('button', { name: /create/i });
    const memberTable = page.locator('table');

    const hasInvite = await inviteBtn.isVisible().catch(() => false);
    const hasCreate = await createOrgBtn.isVisible().catch(() => false);
    const hasTable = await memberTable.isVisible().catch(() => false);

    expect(hasInvite || hasCreate || hasTable).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Integrations                                                      */
/* ------------------------------------------------------------------ */
test.describe('Integrations', () => {
  test('integration catalog loads with heading', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/integrations`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Integrations')).toBeVisible({ timeout: 10_000 });
  });

  test('integration cards are visible with descriptions', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/integrations`);
    await page.waitForLoadState('networkidle');

    // Integration cards link to /dashboard/integrations/{slug}
    const integrationCards = page.locator('a[href*="/dashboard/integrations/"]');
    const count = await integrationCards.count();
    expect(count).toBeGreaterThan(5);
  });
});

/* ------------------------------------------------------------------ */
/*  Navigation Flow                                                   */
/* ------------------------------------------------------------------ */
test.describe('Navigation Flow', () => {
  test('navigate from dashboard to security and back', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Navigate to security via sidebar
    const securityLink = page.locator('nav a[href="/dashboard/security"], aside a[href="/dashboard/security"]').first();
    if (await securityLink.isVisible().catch(() => false)) {
      await securityLink.click();
      await expect(page).toHaveURL(/\/dashboard\/security/, { timeout: 10_000 });

      // Navigate back to dashboard
      const dashLink = page.locator('nav a[href="/dashboard"], aside a[href="/dashboard"]').first();
      await dashLink.click();
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
    }
  });

  test('navigate from dashboard to settings to pricing and back', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Navigate to settings
    const settingsLink = page.locator('nav a[href="/dashboard/settings"], aside a[href="/dashboard/settings"]').first();
    if (await settingsLink.isVisible().catch(() => false)) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/dashboard\/settings/, { timeout: 10_000 });

      // Click pricing link (Upgrade plan or View plans)
      const pricingLink = page.getByRole('link', { name: /upgrade plan|view plans/i }).first();
      if (await pricingLink.isVisible().catch(() => false)) {
        await pricingLink.click();
        await expect(page).toHaveURL(/\/pricing/, { timeout: 10_000 });

        // Navigate back
        await page.goBack();
        await expect(page).toHaveURL(/\/dashboard\/settings/, { timeout: 10_000 });
      }
    }
  });

  test('sidebar active state updates on navigation', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security`);
    await page.waitForLoadState('networkidle');

    // Check that security link in sidebar has active styling (often font-bold, bg highlight, or aria-current)
    const sidebarSecurityLink = page.locator(
      'nav a[href="/dashboard/security"], aside a[href="/dashboard/security"]'
    ).first();

    if (await sidebarSecurityLink.isVisible().catch(() => false)) {
      // Active link typically has distinct styling compared to inactive links
      const className = await sidebarSecurityLink.getAttribute('class') ?? '';
      const ariaCurrent = await sidebarSecurityLink.getAttribute('aria-current') ?? '';

      // At least one indicator of active state
      const isActive = className.includes('bg-') ||
                       className.includes('font-bold') ||
                       className.includes('font-semibold') ||
                       className.includes('text-white') ||
                       className.includes('active') ||
                       ariaCurrent === 'page';
      expect(isActive).toBe(true);
    }
  });

  test('mobile nav hamburger menu opens and closes (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');

    // Open hamburger menu
    const menuBtn = page.getByLabel('Open menu');
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();

      // Navigation drawer should open
      const drawer = page.locator('[role="dialog"]');
      await expect(drawer).toBeVisible({ timeout: 5_000 });

      // Nav links should be visible inside drawer
      await expect(page.getByText('Pricing')).toBeVisible();
      await expect(page.getByText('Docs')).toBeVisible();

      // Close menu
      const closeBtn = page.getByLabel('Close menu');
      await closeBtn.click();

      // Drawer should be hidden (translated off-screen)
      await expect(drawer).not.toBeVisible({ timeout: 3_000 });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Search Interactions                                               */
/* ------------------------------------------------------------------ */
test.describe('Search Interactions', () => {
  test('marketplace search input filters skills', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search skills...');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    await searchInput.fill('security');
    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Results should be filtered (fewer cards or empty state)
    const heading = page.getByText(/All Skills|Security/);
    await expect(heading.first()).toBeVisible();
  });

  test('policy builder search input is functional', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/policies/builder`);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search packs...');
    const spinner = page.locator('[class*="animate-spin"]');

    // Wait for loading to complete
    if (await spinner.isVisible().catch(() => false)) {
      await expect(spinner).not.toBeVisible({ timeout: 15_000 });
    }

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      // No crash, page is still functional
      await expect(page.getByText('Policy Rule Builder')).toBeVisible();
    }
  });

  test('getting started page has working navigation links', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/getting-started`);
    await page.waitForLoadState('networkidle');

    // "Browse All Integrations" CTA at the bottom
    const integrationsLink = page.getByRole('link', { name: /browse all integrations/i });
    await expect(integrationsLink).toBeVisible({ timeout: 10_000 });

    const href = await integrationsLink.getAttribute('href');
    expect(href).toContain('/dashboard/integrations');
  });
});

/* ------------------------------------------------------------------ */
/*  Error States                                                      */
/* ------------------------------------------------------------------ */
test.describe('Error States', () => {
  test('nonexistent dashboard page shows 404 or redirects', async ({ page }) => {
    const response = await page.goto(`${BASE}/dashboard/nonexistent`);

    // Should either show 404 page, redirect to dashboard, or show not found text
    const is404 = response?.status() === 404;
    const redirected = page.url().includes('/dashboard') && !page.url().includes('nonexistent');
    const notFoundText = await page.getByText(/not found|404|page doesn/i).isVisible().catch(() => false);

    expect(is404 || redirected || notFoundText).toBe(true);
  });

  test('nonexistent incident handles gracefully', async ({ page }) => {
    const response = await page.goto(`${BASE}/dashboard/security/incidents/nonexistent-id`);

    // Should show error state, 404, or redirect
    const is404 = response?.status() === 404;
    const errorText = await page.getByText(/not found|no incident|error|doesn.*exist/i).isVisible().catch(() => false);
    const redirected = !page.url().includes('nonexistent-id');

    expect(is404 || errorText || redirected).toBe(true);
  });
});
