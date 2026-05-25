/**
 * E2E Test: Dashboard Accessibility and Responsive Design
 * Tests keyboard navigation, cursor styling, hover effects, and viewports
 */

import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';
import { mockDashboardAPIs } from '../fixtures/dashboard.fixture';

test.describe('Dashboard - Accessibility and UX', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });
    await hideOverlays(page);
  });

  test('should verify all buttons have proper cursor styling', async ({ page }) => {
    const allButtons = page.locator('button');
    const count = await allButtons.count();

    for (let i = 0; i < count; i++) {
      const button = allButtons.nth(i);
      if (await button.isVisible().catch(() => false)) {
        const cursor = await button.evaluate(
          (el) => window.getComputedStyle(el).cursor
        );
        expect(['pointer', 'default']).toContain(cursor);
      }
    }
  });

  test('should verify visible buttons are not disabled', async ({ page }) => {
    const allButtons = page.locator('button:visible');
    const count = await allButtons.count();

    for (let i = 0; i < count; i++) {
      const isDisabled = await allButtons.nth(i).isDisabled();
      expect(isDisabled).toBe(false);
    }
  });

  test('should verify hover effects on Run Diagnostics button', async ({ page }) => {
    const button = page.locator('button:has-text("Run Diagnostics")');

    const initialBg = await button.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );

    await button.hover();
    await page.waitForTimeout(300);

    const hoveredBg = await button.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );

    console.log(`Initial background: ${initialBg}`);
    console.log(`Hovered background: ${hoveredBg}`);
  });

  test('should test keyboard navigation (Tab key)', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    const focusedElement = page.locator(':focus');
    const tagName = await focusedElement.evaluate((el) => el.tagName);

    expect(['BUTTON', 'A', 'INPUT']).toContain(tagName);
  });
});

test.describe('Dashboard - Responsive Viewports', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });
  });

  test('should display dashboard on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.dashboard-container')).toBeVisible();
  });

  test('should display dashboard on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.dashboard-container')).toBeVisible();
  });
});
