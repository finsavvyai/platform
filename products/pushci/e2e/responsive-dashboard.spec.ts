// Responsive tests for dashboard pages across 3 viewports
import { test, expect } from "@playwright/test";
import { loginAs, TestPlan } from "./helpers/auth";
import { VIEWPORTS, APP, assertNoOverflow, snap, waitForContent } from "./helpers/responsive";

interface DashPage {
  path: string;
  name: string;
  plan: TestPlan;
  check?: string; // text to verify on page
}

const DASH_PAGES: DashPage[] = [
  { path: "/runs", name: "runs-free", plan: "free" },
  { path: "/billing", name: "billing-free", plan: "free", check: "Upgrade" },
  { path: "/billing", name: "billing-pro", plan: "pro", check: "Pro" },
  { path: "/projects", name: "projects-pro", plan: "pro" },
  { path: "/analytics", name: "analytics-pro", plan: "pro" },
  { path: "/skills", name: "skills-pro", plan: "pro" },
  { path: "/channels", name: "channels-pro", plan: "pro" },
  { path: "/settings", name: "settings-team", plan: "team" },
  { path: "/team", name: "team-team", plan: "team" },
];

for (const vp of VIEWPORTS) {
  test.describe(`Dashboard ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const pg of DASH_PAGES) {
      test(`${pg.name}`, async ({ page }) => {
        await loginAs(page, pg.plan);
        await page.goto(`${APP}${pg.path}`, { timeout: 30_000 });
        await waitForContent(page);
        await assertNoOverflow(page);

        // Verify page loaded (not redirected to login)
        expect(page.url()).toContain(pg.path);

        // Check for expected text if specified
        if (pg.check) {
          const el = page.locator(`text=${pg.check}`).first();
          await expect(el).toBeVisible({ timeout: 10_000 });
        }

        // Mobile: hamburger or collapsed sidebar expected
        if (vp.name === "mobile") {
          const hamburger = page.locator(
            "button[aria-label*=menu], button[aria-label*=Menu], [data-testid=hamburger]"
          );
          const sidebar = page.locator("aside, [role=navigation]").first();
          // At least one responsive pattern should exist
          const hasHamburger = (await hamburger.count()) > 0;
          const sidebarHidden = !(await sidebar.isVisible().catch(() => false));
          expect(hasHamburger || sidebarHidden).toBeTruthy();
        }

        await snap(page, vp.name, pg.name);
      });
    }
  });
}
