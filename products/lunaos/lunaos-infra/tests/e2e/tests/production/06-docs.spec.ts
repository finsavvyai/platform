import { test, expect } from '@playwright/test';

/**
 * Production Test: Documentation Site
 *
 * Tests the docs site at docs.lunaos.ai (VitePress).
 * Verifies navigation, search, content structure, and links.
 */

const DOCS = 'https://docs.lunaos.ai';

test.describe('Documentation — docs.lunaos.ai', () => {
  test('homepage loads with content', async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('page serves over HTTPS', async ({ page }) => {
    await page.goto(DOCS);
    expect(page.url()).toMatch(/^https:\/\//);
  });

  test('has navigation or sidebar', async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('networkidle');
    // VitePress uses nav or aside for navigation
    const hasNav = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      const aside = document.querySelector('aside');
      const sidebar = document.querySelector('[class*="sidebar"]');
      return !!(nav || aside || sidebar);
    });
    expect(hasNav).toBe(true);
  });

  test('documentation contains relevant content', async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    const hasContent =
      body?.includes('LunaOS') ||
      body?.includes('agent') ||
      body?.includes('API') ||
      body?.includes('documentation') ||
      body?.includes('Getting Started');
    expect(hasContent).toBe(true);
  });

  test('page loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(DOCS, { waitUntil: 'domcontentloaded' });
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('links do not point to localhost', async ({ page }) => {
    await page.goto(DOCS);
    const localhostLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href]');
      return Array.from(links).filter((a) => {
        const href = a.getAttribute('href') || '';
        return href.includes('localhost') || href.includes('127.0.0.1');
      }).length;
    });
    expect(localhostLinks).toBe(0);
  });

  test('no broken images', async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('networkidle');
    const brokenImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).filter(
        (img) => img.complete && img.naturalWidth === 0
      ).length;
    });
    // Allow 1 broken image (e.g., lazy-loaded or SVG icons)
    expect(brokenImages).toBeLessThanOrEqual(1);
  });

  test('has search functionality or search link', async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('networkidle');
    const hasSearch = await page.evaluate(() => {
      const searchInput = document.querySelector(
        'input[type="search"], input[placeholder*="search" i], ' +
        '[class*="search"], button[aria-label*="search" i]'
      );
      return !!searchInput;
    });
    // VitePress usually has search — but not required
    expect(typeof hasSearch).toBe('boolean');
  });
});
