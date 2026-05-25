import { type Page, type Locator, expect } from '@playwright/test';
import { URLS } from '../fixtures/urls';

/**
 * Page Object Model for the LunaOS Docs site (docs.lunaos.ai).
 */
export class DocsPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly content: Locator;
  readonly searchInput: Locator;
  readonly tocNav: Locator;
  readonly codeBlocks: Locator;
  readonly breadcrumb: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator(
      '.VPSidebar, .sidebar, nav[aria-label="Sidebar"]'
    ).first();
    this.content = page.locator(
      '.VPContent, .vp-doc, main, [role="main"]'
    ).first();
    this.searchInput = page.locator(
      '.VPNavBarSearchButton, [data-testid="search"], button[aria-label*="Search"]'
    ).first();
    this.tocNav = page.locator(
      '.VPDocAsideOutline, .table-of-contents, .toc'
    ).first();
    this.codeBlocks = page.locator(
      'pre code, .vp-code, .code-block'
    );
    this.breadcrumb = page.locator(
      '.breadcrumb, [aria-label="Breadcrumb"]'
    ).first();
  }

  async goto(): Promise<void> {
    await this.page.goto(URLS.docs.base);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoQuickstart(): Promise<void> {
    await this.page.goto(
      `${URLS.docs.base}${URLS.docs.quickstart}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoAPIReference(): Promise<void> {
    await this.page.goto(
      `${URLS.docs.base}${URLS.docs.apiReference}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectContentVisible(): Promise<void> {
    await expect(this.content).toBeVisible();
  }

  async expectSidebarVisible(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
  }

  async getCodeBlockCount(): Promise<number> {
    return this.codeBlocks.count();
  }

  async searchFor(query: string): Promise<void> {
    await this.searchInput.click();
    const searchModal = this.page.locator(
      '.VPLocalSearchBox, [role="dialog"], .search-modal'
    ).first();
    if (await searchModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.page.keyboard.type(query);
    }
  }

  async clickSidebarLink(text: string): Promise<void> {
    await this.sidebar.locator(`a:has-text("${text}")`).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }
}
