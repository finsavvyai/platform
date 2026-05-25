import { test, expect } from '@playwright/test';

/**
 * Verify that Lucide React icons render correctly as SVG elements
 * across all major public pages. Icons that fail to render indicate
 * broken imports or missing dependencies.
 */
test.describe('Icon Rendering (SVG verification)', () => {
  const PAGES_WITH_ICONS = [
    { path: '/', minIcons: 10, name: 'Landing page' },
    { path: '/pricing', minIcons: 4, name: 'Pricing page' },
    { path: '/enterprise', minIcons: 4, name: 'Enterprise page' },
    { path: '/docs', minIcons: 3, name: 'Docs page' },
    { path: '/openagent', minIcons: 3, name: 'OpenAgent page' },
    { path: '/openagent/install', minIcons: 4, name: 'OpenAgent Install' },
    { path: '/demo', minIcons: 3, name: 'Demo page' },
    { path: '/threats', minIcons: 1, name: 'Threats page' },
  ];

  for (const { path, minIcons, name } of PAGES_WITH_ICONS) {
    test(`${name} renders at least ${minIcons} SVG icons`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(1000);

      const svgIcons = page.locator('svg');
      const count = await svgIcons.count();
      expect(count).toBeGreaterThanOrEqual(minIcons);
    });
  }

  test('landing page icons have correct structure (path elements)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Lucide icons use <svg> with <path> or <line> children
    const svgsWithPaths = page.locator('svg:has(path), svg:has(line), svg:has(circle)');
    const count = await svgsWithPaths.count();
    expect(count).toBeGreaterThan(5);
  });

  test('icons have accessible viewBox attribute', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const svgIcons = page.locator('svg[viewBox]');
    const count = await svgIcons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('no broken icon placeholders (empty SVGs)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Check that SVGs are not empty (have child elements)
    const emptySvgs = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      let empty = 0;
      svgs.forEach((svg) => {
        if (svg.children.length === 0) empty++;
      });
      return empty;
    });
    expect(emptySvgs).toBe(0);
  });
});
