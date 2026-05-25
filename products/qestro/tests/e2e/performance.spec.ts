import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from './fixtures/auth.fixture';

function loadBudget(projectName: string) {
  return projectName === 'mobile' ? 15000 : 8000;
}

function lcpBudget(projectName: string) {
  return projectName === 'mobile' ? 15000 : 5000;
}

async function waitForPageReady(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  await page.waitForLoadState('domcontentloaded');
  await expect(locator).toBeVisible({ timeout: 15000 });
}

test.describe('Performance Testing', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('should load dashboard within performance budget', async ({ page }) => {
    const budget = loadBudget(test.info().project.name);
    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('h2, h1').first());

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(budget);
  });

  test('should load runs page efficiently', async ({ page }) => {
    await page.route('**/api/runs', async route => {
      const runs = Array.from({ length: 50 }, (_, i) => ({
        id: `run-${i}`,
        name: `Test Run ${i}`,
        type: 'mobile',
        platform: 'ios',
        duration: Math.floor(Math.random() * 300) + 30,
        actions: Math.floor(Math.random() * 50) + 5,
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          runs,
          total: runs.length,
          page: 1,
          totalPages: 1,
        }),
      });
    });

    const budget = loadBudget(test.info().project.name);
    const startTime = Date.now();

    await page.goto('/runs', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('main').first());

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(budget);
  });

  test('should load recording studio efficiently', async ({ page }) => {
    const budget = loadBudget(test.info().project.name);
    const startTime = Date.now();

    await page.goto('/recording-studio', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('h1').first());

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(budget);
  });

  test('should handle navigation between pages', async ({ page }) => {
    const budget = loadBudget(test.info().project.name);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('h2, h1').first());

    const startTime = Date.now();

    await page.goto('/recording-studio', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('h1').first());

    const navTime = Date.now() - startTime;

    expect(navTime).toBeLessThan(budget);
  });

  test('should load test cases page efficiently', async ({ page }) => {
    const budget = loadBudget(test.info().project.name);
    const startTime = Date.now();

    await page.goto('/cases', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('main').first());

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(budget);
  });

  test('should load insights page efficiently', async ({ page }) => {
    const budget = loadBudget(test.info().project.name);
    const startTime = Date.now();

    await page.goto('/insights', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('main').first());

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(budget);
  });

  test('should measure Core Web Vitals', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__PERFORMANCE_METRICS__ = {};

      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        (window as any).__PERFORMANCE_METRICS__.lcp = lastEntry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      let clsValue = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        (window as any).__PERFORMANCE_METRICS__.cls = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, page.locator('h2, h1').first());
    await page.waitForTimeout(2000);

    const metrics = await page.evaluate(
      () => (window as any).__PERFORMANCE_METRICS__,
    );

    // Verify Core Web Vitals thresholds
    if (metrics.lcp) {
      expect(metrics.lcp).toBeLessThan(lcpBudget(test.info().project.name));
    }

    if (metrics.cls !== undefined) {
      expect(metrics.cls).toBeLessThan(0.1);
    }
  });

  test('should handle concurrent page contexts', async ({ page }) => {
    const context = page.context();
    const page2 = await context.newPage();

    await mockAuth(page2);

    // Load two pages concurrently
    await Promise.all([
      page.goto('/'),
      page2.goto('/recording-studio'),
    ]);

    await Promise.all([
      waitForPageReady(page, page.locator('h2, h1').first()),
      waitForPageReady(page2, page2.locator('h1').first()),
    ]);

    // Both pages should have rendered
    await expect(page.locator('h2').first()).toBeVisible();
    await expect(page2.locator('h1').first()).toBeVisible();

    await page2.close();
  });
});
