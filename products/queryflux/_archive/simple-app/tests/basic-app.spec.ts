import { test, expect } from '@playwright/test';

test.describe('QueryFlux Basic App Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for the app to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('app loads and displays main components', async ({ page }) => {
    // Check that the main app container is visible
    await expect(page.locator('div').filter({ hasText: 'QueryFlux' }).first()).toBeVisible();

    // Check sidebar is present
    await expect(page.locator('text=Connections')).toBeVisible();
    await expect(page.locator('text=Database Explorer')).toBeVisible();
    await expect(page.locator('text=Query Editor')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('navigation works correctly', async ({ page }) => {
    // Test Connections tab
    await page.click('text=Connections');
    await expect(page.locator('text=Create Database Connection')).toBeVisible();
    await expect(page.locator('select[name="databaseType"]')).toBeVisible();

    // Test Database Explorer tab
    await page.click('text=Database Explorer');
    await expect(page.locator('text=Database Schema Explorer')).toBeVisible();

    // Test Query Editor tab
    await page.click('text=Query Editor');
    await expect(page.locator('text=No active database connection')).toBeVisible();

    // Test Dashboard tab
    await page.click('text=Dashboard');
    await expect(page.locator('text=Monitoring Dashboard')).toBeVisible();
    await expect(page.locator('text=Active Connections')).toBeVisible();
  });

  test('database connection form is functional', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Test database type selection
    const dbTypeSelect = page.locator('select[name="databaseType"]');
    await expect(dbTypeSelect).toBeVisible();

    // Test each database type
    const databaseTypes = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis'];
    for (const dbType of databaseTypes) {
      await dbTypeSelect.selectOption(dbType.toLowerCase());

      // Verify form updates based on database type
      if (dbType === 'Redis') {
        await expect(page.locator('input[placeholder="Not required for Redis"]')).toHaveCount(2);
      } else {
        await expect(page.locator('input[name="database"]')).toBeVisible();
        await expect(page.locator('input[name="username"]')).toBeVisible();
      }
    }

    // Test connection form with PostgreSQL
    await dbTypeSelect.selectOption('postgresql');

    // Fill in the form
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '5435');
    await page.fill('input[name="database"]', 'queryflux_test');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');

    // Test connection button
    const testButton = page.locator('button:has-text("Test Connection")');
    await expect(testButton).toBeVisible();
    await testButton.click();

    // Wait for response (simulated)
    await page.waitForTimeout(2500);

    // Check for success message
    await expect(page.locator('text=Connection successful!')).toBeVisible();
  });

  test('database explorer displays test databases', async ({ page }) => {
    // Navigate to Database Explorer
    await page.click('text=Database Explorer');

    // Check that test databases are displayed
    await expect(page.locator('text=PostgreSQL (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:5435 • queryflux_test')).toBeVisible();

    await expect(page.locator('text=MySQL (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:3309 • queryflux_test')).toBeVisible();

    await expect(page.locator('text=MongoDB (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:27019 • queryflux_test')).toBeVisible();

    await expect(page.locator('text=Redis (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:6382')).toBeVisible();
  });

  test('dashboard displays monitoring metrics', async ({ page }) => {
    // Navigate to Dashboard
    await page.click('text=Dashboard');

    // Check dashboard elements
    await expect(page.locator('text=Monitoring Dashboard')).toBeVisible();
    await expect(page.locator('text=Active Connections')).toBeVisible();
    await expect(page.locator('text=Queries Executed')).toBeVisible();
    await expect(page.locator('text=Response Time')).toBeVisible();

    // Check metric values
    await expect(page.locator('text=0').nth(0)).toBeVisible(); // Active connections
    await expect(page.locator('text=0').nth(1)).toBeVisible(); // Queries executed
  });

  test('app is responsive on mobile devices', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that sidebar collapses or adapts
    await expect(page.locator('text=QueryFlux')).toBeVisible();

    // Test that main content is still accessible
    await page.click('text=Connections');
    await expect(page.locator('text=Create Database Connection')).toBeVisible();
  });
});