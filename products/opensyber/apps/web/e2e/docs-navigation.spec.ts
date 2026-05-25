import { test, expect } from '@playwright/test';

/**
 * Comprehensive documentation page tests — all doc routes,
 * sidebar navigation, code blocks, and inter-page links.
 */
const DOC_PAGES = [
  { path: '/docs', heading: /documentation/i },
  { path: '/docs/getting-started', heading: /getting started/i },
  { path: '/docs/agent', heading: /agent/i },
  { path: '/docs/api', heading: /api reference/i },
  { path: '/docs/skills', heading: /skills/i },
  { path: '/docs/security', heading: /security/i },
  { path: '/docs/faq', heading: /faq|frequently/i },
  { path: '/docs/oasf', heading: /oasf|framework/i },
];

test.describe('Docs — All Pages Load', () => {
  for (const { path, heading } of DOC_PAGES) {
    test(`${path} loads with correct heading`, async ({ page }) => {
      await page.goto(path);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      await expect(h1).toContainText(heading);
    });
  }
});

test.describe('Docs — Sidebar Navigation', () => {
  test('sidebar links are visible on /docs', async ({ page }) => {
    await page.goto('/docs');
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    const links = sidebar.getByRole('link');
    expect(await links.count()).toBeGreaterThan(2);
  });

  test('sidebar has key section links', async ({ page }) => {
    await page.goto('/docs');
    const sidebar = page.locator('aside');
    const expected = ['Getting Started', 'API Reference', 'FAQ'];
    for (const name of expected) {
      await expect(
        sidebar.getByRole('link', { name }).first()
      ).toBeVisible();
    }
  });

  test('clicking sidebar link navigates to page', async ({ page }) => {
    await page.goto('/docs');
    const sidebar = page.locator('aside');
    const link = sidebar.getByRole('link', { name: 'FAQ' }).first();
    await link.click();
    await expect(page).toHaveURL(/\/docs\/faq/);
  });
});

test.describe('Docs — Content Quality', () => {
  test('getting-started page has setup steps', async ({ page }) => {
    await page.goto('/docs/getting-started');
    await expect(
      page.getByText(/create your account/i).first()
    ).toBeVisible();
  });

  test('api reference page has endpoint content', async ({ page }) => {
    await page.goto('/docs/api');
    const content = page.locator('main, article, [role="main"]').first();
    await expect(content).toBeVisible();
    const text = await content.textContent();
    expect(text!.length).toBeGreaterThan(100);
  });

  test('security page has security score section', async ({ page }) => {
    await page.goto('/docs/security');
    await expect(
      page.getByRole('heading', { name: /security score/i }).first()
    ).toBeVisible();
  });

  test('code blocks render on docs pages', async ({ page }) => {
    await page.goto('/docs/api');
    const codeBlocks = page.locator('pre, code');
    const count = await codeBlocks.count();
    // API docs should have code examples
    expect(count).toBeGreaterThan(0);
  });
});
