import { type Page, type BrowserContext } from '@playwright/test';
import { type TestUser } from '../fixtures/test-users';
import { URLS } from '../fixtures/urls';

/**
 * Authentication helper utilities for LunaOS E2E tests.
 * Handles login, signup, token management, and session state.
 */

export async function loginViaUI(
  page: Page,
  user: TestUser
): Promise<void> {
  const dashboardUrl = URLS.dashboard.base;
  await page.goto(`${dashboardUrl}${URLS.dashboard.login}`);
  await page.waitForLoadState('networkidle');

  await page.fill('[data-testid="email-input"], input[type="email"]', user.email);
  await page.fill('[data-testid="password-input"], input[type="password"]', user.password);
  await page.click('[data-testid="login-button"], button[type="submit"]');

  await page.waitForURL(
    (url) => !url.pathname.includes('/login'),
    { timeout: 15_000 }
  );
}

export async function signupViaUI(
  page: Page,
  user: TestUser
): Promise<void> {
  const dashboardUrl = URLS.dashboard.base;
  await page.goto(`${dashboardUrl}${URLS.dashboard.signup}`);
  await page.waitForLoadState('networkidle');

  await page.fill('[data-testid="name-input"], input[name="name"]', user.name);
  await page.fill('[data-testid="email-input"], input[type="email"]', user.email);
  await page.fill('[data-testid="password-input"], input[type="password"]', user.password);

  const confirmField = page.locator(
    '[data-testid="confirm-password-input"], input[name="confirmPassword"]'
  );
  if (await confirmField.isVisible()) {
    await confirmField.fill(user.password);
  }

  const tosCheckbox = page.locator(
    '[data-testid="tos-checkbox"], input[name="terms"]'
  );
  if (await tosCheckbox.isVisible()) {
    await tosCheckbox.check();
  }

  await page.click('[data-testid="signup-button"], button[type="submit"]');
}

export async function loginViaAPI(
  context: BrowserContext,
  user: TestUser
): Promise<string> {
  const apiUrl = URLS.api.base;
  const response = await context.request.post(
    `${apiUrl}/auth/login`,
    {
      data: { email: user.email, password: user.password },
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const body = await response.json();
  return body.token || body.accessToken || '';
}

export async function setAuthToken(
  page: Page,
  token: string
): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('lunaos_token', t);
  }, token);
}

export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('lunaos_token');
    return token !== null && token.length > 0;
  });
}
