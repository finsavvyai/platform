# E2E Test Examples & Usage Patterns

This document provides practical examples of how to use the Qestro E2E test utilities and patterns.

## Table of Contents
1. [Authentication Tests](#authentication-tests)
2. [Form Interaction](#form-interaction)
3. [Navigation Tests](#navigation-tests)
4. [List & Table Operations](#list--table-operations)
5. [Error Handling](#error-handling)
6. [Advanced Patterns](#advanced-patterns)

---

## Authentication Tests

### Example 1: Login with Valid Credentials

```typescript
import { test, expect } from '@playwright/test';
import { loginUser, isUserAuthenticated } from './test-utils';

test('user can login successfully', async ({ page }) => {
  await loginUser(page, 'user@qestro.test', 'UserPassword123!');

  // Verify user is authenticated
  const authenticated = await isUserAuthenticated(page);
  expect(authenticated).toBe(true);

  // Verify dashboard is visible
  await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
});
```

### Example 2: Login with Error Handling

```typescript
import { test, expect } from '@playwright/test';
import { loginUser, hasErrorMessage } from './test-utils';

test('login displays error with wrong credentials', async ({ page }) => {
  await loginUser(page, 'wrong@qestro.test', 'WrongPassword!');

  // Check for error message
  const hasError = await hasErrorMessage(page);
  expect(hasError).toBe(true);

  // User should still be on login page
  expect(page.url()).toContain('login');
});
```

### Example 3: Logout and Verify Redirect

```typescript
import { test } from '@playwright/test';
import { loginUser, logoutUser } from './test-utils';

test('user can logout', async ({ page }) => {
  // Login first
  await loginUser(page, 'user@qestro.test', 'UserPassword123!');

  // Logout
  await logoutUser(page);

  // Should be redirected to login
  expect(page.url()).toContain('login');
});
```

---

## Form Interaction

### Example 4: Fill Complex Form

```typescript
import { test } from '@playwright/test';
import { fillForm, clickButton, hasSuccessMessage } from './test-utils';

test('create new project', async ({ page }) => {
  await page.goto('http://localhost:3000/projects/new');

  // Fill form fields
  await fillForm(page, {
    'input[name="name"]': 'My Test Project',
    'textarea[name="description"]': 'This is a test project for automation',
    'input[name="url"]': 'https://example.com',
  });

  // Select dropdown option
  await page.selectOption('select[name="framework"]', 'playwright');

  // Click create button
  await clickButton(page, 'button:has-text("Create")', true);

  // Verify success
  const success = await hasSuccessMessage(page);
  expect(success).toBe(true);
});
```

### Example 5: Clear and Reset Form

```typescript
import { test } from '@playwright/test';
import { clearForm, fillInput } from './test-utils';

test('reset form to initial state', async ({ page }) => {
  await page.goto('http://localhost:3000/tests/new');

  // Fill form
  await fillInput(page, 'input[name="name"]', 'Test Name');
  await fillInput(page, 'textarea[name="description"]', 'Test Description');

  // Clear form
  await clearForm(page, 'form');

  // Verify fields are empty
  const nameInput = page.locator('input[name="name"]');
  expect(await nameInput.inputValue()).toBe('');
});
```

---

## Navigation Tests

### Example 6: Navigate Between Pages

```typescript
import { test, expect } from '@playwright/test';
import { navigateTo, getElementText } from './test-utils';

test('navigate through app sections', async ({ page }) => {
  // Navigate to dashboard
  await navigateTo(page, '/dashboard');

  // Click link to tests
  await page.click('a:has-text("Tests")');
  await page.waitForLoadState('networkidle');

  // Verify we're on tests page
  expect(page.url()).toContain('tests');

  // Verify page title
  const title = await getElementText(page, 'h1');
  expect(title).toContain('Test');
});
```

### Example 7: Breadcrumb Navigation

```typescript
import { test } from '@playwright/test';
import { navigateTo } from './test-utils';

test('navigate using breadcrumbs', async ({ page }) => {
  // Navigate to test details
  await navigateTo(page, '/projects/123/tests/456');

  // Click on project breadcrumb
  await page.click('[data-testid="breadcrumb-projects"]');

  // Should navigate back to projects
  expect(page.url()).toContain('projects');
});
```

---

## List & Table Operations

### Example 8: Read Table Data

```typescript
import { test, expect } from '@playwright/test';
import { getTableData, navigateTo } from './test-utils';

test('extract and verify table data', async ({ page }) => {
  await navigateTo(page, '/test-results');

  // Get all table rows as objects
  const tableData = await getTableData(page);

  // Verify data exists
  expect(tableData.length).toBeGreaterThan(0);

  // Verify expected columns exist
  tableData.forEach(row => {
    expect(Object.keys(row).length).toBeGreaterThan(0);
  });

  // Find specific row
  const failedTest = tableData.find(row => row.cell_2?.includes('Failed'));
  if (failedTest) {
    expect(failedTest).toBeDefined();
  }
});
```

### Example 9: Filter List and Verify Results

```typescript
import { test, expect } from '@playwright/test';
import { navigateTo } from './test-utils';

test('filter tests by status', async ({ page }) => {
  await navigateTo(page, '/tests');

  // Click filter button
  await page.click('[data-testid="status-filter"]');

  // Select 'Failed' option
  await page.click('option:has-text("Failed"), button:has-text("Failed")');

  // Wait for results to update
  await page.waitForLoadState('networkidle');

  // Verify only failed tests are shown
  const testItems = page.locator('[data-testid*="test-item"]');
  const count = await testItems.count();
  expect(count).toBeGreaterThanOrEqual(0);
});
```

### Example 10: Sort Table

```typescript
import { test } from '@playwright/test';
import { navigateTo } from './test-utils';

test('sort tests by name', async ({ page }) => {
  await navigateTo(page, '/tests');

  // Click sort header
  await page.click('th:has-text("Name"), button:has-text("Name")');

  // Wait for sort
  await page.waitForLoadState('networkidle');

  // Verify tests are displayed
  const items = page.locator('[data-testid*="test-item"]');
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
});
```

---

## Error Handling

### Example 11: Graceful Timeout Handling

```typescript
import { test } from '@playwright/test';
import { waitForElement } from './test-utils';

test('handle missing element gracefully', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard');

  // Try to find element with timeout
  const element = page.locator('[data-testid="optional-element"]');

  const exists = await element
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  // Element may or may not exist
  console.log('Element exists:', exists);
});
```

### Example 12: API Error Handling

```typescript
import { test, expect } from '@playwright/test';
import { clickButton, hasErrorMessage } from './test-utils';

test('handle API errors gracefully', async ({ page }) => {
  await page.goto('http://localhost:3000/tests/new');

  // Try to submit with invalid data
  await clickButton(page, 'button:has-text("Create")');

  // Check for error message
  const hasError = await hasErrorMessage(page);

  if (hasError) {
    // Verify error text
    const errorText = await page.locator('[class*="error"]').innerText();
    expect(errorText.length).toBeGreaterThan(0);
  }
});
```

### Example 13: Network Failure Recovery

```typescript
import { test } from '@playwright/test';
import { navigateTo } from './test-utils';

test('retry on network error', async ({ page }) => {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      await navigateTo(page, '/api/tests');
      break;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      console.log(`Retry attempt ${retries}`);
      await page.waitForTimeout(1000);
    }
  }
});
```

---

## Advanced Patterns

### Example 14: Login Once, Test Multiple Flows

```typescript
import { test, expect } from '@playwright/test';
import { loginUser, navigateTo, clickButton } from './test-utils';

test.describe('Authenticated User Flows', () => {
  test.beforeAll(async ({ browser }) => {
    // Setup: Login once and save state
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginUser(page, 'user@qestro.test', 'UserPassword123!');

    // Save storage state
    await context.storageState({ path: 'auth.json' });
    await context.close();
  });

  test('create test', async ({ page }) => {
    // Use saved auth state
    await navigateTo(page, '/tests/new');
    // Test creation...
  });

  test('run test', async ({ page }) => {
    // Use saved auth state
    await navigateTo(page, '/tests');
    // Test execution...
  });
});
```

### Example 15: Generate Unique Test Data

```typescript
import { test } from '@playwright/test';
import { generateTestData, fillInput, clickButton } from './test-utils';

test('create multiple projects with unique names', async ({ page }) => {
  await page.goto('http://localhost:3000/projects/new');

  // Generate unique project name
  const projectName = generateTestData.projectName();

  await fillInput(page, 'input[name="name"]', projectName);
  await fillInput(page, 'input[name="url"]', 'https://example.com');

  // Submit
  await clickButton(page, 'button:has-text("Create")', true);

  // Verify project was created
  expect(page.url()).not.toContain('new');
});
```

### Example 16: Screenshot on Failure

```typescript
import { test } from '@playwright/test';
import { takeScreenshot } from './test-utils';

test('capture screenshot on error', async ({ page }) => {
  try {
    await page.goto('http://localhost:3000/tests');
    await page.click('button:has-text("NonExistent")');
  } catch (error) {
    // Take screenshot for debugging
    const filename = await takeScreenshot(page, 'test-failure');
    console.log(`Screenshot saved: ${filename}`);
    throw error;
  }
});
```

### Example 17: Wait for Loading State

```typescript
import { test } from '@playwright/test';
import { waitForLoading, navigateTo } from './test-utils';

test('wait for async data to load', async ({ page }) => {
  // Navigate to page that loads data asynchronously
  await navigateTo(page, '/dashboard');

  // Wait for loading indicator to appear and disappear
  await waitForLoading(page, 10000);

  // Page should now have loaded data
  const stats = page.locator('[data-testid*="stat"]');
  expect(await stats.count()).toBeGreaterThan(0);
});
```

### Example 18: Verify Page Content

```typescript
import { test, expect } from '@playwright/test';
import { getPageText, pageContainsText, navigateTo } from './test-utils';

test('verify page content', async ({ page }) => {
  await navigateTo(page, '/pricing');

  // Get all text on page
  const pageText = await getPageText(page);

  // Verify key content exists
  const hasContent = await pageContainsText(page, 'Free');
  expect(hasContent).toBe(true);

  // Verify specific features
  expect(pageText).toContain('AI-Powered Testing');
  expect(pageText).toContain('Self-Healing');
});
```

### Example 19: Handle Confirmation Dialog

```typescript
import { test } from '@playwright/test';
import { navigateTo, handleConfirmation } from './test-utils';

test('confirm destructive action', async ({ page }) => {
  // Navigate to test details
  await navigateTo(page, '/tests/123');

  // Click delete button
  await page.click('button:has-text("Delete")');

  // Handle confirmation dialog (confirm = true)
  await handleConfirmation(page, true);

  // Verify test was deleted
  expect(page.url()).not.toContain('tests/123');
});
```

### Example 20: Accessibility Testing

```typescript
import { test, expect } from '@playwright/test';
import { checkAccessibility, navigateTo } from './test-utils';

test('verify basic accessibility', async ({ page }) => {
  await navigateTo(page, '/dashboard');

  // Check for basic accessibility issues
  const violations = await checkAccessibility(page);

  // Should have no critical violations
  const criticalViolations = violations.filter(v => v.rule === 'image-alt');
  expect(criticalViolations.length).toBe(0);
});
```

---

## Tips & Tricks

### Use beforeEach for Common Setup
```typescript
test.beforeEach(async ({ page }) => {
  // This runs before each test
  await navigateTo(page, '/dashboard');
});
```

### Use beforeAll for Expensive Setup
```typescript
test.beforeAll(async ({ browser }) => {
  // This runs once before all tests in suite
  // Good for login that takes time
});
```

### Parallel Tests with Independent Data
```typescript
test('test 1', async ({ page }) => {
  const projectName = generateTestData.projectName(); // Unique per test
});

test('test 2', async ({ page }) => {
  const projectName = generateTestData.projectName(); // Different from test 1
});
```

### Debug with console.log
```typescript
test('debug test', async ({ page }) => {
  console.log('Current URL:', page.url());
  console.log('Page content:', await getPageText(page));

  // Use --project=chromium --headed for debug mode
});
```

---

## Common Issues & Solutions

### Issue: Element not found after wait
**Solution:** Increase timeout and add explicit wait
```typescript
const element = page.locator('[data-testid="loading"]');
await element.waitFor({ state: 'visible', timeout: 10000 });
```

### Issue: Form submission fails intermittently
**Solution:** Wait for loading state
```typescript
await clickButton(page, 'button:has-text("Save")');
await waitForLoading(page);
```

### Issue: Flaky assertions
**Solution:** Add retry logic
```typescript
await expect(async () => {
  const text = await getElementText(page, '[data-testid="result"]');
  expect(text).toContain('Success');
}).toPass({ timeout: 10000 });
```

---

**Last Updated:** April 2026
**Test Suite Version:** 1.0.0
