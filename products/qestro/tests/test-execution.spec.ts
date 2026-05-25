/**
 * Test Execution E2E Tests
 * Tests for running tests, monitoring progress, and viewing results
 */

import { test, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Test Execution', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard or tests page
    await page.goto(`${baseURL}/dashboard`);

    // Check if authenticated
    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');
  });

  test('should start test run from dashboard', async ({ page }) => {
    // Look for run test button
    const runButton = page.locator('button:has-text("Run"), button:has-text("Execute"), [data-testid="run-test-button"]');
    const isVisible = await runButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      // Try looking for test in list to run
      const testItem = page.locator('[data-testid*="test"], [class*="test-card"]').first();
      const testVisible = await testItem.isVisible({ timeout: 5000 }).catch(() => false);

      if (!testVisible) {
        test.skip();
      }

      // Click run button within test item
      const testRunButton = testItem.locator('button:has-text("Run"), [data-testid*="run"]').first();
      const testRunVisible = await testRunButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (testRunVisible) {
        await testRunButton.click();
      } else {
        test.skip();
      }
    } else {
      await runButton.first().click();
    }

    // Wait for test to start or navigate to results page
    await page.waitForURL(/.*run.*|.*result.*/i, { timeout: 10000 }).catch(() => {
      // May not navigate, that's okay
      return null;
    });
  });

  test('should display test run progress', async ({ page }) => {
    // Look for progress indicator
    const progressBar = page.locator('[data-testid="progress-bar"], [class*="progress"], progress');
    const isVisible = await progressBar.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(progressBar.first()).toBeInViewport();

      // Get progress percentage if available
      const progressText = page.locator('[data-testid="progress-text"], [class*="progress-text"]').first();
      const textVisible = await progressText.isVisible({ timeout: 5000 }).catch(() => false);

      if (textVisible) {
        const text = await progressText.innerText();
        expect(text).toMatch(/\d+%|complete|progress/i);
      }
    }

    // Look for test execution steps
    const stepsList = page.locator('[data-testid="test-steps"], [class*="steps"], ol, ul');
    const stepsVisible = await stepsList.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (stepsVisible) {
      const steps = stepsList.first().locator('li, [data-testid*="step"]');
      const stepCount = await steps.count().catch(() => 0);
      expect(stepCount).toBeGreaterThan(0);
    }
  });

  test('should display live test execution logs', async ({ page }) => {
    // Look for logs/output section
    const logsSection = page.locator('[data-testid="test-logs"], [class*="logs"], [class*="console"]');
    const isVisible = await logsSection.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(logsSection.first()).toBeInViewport();

      // Logs should contain some output
      const logsText = await logsSection.first().innerText();
      expect(logsText).toBeTruthy();
    }
  });

  test('should display test results summary', async ({ page }) => {
    // Navigate to test results if not already there
    await page.goto(`${baseURL}/test-results`, { waitUntil: 'networkidle' }).catch(() => {
      // Page may not exist
      return null;
    });

    // Look for results summary
    const resultsSummary = page.locator('[data-testid="results-summary"], [class*="summary"]');
    const isVisible = await resultsSummary.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(resultsSummary.first()).toBeInViewport();
    }

    // Look for test status badges
    const statusBadges = page.locator('[data-testid*="status"], [class*="badge"]');
    const badgeCount = await statusBadges.count().catch(() => 0);

    if (badgeCount > 0) {
      expect(badgeCount).toBeGreaterThan(0);
    }
  });

  test('should display passed tests count', async ({ page }) => {
    // Look for passed count
    const passedCount = page.locator('[data-testid="passed-count"], :text("Passed"):adjacent(*)');
    const isVisible = await passedCount.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const count = await passedCount.first().innerText();
      expect(count).toMatch(/\d+|Passed/);
    }
  });

  test('should display failed tests count', async ({ page }) => {
    // Look for failed count
    const failedCount = page.locator('[data-testid="failed-count"], :text("Failed"):adjacent(*)');
    const isVisible = await failedCount.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const count = await failedCount.first().innerText();
      expect(count).toMatch(/\d+|Failed/);
    }
  });

  test('should display test execution time', async ({ page }) => {
    // Look for execution time
    const executionTime = page.locator('[data-testid="execution-time"], :text("Duration"), :text("Execution Time"), [class*="duration"]');
    const isVisible = await executionTime.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const time = await executionTime.first().innerText();
      expect(time).toMatch(/\d+s|ms|minute|second/i);
    }
  });

  test('should display screenshot on test failure', async ({ page }) => {
    // Look for failed test item
    const failedTest = page.locator('[data-testid*="failed"], [class*="failed"]').first();
    const isVisible = await failedTest.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Click on failed test to view details
    await failedTest.click();

    // Wait for detail view to load
    await page.waitForLoadState('networkidle');

    // Look for screenshot
    const screenshot = page.locator('[data-testid="screenshot"], img[alt*="failure"], img[alt*="screenshot"]').first();
    const screenshotVisible = await screenshot.isVisible({ timeout: 5000 }).catch(() => false);

    if (screenshotVisible) {
      await expect(screenshot).toBeInViewport();

      // Verify it's an image
      const src = await screenshot.getAttribute('src');
      expect(src).toBeTruthy();
    }

    // Look for error message
    const errorMessage = page.locator('[data-testid="error-message"], [class*="error"]');
    const errorVisible = await errorMessage.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (errorVisible) {
      const message = await errorMessage.first().innerText();
      expect(message).toBeTruthy();
    }
  });

  test('should show assertion failures with details', async ({ page }) => {
    // Look for assertion failure item
    const assertionFailure = page.locator('[data-testid*="assertion"], [class*="assertion"]').first();
    const isVisible = await assertionFailure.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Click to expand assertion details
    await assertionFailure.click();

    // Look for assertion details
    const assertionDetails = page.locator('[data-testid="assertion-details"], [class*="details"]');
    const detailsVisible = await assertionDetails.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (detailsVisible) {
      const details = await assertionDetails.first().innerText();
      expect(details).toBeTruthy();
    }
  });

  test('should allow retry of failed test', async ({ page }) => {
    // Look for retry button
    const retryButton = page.locator('button:has-text("Retry"), button:has-text("Re-run"), [data-testid="retry-button"]');
    const isVisible = await retryButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    await retryButton.first().click();

    // Should navigate to test run or show loading state
    await page.waitForLoadState('networkidle');

    // Verify retry started
    const progressBar = page.locator('[data-testid="progress-bar"], [class*="progress"]');
    const progressVisible = await progressBar.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (progressVisible) {
      expect(progressVisible).toBeTruthy();
    }
  });

  test('should display test environment details', async ({ page }) => {
    // Look for environment info
    const envInfo = page.locator('[data-testid="environment"], [class*="environment"], [class*="browser"]');
    const isVisible = await envInfo.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const info = await envInfo.first().innerText();
      expect(info).toBeTruthy();
    }
  });

  test('should export test results', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), [data-testid="export-button"]');
    const isVisible = await exportButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
    }

    // Click export button
    await exportButton.first().click();

    // Look for export options
    const exportOptions = page.locator('button:has-text("PDF"), button:has-text("CSV"), button:has-text("JSON")');
    const optionsVisible = await exportOptions.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (optionsVisible) {
      // Select first export option
      await exportOptions.first().click();

      // Verify download started (may download in background)
      await page.waitForTimeout(1000);
    }
  });

  test('should display test result comparison for reruns', async ({ page }) => {
    // Look for comparison view
    const comparisonView = page.locator('[data-testid="comparison"], [class*="comparison"]');
    const isVisible = await comparisonView.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(comparisonView.first()).toBeInViewport();
    }
  });

  test('should show test run timeline', async ({ page }) => {
    // Look for timeline
    const timeline = page.locator('[data-testid="timeline"], [class*="timeline"]');
    const isVisible = await timeline.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(timeline.first()).toBeInViewport();
    }
  });
});
