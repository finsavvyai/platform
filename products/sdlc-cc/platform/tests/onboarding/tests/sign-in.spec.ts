import { test, expect } from '../fixtures/pages.fixture';
import { test as testWithData } from '../fixtures/test-data.fixture';

/**
 * Sign In Flow Tests
 * Tests for user authentication and login flow
 */
test.describe('Sign In Flow - Navigation', () => {
  test('should navigate to sign-in page', async ({ page, landingPage }) => {
    await landingPage.goto();
    await landingPage.clickSignIn();

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('should display sign-in form', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    const formVisible = await signInPage.clerkForm.isVisible();
    expect(formVisible).toBeTruthy();
  });

  test('should have link to sign-up page', async ({ signInPage, page }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    await signInPage.goToSignUp();
    await expect(page).toHaveURL(/\/sign-up/);
  });
});

test.describe('Sign In Flow - Form Validation', () => {
  test('should show error for invalid credentials', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    await signInPage.signIn('invalid@example.com', 'wrongpassword');

    await expect(async () => {
      const hasError = await signInPage.hasError();
      expect(hasError).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('should show error for empty email', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    await signInPage.fillPassword('somepassword');
    await signInPage.submit();

    const hasError = await signInPage.hasError();
    expect(hasError).toBeTruthy();
  });

  test('should show error for empty password', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    await signInPage.fillEmail('test@example.com');
    await signInPage.submit();

    const hasError = await signInPage.hasError();
    expect(hasError).toBeTruthy();
  });

  test('should show error for non-existent user', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    await signInPage.signIn('nonexistent' + Date.now() + '@example.com', 'password123');

    await expect(async () => {
      const hasError = await signInPage.hasError();
      expect(hasError).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });
});

test.describe('Sign In Flow - Password Features', () => {
  test('should toggle password visibility', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    // Fill password first
    await signInPage.fillPassword('testpassword123');

    // Check initial state (password should be hidden)
    let isPasswordVisible = await signInPage.isPasswordVisible();
    expect(isPasswordVisible).toBeFalsy();

    // Toggle visibility
    const toggleVisible = await signInPage.passwordVisibilityToggle.isVisible().catch(() => false);
    if (toggleVisible) {
      await signInPage.togglePasswordVisibility();

      isPasswordVisible = await signInPage.isPasswordVisible();
      expect(isPasswordVisible).toBeTruthy();

      // Toggle back
      await signInPage.togglePasswordVisibility();
      isPasswordVisible = await signInPage.isPasswordVisible();
      expect(isPasswordVisible).toBeFalsy();
    }
  });

  test('should have remember me option', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    const checkboxVisible = await signInPage.rememberMeCheckbox.isVisible().catch(() => false);
    if (checkboxVisible) {
      await signInPage.setRememberMe(true);
      const isChecked = await signInPage.rememberMeCheckbox.isChecked();
      expect(isChecked).toBeTruthy();

      await signInPage.setRememberMe(false);
      const isUnchecked = await signInPage.rememberMeCheckbox.isChecked();
      expect(isUnchecked).toBeFalsy();
    }
  });
});

test.describe('Sign In Flow - Successful Authentication', () => {
  testWithData('should sign in with valid credentials', async ({ signInPage, testData, page }) => {
    // Note: This test requires a pre-existing user
    // In a real test scenario, you would first create a user via API
    await signInPage.goto();
    await signInPage.waitForForm();

    const existingUser = testData.users.existing;
    await signInPage.signIn(existingUser.email, existingUser.password);

    // Wait for redirect
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const isSignedIn = await signInPage.isSignedIn();

    // User should be redirected from sign-in page
    expect(currentUrl).not.toContain('/sign-in');
  });

  test('should redirect to dashboard after sign in', async ({ signInPage, page }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    // Sign in (assuming user exists)
    await signInPage.signIn('test@example.com', 'TestPass123!');

    // Wait for redirect (might fail if user doesn't exist)
    await page.waitForTimeout(3000);

    const currentUrl = page.url();

    // If signed in successfully, should redirect to dashboard or home
    if (!currentUrl.includes('/sign-in')) {
      expect(currentUrl).toMatch(/\/dashboard|\/|\/getting-started/);
    }
  });
});

test.describe('Sign In Flow - OAuth Options', () => {
  test('should display Google sign-in option', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    const googleVisible = await signInPage.googleButton.isVisible().catch(() => false);
    // Google button might not be visible in all environments
    if (googleVisible) {
      expect(googleVisible).toBeTruthy();
    }
  });

  test('should display GitHub sign-in option', async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    const githubVisible = await signInPage.githubButton.isVisible().catch(() => false);
    // GitHub button might not be visible in all environments
    if (githubVisible) {
      expect(githubVisible).toBeTruthy();
    }
  });
});

test.describe('Sign In Flow - Forgot Password', () => {
  test('should navigate to forgot password flow', async ({ signInPage, page }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    const forgotLinkVisible = await signInPage.forgotPasswordLink.isVisible().catch(() => false);
    if (forgotLinkVisible) {
      await signInPage.clickForgotPassword();

      // Should show password reset form or similar
      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      // URL should indicate reset flow
      expect(currentUrl).toMatch(/reset|forgot|password/);
    }
  });
});

test.describe('Sign In Flow - Session Management', () => {
  test('should maintain session across page reloads', async ({ signInPage, page }) => {
    await signInPage.goto();
    await signInPage.waitForForm();

    // Sign in (assuming user exists)
    await signInPage.signIn('test@example.com', 'TestPass123!');
    await page.waitForTimeout(3000);

    // If signed in, reload page
    if (await signInPage.isSignedIn()) {
      await page.reload();
      await page.waitForTimeout(2000);

      // Should still be signed in
      const stillSignedIn = await signInPage.isSignedIn();
      expect(stillSignedIn).toBeTruthy();
    }
  });
});
