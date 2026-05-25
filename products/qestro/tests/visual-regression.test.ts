/**
 * Visual Regression Testing Suite
 * Screenshot diff, baseline management, and threshold configuration
 * 30+ test cases for pixel-perfect visual validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

interface Screenshot {
  data: Buffer;
  timestamp: number;
  viewport: { width: number; height: number };
  selector?: string;
}

interface DiffResult {
  hasDifferences: boolean;
  pixelsDifferent: number;
  percentageDifferent: number;
  threshold: number;
  passed: boolean;
}

interface VisualBaseline {
  id: string;
  screenshot: Screenshot;
  createdAt: number;
  browser: string;
  viewport: { width: number; height: number };
}

class VisualRegressionEngine {
  private baselines: Map<string, VisualBaseline> = new Map();
  private diffThreshold = 0.01; // 1% default

  setDiffThreshold(threshold: number): void {
    this.diffThreshold = Math.min(threshold, 1.0);
  }

  compareScreenshots(
    current: Screenshot,
    baseline: Screenshot,
    threshold?: number
  ): DiffResult {
    const diff = this.calculateDiff(current, baseline);
    const pct = diff / (baseline.data.length * 8); // bits
    const thr = threshold ?? this.diffThreshold;

    return {
      hasDifferences: diff > 0,
      pixelsDifferent: diff,
      percentageDifferent: pct,
      threshold: thr,
      passed: pct <= thr,
    };
  }

  private calculateDiff(current: Screenshot, baseline: Screenshot): number {
    if (current.data.length !== baseline.data.length) return current.data.length;
    let diff = 0;
    for (let i = 0; i < current.data.length; i++) {
      if (current.data[i] !== baseline.data[i]) diff++;
    }
    return diff;
  }

  saveBaseline(
    testId: string,
    screenshot: Screenshot,
    browser: string
  ): VisualBaseline {
    const baseline: VisualBaseline = {
      id: testId,
      screenshot,
      createdAt: Date.now(),
      browser,
      viewport: screenshot.viewport,
    };
    this.baselines.set(testId, baseline);
    return baseline;
  }

  getBaseline(testId: string): VisualBaseline | undefined {
    return this.baselines.get(testId);
  }

  updateBaseline(
    testId: string,
    screenshot: Screenshot,
    browser: string
  ): VisualBaseline {
    return this.saveBaseline(testId, screenshot, browser);
  }

  deleteBaseline(testId: string): boolean {
    return this.baselines.delete(testId);
  }

  listBaselines(): VisualBaseline[] {
    return Array.from(this.baselines.values());
  }

  generateDiffReport(diff: DiffResult, testName: string): string {
    return `Visual Regression Report - ${testName}
Status: ${diff.passed ? 'PASSED' : 'FAILED'}
Threshold: ${(diff.threshold * 100).toFixed(2)}%
Pixels Different: ${diff.pixelsDifferent}
Percentage: ${(diff.percentageDifferent * 100).toFixed(4)}%`;
  }

  detectViewportChange(
    baseline: Screenshot,
    current: Screenshot
  ): { widthChanged: boolean; heightChanged: boolean } {
    return {
      widthChanged: baseline.viewport.width !== current.viewport.width,
      heightChanged: baseline.viewport.height !== current.viewport.height,
    };
  }

  maskSelector(screenshot: Screenshot, selector: string): Screenshot {
    return {
      ...screenshot,
      selector,
      data: Buffer.alloc(screenshot.data.length), // Masked area zeroed
    };
  }
}

describe('Visual Regression Testing', () => {
  let engine: VisualRegressionEngine;
  let baselineScreenshot: Screenshot;
  let currentScreenshot: Screenshot;

  beforeEach(() => {
    engine = new VisualRegressionEngine();
    baselineScreenshot = {
      data: Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]), // Red then green
      timestamp: Date.now() - 86400000,
      viewport: { width: 1280, height: 720 },
    };
    currentScreenshot = {
      data: Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]),
      timestamp: Date.now(),
      viewport: { width: 1280, height: 720 },
    };
  });

  afterEach(() => {
    engine.listBaselines().forEach((b) => engine.deleteBaseline(b.id));
  });

  describe('Screenshot Comparison', () => {
    it('should detect identical screenshots', () => {
      const result = engine.compareScreenshots(
        currentScreenshot,
        baselineScreenshot
      );
      expect(result.hasDifferences).toBe(false);
      expect(result.pixelsDifferent).toBe(0);
      expect(result.passed).toBe(true);
    });

    it('should detect differences in screenshots', () => {
      const differentScreenshot = {
        ...currentScreenshot,
        data: Buffer.from([255, 0, 0, 255, 255, 0, 0, 255]), // Changed green to red
      };
      const result = engine.compareScreenshots(
        differentScreenshot,
        baselineScreenshot
      );
      expect(result.hasDifferences).toBe(true);
      expect(result.pixelsDifferent).toBeGreaterThan(0);
    });

    it('should respect custom diff threshold', () => {
      engine.setDiffThreshold(0.05); // 5%
      const differentScreenshot = {
        ...currentScreenshot,
        data: Buffer.from([255, 0, 0, 255, 255, 0, 0, 255]),
      };
      const result = engine.compareScreenshots(
        differentScreenshot,
        baselineScreenshot,
        0.05
      );
      expect(result.threshold).toBe(0.05);
    });

    it('should handle size mismatches', () => {
      const smallerScreenshot = {
        ...currentScreenshot,
        data: Buffer.from([255, 0, 0, 255]),
      };
      const result = engine.compareScreenshots(
        smallerScreenshot,
        baselineScreenshot
      );
      expect(result.hasDifferences).toBe(true);
    });

    it('should calculate percentage difference accurately', () => {
      const onePixelDiff = {
        ...currentScreenshot,
        data: Buffer.from([254, 0, 0, 255, 0, 255, 0, 255]), // One byte different
      };
      const result = engine.compareScreenshots(
        onePixelDiff,
        baselineScreenshot
      );
      expect(result.percentageDifferent).toBeGreaterThan(0);
      expect(result.percentageDifferent).toBeLessThan(0.1);
    });

    it('should pass threshold validation', () => {
      const result = engine.compareScreenshots(
        currentScreenshot,
        baselineScreenshot,
        0.01
      );
      expect(result.passed).toBe(true);
    });

    it('should fail threshold validation when exceeded', () => {
      const differentScreenshot = {
        ...currentScreenshot,
        data: Buffer.alloc(currentScreenshot.data.length),
      };
      const result = engine.compareScreenshots(
        differentScreenshot,
        baselineScreenshot,
        0.001 // Very strict
      );
      expect(result.passed).toBe(false);
    });
  });

  describe('Baseline Management', () => {
    it('should save baseline screenshot', () => {
      const baseline = engine.saveBaseline(
        'login-page',
        baselineScreenshot,
        'chromium'
      );
      expect(baseline.id).toBe('login-page');
      expect(baseline.browser).toBe('chromium');
      expect(baseline.createdAt).toBeDefined();
    });

    it('should retrieve saved baseline', () => {
      engine.saveBaseline('login-page', baselineScreenshot, 'chromium');
      const retrieved = engine.getBaseline('login-page');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('login-page');
    });

    it('should return undefined for missing baseline', () => {
      const retrieved = engine.getBaseline('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should update existing baseline', () => {
      engine.saveBaseline('login-page', baselineScreenshot, 'chromium');
      const newScreenshot = {
        ...baselineScreenshot,
        data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
      };
      const updated = engine.updateBaseline(
        'login-page',
        newScreenshot,
        'chromium'
      );
      expect(updated.createdAt).toBeGreaterThanOrEqual(
        baselineScreenshot.timestamp
      );
    });

    it('should delete baseline by ID', () => {
      engine.saveBaseline('login-page', baselineScreenshot, 'chromium');
      const deleted = engine.deleteBaseline('login-page');
      expect(deleted).toBe(true);
      expect(engine.getBaseline('login-page')).toBeUndefined();
    });

    it('should return false when deleting non-existent baseline', () => {
      const deleted = engine.deleteBaseline('non-existent');
      expect(deleted).toBe(false);
    });

    it('should list all baselines', () => {
      engine.saveBaseline('page1', baselineScreenshot, 'chromium');
      engine.saveBaseline('page2', baselineScreenshot, 'firefox');
      const baselines = engine.listBaselines();
      expect(baselines).toHaveLength(2);
    });

    it('should preserve browser information in baseline', () => {
      const browsers = ['chromium', 'firefox', 'webkit'];
      browsers.forEach((browser) => {
        engine.saveBaseline(`page-${browser}`, baselineScreenshot, browser);
      });
      const baselines = engine.listBaselines();
      expect(baselines.map((b) => b.browser)).toEqual(expect.arrayContaining(browsers));
    });
  });

  describe('Threshold Configuration', () => {
    it('should set custom diff threshold', () => {
      engine.setDiffThreshold(0.03);
      const result = engine.compareScreenshots(
        currentScreenshot,
        baselineScreenshot
      );
      expect(result.threshold).toBe(0.03);
    });

    it('should cap threshold at 1.0', () => {
      engine.setDiffThreshold(1.5);
      const result = engine.compareScreenshots(
        currentScreenshot,
        baselineScreenshot
      );
      expect(result.threshold).toBeLessThanOrEqual(1.0);
    });

    it('should handle zero threshold', () => {
      engine.setDiffThreshold(0);
      const result = engine.compareScreenshots(
        currentScreenshot,
        baselineScreenshot
      );
      expect(result.threshold).toBe(0);
    });

    it('should apply threshold to comparison', () => {
      engine.setDiffThreshold(0.5);
      const result = engine.compareScreenshots(
        currentScreenshot,
        baselineScreenshot,
        0.5
      );
      expect(result.threshold).toBe(0.5);
    });
  });

  describe('Viewport Handling', () => {
    it('should detect viewport width changes', () => {
      const differentViewport = {
        ...currentScreenshot,
        viewport: { width: 1920, height: 720 },
      };
      const change = engine.detectViewportChange(
        baselineScreenshot,
        differentViewport
      );
      expect(change.widthChanged).toBe(true);
      expect(change.heightChanged).toBe(false);
    });

    it('should detect viewport height changes', () => {
      const differentViewport = {
        ...currentScreenshot,
        viewport: { width: 1280, height: 1080 },
      };
      const change = engine.detectViewportChange(
        baselineScreenshot,
        differentViewport
      );
      expect(change.widthChanged).toBe(false);
      expect(change.heightChanged).toBe(true);
    });

    it('should detect both viewport changes', () => {
      const differentViewport = {
        ...currentScreenshot,
        viewport: { width: 768, height: 1024 },
      };
      const change = engine.detectViewportChange(
        baselineScreenshot,
        differentViewport
      );
      expect(change.widthChanged).toBe(true);
      expect(change.heightChanged).toBe(true);
    });

    it('should preserve viewport info in baseline', () => {
      const viewport = { width: 1920, height: 1080 };
      const screenshot = { ...baselineScreenshot, viewport };
      const baseline = engine.saveBaseline('desktop-page', screenshot, 'chromium');
      expect(baseline.viewport).toEqual(viewport);
    });
  });

  describe('Selector Masking', () => {
    it('should mask screenshot region by selector', () => {
      const original = baselineScreenshot;
      const masked = engine.maskSelector(original, '.dynamic-content');
      expect(masked.selector).toBe('.dynamic-content');
      expect(masked.data.every((b) => b === 0)).toBe(true);
    });

    it('should preserve original screenshot', () => {
      const original = { ...baselineScreenshot };
      engine.maskSelector(original, '.button');
      expect(original.data).toEqual(baselineScreenshot.data);
    });

    it('should handle multiple selector masking', () => {
      let screenshot = baselineScreenshot;
      screenshot = engine.maskSelector(screenshot, '.ads');
      screenshot = engine.maskSelector(screenshot, '.timestamp');
      expect(screenshot.selector).toBe('.timestamp');
    });
  });

  describe('Report Generation', () => {
    it('should generate passed report', () => {
      const diff: DiffResult = {
        hasDifferences: false,
        pixelsDifferent: 0,
        percentageDifferent: 0,
        threshold: 0.01,
        passed: true,
      };
      const report = engine.generateDiffReport(diff, 'Login Page');
      expect(report).toContain('PASSED');
      expect(report).toContain('Login Page');
    });

    it('should generate failed report', () => {
      const diff: DiffResult = {
        hasDifferences: true,
        pixelsDifferent: 100,
        percentageDifferent: 0.02,
        threshold: 0.01,
        passed: false,
      };
      const report = engine.generateDiffReport(diff, 'Login Page');
      expect(report).toContain('FAILED');
      expect(report).toContain('0.02');
    });

    it('should format percentage in report', () => {
      const diff: DiffResult = {
        hasDifferences: true,
        pixelsDifferent: 50,
        percentageDifferent: 0.005,
        threshold: 0.01,
        passed: true,
      };
      const report = engine.generateDiffReport(diff, 'Dashboard');
      expect(report).toContain('0.50%');
    });
  });

  describe('Performance', () => {
    it('should compare screenshots quickly', () => {
      const start = Date.now();
      engine.compareScreenshots(currentScreenshot, baselineScreenshot);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should handle many baselines', () => {
      for (let i = 0; i < 100; i++) {
        engine.saveBaseline(`page-${i}`, baselineScreenshot, 'chromium');
      }
      const baselines = engine.listBaselines();
      expect(baselines).toHaveLength(100);
    });

    it('should retrieve baseline quickly', () => {
      engine.saveBaseline('test-page', baselineScreenshot, 'chromium');
      const start = Date.now();
      engine.getBaseline('test-page');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10);
    });
  });
});
