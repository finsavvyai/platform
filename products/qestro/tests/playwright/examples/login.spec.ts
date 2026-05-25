/**
 * Login Functionality Tests
 * Tests for user authentication and login flows
 */

import { test, expect } from '../fixtures/testFixtures';
import { testData } from '../fixtures/testFixtures';
import { PlaywrightTestHelpers } from '../utils/testHelpers';

test.describe('Login Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Enable network request logging for debugging
    await PlaywrightTestHelpers.logNetworkRequests(page);
  });

  test('should display login form correctly', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.expectLoginFormToBeVisible();
    await loginPage.expectTitleToContain('Login');
  });

  test('should login with valid credentials', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.loginWithValidCredentials();
    await loginPage.expectLoginSuccess();
  });

  test('should show error for invalid credentials', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.loginWithInvalidCredentials();
    await loginPage.expectErrorMessage('Invalid email or password');
  });

  test('should validate required fields', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.clickLoginButton();
    
    // Should show validation errors for empty fields
    await loginPage.expectErrorMessage('Email is required');
  });

  test('should validate email format', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.fillEmail('invalid-email');
    await loginPage.fillPassword('password123');
    await loginPage.clickLoginButton();
    
    await loginPage.expectErrorMessage('Please enter a valid email address');
  });

  test('should handle login loading state', async ({ loginPage, page }) => {
    // Mock slow API response
    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/auth/login', {
      success: true,
      token: 'mock-token'
    });
    
    await loginPage.goto();
    await loginPage.fillEmail(testData.users.validUser.email);
    await loginPage.fillPassword(testData.users.validUser.password);
    await loginPage.clickLoginButton();
    
    // Should show loading state
    await loginPage.expectLoadingState();
  });

  test('should redirect to dashboard after successful login', async ({ loginPage, dashboardPage }) => {
    await loginPage.goto();
    await loginPage.loginWithValidCredentials();
    await dashboardPage.expectDashboardToBeLoaded();
  });

  test('should remember login state', async ({ page, loginPage, dashboardPage }) => {
    // Login first
    await loginPage.goto();
    await loginPage.loginWithValidCredentials();
    await dashboardPage.expectDashboardToBeLoaded();
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await dashboardPage.expectDashboardToBeLoaded();
  });

  test('should handle network errors gracefully', async ({ loginPage, page }) => {
    // Mock network error
    await PlaywrightTestHelpers.mockApiError(page, '**/api/auth/login', 500);
    
    await loginPage.goto();
    await loginPage.loginWithValidCredentials();
    
    await loginPage.expectErrorMessage('Something went wrong. Please try again.');
  });

  test('should clear form when requested', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.fillEmail('test@example.com');
    await loginPage.fillPassword('password123');
    
    await loginPage.clearLoginForm();
    
    // Form should be empty
    expect(await loginPage.getElementText('[data-testid=email]')).toBe('');
    expect(await loginPage.getElementText('[data-testid=password]')).toBe('');
  });
});

test.describe('Login Accessibility', () => {
  test('should be keyboard navigable', async ({ loginPage, page }) => {
    await loginPage.goto();
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid=email]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid=password]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid=login-button]')).toBeFocused();
  });

  test('should support screen readers', async ({ loginPage, page }) => {
    await loginPage.goto();
    
    // Check for proper ARIA labels
    const emailInput = page.locator('[data-testid=email]');
    const passwordInput = page.locator('[data-testid=password]');
    
    await expect(emailInput).toHaveAttribute('aria-label', 'Email address');
    await expect(passwordInput).toHaveAttribute('aria-label', 'Password');
  });
});

test.describe('Login Performance', () => {
  test('should load quickly', async ({ loginPage, page }) => {
    const startTime = Date.now();
    await loginPage.goto();
    await loginPage.expectLoginFormToBeVisible();
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have good performance metrics', async ({ loginPage, page }) => {
    await loginPage.goto();
    await PlaywrightTestHelpers.waitForNetworkIdle(page);
    
    const metrics = await PlaywrightTestHelpers.getPerformanceMetrics(page);
    
    // Performance assertions
    expect(metrics.firstContentfulPaint).toBeLessThan(2000);
    expect(metrics.totalLoadTime).toBeLessThan(3000);
  });
});

test.describe('Login Mobile', () => {
  test('should work on mobile devices', async ({ loginPage, page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await loginPage.goto();
    await loginPage.expectLoginFormToBeVisible();
    await loginPage.loginWithValidCredentials();
    await loginPage.expectLoginSuccess();
  });

  test('should be responsive', async ({ loginPage, page }) => {
    await loginPage.goto();
    
    // Test different viewport sizes
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 375, height: 667 }, // iPhone 8
      { width: 768, height: 1024 }, // iPad
      { width: 1024, height: 768 }  // iPad Landscape
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await loginPage.expectLoginFormToBeVisible();
    }
  });
});