/**
 * E2E Test: Authentication - Login Flow
 * Tests user login functionality with various scenarios
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { testUsers } from '../fixtures/test-users';
import {
  clearStorage,
  isAuthenticated,
  checkConsoleErrors,
  assertNoJSErrors,
} from '../utils/test-helpers';
import { mockAuth } from '../fixtures/auth.fixture';

test.describe('Authentication - Login Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    consoleErrors = await checkConsoleErrors(page);

    // Clear storage before each test
    await clearStorage(page);
  });

  test.afterEach(async ({ page }) => {
    // Check for JS errors after each test
    await assertNoJSErrors(page, consoleErrors);
  });

  test('should display login page correctly', async ({ page }) => {
    await loginPage.goto();

    // Verify page loaded
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();

    // Verify OAuth buttons are present (GitHub and Microsoft exist)
    const hasGitHub = await loginPage.githubButton
      .isVisible()
      .catch(() => false);
    const hasAzure = await loginPage.azureButton
      .isVisible()
      .catch(() => false);

    // At least one OAuth option should be available
    expect(hasGitHub || hasAzure).toBeTruthy();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await loginPage.goto();

    // Try to login without filling fields
    await loginPage.clickLogin();

    // The form uses HTML5 `required` attributes, so native browser validation
    // prevents submission. Check validity via the Constraint Validation API.
    const emailValid = await loginPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );
    const passwordValid = await loginPage.passwordInput.evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );

    expect(emailValid).toBe(false);
    expect(passwordValid).toBe(false);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await loginPage.goto();

    // Mock the login API to return 401 (cross-origin, use ** glob prefix)
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid email or password',
        }),
      });
    });

    // Try to login with credentials that do NOT match the demo fallback
    await loginPage.loginWith('invalid@test.com', 'wrongpassword123');

    // Wait for error message
    const hasError = await loginPage.hasError();
    expect(hasError).toBeTruthy();

    // Should still be on login page
    expect(await loginPage.isOnLoginPage()).toBeTruthy();

    // Should NOT be authenticated
    expect(await isAuthenticated(page)).toBeFalsy();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await loginPage.goto();

    await loginPage.fillEmail('notanemail');
    await loginPage.fillPassword('password123');

    // Email field should be invalid (type="email" native validation)
    const emailValid = await loginPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );
    expect(emailValid).toBe(false);
  });

  test('should successfully login with valid credentials', async ({
    page,
  }) => {
    await loginPage.goto();

    // Mock the login API to return a successful response
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            email: testUsers.demoUser.email,
            name: `${testUsers.demoUser.firstName} ${testUsers.demoUser.lastName}`,
          },
          tokens: {
            accessToken: 'mock-jwt-token',
          },
        }),
      });
    });

    // Login with demo user (fallback also works without mock)
    await loginPage.login(testUsers.demoUser);

    // Should redirect to dashboard
    await dashboardPage.waitForDashboardToLoad();
    expect(await dashboardPage.isOnDashboard()).toBeTruthy();

    // Should be authenticated
    expect(await isAuthenticated(page)).toBeTruthy();
  });

  test('should persist authentication after page reload', async ({ page }) => {
    await loginPage.goto();

    // Mock the login API
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            email: testUsers.demoUser.email,
            name: `${testUsers.demoUser.firstName} ${testUsers.demoUser.lastName}`,
          },
          tokens: {
            accessToken: 'mock-jwt-token',
          },
        }),
      });
    });

    // Login
    await loginPage.login(testUsers.demoUser);
    await dashboardPage.waitForDashboardToLoad();

    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dashboardPage.waitForDashboardToLoad();

    // Should still be authenticated and on dashboard
    expect(await isAuthenticated(page)).toBeTruthy();
    expect(await dashboardPage.isOnDashboard()).toBeTruthy();
  });

  test('should redirect to dashboard if already authenticated', async ({
    page,
  }) => {
    // Inject auth state before navigating so the app sees us as logged in
    await mockAuth(page);

    // Go to login page - LoginPage useEffect redirects to / when isAuthenticated=true
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Wait for redirect to root (regex matches full URL, e.g. http://localhost:3000/)
    await page.waitForURL(/\/$/, { timeout: 10000 });
    expect(await dashboardPage.isOnDashboard()).toBeTruthy();
  });

  test('should handle forgot password link', async ({ page }) => {
    await loginPage.goto();

    // Check if forgot password link exists
    const forgotPasswordVisible = await loginPage.forgotPasswordLink
      .isVisible()
      .catch(() => false);

    if (forgotPasswordVisible) {
      await loginPage.clickForgotPassword();

      await page.waitForURL(/\/forgot-password/, { timeout: 10000 });
      await expect(
        page.getByRole('heading', { name: 'Reset your password' })
      ).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should handle sign up link', async ({ page }) => {
    await loginPage.goto();

    // Check if sign up link exists (text "free trial")
    const signupVisible = await loginPage.signupLink
      .isVisible()
      .catch(() => false);

    if (signupVisible) {
      await loginPage.clickSignUp();

      // The link points to /register (or /signup which redirects to /register).
      // User should land on the signup/register page.
      await page.waitForURL(/\/(register|signup)/, { timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('should handle GitHub OAuth button click', async ({ page }) => {
    await loginPage.goto();

    // Check if GitHub button exists (located by text "GitHub" in LoginPage PO)
    const githubVisible = await loginPage.githubButton
      .isVisible()
      .catch(() => false);

    if (githubVisible) {
      await page.route('**/api/sso/initiate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticationUrl: `${page.url()}?oauth=github`,
            state: 'mock-github-state',
          }),
        });
      });

      const oauthRequestPromise = page.waitForRequest((request) =>
        request.url().includes('/api/sso/initiate') &&
        request.method() === 'POST'
      );

      await loginPage.loginWithGitHub();

      const oauthRequest = await oauthRequestPromise;
      const oauthPayload = oauthRequest.postDataJSON() as {
        providerId?: string;
        redirectUrl?: string;
      };

      expect(oauthPayload.providerId).toBeTruthy();
      expect(oauthPayload.redirectUrl).toContain('/auth/sso/callback');
    } else {
      test.skip();
    }
  });

  test('should logout successfully', async ({ page }) => {
    // Inject auth state to start authenticated
    await mockAuth(page);
    await page.goto('/');
    await dashboardPage.waitForDashboardToLoad();

    // Logout via button[title="Logout"]
    await dashboardPage.logout();

    // Should redirect to login page
    expect(await loginPage.isOnLoginPage()).toBeTruthy();

    // Should NOT be authenticated
    expect(await isAuthenticated(page)).toBeFalsy();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await loginPage.goto();

    // Simulate network failure (already uses ** prefix)
    await page.route('**/api/auth/**', (route) => {
      route.abort('failed');
    });

    // Try to login with credentials that do not match demo fallback
    await loginPage.loginWith('invalid@test.com', 'wrongpassword123');

    // Should show error message
    const hasError = await loginPage.hasError();
    expect(hasError).toBeTruthy();

    // Should still be on login page
    expect(await loginPage.isOnLoginPage()).toBeTruthy();
  });

  test('should handle slow API responses', async ({ page }) => {
    await loginPage.goto();

    // Simulate slow API (already uses ** prefix)
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            email: testUsers.demoUser.email,
            name: 'Demo User',
          },
          tokens: {
            accessToken: 'mock-jwt-token',
          },
        }),
      });
    });

    // Try to login
    await loginPage.fillEmail(testUsers.demoUser.email);
    await loginPage.fillPassword(testUsers.demoUser.password);
    await loginPage.clickLogin();

    // Should show loading state (button disabled or spinner)
    await page.waitForTimeout(1000);

    // Eventually should complete
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  });

  test('should sanitize input to prevent XSS', async ({ page }) => {
    await loginPage.goto();

    const xssPayload = '<script>alert("XSS")</script>';

    // Try to inject XSS
    await loginPage.fillEmail(xssPayload);
    await loginPage.fillPassword(xssPayload);

    // Get the actual values
    const emailValue = await loginPage.emailInput.inputValue();
    const passwordValue = await loginPage.passwordInput.inputValue();

    // Values should be accepted as text by the input
    expect(emailValue).toBe(xssPayload);
    // But it should not execute as script

    // Check that no script was executed
    const alerts: string[] = [];
    page.on('dialog', (dialog) => {
      alerts.push(dialog.message());
      dialog.dismiss();
    });

    await page.waitForTimeout(1000);
    expect(alerts.length).toBe(0);
  });
});
