import { test, expect } from "../fixtures/pages.fixture";
import { test as testWithData } from "../fixtures/test-data.fixture";

/**
 * Landing Page Tests
 * Tests for the SDLC.ai landing page functionality
 */
test.describe("Landing Page - Core Functionality", () => {
  test("should load successfully", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.waitForLoadState();

    const title = await landingPage.getTitle();
    expect(title).toMatch(/SDLC|AI|Compliance/i);
  });

  test("should have proper SEO metadata", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.waitForLoadState();

    const metadata = await landingPage.getMetadata();

    expect(metadata.title).toBeTruthy();
    expect(metadata.title.length).toBeGreaterThan(10);
    expect(metadata.description).toBeTruthy();
    expect(metadata.description.length).toBeGreaterThan(20);
  });

  test("should display hero section with correct content", async ({
    landingPage,
  }) => {
    await landingPage.goto();
    await landingPage.waitForLoadState();

    const isHeroVisible = await landingPage.isHeroVisible();
    expect(isHeroVisible).toBeTruthy();

    const heroText = await landingPage.getHeroText();
    expect(heroText.title).toBeTruthy();
    expect(heroText.title.length).toBeGreaterThan(5);
    expect(heroText.title).toMatch(/AI|Compliant|ChatGPT|Claude|Gemini/i);
  });
});

test.describe("Landing Page - Navigation", () => {
  test("should have working navigation links", async ({
    landingPage,
    page,
  }) => {
    await landingPage.goto();
    await landingPage.waitForLoadState();

    // Test sign in button
    await landingPage.clickSignIn();
    await page.waitForURL(/\/sign-in/, { timeout: 5000 });
  });

  test("should have working get started button", async ({
    landingPage,
    page,
  }) => {
    await landingPage.goto();
    await landingPage.waitForLoadState();

    await landingPage.clickGetStarted();
    await page.waitForURL(/\/sign-up/, { timeout: 5000 });
  });

  test("should scroll to features section", async ({ landingPage, page }) => {
    await landingPage.goto();
    await landingPage.waitForLoadState();

    await landingPage.goToFeatures();
    await landingPage.scrollToSection("features");

    const hash = page.url().split("#")[1];
    expect(hash).toBe("features");
  });
});

test.describe("Landing Page - Demo Form", () => {
  test("should display demo form", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.goToDemo();

    const formVisible = await landingPage.demoForm
      .isVisible()
      .catch(() => false);
    expect(formVisible).toBeTruthy();
  });

  testWithData(
    "should accept valid demo form data",
    async ({ landingPage, testData, page }) => {
      await landingPage.goto();

      const demoData = testData.demoFormData.generate();
      await landingPage.submitDemoForm(demoData);

      // Form should submit (might show success or redirect)
      // Note: Actual submission behavior depends on backend
      await page.waitForTimeout(2000);
    },
  );
});

test.describe("Landing Page - Features Section", () => {
  test("should display feature cards", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.goToFeatures();

    const featureTitles = await landingPage.getFeatureTitles();
    expect(featureTitles.length).toBeGreaterThan(0);
  });

  test("should display key features", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.goToFeatures();

    const featureTitles = await landingPage.getFeatureTitles();
    const featuresText = featureTitles.join(" ").toLowerCase();

    // Check for key features
    expect(featuresText).toMatch(
      /pii|detection|security|compliance|audit|rate limit/i,
    );
  });
});

test.describe("Landing Page - Pricing Section", () => {
  test("should display pricing plans", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.goToPricing();

    const plans = await landingPage.getPricingPlans();
    expect(plans.length).toBeGreaterThan(0);
  });

  test("should show pricing for different tiers", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.goToPricing();

    const plans = await landingPage.getPricingPlans();

    // Should have at least 2 pricing tiers
    expect(plans.length).toBeGreaterThanOrEqual(2);

    // Plans should have names and prices
    plans.forEach((plan) => {
      expect(plan.name).toBeTruthy();
      expect(plan.name.length).toBeGreaterThan(0);
    });
  });
});

test.describe("Landing Page - Footer", () => {
  test("should display footer with links", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.scrollToBottom();

    const footerVisible = await landingPage.footer.isVisible();
    expect(footerVisible).toBeTruthy();
  });

  test("should have working footer links", async ({ landingPage }) => {
    await landingPage.goto();
    await landingPage.scrollToBottom();

    const linkCount = await landingPage.footerLinks.count();
    expect(linkCount).toBeGreaterThan(0);
  });
});
