import { test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("mobile app loads", async ({ page }) => {
  const logs: string[] = [];
  page.on("pageerror", (err) => logs.push(`PAGE_ERROR: ${err.message}`));
  page.on("console", (msg) => logs.push(`${msg.type().toUpperCase()}: ${msg.text()}`));
  page.on("requestfailed", (req) => logs.push(`FAILED: ${req.url()} - ${req.failure()?.errorText}`));

  await page.goto("http://localhost:8765", { waitUntil: "load" });
  await page.waitForTimeout(8000);

  console.log("\n=== LOGS ===");
  logs.forEach((l) => console.log(l));
  console.log("\n=== ROOT HTML ===");
  const rootHtml = await page.evaluate(() => document.getElementById("root")?.innerHTML || "empty");
  console.log(rootHtml.substring(0, 500));

  await page.screenshot({ path: "screenshots/01-login.png" });
});
