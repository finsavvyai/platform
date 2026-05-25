import { test, expect } from "@playwright/test";

// Auth flow tests — exercise landing-page signup CTA and admin-ui protected
// routes. Skips gracefully when env is not configured so the suite stays
// green for preview deploys without Clerk creds.

const ADMIN_BASE = process.env.ADMIN_BASE_URL;
const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Auth: signup CTA on landing", () => {
  test("landing CTA routes to signup or auth gateway", async ({ page }) => {
    await page.goto("/");
    const cta = page
      .getByRole("link", { name: /get started|sign up|start free/i })
      .first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href).toBeTruthy();
  });
});

test.describe("Auth: protected route redirects", () => {
  test.skip(!ADMIN_BASE, "ADMIN_BASE_URL not set");

  test("unauthenticated /dashboard redirects to sign-in", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await expect(page).toHaveURL(/sign-in|login|auth/, { timeout: 10_000 });
  });
});

test.describe("Auth: credentialed login", () => {
  test.skip(
    !ADMIN_BASE || !TEST_EMAIL || !TEST_PASSWORD,
    "Credentialed auth env not set",
  );

  // Password is never typed through Playwright's tracing layer. We disable
  // trace for this spec and fill the password via evaluate() so the raw
  // value never enters the trace timeline. See H19 in the security audit.
  test.use({ trace: "off", video: "off" });

  test("login lands on dashboard", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/sign-in`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL!);

    // Avoid page.fill/type for the password field — trace files persist
    // input events. Setting .value via evaluate with a parameter keeps the
    // secret out of Playwright's serialized action log.
    await page
      .getByLabel(/password/i)
      .evaluate((el, secret) => {
        (el as HTMLInputElement).value = secret;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, TEST_PASSWORD!);

    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
  });
});
