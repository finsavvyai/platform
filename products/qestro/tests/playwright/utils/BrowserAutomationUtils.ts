/**
 * Browser Automation Utilities
 * Advanced utilities for browser automation and testing
 */

import { Page, Browser, BrowserContext, Locator, expect } from '@playwright/test';
import { PlaywrightTestHelpers } from './testHelpers';

export interface SelectorStrategy {
  type: 'css' | 'xpath' | 'text' | 'data-testid' | 'role' | 'label';
  value: string;
  priority: number;
}

export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export class BrowserAutomationUtils {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Generate multiple selector strategies for an element
   */
  async generateSelectorStrategies(element: Locator): Promise<SelectorStrategy[]> {
    const strategies: SelectorStrategy[] = [];
    
    // Get element info
    const elementInfo = await this.getElementInfo(element);
    
    // Data-testid strategy (highest priority)
    if (elementInfo.attributes['data-testid']) {
      strategies.push({
        type: 'data-testid',
        value: `[data-testid="${elementInfo.attributes['data-testid']}"]`,
        priority: 1
      });
    }

    // ID strategy
    if (elementInfo.id) {
      strategies.push({
        type: 'css',
        value: `#${elementInfo.id}`,
        priority: 2
      });
    }

    // Role strategy
    if (elementInfo.attributes['role']) {
      strategies.push({
        type: 'role',
        value: elementInfo.attributes['role'],
        priority: 3
      });
    }

    // Text content strategy
    if (elementInfo.textContent && elementInfo.textContent.trim().length > 0) {
      strategies.push({
        type: 'text',
        value: elementInfo.textContent.trim(),
        priority: 4
      });
    }

    // Class-based strategy
    if (elementInfo.className) {
      const classes = elementInfo.className.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) {
        strategies.push({
          type: 'css',
          value: `.${classes.join('.')}`,
          priority: 5
        });
      }
    }

    // Tag name strategy (lowest priority)
    strategies.push({
      type: 'css',
      value: elementInfo.tagName.toLowerCase(),
      priority: 6
    });

    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get comprehensive element information
   */
  async getElementInfo(element: Locator): Promise<ElementInfo> {
    return await element.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const attributes: Record<string, string> = {};
      
      // Get all attributes
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        attributes[attr.name] = attr.value;
      }

      return {
        tagName: el.tagName,
        id: el.id || undefined,
        className: el.className || undefined,
        textContent: el.textContent || undefined,
        attributes,
        position: { x: rect.x, y: rect.y },
        size: { width: rect.width, height: rect.height }
      };
    });
  }

  /**
   * Smart element finder with multiple strategies
   */
  async findElementWithStrategies(strategies: SelectorStrategy[]): Promise<Locator | null> {
    for (const strategy of strategies) {
      try {
        let locator: Locator;
        
        switch (strategy.type) {
          case 'css':
          case 'data-testid':
            locator = this.page.locator(strategy.value);
            break;
          case 'text':
            locator = this.page.getByText(strategy.value);
            break;
          case 'role':
            locator = this.page.getByRole(strategy.value as any);
            break;
          case 'label':
            locator = this.page.getByLabel(strategy.value);
            break;
          case 'xpath':
            locator = this.page.locator(`xpath=${strategy.value}`);
            break;
          default:
            continue;
        }

        // Check if element exists and is visible
        await locator.waitFor({ state: 'visible', timeout: 1000 });
        return locator;
      } catch {
        // Continue to next strategy
        continue;
      }
    }
    
    return null;
  }

  /**
   * Record user interactions
   */
  async startRecording(): Promise<InteractionRecorder> {
    return new InteractionRecorder(this.page);
  }

  /**
   * Simulate human-like interactions
   */
  async humanLikeClick(selector: string, options?: { delay?: number }): Promise<void> {
    const element = this.page.locator(selector);
    
    // Scroll element into view
    await element.scrollIntoViewIfNeeded();
    
    // Wait for element to be stable
    await PlaywrightTestHelpers.waitForElementStable(this.page, selector);
    
    // Add human-like delay
    if (options?.delay) {
      await this.page.waitForTimeout(options.delay);
    }
    
    // Click with human-like timing
    await element.click({ delay: Math.random() * 100 + 50 });
  }

  /**
   * Human-like typing
   */
  async humanLikeType(selector: string, text: string, options?: { delay?: number }): Promise<void> {
    const element = this.page.locator(selector);
    await element.scrollIntoViewIfNeeded();
    
    // Clear existing content
    await element.clear();
    
    // Type with human-like delays
    for (const char of text) {
      await element.type(char, { delay: Math.random() * 100 + 50 });
      if (options?.delay) {
        await this.page.waitForTimeout(options.delay);
      }
    }
  }

  /**
   * Wait for multiple conditions
   */
  async waitForConditions(conditions: Array<() => Promise<boolean>>, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const results = await Promise.all(conditions.map(condition => 
        condition().catch(() => false)
      ));
      
      if (results.every(result => result)) {
        return;
      }
      
      await this.page.waitForTimeout(100);
    }
    
    throw new Error('Timeout waiting for conditions to be met');
  }

  /**
   * Advanced screenshot with annotations
   */
  async takeAnnotatedScreenshot(name: string, annotations?: Array<{
    selector: string;
    label: string;
    color?: string;
  }>): Promise<string> {
    if (annotations && annotations.length > 0) {
      // Add annotations to the page
      await this.page.evaluate((annotations) => {
        annotations.forEach((annotation, index) => {
          const element = document.querySelector(annotation.selector);
          if (element) {
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.border = `2px solid ${annotation.color || 'red'}`;
            overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            overlay.style.zIndex = '9999';
            overlay.style.pointerEvents = 'none';
            overlay.textContent = annotation.label;
            overlay.style.color = annotation.color || 'red';
            overlay.style.fontSize = '12px';
            overlay.style.padding = '2px 4px';
            
            const rect = element.getBoundingClientRect();
            overlay.style.left = `${rect.left}px`;
            overlay.style.top = `${rect.top - 20}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height + 20}px`;
            
            document.body.appendChild(overlay);
          }
        });
      }, annotations);
    }
    
    const screenshotPath = await PlaywrightTestHelpers.takeTimestampedScreenshot(this.page, name);
    
    // Remove annotations
    if (annotations && annotations.length > 0) {
      await this.page.evaluate(() => {
        const overlays = document.querySelectorAll('[style*="z-index: 9999"]');
        overlays.forEach(overlay => overlay.remove());
      });
    }
    
    return screenshotPath;
  }

  /**
   * Performance monitoring
   */
  async startPerformanceMonitoring(): Promise<PerformanceMonitor> {
    return new PerformanceMonitor(this.page);
  }

  /**
   * Accessibility testing
   */
  async runAccessibilityCheck(): Promise<AccessibilityReport> {
    // Inject axe-core for accessibility testing
    await this.page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.7.0/axe.min.js' });
    
    const results = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        (window as any).axe.run((err: any, results: any) => {
          if (err) throw err;
          resolve(results);
        });
      });
    });
    
    return results as AccessibilityReport;
  }
}

