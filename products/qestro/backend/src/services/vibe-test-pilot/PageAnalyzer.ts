/**
 * PageAnalyzer - Analyzes web pages to extract testable elements
 */

import { chromium } from 'playwright';
import { logger } from '../../utils/logger.js';
import { selectorBuilder } from './SelectorBuilder.js';
import type { PageAnalysis, PageElement, UserFlow } from './types.js';

export class PageAnalyzer {
  private static readonly TIMEOUT = 30000;
  private static readonly MAX_ELEMENTS = 100;

  async analyzePage(url: string): Promise<PageAnalysis> {
    const startTime = Date.now();
    let browser = null;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.createBrowserContext();
      const page = await context.newPage();

      logger.info(`Analyzing page: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: PageAnalyzer.TIMEOUT });

      const title = await page.title();
      const elements = await this.extractElements(page);
      const flows = this.identifyUserFlows(elements);
      const metadata = {
        loadTime: Date.now() - startTime,
        isResponsive: await this.checkResponsive(page),
        hasAccessibility: await this.checkAccessibility(page),
      };

      const formCount = elements.filter(e => e.type === 'form').length;
      const buttonsCount = elements.filter(e => e.type === 'button').length;
      const linksCount = elements.filter(e => e.type === 'link').length;
      const modalsCount = elements.filter(e => e.type === 'modal').length;

      logger.info(`Page analysis complete: ${elements.length} elements found`);

      await context.close();

      return { url, title, formCount, buttonsCount, linksCount, modalsCount, elements, flows, metadata };
    } catch (error) {
      logger.error(`Failed to analyze page: ${url}`, error);
      throw new Error(`Page analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async extractElements(page: any): Promise<PageElement[]> {
    const elements: PageElement[] = [];

    // Buttons
    const buttons = await page.locator('button').all();
    for (const btn of buttons.slice(0, 20)) {
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      elements.push({
        selector: await selectorBuilder.getSelector(btn),
        type: 'button',
        text: text?.trim() || undefined,
        ariaLabel: ariaLabel || undefined,
      });
    }

    // Inputs
    const inputs = await page.locator('input').all();
    for (const input of inputs.slice(0, 20)) {
      const placeholder = await input.getAttribute('placeholder');
      const ariaLabel = await input.getAttribute('aria-label');
      elements.push({
        selector: await selectorBuilder.getSelector(input),
        type: 'input',
        placeholder: placeholder || undefined,
        ariaLabel: ariaLabel || undefined,
      });
    }

    // Links
    const links = await page.locator('a').all();
    for (const link of links.slice(0, 15)) {
      const text = await link.textContent();
      elements.push({
        selector: await selectorBuilder.getSelector(link),
        type: 'link',
        text: text?.trim() || undefined,
      });
    }

    // Forms
    const forms = await page.locator('form').all();
    for (const form of forms.slice(0, 10)) {
      elements.push({
        selector: await selectorBuilder.getSelector(form),
        type: 'form',
      });
    }

    // Modals
    const modals = await page.locator('[role="dialog"], .modal, .dialog').all();
    for (const modal of modals.slice(0, 10)) {
      elements.push({
        selector: await selectorBuilder.getSelector(modal),
        type: 'modal',
      });
    }

    return elements.slice(0, PageAnalyzer.MAX_ELEMENTS);
  }

  private identifyUserFlows(elements: PageElement[]): UserFlow[] {
    const flows: UserFlow[] = [];

    const hasLoginForm = elements.some(
      e => e.type === 'form' || (e.type === 'input' && (e.placeholder?.toLowerCase().includes('email') || e.placeholder?.toLowerCase().includes('password')))
    );
    if (hasLoginForm) {
      flows.push({
        name: 'Login',
        steps: ['Navigate to login', 'Fill email', 'Fill password', 'Submit'],
        elements: elements.filter(e => e.type === 'input' || e.type === 'button').slice(0, 5),
        expectedOutcome: 'User logged in',
      });
    }

    const hasSignupForm = elements.some(
      e => e.text?.toLowerCase().includes('sign up') || e.text?.toLowerCase().includes('register') || e.placeholder?.toLowerCase().includes('email')
    );
    if (hasSignupForm) {
      flows.push({
        name: 'Signup',
        steps: ['Navigate to signup', 'Fill form', 'Verify email', 'Complete'],
        elements: elements.filter(e => e.type === 'input' || e.type === 'button').slice(0, 5),
        expectedOutcome: 'Account created',
      });
    }

    const hasSearch = elements.some(e => e.placeholder?.toLowerCase().includes('search'));
    if (hasSearch) {
      flows.push({
        name: 'Search',
        steps: ['Fill search', 'Click search', 'View results'],
        elements: elements.filter(e => e.placeholder?.toLowerCase().includes('search')).slice(0, 3),
        expectedOutcome: 'Results displayed',
      });
    }

    return flows;
  }

  private async checkResponsive(page: any): Promise<boolean> {
    try {
      const viewport = page.viewportSize();
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForLoadState('networkidle', { timeout: 5000 });
      await page.setViewportSize(viewport);
      return true;
    } catch {
      return false;
    }
  }

  private async checkAccessibility(page: any): Promise<boolean> {
    try {
      const ariaElements = await page.locator('[role], [aria-label], [aria-labelledby]').count();
      return ariaElements > 0;
    } catch {
      return false;
    }
  }
}

export const pageAnalyzer = new PageAnalyzer();
