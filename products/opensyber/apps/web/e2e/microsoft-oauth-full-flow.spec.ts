import { test, expect } from '@playwright/test';

/**
 * Microsoft Entra OAuth full flow — semi-automated.
 *
 * Playwright drives the sign-in page and the redirect chain; a human
 * enters credentials / MFA / grants consent in the same window. After
 * the browser lands back on /dashboard, Playwright resumes and
 * validates the session landed cleanly.
 *
 * Run with: pnpm exec playwright test microsoft-oauth-full-flow --headed
 */

test.use({
  headless: false,
  viewport: { width: 1280, height: 900 },
});

test.describe('Microsoft OAuth full flow (human-assisted)', () => {
  test('sign in with Microsoft end-to-end', async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto('/sign-in');
    await expect(page.getByRole('button', { name: /microsoft/i })).toBeVisible();

    await page.getByRole('button', { name: /microsoft/i }).click();

    await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15_000 });
    console.log('→ Redirected to Microsoft. Complete sign-in + consent in the browser window.');

    await page.waitForURL(/opensyber\.cloud\/dashboard/, { timeout: 240_000 });
    console.log('← Returned to /dashboard.');

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/profile');
    await expect(page.locator('body')).toContainText(/Microsoft/i, { timeout: 10_000 });
  });
});
