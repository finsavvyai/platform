import { type Page, type Locator, expect } from '@playwright/test';
import { URLS } from '../fixtures/urls';

/**
 * Page Object Model for the LunaOS Marketing site (lunaos.ai).
 */
export class MarketingPage {
  readonly page: Page;
  readonly heroTitle: Locator;
  readonly ctaButton: Locator;
  readonly nav: Locator;
  readonly pricingSection: Locator;
  readonly footer: Locator;
  readonly agentCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroTitle = page.locator('h1').first();
    this.ctaButton = page.locator(
      'a[href*="agents.lunaos.ai"], a[href*="signup"], .cta-button, [data-testid="cta"]'
    ).first();
    this.nav = page.locator('nav, header, .navbar').first();
    this.pricingSection = page.locator(
      '#pricing, [data-section="pricing"], .pricing-section'
    ).first();
    this.footer = page.locator('footer').first();
    this.agentCards = page.locator(
      '.agent-card, [class*="agent-card"], [data-testid="agent-card"]'
    );
  }

  async goto(): Promise<void> {
    await this.page.goto(URLS.marketing.base);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoPricing(): Promise<void> {
    await this.page.goto(`${URLS.marketing.base}${URLS.marketing.pricing}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoDemo(): Promise<void> {
    await this.page.goto(`${URLS.marketing.base}${URLS.marketing.demo}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoInvestors(): Promise<void> {
    await this.page.goto(`${URLS.marketing.base}${URLS.marketing.investors}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectHeroVisible(): Promise<void> {
    await expect(this.heroTitle).toBeVisible();
  }

  async expectNavVisible(): Promise<void> {
    await expect(this.nav).toBeVisible();
  }

  async clickCTA(): Promise<void> {
    await this.ctaButton.click();
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async hasMetaDescription(): Promise<boolean> {
    const meta = this.page.locator('meta[name="description"]');
    const content = await meta.getAttribute('content');
    return content !== null && content.length > 0;
  }

  async hasOpenGraphTags(): Promise<boolean> {
    const ogTitle = this.page.locator('meta[property="og:title"]');
    return (await ogTitle.count()) > 0;
  }
}
