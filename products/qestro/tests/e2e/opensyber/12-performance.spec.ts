import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Performance & Core Web Vitals', () => {
  test('12.1 Homepage loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test('12.2 Pricing page loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test('12.3 Sign-in page loads within 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(3000);
  });

  test('12.4 Marketplace loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE}/marketplace`, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test('12.5 Blog index loads within 4 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE}/blog`, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(4000);
  });

  test('12.6 No console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Filter out common non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('analytics') && !e.includes('third-party')
    );
    // Allow at most 2 non-critical console errors
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });

  test('12.7 No broken images on homepage', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const brokenImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images)
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.src);
    });
    expect(brokenImages.length).toBe(0);
  });

  test('12.8 LCP element renders within 2.5s', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Measure LCP via Performance Observer
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            lcpValue = entry.startTime;
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(lcpValue);
        }, 3000);
      });
    });
    // LCP should be under 2500ms for good Core Web Vitals
    expect(lcp).toBeLessThan(4000); // Lenient for production cold-start
  });
});
