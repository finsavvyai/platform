import { test, expect } from '@playwright/test';
import { mockAuth } from './fixtures/auth.fixture';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('#email-address')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Click the submit button without filling in any fields
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The form uses HTML5 `required` attribute, so native browser validation
    // prevents submission. Check that the email input is invalid via the
    // Constraint Validation API.
    const emailValid = await page.locator('#email-address')
      .evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(emailValid).toBe(false);

    const passwordValid = await page.locator('#password')
      .evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(passwordValid).toBe(false);
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.locator('#email-address').fill('invalid-email');
    await page.locator('#password').fill('password123');

    // The input type="email" triggers native validation for malformed emails.
    // Check that the email field is invalid via the Constraint Validation API.
    const emailValid = await page.locator('#email-address')
      .evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(emailValid).toBe(false);
  });

  test('should attempt login with valid credentials', async ({ page }) => {
    // Mock successful login response (cross-origin, use ** glob prefix)
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
          },
          tokens: {
            accessToken: 'mock-jwt-token',
          },
        }),
      });
    });

    await page.locator('#email-address').fill('test@example.com');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to dashboard (root route)
    await expect(page).toHaveURL('/');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Mock failed login response (cross-origin, use ** glob prefix)
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid email or password',
        }),
      });
    });

    await page.locator('#email-address').fill('test@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    // The "free trial" link points to /register (or /signup which redirects to /register).
    // Verify the link exists and clicking it navigates to the signup page.
    const trialLink = page.locator('a:has-text("free trial")');
    await expect(trialLink).toBeVisible();
    await trialLink.click();

    // User should land on the signup/register page
    await expect(page).toHaveURL(/\/(register|signup)/);
  });

  test('should complete registration flow', async ({ page }) => {
    // Navigate to /register (which IS a valid auth route)
    await page.goto('/register');

    // Mock successful registration response
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Account created successfully',
        }),
      });
    });

    // SignupPage field IDs: #company, #name, #email, #password, #confirmPassword
    await page.locator('#company').fill('Acme Corp');
    await page.locator('#name').fill('John Doe');
    await page.locator('#email').fill('john@example.com');
    await page.locator('#password').fill('SecurePassword1');
    await page.locator('#confirmPassword').fill('SecurePassword1');
    await page.locator('#agree-terms').check();
    await page.getByRole('button', { name: 'Start Free Trial' }).click();

    // On success the SignupPage shows "Registration Successful!"
    await expect(page.getByText('Registration Successful!')).toBeVisible();
  });

  test('should handle password reset link', async ({ page }) => {
    // Forgot password is a real auth route in the current release.
    const forgotLink = page.getByRole('link', { name: 'Forgot password?' });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });
});

test.describe('Authenticated User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state using Zustand persist store
    await mockAuth(page);

    await page.goto('/');
  });

  test('should display dashboard for authenticated user', async ({ page }) => {
    // Wait for the page title to appear (the dashboard page object uses h2/h1)
    await expect(page.locator('h2, h1').first()).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await page.locator('button[title="Logout"]:visible').click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('form')).toBeVisible();
  });
});
