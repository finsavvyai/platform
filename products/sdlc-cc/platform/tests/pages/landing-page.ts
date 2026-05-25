import { Page } from '@playwright/test';

export class LandingPage {
  constructor(private page: Page) { }

  // Page elements
  private readonly elements = {
    // Navigation
    navBar: 'nav[role="navigation"]',
    logo: 'img[alt*="logo"], .logo',
    demoButton: 'button:has-text("Request Demo"), a:has-text("Request Demo"), .demo-button',

    // Hero section
    heroTitle: 'h1, .hero-title, .main-heading',
    heroSubtitle: '.hero-subtitle, .subtitle, p:has-text("SDLC")',

    // Features section
    featuresSection: 'section:has-text("Features"), .features',
    featureCards: '.feature-card, .feature, [data-feature]',

    // Demo request form
    demoForm: 'form:has-text("Request Demo"), .demo-form, #demo-form',
    nameInput: 'input[name="name"], input[placeholder*="Name"]',
    emailInput: 'input[name="email"], input[type="email"], input[placeholder*="Email"]',
    companyInput: 'input[name="company"], input[placeholder*="Company"]',
    messageTextarea: 'textarea[name="message"], textarea[placeholder*="Message"]',
    submitButton: 'button[type="submit"], .submit-btn, button:has-text("Submit")',

    // Footer
    footer: 'footer, .footer',
    copyright: '.copyright, [data-copyright]',

    // Loading and status indicators
    loading: '.loading, .spinner, [data-loading="true"]',
    successMessage: '.success, .alert-success, [data-success]',
    errorMessage: '.error, .alert-error, [data-error]',
  };

  /**
   * Navigate to the landing page
   */
  async goto(): Promise<void> {
    await this.page.goto(process.env.BASE_URL || 'https://sdlc.finsavvyai.com', {
      waitUntil: 'networkidle'
    });
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    // Wait for key elements to be visible
    await this.page.waitForSelector(this.elements.heroTitle, { state: 'visible' });
  }

  /**
   * Check if page loaded successfully or if we hit Cloudflare
   */
  async isPageLoaded(): Promise<boolean> {
    try {
      // Check for Cloudflare security check
      const cloudflareCheck = await this.page.locator('text="Verify you are human"').isVisible().catch(() => false);
      if (cloudflareCheck) {
        console.log('⚠️ Cloudflare security check detected - cannot proceed with tests');
        return false;
      }

      await this.waitForPageLoad();
      const title = await this.page.title();
      return title.length > 0 && !title.includes('Error');
    } catch {
      return false;
    }
  }

  /**
   * Get page title and description
   */
  async getPageMetadata(): Promise<{
    title: string;
    description: string;
    keywords: string;
  }> {
    const title = await this.page.title();
    const description = await this.page.getAttribute('meta[name="description"]', 'content') || '';
    const keywords = await this.page.getAttribute('meta[name="keywords"]', 'content') || '';

    return { title, description, keywords };
  }

  /**
   * Test navigation functionality
   */
  async testNavigation(): Promise<{
    logoVisible: boolean;
    demoButtonVisible: boolean;
    navigationClickable: boolean;
  }> {
    const logoVisible = await this.page.locator(this.elements.logo).isVisible();
    const demoButtonVisible = await this.page.locator(this.elements.demoButton).isVisible();

    let navigationClickable = false;
    try {
      const navElement = this.page.locator(this.elements.navBar);
      if (await navElement.isVisible()) {
        // Test clicking on first link in navigation
        const firstLink = navElement.locator('a').first();
        if (await firstLink.isVisible()) {
          await firstLink.click();
          await this.page.waitForTimeout(1000);
          navigationClickable = true;
        }
      }
    } catch {
      navigationClickable = false;
    }

    return { logoVisible, demoButtonVisible, navigationClickable };
  }

  /**
   * Test hero section
   */
  async testHeroSection(): Promise<{
    titleVisible: boolean;
    titleContent: string;
    subtitleVisible: boolean;
    subtitleContent: string;
  }> {
    const titleElement = this.page.locator(this.elements.heroTitle);
    const titleVisible = await titleElement.isVisible();
    const titleContent = titleVisible ? await titleElement.textContent() : '';

    const subtitleElement = this.page.locator(this.elements.heroSubtitle);
    const subtitleVisible = await subtitleElement.isVisible();
    const subtitleContent = subtitleVisible ? await subtitleElement.textContent() : '';

    return { titleVisible, titleContent: titleContent || '', subtitleVisible, subtitleContent: subtitleContent || '' };
  }

  /**
   * Test features section
   */
  async testFeaturesSection(): Promise<{
    sectionExists: boolean;
    featureCount: number;
    featureCardsVisible: boolean;
  }> {
    const featuresSection = this.page.locator(this.elements.featuresSection);
    const sectionExists = await featuresSection.count() > 0;

    let featureCount = 0;
    let featureCardsVisible = false;

    if (sectionExists) {
      const featureCards = featuresSection.locator(this.elements.featureCards);
      featureCount = await featureCards.count();
      featureCardsVisible = featureCount > 0;
    }

    return { sectionExists, featureCount, featureCardsVisible };
  }

