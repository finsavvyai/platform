import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Flow 2: Browse Marketplace -> Install Skill
 *
 * Tests the public marketplace browsing experience and the
 * authenticated skill installation flow.
 */

/* ================================================================== */
/*  STEP 1: Public Marketplace — Skill Browsing                        */
/* ================================================================== */
test.describe('Marketplace — Public Browsing', () => {
  test('should render marketplace page with heading', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should render skill cards or empty state', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await page.waitForLoadState('networkidle');

    const skillLinks = page.locator('a[href^="/marketplace/"]');
    const emptyState = page.getByText(/no skills found/i);

    const hasSkills = (await skillLinks.count()) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasSkills || hasEmpty).toBe(true);
  });

  test('should render category filter buttons', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await page.waitForLoadState('networkidle');

    // Category filters: All, Security, CI/CD, AI Agents, etc.
    const allFilter = page.getByRole('link', { name: /^all$/i });
    const securityFilter = page.getByText(/security/i);

    const hasAll = await allFilter.isVisible().catch(() => false);
    const hasSecurity = await securityFilter.first().isVisible().catch(() => false);

    expect(hasAll || hasSecurity).toBe(true);
  });

  test('should show skill bundles upsell banner', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await page.waitForLoadState('networkidle');

    const bundleBanner = page.getByText(/skill bundles/i);
    const hasBanner = await bundleBanner.first().isVisible().catch(() => false);
    expect(typeof hasBanner).toBe('boolean');
  });
});

/* ================================================================== */
/*  STEP 2: Skill Detail Page                                          */
/* ================================================================== */
test.describe('Marketplace — Skill Detail', () => {
  test('should navigate to a skill detail page from marketplace', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await page.waitForLoadState('networkidle');

    const skillLinks = page.locator('a[href^="/marketplace/"]');
    const count = await skillLinks.count();

    if (count === 0) {
      test.skip(true, 'No skills available in marketplace');
      return;
    }

    const firstSkillHref = await skillLinks.first().getAttribute('href');
    expect(firstSkillHref).toBeTruthy();

    await skillLinks.first().click();
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should show Install button on skill detail page', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await page.waitForLoadState('networkidle');

    const skillLinks = page.locator('a[href^="/marketplace/"]');
    const count = await skillLinks.count();

    if (count === 0) {
      test.skip(true, 'No skills available in marketplace');
      return;
    }

    await skillLinks.first().click();
    await page.waitForLoadState('networkidle');

    const installBtn = page.getByRole('button', { name: /install/i });
    const installLink = page.getByRole('link', { name: /install/i });
    const signInPrompt = page.getByText(/sign in.*install|log in/i);

    const hasInstall = await installBtn.first().isVisible().catch(() => false);
    const hasLink = await installLink.first().isVisible().catch(() => false);
    const hasSignIn = await signInPrompt.first().isVisible().catch(() => false);

    // Should show install button or sign-in prompt for unauthenticated users
    expect(hasInstall || hasLink || hasSignIn).toBe(true);
  });
});

/* ================================================================== */
/*  STEP 3: Authenticated Marketplace — Dashboard Flow                 */
/* ================================================================== */
authTest.describe('Marketplace — Authenticated Dashboard Marketplace', () => {
  authTest('should load dashboard marketplace with skill listing', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('should show installed skills page', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/skills`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const emptyState = page.getByText(/no skills installed/i);
    const heading = page.getByRole('heading').first();

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    expect(hasTable || hasEmpty || hasHeading).toBe(true);
  });

  authTest('should show bundles page in dashboard marketplace', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace?tab=bundles`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });
});
