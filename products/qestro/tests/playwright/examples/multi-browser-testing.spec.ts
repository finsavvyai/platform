/**
 * Multi-Browser Testing Suite
 * Tests that verify functionality across different browsers and devices
 */

import { test, expect, devices } from '@playwright/test';
import { test as advancedTest } from '../fixtures/advancedTestFixtures';
import { AdvancedTestHelpers } from '../fixtures/advancedTestFixtures';

// Test across multiple browsers
test.describe('Cross-browser testing', () => {

  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    
    // Verify successful login
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('[data-testid=user-menu]')).toBeVisible();
  });

  test('should handle form validation', async ({ page }) => {
    await page.goto('/contact');
    
    // Submit empty form
    await page.click('[data-testid=submit-button]');
    
    // Check validation messages
    await expect(page.locator('[data-testid=email-error]')).toBeVisible();
    await expect(page.locator('[data-testid=message-error]')).toBeVisible();
    
    // Fill form correctly
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=message]', 'Test message');
    await page.click('[data-testid=submit-button]');
    
    // Verify success
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    
    await expect(page.locator('[data-testid=sidebar]')).toBeVisible();
    await expect(page.locator('[data-testid=main-content]')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    
    // Sidebar might be collapsed on tablet
    const sidebar = page.locator('[data-testid=sidebar]');
    const mobileMenu = page.locator('[data-testid=mobile-menu-button]');
    
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(sidebar).toBeVisible();
    }
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    await expect(page.locator('[data-testid=mobile-menu-button]')).toBeVisible();
  });
});

// Device-specific testing
test.describe('Mobile testing', () => {
  test('should work on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Test touch interactions
    await page.tap('[data-testid=menu-button]');
    await expect(page.locator('[data-testid=mobile-menu]')).toBeVisible();
  });

  test('should handle orientation changes', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid=main-content]')).toBeVisible();
    
    // Switch to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.reload();
    await expect(page.locator('[data-testid=main-content]')).toBeVisible();
  });
});

// Performance testing across browsers
advancedTest.describe('Performance Testing', () => {
  advancedTest('should meet performance thresholds', async ({ 
    page, 
    performanceMonitor 
  }) => {
    // Navigate to page
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Measure performance
    const metrics = await performanceMonitor.getMetrics();
    
    // Assert performance thresholds
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // 2 seconds
    expect(metrics.domContentLoaded).toBeLessThan(3000); // 3 seconds
    expect(metrics.loadComplete).toBeLessThan(5000); // 5 seconds
    
    console.log('Performance Metrics:', metrics);
  });
});

// Accessibility testing
advancedTest.describe('Accessibility Testing', () => {
  advancedTest('should pass accessibility checks', async ({ 
    page,
    automationUtils 
  }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Run accessibility check
    const report = await automationUtils.runAccessibilityCheck();
    
    // Assert no critical violations
    const criticalViolations = report.violations.filter(v => v.impact === 'critical');
    expect(criticalViolations.length).toBe(0);
    
    // Log violations for review
    if (report.violations.length > 0) {
      console.log('Accessibility Violations:', report.violations);
    }
  });
});

// Network condition testing
advancedTest.describe('Network Condition Testing', () => {
  const networkConditions = ['slow3g', 'fast3g'] as const;
  
  networkConditions.forEach(condition => {
    advancedTest(`should work under ${condition} conditions`, async ({ page }) => {
      // Set network conditions
      await AdvancedTestHelpers.simulateNetworkConditions(page, condition);
      
      const startTime = Date.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Verify page loaded (with appropriate timeout for slow networks)
      await expect(page.locator('[data-testid=main-content]')).toBeVisible();
      
      // Log load time for analysis
      console.log(`Load time under ${condition}: ${loadTime}ms`);
      
      // Set reasonable expectations based on network condition
      if (condition === 'slow3g') {
        expect(loadTime).toBeLessThan(15000); // 15 seconds for slow 3G
      } else {
        expect(loadTime).toBeLessThan(8000); // 8 seconds for fast 3G
      }
    });
  });
});

// Browser-specific feature testing
test.describe('Browser-specific Features', () => {
  test('should handle file uploads in Chrome', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome-specific test');
    
    await page.goto('/upload');
    
    // Create a test file
    const fileContent = 'Test file content';
    const fileName = 'test-file.txt';
    
    // Upload file
    await page.setInputFiles('[data-testid=file-input]', {
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent)
    });
    
    await page.click('[data-testid=upload-button]');
    
    // Verify upload success
    await expect(page.locator('[data-testid=upload-success]')).toBeVisible();
  });

  test('should handle geolocation in Firefox', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');
    
    // Grant geolocation permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 37.7749, longitude: -122.4194 });
    
    await page.goto('/location');
    await page.click('[data-testid=get-location]');
    
    // Verify location was obtained
    await expect(page.locator('[data-testid=location-display]')).toContainText('37.7749');
  });

  test('should handle notifications in Safari', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'webkit', 'Safari-specific test');
    
    // Grant notification permission
    await context.grantPermissions(['notifications']);
    
    await page.goto('/notifications');
    await page.click('[data-testid=enable-notifications]');
    
    // Verify notification permission was granted
    const permissionStatus = await page.evaluate(() => Notification.permission);
    expect(permissionStatus).toBe('granted');
  });
});

// Cross-browser data persistence testing
advancedTest.describe('Data Persistence Across Browsers', () => {
  advancedTest('should maintain session across browser restarts', async ({ 
    browser,
    testDataManager 
  }) => {
    // Create a test user
    const user = await testDataManager.createTestUser();
    
    // First browser session
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    await page1.goto('/login');
    await page1.fill('[data-testid=email]', user.email);
    await page1.fill('[data-testid=password]', user.password);
    await page1.click('[data-testid=login-button]');
    
    // Verify login and save storage state
    await expect(page1).toHaveURL(/.*dashboard/);
    const storageState = await context1.storageState();
    
    await context1.close();
    
    // Second browser session with saved state
    const context2 = await browser.newContext({ storageState });
    const page2 = await context2.newPage();
    
    await page2.goto('/dashboard');
    
    // Verify user is still logged in
    await expect(page2.locator('[data-testid=user-menu]')).toBeVisible();
    
    await context2.close();
  });
});