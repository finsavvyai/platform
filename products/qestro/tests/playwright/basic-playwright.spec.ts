/**
 * Basic Playwright Test
 * Simple test to verify Playwright configuration is working
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Playwright Configuration', () => {
  test('should load a basic page', async ({ page }) => {
    // Navigate to a simple page
    await page.goto('https://example.com');
    
    // Check page title
    await expect(page).toHaveTitle(/Example Domain/);
    
    // Check for main heading
    await expect(page.locator('h1')).toContainText('Example Domain');
  });

  test('should handle basic interactions', async ({ page }) => {
    await page.goto('https://example.com');
    
    // Check if page is loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/basic-test.png' });
  });

  test('should support TypeScript', async ({ page }) => {
    interface TestData {
      url: string;
      expectedTitle: string;
    }

    const testData: TestData = {
      url: 'https://example.com',
      expectedTitle: 'Example Domain'
    };

    await page.goto(testData.url);
    await expect(page).toHaveTitle(new RegExp(testData.expectedTitle));
  });

  test('should measure performance', async ({ page }) => {
    await page.goto('https://example.com');
    
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
      };
    });

    expect(performanceMetrics.loadTime).toBeGreaterThan(0);
    expect(performanceMetrics.domContentLoaded).toBeGreaterThan(0);
  });

  test('should handle async operations', async ({ page }) => {
    await page.goto('https://example.com');
    
    // Wait for network to be idle
    await page.waitForLoadState('networkidle');
    
    // Check that page is fully loaded
    const isLoaded = await page.evaluate(() => {
      return document.readyState === 'complete';
    });
    
    expect(isLoaded).toBe(true);
  });
});