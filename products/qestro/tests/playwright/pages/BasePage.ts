/**
 * Base Page Object Model
 * Provides common functionality for all page objects
 */

import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;
  protected url: string;

  constructor(page: Page, url: string = '') {
    this.page = page;
    this.url = url;
  }

  // Navigation methods
  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForLoad();
  }

  // Common element interactions
  async clickElement(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  async fillInput(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.selectOption(selector, value);
  }

  async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.page.setInputFiles(selector, filePath);
  }

  // Wait methods
  async waitForElement(selector: string, timeout: number = 10000): Promise<Locator> {
    return await this.page.waitForSelector(selector, { timeout });
  }

  async waitForElementToBeHidden(selector: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'hidden', timeout });
  }

  async waitForUrl(pattern: string | RegExp, timeout: number = 10000): Promise<void> {
    await this.page.waitForURL(pattern, { timeout });
  }

  // Assertion helpers
  async expectElementToBeVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async expectElementToBeHidden(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeHidden();
  }

  async expectElementToHaveText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toHaveText(text);
  }

  async expectElementToContainText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  async expectUrlToMatch(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  async expectTitleToContain(text: string): Promise<void> {
    await expect(this.page).toHaveTitle(new RegExp(text));
  }

  // Screenshot and debugging
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }

  async getElementText(selector: string): Promise<string> {
    return await this.page.locator(selector).textContent() || '';
  }

  async getElementAttribute(selector: string, attribute: string): Promise<string | null> {
    return await this.page.locator(selector).getAttribute(attribute);
  }

  async isElementVisible(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  async isElementEnabled(selector: string): Promise<boolean> {
    return await this.page.locator(selector).isEnabled();
  }

  // Form helpers
  async submitForm(formSelector: string): Promise<void> {
    await this.page.locator(formSelector).press('Enter');
  }

  async clearInput(selector: string): Promise<void> {
    await this.page.locator(selector).clear();
  }

  // JavaScript execution
  async executeScript<T>(script: string): Promise<T> {
    return await this.page.evaluate(script);
  }

  async scrollToElement(selector: string): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  // Cookie and storage helpers
  async getCookies() {
    return await this.page.context().cookies();
  }

  async setCookie(name: string, value: string, domain?: string): Promise<void> {
    await this.page.context().addCookies([{
      name,
      value,
      domain: domain || new URL(this.page.url()).hostname,
      path: '/'
    }]);
  }

  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((key) => localStorage.getItem(key), key);
  }

  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key, value }
    );
  }

  // Network helpers
  async waitForResponse(urlPattern: string | RegExp, timeout: number = 30000): Promise<void> {
    await this.page.waitForResponse(urlPattern, { timeout });
  }

  async waitForRequest(urlPattern: string | RegExp, timeout: number = 30000): Promise<void> {
    await this.page.waitForRequest(urlPattern, { timeout });
  }

  // Mobile helpers
  async setViewportSize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  async emulateDevice(deviceName: string): Promise<void> {
    // This would require importing devices from @playwright/test
    // await this.page.emulate(devices[deviceName]);
  }

  // Performance helpers
  async measurePageLoadTime(): Promise<number> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navigation.loadEventEnd - navigation.loadEventStart;
    });
  }

  async getPerformanceMetrics(): Promise<any> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
  }
}