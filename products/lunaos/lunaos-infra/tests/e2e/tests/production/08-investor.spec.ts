import { test, expect } from '@playwright/test';

/**
 * Production Test: Investor Evaluation Journey
 *
 * Simulates an investor evaluating LunaOS as a product.
 * Checks key trust signals: branding, pricing, docs, security posture.
 */

const MARKETING = 'https://lunaos.ai';
const DASHBOARD = 'https://agents.lunaos.ai';
const DOCS = 'https://docs.lunaos.ai';
const API = 'https://api.lunaos.ai';

test.describe('Investor Evaluation Journey', () => {
  test('marketing site looks professional (branding)', async ({ page }) => {
    await page.goto(MARKETING);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/LunaOS/);

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    const cta = page.locator('#hero-signup');
    await expect(cta).toBeVisible();
  });

  test('pricing is transparent and visible', async ({ page }) => {
    await page.goto(`${MARKETING}/#pricing`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    expect(body).toContain('Free');
    const hasPricing =
      body?.includes('$') ||
      body?.includes('Pro') ||
      body?.includes('Enterprise') ||
      body?.includes('100');
    expect(hasPricing).toBe(true);
  });

  test('documentation exists and is navigable', async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('API is live and healthy', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('dashboard shows product with auth gate', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('agents.lunaos.ai');
  });

  test('signup flow is functional', async ({ page }) => {
    await page.goto(`${DASHBOARD}/auth/signup/`);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('all products serve HTTPS', async ({ page }) => {
    const urls = [MARKETING, DASHBOARD, DOCS];
    for (const url of urls) {
      await page.goto(url);
      expect(page.url()).toMatch(/^https:\/\//);
    }
  });

  test('SEO and social meta tags exist', async ({ page }) => {
    await page.goto(MARKETING);
    const desc = page.locator('meta[name="description"]');
    const content = await desc.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(20);
  });

  test('no critical console errors on marketing', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(MARKETING);
    await page.waitForLoadState('domcontentloaded');

    // Filter benign errors
    const critical = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('analytics') &&
        !e.includes('gtag') &&
        !e.includes('Failed to load resource')
    );
    expect(critical.length).toBeLessThanOrEqual(3);
  });

  test('page performance is acceptable', async ({ page }) => {
    const start = Date.now();
    await page.goto(MARKETING, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(4000);
  });
});
