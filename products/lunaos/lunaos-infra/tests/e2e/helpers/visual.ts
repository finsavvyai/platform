import { type Page, expect } from '@playwright/test';

/**
 * Visual regression testing helpers.
 * Captures full-page and component-level screenshots
 * for comparison across test runs.
 */

export interface ScreenshotOptions {
  name: string;
  fullPage?: boolean;
  maxDiffPixelRatio?: number;
  threshold?: number;
}

export async function expectScreenshot(
  page: Page,
  options: ScreenshotOptions
): Promise<void> {
  const { name, fullPage = true, maxDiffPixelRatio = 0.02, threshold = 0.2 } = options;

  await page.waitForLoadState('networkidle');
  await hideAnimations(page);

  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage,
    maxDiffPixelRatio,
    threshold,
    animations: 'disabled',
  });
}

export async function expectComponentScreenshot(
  page: Page,
  selector: string,
  name: string
): Promise<void> {
  await page.waitForLoadState('networkidle');
  await hideAnimations(page);

  const element = page.locator(selector).first();
  await expect(element).toBeVisible();

  await expect(element).toHaveScreenshot(`${name}.png`, {
    maxDiffPixelRatio: 0.02,
    threshold: 0.2,
    animations: 'disabled',
  });
}

async function hideAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  });
}

export async function waitForPageStable(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

export async function getPagePerformance(
  page: Page
): Promise<{ lcp: number; fcp: number; ttfb: number }> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((e) => e.name === 'first-contentful-paint');

    return {
      lcp: 0,
      fcp: fcp?.startTime || 0,
      ttfb: nav?.responseStart || 0,
    };
  });
}
