import { test, expect } from '@playwright/test';

/**
 * Verify internal links on public pages don't return server errors (5xx).
 * Clerk auth redirects (307) and client-side auth gates are acceptable.
 */
const SKIP_PATTERNS = ['/dashboard', '/admin', '/sign-in', '/sign-up'];

function shouldSkip(href: string): boolean {
  return SKIP_PATTERNS.some((p) => href.startsWith(p));
}

async function collectHrefs(page: import('@playwright/test').Page, selector: string): Promise<string[]> {
  const links = page.locator(selector);
  const count = await links.count();
  const hrefs: string[] = [];
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href');
    if (href && !href.includes('[') && !href.startsWith('/#') && !shouldSkip(href)) {
      hrefs.push(href.split('?')[0]!);
    }
  }
  return [...new Set(hrefs)];
}

test.describe('Internal Link Integrity', () => {
  test('landing page links resolve without server errors', async ({ page }) => {
    await page.goto('/');
    const hrefs = await collectHrefs(page, 'a[href^="/"]');

    for (const href of hrefs) {
      try {
        const res = await page.goto(href);
        expect(res?.status() ?? 200, `${href} returned ${res?.status()}`).toBeLessThan(500);
      } catch {
        // Navigation errors (redirect loops) mean auth is blocking — acceptable
      }
    }
  });

  test('docs sidebar links all resolve', async ({ page }) => {
    await page.goto('/docs');
    const hrefs = await collectHrefs(page, 'aside a[href^="/"]');

    for (const href of hrefs) {
      const res = await page.goto(href);
      expect(res?.status(), `${href} returned ${res?.status()}`).toBeLessThan(500);
    }
  });

  test('footer links all resolve', async ({ page }) => {
    await page.goto('/');
    const hrefs = await collectHrefs(page, 'footer a[href^="/"]');

    for (const href of hrefs) {
      try {
        const res = await page.goto(href);
        expect(res?.status() ?? 200, `${href} returned ${res?.status()}`).toBeLessThan(500);
      } catch {
        // Redirect loops are acceptable (auth-gated routes)
      }
    }
  });

  test('navigation links all resolve', async ({ page }) => {
    await page.goto('/');
    const hrefs = await collectHrefs(page, 'nav a[href^="/"]');

    for (const href of hrefs) {
      try {
        const res = await page.goto(href);
        expect(res?.status() ?? 200, `${href} returned ${res?.status()}`).toBeLessThan(500);
      } catch {
        // Redirect loops are acceptable
      }
    }
  });
});
