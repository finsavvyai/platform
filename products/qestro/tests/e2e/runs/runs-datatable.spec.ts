/**
 * E2E Test: Runs Page - DataTable Verification
 * Tests that the Runs page renders a DataTable with correct columns,
 * displays run data, and handles row selection.
 */

import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';

const mockRuns = {
  success: true,
  data: [
    {
      id: 'RUN-1',
      name: 'Sprint 2025.12 - Day 1',
      status: 'running',
      totalTests: 10,
      passedTests: 6,
      failedTests: 1,
      skippedTests: 0,
      startTime: Date.now() - 60000,
      createdAt: Date.now() - 120000,
    },
    {
      id: 'RUN-2',
      name: 'Payment Gateway Integration',
      status: 'passed',
      totalTests: 8,
      passedTests: 8,
      failedTests: 0,
      skippedTests: 0,
      startTime: Date.now() - 300000,
      createdAt: Date.now() - 360000,
    },
  ],
};

function setupMocks(page: import('@playwright/test').Page) {
  return page.route('**/api/automation-runs**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockRuns),
    });
  });
}

test.describe('Runs Page - DataTable Verification', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await setupMocks(page);
    await page.goto('/runs');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
  });

  test('should render DataTable with correct columns', async ({ page }) => {
    // The DataTable is inside the left panel Card
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Column headers rendered inside <th> elements
    await expect(table.locator('th', { hasText: 'Run Name' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Status' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Progress' })).toBeVisible();
  });

  test('should render run data correctly', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check run names appear in the table body
    await expect(table.locator('tbody')).toContainText('Sprint 2025.12 - Day 1');
    await expect(table.locator('tbody')).toContainText('Payment Gateway Integration');

    // Check status badges render
    await expect(table.locator('tbody')).toContainText('Running');
    await expect(table.locator('tbody')).toContainText('Passed');
  });

  test('should set first run as active by default', async ({ page }) => {
    // The right panel header shows the active run name
    const header = page.locator('h2');
    await expect(header.filter({ hasText: 'Sprint 2025.12 - Day 1' })).toBeVisible();
  });

  test('should update active run on row click', async ({ page }) => {
    // Click second row (index 1) via the data-testid
    const secondRow = page.locator('[data-testid="datatable-row-1"]');
    await secondRow.click();

    // The right-panel h2 should update to the second run name
    const header = page.locator('h2');
    await expect(
      header.filter({ hasText: 'Payment Gateway Integration' })
    ).toBeVisible();
  });

  test('should show live execution log panel', async ({ page }) => {
    // The console panel header
    await expect(page.getByText('LIVE EXECUTION LOG')).toBeVisible();
  });
});
