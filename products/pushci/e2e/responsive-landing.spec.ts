// Responsive tests for all landing pages across 3 viewports
import { test, expect } from "@playwright/test";
import { VIEWPORTS, SITE, assertNoOverflow, snap, waitForContent } from "./helpers/responsive";

const LANDING_PAGES = [
  { path: "/", name: "homepage" },
  { path: "/docs", name: "docs" },
  { path: "/release", name: "release" },
  { path: "/vs/github-actions", name: "vs-github-actions" },
  { path: "/tools/cost-calculator", name: "cost-calculator" },
  { path: "/curb", name: "curb" },
  { path: "/skills", name: "skills" },
  { path: "/ai", name: "ai" },
];

for (const vp of VIEWPORTS) {
  test.describe(`Landing ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const pg of LANDING_PAGES) {
      test(`${pg.name}`, async ({ page }) => {
        await page.goto(`${SITE}${pg.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await waitForContent(page);
        await assertNoOverflow(page);

        // Verify key heading is visible
        const heading = page.locator("h1, h2").first();
        await expect(heading).toBeVisible({ timeout: 10_000 });

        // Mobile: check no desktop sidebar leaked
        if (vp.name === "mobile") {
          const desktopNav = page.locator("nav.desktop-nav, [data-testid=desktop-sidebar]");
          const count = await desktopNav.count();
          if (count > 0) {
            await expect(desktopNav.first()).not.toBeVisible();
          }
        }

        await snap(page, vp.name, pg.name);
      });
    }
  });
}
