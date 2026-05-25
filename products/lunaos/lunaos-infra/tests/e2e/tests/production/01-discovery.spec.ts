import { test, expect } from '@playwright/test';

/**
 * Production Test: Customer Discovery Journey
 *
 * A real customer lands on lunaos.ai for the first time.
 * Tests the full discovery flow with actual production selectors.
 */

const MARKETING = 'https://lunaos.ai';

test.describe('Customer Discovery — lunaos.ai', () => {
  test('homepage loads with hero and branding', async ({ page }) => {
    await page.goto(MARKETING);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/LunaOS/);
    await expect(page.locator('h1')).toContainText('AI agents');
    // Marketing CTA uses btn-glow class
    await expect(page.locator('#hero-signup')).toBeVisible();
  });

  test('navigation links are functional', async ({ page }) => {
    await page.goto(MARKETING);
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    await expect(nav.locator('a[href="#agents"]')).toBeVisible();
    await expect(nav.locator('a[href="#pricing"]')).toBeVisible();
    await expect(nav.locator('a[href*="docs.lunaos.ai"]')).toBeVisible();
  });

  test('agent features section is visible', async ({ page }) => {
    await page.goto(MARKETING);
    // Use nav-scoped link to avoid strict mode (footer also has #agents)
    await page.locator('nav a[href="#agents"]').click();
    await page.waitForTimeout(500);

    const body = await page.textContent('body');
    expect(body).toContain('Code Review');
    expect(body).toContain('Security');
    expect(body).toContain('Test');
  });

  test('terminal demo section exists', async ({ page }) => {
    await page.goto(MARKETING);
    await page.waitForLoadState('domcontentloaded');
    const body = await page.textContent('body');
    // Terminal section shows CLI command
    expect(body).toContain('luna-agents');
  });

  test('pricing section shows tiers', async ({ page }) => {
    await page.goto(`${MARKETING}/#pricing`);
    await page.waitForTimeout(500);

    const body = await page.textContent('body');
    expect(body).toContain('Free');
    expect(body).toContain('100');
  });

  test('CTA buttons link to signup', async ({ page }) => {
    await page.goto(MARKETING);
    await page.waitForLoadState('domcontentloaded');
    const cta = page.locator('#hero-signup');
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toContain('agents.lunaos.ai/auth/signup');
  });

  test('footer has docs and GitHub links', async ({ page }) => {
    await page.goto(MARKETING);
    await page.waitForLoadState('domcontentloaded');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(
      footer.locator('a[href*="docs.lunaos.ai"]').first()
    ).toBeVisible();
    await expect(
      footer.locator('a[href*="github.com"]').first()
    ).toBeVisible();
  });

  test('SEO meta tags are present', async ({ page }) => {
    await page.goto(MARKETING);
    const desc = page.locator('meta[name="description"]');
    expect(await desc.getAttribute('content')).toContain('AI agents');

    const ogTitle = page.locator('meta[property="og:title"]');
    expect(await ogTitle.getAttribute('content')).toContain('LunaOS');

    const twitter = page.locator('meta[name="twitter:card"]');
    expect(await twitter.getAttribute('content')).toBe('summary_large_image');
  });

  test('page loads under 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(MARKETING, { waitUntil: 'domcontentloaded' });
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test('no horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(MARKETING);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 5
    );
    expect(overflow).toBe(true);
  });
});
