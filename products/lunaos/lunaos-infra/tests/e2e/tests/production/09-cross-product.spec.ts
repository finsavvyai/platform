import { test, expect } from '@playwright/test';

/**
 * Production Test: Cross-Product Navigation
 *
 * Verifies that all LunaOS products are reachable,
 * interconnected via links, and maintain consistent branding.
 */

const PRODUCTS = {
  marketing: 'https://lunaos.ai',
  dashboard: 'https://agents.lunaos.ai',
  studio: 'https://studio.lunaos.ai',
  docs: 'https://docs.lunaos.ai',
  api: 'https://api.lunaos.ai',
};

test.describe('Cross-Product Navigation', () => {
  test('all products respond with 2xx or 3xx', async ({ request }) => {
    for (const [name, url] of Object.entries(PRODUCTS)) {
      const res = await request.get(
        name === 'api' ? `${url}/health` : url
      );
      expect(
        res.status(),
        `${name} (${url}) returned ${res.status()}`
      ).toBeLessThan(400);
    }
  });

  test('all web products serve HTTPS', async ({ page }) => {
    const webProducts = [
      PRODUCTS.marketing,
      PRODUCTS.dashboard,
      PRODUCTS.studio,
      PRODUCTS.docs,
    ];
    for (const url of webProducts) {
      await page.goto(url);
      expect(page.url()).toMatch(/^https:\/\//);
    }
  });

  test('marketing links to dashboard signup', async ({ page }) => {
    await page.goto(PRODUCTS.marketing);
    await page.waitForLoadState('domcontentloaded');
    const signupLink = page.locator(
      'a[href*="agents.lunaos.ai/auth/signup"]'
    ).first();
    await expect(signupLink).toBeVisible();
  });

  test('marketing links to docs', async ({ page }) => {
    await page.goto(PRODUCTS.marketing);
    await page.waitForLoadState('domcontentloaded');
    const docsLink = page.locator(
      'a[href*="docs.lunaos.ai"]'
    ).first();
    await expect(docsLink).toBeVisible();
  });

  test('dashboard login links to signup', async ({ page }) => {
    await page.goto(`${PRODUCTS.dashboard}/auth/login/`);
    const signupLink = page.locator('a[href*="signup"]');
    await expect(signupLink).toBeVisible();
  });

  test('dashboard signup links to login', async ({ page }) => {
    await page.goto(`${PRODUCTS.dashboard}/auth/signup/`);
    const loginLink = page.locator('a[href*="login"]');
    await expect(loginLink).toBeVisible();
  });

  test('all pages have non-empty titles', async ({ page }) => {
    const webProducts = [
      PRODUCTS.marketing,
      PRODUCTS.dashboard,
      PRODUCTS.studio,
      PRODUCTS.docs,
    ];
    for (const url of webProducts) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      const title = await page.title();
      expect(title.length, `Empty title at ${url}`).toBeGreaterThan(0);
    }
  });

  test('API health is accessible', async ({ request }) => {
    const res = await request.get(`${PRODUCTS.api}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('no product returns 5xx errors', async ({ request }) => {
    const urls = [
      PRODUCTS.marketing,
      PRODUCTS.dashboard,
      PRODUCTS.studio,
      PRODUCTS.docs,
      `${PRODUCTS.api}/health`,
    ];
    for (const url of urls) {
      const res = await request.get(url);
      expect(
        res.status(),
        `${url} returned 5xx`
      ).toBeLessThan(500);
    }
  });

  test('consistent branding across products', async ({ page }) => {
    await page.goto(PRODUCTS.marketing);
    await page.waitForLoadState('domcontentloaded');
    const marketingBody = await page.textContent('body');
    expect(marketingBody).toContain('LunaOS');

    await page.goto(PRODUCTS.dashboard);
    await page.waitForLoadState('networkidle');
    const dashBody = await page.textContent('body');
    const hasBranding =
      dashBody?.includes('LunaOS') ||
      dashBody?.includes('Luna') ||
      dashBody?.includes('luna');
    expect(hasBranding).toBe(true);
  });
});
