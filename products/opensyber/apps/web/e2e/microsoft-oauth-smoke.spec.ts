import { test, expect } from '@playwright/test';

/**
 * Microsoft Entra ID OAuth smoke test.
 *
 * Validates the OAuth initiation end-to-end without actually signing a
 * user into Microsoft — MFA and the consent screen aren't reliably
 * automatable, so we stop at the point where Auth.js has handed off to
 * login.microsoftonline.com and inspect the URL parameters Microsoft
 * received. A correct hand-off is a good proxy for the full flow
 * working (client ID wired, redirect URI registered, scopes requested).
 */
test.describe('Microsoft Entra OAuth initiation', () => {
  test('sign-in page renders the Microsoft button', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('button', { name: /microsoft/i })).toBeVisible();
  });

  test('Microsoft button redirects to login.microsoftonline.com with correct params', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /microsoft/i }).click();

    await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15_000 });

    const url = new URL(page.url());
    expect(url.hostname).toBe('login.microsoftonline.com');
    expect(url.pathname).toMatch(/\/common\/oauth2\/v2\.0\/authorize/);

    const params = url.searchParams;
    expect(params.get('client_id')).toBe('414212fb-3cee-44ec-99a4-c9ab3ee78b81');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('redirect_uri')).toBe('https://opensyber.cloud/api/auth/callback/microsoft-entra-id');

    const scope = params.get('scope') ?? '';
    expect(scope).toContain('openid');
    expect(scope).toContain('profile');
    expect(scope).toContain('email');
  });

  test('redirect URI is under opensyber.cloud and uses https', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /microsoft/i }).click();
    await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15_000 });

    const redirectUri = new URL(page.url()).searchParams.get('redirect_uri');
    expect(redirectUri).not.toBeNull();
    const redirect = new URL(redirectUri!);
    expect(redirect.protocol).toBe('https:');
    expect(redirect.hostname).toBe('opensyber.cloud');
    expect(redirect.pathname).toBe('/api/auth/callback/microsoft-entra-id');
  });
});
