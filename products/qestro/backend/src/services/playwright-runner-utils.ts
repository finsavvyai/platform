'use strict';

import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Utilities for Playwright test execution
 */

/**
 * Attach console listener to capture logs
 */
export function attachConsoleListener(
  page: Page,
  consoleLogs: string[]
): void {
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
}

/**
 * Attach network listener to track requests
 */
export function attachNetworkListener(
  page: Page,
  networkRequests: Array<{ url: string; method: string; status?: number }>
): void {
  page.on('response', (response) => {
    networkRequests.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
    });
  });
}

/**
 * Compile test code into executable function
 */
export function compileTestCode(
  code: string
): (page: Page) => Promise<void> {
  // Validate code before compiling to prevent code injection
  const { validateCode } = require('../lib/code-sandbox.js');
  const validation = validateCode(code);
  if (!validation.safe) {
    throw new Error(`Unsafe test code blocked: ${validation.violations.join(', ')}`);
  }
  try {
    const fn = new Function('page', `'use strict';\n${code}`);
    return fn as (page: Page) => Promise<void>;
  } catch (error) {
    throw new Error(`Failed to compile test code: ${error}`);
  }
}

/**
 * Capture screenshot on failure
 */
export async function captureFailureScreenshot(
  page: Page | null,
  testId: string,
  screenshotsDir: string,
  consoleLogs: string[]
): Promise<string[]> {
  if (!page) return [];

  try {
    const filename = `${testId}-failure-${Date.now()}.png`;
    const filepath = path.join(screenshotsDir, filename);
    await page.screenshot({ path: filepath });
    return [filepath];
  } catch (error) {
    consoleLogs.push(`Failed to capture screenshot: ${error}`);
    return [];
  }
}

/**
 * Ensure screenshots directory exists
 */
export function ensureScreenshotsDir(screenshotsDir: string): void {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
}

/**
 * Capture screenshot manually
 */
export async function captureScreenshot(
  page: Page | null,
  name: string,
  screenshotsDir: string
): Promise<Buffer> {
  if (!page) {
    throw new Error('No active page for screenshot');
  }

  const buffer = await page.screenshot();
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(screenshotsDir, filename);
  fs.writeFileSync(filepath, buffer);
  return buffer;
}
