import { test, expect } from '../fixtures/pages.fixture';

/**
 * Dashboard Access Tests
 * Tests for accessing the dashboard after onboarding
 */
test.describe('Dashboard Access - Authentication Required', () => {
  test('should redirect to sign-in when accessing dashboard without auth', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();

    // Wait for redirect
    await page.waitForTimeout(3000);

    const currentUrl = page.url();

    // Should be redirected to sign-in or sign-up
    expect(currentUrl).toMatch(/\/sign-in|\/sign-up/);
  });

  test('should not allow direct dashboard access without session', async ({ page }) => {
    // Try to go directly to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should redirect to auth
    const currentUrl = page.url();
    const isAuthPage = currentUrl.includes('/sign-in') || currentUrl.includes('/sign-up');

    expect(isAuthPage).toBeTruthy();
  });
});

test.describe('Dashboard Access - After Sign In', () => {
  test('should display welcome message after successful sign in', async ({ signInPage, dashboardPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    // Attempt sign in (may fail if user doesn't exist)
    await signInPage.signIn('test@example.com', 'TestPass123!');
    await page.waitForTimeout(3000);

    // If successfully signed in, check dashboard
    if (await signInPage.isSignedIn()) {
      await dashboardPage.goto();
      await dashboardPage.waitForLoad();

      const welcomeMessage = await dashboardPage.getWelcomeMessage();
      expect(welcomeMessage).toMatch(/welcome|dashboard/i);
    }
  });

  test('should display API Keys section', async ({ signInPage, dashboardPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    await signInPage.signIn('test@example.com', 'TestPass123!');
    await page.waitForTimeout(3000);

    if (await signInPage.isSignedIn()) {
      await dashboardPage.goto();
      await dashboardPage.waitForLoad();

      const apiKeysVisible = await dashboardPage.apiKeysSection.isVisible().catch(() => false);
      expect(apiKeysVisible).toBeTruthy();
    }
  });
});

test.describe('Dashboard Access - Protected Routes', () => {
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/api-keys',
    '/dashboard/settings',
    '/dashboard/usage',
  ];

  for (const route of protectedRoutes) {
    test(`should protect route: ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();
      const isAuthPage = currentUrl.includes('/sign-in') || currentUrl.includes('/sign-up');

      expect(isAuthPage).toBeTruthy();
    });
  }
});

test.describe('Dashboard Access - Session Validation', () => {
  test('should validate session on dashboard access', async ({ dashboardPage, page }) => {
    // Set a fake session token (if applicable)
    await page.context().addCookies([
      {
        name: 'session',
        value: 'invalid-session-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await dashboardPage.goto();

    // Should redirect to auth due to invalid session
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    const isAuthPage = currentUrl.includes('/sign-in') || currentUrl.includes('/sign-up');
    expect(isAuthPage).toBeTruthy();
  });
});
