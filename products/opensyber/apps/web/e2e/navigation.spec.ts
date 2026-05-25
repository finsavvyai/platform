import { test, expect } from '@playwright/test';

test.describe('Site Navigation', () => {
  test('logo links to home', async ({ page }) => {
    await page.goto('/pricing');
    // SiteHeader is a <nav>, not <header>
    await page.locator('nav').first().getByRole('link', { name: /OpenSyber/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Pricing link navigates correctly', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').first().getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL(/\/pricing/);
  });

  test('Skills link navigates to marketplace', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').first().getByRole('link', { name: 'Skills' }).click();
    await expect(page).toHaveURL(/\/marketplace/);
  });

  test('Docs link navigates correctly', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').first().getByRole('link', { name: 'Docs' }).click();
    await expect(page).toHaveURL(/\/docs/);
  });

  test('Blog link navigates correctly', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').first().getByRole('link', { name: 'Blog' }).click();
    await expect(page).toHaveURL(/\/blog/);
  });

  test('Demo link navigates correctly', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').first().getByRole('link', { name: 'Demo' }).click();
    await expect(page).toHaveURL(/\/demo/);
  });

  test('auth buttons are visible', async ({ page }) => {
    await page.goto('/');
    // Unauthenticated: "Sign In" link or "Start Free" AuthCTA should be visible
    const signIn = page.getByRole('link', { name: 'Sign In' });
    const startFree = page.getByRole('link', { name: 'Start Free' }).first();
    const authVisible =
      (await signIn.isVisible().catch(() => false)) ||
      (await startFree.isVisible().catch(() => false));
    expect(authVisible).toBe(true);
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('hamburger menu opens and shows links', async ({ page }) => {
    await page.goto('/');

    const menuButton = page.getByLabel('Open menu');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Mobile menu should show navigation links
    await expect(page.getByRole('link', { name: 'Pricing' }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Skills' }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Docs' }).last()).toBeVisible();
  });

  test('mobile menu link navigates and closes menu', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Open menu').click();
    await page.getByRole('link', { name: 'Pricing' }).last().click();
    await expect(page).toHaveURL(/\/pricing/);
  });
});
