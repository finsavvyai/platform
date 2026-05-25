import { Page, Locator, expect } from '@playwright/test';

/**
 * Dashboard Page Object Model
 * Encapsulates all interactions with the SDLC.ai dashboard
 */
export class DashboardPage {
  readonly page: Page;

  // Page containers
  readonly dashboardContainer: Locator;
  readonly welcomeSection: Locator;

  // Header elements
  readonly header: Locator;
  readonly userButton: Locator;
  readonly signOutButton: Locator;

  // API Keys section
  readonly apiKeysSection: Locator;
  readonly generateKeyButton: Locator;
  readonly apiKeyList: Locator;
  readonly noApiKeysMessage: Locator;

  // Individual API key elements
  readonly apiKeyCard: Locator;
  readonly copyKeyButton: Locator;
  readonly deleteKeyButton: Locator;

  // Usage section
  readonly usageSection: Locator;
  readonly usageStats: Locator;

  // Quick start section
  readonly quickStartSection: Locator;
  readonly documentationLink: Locator;

  // Navigation
  readonly navLinks: Locator;
  readonly dashboardLink: Locator;
  readonly settingsLink: Locator;

  // Loading states
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main containers
    this.dashboardContainer = page.locator('[class*="dashboard"], [data-testid="dashboard"]');
    this.welcomeSection = page.locator('h2:has-text("Welcome"), h1:has-text("Dashboard")');

    // Header
    this.header = page.locator('header');
    this.userButton = page.locator('[class*="user"], [class*="avatar"]');
    this.signOutButton = page.locator('button:has-text("Sign out"), button:has-text("Log out")');

    // API Keys
    this.apiKeysSection = page.locator('section:has-text("API Key"), [id*="api-key"], [data-testid*="api-key"]');
    this.generateKeyButton = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("New Key")');
    this.apiKeyList = page.locator('[class*="api-key-list"], [data-testid*="key-list"]');
    this.noApiKeysMessage = page.locator('text="No API keys", text="Create your first key"');

    // Individual key elements
    this.apiKeyCard = page.locator('[class*="api-key-card"], [data-testid*="key-card"]');
    this.copyKeyButton = this.apiKeyCard.locator('button:has-text("Copy"), [aria-label*="copy"]');
    this.deleteKeyButton = this.apiKeyCard.locator('button:has-text("Delete"), [aria-label*="delete"]');

    // Usage
    this.usageSection = page.locator('section:has-text("Usage"), [id*="usage"]');
    this.usageStats = page.locator('[class*="usage-stat"], [data-testid*="stat"]');

    // Quick start
    this.quickStartSection = page.locator('section:has-text("Quick Start"), section:has-text("Get Started")');
    this.documentationLink = page.locator('a:has-text("documentation"), a:has-text("docs"), a:has-text("Getting Started")');

    // Navigation
    this.navLinks = page.locator('nav a');
    this.dashboardLink = page.locator('a[href*="dashboard"]');
    this.settingsLink = page.locator('a[href*="settings"]');

    // Loading
    this.loadingSpinner = page.locator('[class*="loading"], [class*="spinner"]');
  }

  /**
   * Navigate to the dashboard
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard', { waitUntil: 'networkidle' });
  }

  /**
   * Wait for the dashboard to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.welcomeSection.waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Get the welcome message text
   */
  async getWelcomeMessage(): Promise<string> {
    return await this.welcomeSection.textContent() || '';
  }

  /**
   * Check if user is authenticated and on dashboard
   */
  async isAccessible(): Promise<boolean> {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');

    // If redirected to sign-in, not authenticated
    if (this.page.url().includes('/sign-in')) {
      return false;
    }

    // Check for dashboard elements
    return await this.welcomeSection.isVisible().catch(() => false);
  }

  /**
   * Generate a new API key
   */
  async generateApiKey(): Promise<void> {
    await this.generateKeyButton.click();
    await this.page.waitForTimeout(1000); // Wait for API response
  }

  /**
   * Get the number of API keys
   */
  async getApiKeyCount(): Promise<number> {
    return await this.apiKeyCard.count();
  }

  /**
   * Get all API key information
   */
  async getApiKeys(): Promise<Array<{ id: string; key: string; createdAt: string }>> {
    const keys: Array<{ id: string; key: string; createdAt: string }> = [];
    const count = await this.apiKeyCard.count();

    for (let i = 0; i < count; i++) {
      const card = this.apiKeyCard.nth(i);
      const keyText = await card.locator('code, [class*="key"]').textContent() || '';
      const createdText = await card.locator('[class*="created"], [class*="date"]').textContent() || '';

      keys.push({
        id: `key-${i}`,
        key: keyText.trim(),
        createdAt: createdText.trim(),
      });
    }

    return keys;
  }

  /**
   * Copy the first API key to clipboard
   */
  async copyFirstApiKey(): Promise<void> {
    const copyButton = this.copyKeyButton.first();
    await copyButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Delete the first API key
   */
  async deleteFirstApiKey(): Promise<void> {
    const deleteButton = this.deleteKeyButton.first();

    // Handle confirmation dialog if present
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });

    await deleteButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if there are any API keys
   */
  async hasApiKeys(): Promise<boolean> {
    const count = await this.getApiKeyCount();
    return count > 0;
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<Map<string, string>> {
    const stats = new Map<string, string>();
    const statElements = this.usageStats.all();

    for (const element of await statElements) {
      const label = await element.locator('[class*="label"], [class*="name"]').textContent();
      const value = await element.locator('[class*="value"], [class*="amount"]').textContent();

      if (label && value) {
        stats.set(label.trim(), value.trim());
      }
    }

    return stats;
  }

  /**
   * Click the user button to open account menu
   */
  async openUserMenu(): Promise<void> {
    await this.userButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Sign out from the dashboard
   */
  async signOut(): Promise<void> {
    await this.openUserMenu();
    await this.signOutButton.click();

    // Wait for redirect
    await this.page.waitForURL(/\/|\/sign-in/, { timeout: 10000 });
  }

  /**
   * Navigate to settings
   */
  async goToSettings(): Promise<void> {
    await this.settingsLink.click();
  }

  /**
   * Navigate to documentation
   */
  async goToDocumentation(): Promise<void> {
    await this.documentationLink.first().click();
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(options?: { name: string }): Promise<void> {
    const name = options?.name || 'dashboard';
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Check if the dashboard is loading
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible().catch(() => false);
  }

  /**
   * Get the current URL path
   */
  async getCurrentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }
}
