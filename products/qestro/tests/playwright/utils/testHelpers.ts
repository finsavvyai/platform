/**
 * Playwright Test Helpers
 * Utility functions for Playwright tests
 */

import { Page, Browser, BrowserContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export class PlaywrightTestHelpers {
  /**
   * Wait for network to be idle
   */
  static async waitForNetworkIdle(page: Page, timeout: number = 30000): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Wait for all images to load
   */
  static async waitForImages(page: Page): Promise<void> {
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve;
          }))
      );
    });
  }

  /**
   * Simulate slow network conditions
   */
  static async simulateSlowNetwork(page: Page): Promise<void> {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 40 // 40ms
    });
  }

  /**
   * Reset network conditions
   */
  static async resetNetworkConditions(page: Page): Promise<void> {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
  }

  /**
   * Take full page screenshot with timestamp
   */
  static async takeTimestampedScreenshot(page: Page, name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const screenshotPath = path.join('test-results', 'screenshots', filename);
    
    // Ensure directory exists
    const dir = path.dirname(screenshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  /**
   * Generate test data file
   */
  static generateTestDataFile(data: any, filename: string): string {
    const filePath = path.join('test-results', 'data', `${filename}.json`);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  /**
   * Mock API responses
   */
  static async mockApiResponse(page: Page, url: string | RegExp, response: any): Promise<void> {
    await page.route(url, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Mock API error
   */
  static async mockApiError(page: Page, url: string | RegExp, status: number = 500): Promise<void> {
    await page.route(url, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mocked error' })
      });
    });
  }

  /**
   * Intercept and log network requests
   */
  static async logNetworkRequests(page: Page): Promise<void> {
    page.on('request', request => {
      console.log(`→ ${request.method()} ${request.url()}`);
    });
    
    page.on('response', response => {
      console.log(`← ${response.status()} ${response.url()}`);
    });
  }

  /**
   * Wait for specific API call
   */
  static async waitForApiCall(page: Page, urlPattern: string | RegExp, timeout: number = 30000): Promise<any> {
    const response = await page.waitForResponse(urlPattern, { timeout });
    return await response.json();
  }

  /**
   * Fill form with data
   */
  static async fillForm(page: Page, formData: Record<string, string>): Promise<void> {
    for (const [selector, value] of Object.entries(formData)) {
      await page.fill(selector, value);
    }
  }

  /**
   * Get form data
   */
  static async getFormData(page: Page, formSelector: string): Promise<Record<string, string>> {
    return await page.evaluate((selector) => {
      const form = document.querySelector(selector) as HTMLFormElement;
      if (!form) return {};
      
      const formData = new FormData(form);
      const data: Record<string, string> = {};
      
      for (const [key, value] of formData.entries()) {
        data[key] = value.toString();
      }
      
      return data;
    }, formSelector);
  }

  /**
   * Scroll element into view
   */
  static async scrollIntoView(page: Page, selector: string): Promise<void> {
    await page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Wait for element to be stable (not moving)
   */
  static async waitForElementStable(page: Page, selector: string, timeout: number = 5000): Promise<void> {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible' });
    
    let previousBox = await element.boundingBox();
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      await page.waitForTimeout(100);
      const currentBox = await element.boundingBox();
      
      if (previousBox && currentBox &&
          previousBox.x === currentBox.x &&
          previousBox.y === currentBox.y &&
          previousBox.width === currentBox.width &&
          previousBox.height === currentBox.height) {
        return;
      }
      
      previousBox = currentBox;
    }
  }

  /**
   * Get element CSS property
   */
  static async getCSSProperty(page: Page, selector: string, property: string): Promise<string> {
    return await page.evaluate(
      ({ selector, property }) => {
        const element = document.querySelector(selector);
        if (!element) return '';
        return window.getComputedStyle(element).getPropertyValue(property);
      },
      { selector, property }
    );
  }

  /**
   * Check if element is in viewport
   */
  static async isElementInViewport(page: Page, selector: string): Promise<boolean> {
    return await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }, selector);
  }

  /**
   * Get page performance metrics
   */
  static async getPerformanceMetrics(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: paint.find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
        totalLoadTime: navigation.loadEventEnd - navigation.fetchStart
      };
    });
  }

  /**
   * Create browser context with specific settings
   */
  static async createContextWithSettings(browser: Browser, settings: {
    viewport?: { width: number; height: number };
    userAgent?: string;
    locale?: string;
    timezone?: string;
    permissions?: string[];
  }): Promise<BrowserContext> {
    return await browser.newContext({
      viewport: settings.viewport,
      userAgent: settings.userAgent,
      locale: settings.locale,
      timezoneId: settings.timezone,
      permissions: settings.permissions
    });
  }

  /**
   * Cleanup test artifacts
   */
  static cleanupTestArtifacts(): void {
    const artifactsDir = 'test-results';
    if (fs.existsSync(artifactsDir)) {
      const files = fs.readdirSync(artifactsDir);
      files.forEach(file => {
        const filePath = path.join(artifactsDir, file);
        if (fs.statSync(filePath).isFile() && file.endsWith('.tmp')) {
          fs.unlinkSync(filePath);
        }
      });
    }
  }
}