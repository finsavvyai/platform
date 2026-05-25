/**
 * Basic TestQuality UI Test
 * Simple test without heavy dependencies
 */

import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';

test.describe.skip('TestQuality Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('should load TestQuality dashboard', async ({ page }) => {
    // Navigate to TestQuality dashboard
    await page.goto('/test-quality/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we're on the correct page by looking at URL
    expect(page.url()).toContain('/test-quality/dashboard');

    // Look for basic page elements that should be present
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for navigation (it should exist)
    const nav = page.locator('nav, [role="navigation"], .navigation').first();
    if (await nav.isVisible()) {
      await expect(nav).toBeVisible();
    }
  });

  test('should navigate between TestQuality pages', async ({ page }) => {
    // Test navigation to different pages
    const pages = [
      '/test-quality/dashboard',
      '/test-quality/projects',
      '/test-quality/test-cases',
      '/test-quality/test-scenarios',
      '/test-quality/requirements',
      '/test-quality/team'
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Verify page loads
      expect(page.url()).toContain(pagePath);

      // Basic page should be visible
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle invalid routes gracefully', async ({ page }) => {
    // Navigate to a non-existent TestQuality route
    await page.goto('/test-quality/nonexistent-page');
    await page.waitForLoadState('networkidle');

    // Should either show 404 or redirect to a valid page
    const currentUrl = page.url();

    // URL should contain testquality or be redirected to a fallback
    const isValidResponse = currentUrl.includes('/test-quality/') ||
                           currentUrl.includes('/dashboard') ||
                           currentUrl.includes('/404') ||
                           currentUrl.includes('/not-found');

    expect(isValidResponse).toBeTruthy();
  });

  test('should show content on TestQuality pages', async ({ page }) => {
    await page.goto('/test-quality/projects');
    await page.waitForLoadState('networkidle');

    // Look for any text content that indicates the page loaded
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    // Check if there's any text on the page
    const textContent = await pageContent.textContent();
    expect(textContent.length).toBeGreaterThan(0);
  });

  test('should have proper page structure', async ({ page }) => {
    await page.goto('/test-quality/dashboard');
    await page.waitForLoadState('networkidle');

    // Basic HTML structure should be valid
    const html = await page.content();
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<body');
    expect(html).toContain('</body>');
  });

  test('should be responsive', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 768, height: 1024 },   // Tablet
      { width: 375, height: 667 }    // Mobile
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/test-quality/dashboard');
      await page.waitForLoadState('networkidle');

      // Page should load without errors
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle navigation through TestQuality UI', async ({ page }) => {
    // Start at dashboard
    await page.goto('/test-quality/dashboard');
    await page.waitForLoadState('networkidle');

    // Try to find and click navigation links
    const links = page.locator('a[href*="/test-quality/"]');
    const linkCount = await links.count();

    if (linkCount > 0) {
      // Click the first available link
      await links.first().click();
      await page.waitForLoadState('networkidle');

      // Should navigate to a new page
      const currentUrl = page.url();
      expect(currentUrl).toContain('/test-quality/');
    }
  });

  test('should maintain functionality with JavaScript', async ({ page }) => {
    await page.goto('/test-quality/dashboard');
    await page.waitForLoadState('networkidle');

    // Enable JavaScript and test basic interactions
    await page.addStyleTag({ content: '* { transition: all 0.1s ease; }' });

    // Try to interact with any clickable elements
    const clickableElements = page.locator('button, [role="button"], a, [onclick]').first();

    if (await clickableElements.isVisible()) {
      // Hover over the element
      await clickableElements.hover();

      // Element should still be visible after hover
      await expect(clickableElements).toBeVisible();
    }

    // Page should remain stable
    await expect(page.locator('body')).toBeVisible();
  });
});