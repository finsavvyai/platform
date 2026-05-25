import { test, expect } from '@playwright/test';

/**
 * Responsive layout tests across mobile (375px),
 * tablet (768px), and desktop (1440px) viewports.
 */
test.describe('Responsive — Mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('landing page has no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.body.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('marketplace renders on mobile', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.body.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('pricing cards are accessible on mobile', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // At least first plan card visible
    await expect(
      page.getByRole('heading', { name: /starter shield/i }).first()
    ).toBeVisible();
  });

  test('nav collapses on mobile', async ({ page }) => {
    await page.goto('/');
    // Look for hamburger/menu button on mobile
    const hamburger = page.getByRole('button', { name: /menu/i }).or(
      page.locator('button[aria-label*="menu" i]').or(
        page.locator('[class*="hamburger"], [class*="mobile-menu"]')
      )
    );
    const hasHamburger = await hamburger.first().isVisible().catch(() => false);
    // Or nav links are hidden on mobile
    const navLinks = page.locator('nav').first().getByRole('link');
    const visibleCount = await navLinks.count();
    // Either hamburger exists or fewer links visible
    expect(hasHamburger || visibleCount <= 3).toBe(true);
  });
});

test.describe('Responsive — Tablet (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('landing page no overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.body.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('pricing page renders plan grid', async ({ page }) => {
    await page.goto('/pricing');
    await expect(
      page.getByRole('heading', { name: /team/i }).first()
    ).toBeVisible();
  });

  test('docs page content accessible on tablet', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('Responsive — Desktop (1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('landing hero has proper spacing', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('h1');
    await expect(hero).toBeVisible();
    const box = await hero.boundingBox();
    expect(box!.x).toBeGreaterThan(50);
  });

  test('docs sidebar and content side by side', async ({ page }) => {
    await page.goto('/docs');
    const sidebar = page.locator('aside');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(sidebar).toBeVisible();
    await expect(h1).toBeVisible();
    const sBox = await sidebar.boundingBox();
    const hBox = await h1.boundingBox();
    if (sBox && hBox) {
      expect(hBox.x).toBeGreaterThan(sBox.x);
    }
  });

  test('no horizontal overflow on desktop', async ({ page }) => {
    await page.goto('/pricing');
    const overflow = await page.evaluate(
      () => document.body.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });
});
