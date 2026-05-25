import { test, expect } from '@playwright/test';

const SLUGS: { path: string; competitor: string }[] = [
  { path: '/vs/cypress', competitor: 'Cypress' },
  { path: '/vs/playwright', competitor: 'Playwright' },
  { path: '/vs/testim', competitor: 'Testim' },
];

test.describe('Competitor comparison landing pages (SEO)', () => {
  for (const { path, competitor } of SLUGS) {
    test(`${path} loads with status 200 and renders comparison content`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

      // For a SPA the top-level document always returns 200; if it's anything
      // else the dev server is misconfigured and the test is rightly failing.
      expect(response?.status()).toBe(200);

      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      const h1Text = (await h1.textContent()) ?? '';
      expect(h1Text).toContain('Qestro');
      expect(h1Text).toContain(competitor);
    });

    test(`${path} has a registration link and feature comparison table`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const registerLink = page.locator('a[href="/register"]').first();
      await expect(registerLink).toBeVisible();

      const table = page.locator('[data-testid="feature-comparison"]');
      await expect(table).toBeVisible();
      const rowCount = await table.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(10);
    });

    test(`${path} injects SEO metadata (title, description, og tags, JSON-LD)`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      await expect.poll(async () => await page.title()).toContain(`Qestro vs ${competitor}`);

      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description).toBeTruthy();
      expect((description ?? '').length).toBeLessThanOrEqual(160);

      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      expect(ogTitle).toContain(competitor);

      const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
      expect(ogType).toBe('article');

      const jsonLd = await page.locator('script[data-vs-seo-id="vs-page"]').textContent();
      expect(jsonLd).toBeTruthy();
      const parsed = JSON.parse(jsonLd ?? '{}');
      expect(parsed['@type']).toBe('Product');
      expect(parsed.name).toBe('Qestro');
    });
  }
});