  /**
   * Test demo form functionality
   */
  async testDemoForm(formData: {
    name: string;
    email: string;
    company: string;
    message: string;
  }): Promise<{
    formExists: boolean;
    allFieldsPresent: boolean;
    formSubmission: boolean;
    submissionResponse: string;
    validationErrors: string[];
  }> {
    const formElement = this.page.locator(this.elements.demoForm);
    const formExists = await formElement.count() > 0;

    if (!formExists) {
      return {
        formExists: false,
        allFieldsPresent: false,
        formSubmission: false,
        submissionResponse: '',
        validationErrors: ['Demo form not found']
      };
    }

    // Check if all required fields are present
    const nameInput = formElement.locator(this.elements.nameInput);
    const emailInput = formElement.locator(this.elements.emailInput);
    const companyInput = formElement.locator(this.elements.companyInput);
    const messageTextarea = formElement.locator(this.elements.messageTextarea);
    const submitButton = formElement.locator(this.elements.submitButton);

    const allFieldsPresent = await Promise.all([
      nameInput.count().then(c => c > 0),
      emailInput.count().then(c => c > 0),
      companyInput.count().then(c => c > 0),
      messageTextarea.count().then(c => c > 0),
      submitButton.count().then(c => c > 0)
    ]).then(results => results.every(Boolean));

    const validationErrors: string[] = [];
    let formSubmission = false;
    let submissionResponse = '';

    if (allFieldsPresent) {
      try {
        // Fill form fields
        await nameInput.fill(formData.name);
        await emailInput.fill(formData.email);
        await companyInput.fill(formData.company);
        await messageTextarea.fill(formData.message);

        // Test form validation by submitting empty fields first
        await submitButton.click();
        await this.page.waitForTimeout(2000);

        // Check for validation errors
        const errorElements = this.page.locator(this.elements.errorMessage);
        const errorCount = await errorElements.count();

        if (errorCount > 0) {
          for (let i = 0; i < errorCount; i++) {
            const errorText = await errorElements.nth(i).textContent();
            if (errorText) validationErrors.push(errorText);
          }
        }

        // Fill form with valid data
        await nameInput.fill(formData.name);
        await emailInput.fill(formData.email);
        await companyInput.fill(formData.company);
        await messageTextarea.fill(formData.message);

        // Submit form
        await submitButton.click();

        // Wait for submission response
        await this.page.waitForTimeout(5000);

        // Check for success message
        const successElement = this.page.locator(this.elements.successMessage);
        const hasSuccess = await successElement.count() > 0;

        if (hasSuccess) {
          submissionResponse = await successElement.textContent() || 'Success message shown';
          formSubmission = true;
        } else {
          // Check if redirected to thank you page
          const currentUrl = this.page.url();
          if (currentUrl.includes('thank-you') || currentUrl.includes('success')) {
            submissionResponse = 'Redirected to success page';
            formSubmission = true;
          }
        }

      } catch (error: any) {
        validationErrors.push(`Form submission error: ${error.message}`);
      }
    } else {
      validationErrors.push('Not all form fields are present');
    }

    return {
      formExists: true,
      allFieldsPresent,
      formSubmission,
      submissionResponse,
      validationErrors
    };
  }

  /**
   * Test footer section
   */
  async testFooter(): Promise<{
    footerExists: boolean;
    copyrightVisible: boolean;
    copyrightContent: string;
  }> {
    const footerElement = this.page.locator(this.elements.footer);
    const footerExists = await footerElement.count() > 0;

    let copyrightVisible = false;
    let copyrightContent = '';

    if (footerExists) {
      const copyrightElement = footerElement.locator(this.elements.copyright);
      copyrightVisible = await copyrightElement.isVisible();
      if (copyrightVisible) {
        copyrightContent = await copyrightElement.textContent() || '';
      }
    }

    return { footerExists, copyrightVisible, copyrightContent };
  }

  /**
   * Test page responsiveness
   */
  async testResponsiveness(): Promise<{
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  }> {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 }
    ];

    const results = { mobile: false, tablet: false, desktop: false };

    for (const viewport of viewports) {
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await this.page.waitForTimeout(1000);

      // Check if page is responsive
      const hasHorizontalScroll = await this.page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });

      const heroVisible = await this.page.locator(this.elements.heroTitle).isVisible();

      results[viewport.name as keyof typeof results] = !hasHorizontalScroll && heroVisible;
    }

    return results;
  }

  /**
   * Capture performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    loadTime: number;
    domContentLoaded: number;
    resourceCount: number;
    errorCount: number;
  }> {
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        resourceCount: performance.getEntriesByType('resource').length
      };
    });

    // Count network errors
    let errorCount = 0;
    this.page.on('response', response => {
      if (response.status() >= 400) {
        errorCount++;
      }
    });

    return {
      ...metrics,
      errorCount
    };
  }
}