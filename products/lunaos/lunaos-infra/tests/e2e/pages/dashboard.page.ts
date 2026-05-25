import { type Page, type Locator, expect } from '@playwright/test';
import { URLS } from '../fixtures/urls';

/**
 * Page Object Model for the LunaOS Dashboard (agents.lunaos.ai).
 */
export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly mainContent: Locator;
  readonly agentList: Locator;
  readonly createAgentButton: Locator;
  readonly userMenu: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator(
      'nav[role="navigation"], aside, .sidebar, [data-testid="sidebar"]'
    ).first();
    this.mainContent = page.locator(
      'main, [role="main"], .main-content'
    ).first();
    this.agentList = page.locator(
      '.agent-list, [data-testid="agent-list"]'
    ).first();
    this.createAgentButton = page.locator(
      '[data-testid="create-agent"], button:has-text("Create"), button:has-text("New Agent")'
    ).first();
    this.userMenu = page.locator(
      '[data-testid="user-menu"], .user-menu, .avatar'
    ).first();
    this.searchInput = page.locator(
      '[data-testid="search"], input[type="search"], input[placeholder*="Search"]'
    ).first();
  }

  async goto(): Promise<void> {
    await this.page.goto(URLS.dashboard.base);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoAgents(): Promise<void> {
    await this.page.goto(
      `${URLS.dashboard.base}${URLS.dashboard.agents}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoSettings(): Promise<void> {
    await this.page.goto(
      `${URLS.dashboard.base}${URLS.dashboard.settings}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoAPIKeys(): Promise<void> {
    await this.page.goto(
      `${URLS.dashboard.base}${URLS.dashboard.apiKeys}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoBilling(): Promise<void> {
    await this.page.goto(
      `${URLS.dashboard.base}${URLS.dashboard.billing}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoAnalytics(): Promise<void> {
    await this.page.goto(
      `${URLS.dashboard.base}${URLS.dashboard.analytics}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectDashboardLoaded(): Promise<void> {
    await expect(this.mainContent).toBeVisible();
  }

  async expectSidebarVisible(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
  }

  async clickCreateAgent(): Promise<void> {
    await this.createAgentButton.click();
  }

  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
  }
}
