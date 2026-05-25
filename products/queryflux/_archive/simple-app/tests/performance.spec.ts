import { test, expect } from '@playwright/test';

test.describe('QueryFlux Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page load performance metrics', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
        loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
        firstPaint: 0, // Would need PerformanceObserver
        firstContentfulPaint: 0, // Would need PerformanceObserver
      };
    });

    // Performance assertions (relaxed for development environment)
    expect(performanceMetrics.domContentLoaded).toBeLessThan(3000); // 3 seconds
    expect(performanceMetrics.loadComplete).toBeLessThan(5000); // 5 seconds
  });

  test('navigation performance between tabs', async ({ page }) => {
    const navigationTimes: number[] = [];

    // Test navigation to each main tab
    const tabs = ['Connections', 'Database Explorer', 'Query Editor', 'Dashboard'];

    for (const tab of tabs) {
      const startTime = Date.now();

      await page.click(`text=${tab}`);
      await page.waitForLoadState('networkidle');

      const navigationTime = Date.now() - startTime;
      navigationTimes.push(navigationTime);

      // Verify tab content loaded
      if (tab === 'Connections') {
        await expect(page.locator('text=Create Database Connection')).toBeVisible();
      } else if (tab === 'Database Explorer') {
        await expect(page.locator('text=Database Schema Explorer')).toBeVisible();
      } else if (tab === 'Query Editor') {
        await expect(page.locator('text=No active database connection')).toBeVisible();
      } else if (tab === 'Dashboard') {
        await expect(page.locator('text=Monitoring Dashboard')).toBeVisible();
      }
    }

    // Calculate average navigation time
    const avgNavigationTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
    console.log(`Average navigation time: ${avgNavigationTime}ms`);

    // Performance assertions
    expect(avgNavigationTime).toBeLessThan(1000); // 1 second average

    // No single navigation should take more than 2 seconds
    navigationTimes.forEach(time => {
      expect(time).toBeLessThan(2000);
    });
  });

  test('form interaction performance', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Time form filling performance
    const startTime = Date.now();

    // Fill out the PostgreSQL form
    await page.selectOption('select[name="databaseType"]', 'postgresql');
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '5435');
    await page.fill('input[name="database"]', 'queryflux_test');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');

    const formFillTime = Date.now() - startTime;
    console.log(`Form fill time: ${formFillTime}ms`);

    // Form should be fillable quickly
    expect(formFillTime).toBeLessThan(1000);

    // Test button click responsiveness
    const buttonClickStart = Date.now();
    await page.click('button:has-text("Test Connection")');
    const buttonClickTime = Date.now() - buttonClickStart;

    expect(buttonClickTime).toBeLessThan(500); // Button should respond quickly
  });

  test('database type switching performance', async ({ page }) => {
    await page.click('text=Connections');

    const dbTypeSelect = page.locator('select[name="databaseType"]');
    const switchTimes: number[] = [];

    const databaseTypes = ['postgresql', 'mysql', 'mongodb', 'redis'];

    for (const dbType of databaseTypes) {
      const startTime = Date.now();

      await dbTypeSelect.selectOption(dbType);
      await page.waitForTimeout(100); // Small wait for form to update

      const switchTime = Date.now() - startTime;
      switchTimes.push(switchTime);
    }

    const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
    console.log(`Average database type switch time: ${avgSwitchTime}ms`);

    // Database type switching should be fast
    expect(avgSwitchTime).toBeLessThan(200);
  });

  test('memory usage stability', async ({ page }) => {
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Perform multiple navigation cycles
    for (let i = 0; i < 5; i++) {
      await page.click('text=Connections');
      await page.waitForLoadState('networkidle');

      await page.click('text=Database Explorer');
      await page.waitForLoadState('networkidle');

      await page.click('text=Query Editor');
      await page.waitForLoadState('networkidle');

      await page.click('text=Dashboard');
      await page.waitForLoadState('networkidle');
    }

    // Check final memory usage
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

      console.log(`Memory increase: ${memoryIncreasePercent.toFixed(2)}%`);

      // Memory usage should not increase excessively
      expect(memoryIncreasePercent).toBeLessThan(50); // Less than 50% increase
    }
  });

  test('large content rendering performance', async ({ page }) => {
    // Navigate to Database Explorer (which has the most content)
    await page.click('text=Database Explorer');
    await page.waitForLoadState('networkidle');

    const renderStartTime = Date.now();

    // Wait for all content to be visible
    await expect(page.locator('text=PostgreSQL (Test)')).toBeVisible();
    await expect(page.locator('text=MySQL (Test)')).toBeVisible();
    await expect(page.locator('text=MongoDB (Test)')).toBeVisible();
    await expect(page.locator('text=Redis (Test)')).toBeVisible();

    const renderTime = Date.now() - renderStartTime;
    console.log(`Content render time: ${renderTime}ms`);

    // Content should render quickly
    expect(renderTime).toBeLessThan(1000);
  });

  test('search and filter performance (if implemented)', async ({ page }) => {
    // This test is for future implementation
    // Currently tests that the page doesn't break when searching
    await page.click('text=Database Explorer');

    // Type some text to test any potential search functionality
    const startTime = Date.now();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.type('users');

    const typingTime = Date.now() - startTime;
    console.log(`Search typing time: ${typingTime}ms`);

    // Typing should be responsive
    expect(typingTime).toBeLessThan(500);
  });

  test('concurrent user simulation', async ({ page }) => {
    // Simulate rapid tab switching
    const rapidSwitchTimes: number[] = [];

    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();

      // Rapid navigation
      await page.click('text=Connections');
      await page.click('text=Database Explorer');
      await page.click('text=Query Editor');
      await page.click('text=Dashboard');

      const switchTime = Date.now() - startTime;
      rapidSwitchTimes.push(switchTime);
    }

    const avgRapidSwitchTime = rapidSwitchTimes.reduce((a, b) => a + b, 0) / rapidSwitchTimes.length;
    console.log(`Average rapid switch time: ${avgRapidSwitchTime}ms`);

    // Even rapid switching should be reasonably fast
    expect(avgRapidSwitchTime).toBeLessThan(2000);
  });
});