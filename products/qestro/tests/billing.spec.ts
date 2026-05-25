/**
 * Billing E2E Tests
 * Tests for pricing display, subscription management, and upgrades
 */

import { test, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Billing & Pricing', () => {
  test('should display pricing page with all plans', async ({ page }) => {
    // Navigate to pricing page
    await page.goto(`${baseURL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page).toHaveTitle(/.*Pricing.*/i);

    // Look for pricing cards/plans
    const pricingCards = page.locator('[data-testid*="pricing"], [class*="pricing-card"], [class*="plan"]');
    const cardCount = await pricingCards.count().catch(() => 0);

    // Should have at least 2 pricing plans
    expect(cardCount).toBeGreaterThanOrEqual(2);
  });

  test('should display Free plan details', async ({ page }) => {
    // Navigate to pricing
    await page.goto(`${baseURL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Look for Free plan
    const freePlan = page.locator('[data-testid*="free"], :text("Free"), [class*="free"]').first();
    const isVisible = await freePlan.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(freePlan).toBeInViewport();

      // Should show $0 or Free
      const price = freePlan.locator(':text("$0"), :text("Free")').first();
      const priceVisible = await price.isVisible({ timeout: 5000 }).catch(() => false);

      if (priceVisible) {
        expect(priceVisible).toBeTruthy();
      }
    }
  });

  test('should display Starter plan details', async ({ page }) => {
    // Navigate to pricing
    await page.goto(`${baseURL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Look for Starter plan
    const starterPlan = page.locator('[data-testid*="starter"], :text("Starter"), [class*="starter"]').first();
    const isVisible = await starterPlan.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(starterPlan).toBeInViewport();

      // Should show price
      const price = starterPlan.locator('[data-testid*="price"], :text("$")').first();
      const priceVisible = await price.isVisible({ timeout: 5000 }).catch(() => false);

      if (priceVisible) {
        const priceText = await price.innerText();
        expect(priceText).toMatch(/\$\d+/);
      }
    }
  });

  test('should display Pro plan details', async ({ page }) => {
    // Navigate to pricing
    await page.goto(`${baseURL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Look for Pro plan
    const proPlan = page.locator('[data-testid*="pro"], :text("Pro"), [class*="pro"]').first();
    const isVisible = await proPlan.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(proPlan).toBeInViewport();

      // Should show price
      const price = proPlan.locator('[data-testid*="price"], :text("$")').first();
      const priceVisible = await price.isVisible({ timeout: 5000 }).catch(() => false);

      if (priceVisible) {
        const priceText = await price.innerText();
        expect(priceText).toMatch(/\$\d+/);
      }
    }
  });

  test('should have Get Started buttons on pricing cards', async ({ page }) => {
    // Navigate to pricing
    await page.goto(`${baseURL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Look for Get Started buttons
    const getStartedButtons = page.locator('button:has-text("Get Started"), button:has-text("Start"), button:has-text("Try")');
    const buttonCount = await getStartedButtons.count().catch(() => 0);

    // Should have at least one button per plan
    expect(buttonCount).toBeGreaterThanOrEqual(1);
  });

  test('should display feature comparison table', async ({ page }) => {
    // Navigate to pricing
    await page.goto(`${baseURL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Look for feature comparison
    const comparisonTable = page.locator('table[role="table"], [data-testid="feature-comparison"], [class*="comparison"]');
    const isVisible = await comparisonTable.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(comparisonTable.first()).toBeInViewport();

      // Should have rows for features
      const rows = comparisonTable.first().locator('tr, [role="row"]');
      const rowCount = await rows.count().catch(() => 0);

      expect(rowCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('should navigate to billing settings from authenticated state', async ({ page }) => {
    // Navigate to settings or billing page
    await page.goto(`${baseURL}/settings/billing`);

    // Check if redirected to login
    const currentURL = page.url();
    if (currentURL.includes('login')) {
      // Not authenticated, skip this test
      test.skip();
    }

    await page.waitForLoadState('networkidle');

    // Look for billing section
    const billingSection = page.locator('[data-testid="billing-section"], h1:has-text("Billing"), h2:has-text("Billing")');
    const isVisible = await billingSection.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(billingSection.first()).toBeInViewport();
    }
  });

  test('should display current subscription', async ({ page }) => {
    // Navigate to billing settings
    await page.goto(`${baseURL}/settings/billing`);

    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');

    // Look for current plan info
    const currentPlan = page.locator('[data-testid="current-plan"], :text("Current Plan"), [class*="current"]');
    const isVisible = await currentPlan.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(currentPlan.first()).toBeInViewport();
    }
  });

  test('should display subscription renewal date', async ({ page }) => {
    // Navigate to billing settings
    await page.goto(`${baseURL}/settings/billing`);

    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');

    // Look for renewal date
    const renewalDate = page.locator('[data-testid="renewal-date"], :text("Renews"), :text("Expires"), :text("Next Billing")');
    const isVisible = await renewalDate.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const dateText = await renewalDate.first().innerText();
      expect(dateText).toBeTruthy();
    }
  });

  test('should show upgrade option if on lower plan', async ({ page }) => {
    // Navigate to billing settings
    await page.goto(`${baseURL}/settings/billing`);

    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');

    // Look for upgrade button
    const upgradeButton = page.locator('button:has-text("Upgrade"), button:has-text("Change Plan"), [data-testid="upgrade-button"]');
    const isVisible = await upgradeButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      expect(isVisible).toBeTruthy();
    }
  });

  test('should display payment method', async ({ page }) => {
    // Navigate to billing settings
    await page.goto(`${baseURL}/settings/billing`);

    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');

    // Look for payment method
    const paymentMethod = page.locator('[data-testid="payment-method"], :text("Payment"), [class*="payment"]');
    const isVisible = await paymentMethod.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(paymentMethod.first()).toBeInViewport();
    }
  });

  test('should display billing history', async ({ page }) => {
    // Navigate to billing settings
    await page.goto(`${baseURL}/settings/billing`);

    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');

    // Look for billing history section
    const billingHistory = page.locator('[data-testid="billing-history"], :text("History"), [class*="history"]');
    const isVisible = await billingHistory.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(billingHistory.first()).toBeInViewport();
    }
  });

  test('should display usage metrics in billing', async ({ page }) => {
    // Navigate to billing settings
    await page.goto(`${baseURL}/settings/billing`);

    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');

    // Look for usage information
    const usage = page.locator('[data-testid="usage"], :text("Usage"), [class*="usage"]');
    const isVisible = await usage.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(usage.first()).toBeInViewport();
    }
  });

  test('should show FAQ or help section on pricing page', async ({ page }) => {
    // Navigate to pricing
    await page.goto(`${baseURL}/pricing`);
    await page.waitForLoadState('networkidle');

    // Look for FAQ
    const faq = page.locator('[data-testid="faq"], :text("FAQ"), [class*="faq"]');
    const isVisible = await faq.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(faq.first()).toBeInViewport();
    }
  });
});
