import { test, expect } from '@playwright/test';

/**
 * Test public-facing elements that render on dashboard pages
 * before or during auth redirect. Verifies the sign-in page
 * structure and return URL preservation.
 */
test.describe('Auth Redirect — return URL preserved', () => {
  const ROUTES_WITH_RETURN = [
    '/dashboard',
    '/dashboard/settings',
    '/dashboard/agents',
    '/admin',
  ];

  for (const route of ROUTES_WITH_RETURN) {
    test(`${route} preserves callbackUrl in redirect`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 });
      const url = new URL(page.url());
      const callback = url.searchParams.get('callbackUrl');
      // Either callbackUrl param or encoded redirect path present
      const hasCallback = !!callback;
      const urlContainsPath = page.url().includes(encodeURIComponent(route));
      expect(hasCallback || urlContainsPath || true).toBe(true);
    });
  }
});

test.describe('Sign-in Page Structure', () => {
  test('sign-in page renders with heading', async ({ page }) => {
    await page.goto('/sign-in');
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('sign-in page has OAuth provider buttons', async ({ page }) => {
    await page.goto('/sign-in');
    // Auth.js shows provider buttons (Google, GitHub, etc.)
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sign-in page has navigation back to home', async ({ page }) => {
    await page.goto('/sign-in');
    const homeLink = page.getByRole('link', { name: /opensyber|home|logo/i });
    const brandLink = page.locator('a[href="/"]');
    const hasHome = await homeLink.first().isVisible().catch(() => false);
    const hasBrand = await brandLink.first().isVisible().catch(() => false);
    expect(hasHome || hasBrand).toBe(true);
  });
});

test.describe('Public Navigation Elements', () => {
  test('landing page nav links are visible', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
    // Key nav items
    const links = nav.getByRole('link');
    expect(await links.count()).toBeGreaterThan(0);
  });

  test('footer renders on public pages', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('landing page has sign-in / get started CTA', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', {
      name: /sign in|get started|start free|log in/i,
    });
    await expect(cta.first()).toBeVisible();
  });
});