/**
 * Interaction Recorder for capturing user actions
 */
export class InteractionRecorder {
  private page: Page;
  private actions: Array<any> = [];
  private isRecording = false;

  constructor(page: Page) {
    this.page = page;
  }

  async start(): Promise<void> {
    if (this.isRecording) return;
    
    this.isRecording = true;
    this.actions = [];
    
    // Set up event listeners
    await this.page.evaluate(() => {
      // Record clicks
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        (window as any).recordedActions = (window as any).recordedActions || [];
        (window as any).recordedActions.push({
          type: 'click',
          selector: target.tagName.toLowerCase() + (target.id ? `#${target.id}` : ''),
          timestamp: Date.now(),
          coordinates: { x: event.clientX, y: event.clientY }
        });
      });
      
      // Record input changes
      document.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        (window as any).recordedActions = (window as any).recordedActions || [];
        (window as any).recordedActions.push({
          type: 'input',
          selector: target.tagName.toLowerCase() + (target.id ? `#${target.id}` : ''),
          value: target.value,
          timestamp: Date.now()
        });
      });
    });
  }

  async stop(): Promise<Array<any>> {
    if (!this.isRecording) return this.actions;
    
    this.isRecording = false;
    
    // Get recorded actions from the page
    const recordedActions = await this.page.evaluate(() => {
      return (window as any).recordedActions || [];
    });
    
    this.actions = recordedActions;
    return this.actions;
  }

  getActions(): Array<any> {
    return this.actions;
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private page: Page;
  private startTime: number;

  constructor(page: Page) {
    this.page = page;
    this.startTime = Date.now();
  }

  async getMetrics(): Promise<PerformanceMetrics> {
    return await PlaywrightTestHelpers.getPerformanceMetrics(this.page);
  }

  async measureLoadTime(): Promise<number> {
    const metrics = await this.getMetrics();
    return metrics.totalLoadTime;
  }

  async measureInteractionTime(action: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await action();
    return Date.now() - startTime;
  }
}

/**
 * Types
 */
export interface PerformanceMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  totalLoadTime: number;
}

export interface AccessibilityReport {
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: Array<any>;
  }>;
  passes: Array<any>;
  incomplete: Array<any>;
}