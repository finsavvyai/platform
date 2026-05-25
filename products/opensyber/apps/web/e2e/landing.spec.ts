import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/OpenSyber/);
  });

  test('hero section renders with headline and CTAs', async ({ page }) => {
    const hero = page.locator('h1');
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(/AI agents/i);
    await expect(page.getByRole('link', { name: /start free|get started|sign up/i }).first()).toBeVisible();
  });

  test('navigation bar has all links', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav.getByRole('link', { name: /pricing/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /docs/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /blog/i })).toBeVisible();
  });

  test('three layers section renders', async ({ page }) => {
    await expect(page.getByText(/three layers/i)).toBeVisible();
    await expect(page.getByText(/hardened infrastructure/i).first()).toBeVisible();
    await expect(page.getByText(/verified marketplace/i).first()).toBeVisible();
    await expect(page.getByText(/real-time monitoring/i).first()).toBeVisible();
  });

  test('how-it-works section shows steps', async ({ page }) => {
    const section = page.getByRole('heading', { name: /60 seconds/i });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /deploy/i }).first()).toBeVisible();
  });

  test('attacks section is visible', async ({ page }) => {
    await expect(page.getByText(/attacks we stop/i)).toBeVisible();
  });

  test('products section renders', async ({ page }) => {
    await expect(page.getByText(/full stack protection/i)).toBeVisible();
    await expect(page.getByText(/opensyber/i).nth(1)).toBeVisible();
    await expect(page.getByText(/tokenforge/i).first()).toBeVisible();
  });

  test('footer has links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/2026/);
  });

  test('final CTA section renders', async ({ page }) => {
    await expect(page.getByText(/stop flying blind/i)).toBeVisible();
  });
});
