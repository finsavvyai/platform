import { type Page, type Locator, expect } from '@playwright/test';
import { URLS } from '../fixtures/urls';

/**
 * Page Object Model for the LunaOS Studio IDE (studio.lunaos.ai).
 */
export class StudioPage {
  readonly page: Page;
  readonly canvas: Locator;
  readonly toolbar: Locator;
  readonly nodePanel: Locator;
  readonly propertiesPanel: Locator;
  readonly runButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator(
      '.react-flow, [data-testid="workflow-canvas"], .studio-canvas'
    ).first();
    this.toolbar = page.locator(
      '.toolbar, [data-testid="toolbar"], [role="toolbar"]'
    ).first();
    this.nodePanel = page.locator(
      '.node-panel, [data-testid="node-panel"], .component-palette'
    ).first();
    this.propertiesPanel = page.locator(
      '.properties-panel, [data-testid="properties"]'
    ).first();
    this.runButton = page.locator(
      '[data-testid="run-workflow"], button:has-text("Run")'
    ).first();
    this.saveButton = page.locator(
      '[data-testid="save-workflow"], button:has-text("Save")'
    ).first();
  }

  async goto(): Promise<void> {
    await this.page.goto(URLS.studio.base);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoEditor(): Promise<void> {
    await this.page.goto(
      `${URLS.studio.base}${URLS.studio.editor}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoWorkflows(): Promise<void> {
    await this.page.goto(
      `${URLS.studio.base}${URLS.studio.workflows}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoTemplates(): Promise<void> {
    await this.page.goto(
      `${URLS.studio.base}${URLS.studio.templates}`
    );
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectCanvasVisible(): Promise<void> {
    await expect(this.canvas).toBeVisible({ timeout: 10_000 });
  }

  async expectToolbarVisible(): Promise<void> {
    await expect(this.toolbar).toBeVisible();
  }
}
