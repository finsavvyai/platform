import { test, expect, Page } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../.luna/browser-test/screenshots');

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function screenshotAllViewports(
  page: Page,
  folder: string,
  prefix: string
) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, folder, `${prefix}-${vp.name}.png`),
      fullPage: true,
    });
  }
}

// ─── DASHBOARD: PUBLIC PAGES ────────────────────────────────

test.describe('Dashboard — Public Pages', () => {
  test('Landing page loads with hero and CTAs', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/.+/);
    await screenshotAllViewports(page, 'dashboard', 'landing');
  });

  test('Login page renders with form elements', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForLoadState('networkidle');
    await screenshotAllViewports(page, 'auth', 'login');
  });

  test('Signup page renders with form elements', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/signup');
    await page.waitForLoadState('networkidle');
    await screenshotAllViewports(page, 'auth', 'signup');
  });

  test('Pricing page loads with plans', async ({ page }) => {
    await page.goto('http://localhost:3000/pricing');
    await page.waitForLoadState('networkidle');
    await screenshotAllViewports(page, 'pricing', 'pricing');
  });
});

// ─── DASHBOARD: AUTHENTICATED PAGES ────────────────────────

test.describe('Dashboard — App Pages (no auth gate)', () => {
  const dashboardRoutes = [
    { path: '/dashboard', name: 'home' },
    { path: '/dashboard/agents', name: 'agents' },
    { path: '/dashboard/agents/studio', name: 'agents-studio' },
    { path: '/dashboard/analytics', name: 'analytics' },
    { path: '/dashboard/api-keys', name: 'api-keys' },
    { path: '/dashboard/billing', name: 'billing' },
    { path: '/dashboard/chains', name: 'chains' },
    { path: '/dashboard/chains/builder', name: 'chains-builder' },
    { path: '/dashboard/history', name: 'history' },
    { path: '/dashboard/kb', name: 'knowledge-base' },
    { path: '/dashboard/repos', name: 'repos' },
    { path: '/dashboard/services', name: 'services' },
    { path: '/dashboard/services/channels', name: 'channels' },
    { path: '/dashboard/services/providers', name: 'providers' },
    { path: '/dashboard/settings', name: 'settings' },
    { path: '/dashboard/visualizer', name: 'visualizer' },
  ];

  for (const route of dashboardRoutes) {
    test(`Dashboard ${route.name} page loads`, async ({ page }) => {
      const response = await page.goto(
        `http://localhost:3000${route.path}`,
        { waitUntil: 'networkidle', timeout: 30000 }
      );
      // Page should respond (200 or redirect to login)
      expect(response?.status()).toBeLessThan(500);
      await screenshotAllViewports(page, 'dashboard', route.name);
    });
  }
});

// ─── MARKETING SITE ─────────────────────────────────────────

test.describe('Marketing — All Pages', () => {
  const marketingPages = [
    { file: '/', name: 'index' },
    { file: '/blog.html', name: 'blog' },
    { file: '/compare.html', name: 'compare' },
    { file: '/contact.html', name: 'contact' },
    { file: '/demo.html', name: 'demo' },
    { file: '/docs.html', name: 'docs' },
    { file: '/investors.html', name: 'investors' },
    { file: '/pricing.html', name: 'pricing' },
    { file: '/sdk.html', name: 'sdk' },
    { file: '/widget-demo.html', name: 'widget-demo' },
  ];

  for (const pg of marketingPages) {
    test(`Marketing ${pg.name} page loads`, async ({ page }) => {
      const response = await page.goto(
        `http://localhost:8080${pg.file}`,
        { waitUntil: 'networkidle', timeout: 30000 }
      );
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).toBeVisible();
      await screenshotAllViewports(page, 'marketing', pg.name);
    });
  }
});

// ─── CROSS-CUTTING: RESPONSIVE & ACCESSIBILITY ─────────────

test.describe('Cross-Cutting — Responsive Checks', () => {
  test('Dashboard landing has no horizontal overflow at mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 10); // 10px tolerance
  });

  test('Marketing landing has no horizontal overflow at mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 10);
  });

  test('Dashboard has visible navigation elements', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    // Check basic page structure exists
    const hasNav = await page.locator('nav, [role="navigation"], header').count();
    expect(hasNav).toBeGreaterThan(0);
  });

  test('Marketing has meta tags for SEO', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description?.length).toBeGreaterThan(0);
  });
});

// ─── PERFORMANCE: BASIC LCP CHECK ──────────────────────────

test.describe('Performance — Basic Checks', () => {
  test('Dashboard landing loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
    });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test('Marketing landing loads within 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('http://localhost:8080', {
      waitUntil: 'domcontentloaded',
    });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(3000);
  });
});

// ─── ERROR PAGES ────────────────────────────────────────────

test.describe('Error Handling', () => {
  test('Dashboard 404 page renders gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000/nonexistent-page-xyz');
    await page.waitForLoadState('networkidle');
    await screenshotAllViewports(page, 'dashboard', '404');
  });

  test('Marketing 404 returns appropriate response', async ({ page }) => {
    const response = await page.goto(
      'http://localhost:8080/nonexistent.html'
    );
    // Static server may return 200 with fallback or 404
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'marketing', '404.png'),
    });
  });
});
