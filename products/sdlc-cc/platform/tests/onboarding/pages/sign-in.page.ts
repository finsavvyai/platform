import { Page, Locator, expect } from '@playwright/test';

/**
 * Sign In Page Object Model
 * Encapsulates all interactions with the SDLC.ai sign-in/login page
 */
export class SignInPage {
  readonly page: Page;

  // Page containers
  readonly signInContainer: Locator;
  readonly clerkForm: Locator;

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;

  // Buttons
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;

  // Alternative sign-in methods
  readonly googleButton: Locator;
  readonly githubButton: Locator;
  readonly samlButton: Locator;

  // Error/success messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  // Password visibility toggle
  readonly passwordVisibilityToggle: Locator;

  // Remember me checkbox
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;

    // Clerk uses dynamic classes
    this.signInContainer = page.locator('[class*="cl-"], .cl-signIn, [class*="SignIn"]').or(
      page.locator('text=Sign in, text=Welcome Back')
    );

    this.clerkForm = page.locator('form').or(
      page.locator('[class*="cl-form"]')
    );

    // Form elements
    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    this.passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();

    // Buttons
    this.signInButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Continue")');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset password")');
    this.signUpLink = page.locator('a:has-text("Sign Up"), a:has-text("Create account"), a:has-text("Don\'t have an account")');

    // OAuth buttons
    this.googleButton = page.locator('button:has-text("Google")');
    this.githubButton = page.locator('button:has-text("GitHub")');
    this.samlButton = page.locator('button:has-text("SAML"), button:has-text("Enterprise")');

    // Messages
    this.errorMessage = page.locator('[role="alert"], .error, [class*="error"], [data-error]').or(
      page.locator('text=Invalid, text=Incorrect, text=not found', { exact: false })
    );
    this.successMessage = page.locator('.success, [class*="success"], [data-success]');

    // Password visibility
    this.passwordVisibilityToggle = this.passwordInput.locator('xpath=following-sibling::button').or(
      page.locator('[class*="eye"], [class*="visibility"]')
    );

    // Remember me
    this.rememberMeCheckbox = page.locator('input[type="checkbox"][name*="remember"], input[type="checkbox"][name*="session"]').first();
  }

  /**
   * Navigate to the sign-in page
   */
  async goto(): Promise<void> {
    await this.page.goto('/sign-in', { waitUntil: 'networkidle' });
  }

  /**
   * Wait for the sign-in form to be visible
   */
  async waitForForm(): Promise<void> {
    await this.signInContainer.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Fill in the email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill in the password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Fill in both email and password
   */
  async fillCredentials(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
  }

  /**
   * Submit the sign-in form
   */
  async submit(): Promise<void> {
    await this.signInButton.click();
  }

  /**
   * Complete the full sign-in flow
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.fillCredentials(email, password);
    await this.submit();
  }

  /**
   * Sign in with valid credentials and wait for redirect
   */
  async signInAndWaitForRedirect(email: string, password: string): Promise<string> {
    await this.fillCredentials(email, password);
    await this.signInButton.click();

    // Wait for navigation (redirect to dashboard or home)
    await this.page.waitForURL(/\/dashboard|\/|\/getting-started/, { timeout: 15000 });
    return this.page.url();
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.passwordVisibilityToggle.click();
  }

  /**
   * Check if password is visible
   */
  async isPasswordVisible(): Promise<boolean> {
    const inputType = await this.passwordInput.getAttribute('type');
    return inputType === 'text';
  }

  /**
   * Toggle remember me
   */
  async setRememberMe(remember: boolean): Promise<void> {
    const isChecked = await this.rememberMeCheckbox.isChecked();
    if (isChecked !== remember) {
      await this.rememberMeCheckbox.click();
    }
  }

  /**
   * Click the forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  /**
   * Click the sign-up link to go to registration
   */
  async goToSignUp(): Promise<void> {
    await this.signUpLink.click();
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<void> {
    await this.googleButton.click();
  }

  /**
   * Sign in with GitHub
   */
  async signInWithGithub(): Promise<void> {
    await this.githubButton.click();
  }

  /**
   * Sign in with SAML
   */
  async signInWithSaml(): Promise<void> {
    await this.samlButton.click();
  }

  /**
   * Check if there's an error message
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible().catch(() => false);
  }

  /**
   * Get the error message text
   */
  async getErrorMessage(): Promise<string> {
    if (await this.hasError()) {
      return await this.errorMessage.allTextContents().then(texts => texts.join(' '));
    }
    return '';
  }

  /**
   * Check if signed in (redirected from sign-in page)
   */
  async isSignedIn(): Promise<boolean> {
    const currentUrl = this.page.url();
    return !currentUrl.includes('/sign-in') && !currentUrl.includes('/sign-up');
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(options?: { name: string }): Promise<void> {
    const name = options?.name || 'sign-in-page';
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }
}
