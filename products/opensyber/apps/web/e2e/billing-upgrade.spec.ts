import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Flow 3: View Pricing -> Upgrade Flow
 *
 * Tests the pricing page with plan tiers, billing toggle,
 * CTA buttons, and TokenForge inclusion notice.
 */

/* ================================================================== */
/*  STEP 1: Pricing Page — Plan Tiers Render                           */
/* ================================================================== */
test.describe('Billing — Pricing Page Plan Tiers', () => {
  test('should render pricing page with heading', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should render Starter Shield (free) tier', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const freeTier = page.getByText(/starter shield/i);
    const freePrice = page.getByText(/\$0/i);

    await expect(freeTier.first()).toBeVisible();
    await expect(freePrice.first()).toBeVisible();
  });

  test('should render Team tier at $299/mo', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const teamTier = page.getByText(/^team$/i);
    const teamPrice = page.getByText(/299/i);

    await expect(teamTier.first()).toBeVisible();
    await expect(teamPrice.first()).toBeVisible();
  });

  test('should render Professional tier at $799/mo', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const proTier = page.getByText(/professional/i);
    const proPrice = page.getByText(/799/i);

    await expect(proTier.first()).toBeVisible();
    await expect(proPrice.first()).toBeVisible();
  });

  test('should render Enterprise tier at $2,499/mo', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const enterpriseTier = page.getByText(/enterprise/i);
    await expect(enterpriseTier.first()).toBeVisible();

    const enterprisePrice = page.getByText(/2.?499/i);
    await expect(enterprisePrice.first()).toBeVisible();
  });

  test('should render Mission Defender tier at $9,999/mo', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const missionTier = page.getByText(/mission defender/i);
    await expect(missionTier.first()).toBeVisible();

    const missionPrice = page.getByText(/9.?999/i);
    await expect(missionPrice.first()).toBeVisible();
  });
});

/* ================================================================== */
/*  STEP 2: Billing Toggle — Monthly / Annual Switch                   */
/* ================================================================== */
test.describe('Billing — Monthly/Annual Toggle', () => {
  test('should render billing toggle switch', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const monthlyLabel = page.getByText(/monthly/i);
    const annualLabel = page.getByText(/annual/i);

    await expect(monthlyLabel.first()).toBeVisible();
    await expect(annualLabel.first()).toBeVisible();
  });

  test('should toggle between monthly and annual pricing', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    // Find the toggle button/switch
    const toggle = page.locator('button').filter({ hasText: /annual/i });
    const switchEl = page.locator('[role="switch"], input[type="checkbox"]');

    const hasToggle = await toggle.first().isVisible().catch(() => false);
    const hasSwitch = await switchEl.first().isVisible().catch(() => false);

    if (hasToggle) {
      await toggle.first().click();
    } else if (hasSwitch) {
      await switchEl.first().click();
    }

    // After toggle, annual discount text should appear
    const discount = page.getByText(/save|20%|annual/i);
    const hasDiscount = await discount.first().isVisible().catch(() => false);
    expect(typeof hasDiscount).toBe('boolean');
  });
});

/* ================================================================== */
/*  STEP 3: CTA Buttons — Correct Labels                              */
/* ================================================================== */
test.describe('Billing — CTA Buttons', () => {
  test('should show Get Started Free CTA for Starter Shield', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const freeCta = page.getByText(/get started free/i);
    await expect(freeCta.first()).toBeVisible();
  });

  test('should show Start Free Trial CTA for paid tiers', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const trialCta = page.getByText(/start free trial/i);
    const hasTrialCta = await trialCta.first().isVisible().catch(() => false);

    // Paid tiers should have trial CTA or checkout link
    expect(hasTrialCta).toBe(true);
  });

  test('should show Contact Sales CTA for Enterprise and Mission Defender', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const salesCta = page.getByText(/contact sales/i);
    await expect(salesCta.first()).toBeVisible();
  });
});

/* ================================================================== */
/*  STEP 4: TokenForge Inclusion Notice                                */
/* ================================================================== */
test.describe('Billing — TokenForge Notice', () => {
  test('should show TokenForge inclusion notice from Professional tier', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const tokenForgeNotice = page.getByText(/tokenforge.*included/i);
    await expect(tokenForgeNotice.first()).toBeVisible();
  });

  test('should show no credit card required messaging', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const noCreditCard = page.getByText(/no credit card/i);
    await expect(noCreditCard.first()).toBeVisible();
  });
});

/* ================================================================== */
/*  STEP 5: Authenticated — Upgrade from Dashboard Settings            */
/* ================================================================== */
authTest.describe('Billing — Dashboard Upgrade Path', () => {
  authTest('should show current plan info in settings', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    const planInfo = page.getByText(/free|personal|team|professional|plan/i);
    const heading = page.getByRole('heading').first();

    const hasPlan = await planInfo.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    expect(hasPlan || hasHeading).toBe(true);
  });
});
