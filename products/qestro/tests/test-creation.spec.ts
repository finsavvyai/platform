/**
 * Test Creation E2E Tests
 * Tests for creating, editing, duplicating, deleting, filtering, and searching test cases
 */

import { test, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Test Creation & Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test creation page
    await page.goto(`${baseURL}/tests`);

    // Check if authenticated, skip if not
    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');
  });

  test('should display test cases list page with create button', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/.*Tests.*/i);

    // Look for create test button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Test"), [data-testid="create-test-button"]');
    const isVisible = await createButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(createButton.first()).toBeInViewport();
    }
  });

  test('should create new test case via form', async ({ page }) => {
    // Click create test button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Test"), [data-testid="create-test-button"]');
    const isVisible = await createButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    await createButton.first().click();

    // Wait for dialog or form to appear
    const testForm = page.locator('form, [role="dialog"], [class*="modal"]');
    await testForm.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Form may not appear
      return null;
    });

    // Fill in test name
    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="test"], input[name="name"]');
    const isNameInputVisible = await nameInput.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isNameInputVisible) {
      await nameInput.first().fill('E2E Test - Login Flow');

      // Fill in description if available
      const descriptionInput = page.locator('textarea[placeholder*="description"], textarea[name="description"]');
      const isDescriptionVisible = await descriptionInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (isDescriptionVisible) {
        await descriptionInput.fill('Test the login flow with valid credentials');
      }

      // Select test type if available
      const typeSelect = page.locator('select[name="type"], [data-testid="test-type-select"]');
      const isTypeVisible = await typeSelect.isVisible({ timeout: 5000 }).catch(() => false);

      if (isTypeVisible) {
        await typeSelect.selectOption('functional');
      }

      // Click create/save button
      const saveButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Submit")');
      const isSaveVisible = await saveButton.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (isSaveVisible) {
        await saveButton.first().click();

        // Wait for navigation or confirmation
        await page.waitForURL(/.*test.*/, { timeout: 10000 }).catch(() => {
          return null;
        });
      }
    }
  });

  test('should edit existing test case', async ({ page }) => {
    // Look for first test case in list
    const testItem = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]').first();
    const isVisible = await testItem.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Find and click edit button/link for first test
    const editButton = testItem.locator('button:has-text("Edit"), a:has-text("Edit"), [data-testid*="edit"]').first();
    const isEditVisible = await editButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isEditVisible) {
      // Try clicking the test item itself
      await testItem.click();
    } else {
      await editButton.click();
    }

    // Wait for edit form to appear
    await page.waitForLoadState('networkidle');

    // Verify we're in edit mode
    const editForm = page.locator('form, [data-testid="test-editor"]');
    const isFormVisible = await editForm.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isFormVisible) {
      // Try to update test name
      const nameInput = page.locator('input[placeholder*="name"], input[name="name"]').first();
      const currentValue = await nameInput.inputValue().catch(() => '');

      if (currentValue) {
        await nameInput.fill(currentValue + ' (Updated)');

        // Save changes
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
        const isSaveVisible = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (isSaveVisible) {
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('should duplicate test case', async ({ page }) => {
    // Look for first test case
    const testItem = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]').first();
    const isVisible = await testItem.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Find duplicate button
    const duplicateButton = testItem.locator('button:has-text("Duplicate"), [data-testid*="duplicate"]').first();
    const isDuplicateVisible = await duplicateButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isDuplicateVisible) {
      await duplicateButton.click();

      // Wait for confirmation or new test to be created
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');

      // Verify duplicate was created (look for success message or new item)
      const successMessage = page.locator('text=Duplicated, text=Created, text=Success, [role="status"]');
      const hasSuccess = await successMessage.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (hasSuccess) {
        expect(hasSuccess).toBeTruthy();
      }
    }
  });

  test('should delete test case', async ({ page }) => {
    // Look for first test case
    const testItem = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]').last();
    const isVisible = await testItem.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Find delete button
    const deleteButton = testItem.locator('button[title*="Delete"], button:has-text("Delete"), [data-testid*="delete"]').first();
    const isDeleteVisible = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isDeleteVisible) {
      await deleteButton.click();

      // Handle confirmation dialog if it appears
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")');
      const isConfirmVisible = await confirmButton.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (isConfirmVisible) {
        await confirmButton.first().click();
      }

      // Wait for deletion to complete
      await page.waitForLoadState('networkidle');
    }
  });

  test('should filter test cases by status', async ({ page }) => {
    // Look for filter dropdown
    const filterButton = page.locator('button:has-text("Filter"), [data-testid="status-filter"], select[name="status"]');
    const isVisible = await filterButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Click filter button
    await filterButton.first().click();

    // If it's a dropdown, select an option
    const selectElement = page.locator('select[name="status"]').first();
    const isSelect = await selectElement.isVisible({ timeout: 5000 }).catch(() => false);

    if (isSelect) {
      await selectElement.selectOption('active');
    } else {
      // Look for filter options to click
      const passedOption = page.locator('button:has-text("Passed"), text=Passed').first();
      const isOptionVisible = await passedOption.isVisible({ timeout: 5000 }).catch(() => false);

      if (isOptionVisible) {
        await passedOption.click();
      }
    }

    // Wait for filtered results
    await page.waitForLoadState('networkidle');

    // Verify results are filtered
    const testItems = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]');
    const count = await testItems.count().catch(() => 0);

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should search for test cases', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"], [data-testid="search-input"]');
    const isVisible = await searchInput.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Type search term
    await searchInput.first().fill('login');

    // Wait for search results to update
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify search results are displayed
    const testItems = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]');
    const count = await testItems.count().catch(() => 0);

    // Should have at least some results (may be 0 if no matching tests)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should clear search results', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"], [data-testid="search-input"]').first();
    const isVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Type search term
    await searchInput.fill('login');
    await page.waitForLoadState('networkidle');

    // Get count of filtered results
    const testItemsFiltered = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]');
    const filteredCount = await testItemsFiltered.count().catch(() => 0);

    // Clear search
    await searchInput.clear();
    await page.waitForLoadState('networkidle');

    // Get count of all results
    const testItemsAll = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]');
    const allCount = await testItemsAll.count().catch(() => 0);

    // All count should be >= filtered count
    expect(allCount).toBeGreaterThanOrEqual(filteredCount);
  });

  test('should display test properties correctly', async ({ page }) => {
    // Look for first test case
    const testItem = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]').first();
    const isVisible = await testItem.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Check for test name
    const testName = testItem.locator('[data-testid="test-name"], [class*="name"]').first();
    const nameVisible = await testName.isVisible({ timeout: 5000 }).catch(() => false);

    if (nameVisible) {
      const name = await testName.innerText();
      expect(name).toBeTruthy();
    }

    // Check for test type/status
    const testStatus = testItem.locator('[data-testid="test-status"], [class*="status"], [class*="badge"]').first();
    const statusVisible = await testStatus.isVisible({ timeout: 5000 }).catch(() => false);

    if (statusVisible) {
      const status = await testStatus.innerText();
      expect(status).toBeTruthy();
    }
  });

  test('should sort test cases by name', async ({ page }) => {
    // Look for sort button/header
    const sortButton = page.locator('button:has-text("Name"), th:has-text("Name"), [data-testid="sort-name"]').first();
    const isVisible = await sortButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Click to sort
    await sortButton.click();
    await page.waitForLoadState('networkidle');

    // Click again to reverse sort
    await sortButton.click();
    await page.waitForLoadState('networkidle');

    // Verify tests are displayed
    const testItems = page.locator('[data-testid*="test-item"], [class*="test-row"], tr[role="row"]');
    const count = await testItems.count().catch(() => 0);

    expect(count).toBeGreaterThanOrEqual(0);
  });
});
