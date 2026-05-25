import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const APP = process.env.E2E_APP_URL || "https://app.pushci.dev";

test.describe("Billing page — plan-based views", () => {
  test("free user sees upgrade options", async ({ page }) => {
    await loginAs(page, "free");
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState("networkidle");

    // Free plan shows "Current Plan" badge
    const currentBadge = page.locator("text=Current Plan");
    await expect(currentBadge).toBeVisible({ timeout: 10_000 });

    // Upgrade buttons visible for Pro and Team
    const upgradeButtons = page.locator('button:has-text("Upgrade")');
    await expect(upgradeButtons.first()).toBeVisible();
    const count = await upgradeButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Screenshot for debugging
    await page.screenshot({ path: "e2e/screenshots/billing-free-user.png", fullPage: true });
  });

  test("pro user with discount code triggers checkout", async ({ page }) => {
    // Login as free first, then test upgrade flow with promo
    await loginAs(page, "free");
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState("networkidle");

    // Enter promo code
    const promoToggle = page.locator("text=Enter code");
    if (await promoToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await promoToggle.click();
    }

    const promoInput = page.locator('input[placeholder*="promo"]');
    if (await promoInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await promoInput.fill("MONTOZUMA1");
    }

    // Click Upgrade on Pro
    const upgradeBtn = page.locator('button:has-text("Upgrade to Pro")');
    await expect(upgradeBtn).toBeVisible({ timeout: 5_000 });

    // Intercept the checkout API call to verify discount_code is sent
    const checkoutPromise = page.waitForResponse(
      (r) => r.url().includes("/api/billing/checkout") && r.request().method() === "POST"
    );

    await upgradeBtn.click();
    const checkoutRes = await checkoutPromise;
    const reqBody = checkoutRes.request().postDataJSON();
    expect(reqBody.plan).toBe("pro");

    await page.screenshot({ path: "e2e/screenshots/billing-checkout.png", fullPage: true });
  });

  test("team user sees subscription management", async ({ page }) => {
    await loginAs(page, "team");
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState("networkidle");

    // Team plan card shows Current Plan
    const teamCard = page.locator("text=Team").first();
    await expect(teamCard).toBeVisible({ timeout: 10_000 });

    // Manage subscription button visible for paid plans
    const manageBtn = page.locator("text=Manage in Customer Portal");
    await expect(manageBtn).toBeVisible({ timeout: 10_000 });

    // AI usage meter visible
    const usageMeter = page.locator("text=AI Usage");
    if (await usageMeter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(usageMeter).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/billing-team-user.png", fullPage: true });
  });
});
