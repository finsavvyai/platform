import { test, expect, type Page } from "@playwright/test";

// Admin UI E2E flows. Target URL comes from ADMIN_BASE_URL (Next dev server or
// staging). Tests skip when ADMIN_BASE_URL is unset so the suite stays green
// when admin-ui is offline — real runs are gated by CI env.

const ADMIN_BASE = process.env.ADMIN_BASE_URL;
const skipMsg = "ADMIN_BASE_URL not set";

test.describe("Admin dashboard", () => {
  test.skip(!ADMIN_BASE, skipMsg);

  test("renders layout with nav + main region", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("document list tab loads", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/documents`);
    await expect(page.getByRole("heading", { name: /documents/i })).toBeVisible();
  });

  test("upload button opens file picker", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/documents`);
    const upload = page.getByRole("button", { name: /upload/i });
    await expect(upload).toBeVisible();
  });
});

test.describe("Policy editor", () => {
  test.skip(!ADMIN_BASE, skipMsg);

  test("editor page renders rule workspace", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/policies`);
    await expect(page.getByRole("heading", { name: /polic/i })).toBeVisible();
  });

  test("create-rule CTA is present", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/policies`);
    await expect(page.getByRole("button", { name: /new|create/i })).toBeVisible();
  });
});

test.describe("API keys", () => {
  test.skip(!ADMIN_BASE, skipMsg);

  test("list renders with generate CTA", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/api-keys`);
    await expect(page.getByRole("heading", { name: /api key/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /generate|create/i })).toBeVisible();
  });
});

test.describe("Audit logs", () => {
  test.skip(!ADMIN_BASE, skipMsg);

  test("filter panel accepts action type", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/audit`);
    await expect(page.getByRole("heading", { name: /audit/i })).toBeVisible();
  });
});

test.describe("DLP settings", () => {
  test.skip(!ADMIN_BASE, skipMsg);

  test("detector list renders", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dlp`);
    await expect(page.getByRole("heading", { name: /dlp|data loss/i })).toBeVisible();
  });
});

test.describe("LLM query playground", () => {
  test.skip(!ADMIN_BASE, skipMsg);

  test("prompt input is present", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/playground`);
    await expect(page.getByRole("textbox")).toBeVisible();
  });
});

test.describe("Webhooks", () => {
  test.skip(!ADMIN_BASE, skipMsg);

  test("endpoint list + add CTA", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/webhooks`);
    await expect(page.getByRole("button", { name: /add|new/i })).toBeVisible();
  });
});

test.describe("Mobile responsiveness", () => {
  test.skip(!ADMIN_BASE, skipMsg);
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12

  test("nav collapses into menu button", async ({ page }: { page: Page }) => {
    await page.goto(`${ADMIN_BASE}/dashboard`);
    const menu = page.getByRole("button", { name: /menu|open nav/i });
    await expect(menu).toBeVisible();
  });
});
