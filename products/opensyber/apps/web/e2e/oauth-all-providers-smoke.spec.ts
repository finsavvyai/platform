import { test, expect, type Page } from '@playwright/test';

/**
 * OAuth initiation smoke test for all four providers.
 *
 * Validates every Sign In button redirects to the provider's authorize
 * endpoint with the expected client_id, redirect_uri, and scopes.
 * Stops at the provider's sign-in page — MFA and consent can't be
 * reliably automated.
 *
 * Captures the authorize URL by listening to every response and
 * recording the first one whose URL matches the expected host/path.
 * This catches even providers that briefly pass through the authorize
 * endpoint before redirecting to a login screen (LinkedIn does this).
 */

interface ProviderCase {
  name: RegExp;
  providerId: string;
  expectedHost: string;
  expectedPathPattern: RegExp;
  expectedClientId?: string;
  callbackPath: string;
  requiredScopes: string[];
}

const PROVIDERS: ProviderCase[] = [
  {
    name: /google/i,
    providerId: 'google',
    expectedHost: 'accounts.google.com',
    expectedPathPattern: /\/o\/oauth2\/(v2\/)?auth/,
    callbackPath: '/api/auth/callback/google',
    requiredScopes: ['openid', 'profile', 'email'],
  },
  {
    name: /github/i,
    providerId: 'github',
    expectedHost: 'github.com',
    expectedPathPattern: /\/login\/oauth\/authorize/,
    callbackPath: '/api/auth/callback/github',
    requiredScopes: [],
  },
  {
    name: /microsoft/i,
    providerId: 'microsoft-entra-id',
    expectedHost: 'login.microsoftonline.com',
    expectedPathPattern: /\/common\/oauth2\/v2\.0\/authorize/,
    expectedClientId: '414212fb-3cee-44ec-99a4-c9ab3ee78b81',
    callbackPath: '/api/auth/callback/microsoft-entra-id',
    requiredScopes: ['openid', 'profile', 'email'],
  },
  {
    name: /linkedin/i,
    providerId: 'linkedin',
    expectedHost: 'www.linkedin.com',
    expectedPathPattern: /\/oauth\/v2\/authorization/,
    callbackPath: '/api/auth/callback/linkedin',
    requiredScopes: ['openid', 'profile', 'email'],
  },
];

async function captureAuthorizeUrl(page: Page, provider: ProviderCase): Promise<URL> {
  let captured: URL | null = null;
  const seen: string[] = [];

  const handler = (response: import('@playwright/test').Response): void => {
    const url = response.url();
    seen.push(url);
    if (captured) return;
    try {
      const parsed = new URL(url);
      if (parsed.hostname === provider.expectedHost && provider.expectedPathPattern.test(parsed.pathname)) {
        captured = parsed;
      }
    } catch { /* ignore malformed URLs */ }
  };
  page.on('response', handler);

  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: provider.name })).toBeVisible();
  await page.getByRole('button', { name: provider.name }).click();

  const deadline = Date.now() + 15_000;
  while (!captured && Date.now() < deadline) {
    await page.waitForTimeout(100);
  }
  page.off('response', handler);

  if (!captured) {
    throw new Error(`Never saw ${provider.expectedHost} authorize URL. Visited: ${seen.slice(-5).join(' | ')}`);
  }
  return captured;
}

test.describe('OAuth provider buttons render on sign-in page', () => {
  test('all four provider buttons are visible', async ({ page }) => {
    await page.goto('/sign-in');
    for (const provider of PROVIDERS) {
      await expect(page.getByRole('button', { name: provider.name })).toBeVisible();
    }
  });
});

test.describe('OAuth authorization redirects', () => {
  for (const provider of PROVIDERS) {
    test(`${provider.expectedHost} redirect has correct params`, async ({ page, context }) => {
      await context.clearCookies();
      const url = await captureAuthorizeUrl(page, provider);

      expect(url.hostname).toBe(provider.expectedHost);
      expect(url.pathname).toMatch(provider.expectedPathPattern);

      const params = url.searchParams;
      expect(params.get('response_type')).toBe('code');

      const redirectUri = params.get('redirect_uri');
      expect(redirectUri, 'redirect_uri must be present').not.toBeNull();
      const callback = new URL(redirectUri!);
      expect(callback.protocol).toBe('https:');
      expect(callback.hostname).toBe('opensyber.cloud');
      expect(callback.pathname).toBe(provider.callbackPath);

      if (provider.expectedClientId) {
        expect(params.get('client_id')).toBe(provider.expectedClientId);
      } else {
        expect(params.get('client_id')).toBeTruthy();
      }

      if (provider.requiredScopes.length > 0) {
        const scope = params.get('scope') ?? '';
        for (const required of provider.requiredScopes) {
          expect(scope, `scope missing "${required}"`).toContain(required);
        }
      }
    });
  }
});
