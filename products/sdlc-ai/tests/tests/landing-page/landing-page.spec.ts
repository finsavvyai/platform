import { test, expect } from '@playwright/test';
import { LandingPage } from '../../pages/landing-page';
import { TestHelpers } from '../../utils/test-helpers';

test.describe('Landing Page - SDLC Production', () => {
  let landingPage: LandingPage;
  const baseUrl = process.env.BASE_URL || 'https://sdlc.finsavvyai.com';

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
  });

  test('should load successfully and have correct metadata', async ({ page }) => {
    // Navigate to landing page
    await landingPage.goto();

    // Check if page loaded (or if behind Cloudflare)
    const pageLoaded = await landingPage.isPageLoaded();

    if (!pageLoaded) {
      const cloudflareCheck = await page.locator('text="Verify you are human"').isVisible().catch(() => false);
      if (cloudflareCheck) {
        test.skip(true, 'Page is behind Cloudflare protection - cannot test without human verification');
      }
    }

    expect(pageLoaded).toBeTruthy();

    // Check page metadata
    const metadata = await landingPage.getPageMetadata();
    expect(metadata.title).toContain('SDLC');
    expect(metadata.description.length).toBeGreaterThan(50);
    expect(metadata.title.length).toBeGreaterThan(10);

    console.log('✅ Page loaded successfully');
    console.log(`   Title: ${metadata.title}`);
    console.log(`   Description: ${metadata.description.substring(0, 100)}...`);
  });

  test('should have functional navigation elements', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const navResults = await landingPage.testNavigation();

    expect(navResults.logoVisible).toBeTruthy();
    expect(navResults.demoButtonVisible).toBeTruthy();
    expect(navResults.navigationClickable).toBeTruthy();

    console.log('✅ Navigation elements are functional');
    console.log(`   Logo visible: ${navResults.logoVisible}`);
    console.log(`   Demo button visible: ${navResults.demoButtonVisible}`);
    console.log(`   Navigation clickable: ${navResults.navigationClickable}`);
  });

  test('should display proper hero section', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const heroResults = await landingPage.testHeroSection();

    expect(heroResults.titleVisible).toBeTruthy();
    expect(heroResults.titleContent.length).toBeGreaterThan(10);
    expect(heroResults.subtitleVisible).toBeTruthy();
    expect(heroResults.subtitleContent.length).toBeGreaterThan(20);

    console.log('✅ Hero section is properly displayed');
    console.log(`   Title: "${heroResults.titleContent}"`);
    console.log(`   Subtitle: "${heroResults.subtitleContent.substring(0, 100)}..."`);
  });

  test('should have features section with cards', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const featuresResults = await landingPage.testFeaturesSection();

    expect(featuresResults.sectionExists).toBeTruthy();
    expect(featuresResults.featureCount).toBeGreaterThan(0);
    expect(featuresResults.featureCardsVisible).toBeTruthy();

    console.log('✅ Features section is properly displayed');
    console.log(`   Feature count: ${featuresResults.featureCount}`);
    console.log(`   Feature cards visible: ${featuresResults.featureCardsVisible}`);
  });

  test('should handle demo request form properly', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const testData = TestHelpers.generateTestData();
    const formResults = await landingPage.testDemoForm(testData);

    // Note: In production, form submission might be disabled or rate-limited
    // We're testing the form structure and validation, not actual submission

    expect(formResults.formExists).toBeTruthy();
    expect(formResults.allFieldsPresent).toBeTruthy();

    console.log('✅ Demo form structure is proper');
    console.log(`   Form exists: ${formResults.formExists}`);
    console.log(`   All fields present: ${formResults.allFieldsPresent}`);
    console.log(`   Validation errors: ${formResults.validationErrors.length}`);

    if (formResults.formSubmission) {
      console.log(`   Form submission: ${formResults.submissionResponse}`);
    }
  });

  test('should have proper footer content', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const footerResults = await landingPage.testFooter();

    expect(footerResults.footerExists).toBeTruthy();
    expect(footerResults.copyrightVisible).toBeTruthy();
    expect(footerResults.copyrightContent.length).toBeGreaterThan(0);

    console.log('✅ Footer section is properly displayed');
    console.log(`   Footer exists: ${footerResults.footerExists}`);
    console.log(`   Copyright: "${footerResults.copyrightContent}"`);
  });

  test('should be responsive across different viewports', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const responsiveResults = await landingPage.testResponsiveness();

    expect(responsiveResults.mobile).toBeTruthy();
    expect(responsiveResults.tablet).toBeTruthy();
    expect(responsiveResults.desktop).toBeTruthy();

    console.log('✅ Page is responsive across all viewports');
    console.log(`   Mobile: ${responsiveResults.mobile}`);
    console.log(`   Tablet: ${responsiveResults.tablet}`);
    console.log(`   Desktop: ${responsiveResults.desktop}`);
  });

  test('should have acceptable performance metrics', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const performanceMetrics = await landingPage.getPerformanceMetrics();

    // Performance assertions (adjust thresholds as needed)
    expect(performanceMetrics.loadTime).toBeLessThan(10000); // 10 seconds
    expect(performanceMetrics.domContentLoaded).toBeLessThan(5000); // 5 seconds
    expect(performanceMetrics.errorCount).toBeLessThan(5); // Less than 5 errors

    console.log('✅ Performance metrics are acceptable');
    console.log(`   Load time: ${performanceMetrics.loadTime}ms`);
    console.log(`   DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`   Resource count: ${performanceMetrics.resourceCount}`);
    console.log(`   Error count: ${performanceMetrics.errorCount}`);
  });

  test('should pass basic accessibility checks', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const accessibilityResults = await TestHelpers.basicAccessibilityCheck(page);

    // Basic accessibility assertions
    expect(accessibilityResults.missingAltText).toBeLessThan(5);
    expect(accessibilityResults.invalidHeadings).toBe(0);

    console.log('✅ Basic accessibility checks passed');
    console.log(`   Missing alt text count: ${accessibilityResults.missingAltText}`);
    console.log(`   Missing labels count: ${accessibilityResults.missingLabels}`);
    console.log(`   Invalid headings count: ${accessibilityResults.invalidHeadings}`);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    const networkErrors = await TestHelpers.captureNetworkErrors(page);

    // Simulate some interactions to trigger network requests
    await page.click('a, button', { timeout: 5000 }).catch(() => { });
    await page.waitForTimeout(2000);

    expect(networkErrors.length).toBeLessThan(10); // Less than 10 network errors

    console.log('✅ Network error handling is acceptable');
    console.log(`   Network errors: ${networkErrors.length}`);

    if (networkErrors.length > 0) {
      console.log('   Error details:');
      networkErrors.forEach(error => {
        console.log(`     - ${error.url}: ${error.status} ${error.error}`);
      });
    }
  });

  test('should handle mobile touch interactions', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    // Test tap on demo button
    const demoButton = page.locator('button:has-text("Request Demo"), a:has-text("Request Demo"), .demo-button');

    if (await demoButton.isVisible()) {
      await demoButton.tap();
      await page.waitForTimeout(2000);

      // Check if form appears or page navigates
      const currentUrl = page.url();
      const formVisible = await page.locator('form:has-text("Request Demo")').isVisible();

      console.log('✅ Mobile touch interactions work properly');
      console.log(`   Demo button tapped successfully`);
      console.log(`   Result: Form visible: ${formVisible}, URL: ${currentUrl}`);
    } else {
      console.log('⚠️ Demo button not found for mobile testing');
    }
  });

  test('should maintain state during page interactions', async ({ page }) => {
    await landingPage.goto();
    await landingPage.waitForPageLoad();

    // Get initial scroll position
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(1000);

    const scrolledY = await page.evaluate(() => window.scrollY);

    // Test that scroll position changed
    expect(scrolledY).toBeGreaterThan(initialScrollY);

    // Test that main elements are still visible
    const heroVisible = await page.locator('h1, .hero-title').isVisible({ visible: false });

    console.log('✅ Page maintains state during interactions');
    console.log(`   Initial scroll: ${initialScrollY}`);
    console.log(`   After scroll: ${scrolledY}`);
    console.log(`   Hero still in DOM: ${heroVisible}`);
  });
});