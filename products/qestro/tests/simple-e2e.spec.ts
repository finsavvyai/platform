import { test, expect } from '@playwright/test';

test.describe('Basic Functionality Test', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Basic smoke test - just check the page loads
    await expect(page).toHaveTitle(/Questro/i);
  });

  test('should render main navigation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check for common navigation elements
    const navigation = page.locator('nav, header, [role="navigation"]');
    await expect(navigation.first()).toBeVisible();
  });
});