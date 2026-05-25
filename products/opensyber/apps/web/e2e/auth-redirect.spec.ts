import { test, expect } from '@playwright/test';

test.describe('Auth Redirects', () => {
  test('dashboard redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    // Clerk middleware should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test('settings redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/sign-in/);
  });
});
