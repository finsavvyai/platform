import { test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const SITE = "https://pushci.dev";
const APP = "https://app.pushci.dev";

test.use({ viewport: { width: 1280, height: 800 } });

test("hero section", async ({ page }) => {
  await page.goto(SITE);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/screenshots/article/01-hero.png", clip: { x: 0, y: 0, width: 1280, height: 800 } });
});

test("pricing section", async ({ page }) => {
  await page.goto(SITE);
  await page.waitForLoadState("networkidle");
  const pricing = page.locator("#pricing");
  await pricing.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await pricing.screenshot({ path: "e2e/screenshots/article/02-pricing.png" });
});

test("billing dashboard - free user", async ({ page }) => {
  await loginAs(page, "free");
  await page.goto(`${APP}/billing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/article/03-billing-free.png", clip: { x: 200, y: 0, width: 1080, height: 800 } });
});

test("billing dashboard - pro user", async ({ page }) => {
  await loginAs(page, "pro");
  await page.goto(`${APP}/billing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/article/04-billing-pro.png", clip: { x: 200, y: 0, width: 1080, height: 800 } });
});

test("runs page", async ({ page }) => {
  await loginAs(page, "pro");
  await page.goto(`${APP}/runs`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/article/05-runs.png", clip: { x: 200, y: 0, width: 1080, height: 800 } });
});

test("skills marketplace", async ({ page }) => {
  await loginAs(page, "pro");
  await page.goto(`${APP}/skills`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/article/06-skills.png", clip: { x: 200, y: 0, width: 1080, height: 800 } });
});

test("docs page", async ({ page }) => {
  await page.goto(`${SITE}/docs`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/screenshots/article/07-docs.png", clip: { x: 0, y: 0, width: 1280, height: 800 } });
});

test("cost calculator", async ({ page }) => {
  await page.goto(`${SITE}/tools/cost-calculator`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/screenshots/article/08-calculator.png", clip: { x: 0, y: 0, width: 1280, height: 800 } });
});
