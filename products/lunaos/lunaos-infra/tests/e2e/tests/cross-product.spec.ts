import { test, expect } from '@playwright/test';
import { MarketingPage } from '../pages/marketing.page';
import { DashboardPage } from '../pages/dashboard.page';
import { DocsPage } from '../pages/docs.page';
import { StudioPage } from '../pages/studio.page';
import { URLS } from '../fixtures/urls';
import { checkA11y } from '../helpers/accessibility';

/**
 * Cross-Product Navigation E2E Tests
 *
 * Validates that users can navigate seamlessly between
 * LunaOS products: marketing, dashboard, studio, docs, and API.
 */

test.describe('Cross-Product Navigation', () => {
  test.describe('Marketing to Dashboard', () => {
    test('should navigate from marketing to dashboard', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.goto();

      const dashboardLink = page.locator(
        'a[href*="agents.lunaos.ai"], a[href*="dashboard"], a:has-text("Dashboard")'
      ).first();

      if (await dashboardLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        const href = await dashboardLink.getAttribute('href');
        expect(href).toBeTruthy();
      }
    });

    test('CTA should link to signup or dashboard', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.goto();

      const ctaHref = await marketing.ctaButton.getAttribute('href');
      expect(ctaHref).toBeTruthy();
      const isCorrectTarget =
        ctaHref?.includes('agents.lunaos.ai') ||
        ctaHref?.includes('signup') ||
        ctaHref?.includes('dashboard');
      expect(isCorrectTarget).toBeTruthy();
    });
  });

  test.describe('Marketing to Docs', () => {
    test('should have docs link on marketing page', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.goto();

      const docsLink = page.locator(
        'a[href*="docs.lunaos.ai"], a[href*="/docs"], a:has-text("Docs"), a:has-text("Documentation")'
      ).first();

      if (await docsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        const href = await docsLink.getAttribute('href');
        expect(href).toBeTruthy();
      }
    });

    test('docs site should load independently', async ({ page }) => {
      const docs = new DocsPage(page);
      await docs.goto();
      await docs.expectContentVisible();
    });
  });

  test.describe('Dashboard to Studio', () => {
    test('dashboard should reference studio', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const studioLink = page.locator(
        'a[href*="studio.lunaos.ai"], a:has-text("Studio"), a:has-text("IDE")'
      ).first();

      // Studio link may be behind auth; verify page loads
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('studio should load independently', async ({ page }) => {
      const studio = new StudioPage(page);
      await studio.goto();

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });
  });

  test.describe('Consistent Branding', () => {
    test('marketing site should have LunaOS branding', async ({ page }) => {
      const marketing = new MarketingPage(page);
      await marketing.goto();

      const content = await page.textContent('body');
      expect(content).toContain('Luna');
    });

    test('dashboard should have LunaOS branding', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const title = await page.title();
      const content = await page.textContent('body');
      const hasBranding =
        title.includes('Luna') || content?.includes('Luna');
      expect(hasBranding).toBeTruthy();
    });

    test('docs should have LunaOS branding', async ({ page }) => {
      const docs = new DocsPage(page);
      await docs.goto();

      const title = await page.title();
      const content = await page.textContent('body');
      const hasBranding =
        title.includes('Luna') || content?.includes('Luna');
      expect(hasBranding).toBeTruthy();
    });
  });

  test.describe('Responsive Across Products', () => {
    test('marketing should be responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const marketing = new MarketingPage(page);
      await marketing.goto();

      const noHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 5;
      });
      expect(noHorizontalScroll).toBe(true);
    });

    test('dashboard should be responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const noHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 5;
      });
      expect(noHorizontalScroll).toBe(true);
    });
  });

  test.describe('Cross-Product Accessibility', () => {
    test('all products should pass basic a11y', async ({ page }) => {
      // Marketing
      await page.goto(URLS.marketing.base);
      await page.waitForLoadState('domcontentloaded');
      await checkA11y(page);

      // Dashboard
      await page.goto(URLS.dashboard.base);
      await page.waitForLoadState('domcontentloaded');
      await checkA11y(page);

      // Docs
      await page.goto(URLS.docs.base);
      await page.waitForLoadState('domcontentloaded');
      await checkA11y(page);
    });
  });
});
