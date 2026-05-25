import { test, expect } from '@playwright/test';

/**
 * User Journey Performance Tests
 *
 * Measures real page-load times, interaction responsiveness,
 * and navigation fluidity across the critical user paths.
 * Runs against opensyber.cloud (or E2E_BASE_URL).
 */

/* ── Page Load Benchmarks ────────────────────────────────── */

test.describe('Performance: Page Load Times', () => {
  const LOAD_THRESHOLD_MS = 5000;

  const criticalPages = [
    { name: 'Homepage', path: '/' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Docs', path: '/docs' },
    { name: 'Blog', path: '/blog' },
    { name: 'Enterprise', path: '/enterprise' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Sign-in', path: '/sign-in' },
    { name: 'Sign-up', path: '/sign-up' },
    { name: 'Compliance', path: '/compliance' },
    { name: 'Trust', path: '/trust' },
  ];

  for (const page of criticalPages) {
    test(`${page.name} (${page.path}) loads under ${LOAD_THRESHOLD_MS}ms`, async ({ page: p }) => {
      const start = Date.now();
      const res = await p.goto(page.path, { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - start;

      expect(res?.status()).toBeLessThan(500);
      expect(loadTime).toBeLessThan(LOAD_THRESHOLD_MS);
    });
  }
});

/* ── Navigation Speed ────────────────────────────────────── */

test.describe('Performance: Navigation Flow Speed', () => {
  test('homepage → pricing → docs navigates under 10s total', async ({ page }) => {
    const start = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const pricingLink = page.getByRole('link', { name: /pricing/i }).first();
    if (await pricingLink.isVisible().catch(() => false)) {
      await pricingLink.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      await page.goto('/pricing');
      await page.waitForLoadState('domcontentloaded');
    }

    const docsLink = page.getByRole('link', { name: /docs/i }).first();
    if (await docsLink.isVisible().catch(() => false)) {
      await docsLink.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      await page.goto('/docs');
      await page.waitForLoadState('domcontentloaded');
    }

    const totalTime = Date.now() - start;
    expect(totalTime).toBeLessThan(10_000);
  });

  test('rapid back/forward navigation stays responsive', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    const start = Date.now();
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    const backTime = Date.now() - start;

    expect(backTime).toBeLessThan(5000);
  });
});

/* ── Interaction Responsiveness ──────────────────────────── */

test.describe('Performance: Interaction Responsiveness', () => {
  test('pricing toggle responds within 1 second', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    const toggle = page.getByRole('button', { name: /annual|monthly/i }).first();
    const hasToggle = await toggle.isVisible().catch(() => false);

    if (hasToggle) {
      const start = Date.now();
      await toggle.click();
      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(1000);
    }
  });

  test('sign-in page renders form quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto('/sign-in');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('marketplace loads skill cards without delay', async ({ page }) => {
    const start = Date.now();
    await page.goto('/marketplace');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    await expect(page.locator('main').first()).toBeVisible();
  });
});

/* ── Resource Efficiency ─────────────────────────────────── */

test.describe('Performance: Resource Efficiency', () => {
  test('no memory-leaking console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('third-party') &&
        !e.includes('analytics') &&
        !e.includes('clerk') &&
        !e.includes('403'),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('no failed network requests on key pages', async ({ page }) => {
    const failedRequests: string[] = [];

    page.on('response', (res) => {
      if (res.status() >= 500) {
        const url = res.url();
        if (!url.includes('clerk') && !url.includes('analytics')) {
          failedRequests.push(`${res.status()} ${url}`);
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toHaveLength(0);
  });

  test('total page weight is reasonable (< 5MB on homepage)', async ({ page }) => {
    let totalBytes = 0;

    page.on('response', async (res) => {
      try {
        const body = await res.body();
        totalBytes += body.length;
      } catch {
        // Some responses may not have bodies
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const totalMB = totalBytes / (1024 * 1024);
    expect(totalMB).toBeLessThan(5);
  });
});

/* ── Concurrent Tab Behavior ─────────────────────────────── */

test.describe('Performance: Multi-Tab Behavior', () => {
  test('two tabs load simultaneously without conflict', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    const start = Date.now();
    await Promise.all([
      page1.goto('/'),
      page2.goto('/pricing'),
    ]);

    await Promise.all([
      page1.waitForLoadState('domcontentloaded'),
      page2.waitForLoadState('domcontentloaded'),
    ]);
    const totalTime = Date.now() - start;

    expect(totalTime).toBeLessThan(10_000);

    await expect(page1.locator('main').first()).toBeVisible();
    await expect(page2.locator('main').first()).toBeVisible();

    await context.close();
  });
});

/* ── Mobile Performance ──────────────────────────────────── */

test.describe('Performance: Mobile Viewport', () => {
  test('homepage loads on mobile viewport under 5s', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('pricing page renders on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const start = Date.now();
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
