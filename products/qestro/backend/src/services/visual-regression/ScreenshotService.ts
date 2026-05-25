'use strict';

import { chromium, firefox, webkit, Browser, Page } from 'playwright';
import { CaptureOptions } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Screenshot Service - Captures screenshots via Playwright
 */

interface BrowserPoolConfig {
  maxSize?: number;
  idleTimeout?: number;
}

class ScreenshotService {
  private browserPool: Map<string, Browser> = new Map();
  private pagePool: Map<string, Page[]> = new Map();
  private config: BrowserPoolConfig;

  constructor(config: BrowserPoolConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 3,
      idleTimeout: config.idleTimeout ?? 30000,
    };
  }

  /**
   * Capture screenshot of a URL
   */
  async captureScreenshot(options: CaptureOptions): Promise<Buffer> {
    const timer = { start: Date.now() };
    const browser = await this.getBrowser('chromium');
    const page = await browser.newPage({
      viewport: options.viewport || { width: 1280, height: 720 },
    });

    try {
      logger.debug('Capturing screenshot', { url: options.url });

      await this.navigateAndWait(page, options);
      const screenshot = await page.screenshot({
        fullPage: false,
        type: 'png',
      });

      logger.info('Screenshot captured', {
        url: options.url,
        size: screenshot.length,
        duration: Date.now() - timer.start,
      });

      return screenshot;
    } finally {
      await page.close();
    }
  }

  /**
   * Capture full page screenshot (scrolls to capture entire content)
   */
  async captureFullPage(options: CaptureOptions): Promise<Buffer> {
    const timer = { start: Date.now() };
    const browser = await this.getBrowser('chromium');
    const page = await browser.newPage({
      viewport: options.viewport || { width: 1280, height: 720 },
    });

    try {
      logger.debug('Capturing full page screenshot', { url: options.url });

      await this.navigateAndWait(page, options);
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      logger.info('Full page screenshot captured', {
        url: options.url,
        size: screenshot.length,
        duration: Date.now() - timer.start,
      });

      return screenshot;
    } finally {
      await page.close();
    }
  }

  /**
   * Capture screenshot of a specific element
   */
  async captureElement(options: CaptureOptions): Promise<Buffer> {
    if (!options.selector) {
      throw new Error('selector required for captureElement');
    }

    const timer = { start: Date.now() };
    const browser = await this.getBrowser('chromium');
    const page = await browser.newPage({
      viewport: options.viewport || { width: 1280, height: 720 },
    });

    try {
      logger.debug('Capturing element screenshot', {
        url: options.url,
        selector: options.selector,
      });

      await this.navigateAndWait(page, options);

      const element = await page.locator(options.selector).first().boundingBox();
      if (!element) {
        throw new Error(`Element not found: ${options.selector}`);
      }

      const screenshot = await page.screenshot({
        clip: element,
        type: 'png',
      });

      logger.info('Element screenshot captured', {
        selector: options.selector,
        size: screenshot.length,
        duration: Date.now() - timer.start,
      });

      return screenshot;
    } finally {
      await page.close();
    }
  }

  /**
   * Navigate page and wait for ready state
   */
  private async navigateAndWait(page: Page, options: CaptureOptions): Promise<void> {
    const timeout = options.timeout || 30000;

    await page.goto(options.url, {
      waitUntil: 'networkidle',
      timeout,
    });

    if (options.waitSelector) {
      await page.locator(options.waitSelector).first().waitFor({ timeout });
    }

    if (options.waitTime) {
      await page.waitForTimeout(options.waitTime);
    }
  }

  /**
   * Get or create browser from pool
   */
  private async getBrowser(browserType: 'chromium' | 'firefox' | 'webkit'): Promise<Browser> {
    let browser = this.browserPool.get(browserType);

    if (!browser) {
      logger.debug('Launching browser', { browserType });

      const launcher =
        browserType === 'firefox' ? firefox : browserType === 'webkit' ? webkit : chromium;
      browser = await launcher.launch({
        headless: true,
        args: ['--disable-dev-shm-usage'],
      });

      this.browserPool.set(browserType, browser);
    }

    return browser;
  }

  /**
   * Close all browser instances
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up browser pool');

    for (const [browserType, browser] of this.browserPool) {
      try {
        await browser.close();
        logger.debug('Browser closed', { browserType });
      } catch (error) {
        logger.error('Error closing browser', { browserType, error });
      }
    }

    this.browserPool.clear();
    this.pagePool.clear();
  }
}

let instance: ScreenshotService;

/**
 * Get or create singleton instance
 */
export function getScreenshotService(config?: BrowserPoolConfig): ScreenshotService {
  if (!instance) {
    instance = new ScreenshotService(config);
  }
  return instance;
}

export { ScreenshotService };
export default getScreenshotService();
