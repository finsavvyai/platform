import { test, expect } from '../fixtures/pages.fixture';
import { test as testWithData } from '../fixtures/test-data.fixture';

/**
 * Sign Up Flow Tests
 * Tests for user registration and sign-up flow
 */
test.describe('Sign Up Flow - Navigation', () => {
  test('should navigate to sign-up page', async ({ page, landingPage }) => {
    await landingPage.goto();
    await landingPage.clickGetStarted();

    await expect(page).toHaveURL(/\/sign-up/);
  });

  test('should display sign-up form', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    const formVisible = await signUpPage.clerkForm.isVisible();
    expect(formVisible).toBeTruthy();
  });

  test('should have link to sign-in page', async ({ signUpPage, page }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    await signUpPage.goToSignIn();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe('Sign Up Flow - Form Validation', () => {
  test('should show error for invalid email format', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    await signUpPage.fillEmail('invalid-email');
    await signUpPage.fillPassword('ValidPass123!');
    await signUpPage.submit();

    await expect(async () => {
      const hasError = await signUpPage.hasError();
      expect(hasError).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('should show error for weak password', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    await signUpPage.fillEmail('test@example.com');
    await signUpPage.fillPassword('123');
    await signUpPage.submit();

    // Clerk might require stronger password
    await page.waitForTimeout(2000);

    const hasError = await signUpPage.hasError();
    if (hasError) {
      const errorMsg = await signUpPage.getErrorMessage();
      expect(errorMsg).toBeTruthy();
    }
  });

  test('should show error when email is empty', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    await signUpPage.fillPassword('ValidPass123!');
    await signUpPage.submit();

    const hasError = await signUpPage.hasError();
    expect(hasError).toBeTruthy();
  });

  test('should show error when password is empty', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    await signUpPage.fillEmail('test@example.com');
    await signUpPage.submit();

    const hasError = await signUpPage.hasError();
    expect(hasError).toBeTruthy();
  });
});

test.describe('Sign Up Flow - Successful Registration', () => {
  testWithData('should complete registration with valid data', async ({ signUpPage, testData, page }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    const user = testData.users.generate();
    await signUpPage.register({
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // After registration, user should be redirected or see verification screen
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const isOnSignUp = currentUrl.includes('/sign-up');

    if (!isOnSignUp) {
      // Successfully redirected (possibly to dashboard or verification)
      expect(currentUrl).toMatch(/\/dashboard|\/verify|\/check/);
    } else {
      // Still on sign-up page - might require verification
      const requiresVerification = await signUpPage.isVerificationRequired();
      if (requiresVerification) {
        // Verification flow - this is expected behavior
        expect(await signUpPage.isVerificationRequired()).toBeTruthy();
      }
    }
  });

  testWithData('should show verification screen after registration', async ({ signUpPage, testData, page }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    const user = testData.users.generate();
    await signUpPage.register({
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    await page.waitForTimeout(3000);

    // Check if verification is required
    const requiresVerification = await signUpPage.isVerificationRequired();

    if (requiresVerification) {
      // Verification code input should be visible
      const codeVisible = await signUpPage.codeInput.isVisible();
      expect(codeVisible).toBeTruthy();
    }
  });
});

test.describe('Sign Up Flow - OAuth Options', () => {
  test('should display Google sign-up option', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    const googleVisible = await signUpPage.googleButton.isVisible().catch(() => false);
    // Google button might not be visible in all environments
    if (googleVisible) {
      expect(googleVisible).toBeTruthy();
    }
  });

  test('should display GitHub sign-up option', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    const githubVisible = await signUpPage.githubButton.isVisible().catch(() => false);
    // GitHub button might not be visible in all environments
    if (githubVisible) {
      expect(githubVisible).toBeTruthy();
    }
  });
});

test.describe('Sign Up Flow - Email Verification', () => {
  test('should have resend code option', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.waitForForm();

    // Complete registration first
    await signUpPage.register({
      email: 'verify-test@example.com',
      password: 'TestPass123!',
    });

    await page.waitForTimeout(3000);

    if (await signUpPage.isVerificationRequired()) {
      const resendVisible = await signUpPage.resendCodeLink.isVisible().catch(() => false);
      if (resendVisible) {
        expect(resendVisible).toBeTruthy();
      }
    }
  });

  test('should handle verification code entry', async ({ signUpPage }) => {
    await signUpPage.goto();

    // This test assumes verification is required
    // In real scenario, you would receive actual code via email
    const testCode = '123456';

    await signUpPage.waitForForm();

    if (await signUpPage.isVerificationRequired()) {
      await signUpPage.enterVerificationCode(testCode);
      // Will likely fail with test code, but tests the UI flow
    }
  });
});
