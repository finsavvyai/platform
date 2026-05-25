import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export class TestHelpers {
  /**
   * Wait for a specified amount of time
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Take a screenshot with proper naming
   */
  static async takeScreenshot(page: Page, testName: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `test-results/screenshots/${testName}-${timestamp}.png`;

    // Ensure directory exists
    const dir = path.dirname(screenshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  /**
   * Generate random test data
   */
  static generateTestData() {
    return {
      email: `test-${Date.now()}@sdlc.cc`,
      name: `Test User ${Date.now()}`,
      company: `Test Company ${Date.now()}`,
      phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      message: `This is a test message generated at ${new Date().toISOString()}`,
    };
  }

  /**
   * Check if a service is healthy
   */
  static async checkServiceHealth(url: string, timeout = 5000): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout)
      });
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${url}:`, error);
      return false;
    }
  }

  /**
   * Measure page load performance
   */
  static async measurePagePerformance(page: Page, url: string): Promise<{
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
  }> {
    const navigationStart = Date.now();

    const metrics = await page.goto(url, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - navigationStart;

    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        largestContentfulPaint: 0, // Would need PerformanceObserver
      };
    });

    return {
      loadTime,
      ...performanceMetrics,
    };
  }

  /**
   * Check network requests for errors
   */
  static async captureNetworkErrors(page: Page): Promise<Array<{url: string, status: number, error: string}>> {
    const errors: Array<{url: string, status: number, error: string}> = [];

    page.on('response', response => {
      if (response.status() >= 400) {
        errors.push({
          url: response.url(),
          status: response.status(),
          error: response.statusText()
        });
      }
    });

    return errors;
  }

  /**
   * Validate accessibility (basic check)
   */
  static async basicAccessibilityCheck(page: Page): Promise<{
    missingAltText: number;
    missingLabels: number;
    invalidHeadings: number;
  }> {
    const results = await page.evaluate(() => {
      const missingAltText = document.querySelectorAll('img:not([alt])').length;
      const missingLabels = document.querySelectorAll('input:not([aria-label]):not([placeholder])').length;

      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headingLevels = Array.from(headings).map(h => parseInt(h.tagName.substring(1)));
      const invalidHeadings = headingLevels.filter((level, index) =>
        index > 0 && level > headingLevels[index - 1] + 1
      ).length;

      return {
        missingAltText,
        missingLabels,
        invalidHeadings
      };
    });

    return results;
  }

  /**
   * Test mobile responsiveness
   */
  static async testMobileResponsiveness(page: Page, url: string): Promise<{
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  }> {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 }
    ];

    const results = { mobile: false, tablet: false, desktop: false };

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(url, { waitUntil: 'networkidle' });

      // Check if layout adapts properly
      const isResponsive = await page.evaluate((expectedWidth) => {
        const hasHorizontalScroll = document.body.scrollWidth > window.innerWidth;
        const contentWidth = document.querySelector('.container, .content, main')?.clientWidth || 0;
        return !hasHorizontalScroll && contentWidth <= expectedWidth * 1.1;
      }, viewport.width);

      results[viewport.name as keyof typeof results] = isResponsive;
    }

    return results;
  }
}

/**
 * Custom test fixtures
 */
export const testWithHelpers = test.extend({
  helpers: async ({ page }, use) => {
    await use(TestHelpers);
  }
});

export { expect };