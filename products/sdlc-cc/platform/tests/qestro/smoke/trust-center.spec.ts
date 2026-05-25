// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Post-deploy smoke for the Trust Center. Run after Cloudflare
// Pages publishes a new build:
//
//   TRUST_URL=https://trust.sdlc.cc npx playwright test smoke
//
// For local verification:
//   python3 -m http.server -d trust 8001 &
//   TRUST_URL=http://localhost:8001 npx playwright test smoke
//
// Asserts: every page returns 200, security headers are present
// in production deploys, no console errors, and the pages link to
// each other coherently.

import { test, expect } from "@playwright/test";

const pages: Array<{ path: string; expectsHeading: string }> = [
  { path: "/", expectsHeading: "Three products. One Trust posture." },
  { path: "/security.html", expectsHeading: "Security overview" },
  { path: "/sub-processors.html", expectsHeading: "Sub-processors" },
  { path: "/dpa.html", expectsHeading: "DPA & MSA" },
  { path: "/audit-logs.html", expectsHeading: "Audit-log architecture" },
  { path: "/soc2.html", expectsHeading: "SOC 2 status" },
];

for (const p of pages) {
  test(`${p.path} loads with the expected heading`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    const res = await page.goto(p.path);
    expect(res?.status(), `${p.path} status`).toBe(200);
    await expect(page.locator("h1")).toContainText(p.expectsHeading);
    expect(errors, `console errors on ${p.path}`).toEqual([]);
  });
}

test("security headers present (production only)", async ({ request }) => {
  test.skip(
    (process.env.TRUST_URL ?? "").startsWith("http://localhost"),
    "headers only enforced by Cloudflare Pages in production",
  );
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h["strict-transport-security"]).toMatch(/max-age=\d{6,}/);
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["x-frame-options"]).toBe("DENY");
});

test("home page links to every sub-page", async ({ page }) => {
  await page.goto("/");
  for (const p of pages.filter((q) => q.path !== "/")) {
    const link = page.locator(`a[href$='${p.path}']`).first();
    await expect(link, `link to ${p.path}`).toBeVisible();
  }
});
