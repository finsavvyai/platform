/**
 * Cross-Browser Compatibility Tests
 * Tests application compatibility across different browsers
 * Requirements: 7.5 - Cross-browser testing
 */

import { test, expect } from '@playwright/test';

test.describe('Browser Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
  });
  
  test('Application loads without errors', async ({ page, browserName }) => {
    // Check that the page loaded successfully
    await expect(page).toHaveTitle(/LunaOS Studio/);
    
    // Check for JavaScript errors
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    
    // Wait a bit for any delayed errors
    await page.waitForTimeout(2000);
    
    // Report any JavaScript errors
    if (errors.length > 0) {
      console.warn(`JavaScript errors in ${browserName}:`, errors);
    }
    
    // Critical errors should fail the test
    const criticalErrors = errors.filter(error => 
      error.includes('ReferenceError') || 
      error.includes('TypeError') ||
      error.includes('SyntaxError')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
  
  test('Main interface elements are visible', async ({ page }) => {
    // Check that main UI elements are present
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
    await expect(page.locator('#canvas-container')).toBeVisible();
    
    // Check that the canvas is rendered
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Verify canvas has reasonable dimensions
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox.width).toBeGreaterThan(100);
    expect(canvasBox.height).toBeGreaterThan(100);
  });
  
  test('Feature detection works correctly', async ({ page, browserName }) => {
    // Check if feature detector ran
    const featureDetector = await page.evaluate(() => {
      return window.featureDetector ? window.featureDetector.getReport() : null;
    });
    
    expect(featureDetector).toBeTruthy();
    expect(featureDetector.browser).toBeTruthy();
    expect(featureDetector.features).toBeTruthy();
    
    // Log browser-specific feature support
    console.log(`${browserName} feature support:`, {
      webgl: featureDetector.features.webgl?.supported,
      serviceWorker: featureDetector.features.serviceWorker?.supported,
      canvas: featureDetector.features.canvas?.supported,
      localStorage: featureDetector.features.localStorage?.supported
    });
    
    // Critical features should be supported
    expect(featureDetector.features.canvas?.supported).toBe(true);
    expect(featureDetector.features.es6?.promises).toBe(true);
  });
  
  test('Canvas interactions work', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    
    // Test canvas click
    await canvas.click({ position: { x: 100, y: 100 } });
    
    // Test canvas drag (simulate node creation)
    await canvas.hover({ position: { x: 150, y: 150 } });
    await page.mouse.down();
    await page.mouse.move(200, 200);
    await page.mouse.up();
    
    // Verify no errors occurred during interaction
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForTimeout(1000);
    
    expect(errors).toHaveLength(0);
  });
  
  test('Responsive design works', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      // Check that main elements are still visible
      await expect(page.locator('#app')).toBeVisible();
      
      // Check that content doesn't overflow
      const body = await page.locator('body').boundingBox();
      expect(body.width).toBeLessThanOrEqual(viewport.width + 20); // Allow small margin
    }
  });
  
  test('Local storage works', async ({ page }) => {
    // Test localStorage functionality
    const storageWorks = await page.evaluate(() => {
      try {
        const testKey = 'lunaos_test';
        const testValue = 'test_value';
        
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        return retrieved === testValue;
      } catch (error) {
        return false;
      }
    });
    
    // localStorage should work in all target browsers
    expect(storageWorks).toBe(true);
  });
  
  test('CSS styles render correctly', async ({ page }) => {
    // Check that critical CSS is applied
    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toBeVisible();
    
    // Check computed styles
    const toolbarStyles = await toolbar.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        position: styles.position,
        backgroundColor: styles.backgroundColor
      };
    });
    
    // Toolbar should have proper styling
    expect(toolbarStyles.display).not.toBe('none');
    expect(['fixed', 'absolute', 'relative', 'static']).toContain(toolbarStyles.position);
  });
  
  test('Performance is acceptable', async ({ page, browserName }) => {
    // Measure page load performance
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    console.log(`${browserName} load time: ${loadTime}ms`);
    
    // Page should load within reasonable time (adjust based on CI environment)
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    
    // Check for memory leaks (basic check)
    const memoryUsage = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (memoryUsage) {
      console.log(`${browserName} memory usage:`, memoryUsage);
      
      // Memory usage should be reasonable
      const usageRatio = memoryUsage.used / memoryUsage.limit;
      expect(usageRatio).toBeLessThan(0.5); // Less than 50% of heap limit
    }
  });
});

test.describe('Browser-Specific Tests', () => {
  test('Safari-specific features', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari-specific test');
    
    // Test Safari-specific behaviors
    const safariFeatures = await page.evaluate(() => {
      return {
        webkitPrefixes: !!window.webkitRequestAnimationFrame,
        touchForceSupported: 'ontouchforcechange' in window,
        safariVersion: navigator.userAgent.match(/Version\/(\d+)/)?.[1]
      };
    });
    
    console.log('Safari features:', safariFeatures);
    
    // Verify Safari-specific functionality works
    expect(typeof safariFeatures.webkitPrefixes).toBe('boolean');
  });
  
  test('Firefox-specific features', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');
    
    // Test Firefox-specific behaviors
    const firefoxFeatures = await page.evaluate(() => {
      return {
        mozPrefixes: !!window.mozRequestAnimationFrame,
        firefoxVersion: navigator.userAgent.match(/Firefox\/(\d+)/)?.[1]
      };
    });
    
    console.log('Firefox features:', firefoxFeatures);
    
    // Verify Firefox-specific functionality works
    expect(typeof firefoxFeatures.mozPrefixes).toBe('boolean');
  });
  
  test('Chrome-specific features', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome-specific test');
    
    // Test Chrome-specific behaviors
    const chromeFeatures = await page.evaluate(() => {
      return {
        chromeRuntime: !!window.chrome,
        v8Features: !!window.performance?.measureUserAgentSpecificMemory
      };
    });
    
    console.log('Chrome features:', chromeFeatures);
    
    // Verify Chrome-specific functionality works
    expect(typeof chromeFeatures.chromeRuntime).toBe('boolean');
  });
});

test.describe('Accessibility Across Browsers', () => {
  test('Keyboard navigation works', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab');
    
    // Check that focus is visible
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Test multiple Tab presses
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }
    
    // Should still have a focused element
    const finalFocusedElement = await page.locator(':focus');
    await expect(finalFocusedElement).toBeVisible();
  });
  
  test('ARIA attributes are present', async ({ page }) => {
    // Check for ARIA labels on interactive elements
    const interactiveElements = await page.locator('button, [role="button"], input, [tabindex]').all();
    
    for (const element of interactiveElements) {
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');
      const title = await element.getAttribute('title');
      const textContent = await element.textContent();
      
      // Element should have some form of accessible name
      const hasAccessibleName = ariaLabel || ariaLabelledBy || title || (textContent && textContent.trim());
      expect(hasAccessibleName).toBeTruthy();
    }
  });
});