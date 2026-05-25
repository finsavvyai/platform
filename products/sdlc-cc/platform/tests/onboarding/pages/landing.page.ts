import { Page, Locator, expect } from '@playwright/test';

/**
 * Landing Page Object Model
 * Encapsulates all interactions with the SDLC.ai landing page
 */
export class LandingPage {
  readonly page: Page;

  // Navigation elements
  readonly navBar: Locator;
  readonly logo: Locator;
  readonly logoLink: Locator;
  readonly mobileMenuButton: Locator;
  readonly mobileMenu: Locator;

  // Navigation links
  readonly featuresLink: Locator;
  readonly securityLink: Locator;
  readonly pricingLink: Locator;
  readonly demoLink: Locator;
  readonly signInButton: Locator;
  readonly getStartedButton: Locator;

  // Hero section elements
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;

  // Features section
  readonly featuresSection: Locator;
  readonly featureCards: Locator;

  // Demo form
  readonly demoForm: Locator;
  readonly demoNameInput: Locator;
  readonly demoEmailInput: Locator;
  readonly demoCompanyInput: Locator;
  readonly demoMessageInput: Locator;
  readonly demoSubmitButton: Locator;

  // Pricing section
  readonly pricingSection: Locator;
  readonly pricingCards: Locator;

  // Footer elements
  readonly footer: Locator;
  readonly footerLinks: Locator;

  // Status indicators
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize navigation elements
    this.navBar = page.locator('header').first();
    this.logo = page.locator('text=SDLC.ai').or(page.locator('[class*="logo"]'));
    this.logoLink = page.locator('a').filter({ hasText: 'SDLC.ai' });
    this.mobileMenuButton = page.locator('button:has-text("Menu")').or(
      page.locator('[aria-label*="menu"]', { hasText: /menu/i }
    ));
    this.mobileMenu = page.locator('[class*="mobile-menu"]').or(
      page.locator('[role="navigation"] >> visible=true')
    );

    // Navigation links
    this.featuresLink = page.locator('a', { hasText: 'Features' }).or(
      page.locator('a[href*="#features"]')
    );
    this.securityLink = page.locator('a', { hasText: 'Security' }).or(
      page.locator('a[href*="#security"]')
    );
    this.pricingLink = page.locator('a', { hasText: 'Pricing' }).or(
      page.locator('a[href*="#pricing"]')
    );
    this.demoLink = page.locator('a', { hasText: 'Demo' }).or(
      page.locator('a[href*="#demo"]')
    );
    this.signInButton = page.locator('a:has-text("Sign In")').or(
      page.locator('a[href*="sign-in"]')
    );
    this.getStartedButton = page.locator('button:has-text("Get Started")').or(
      page.locator('a:has-text("Get Started")')
    ).or(page.locator('a[href*="sign-up"]'));

    // Hero section
    this.heroSection = page.locator('section').filter({ hasText: /compliant|AI|ChatGPT/ }).first();
    this.heroTitle = page.locator('h1').first();
    this.heroSubtitle = page.locator('p').filter({ hasText: /compliance|PII|security/i }).first();

    // Features section
    this.featuresSection = page.locator('[id="features"], section:has-text("Features")');
    this.featureCards = page.locator('[class*="feature"], [data-feature]');

    // Demo form
    this.demoForm = page.locator('form:has-text("Request"), form:has-text("Demo"), #demo-form');
    this.demoNameInput = this.demoForm.locator('input[name="name"], input[placeholder*="Name"]').first();
    this.demoEmailInput = this.demoForm.locator('input[type="email"], input[name="email"], input[placeholder*="Email"]').first();
    this.demoCompanyInput = this.demoForm.locator('input[name="company"], input[placeholder*="Company"]').first();
    this.demoMessageInput = this.demoForm.locator('textarea[name="message"], textarea[placeholder*="Message"]').first();
    this.demoSubmitButton = this.demoForm.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")');

    // Pricing section
    this.pricingSection = page.locator('[id="pricing"], section:has-text("Pricing")');
    this.pricingCards = page.locator('[class*="pricing"], [data-plan]');

    // Footer
    this.footer = page.locator('footer');
    this.footerLinks = this.footer.locator('a');

