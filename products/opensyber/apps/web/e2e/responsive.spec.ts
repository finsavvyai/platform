import { test, expect } from '@playwright/test';

/**
 * Responsive layout tests at three breakpoints: 375px (mobile), 768px (tablet), 1440px (desktop).
 * Per Apple HIG: mobile-first, stack on mobile, grid on desktop.
 */
test.describe('Responsive — Mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('landing page stacks content vertically', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('h1');
    await expect(hero).toBeVisible();
    // No horizontal overflow
    const overflows = await page.evaluate(() => document.body.scrollWidth > 375);
    expect(overflows).toBe(false);
  });

  test('pricing cards stack on mobile', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    // All 4 plan cards visible (scrollable)
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
  });

  test('enterprise form is usable on mobile', async ({ page }) => {
    await page.goto('/enterprise');
    const nameInput = page.getByPlaceholder('Your name');
    await expect(nameInput).toBeVisible();
    // Input should be full width or nearly so
    const box = await nameInput.boundingBox();
    expect(box!.width).toBeGreaterThan(200);
  });

  test('docs sidebar collapses or stacks on mobile', async ({ page }) => {
    await page.goto('/docs');
    // Content should still be accessible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('marketplace is usable on mobile', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Category tabs should wrap or scroll
    await expect(page.getByRole('link', { name: 'All', exact: true })).toBeVisible();
  });
});

test.describe('Responsive — Tablet (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('landing page renders without overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    const overflows = await page.evaluate(() => document.body.scrollWidth > 768);
    expect(overflows).toBe(false);
  });

  test('pricing page shows plan grid', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
  });
});

test.describe('Responsive — Desktop (1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('landing page hero is centered with ample spacing', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('h1');
    await expect(hero).toBeVisible();
    const box = await hero.boundingBox();
    // Hero should not be flush left on desktop
    expect(box!.x).toBeGreaterThan(100);
  });

  test('docs page shows sidebar and content side by side', async ({ page }) => {
    await page.goto('/docs');
    const sidebar = page.locator('aside');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(sidebar).toBeVisible();
    await expect(heading).toBeVisible();
    // Sidebar and heading should not overlap
    const sidebarBox = await sidebar.boundingBox();
    const headingBox = await heading.boundingBox();
    if (sidebarBox && headingBox) {
      expect(headingBox.x).toBeGreaterThan(sidebarBox.x);
    }
  });

  test('enterprise page renders full-width on desktop', async ({ page }) => {
    await page.goto('/enterprise');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflows = await page.evaluate(() => document.body.scrollWidth > 1440);
    expect(overflows).toBe(false);
  });
});
