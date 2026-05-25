import { Page } from 'puppeteer';
import { SmartSelector, ElementInfo } from '../types/recording.js';
import { logger } from '../utils/logger.js';
import { AIService } from './AIService.js';

export class SmartSelectorService {
  private aiService: AIService;
  private selectorCache = new Map<string, SmartSelector>();

  constructor() {
    this.aiService = new AIService();
  }

  async generateSmartSelectors(
    page: Page,
    element: ElementInfo,
    coordinates?: { x: number; y: number }
  ): Promise<SmartSelector> {
    const cacheKey = this.generateCacheKey(element, coordinates);
    const cached = this.selectorCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const selectors = await page.evaluate((elementInfo, coords) => {
        const strategies = new Map<string, { selector: string; confidence: number; strategy: string }>();

        // Find the element using various strategies
        let targetElement: Element | null = null;

        // Strategy 1: ID selector (highest priority)
        if (elementInfo.attributes?.id) {
          const selector = `#${elementInfo.attributes.id}`;
          const el = document.querySelector(selector);
          if (el) {
            targetElement = el;
            strategies.set('id', {
              selector,
              confidence: 0.95,
              strategy: 'id'
            });
          }
        }

        // Strategy 2: Test ID attributes
        const testIdAttrs = ['data-testid', 'data-test', 'data-cy', 'data-qa'];
        for (const attr of testIdAttrs) {
          if (elementInfo.attributes?.[attr]) {
            const selector = `[${attr}="${elementInfo.attributes[attr]}"]`;
            const el = document.querySelector(selector);
            if (el) {
              targetElement = targetElement || el;
              strategies.set('testid', {
                selector,
                confidence: 0.9,
                strategy: 'testid'
              });
              break;
            }
          }
        }

        // Strategy 3: ARIA labels and roles
        if (elementInfo.attributes?.['aria-label']) {
          const selector = `[aria-label="${elementInfo.attributes['aria-label']}"]`;
          const el = document.querySelector(selector);
          if (el) {
            targetElement = targetElement || el;
            strategies.set('aria', {
              selector,
              confidence: 0.85,
              strategy: 'aria'
            });
          }
        }

        // Strategy 4: Name attribute (for form elements)
        if (elementInfo.attributes?.name) {
          const selector = `[name="${elementInfo.attributes.name}"]`;
          const el = document.querySelector(selector);
          if (el) {
            targetElement = targetElement || el;
            strategies.set('name', {
              selector,
              confidence: 0.8,
              strategy: 'css'
            });
          }
        }

        // Strategy 5: Text-based selection for buttons and links
        if (elementInfo.text && ['BUTTON', 'A', 'SPAN'].includes(elementInfo.tagName)) {
          const text = elementInfo.text.trim();
          const elements = Array.from(document.querySelectorAll(elementInfo.tagName.toLowerCase()));
          const matchingEl = elements.find(el => el.textContent?.trim() === text);

          if (matchingEl) {
            targetElement = targetElement || matchingEl;
            const selector = `${elementInfo.tagName.toLowerCase()}:contains("${text}")`;
            strategies.set('text', {
              selector,
              confidence: 0.75,
              strategy: 'text'
            });
          }
        }

        // Strategy 6: CSS path generation
        if (targetElement || coords) {
          let element = targetElement;

          // If no element found but we have coordinates, try to find element at coordinates
          if (!element && coords) {
            element = document.elementFromPoint(coords.x, coords.y);
          }

          if (element) {
            // Inline generateCSSPath function
            const generateCSSPath = (el: HTMLElement): string => {
              const path: string[] = [];
              let current: HTMLElement | null = el;
              while (current && current !== document.body) {
                let selector = current.tagName.toLowerCase();
                if (current.id) {
                  selector = `#${current.id}`;
                  path.unshift(selector);
                  break;
                } else if (current.className) {
                  selector += `.${current.className.trim().split(/\s+/)[0]}`;
                }
                path.unshift(selector);
                current = current.parentElement;
              }
              return path.join(' > ');
            };

            // Inline generateXPath function
            const generateXPath = (el: HTMLElement): string => {
              const parts: string[] = [];
              let current: HTMLElement | null = el;
              while (current && current !== document.body) {
                const part = current.tagName.toLowerCase();
                if (current.id) {
                  parts.unshift(`//*[@id="${current.id}"]`);
                  break;
                }
                parts.unshift(part);
                current = current.parentElement;
              }
              return parts.length > 0 ? `//${parts.join('/')}` : '//body';
            };

            const cssPath = generateCSSPath(element as HTMLElement);
            strategies.set('css', {
              selector: cssPath,
              confidence: 0.6,
              strategy: 'css'
            });

            // Strategy 7: XPath generation
            const xpath = generateXPath(element as HTMLElement);
            strategies.set('xpath', {
              selector: xpath,
              confidence: 0.5,
              strategy: 'xpath'
            });
          }
        }

        return Array.from(strategies.values()).sort((a, b) => b.confidence - a.confidence);
      }, element, coordinates);

      // Generate AI-powered selector if enabled
      let aiSelector: string | null = null;
      let aiConfidence = 0;

      try {
        const aiResult = await this.generateAISelector(element, selectors);
        if (aiResult) {
          aiSelector = aiResult.selector;
          aiConfidence = aiResult.confidence;
        }
      } catch (error) {
        logger.warn(`AI selector generation failed: ${error}`);
      }

      // Build smart selector with fallbacks
      const smartSelector: SmartSelector = {
        primary: aiSelector || selectors[0]?.selector || `${element.tagName.toLowerCase()}`,
        fallbacks: selectors.map(s => s.selector).filter(s => s !== aiSelector),
        confidence: Math.max(aiConfidence, selectors[0]?.confidence || 0.1),
        strategy: aiSelector ? 'ai' : (selectors[0]?.strategy as any) || 'css',
        stability: await this.calculateStability(page, selectors[0]?.selector || ''),
        aiGenerated: !!aiSelector,
        visualHash: await this.generateVisualHash(page, element, coordinates)
      };

      // Cache the result
      this.selectorCache.set(cacheKey, smartSelector);
      return smartSelector;

    } catch (error) {
      logger.error(`Failed to generate smart selectors: ${error}`);

      // Fallback selector
      return {
        primary: `${element.tagName.toLowerCase()}`,
        fallbacks: [],
        confidence: 0.1,
        strategy: 'css',
        stability: 0.1,
        aiGenerated: false
      };
    }
  }

  private async generateAISelector(
    element: ElementInfo,
    existingSelectors: any[]
  ): Promise<{ selector: string; confidence: number } | null> {
    try {
      const prompt = `
        Generate an optimal CSS selector for this HTML element:
        Tag: ${element.tagName}
        Text: ${element.text || 'N/A'}
        Attributes: ${JSON.stringify(element.attributes || {})}
        
        Existing selectors and their confidence scores:
        ${existingSelectors.map(s => `${s.selector} (${s.confidence})`).join('\n')}
        
        Please provide a more robust selector that:
        1. Is less likely to break with UI changes
        2. Is more semantically meaningful
        3. Has better performance
        
        Respond with JSON: {"selector": "your_selector", "confidence": 0.0-1.0, "reasoning": "explanation"}
      `;

      const response = await this.aiService.generateText(prompt);
      const result = JSON.parse(response);

      if (result.selector && result.confidence > 0.5) {
        return {
          selector: result.selector,
          confidence: result.confidence
        };
      }
    } catch (error) {
      logger.debug(`AI selector generation failed: ${error}`);
    }

    return null;
  }

  private async calculateStability(page: Page, selector: string): Promise<number> {
    if (!selector) return 0;

    try {
      return await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return 0;

        let stability = 0.5; // Base stability

        // Check for stable attributes
        if (element.id) stability += 0.3;
        if (element.getAttribute('data-testid')) stability += 0.2;
        if (element.getAttribute('aria-label')) stability += 0.1;
        if (element.getAttribute('name')) stability += 0.1;

        // Penalize for position-dependent selectors
        if (sel.includes(':nth-child') || sel.includes(':nth-of-type')) {
          stability -= 0.2;
        }

        // Penalize for class-only selectors (classes can change)
        if (sel.startsWith('.') && !sel.includes('#') && !sel.includes('[')) {
          stability -= 0.1;
        }

        return Math.max(0, Math.min(1, stability));
      }, selector);
    } catch (error) {
      return 0.1;
    }
  }

  private async generateVisualHash(
    page: Page,
    element: ElementInfo,
    coordinates?: { x: number; y: number }
  ): Promise<string> {
    try {
      if (!coordinates) return '';

      // Take a small screenshot around the element
      const screenshot = await page.screenshot({
        type: 'png',
        clip: {
          x: Math.max(0, coordinates.x - 50),
          y: Math.max(0, coordinates.y - 50),
          width: 100,
          height: 100
        }
      });

      // Generate a simple hash of the screenshot
      const crypto = require('crypto');
      return crypto.createHash('md5').update(screenshot).digest('hex').substring(0, 16);
    } catch (error) {
      return '';
    }
  }

  private generateCacheKey(element: ElementInfo, coordinates?: { x: number; y: number }): string {
    const key = [
      element.tagName,
      element.text,
      JSON.stringify(element.attributes),
      coordinates ? `${coordinates.x},${coordinates.y}` : ''
    ].join('|');

    const crypto = require('crypto');
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async healSelector(
    page: Page,
    originalSelector: SmartSelector,
    element: ElementInfo
  ): Promise<SmartSelector> {
    logger.info(`Attempting to heal selector: ${originalSelector.primary}`);

    // Try fallback selectors first
    for (const fallback of originalSelector.fallbacks) {
      try {
        const exists = await page.evaluate((sel) => {
          return !!document.querySelector(sel);
        }, fallback);

        if (exists) {
          logger.info(`Healed selector using fallback: ${fallback}`);
          return {
            ...originalSelector,
            primary: fallback,
            confidence: originalSelector.confidence * 0.8 // Reduce confidence slightly
          };
        }
      } catch (error) {
        continue;
      }
    }

    // Generate new selectors if fallbacks fail
    logger.info('Fallbacks failed, generating new selectors');
    return this.generateSmartSelectors(page, element);
  }

  async validateSelector(page: Page, selector: string): Promise<boolean> {
    try {
      return await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return !!element;
      }, selector);
    } catch (error) {
      return false;
    }
  }

  clearCache(): void {
    this.selectorCache.clear();
  }
}

export const smartSelectorService = new SmartSelectorService();