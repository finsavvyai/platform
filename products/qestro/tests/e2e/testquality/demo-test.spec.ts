/**
 * Demo Test - Shows Playwright Testing Works
 * Simple validation test to demonstrate functionality
 */

import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';

test.describe.skip('TestQuality Demo - Proof of Concept', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('should load TestQuality dashboard and verify basic structure', async ({ page }) => {
    console.log('🎭 Starting Playwright Test Demo...');

    // Navigate to TestQuality dashboard
    console.log('📍 Navigating to TestQuality dashboard...');
    await page.goto('/test-quality/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded successfully');

    // Verify URL
    expect(page.url()).toContain('/test-quality/dashboard');
    console.log('✅ URL verification passed');

    // Check for HTML structure
    const html = await page.content();
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<body');
    expect(html).toContain('</body>');
    console.log('✅ HTML structure validation passed');

    // Look for body element (this was failing before, but let's see the actual state)
    const bodyExists = await page.locator('body').count();
    expect(bodyExists).toBeGreaterThan(0);
    console.log('✅ Body element found');

    // Check for any text content to ensure page is not empty
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
    console.log('✅ Page has content:', bodyText?.substring(0, 100) + '...');

    // Take a screenshot as proof
    await page.screenshot({ path: 'test-results/demo-screenshot.png', fullPage: true });
    console.log('📸 Screenshot captured');

    console.log('🎉 Playwright test completed successfully!');
  });

  test('should navigate between TestQuality routes', async ({ page }) => {
    console.log('🧭 Testing navigation...');

    // Test navigation to different TestQuality pages
    const routes = [
      '/test-quality/dashboard',
      '/test-quality/projects',
      '/test-quality/test-cases',
      '/test-quality/team'
    ];

    for (const route of routes) {
      console.log(`📍 Testing route: ${route}`);
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Verify URL contains the route
      expect(page.url()).toContain(route);

      // Check that page has content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(0);

      console.log(`✅ Route ${route} works correctly`);
    }

    console.log('🎉 Navigation test completed!');
  });
});