import { test, expect } from '@playwright/test';

/**
 * Accessibility audit — ARIA labels, focus management,
 * keyboard navigation, contrast hints, alt text.
 */
const PUBLIC_PAGES = [
  '/',
  '/pricing',
  '/marketplace',
  '/docs',
  '/demo',
  '/enterprise',
];

test.describe('A11y — Heading Hierarchy', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has exactly one h1`, async ({ page }) => {
      await page.goto(path);
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
    });
  }
});

test.describe('A11y — ARIA Labels', () => {
  test('buttons on landing page have accessible names', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const aria = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      expect(text?.trim() || aria || title).toBeTruthy();
    }
  });

  test('links have accessible text', async ({ page }) => {
    await page.goto('/pricing');
    const links = page.locator('a');
    const count = await links.count();
    for (let i = 0; i < Math.min(count, 30); i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const aria = await link.getAttribute('aria-label');
      expect(text?.trim() || aria).toBeTruthy();
    }
  });

  test('form inputs have labels or placeholders', async ({ page }) => {
    await page.goto('/enterprise');
    const inputs = page.locator('input, textarea');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const ph = await input.getAttribute('placeholder');
      const aria = await input.getAttribute('aria-label');
      const id = await input.getAttribute('id');
      let hasLabel = false;
      if (id) {
        hasLabel = (await page.locator(`label[for="${id}"]`).count()) > 0;
      }
      expect(ph || aria || hasLabel).toBeTruthy();
    }
  });
});

test.describe('A11y — Keyboard Navigation', () => {
  test('Tab navigates through interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    expect(tag).toBeTruthy();
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(tag);
  });

  test('Enter activates focused link', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav').first();
    const link = nav.getByRole('link').first();
    await link.focus();
    const href = await link.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('http')) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      expect(page.url()).toContain(href);
    }
  });
});

test.describe('A11y — Images', () => {
  for (const path of ['/', '/pricing', '/marketplace']) {
    test(`${path} images have alt text`, async ({ page }) => {
      await page.goto(path);
      const imgs = page.locator('img');
      const count = await imgs.count();
      for (let i = 0; i < count; i++) {
        const img = imgs.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        expect(alt !== null || role === 'presentation').toBe(true);
      }
    });
  }
});
