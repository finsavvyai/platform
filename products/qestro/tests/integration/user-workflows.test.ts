/**
 * User Workflow Integration Tests
 * Tests complete user workflows across the Questro platform
 */

import { test, expect } from '@playwright/test';
import { TestDataManager } from '../playwright/utils/TestDataManager.js';

test.describe('User Workflows', () => {
  let testDataManager: TestDataManager;

  test.beforeAll(async () => {
    testDataManager = new TestDataManager();
  });

  test.beforeEach(async () => {
    await testDataManager.cleanupTestData();
  });

  test.describe('New User Onboarding', () => {
    test('should complete full user registration and onboarding', async ({ page }) => {
      // Navigate to home page
      await page.goto('/');

      // Click sign up button
      await page.click('[data-testid="signup-button"]');

      // Fill registration form
      await page.fill('[data-testid="email-input"]', 'testuser@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!');
      await page.fill('[data-testid="company-input"]', 'Test Company');

      // Accept terms and submit
      await page.check('[data-testid="terms-checkbox"]');
      await page.click('[data-testid="register-button"]');

      // Should redirect to email verification page
      await expect(page.locator('h1')).toContainText('Verify your email');

      // Simulate email verification (in test environment)
      await page.goto('/verify-email?token=test-verification-token');

      // Should redirect to onboarding
      await expect(page.locator('h1')).toContainText('Welcome to Questro');

      // Complete onboarding steps
      await page.click('[data-testid="onboarding-next-button"]');
      await page.click('[data-testid="onboarding-next-button"]');
      await page.click('[data-testid="onboarding-next-button"]');
      await page.click('[data-testid="onboarding-complete-button"]');

      // Should be redirected to dashboard
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Test Company');
    });

    test('should handle existing user login', async ({ page }) => {
      // Navigate to login page
      await page.goto('/login');

      // Fill login form
      await page.fill('[data-testid="email-input"]', 'existing@example.com');
      await page.fill('[data-testid="password-input"]', 'ExistingPassword123!');
      await page.click('[data-testid="login-button"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="user-menu"]')).toContainText('existing@example.com');
    });
  });

  test.describe('Test Recording Workflows', () => {
    test('should complete web test recording workflow', async ({ page }) => {
      // Login as existing user
      await loginUser(page, 'test@example.com', 'TestPassword123!');

      // Navigate to recording studio
      await page.goto('/recording-studio');

      // Start new web recording
      await page.selectOption('[data-testid="test-type-select"]', 'web');
      await page.fill('[data-testid="test-url-input"]', 'https://example.com');
      await page.click('[data-testid="start-recording-button"]');

      // Should open recording interface
      await expect(page.locator('[data-testid="recording-interface"]')).toBeVisible();

      // Simulate recording actions
      await page.click('[data-testid="recording-action-click"]');
      await page.click('[data-testid="recording-action-type"]');
      await page.click('[data-testid="recording-action-assert"]');

      // Stop recording
      await page.click('[data-testid="stop-recording-button"]');

      // Should show test preview
      await expect(page.locator('[data-testid="test-preview"]')).toBeVisible();

      // Save test
      await page.fill('[data-testid="test-name-input"]', 'My First Test');
      await page.click('[data-testid="save-test-button"]');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Test saved successfully');

      // Navigate to test library
      await page.goto('/tests');

      // Should find saved test
      await expect(page.locator('[data-testid="test-card"]').filter({ hasText: 'My First Test' })).toBeVisible();
    });

    test('should complete mobile test recording workflow', async ({ page }) => {
      // Login as existing user
      await loginUser(page, 'test@example.com', 'TestPassword123!');

      // Navigate to recording studio
      await page.goto('/recording-studio');

      // Start new mobile recording
      await page.selectOption('[data-testid="test-type-select"]', 'mobile');
      await page.selectOption('[data-testid="mobile-platform-select"]', 'ios');
      await page.click('[data-testid="start-recording-button"]');

      // Should show mobile recording instructions
      await expect(page.locator('[data-testid="mobile-recording-instructions"]')).toBeVisible();

      // Simulate mobile app connection
      await page.click('[data-testid="connect-device-button"]');

      // Mock successful device connection
      await expect(page.locator('[data-testid="device-connected"]')).toBeVisible();

      // Start recording actions
      await page.click('[data-testid="start-mobile-recording"]');

      // Simulate mobile actions
      await page.click('[data-testid="mobile-action-tap"]');
      await page.click('[data-testid="mobile-action-swipe"]');
      await page.click('[data-testid="mobile-action-assert"]');

      // Stop recording
      await page.click('[data-testid="stop-mobile-recording"]');

      // Save mobile test
      await page.fill('[data-testid="test-name-input"]', 'My Mobile Test');
      await page.click('[data-testid="save-test-button"]');

      // Verify test is saved
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Mobile test saved');
    });
  });

  test.describe('AI Test Generation Workflows', () => {
    test('should generate test from natural language description', async ({ page }) => {
      // Login as existing user
      await loginUser(page, 'test@example.com', 'TestPassword123!');

      // Navigate to AI test generation
      await page.goto('/ai-test-generation');

      // Fill test description
      await page.fill('[data-testid="test-description"]', 'Test the login functionality with valid credentials');
      await page.selectOption('[data-testid="framework-select"]', 'playwright');
      await page.fill('[data-testid="target-url"]', 'https://example.com/login');

      // Generate test
      await page.click('[data-testid="generate-test-button"]');

      // Should show loading state
      await expect(page.locator('[data-testid="generating-indicator"]')).toBeVisible();

      // Should show generated test
      await expect(page.locator('[data-testid="generated-test"]')).toBeVisible({ timeout: 30000 });

      // Edit generated test if needed
      await page.click('[data-testid="edit-test-button"]');
      await page.fill('[data-testid="test-editor"]', 'Modified test code');

      // Save test
      await page.fill('[data-testid="test-name-input"]', 'AI Generated Login Test');
      await page.click('[data-testid="save-test-button"]');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('AI-generated test saved');
    });

    test('should enhance existing test with AI suggestions', async ({ page }) => {
      // Login and navigate to existing test
      await loginUser(page, 'test@example.com', 'TestPassword123!');
      await page.goto('/tests');

      // Open existing test
      await page.click('[data-testid="test-card"]').first();
      await page.click('[data-testid="enhance-with-ai-button"]');

      // Select enhancement options
      await page.check('[data-testid="enhance-assertions"]');
      await page.check('[data-testid="enhance-selectors"]');
      await page.check('[data-testid="enhance-error-handling"]');

      // Start enhancement
      await page.click('[data-testid="enhance-test-button"]');

      // Should show enhancement progress
      await expect(page.locator('[data-testid="enhancement-progress"]')).toBeVisible();

      // Should show enhanced test
      await expect(page.locator('[data-testid="enhanced-test"]')).toBeVisible({ timeout: 30000 });

      // Review and apply changes
      await page.click('[data-testid="apply-changes-button"]');

      // Confirm changes
      await expect(page.locator('[data-testid="enhancement-success"]')).toContainText('Test enhanced successfully');
    });
  });

  test.describe('Test Execution Workflows', () => {
    test('should execute single test and view results', async ({ page }) => {
      // Login and navigate to test library
      await loginUser(page, 'test@example.com', 'TestPassword123!');
      await page.goto('/tests');

      // Select test for execution
      await page.click('[data-testid="test-card"]').first();

      // Configure test execution
      await page.selectOption('[data-testid="environment-select"]', 'staging');
      await page.check('[data-testid="headless-mode"]');

      // Execute test
      await page.click('[data-testid="run-test-button"]');

      // Should show execution progress
      await expect(page.locator('[data-testid="execution-progress"]')).toBeVisible();

      // Wait for completion
      await expect(page.locator('[data-testid="execution-complete"]')).toBeVisible({ timeout: 60000 });

      // View test results
      await page.click('[data-testid="view-results-button"]');

      // Should show detailed results
      await expect(page.locator('[data-testid="test-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="test-status"]')).toContainText('Passed');

      // View execution logs
      await page.click('[data-testid="view-logs-button"]');
      await expect(page.locator('[data-testid="execution-logs"]')).toBeVisible();
    });

    test('should execute test suite and view aggregated results', async ({ page }) => {
      // Login and navigate to test suites
      await loginUser(page, 'test@example.com', 'TestPassword123!');
      await page.goto('/test-suites');

      // Select test suite
      await page.click('[data-testid="test-suite-card"]').first();

      // Execute entire suite
      await page.click('[data-testid="run-suite-button"]');

      // Should show suite execution progress
      await expect(page.locator('[data-testid="suite-progress"]')).toBeVisible();

      // Wait for suite completion
      await expect(page.locator('[data-testid="suite-complete"]')).toBeVisible({ timeout: 120000 });

      // View suite results
      await expect(page.locator('[data-testid="suite-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="suite-summary"]')).toContainText('tests passed');

      // View individual test results
      await page.click('[data-testid="test-result"]').first();
      await expect(page.locator('[data-testid="test-details"]')).toBeVisible();
    });
  });

  test.describe('Reporting and Analytics Workflows', () => {
    test('should view analytics dashboard', async ({ page }) => {
      // Login as user with analytics access
      await loginUser(page, 'test@example.com', 'TestPassword123!');

      // Navigate to analytics dashboard
      await page.goto('/analytics');

      // Should load dashboard components
      await expect(page.locator('[data-testid="overview-cards"]')).toBeVisible();
      await expect(page.locator('[data-testid="test-execution-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-rate-chart"]')).toBeVisible();

      // Filter analytics by date range
      await page.selectOption('[data-testid="date-range-select"]', 'last-30-days');
      await page.click('[data-testid="apply-filters-button"]');

      // Should update charts
      await expect(page.locator('[data-testid="charts-updated"]')).toBeVisible();

      // Export analytics report
      await page.click('[data-testid="export-report-button"]');
      await page.selectOption('[data-testid="export-format-select"]', 'pdf');
      await page.click('[data-testid="download-report-button"]');

      // Should trigger download
      // Note: In a real test, you would verify the download
    });

    test('should generate and share test report', async ({ page }) => {
      // Login and navigate to test results
      await loginUser(page, 'test@example.com', 'TestPassword123!');
      await page.goto('/test-results');

      // Select completed test run
      await page.click('[data-testid="test-run-card"]').first();

      // Generate report
      await page.click('[data-testid="generate-report-button"]');

      // Configure report
      await page.check('[data-testid="include-screenshots"]');
      await page.check('[data-testid="include-logs"]');
      await page.check('[data-testid="include-metrics"]');

      // Generate and preview
      await page.click('[data-testid="preview-report-button"]');
      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible();

      // Share report
      await page.click('[data-testid="share-report-button"]');
      await page.fill('[data-testid="recipient-email"]', 'stakeholder@example.com');
      await page.fill('[data-testid="share-message"]', 'Here are the latest test results');
      await page.click('[data-testid="send-report-button"]');

      // Should show success message
      await expect(page.locator('[data-testid="share-success"]')).toContainText('Report shared successfully');
    });
  });

  test.describe('Team Collaboration Workflows', () => {
    test('should manage team members and permissions', async ({ page }) => {
      // Login as team admin
      await loginUser(page, 'admin@example.com', 'AdminPassword123!');

      // Navigate to team management
      await page.goto('/team');

      // Invite new team member
      await page.click('[data-testid="invite-member-button"]');
      await page.fill('[data-testid="member-email"]', 'newmember@example.com');
      await page.selectOption('[data-testid="member-role"]', 'developer');
      await page.click('[data-testid="send-invitation-button"]');

      // Should show invitation sent
      await expect(page.locator('[data-testid="invitation-sent"]')).toContainText('Invitation sent');

      // View team members
      await expect(page.locator('[data-testid="team-members-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="member-card"]').filter({ hasText: 'admin@example.com' })).toBeVisible();

      // Update member permissions
      await page.click('[data-testid="member-card"]').filter({ hasText: 'admin@example.com' });
      await page.click('[data-testid="edit-permissions-button"]');
      await page.check('[data-testid="permission-manage-tests"]');
      await page.check('[data-testid="permission-view-reports"]');
      await page.click('[data-testid="update-permissions-button"]');

      // Should show success message
      await expect(page.locator('[data-testid="permissions-updated"]')).toContainText('Permissions updated');
    });

    test('should collaborate on test development', async ({ page }) => {
      // Login as team member
      await loginUser(page, 'developer@example.com', 'DevPassword123!');

      // Navigate to shared test
      await page.goto('/tests/shared');

      // Open shared test
      await page.click('[data-testid="shared-test-card"]').first();

      // View test details and collaborator info
      await expect(page.locator('[data-testid="test-collaborators"]')).toBeVisible();

      // Add comment to test
      await page.click('[data-testid="add-comment-button"]');
      await page.fill('[data-testid="comment-input"]', 'I think we should add more assertions here');
      await page.click('[data-testid="post-comment-button"]');

      // Should show comment
      await expect(page.locator('[data-testid="test-comment"]').filter({ hasText: 'I think we should add more assertions here' })).toBeVisible();

      // Suggest edit
      await page.click('[data-testid="suggest-edit-button"]');
      await page.fill('[data-testid="edit-suggestion"]', 'Add assertion for element visibility');
      await page.click('[data-testid="submit-suggestion-button"]');

      // Should show suggestion
      await expect(page.locator('[data-testid="edit-suggestion"]')).toContainText('Add assertion for element visibility');
    });
  });

  test.describe('Cross-Browser Testing Workflows', () => {
    test('should execute test across multiple browsers', async ({ page }) => {
      // Login and navigate to test
      await loginUser(page, 'test@example.com', 'TestPassword123!');
      await page.goto('/tests');

      // Select test for cross-browser execution
      await page.click('[data-testid="test-card"]').first();

      // Configure cross-browser execution
      await page.click('[data-testid="cross-browser-mode"]');
      await page.check('[data-testid="browser-chrome"]');
      await page.check('[data-testid="browser-firefox"]');
      await page.check('[data-testid="browser-safari"]');
      await page.selectOption('[data-testid="viewport-select"]', 'desktop');

      // Execute cross-browser tests
      await page.click('[data-testid="run-cross-browser-button"]');

      // Should show parallel execution
      await expect(page.locator('[data-testid="parallel-execution"]')).toBeVisible();

      // Wait for all tests to complete
      await expect(page.locator('[data-testid="all-tests-complete"]')).toBeVisible({ timeout: 180000 });

      // View cross-browser results
      await expect(page.locator('[data-testid="browser-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="chrome-result"]')).toBeVisible();
      await expect(page.locator('[data-testid="firefox-result"]')).toBeVisible();
      await expect(page.locator('[data-testid="safari-result"]')).toBeVisible();

      // View comparison report
      await page.click('[data-testid="view-comparison-button"]');
      await expect(page.locator('[data-testid="comparison-report"]')).toBeVisible();
    });
  });

  test.describe('API Testing Workflows', () => {
    test('should create and execute API test suite', async ({ page }) => {
      // Login and navigate to API testing
      await loginUser(page, 'test@example.com', 'TestPassword123!');
      await page.goto('/api-testing');

      // Create new API test
      await page.click('[data-testid="new-api-test-button"]');
      await page.fill('[data-testid="test-name-input"]', 'User API Test Suite');

      // Add API request
      await page.click('[data-testid="add-request-button"]');
      await page.selectOption('[data-testid="request-method"]', 'GET');
      await page.fill('[data-testid="request-url"]', 'https://api.example.com/users');
      await page.click('[data-testid="add-request"]');

      // Add assertions
      await page.click('[data-testid="add-assertion-button"]');
      await page.selectOption('[data-testid="assertion-type"]', 'status-code');
      await page.fill('[data-testid="assertion-value"]', '200');
      await page.click('[data-testid="add-assertion"]');

      // Save API test
      await page.click('[data-testid="save-api-test-button"]');

      // Execute API test
      await page.click('[data-testid="run-api-test-button"]');

      // Should show execution results
      await expect(page.locator('[data-testid="api-test-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="request-response"]')).toBeVisible();
      await expect(page.locator('[data-testid="assertion-results"]')).toBeVisible();
    });
  });

  // Helper function to login user
  async function loginUser(page: any, email: string, password: string) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  }
});