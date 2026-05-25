/**
 * Dashboard Page Object Model
 * Encapsulates dashboard page interactions
 */

import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, waitForNetworkIdle } from '../utils/test-helpers';

export class DashboardPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly createProjectButton: Locator;
  readonly projectCards: Locator;
  readonly recentTestsSection: Locator;
  readonly analyticsSection: Locator;
  readonly userMenu: Locator;
  readonly notificationBell: Locator;
  readonly searchBox: Locator;
  readonly sidebar: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2, h1').first();
    this.createProjectButton = page.locator('button:has-text("Create Project"), button:has-text("New Project")');
    this.projectCards = page.locator('[data-testid="project-card"], .project-card');
    this.recentTestsSection = page.locator('[data-testid="recent-tests"], .recent-tests');
    this.analyticsSection = page.locator('[data-testid="analytics"], .analytics');
    this.userMenu = page.locator('[data-testid="user-menu"], .user-menu, button[aria-label="User menu"]');
    this.notificationBell = page.locator('[data-testid="notifications"], button[aria-label="Notifications"]');
    this.searchBox = page.locator('input[type="search"], input[placeholder*="Search"]');
    this.sidebar = page.locator('a[href="/cases"]:visible').first();
    this.logoutButton = page.getByRole('button', { name: 'Logout' }).first();
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await this.page.goto('/');
    await waitForNetworkIdle(this.page);
  }

  /**
   * Verify user is on dashboard (route is / not /dashboard)
   */
  async isOnDashboard(): Promise<boolean> {
    const url = this.page.url();
    const path = new URL(url).pathname;
    return path === '/' || path.includes('/dashboard');
  }

  /**
   * Wait for dashboard to load
   */
  async waitForDashboardToLoad() {
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await waitForNetworkIdle(this.page);
  }

  /**
   * Click create project button
   */
  async clickCreateProject() {
    await this.createProjectButton.click();
  }

  /**
   * Get number of projects displayed
   */
  async getProjectCount(): Promise<number> {
    try {
      await this.projectCards.first().waitFor({ state: 'visible', timeout: 5000 });
      return await this.projectCards.count();
    } catch {
      return 0;
    }
  }

  /**
   * Click on a project by index
   */
  async clickProject(index: number) {
    await this.projectCards.nth(index).click();
  }

  /**
   * Click on a project by name
   */
  async clickProjectByName(name: string) {
    await this.page.locator(`[data-testid="project-card"]:has-text("${name}")`).click();
  }

  /**
   * Search for content
   */
  async search(query: string) {
    await this.searchBox.fill(query);
    await this.searchBox.press('Enter');
  }

  /**
   * Open user menu
   */
  async openUserMenu() {
    await this.userMenu.click();
  }

  /**
   * Logout from application
   */
  async logout() {
    // Logout button is in the sidebar, not behind a menu
    await this.logoutButton.click();
    await this.page.waitForURL(/\/login/, { timeout: 10000 });
  }

  /**
   * Navigate to page via sidebar
   */
  async navigateToPage(pageName: string) {
    const link = this.page.getByRole('link', { name: pageName }).first();
    await link.click();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Check if user has projects
   */
  async hasProjects(): Promise<boolean> {
    return (await this.getProjectCount()) > 0;
  }

  /**
   * Get dashboard statistics
   */
  async getStatistics(): Promise<{ totalProjects?: number; totalTests?: number }> {
    const stats: { totalProjects?: number; totalTests?: number } = {};

    try {
      const projectCount = await this.getProjectCount();
      stats.totalProjects = projectCount;
    } catch {
      // Stats not available
    }

    return stats;
  }

  /**
   * Verify dashboard elements are visible
   */
  async verifyDashboardElements() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.sidebar).toBeVisible();
    await expect(this.userMenu).toBeVisible();
  }
}
