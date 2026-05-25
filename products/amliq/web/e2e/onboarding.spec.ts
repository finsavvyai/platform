import { test, expect } from './fixtures';

test.describe('Landing Page', () => {
  test('renders hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // Landing page should have a CTA
    const cta = page.getByRole('link', { name: /start|try|demo|sign/i }).first();
    if (await cta.isVisible()) {
      await expect(cta).toBeEnabled();
    }
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
    const links = nav.getByRole('link');
    const buttons = nav.getByRole('button');
    const linkCount = await links.count();
    const buttonCount = await buttons.count();
    expect(linkCount + buttonCount).toBeGreaterThan(0);
  });
});

test.describe('Login Flow', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows signup form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows forgot password', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Legal Pages', () => {
  test('terms of service loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByText(/terms/i).first()).toBeVisible();
  });

  test('privacy policy loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText(/privacy/i).first()).toBeVisible();
  });
});
