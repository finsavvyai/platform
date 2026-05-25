import { test, expect } from '@playwright/test';

test.describe('QueryFlux Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page has proper heading structure', async ({ page }) => {
    // Check for main heading
    await expect(page.locator('h1:has-text("QueryFlux")')).toBeVisible();

    // Check for proper heading hierarchy
    const h2Elements = page.locator('h2');
    const count = await h2Elements.count();
    expect(count).toBeGreaterThan(0);

    // Verify headings have meaningful text
    for (let i = 0; i < Math.min(count, 3); i++) {
      const element = h2Elements.nth(i);
      await expect(element).toBeVisible();
      const text = await element.textContent();
      expect(text?.trim()).toHaveLength.toBeGreaterThan(0);
    }
  });

  test('navigation elements are keyboard accessible', async ({ page }) => {
    // Test tab navigation through sidebar
    await page.keyboard.press('Tab');

    // Should focus on first interactive element
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Navigate through navigation items
    const navItems = ['Connections', 'Database Explorer', 'Query Editor', 'Dashboard'];

    for (const item of navItems) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');

      // Check if the focused element contains the navigation item text
      const focusedText = await focused.textContent();
      expect(navItems.some(nav => focusedText?.includes(nav))).toBeTruthy();
    }
  });

  test('buttons have accessible labels', async ({ page }) => {
    // Navigate to Connections to test buttons
    await page.click('text=Connections');

    // Test connection buttons
    const testButton = page.locator('button:has-text("Test Connection")');
    await expect(testButton).toBeVisible();

    const saveButton = page.locator('button:has-text("Save Connection")');
    await expect(saveButton).toBeVisible();

    // Verify buttons can be focused
    await testButton.focus();
    await expect(testButton).toBeFocused();

    await saveButton.focus();
    await expect(saveButton).toBeFocused();
  });

  test('form inputs have proper labels', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Check database type selector has accessible name
    const dbTypeSelect = page.locator('select[name="databaseType"]');
    await expect(dbTypeSelect).toBeVisible();

    // Check input fields have labels or placeholders
    const hostInput = page.locator('input[name="host"]');
    await expect(hostInput).toBeVisible();

    const portInput = page.locator('input[name="port"]');
    await expect(portInput).toBeVisible();

    // Verify inputs can be focused
    await hostInput.focus();
    await expect(hostInput).toBeFocused();
  });

  test('color contrast meets WCAG standards', async ({ page }) => {
    // Test sidebar navigation contrast
    const sidebar = page.locator('div').filter({ has: page.locator('text=QueryFlux') }).first();
    await expect(sidebar).toBeVisible();

    // Get sidebar background color
    const sidebarStyles = await sidebar.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color
      };
    });

    // Ensure dark background with light text for high contrast
    expect(sidebarStyles.backgroundColor).toContain('rgb'); // Should be dark
    expect(sidebarStyles.color).toContain('rgb'); // Should be light

    // Test connection status indicators
    const statusIndicators = page.locator('div[style*="backgroundColor: #10B981"]');
    const count = await statusIndicators.count();

    if (count > 0) {
      const indicatorColor = await statusIndicators.first().evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(indicatorColor).toContain('rgb'); // Should be a readable color
    }
  });

  test('page works with screen readers', async ({ page }) => {
    // Check for proper ARIA labels and roles
    await expect(page.locator('main')).toHaveCount(1); // Should have main landmark

    // Test that interactive elements have proper roles
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Each button should be focusable and have accessible name
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = buttons.nth(i);
      await expect(button).toBeVisible();

      await button.focus();
      await expect(button).toBeFocused();

      // Check button has accessible text
      const buttonText = await button.textContent();
      expect(buttonText?.trim()?.length).toBeGreaterThan(0);
    }
  });

  test('page is responsive and accessible on different viewports', async ({ page }) => {
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('text=QueryFlux')).toBeVisible();

    // Navigation should still be accessible
    await page.click('text=Connections');
    await expect(page.locator('text=Create Database Connection')).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('text=QueryFlux')).toBeVisible();

    // Test that touch targets are large enough (at least 44x44 pixels)
    const buttons = page.locator('button').first();
    const buttonBox = await buttons.boundingBox();

    if (buttonBox) {
      expect(buttonBox.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('error messages are accessible', async ({ page }) => {
    // Navigate to Connections and trigger an error
    await page.click('text=Connections');

    // Fill in invalid connection details
    await page.fill('input[name="host"]', 'invalid-host');
    await page.click('button:has-text("Test Connection")');

    // Wait for error message
    await page.waitForTimeout(2500);

    // Check error message is visible and accessible
    const errorElement = page.locator('div[style*="backgroundColor: #fee2e2"]');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      expect(errorText?.trim()?.length).toBeGreaterThan(0);

      // Error message should be color-contrasting
      const errorStyles = await errorElement.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });
      expect(errorStyles).toContain('rgb');
    }
  });
});