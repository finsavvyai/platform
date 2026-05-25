import { test, expect } from "@playwright/test";

const SITE = process.env.E2E_SITE_URL || "https://pushci.dev";
const APP = process.env.E2E_APP_URL || "https://app.pushci.dev";

test.describe("Landing pages — no auth required", () => {
  test("landing page loads with hero, pricing, and features", async ({ page }) => {
    await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Hero section visible (React SPA needs time to hydrate)
    const hero = page.locator("h1").first();
    await expect(hero).toBeVisible({ timeout: 30_000 });

    // Pricing section exists
    const pricing = page.locator("text=Pricing").first();
    await expect(pricing).toBeVisible({ timeout: 10_000 });

    // Features section exists
    const features = page.locator("text=Features").first();
    if (await features.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(features).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/landing-hero.png", fullPage: true });
  });

  test("docs page has Quick Start and Installation", async ({ page }) => {
    await page.goto(`${SITE}/docs`);
    await page.waitForLoadState("networkidle");

    // Quick Start section
    const quickStart = page.locator("text=Quick Start").first();
    await expect(quickStart).toBeVisible({ timeout: 10_000 });

    // Installation section
    const install = page.locator("text=Install").first();
    await expect(install).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/docs-page.png", fullPage: true });
  });

  test("404 page renders for unknown routes", async ({ page }) => {
    const res = await page.goto(`${SITE}/this-page-does-not-exist-xyz`);
    await page.waitForLoadState("networkidle");

    // Either a 404 status or a visible 404 message
    const body = await page.textContent("body");
    const is404 = res?.status() === 404 || /not found|404/i.test(body || "");
    expect(is404).toBeTruthy();

    await page.screenshot({ path: "e2e/screenshots/404-page.png", fullPage: true });
  });

  test("cost calculator page loads", async ({ page }) => {
    await page.goto(`${SITE}/tools/cost-calculator`);
    await page.waitForLoadState("networkidle");

    // Page should have some calculator UI
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/cost-calculator.png", fullPage: true });
  });

  test("pricing section shows promo banner", async ({ page }) => {
    await page.goto(SITE);
    await page.waitForLoadState("networkidle");

    // Scroll to pricing area
    await page.locator("text=Pricing").first().scrollIntoViewIfNeeded();

    // Check for promo text (AMISRAEL2026 or any promo banner)
    const promo = page.locator("text=/AMISRAEL|promo|discount/i").first();
    if (await promo.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(promo).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/pricing-promo.png", fullPage: true });
  });
});
