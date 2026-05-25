import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const APP = process.env.E2E_APP_URL || "https://app.pushci.dev";

test.describe("Dashboard — plan-based access", () => {
  test("free user dashboard shows empty state", async ({ page }) => {
    await loginAs(page, "free");
    await page.goto(`${APP}/runs`);
    await page.waitForLoadState("networkidle");

    // Should see runs page (empty state or runs list)
    await expect(page).toHaveURL(/\/(runs|$)/);

    // Navigate to billing — upgrade CTAs visible
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState("networkidle");

    const upgradeBtn = page.locator('button:has-text("Upgrade")');
    await expect(upgradeBtn.first()).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/dash-free.png", fullPage: true });
  });

  test("pro user dashboard shows full navigation", async ({ page }) => {
    await loginAs(page, "pro");
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    // Sidebar should have nav items
    const sidebar = page.locator("nav, [role=navigation]");
    await expect(sidebar.first()).toBeVisible({ timeout: 10_000 });

    // Navigate to billing — Pro plan visible
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState("networkidle");

    const proPlan = page.locator("text=Pro");
    await expect(proPlan.first()).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/dash-pro.png", fullPage: true });
  });

  test("team user has access to team and settings pages", async ({ page }) => {
    await loginAs(page, "team");

    // Check team page
    await page.goto(`${APP}/team`);
    await page.waitForLoadState("networkidle");
    // Should not redirect to a 403 or login
    const teamUrl = page.url();
    expect(teamUrl).toContain("/team");

    // Check settings page
    await page.goto(`${APP}/settings`);
    await page.waitForLoadState("networkidle");
    const settingsUrl = page.url();
    expect(settingsUrl).toContain("/settings");

    // Billing shows Team as current
    await page.goto(`${APP}/billing`);
    await page.waitForLoadState("networkidle");

    const teamLabel = page.locator("text=Team");
    await expect(teamLabel.first()).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/dash-team.png", fullPage: true });
  });
});
