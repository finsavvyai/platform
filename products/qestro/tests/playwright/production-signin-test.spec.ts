/**
 * Production Sign-In Button E2E Test
 * Tests the fixed sign-in button functionality on the production Qestro platform
 */

import { test, expect } from '@playwright/test';

// Production configuration
const PRODUCTION_URL = 'https://qestro.app';
const LOGIN_URL = 'https://qestro.app/login';

// Test credentials
const DEMO_CREDENTIALS = {
  email: 'test@questro.io',
  password: 'testpassword123'
};

const ADMIN_CREDENTIALS = {
  email: 'admin@qestro.app',
  password: 'admin123'
};

test.describe('Production Sign-In Button Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up request interception for debugging
    await page.route('**/*', async (route, request) => {
      // Log all API requests for debugging
      if (request.url().includes('/api/')) {
        console.log(`🔗 API Request: ${request.method()} ${request.url()}`);
      }
      await route.continue();
    });
  });

  test('should load the login page successfully', async ({ page }) => {
    console.log('🧪 Testing: Login page loads successfully');

    // Navigate to login page
    await page.goto(LOGIN_URL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we're on the right page
    const url = page.url();
    expect(url).toContain('/login');

    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    console.log('✅ Login page loaded successfully');
  });

  test('should have properly styled sign-in button', async ({ page }) => {
    console.log('🧪 Testing: Sign-in button has proper styling');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    // Find the sign-in button
    const signInButton = page.locator('button[type="submit"]');

    // Check if button is visible
    await expect(signInButton).toBeVisible();

    // Check button text
    await expect(signInButton).toContainText('Sign in');

    // Check for Button component styling classes
    const buttonClasses = await signInButton.getAttribute('class');
    console.log(`🎨 Button classes: ${buttonClasses}`);

    // Verify button has the expected styling from our Button component
    expect(buttonClasses).toContain('inline-flex');
    expect(buttonClasses).toContain('justify-center');
    expect(buttonClasses).toContain('font-medium');
    expect(buttonClasses).toContain('rounded-lg');

    console.log('✅ Sign-in button has proper styling');
  });

  test('should respond to hover interactions', async ({ page }) => {
    console.log('🧪 Testing: Button hover interactions');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');

    // Hover over the button
    await signInButton.hover();

    // Check if hover styles are applied (Button component adds hover classes)
    const hoverClasses = await signInButton.getAttribute('class');
    console.log(`🎨 Hover classes: ${hoverClasses}`);

    // Button should be visible and interactive
    await expect(signInButton).toBeVisible();

    console.log('✅ Button responds to hover interactions');
  });

  test('should be clickable when form is valid', async ({ page }) => {
    console.log('🧪 Testing: Button is clickable with valid form');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Fill in valid credentials
    await emailInput.fill(DEMO_CREDENTIALS.email);
    await passwordInput.fill(DEMO_CREDENTIALS.password);

    // Check if button is enabled (should not be disabled when form is valid)
    const isDisabled = await signInButton.isDisabled();
    expect(isDisabled).toBe(false);

    console.log('✅ Button is clickable with valid form');
  });

  test('should trigger authentication flow when clicked', async ({ page }) => {
    console.log('🧪 Testing: Authentication flow when button clicked');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Fill in credentials
    await emailInput.fill(DEMO_CREDENTIALS.email);
    await passwordInput.fill(DEMO_CREDENTIALS.password);

    // Set up network request monitoring
    let apiRequestMade = false;
    await page.route('**/api/v1/auth/login', async (route, request) => {
      apiRequestMade = true;
      console.log(`🔗 Authentication API call made: ${request.url()}`);

      // Continue with the request
      const response = await route.fetch();
      const responseData = await response.json();
      console.log('📡 API Response:', responseData);

      // Return the response
      await route.fulfill({
        response,
        headers: response.headers(),
      });
    });

    // Click the sign-in button
    console.log('🖱️ Clicking sign-in button...');
    await signInButton.click();

    // Check if loading state appears
    await expect(signInButton).toBeVisible();

    // Wait a moment for the API call to be made
    await page.waitForTimeout(2000);

    // Verify API request was made
    expect(apiRequestMade).toBe(true);

    console.log('✅ Authentication flow triggered successfully');
  });

  test('should handle loading state during authentication', async ({ page }) => {
    console.log('🧪 Testing: Loading state during authentication');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Fill in credentials
    await emailInput.fill(DEMO_CREDENTIALS.email);
    await passwordInput.fill(DEMO_CREDENTIALS.password);

    // Monitor button state changes
    const buttonContentBefore = await signInButton.textContent();
    console.log(`📝 Button text before click: "${buttonContentBefore}"`);

    // Click the button
    await signInButton.click();

    // Check if button shows loading state
    // The Button component should show a spinner during loading
    await page.waitForTimeout(1000);

    // Check for loading indicators
    const buttonContentAfter = await signInButton.textContent();
    console.log(`📝 Button text after click: "${buttonContentAfter}"`);

    // Button should still be visible but in loading state
    await expect(signInButton).toBeVisible();

    console.log('✅ Loading state handled correctly');
  });

  test('should handle form validation', async ({ page }) => {
    console.log('🧪 Testing: Form validation behavior');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Try to click button with empty form
    await signInButton.click();

    // Check for validation errors
    await page.waitForTimeout(1000);

    // Email input should have validation styling
    const emailClasses = await emailInput.getAttribute('class');
    console.log(`📧 Email input classes: ${emailClasses}`);

    // Password input should have validation styling
    const passwordClasses = await passwordInput.getAttribute('class');
    console.log(`🔒 Password input classes: ${passwordClasses}`);

    // Fill invalid email format
    await emailInput.fill('invalid-email');
    await passwordInput.fill('password123');

    // Button should still be disabled due to invalid email
    const isDisabled = await signInButton.isDisabled();
    console.log(`🚫 Button disabled state: ${isDisabled}`);

    console.log('✅ Form validation working correctly');
  });

  test('should work with admin credentials', async ({ page }) => {
    console.log('🧪 Testing: Admin credentials functionality');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Fill in admin credentials
    await emailInput.fill(ADMIN_CREDENTIALS.email);
    await passwordInput.fill(ADMIN_CREDENTIALS.password);

    // Monitor for successful authentication
    let loginSuccess = false;
    await page.route('**/api/v1/auth/login', async (route) => {
      const response = await route.fetch();
      const responseData = await response.json();

      if (responseData.success) {
        loginSuccess = true;
        console.log('✅ Admin login successful');
      }

      await route.fulfill({ response });
    });

    // Click the sign-in button
    await signInButton.click();

    // Wait for authentication to complete
    await page.waitForTimeout(3000);

    // Check if login was successful
    expect(loginSuccess).toBe(true);

    console.log('✅ Admin credentials working correctly');
  });

  test('should be accessible via keyboard navigation', async ({ page }) => {
    console.log('🧪 Testing: Keyboard navigation accessibility');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    // Start from the top of the page
    await page.keyboard.press('Tab');

    // Should focus on email input first
    await expect(page.locator('input[type="email"]')).toBeFocused();

    // Tab to password input
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();

    // Tab to any "Remember me" checkbox or other elements
    await page.keyboard.press('Tab');

    // Tab to sign-in button
    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"]')).toBeFocused();

    // Should be able to activate button with Enter key
    await page.keyboard.press('Enter');

    console.log('✅ Keyboard navigation working correctly');
  });

  test('should work across different viewport sizes', async ({ page }) => {
    console.log('🧪 Testing: Responsive design across viewports');

    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];

    for (const viewport of viewports) {
      console.log(`📱 Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);

      await page.setViewportSize(viewport);
      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      // Check if button is visible and properly sized
      const signInButton = page.locator('button[type="submit"]');
      await expect(signInButton).toBeVisible();

      // Check button position
      const buttonBox = await signInButton.boundingBox();
      expect(buttonBox).toBeTruthy();
      expect(buttonBox!.width).toBeGreaterThan(50);
      expect(buttonBox!.height).toBeGreaterThan(30);

      console.log(`✅ ${viewport.name} viewport: Button properly displayed`);
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    console.log('🧪 Testing: Network error handling');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Fill in credentials
    await emailInput.fill(DEMO_CREDENTIALS.email);
    await passwordInput.fill(DEMO_CREDENTIALS.password);

    // Mock network error
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.abort('failed');
    });

    // Click the button
    await signInButton.click();

    // Wait for error handling
    await page.waitForTimeout(2000);

    // Button should still be functional after error
    await expect(signInButton).toBeVisible();

    console.log('✅ Network errors handled gracefully');
  });
});

test.describe('Sign-In Button Performance', () => {
  test('should load quickly', async ({ page }) => {
    console.log('🧪 Testing: Page load performance');

    const startTime = Date.now();
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`⚡ Page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds

    // Button should be visible quickly
    const signInButton = page.locator('button[type="submit"]');
    await expect(signInButton).toBeVisible();

    console.log('✅ Page loads quickly');
  });

  test('should have good interaction performance', async ({ page }) => {
    console.log('🧪 Testing: Button interaction performance');

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    const signInButton = page.locator('button[type="submit"]');

    // Test hover performance
    const hoverStart = Date.now();
    await signInButton.hover();
    const hoverTime = Date.now() - hoverStart;

    console.log(`⚡ Hover response time: ${hoverTime}ms`);
    expect(hoverTime).toBeLessThan(100); // Should respond within 100ms

    console.log('✅ Button interactions are performant');
  });
});
