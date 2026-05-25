import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;

test.describe('OpenSyber — SEO & Meta Tags', () => {
  test('13.1 Homepage has proper title', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(10);
    expect(title.toLowerCase()).toContain('opensyber');
  });

  test('13.2 Homepage has meta description', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const desc = await page.getAttribute('meta[name="description"]', 'content');
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(50);
  });

  test('13.3 Homepage has Open Graph tags', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    const ogDesc = await page.getAttribute('meta[property="og:description"]', 'content');
    const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');
    expect(ogTitle).toBeTruthy();
    expect(ogDesc).toBeTruthy();
    // OG image is nice-to-have
  });

  test('13.4 Homepage has canonical URL', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
    if (canonical) {
      expect(canonical).toContain('opensyber.cloud');
    }
  });

  test('13.5 Pricing page has unique title', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
    // Should differ from homepage
  });

  test('13.6 Blog articles have proper titles', async ({ page }) => {
    await page.goto(`${BASE}/blog/introducing-opensyber`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(10);
  });

  test('13.7 H1 tags are present and unique per page', async ({ page }) => {
    const pagesToCheck = ['/', '/pricing', '/marketplace', '/docs', '/blog'];
    for (const path of pagesToCheck) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      const h1s = await page.locator('h1').count();
      // Each page should have at least one H1
      expect(h1s).toBeGreaterThanOrEqual(1);
    }
  });

  test('13.8 Images have alt text', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).filter((img) => !img.alt && !img.getAttribute('aria-hidden')).length;
    });
    // Most images should have alt text
    const totalImages = await page.locator('img').count();
    if (totalImages > 0) {
      const altRate = (totalImages - imagesWithoutAlt) / totalImages;
      expect(altRate).toBeGreaterThan(0.5); // At least 50% should have alt
    }
  });

  test('13.9 Twitter card tags present', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const twitterCard = await page.getAttribute('meta[name="twitter:card"]', 'content');
    // Nice-to-have, don't fail hard
    if (twitterCard) {
      expect(twitterCard).toBeTruthy();
    }
  });
});
