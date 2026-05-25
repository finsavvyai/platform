/**
 * Dashboard Page Object Model
 * Handles dashboard page interactions and validations
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  // Selectors
  private readonly welcomeMessage = '[data-testid=welcome-message]';
  private readonly userMenu = '[data-testid=user-menu]';
  private readonly logoutButton = '[data-testid=logout-button]';
  private readonly createTestButton = '[data-testid=create-test]';
  private readonly testList = '[data-testid=test-list]';
  private readonly testItem = '[data-testid=test-item]';
  private readonly searchInput = '[data-testid=search-input]';
  private readonly filterDropdown = '[data-testid=filter-dropdown]';
  private readonly navigationMenu = '[data-testid=navigation-menu]';
  private readonly recordingButton = '[data-testid=start-recording]';
  private readonly settingsLink = '[data-testid=settings-link]';

  constructor(page: Page) {
    super(page, '/dashboard');
  }

  // Actions
  async createNewTest(): Promise<void> {
    await this.clickElement(this.createTestButton);
  }

  async startRecording(): Promise<void> {
    await this.clickElement(this.recordingButton);
  }

  async searchTests(query: string): Promise<void> {
    await this.fillInput(this.searchInput, query);
  }

  async filterTests(filterValue: string): Promise<void> {
    await this.selectOption(this.filterDropdown, filterValue);
  }

  async openUserMenu(): Promise<void> {
    await this.clickElement(this.userMenu);
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.clickElement(this.logoutButton);
  }

  async navigateToSettings(): Promise<void> {
    await this.clickElement(this.settingsLink);
  }

  async selectTest(testName: string): Promise<void> {
    const testSelector = `${this.testItem}:has-text("${testName}")`;
    await this.clickElement(testSelector);
  }

  // Validations
  async expectDashboardToBeLoaded(): Promise<void> {
    await this.expectElementToBeVisible(this.welcomeMessage);
    await this.expectElementToBeVisible(this.createTestButton);
    await this.expectElementToBeVisible(this.navigationMenu);
  }

  async expectWelcomeMessage(userName: string): Promise<void> {
    await this.expectElementToContainText(this.welcomeMessage, `Welcome, ${userName}`);
  }

  async expectTestListToBeVisible(): Promise<void> {
    await this.expectElementToBeVisible(this.testList);
  }

  async expectTestToExist(testName: string): Promise<void> {
    const testSelector = `${this.testItem}:has-text("${testName}")`;
    await this.expectElementToBeVisible(testSelector);
  }

  async expectNoTestsMessage(): Promise<void> {
    await this.expectElementToContainText(this.testList, 'No tests found');
  }

  // Getters
  async getTestCount(): Promise<number> {
    const testItems = await this.page.locator(this.testItem).count();
    return testItems;
  }

  async getTestNames(): Promise<string[]> {
    const testElements = await this.page.locator(this.testItem).all();
    const names: string[] = [];
    
    for (const element of testElements) {
      const name = await element.textContent();
      if (name) names.push(name.trim());
    }
    
    return names;
  }

  async getWelcomeMessage(): Promise<string> {
    return await this.getElementText(this.welcomeMessage);
  }

  // Helper methods
  async waitForTestsToLoad(): Promise<void> {
    await this.waitForElement(this.testList);
    await this.page.waitForTimeout(1000); // Wait for dynamic content
  }

  async isRecordingButtonEnabled(): Promise<boolean> {
    return await this.isElementEnabled(this.recordingButton);
  }

  async hasTests(): Promise<boolean> {
    const testCount = await this.getTestCount();
    return testCount > 0;
  }
}