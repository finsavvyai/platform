import { test, expect } from '@playwright/test';

test.describe('Auth Pages', () => {
  test('sign-in page renders Auth.js OAuth providers', async ({ page }) => {
    await page.goto('/sign-in');
    // Auth.js renders provider buttons (Google, GitHub, Microsoft, LinkedIn)
    const providerButton = page.getByRole('button', { name: /continue (with )?(google|github|microsoft|linkedin)/i }).first();
    await expect(providerButton).toBeVisible();
  });

  test('sign-up page renders Auth.js OAuth providers', async ({ page }) => {
    await page.goto('/sign-up');
    const providerButton = page.getByRole('button', { name: /continue (with )?(google|github|microsoft|linkedin)/i }).first();
    await expect(providerButton).toBeVisible();
  });

  test('sign-in page has correct page title', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveTitle(/sign.in|opensyber/i);
  });

  test('sign-up page has correct page title', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page).toHaveTitle(/sign.up|opensyber/i);
  });
});
