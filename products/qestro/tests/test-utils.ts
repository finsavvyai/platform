/**
 * Test Utilities for Playwright E2E Tests
 * Common functions and helpers for test automation
 */

import { Page, expect } from '@playwright/test';

/**
 * Base URL configuration
 */
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Common test data
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@qestro.test',
    password: 'AdminPassword123!',
  },
  user: {
    email: 'user@qestro.test',
    password: 'UserPassword123!',
  },
  invalid: {
    email: 'invalid@qestro.test',
    password: 'InvalidPassword123!',
  },
};

/**
 * Common selectors
 */
export const SELECTORS = {
  // Authentication
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  signInButton: 'button:has-text("Sign in")',
  signUpButton: 'button:has-text("Sign up"), button:has-text("Create Account")',
  rememberMeCheckbox: 'input[name="remember-me"]',
  forgotPasswordLink: 'a:has-text("Forgot password?")',

  // Navigation
  dashboardLink: 'a:has-text("Dashboard")',
  projectsLink: 'a:has-text("Projects")',
  testsLink: 'a:has-text("Tests"), a:has-text("Test Cases")',
  settingsLink: 'a:has-text("Settings")',

  // Buttons
  createButton: 'button:has-text("Create"), button:has-text("New"), [data-testid="create-button"]',
  editButton: 'button:has-text("Edit")',
  deleteButton: 'button:has-text("Delete")',
  saveButton: 'button:has-text("Save"), button:has-text("Submit")',
  cancelButton: 'button:has-text("Cancel")',
  confirmButton: 'button:has-text("Confirm"), button:has-text("Yes")',

  // Common elements
  loadingIndicator: '[data-testid="loading"], [class*="loading"], [role="progressbar"]',
  errorMessage: '[data-testid="error"], [class*="error"], .text-red-400',
  successMessage: '[data-testid="success"], [class*="success"], .text-green-400',
  modal: '[role="dialog"], [class*="modal"]',
  table: 'table, [role="table"]',
};

/**
 * Waits for a selector to be visible and returns the element
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 5000
) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout }).catch(() => {
    throw new Error(`Element not found: ${selector}`);
  });
  return element;
}

/**
 * Fills an input field
 */
export async function fillInput(
  page: Page,
  selector: string,
  value: string
) {
  const input = page.locator(selector);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(value);
}

/**
 * Clicks a button and waits for page to load
 */
export async function clickButton(
  page: Page,
  selector: string,
  waitForNavigation: boolean = false
) {
  const button = page.locator(selector);
  await button.waitFor({ state: 'visible', timeout: 5000 });
  await button.click();

  if (waitForNavigation) {
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Logs in a user
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await fillInput(page, SELECTORS.emailInput, email);
  await fillInput(page, SELECTORS.passwordInput, password);
  await clickButton(page, SELECTORS.signInButton, true);

  // Wait for navigation away from login page
  await page.waitForURL(/^(?!.*login)/, { timeout: 10000 }).catch(() => {
    // May not navigate if login fails
    return null;
  });
}

/**
 * Logs out the current user
 */
export async function logoutUser(page: Page) {
  // Look for logout button/menu
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout"]');
  const isVisible = await logoutButton.first().isVisible({ timeout: 5000 }).catch(() => false);

  if (isVisible) {
    await logoutButton.first().click();
    await page.waitForURL(/.*login.*/, { timeout: 5000 }).catch(() => {
      return null;
    });
  }
}

/**
 * Checks if user is authenticated
 */
export async function isUserAuthenticated(page: Page): Promise<boolean> {
  const currentURL = page.url();
  return !currentURL.includes('login') && !currentURL.includes('auth');
}

/**
 * Navigates to a page and waits for it to load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Gets the currently authenticated user from local storage or cookies
 */
export async function getCurrentUser(page: Page): Promise<any> {
  const userData = await page.evaluate(() => {
    const stored = localStorage.getItem('user') || localStorage.getItem('auth');
    return stored ? JSON.parse(stored) : null;
  }).catch(() => null);

  return userData;
}

/**
 * Checks if an element is visible within viewport
 */
export async function isElementVisible(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<boolean> {
  const element = page.locator(selector);
  return element.isVisible({ timeout }).catch(() => false);
}

/**
 * Gets text content of an element
 */
export async function getElementText(
  page: Page,
  selector: string
): Promise<string> {
  const element = page.locator(selector);
  return element.innerText().catch(() => '');
}

/**
 * Checks if error message is displayed
 */
export async function hasErrorMessage(page: Page): Promise<boolean> {
  const errorElement = page.locator(SELECTORS.errorMessage);
  return errorElement.first().isVisible({ timeout: 3000 }).catch(() => false);
}

/**
 * Checks if success message is displayed
 */
export async function hasSuccessMessage(page: Page): Promise<boolean> {
  const successElement = page.locator(SELECTORS.successMessage);
  return successElement.first().isVisible({ timeout: 3000 }).catch(() => false);
}

/**
 * Waits for loading indicator to appear and disappear
 */
export async function waitForLoading(page: Page, timeout: number = 10000) {
  const loadingElement = page.locator(SELECTORS.loadingIndicator);
  const maxTime = Date.now() + timeout;

  // Wait for loading to start
  while (Date.now() < maxTime) {
    const isLoading = await loadingElement.first().isVisible({ timeout: 1000 }).catch(() => false);
    if (isLoading) {
      break;
    }
    await page.waitForTimeout(100);
  }

  // Wait for loading to finish
  while (Date.now() < maxTime) {
    const isLoading = await loadingElement.first().isVisible({ timeout: 1000 }).catch(() => false);
    if (!isLoading) {
      break;
    }
    await page.waitForTimeout(100);
  }
}

/**
 * Fills a form with multiple fields
 */
export async function fillForm(
  page: Page,
  fields: Record<string, string>
) {
  for (const [selector, value] of Object.entries(fields)) {
    await fillInput(page, selector, value);
  }
}

/**
 * Gets all table rows as array of objects
 */
export async function getTableData(page: Page): Promise<any[]> {
  const rows = page.locator(SELECTORS.table + ' tbody tr');
  const rowCount = await rows.count();
  const data = [];

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const cells = row.locator('td');
    const cellCount = await cells.count();
    const rowData: Record<string, string> = {};

    for (let j = 0; j < cellCount; j++) {
      const cellText = await cells.nth(j).innerText();
      rowData[`cell_${j}`] = cellText;
    }

    data.push(rowData);
  }

  return data;
}

/**
 * Takes a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  await page.screenshot({ path: `test-results/${filename}` });
  return filename;
}

/**
 * Clears all input fields in a form
 */
export async function clearForm(page: Page, selector: string) {
  const inputs = page.locator(selector + ' input, ' + selector + ' textarea, ' + selector + ' select');
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    await inputs.nth(i).clear();
  }
}

