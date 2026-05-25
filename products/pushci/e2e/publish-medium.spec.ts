import { test } from "@playwright/test";

/**
 * Publish article to Medium.
 *
 * Run: npx playwright test e2e/publish-medium.spec.ts --headed --config=""
 *
 * 1. Opens Medium — you log in if needed
 * 2. Goes to import page
 * 3. Imports from Dev.to URL
 * 4. You add images + publish
 */

test.use({
  viewport: { width: 1400, height: 900 },
  actionTimeout: 0,
  navigationTimeout: 0,
});

test("publish to Medium", async ({ page, context }) => {
  // Step 1: Go to Medium and ensure logged in
  await page.goto("https://medium.com");
  console.log("\n📝 Log into Medium if needed. Waiting up to 5 minutes...\n");

  // Wait until we see the avatar/profile icon or new-story link (means logged in)
  await page.waitForFunction(() => {
    return document.querySelector('img[alt*="avatar"], img[alt*="Avatar"], a[href*="new-story"], button[data-testid*="user"]') !== null
      || window.location.pathname.includes("/me")
      || document.cookie.includes("uid=");
  }, { timeout: 300_000 });

  console.log("✅ Logged into Medium!\n");

  // Step 2: Navigate to import
  await page.goto("https://medium.com/p/import");
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: "e2e/screenshots/article/medium-step1.png" });

  // Step 3: Look for URL input and paste Dev.to URL
  const devtoUrl = "https://dev.to/shacharsol/pushci-v130-your-ci-tool-supports-three-languages-and-you-are-fine-with-that-541i";

  // Try to find any input field
  const inputs = page.locator("input, textarea");
  const count = await inputs.count();
  console.log(`Found ${count} input fields on import page`);

  if (count > 0) {
    await inputs.first().fill(devtoUrl);
    console.log("✅ Pasted Dev.to URL");

    // Try to click import/submit button
    const btn = page.locator('button:has-text("Import"), button[type="submit"]').first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click();
      console.log("✅ Clicked Import — waiting for conversion...\n");
      await page.waitForTimeout(15_000);
    }
  } else {
    console.log("⚠️  No input field found. Medium may have changed the import UI.");
    console.log("   Try manually: click your avatar → Stories → Import a story\n");
  }

  await page.screenshot({ path: "e2e/screenshots/article/medium-step2.png" });

  console.log("📸 Now in Medium editor. Add images from:");
  console.log("   e2e/screenshots/article/01-hero.png");
  console.log("   e2e/screenshots/article/02-pricing.png");
  console.log("   e2e/screenshots/article/03-billing-free.png");
  console.log("   e2e/screenshots/article/05-runs.png");
  console.log("   e2e/screenshots/article/06-skills.png");
  console.log("   e2e/screenshots/article/07-docs.png");
  console.log("\n   Add to 'The Useful Tech' publication");
  console.log("   Tags: CI/CD, DevOps, Open Source, Developer Tools");
  console.log("\n   Browser stays open for 15 minutes.\n");

  await page.waitForTimeout(900_000);
});
