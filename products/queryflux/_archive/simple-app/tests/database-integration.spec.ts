import { test, expect } from '@playwright/test';

test.describe('QueryFlux Database Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('PostgreSQL connection test workflow', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Select PostgreSQL
    await page.selectOption('select[name="databaseType"]', 'postgresql');

    // Fill in PostgreSQL connection details (from our test containers)
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '5435');
    await page.fill('input[name="database"]', 'queryflux_test');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Wait for simulated response
    await page.waitForTimeout(2500);

    // Verify success message
    await expect(page.locator('text=Connection successful!')).toBeVisible();

    // Verify database-specific tip is shown
    await expect(page.locator('text=Our test PostgreSQL container is running on port 5435')).toBeVisible();
  });

  test('MySQL connection test workflow', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Select MySQL
    await page.selectOption('select[name="databaseType"]', 'mysql');

    // Fill in MySQL connection details (from our test containers)
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '3309');
    await page.fill('input[name="database"]', 'queryflux_test');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Wait for simulated response
    await page.waitForTimeout(2500);

    // Verify success message
    await expect(page.locator('text=Connection successful!')).toBeVisible();

    // Verify database-specific tip is shown
    await expect(page.locator('text=Our test MySQL container is running on port 3309')).toBeVisible();
  });

  test('MongoDB connection test workflow', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Select MongoDB
    await page.selectOption('select[name="databaseType"]', 'mongodb');

    // Fill in MongoDB connection details (from our test containers)
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '27019');
    await page.fill('input[name="database"]', 'queryflux_test');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Wait for simulated response
    await page.waitForTimeout(2500);

    // Verify success message
    await expect(page.locator('text=Connection successful!')).toBeVisible();
  });

  test('Redis connection test workflow', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Select Redis
    await page.selectOption('select[name="databaseType"]', 'redis');

    // Verify Redis-specific form behavior
    await expect(page.locator('input[placeholder="Not required for Redis"]')).toHaveCount(2);
    await expect(page.locator('input[name="database"]')).toBeDisabled();
    await expect(page.locator('input[name="username"]')).toBeDisabled();
    await expect(page.locator('input[name="password"]')).toBeDisabled();

    // Fill in Redis connection details (from our test containers)
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '6382');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Wait for simulated response
    await page.waitForTimeout(2500);

    // Verify success message
    await expect(page.locator('text=Connection successful!')).toBeVisible();
  });

  test('invalid connection handling', async ({ page }) => {
    // Navigate to Connections
    await page.click('text=Connections');

    // Select PostgreSQL
    await page.selectOption('select[name="databaseType"]', 'postgresql');

    // Fill in invalid connection details
    await page.fill('input[name="host"]', 'wronghost');
    await page.fill('input[name="port"]', '9999');
    await page.fill('input[name="database"]', 'wrongdb');
    await page.fill('input[name="username"]', 'wronguser');
    await page.fill('input[name="password"]', 'wrongpass');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Wait for simulated response
    await page.waitForTimeout(2500);

    // Verify error message
    await expect(page.locator('text=Connection failed: Check your database configuration')).toBeVisible();
  });

  test('database schema explorer integration', async ({ page }) => {
    // Navigate to Database Explorer
    await page.click('text=Database Explorer');

    // Verify all test databases are displayed
    await expect(page.locator('text=PostgreSQL (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:5435 • queryflux_test')).toBeVisible();

    // Verify MySQL database details
    await expect(page.locator('text=MySQL (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:3309 • queryflux_test')).toBeVisible();

    // Verify MongoDB database details
    await expect(page.locator('text=MongoDB (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:27019 • queryflux_test')).toBeVisible();

    // Verify Redis database details
    await expect(page.locator('text=Redis (Test)')).toBeVisible();
    await expect(page.locator('text=localhost:6382')).toBeVisible();

    // Verify database status indicators (green dots)
    const statusIndicators = page.locator('div[style*="backgroundColor: #10B981"]');
    await expect(statusIndicators).toHaveCount(4); // 4 databases

    // Verify tables/collections are displayed
    await expect(page.locator('text=users')).toBeVisible();
    await expect(page.locator('text=connections')).toBeVisible();
    await expect(page.locator('text=Queries: 2 documents')).toBeVisible();
  });

  test('query editor with no database connection', async ({ page }) => {
    // Navigate to Query Editor
    await page.click('text=Query Editor');

    // Verify empty state is displayed
    await expect(page.locator('text=No active database connection')).toBeVisible();

    // Verify create connection button is present
    await expect(page.locator('button:has-text("Create Connection")')).toBeVisible();

    // Clicking create connection should navigate to connections tab
    await page.click('button:has-text("Create Connection")');
    await expect(page.locator('text=Create Database Connection')).toBeVisible();
  });
});