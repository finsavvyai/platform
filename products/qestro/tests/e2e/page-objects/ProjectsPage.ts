/**
 * Projects Page Object Model
 * Encapsulates projects page interactions
 */

import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, waitForNetworkIdle } from '../utils/test-helpers';

export class ProjectsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly createProjectButton: Locator;
  readonly projectCards: Locator;
  readonly projectNameInput: Locator;
  readonly projectDescriptionInput: Locator;
  readonly projectTypeDropdown: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly searchBox: Locator;
  readonly filterDropdown: Locator;
  readonly sortDropdown: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1:has-text("Projects"), h2:has-text("Projects")');
    this.createProjectButton = page.locator(
      'button:has-text("Create Project"), button:has-text("New Project"), [data-testid="create-project"]'
    );
    this.projectCards = page.locator('[data-testid="project-card"], .project-card, [class*="project-card"]');
    this.projectNameInput = page.locator('input[name="name"], input[name="projectName"], #project-name');
    this.projectDescriptionInput = page.locator(
      'textarea[name="description"], textarea[name="projectDescription"], #project-description'
    );
    this.projectTypeDropdown = page.locator('select[name="type"], select[name="projectType"], #project-type');
    this.submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
    this.cancelButton = page.locator('button:has-text("Cancel"), button[data-action="cancel"]');
    this.searchBox = page.locator('input[type="search"], input[placeholder*="Search"]');
    this.filterDropdown = page.locator('select:has([value*="filter"]), [data-testid="filter"]');
    this.sortDropdown = page.locator('select:has([value*="sort"]), [data-testid="sort"]');
    this.emptyState = page.locator('[data-testid="empty-state"], .empty-state');
    this.loadingSpinner = page.locator('[data-testid="loading"], .loading-spinner, [role="progressbar"]');
  }

  /**
   * Navigate to projects page
   */
  async goto() {
    await this.page.goto('/projects');
    await waitForNetworkIdle(this.page);
  }

  /**
   * Verify user is on projects page
   */
  async isOnProjectsPage(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('/projects');
  }

  /**
   * Wait for projects page to load
   */
  async waitForPageLoad() {
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await this.waitForLoadingToComplete();
  }

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoadingToComplete() {
    try {
      const isLoading = await this.loadingSpinner.isVisible().catch(() => false);
      if (isLoading) {
        await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
      }
    } catch {
      // Loading already complete
    }
    await waitForNetworkIdle(this.page);
  }

  /**
   * Click create project button
   */
  async clickCreateProject() {
    await this.createProjectButton.click();
    await this.page.waitForTimeout(500); // Wait for modal/form to appear
  }

  /**
   * Fill project name
   */
  async fillProjectName(name: string) {
    await this.projectNameInput.waitFor({ state: 'visible' });
    await this.projectNameInput.fill(name);
    await expect(this.projectNameInput).toHaveValue(name);
  }

  /**
   * Fill project description
   */
  async fillProjectDescription(description: string) {
    await this.projectDescriptionInput.waitFor({ state: 'visible' });
    await this.projectDescriptionInput.fill(description);
    await expect(this.projectDescriptionInput).toHaveValue(description);
  }

  /**
   * Select project type
   */
  async selectProjectType(type: 'mobile' | 'web' | 'api' | 'database') {
    await this.projectTypeDropdown.waitFor({ state: 'visible' });
    await this.projectTypeDropdown.selectOption(type);
  }

  /**
   * Submit project creation form
   */
  async submitProjectForm() {
    await this.submitButton.click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Cancel project creation
   */
  async cancelProjectCreation() {
    await this.cancelButton.click();
  }

  /**
   * Create a new project (complete flow)
   */
  async createProject(data: {
    name: string;
    description?: string;
    type?: 'mobile' | 'web' | 'api' | 'database';
  }) {
    await this.clickCreateProject();
    await this.fillProjectName(data.name);

    if (data.description) {
      await this.fillProjectDescription(data.description);
    }

    if (data.type) {
      await this.selectProjectType(data.type);
    }

    await this.submitProjectForm();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get number of projects
   */
  async getProjectCount(): Promise<number> {
    await this.waitForPageLoad();
    try {
      await this.projectCards.first().waitFor({ state: 'visible', timeout: 5000 });
      return await this.projectCards.count();
    } catch {
      return 0;
    }
  }

  /**
   * Check if empty state is shown
   */
  async hasEmptyState(): Promise<boolean> {
    try {
      await this.emptyState.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Search for projects
   */
  async search(query: string) {
    await this.searchBox.fill(query);
    await this.searchBox.press('Enter');
    await this.waitForLoadingToComplete();
  }

  /**
   * Click on a project by index
   */
  async clickProject(index: number) {
    await this.projectCards.nth(index).click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Click on a project by name
   */
  async clickProjectByName(name: string) {
    const projectCard = this.page.locator(`[data-testid="project-card"]:has-text("${name}")`);
    await projectCard.click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Get project names
   */
  async getProjectNames(): Promise<string[]> {
    await this.waitForPageLoad();
    const count = await this.getProjectCount();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await this.projectCards.nth(i).textContent();
      if (text) {
        names.push(text);
      }
    }

    return names;
  }

  /**
   * Verify project exists by name
   */
  async projectExists(name: string): Promise<boolean> {
    const names = await this.getProjectNames();
    return names.some((n) => n.includes(name));
  }

  /**
   * Delete project by index (if delete button is on card)
   */
  async deleteProject(index: number) {
    const projectCard = this.projectCards.nth(index);
    const deleteButton = projectCard.locator('button:has-text("Delete"), [data-action="delete"]');

    await deleteButton.click();

    // Handle confirmation dialog if present
    const confirmButton = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
    }

    await this.waitForLoadingToComplete();
  }

  /**
   * Filter projects
   */
  async filterBy(filter: string) {
    await this.filterDropdown.selectOption(filter);
    await this.waitForLoadingToComplete();
  }

  /**
   * Sort projects
   */
  async sortBy(sort: string) {
    await this.sortDropdown.selectOption(sort);
    await this.waitForLoadingToComplete();
  }
}
