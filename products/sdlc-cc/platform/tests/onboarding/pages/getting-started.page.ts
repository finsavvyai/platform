import { Page, Locator } from "@playwright/test";

/**
 * Getting Started Page Object Model
 * Encapsulates all interactions with the SDLC.ai getting started guide
 */
export class GettingStartedPage {
  readonly page: Page;

  // Page containers
  readonly container: Locator;
  readonly heroSection: Locator;

  // Main heading
  readonly heading: Locator;
  readonly subtitle: Locator;

  // Section elements
  readonly problemSection: Locator;
  readonly solutionSection: Locator;
  readonly quickStartSection: Locator;
  readonly codeExamples: Locator;

  // Step elements
  readonly steps: Locator;
  readonly stepElements: Locator;

  // Code blocks
  readonly pythonExample: Locator;
  readonly javascriptExample: Locator;

  // CTA buttons
  readonly ctaButtons: Locator;
  readonly getStartedButton: Locator;

  // Navigation
  readonly header: Locator;
  readonly navLinks: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main containers
    this.container = page.locator('main, [class*="getting-started"]');
    this.heroSection = page.locator("section").first();

    // Headings
    this.heading = page.locator(
      'h1:has-text("How to Use"), h1:has-text("Getting Started")',
    );
    this.subtitle = page
      .locator("p")
      .filter({ hasText: /simple|easy|minutes/i })
      .first();

    // Sections
    this.problemSection = page.locator(
      'section:has-text("Problem"), h2:has-text("Problem")',
    );
    this.solutionSection = page.locator(
      'section:has-text("Solution"), h2:has-text("Solution")',
    );
    this.quickStartSection = page.locator(
      'h2:has-text("Quick Start"), section:has-text("steps")',
    );
    this.codeExamples = page.locator('pre, code, [class*="code"]');

    // Steps
    this.steps = page.locator('[class*="step"], [data-step]');
    this.stepElements = page.locator('div:has([class*="step-number"])');

    // Code blocks
    this.pythonExample = page
      .locator("pre")
      .filter({ hasText: /import openai|python/i });
    this.javascriptExample = page
      .locator("pre")
      .filter({ hasText: /const|import.*openai|javascript/i });

    // CTAs
    this.ctaButtons = page.locator('a[class*="btn"], button[class*="btn"]');
    this.getStartedButton = page.locator(
      'a:has-text("Get Started"), a:has-text("Sign Up")',
    );

    // Navigation
    this.header = page.locator("header");
    this.navLinks = this.header.locator("a");
  }

  /**
   * Navigate to the getting started page
   */
  async goto(): Promise<void> {
    await this.page.goto("/getting-started", { waitUntil: "networkidle" });
  }

  /**
   * Wait for the page to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    await this.heading.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Get the page heading
   */
  async getHeading(): Promise<string> {
    return (await this.heading.textContent()) || "";
  }

  /**
   * Get the subtitle
   */
  async getSubtitle(): Promise<string> {
    return (await this.subtitle.textContent()) || "";
  }

  /**
   * Get the number of steps in the quick start guide
   */
  async getStepCount(): Promise<number> {
    return await this.stepElements.count();
  }

  /**
   * Get all step information
   */
  async getSteps(): Promise<
    Array<{ number: number; title: string; description: string }>
  > {
    const steps: Array<{ number: number; title: string; description: string }> =
      [];
    const count = await this.stepElements.count();

    for (let i = 0; i < count; i++) {
      const step = this.stepElements.nth(i);
      const numberElement = step.locator('[class*="number"], [class*="step"]');
      const titleElement = step.locator("h3, h4");
      const descriptionElement = step.locator("p");

      const number = (await numberElement.textContent()) || `${i + 1}`;
      const title = (await titleElement.textContent()) || "";
      const description = (await descriptionElement.textContent()) || "";

      steps.push({
        number: parseInt(number) || i + 1,
        title: title.trim(),
        description: description.trim(),
      });
    }

    return steps;
  }

  /**
   * Check if Python code example is visible
   */
  async hasPythonExample(): Promise<boolean> {
    return await this.pythonExample.isVisible().catch(() => false);
  }

  /**
   * Check if JavaScript code example is visible
   */
  async hasJavaScriptExample(): Promise<boolean> {
    return await this.javascriptExample.isVisible().catch(() => false);
  }

  /**
   * Get Python code example text
   */
  async getPythonExample(): Promise<string> {
    if (await this.hasPythonExample()) {
      return (await this.pythonExample.textContent()) || "";
    }
    return "";
  }

  /**
   * Get JavaScript code example text
   */
  async getJavaScriptExample(): Promise<string> {
    if (await this.hasJavaScriptExample()) {
      return (await this.javascriptExample.textContent()) || "";
    }
    return "";
  }

  /**
   * Click the get started button
   */
  async clickGetStarted(): Promise<void> {
    await this.getStartedButton.first().click();
  }

  /**
   * Scroll to a specific section
   */
  async scrollToSection(sectionName: string): Promise<void> {
    const section = this.page.locator(
      `h2:has-text("${sectionName}"), section:has-text("${sectionName}")`,
    );
    await section.scrollIntoViewIfNeeded();
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(options?: { name: string }): Promise<void> {
    const name = options?.name || "getting-started";
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Check if all sections are visible
   */
  async allSectionsVisible(): Promise<boolean> {
    const problemVisible = await this.problemSection
      .isVisible()
      .catch(() => false);
    const solutionVisible = await this.solutionSection
      .isVisible()
      .catch(() => false);
    const quickStartVisible = await this.quickStartSection
      .isVisible()
      .catch(() => false);

    return problemVisible && solutionVisible && quickStartVisible;
  }
}