/**
 * Handles a confirmation dialog
 */
export async function handleConfirmation(page: Page, confirm: boolean = true) {
  const modal = page.locator(SELECTORS.modal);
  const modalVisible = await modal.first().isVisible({ timeout: 5000 }).catch(() => false);

  if (modalVisible) {
    const button = confirm ? SELECTORS.confirmButton : SELECTORS.cancelButton;
    await clickButton(page, button);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Waits for a specific URL pattern
 */
export async function waitForURL(page: Page, pattern: string | RegExp, timeout: number = 10000) {
  await page.waitForURL(pattern, { timeout }).catch(() => {
    throw new Error(`URL did not match pattern: ${pattern}`);
  });
}

/**
 * Gets all visible text from page
 */
export async function getPageText(page: Page): Promise<string> {
  return page.locator('body').innerText();
}

/**
 * Searches for text on page
 */
export async function pageContainsText(page: Page, text: string): Promise<boolean> {
  const pageText = await getPageText(page);
  return pageText.includes(text);
}

/**
 * Verifies API response contains expected status
 */
export async function captureAPIResponse(page: Page, urlPattern: string | RegExp): Promise<any> {
  return new Promise((resolve) => {
    page.on('response', (response) => {
      if (typeof urlPattern === 'string' ? response.url().includes(urlPattern) : urlPattern.test(response.url())) {
        response.json().then(resolve).catch(() => resolve(null));
      }
    });
  });
}

/**
 * Accessibility check: Verify page has no accessibility violations
 * Requires @axe-core/playwright to be installed
 */
export async function checkAccessibility(page: Page): Promise<any[]> {
  // This would require installing axe-core package
  // For now, just verify basic accessibility features
  const violations: any[] = [];

  // Check for alt text on images
  const images = page.locator('img:not([alt]), img[alt=""]');
  const imgCount = await images.count();
  if (imgCount > 0) {
    violations.push({
      rule: 'image-alt',
      count: imgCount,
      message: 'Images without alt text found',
    });
  }

  // Check for form labels
  const inputs = page.locator('input:not([aria-label]):not([title])');
  const inputCount = await inputs.count();
  if (inputCount > 0) {
    violations.push({
      rule: 'form-labels',
      count: inputCount,
      message: 'Form inputs without labels found',
    });
  }

  return violations;
}

/**
 * Compare two values with custom assertion message
 */
export async function assertValue(
  actual: any,
  expected: any,
  message: string = ''
) {
  expect(actual).toBe(expected);
}

/**
 * Test data generator
 */
export const generateTestData = {
  email: (): string => `user-${Date.now()}@qestro.test`,
  projectName: (): string => `Project-${Date.now()}`,
  testName: (): string => `Test-${Date.now()}`,
  webhook: (): string => `https://webhook.example.com/${Date.now()}`,
};

export default {
  BASE_URL,
  TEST_USERS,
  SELECTORS,
  waitForElement,
  fillInput,
  clickButton,
  loginUser,
  logoutUser,
  isUserAuthenticated,
  navigateTo,
  getCurrentUser,
  isElementVisible,
  getElementText,
  hasErrorMessage,
  hasSuccessMessage,
  waitForLoading,
  fillForm,
  getTableData,
  takeScreenshot,
  clearForm,
  handleConfirmation,
  waitForURL,
  getPageText,
  pageContainsText,
  captureAPIResponse,
  checkAccessibility,
  assertValue,
  generateTestData,
};
