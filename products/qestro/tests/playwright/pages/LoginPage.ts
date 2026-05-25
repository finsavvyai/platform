/**
 * Login Page Object Model
 * Handles login page interactions and validations
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // Selectors
  private readonly emailInput = '[data-testid=email]';
  private readonly passwordInput = '[data-testid=password]';
  private readonly loginButton = '[data-testid=login-button]';
  private readonly errorMessage = '[data-testid=error-message]';
  private readonly forgotPasswordLink = '[data-testid=forgot-password]';
  private readonly signupLink = '[data-testid=signup-link]';
  private readonly loadingSpinner = '[data-testid=loading-spinner]';

  constructor(page: Page) {
    super(page, '/login');
  }

  // Actions
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLoginButton();
  }

  async fillEmail(email: string): Promise<void> {
    await this.fillInput(this.emailInput, email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.fillInput(this.passwordInput, password);
  }

  async clickLoginButton(): Promise<void> {
    await this.clickElement(this.loginButton);
  }

  async clickForgotPassword(): Promise<void> {
    await this.clickElement(this.forgotPasswordLink);
  }

  async clickSignupLink(): Promise<void> {
    await this.clickElement(this.signupLink);
  }

  // Validations
  async expectLoginFormToBeVisible(): Promise<void> {
    await this.expectElementToBeVisible(this.emailInput);
    await this.expectElementToBeVisible(this.passwordInput);
    await this.expectElementToBeVisible(this.loginButton);
  }

  async expectErrorMessage(message: string): Promise<void> {
    await this.expectElementToBeVisible(this.errorMessage);
    await this.expectElementToContainText(this.errorMessage, message);
  }

  async expectLoadingState(): Promise<void> {
    await this.expectElementToBeVisible(this.loadingSpinner);
  }

  async expectLoginSuccess(): Promise<void> {
    await this.waitForUrl('**/dashboard');
  }

  // Getters
  async getErrorMessage(): Promise<string> {
    return await this.getElementText(this.errorMessage);
  }

  async isLoginButtonEnabled(): Promise<boolean> {
    return await this.isElementEnabled(this.loginButton);
  }

  // Helper methods
  async loginWithValidCredentials(): Promise<void> {
    await this.login('test@example.com', 'password123');
  }

  async loginWithInvalidCredentials(): Promise<void> {
    await this.login('invalid@example.com', 'wrongpassword');
  }

  async clearLoginForm(): Promise<void> {
    await this.clearInput(this.emailInput);
    await this.clearInput(this.passwordInput);
  }
}