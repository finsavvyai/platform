import { test, expect } from "@playwright/test";

test.describe("Customer Onboarding Journeys", () => {
  test("checkout create API returns a redirect URL for startup", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout/create", {
      data: { plan: "startup", source: "playwright-e2e" },
    });
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { url?: string };
    expect(body.url).toBeTruthy();
  });

  test("startup checkout route redirects from sdlc.cc", async ({ page }) => {
    await page.goto("/checkout/startup");
    await page.waitForURL(
      (url) =>
        url.hostname.includes("lemonsqueezy") ||
        url.pathname.includes("/checkout/startup"),
      { timeout: 15000 },
    );
  });

  test("developer onboarding route redirects from sdlc.cc", async ({
    page,
  }) => {
    await page.goto("/checkout/developer");
    await page.waitForURL((url) => url.pathname.includes("/getting-started"), {
      timeout: 15000,
    });
  });

  test("enterprise route redirects to contact flow", async ({ page }) => {
    await page.goto("/checkout/enterprise");
    await page.waitForURL((url) => /\/#demo$/.test(url.toString()), {
      timeout: 15000,
    });
  });

  test("startup buyer can start checkout from pricing", async ({ page }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();

    const getStartedButtons = page.locator(
      '#pricing button:has-text("Get started")',
    );
    await expect(getStartedButtons).toHaveCount(2);

    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname.includes("/checkout/startup") ||
          url.pathname.includes("/getting-started") ||
          url.hostname.includes("lemonsqueezy"),
        { timeout: 15000 },
      ),
      getStartedButtons.nth(1).click(),
    ]);
  });

  test("enterprise buyer can contact sales and submit demo request", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();

    await page.locator('#pricing button:has-text("Contact sales")').click();
    await expect(page).toHaveURL(/#demo/);

    await page.locator('input[name="name"]').fill("Enterprise Buyer");
    await page
      .locator('input[name="email"]')
      .fill("enterprise.buyer@example.com");
    await page.locator('input[name="company"]').fill("Enterprise Co");
    await page.locator('select[name="timeline"]').selectOption("1-month");
    await page
      .locator('textarea[name="useCase"]')
      .fill(
        "Need full auditability, policy enforcement, and private deployment.",
      );

    await page.locator('#demo button[type="submit"]').click();
    await expect(page.locator("#demo h3")).toContainText(
      "Demo request received",
    );
  });

  test("getting started page links to self-serve signup flow", async ({
    page,
  }) => {
    await page.goto("/getting-started");

    const signupLink = page.locator(
      'a[href="https://d6401704.sdlc-onboarding.pages.dev"]',
    );
    await expect(signupLink.first()).toBeVisible();
    await expect(signupLink).toHaveCount(2);
  });
});
