import { test, expect } from '@playwright/test';

/**
 * Performance smoke tests — verify pages load within acceptable timeframes.
 * These are not comprehensive perf tests, but catch regressions where
 * a page becomes unusably slow (e.g., SSR timeout, infinite loop).
 */
const PUBLIC_PAGES = [
  { path: '/', maxMs: 30000, name: 'Landing' },
  { path: '/pricing', maxMs: 30000, name: 'Pricing' },
  { path: '/enterprise', maxMs: 30000, name: 'Enterprise' },
  { path: '/marketplace', maxMs: 30000, name: 'Marketplace' },
  { path: '/docs', maxMs: 30000, name: 'Docs' },
  { path: '/blog', maxMs: 30000, name: 'Blog' },
  { path: '/demo', maxMs: 30000, name: 'Demo' },
  { path: '/openagent', maxMs: 30000, name: 'OpenAgent' },
  { path: '/openagent/install', maxMs: 30000, name: 'OpenAgent Install' },
  { path: '/threats', maxMs: 30000, name: 'Threats' },
  { path: '/privacy', maxMs: 30000, name: 'Privacy' },
  { path: '/terms', maxMs: 30000, name: 'Terms' },
];

test.describe('Page Load Performance', () => {
  for (const { path, maxMs, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) loads under ${maxMs}ms`, async ({ page }) => {
      const start = Date.now();
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      const elapsed = Date.now() - start;

      expect(res?.status()).toBeLessThan(500);
      expect(elapsed).toBeLessThan(maxMs);
    });
  }
});

test.describe('No JavaScript Errors on Public Pages', () => {
  for (const { path, name } of PUBLIC_PAGES.slice(0, 6)) {
    test(`${name} has no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(path);
      await page.waitForTimeout(2000);

      // Filter out known benign errors (Clerk, analytics, resource 403s)
      const realErrors = errors.filter(
        (e) =>
          !e.includes('clerk') &&
          !e.includes('analytics') &&
          !e.includes('gtag') &&
          !e.includes('favicon') &&
          !e.includes('Failed to load resource') &&
          !e.includes('403')
      );
      expect(realErrors).toEqual([]);
    });
  }
});

test.describe('No Network Errors on Public Pages', () => {
  test('landing page has no failed requests', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500 && !res.url().includes('clerk')) {
        failures.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    expect(failures).toEqual([]);
  });
});
