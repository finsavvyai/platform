import { Page, Locator, expect } from '@playwright/test';

/**
 * Sign Up Page Object Model
 * Encapsulates all interactions with the SDLC.ai sign-up/registration page
 */
export class SignUpPage {
  readonly page: Page;

  // Page containers
  readonly signUpContainer: Locator;
  readonly clerkForm: Locator;

  // Form elements (Clerk-based)
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly usernameInput: Locator;

  // Buttons
  readonly continueButton: Locator;
  readonly submitButton: Locator;
  readonly signInLink: Locator;

  // Alternative sign-up methods
  readonly googleButton: Locator;
  readonly githubButton: Locator;

  // Error/success messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  // Verification elements
  readonly codeInput: Locator;
  readonly resendCodeLink: Locator;

  constructor(page: Page) {
    this.page = page;

    // Clerk uses dynamic classes, so we use robust selectors
    this.signUpContainer = page.locator('[class*="cl-"], .cl-signUp, [class*="SignUp"]').or(
      page.locator('text=Create your account, text=Get Started Free')
    );

    // Form elements - using multiple possible selectors
    this.clerkForm = page.locator('form').or(
      page.locator('[class*="cl-form"]')
    );

    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    this.passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();
    this.firstNameInput = page.locator('input[name="firstName"], input[name="first_name"], input[placeholder*="first" i]').first();
    this.lastNameInput = page.locator('input[name="lastName"], input[name="last_name"], input[placeholder*="last" i]').first();
    this.usernameInput = page.locator('input[name="username"], input[placeholder*="username" i]').first();

    // Buttons
    this.continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")');
    this.submitButton = page.locator('button[type="submit"], button:has-text("Sign Up"), button:has-text("Create")');
    this.signInLink = page.locator('a:has-text("Sign In"), a:has-text("Already have an account")');

    // OAuth buttons
    this.googleButton = page.locator('button:has-text("Google")');
    this.githubButton = page.locator('button:has-text("GitHub")');

    // Messages
    this.errorMessage = page.locator('[role="alert"], .error, [class*="error"], [data-error]').or(
      page.locator('text=invalid, text=incorrect, text=required', { exact: false })
    );
    this.successMessage = page.locator('.success, [class*="success"], [data-success]');

    // Verification
    this.codeInput = page.locator('input[name="code"], input[placeholder*="code" i]');
    this.resendCodeLink = page.locator('a:has-text("Resend"), button:has-text("Resend")');
  }

  /**
   * Navigate to the sign-up page
   */
  async goto(): Promise<void> {
    await this.page.goto('/sign-up', { waitUntil: 'networkidle' });
  }

  /**
   * Wait for the sign-up form to be visible
   */
  async waitForForm(): Promise<void> {
    await this.signUpContainer.waitFor({ state: 'visible', timeout: 10000 });
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
   * Fill in the name fields
   */
  async fillName(firstName: string, lastName: string): Promise<void> {
    if (await this.firstNameInput.isVisible()) {
      await this.firstNameInput.fill(firstName);
    }
    if (await this.lastNameInput.isVisible()) {
      await this.lastNameInput.fill(lastName);
    }
  }

  /**
   * Fill in the username field
   */
  async fillUsername(username: string): Promise<void> {
    if (await this.usernameInput.isVisible()) {
      await this.usernameInput.fill(username);
    }
  }

  /**
   * Fill in all registration fields
   */
  async fillRegistrationForm(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }): Promise<void> {
    await this.fillEmail(data.email);

    // Clerk multi-step form - click continue after email
    const continueVisible = await this.continueButton.isVisible().catch(() => false);
    if (continueVisible) {
      await this.continueButton.click();
      await this.page.waitForTimeout(500);
    }

    await this.fillPassword(data.password);

    if (data.firstName && data.lastName) {
      await this.fillName(data.firstName, data.lastName);
    }

    if (data.username) {
      await this.fillUsername(data.username);
    }
  }

  /**
   * Submit the registration form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete the full registration flow
   */
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }): Promise<void> {
    await this.fillRegistrationForm(data);
    await this.submit();
  }

  /**
   * Click the sign-in link to go to login
   */
  async goToSignIn(): Promise<void> {
    await this.signInLink.click();
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
      return await this.errorMessage.textContent() || '';
    }
    return '';
  }

  /**
   * Check if the form has validation errors for specific fields
   */
  async getFieldErrors(): Promise<Map<string, string>> {
    const errors = new Map<string, string>();

    // Check for inline validation errors
    const errorElements = this.page.locator('[class*="error"], [data-error]');
    const count = await errorElements.count();

    for (let i = 0; i < count; i++) {
      const element = errorElements.nth(i);
      const text = await element.textContent();
      const input = element.locator('xpath=preceding-sibling::input').first();

      if (text && await input.count() > 0) {
        const name = await input.getAttribute('name');
        if (name) {
          errors.set(name, text.trim());
        }
      }
    }

    return errors;
  }

  /**
   * Sign up with Google
   */
  async signUpWithGoogle(): Promise<void> {
    await this.googleButton.click();
  }

  /**
   * Sign up with GitHub
   */
  async signUpWithGithub(): Promise<void> {
    await this.githubButton.click();
  }

  /**
   * Handle email verification (if applicable)
   */
  async enterVerificationCode(code: string): Promise<void> {
    await this.codeInput.fill(code);
    await this.submit();
  }

  /**
   * Request a new verification code
   */
  async resendVerificationCode(): Promise<void> {
    await this.resendCodeLink.click();
  }

  /**
   * Check if verification is required
   */
  async isVerificationRequired(): Promise<boolean> {
    return await this.codeInput.isVisible().catch(() => false);
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(options?: { name: string }): Promise<void> {
    const name = options?.name || 'sign-up-page';
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }
}
