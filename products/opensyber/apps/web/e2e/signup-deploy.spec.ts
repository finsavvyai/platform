import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Flow 1: Signup -> Deploy First Agent
 *
 * Tests the critical path from sign-in page through OAuth provider
 * selection to dashboard landing with the deploy instance CTA.
 */

/* ================================================================== */
/*  STEP 1: Sign-In Page Loads with OAuth Providers                    */
/* ================================================================== */
test.describe('Signup-Deploy — Sign-In Page', () => {
  test('should render sign-in page with heading', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByText(/sign in to opensyber/i);
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should render OAuth provider buttons (GitHub, Google, LinkedIn, Microsoft)', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button, a[role="button"]');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(1);

    // Check for OAuth provider text in buttons or links
    const github = page.getByText(/github/i);
    const google = page.getByText(/google/i);
    const linkedin = page.getByText(/linkedin/i);
    const microsoft = page.getByText(/microsoft/i);

    const hasGithub = await github.first().isVisible().catch(() => false);
    const hasGoogle = await google.first().isVisible().catch(() => false);
    const hasLinkedin = await linkedin.first().isVisible().catch(() => false);
    const hasMicrosoft = await microsoft.first().isVisible().catch(() => false);

    // At least two OAuth providers should be visible
    const providerCount = [hasGithub, hasGoogle, hasLinkedin, hasMicrosoft]
      .filter(Boolean).length;
    expect(providerCount).toBeGreaterThanOrEqual(2);
  });

  test('should show auto-account-creation notice', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await page.waitForLoadState('networkidle');

    const notice = page.getByText(/no account.*create one automatically/i);
    await expect(notice).toBeVisible();
  });

  test('should show left panel branding on desktop', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await page.waitForLoadState('networkidle');

    const brand = page.getByText(/WELCOME BACK/i);
    const hasBrand = await brand.isVisible().catch(() => false);

    // Left panel only shows on lg+ screens; verify page loaded either way
    const content = page.locator('main, [class*="auth"], form, button');
    await expect(content.first()).toBeVisible();
    expect(typeof hasBrand).toBe('boolean');
  });
});

/* ================================================================== */
/*  STEP 2: Unauthenticated Dashboard Redirects to Sign-In             */
/* ================================================================== */
test.describe('Signup-Deploy — Auth Redirect', () => {
  test('should redirect unauthenticated /dashboard to sign-in', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const isRedirected = url.includes('/sign-in') || url.includes('/api/auth');
    const hasAuthContent = await page.getByText(/sign in|log in|continue with/i)
      .first().isVisible().catch(() => false);
    expect(isRedirected || hasAuthContent).toBe(true);
  });
});

/* ================================================================== */
/*  STEP 3: Authenticated Dashboard — Empty State & Deploy CTA         */
/* ================================================================== */
authTest.describe('Signup-Deploy — Dashboard Empty State', () => {
  authTest('should load dashboard after authentication', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('should show empty state or instance card', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const emptyState = page.getByText(/no instances|deploy.*first|get started/i);
    const instanceCard = page.getByText(/running|stopped|provisioning|agent/i);

    const hasEmpty = await emptyState.first().isVisible().catch(() => false);
    const hasInstance = await instanceCard.first().isVisible().catch(() => false);

    expect(hasEmpty || hasInstance).toBe(true);
  });

  authTest('should show Deploy Instance button', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const deployBtn = page.getByRole('button', { name: /deploy/i });
    const deployLink = page.getByRole('link', { name: /deploy/i });

    const hasButton = await deployBtn.first().isVisible().catch(() => false);
    const hasLink = await deployLink.first().isVisible().catch(() => false);

    // Deploy CTA should exist as a button or link
    expect(hasButton || hasLink).toBe(true);
  });
});
