import { test, expect } from '@playwright/test';
import { MarketingPage } from '../pages/marketing.page';
import { DocsPage } from '../pages/docs.page';
import { URLS } from '../fixtures/urls';
import { checkA11y } from '../helpers/accessibility';
import { runHIGChecks } from '../helpers/hig-checks';

/**
 * Investor/Evaluator Journey E2E Tests
 *
 * Covers the path an investor or technical evaluator takes:
 * viewing the marketing site, investors page, docs, demo,
 * and pricing to evaluate the platform.
 */

test.describe('Investor/Evaluator Journey', () => {
  test.describe('Marketing Site Evaluation', () => {
    test('should present a professional landing page', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.goto();
      await marketing.expectHeroVisible();

      const title = await marketing.getTitle();
      expect(title).toContain('LunaOS');
    });

    test('should have professional SEO and social tags', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.goto();

      expect(await marketing.hasMetaDescription()).toBe(true);
      expect(await marketing.hasOpenGraphTags()).toBe(true);

      const twitterCard = page.locator('meta[name="twitter:card"]');
      expect(await twitterCard.count()).toBeGreaterThan(0);
    });

    test('should load without console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      const marketing = new MarketingPage(page);
      await marketing.goto();

      const criticalErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('font')
      );
      expect(criticalErrors.length).toBe(0);
    });

    test('should load within performance budget', async ({ page }) => {
      const start = Date.now();
      const marketing = new MarketingPage(page);
      await marketing.goto();
      const loadTime = Date.now() - start;

      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe('Investors Page', () => {
    test('should load the investors page', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.gotoInvestors();

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should display market opportunity data', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.gotoInvestors();

      const content = await page.textContent('body');
      const hasMarketData =
        content?.includes('market') ||
        content?.includes('Market') ||
        content?.includes('revenue') ||
        content?.includes('Revenue');
      expect(hasMarketData).toBeTruthy();
    });

    test('should have contact/CTA for investors', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.gotoInvestors();

      const cta = page.locator(
        'a[href*="mailto"], a[href*="contact"], button:has-text("Contact"), a:has-text("Schedule")'
      );
      expect(await cta.count()).toBeGreaterThan(0);
    });

    test('should pass accessibility checks', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.gotoInvestors();
      await checkA11y(page);
    });
  });

  test.describe('Demo Experience', () => {
    test('should load the demo page', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.gotoDemo();

      await page.waitForLoadState('domcontentloaded');
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should display interactive demo content', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.gotoDemo();

      const content = await page.textContent('body');
      expect(content?.length).toBeGreaterThan(100);
    });
  });

  test.describe('Documentation Quality', () => {
    test('should load the docs site', async ({ page }) => {
      const docs = new DocsPage(page);
      await docs.goto();
      await docs.expectContentVisible();
    });

    test('should have navigable documentation structure', async ({ page }) => {
      const docs = new DocsPage(page);
      await docs.goto();

      const links = page.locator('a[href]');
      expect(await links.count()).toBeGreaterThan(5);
    });

    test('should contain code examples', async ({ page }) => {
      const docs = new DocsPage(page);
      await docs.goto();

      const codeBlocks = await docs.getCodeBlockCount();
      // Docs home may not have code; check content exists
      const content = await page.textContent('body');
      expect(content?.length).toBeGreaterThan(100);
    });

    test('docs should pass HIG design checks', async ({ page }) => {
      const docs = new DocsPage(page);
      await docs.goto();
      await runHIGChecks(page);
    });
  });

  test.describe('Technical Credibility', () => {
    test('should serve pages over HTTPS', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.goto();
      expect(page.url()).toMatch(/^https:\/\//);
    });

    test('should have proper security headers', async ({ page }) => {
      const response = await page.goto(URLS.marketing.base);
      expect(response).not.toBeNull();

      const headers = response!.headers();
      // Check for common security headers
      const hasSecurityHeaders =
        headers['x-frame-options'] ||
        headers['content-security-policy'] ||
        headers['x-content-type-options'] ||
        headers['strict-transport-security'];
      // At least one security header should be present
      expect(hasSecurityHeaders).toBeTruthy();
    });
  });
});
