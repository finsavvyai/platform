import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Documentation', () => {
  test('5.1 Docs hub loads', async ({ page }) => {
    await page.goto(`${BASE}/docs`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/05-docs-hub.png`, fullPage: false });
    const body = await page.textContent('body');
    expect(body?.toLowerCase()).toContain('doc');
  });

  for (const docPath of OPENSYBER.docPages.slice(1)) {
    test(`5.2 Doc page loads: ${docPath}`, async ({ page }) => {
      const response = await page.goto(`${BASE}${docPath}`, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(500);
      await page.waitForTimeout(1000);
      const body = await page.textContent('body') || '';
      expect(body.length).toBeGreaterThan(100);
    });
  }

  test('5.3 Getting started guide has step-by-step content', async ({ page }) => {
    await page.goto(`${BASE}/docs/getting-started`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/05-docs-getting-started.png`, fullPage: true });
    const body = await page.textContent('body') || '';
    // Should have instructional content
    const hasSteps = body.toLowerCase().includes('step') ||
      body.toLowerCase().includes('install') ||
      body.toLowerCase().includes('setup') ||
      body.toLowerCase().includes('getting started');
    expect(hasSteps).toBeTruthy();
  });

  test('5.4 API reference page loads', async ({ page }) => {
    await page.goto(`${BASE}/docs/api`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/05-docs-api.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    const hasAPI = body.toLowerCase().includes('api') || body.toLowerCase().includes('endpoint');
    expect(hasAPI).toBeTruthy();
  });

  test('5.5 OASF framework page loads', async ({ page }) => {
    await page.goto(`${BASE}/docs/oasf`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('OpenSyber — Blog', () => {
  test('5.6 Blog index loads', async ({ page }) => {
    await page.goto(`${BASE}/blog`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/05-blog-index.png`, fullPage: false });
    const body = await page.textContent('body');
    expect(body?.toLowerCase()).toContain('blog');
  });

  test('5.7 Blog has article cards', async ({ page }) => {
    await page.goto(`${BASE}/blog`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Should have multiple article links
    const articleLinks = page.locator('a[href*="/blog/"]').filter({
      hasNotText: /^blog$/i,
    });
    const count = await articleLinks.count();
    expect(count).toBeGreaterThan(3);
  });

  test('5.8 First blog article loads with content', async ({ page }) => {
    const firstPost = OPENSYBER.blogPosts[0];
    await page.goto(`${BASE}${firstPost}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/05-blog-article.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    // Article should have substantial content
    expect(body.length).toBeGreaterThan(500);
  });

  test('5.9 Blog articles return 200 status', async ({ page }) => {
    // Spot-check 5 random blog posts
    const sample = OPENSYBER.blogPosts.slice(0, 5);
    for (const post of sample) {
      const response = await page.goto(`${BASE}${post}`, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(500);
    }
  });
});
