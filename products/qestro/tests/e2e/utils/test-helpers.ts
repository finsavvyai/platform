/**
 * E2E Test Helper Functions
 * Reusable utilities for Playwright tests
 */

import { Page, expect } from '@playwright/test';
import { TestUser } from '../fixtures/test-users';

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Some app shells keep polling or sockets open; fall back to a loaded DOM.
    await page.waitForLoadState('domcontentloaded');
  }
}

/**
 * Wait for element to be visible and ready for interaction
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
) {
  const element = page.locator(selector);
  await element.waitFor({ state: options?.state || 'visible', timeout: options?.timeout || 10000 });
  return element;
}

/**
 * Fill form field with proper waiting and validation
 */
export async function fillFormField(page: Page, selector: string, value: string) {
  const field = await waitForElement(page, selector);
  await field.clear();
  await field.fill(value);
  await expect(field).toHaveValue(value);
}

/**
 * Click button and wait for navigation
 */
export async function clickAndWaitForNavigation(
  page: Page,
  selector: string,
  options?: { url?: string | RegExp; timeout?: number }
) {
  await Promise.all([
    page.waitForNavigation({ url: options?.url, timeout: options?.timeout || 30000 }),
    page.click(selector),
  ]);
}

/**
 * Take screenshot with descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Check for console errors
 */
export async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number }
) {
  return await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: options?.timeout || 30000 }
  );
}

/**
 * Check if user is authenticated (Zustand qestro-auth store)
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('qestro-auth');
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.isAuthenticated === true;
    } catch {
      return false;
    }
  });
}

/**
 * Get authentication token from local storage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  });
}

/**
 * Set authentication via Zustand store in local storage
 */
export async function setAuthToken(page: Page, token: string) {
  await page.evaluate((t) => {
    localStorage.setItem('access_token', t);
  }, token);
}

/**
 * Clear all local storage
 */
export async function clearStorage(page: Page) {
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch (error) {
    // Ignore errors when accessing localStorage on about:blank or restricted origins
    console.log('Note: Could not clear storage (likely on about:blank)');
  }
}

/**
 * Generate random string for unique identifiers
 */
export function randomString(length = 10): string {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
}

/**
 * Generate random email
 */
export function randomEmail(domain = 'questro.test'): string {
  return `test.${randomString()}@${domain}`;
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(page: Page, selector: string, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { state: 'detached', timeout });
  } catch (error) {
    // Element already gone, that's fine
  }
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Check if element exists (without throwing error)
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector);
    return (await element.count()) > 0;
  } catch {
    return false;
  }
}

/**
 * Get element text content
 */
export async function getTextContent(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector);
  return (await element.textContent()) || '';
}

/**
 * Assert no JavaScript errors on page
 */
export async function assertNoJSErrors(page: Page, errors: string[]) {
  const ignoredPatterns = [
    'Hydration failed',
    'initial UI does not match',
    'validateDOMNesting',
    'There was an error while hydrating',
    'Failed to load resource:',
    'net::ERR_FAILED',
    'Cross-Origin Request Blocked',
    'CORS request did not succeed',
    'Could not connect to the server.',
    'due to access control checks.',
    'http://127.0.0.1:3999/',
    'ws://127.0.0.1:3998/',
  ];

  const criticalErrors = errors.filter(
    (err) => !ignoredPatterns.some((pattern) => err.includes(pattern))
  );

  if (criticalErrors.length > 0) {
    const url = page.url();
    const isLocalPage = url.includes('127.0.0.1') || url.includes('localhost');

    if (isLocalPage) {
      throw new Error(`Page has ${criticalErrors.length} JavaScript errors: ${criticalErrors.join(' | ')}`);
    }

    console.error('JavaScript errors detected:', criticalErrors);
  }
}

/**
 * Mock API response
 */
export async function mockAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  responseData: any,
  statusCode = 200
) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });
}

/**
 * Wait for specific number of milliseconds
 */
export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry action until it succeeds or timeout
 */
export async function retryUntilSuccess<T>(
  action: () => Promise<T>,
  options?: {
    maxRetries?: number;
    delayMs?: number;
    timeoutMs?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries || 5;
  const delayMs = options?.delayMs || 1000;
  const timeoutMs = options?.timeoutMs || 30000;
  const startTime = Date.now();

  for (let i = 0; i < maxRetries; i++) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Retry timeout after ${timeoutMs}ms`);
    }

    try {
      return await action();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await wait(delayMs);
    }
  }

  throw new Error('Retry failed');
}
