/**
 * Login Page Object Model
 * Encapsulates login page interactions
 */

import { Page, Locator, expect } from '@playwright/test';
import { TestUser } from '../fixtures/test-users';
import { waitForNetworkIdle } from '../utils/test-helpers';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signupLink: Locator;
  readonly githubButton: Locator;
  readonly googleButton: Locator;
  readonly azureButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email-address, input[name="email"]');
    this.passwordInput = page.locator('#password, input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[role="alert"], .text-red-300, .error-message');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot password")');
    this.signupLink = page.locator('a:has-text("free trial"), a:has-text("Sign up")');
    this.githubButton = page.locator('button:has-text("GitHub")');
    this.googleButton = page.locator('button:has-text("Google")');
    this.azureButton = page.locator('button:has-text("Microsoft")');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(/\/login/, { timeout: 10000 });
    await this.emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.loginButton.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string) {
    await this.emailInput.waitFor({ state: 'visible' });
    await this.emailInput.fill(email);
    await expect(this.emailInput).toHaveValue(email);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string) {
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.fill(password);
    await expect(this.passwordInput).toHaveValue(password);
  }

  /**
   * Click login button
   */
  async clickLogin() {
    await this.loginButton.click();
  }

  /**
   * Complete login flow
   */
  async login(user: TestUser) {
    await this.fillEmail(user.email);
    await this.fillPassword(user.password);
    await this.clickLogin();

    // Wait for navigation or error
    await Promise.race([
      this.page.waitForURL(/^\/$|\/dashboard|\/projects/, { timeout: 30000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    ]);
  }

  /**
   * Login with email and password
   */
  async loginWith(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  /**
   * Check if error message is visible
   */
  async hasError(): Promise<boolean> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    await this.errorMessage.waitFor({ state: 'visible' });
    return (await this.errorMessage.textContent()) || '';
  }

  /**
   * Click GitHub OAuth button
   */
  async loginWithGitHub() {
    await this.githubButton.click();
  }

  /**
   * Click Google OAuth button
   */
  async loginWithGoogle() {
    await this.googleButton.click();
  }

  /**
   * Click Azure OAuth button
   */
  async loginWithAzure() {
    await this.azureButton.click();
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  /**
   * Click sign up link
   */
  async clickSignUp() {
    await this.signupLink.click();
  }

  /**
   * Verify user is on login page
   */
  async isOnLoginPage(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('/login') || url.includes('/auth/login');
  }

  /**
   * Wait for login to complete successfully
   */
  async waitForSuccessfulLogin() {
    await this.page.waitForURL(/^\/$|\/dashboard|\/projects/, { timeout: 30000 });
    await this.page.locator('h1, h2').first().waitFor({ state: 'visible', timeout: 10000 });
  }
}
