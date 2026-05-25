// Shared helpers for responsive viewport tests
import { Page, expect } from "@playwright/test";

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

export const SITE = process.env.E2E_SITE_URL || "https://pushci.dev";
export const APP = process.env.E2E_APP_URL || "https://app.pushci.dev";

/** Assert no horizontal scrollbar on the page */
export async function assertNoOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow).toBe(false);
}

/** Take a full-page screenshot to the responsive folder */
export async function snap(page: Page, viewport: string, name: string) {
  const dir = "e2e/screenshots/responsive";
  const path = `${dir}/${viewport}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
}

/** Wait for page content to settle */
export async function waitForContent(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  const h = page.locator("h1, h2, [role=main]").first();
  await h.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
}