    // Status
    this.loadingSpinner = page.locator('[class*="loading"], [class*="spinner"], [role="status"]');
  }

  /**
   * Navigate to the landing page
   */
  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'networkidle' });
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoadState(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.heroTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get the page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Get page metadata
   */
  async getMetadata(): Promise<{
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
  }> {
    const title = await this.page.title();
    const description = await (await this.page.locator('meta[name="description"]').getAttribute('content')) || '';
    const keywords = await (await this.page.locator('meta[name="keywords"]').getAttribute('content')) || '';
    const ogTitle = await (await this.page.locator('meta[property="og:title"]').getAttribute('content')) || '';
    const ogDescription = await (await this.page.locator('meta[property="og:description"]').getAttribute('content')) || '';

    return { title, description, keywords, ogTitle, ogDescription };
  }

  /**
   * Check if the hero section is visible
   */
  async isHeroVisible(): Promise<boolean> {
    try {
      await this.heroTitle.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get hero text content
   */
  async getHeroText(): Promise<{ title: string; subtitle: string }> {
    const title = await this.heroTitle.textContent() || '';
    const subtitle = await this.heroSubtitle.textContent() || '';
    return { title: title.trim(), subtitle: subtitle.trim() };
  }

  /**
   * Click the sign in button
   */
  async clickSignIn(): Promise<void> {
    await this.signInButton.first().click();
  }

  /**
   * Click the get started button
   */
  async clickGetStarted(): Promise<void> {
    await this.getStartedButton.first().click();
  }

  /**
   * Navigate to features section
   */
  async goToFeatures(): Promise<void> {
    await this.featuresLink.first().click();
  }

  /**
   * Navigate to pricing section
   */
  async goToPricing(): Promise<void> {
    await this.pricingLink.first().click();
  }

  /**
   * Navigate to demo section
   */
  async goToDemo(): Promise<void> {
    await this.demoLink.first().click();
  }

  /**
   * Open mobile menu
   */
  async openMobileMenu(): Promise<void> {
    const isOpen = await this.mobileMenu.isVisible().catch(() => false);
    if (!isOpen) {
      await this.mobileMenuButton.click();
    }
  }

  /**
   * Close mobile menu
   */
  async closeMobileMenu(): Promise<void> {
    const isOpen = await this.mobileMenu.isVisible().catch(() => false);
    if (isOpen) {
      const closeButton = this.page.locator('button:has-text("Close"), button:has-text("X")');
      await closeButton.click();
    }
  }

  /**
   * Fill and submit the demo request form
   */
  async submitDemoForm(data: {
    name: string;
    email: string;
    company?: string;
    message?: string;
  }): Promise<void> {
    await this.goToDemo();

    await this.demoNameInput.fill(data.name);
    await this.demoEmailInput.fill(data.email);
    if (data.company !== undefined) {
      await this.demoCompanyInput.fill(data.company);
    }
    if (data.message !== undefined) {
      await this.demoMessageInput.fill(data.message);
    }

    await this.demoSubmitButton.click();
  }

  /**
   * Check if there's a success message after form submission
   */
  async hasSuccessMessage(): Promise<boolean> {
    const successSelector = '.success, .alert-success, [data-success], :text("Thank you")';
    const successElement = this.page.locator(successSelector).first();
    return await successElement.isVisible().catch(() => false);
  }

  /**
   * Get all feature card titles
   */
  async getFeatureTitles(): Promise<string[]> {
    const titles: string[] = [];
    const count = await this.featureCards.count();

    for (let i = 0; i < count; i++) {
      const title = await this.featureCards.nth(i).locator('h2, h3, h4').textContent();
      if (title) titles.push(title.trim());
    }

    return titles;
  }

  /**
   * Get pricing information
   */
  async getPricingPlans(): Promise<Array<{ name: string; price: string; features: string[] }>> {
    const plans: Array<{ name: string; price: string; features: string[] }> = [];
    const count = await this.pricingCards.count();

    for (let i = 0; i < count; i++) {
      const card = this.pricingCards.nth(i);
      const name = await card.locator('h2, h3, [class*="plan-name"]').textContent() || '';
      const price = await card.locator('[class*="price"], :text-is("$")').textContent() || '';

      const features: string[] = [];
      const featureElements = card.locator('li, [class*="feature"]');
      const featureCount = await featureElements.count();

      for (let j = 0; j < Math.min(featureCount, 10); j++) {
        const featureText = await featureElements.nth(j).textContent();
        if (featureText) features.push(featureText.trim());
      }

      plans.push({ name: name.trim(), price: price.trim(), features });
    }

    return plans;
  }

  /**
   * Take a screenshot for visual regression
   */
  async takeScreenshot(options?: { name: string; fullPage?: boolean }): Promise<void> {
    const name = options?.name || 'landing-page';
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: options?.fullPage ?? true,
    });
  }

  /**
   * Check if the page is responsive (no horizontal scroll)
   */
  async isResponsive(): Promise<boolean> {
    const hasHorizontalScroll = await this.page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    return !hasHorizontalScroll;
  }

  /**
   * Scroll to the bottom of the page
   */
  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  /**
   * Scroll to a specific section
   */
  async scrollToSection(sectionId: string): Promise<void> {
    const element = this.page.locator(`[id="${sectionId}"], section:has-text("${sectionId}")`);
    await element.scrollIntoViewIfNeeded();
  }
}
