/**
 * E2E Test: Test Cases Page - Modern UI
 * Tests rendering, DataTable columns, row interaction,
 * and action buttons on the /cases page.
 */

import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';

const mockTestCases = {
  success: true,
  data: [
    {
      id: 'TC-1',
      name: 'Verify login with valid credentials',
      type: 'Functional',
      description: 'Tests that a user can log in with correct email and password.',
      testData: { status: 'Active', priority: 'High', jiraIssue: 'QA-101' },
      expectedResults: ['User is redirected to dashboard', 'Session token is set'],
    },
    {
      id: 'TC-2',
      name: 'Verify password reset flow',
      type: 'Functional',
      description: 'Tests the password reset email and token flow.',
      testData: { status: 'Active', priority: 'Medium', jiraIssue: null },
      expectedResults: ['Reset email is sent'],
    },
  ],
};

function setupMocks(page: import('@playwright/test').Page) {
  return page.route('**/api/test-cases**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTestCases),
    });
  });
}

test.describe('Test Cases Page - Modern UI', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await setupMocks(page);
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
  });

  test('should render page with dark theme', async ({ page }) => {
    // The outer container uses bg-[#1a1f37] p-8 when data is loaded
    const container = page.locator('.bg-\\[\\#1a1f37\\]').first();
    await expect(container).toBeVisible();

    // DataTable wrapper has backdrop-blur-md class
    const tableContainer = page.locator('.backdrop-blur-md');
    await expect(tableContainer.first()).toBeVisible();
  });

  test('should render DataTable with correct columns', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Column headers inside <th> elements
    await expect(table.locator('th', { hasText: 'ID' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Title' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Jira' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Status' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Priority' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Type' })).toBeVisible();
  });

  test('should render test case data', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check that mock data appears in table body
    await expect(table.locator('tbody')).toContainText('TC-1');
    await expect(table.locator('tbody')).toContainText('Verify login with valid credentials');
    await expect(table.locator('tbody')).toContainText('QA-101');
    await expect(table.locator('tbody')).toContainText('Active');
    await expect(table.locator('tbody')).toContainText('High');
  });

  test('should open details panel on row click', async ({ page }) => {
    // Click the first data row
    const firstRow = page.locator('[data-testid="datatable-row-0"]');
    await firstRow.click();

    // Detail panel slides in from the right
    const detailsPanel = page.locator('.fixed.right-0');
    await expect(detailsPanel).toBeVisible();
    await expect(detailsPanel).toContainText('Verify login with valid credentials');
  });

  test('should have Filter and New Test Case buttons', async ({ page }) => {
    // Buttons rendered by the Button component
    await expect(
      page.getByRole('button', { name: /Filter/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /New Test Case/i })
    ).toBeVisible();
  });

  test('should have Generate with AI button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Generate with AI/i })
    ).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search test cases..."]');
    await expect(searchInput).toBeVisible();
  });
});
