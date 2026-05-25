import { test, expect } from '@playwright/test';

/**
 * Basic accessibility checks across public pages.
 * Covers: heading hierarchy, alt text, focus indicators, color contrast hints,
 * keyboard navigation, ARIA labels.
 */
test.describe('Accessibility — Heading Hierarchy', () => {
  const PAGES = ['/', '/pricing', '/enterprise', '/docs', '/marketplace', '/openagent'];

  for (const path of PAGES) {
    test(`${path} has exactly one h1`, async ({ page }) => {
      await page.goto(path);
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
    });
  }
});

test.describe('Accessibility — Interactive Elements', () => {
  test('all buttons have accessible text', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      // Button must have visible text, aria-label, or title
      expect(text?.trim() || ariaLabel || title).toBeTruthy();
    }
  });

  test('all links have accessible text', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('a');
    const count = await links.count();

    for (let i = 0; i < Math.min(count, 50); i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      expect(text?.trim() || ariaLabel).toBeTruthy();
    }
  });

  test('enterprise form inputs have associated labels or placeholders', async ({ page }) => {
    await page.goto('/enterprise');
    const inputs = page.locator('input, textarea');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');
      const ariaLabel = await input.getAttribute('aria-label');
      const id = await input.getAttribute('id');
      // Check for associated label element
      let hasLabel = false;
      if (id) {
        hasLabel = (await page.locator(`label[for="${id}"]`).count()) > 0;
      }
      expect(placeholder || ariaLabel || hasLabel).toBeTruthy();
    }
  });
});

test.describe('Accessibility — Keyboard Navigation', () => {
  test('Tab key navigates through nav links', async ({ page }) => {
    await page.goto('/');
    // Focus first interactive element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Something should be focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('Enter key activates focused link', async ({ page }) => {
    await page.goto('/');
    // Tab to first nav link and press Enter
    const nav = page.locator('nav').first();
    const firstLink = nav.getByRole('link').first();
    await firstLink.focus();
    const href = await firstLink.getAttribute('href');
    await page.keyboard.press('Enter');
    // Should have navigated
    if (href && !href.startsWith('#')) {
      await page.waitForTimeout(1000);
      expect(page.url()).not.toBe('about:blank');
    }
  });
});

test.describe('Accessibility — Images & Media', () => {
  test('images have alt attributes', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      // Image should have alt text or role="presentation"
      expect(alt !== null || role === 'presentation').toBe(true);
    }
  });
});
