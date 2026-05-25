/**
 * Project Detail Page Object Model
 * Encapsulates project detail page interactions
 */

import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, waitForNetworkIdle } from '../utils/test-helpers';

export class ProjectDetailPage {
  readonly page: Page;
  readonly projectTitle: Locator;
  readonly projectDescription: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly settingsButton: Locator;
  readonly createTestButton: Locator;
  readonly testsList: Locator;
  readonly testCards: Locator;
  readonly backButton: Locator;
  readonly tabsContainer: Locator;
  readonly testsTab: Locator;
  readonly settingsTab: Locator;
  readonly analyticsTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectTitle = page.locator('h1[data-testid="project-title"], h1.project-title');
    this.projectDescription = page.locator('[data-testid="project-description"], .project-description');
    this.editButton = page.locator('button:has-text("Edit"), [data-action="edit"]');
    this.deleteButton = page.locator('button:has-text("Delete"), [data-action="delete"]');
    this.settingsButton = page.locator('button:has-text("Settings"), [data-action="settings"]');
    this.createTestButton = page.locator('button:has-text("Create Test"), button:has-text("New Test")');
    this.testsList = page.locator('[data-testid="tests-list"], .tests-list');
    this.testCards = page.locator('[data-testid="test-card"], .test-card');
    this.backButton = page.locator('button:has-text("Back"), a:has-text("Back to Projects")');
    this.tabsContainer = page.locator('[role="tablist"], .tabs');
    this.testsTab = page.locator('[role="tab"]:has-text("Tests"), button:has-text("Tests")');
    this.settingsTab = page.locator('[role="tab"]:has-text("Settings"), button:has-text("Settings")');
    this.analyticsTab = page.locator('[role="tab"]:has-text("Analytics"), button:has-text("Analytics")');
  }

  /**
   * Navigate to project detail page
   */
  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}`);
    await waitForNetworkIdle(this.page);
  }

  /**
   * Verify user is on project detail page
   */
  async isOnProjectDetailPage(): Promise<boolean> {
    const url = this.page.url();
    return /\/projects\/[\w-]+/.test(url);
  }

  /**
   * Wait for project detail page to load
   */
  async waitForPageLoad() {
    await this.projectTitle.waitFor({ state: 'visible', timeout: 10000 });
    await waitForNetworkIdle(this.page);
  }

  /**
   * Get project title
   */
  async getProjectTitle(): Promise<string> {
    await this.projectTitle.waitFor({ state: 'visible' });
    return (await this.projectTitle.textContent()) || '';
  }

  /**
   * Get project description
   */
  async getProjectDescription(): Promise<string> {
    try {
      await this.projectDescription.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.projectDescription.textContent()) || '';
    } catch {
      return '';
    }
  }

  /**
   * Click edit button
   */
  async clickEdit() {
    await this.editButton.click();
  }

  /**
   * Click delete button
   */
  async clickDelete() {
    await this.deleteButton.click();

    // Handle confirmation dialog
    const confirmButton = this.page.locator('button:has-text("Confirm"), button:has-text("Delete")');
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await confirmButton.click();

    await waitForNetworkIdle(this.page);
  }

  /**
   * Click settings button
   */
  async clickSettings() {
    await this.settingsButton.click();
  }

  /**
   * Click create test button
   */
  async clickCreateTest() {
    await this.createTestButton.click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Get number of tests
   */
  async getTestCount(): Promise<number> {
    try {
      await this.testCards.first().waitFor({ state: 'visible', timeout: 5000 });
      return await this.testCards.count();
    } catch {
      return 0;
    }
  }

  /**
   * Click on a test by index
   */
  async clickTest(index: number) {
    await this.testCards.nth(index).click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Navigate back to projects list
   */
  async goBack() {
    await this.backButton.click();
    await this.page.waitForURL(/\/projects$/, { timeout: 10000 });
  }

  /**
   * Switch to tests tab
   */
  async switchToTestsTab() {
    await this.testsTab.click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Switch to settings tab
   */
  async switchToSettingsTab() {
    await this.settingsTab.click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Switch to analytics tab
   */
  async switchToAnalyticsTab() {
    await this.analyticsTab.click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Verify project data
   */
  async verifyProjectData(expectedData: { title?: string; description?: string }) {
    if (expectedData.title) {
      const actualTitle = await this.getProjectTitle();
      expect(actualTitle).toContain(expectedData.title);
    }

    if (expectedData.description) {
      const actualDescription = await this.getProjectDescription();
      expect(actualDescription).toContain(expectedData.description);
    }
  }
}
