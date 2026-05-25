/**
 * Recording Workflow Test Suite
 * Comprehensive tests for the recording functionality
 */

import { test, expect, TestDataGenerator } from '../fixtures/advancedTestFixtures';
import { RecordingPage } from '../pages/RecordingPage';

test.describe('Recording Workflow', () => {
  test.beforeEach(async ({ page, testDataManager }) => {
    // Set up test environment
    await testDataManager.initialize();
  });

  test('should record basic user interactions', async ({ 
    recordingPage, 
    automationUtils,
    testDataManager 
  }) => {
    // Navigate to recording page
    await recordingPage.goto();
    await recordingPage.waitForLoad();

    // Start recording
    await recordingPage.startRecording();
    
    // Verify recording indicator is visible
    expect(await recordingPage.isRecording()).toBe(true);

    // Simulate user interactions on a test form
    await recordingPage.page.goto('/test-form');
    await recordingPage.page.fill('#username', 'testuser');
    await recordingPage.page.fill('#email', 'test@example.com');
    await recordingPage.page.click('#submit-button');

    // Stop recording
    await recordingPage.stopRecording();
    
    // Verify recording stopped
    expect(await recordingPage.isRecording()).toBe(false);

    // Check recorded actions
    const actions = await recordingPage.getRecordedActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions).toContain(expect.stringContaining('type'));
    expect(actions).toContain(expect.stringContaining('click'));
  });

  test('should generate smart selectors for elements', async ({ 
    recordingPage, 
    automationUtils 
  }) => {
    await recordingPage.goto();
    await recordingPage.page.goto('/test-form');

    // Get an element and generate selectors
    const submitButton = recordingPage.page.locator('#submit-button');
    const strategies = await automationUtils.generateSelectorStrategies(submitButton);

    // Verify multiple selector strategies are generated
    expect(strategies.length).toBeGreaterThan(1);
    
    // Verify data-testid has highest priority if available
    const dataTestIdStrategy = strategies.find(s => s.type === 'data-testid');
    if (dataTestIdStrategy) {
      expect(dataTestIdStrategy.priority).toBe(1);
    }

    // Verify ID strategy is present
    const idStrategy = strategies.find(s => s.type === 'css' && s.value.includes('#'));
    expect(idStrategy).toBeDefined();
  });

  test('should add and manage assertions', async ({ recordingPage }) => {
    await recordingPage.goto();
    await recordingPage.startRecording();

    // Navigate to test page
    await recordingPage.page.goto('/dashboard');
    
    // Add various types of assertions
    await recordingPage.addAssertion('text', 'h1', 'Dashboard');
    await recordingPage.addAssertion('visibility', '[data-testid=user-menu]', 'visible');
    await recordingPage.addAssertion('value', '#search-input', '');

    // Stop recording
    await recordingPage.stopRecording();

    // Verify assertions were added
    const assertions = await recordingPage.getAssertions();
    expect(assertions.length).toBe(3);
    expect(assertions).toContain(expect.stringContaining('Dashboard'));
    expect(assertions).toContain(expect.stringContaining('visible'));
  });

  test('should parameterize form inputs', async ({ recordingPage }) => {
    await recordingPage.goto();
    await recordingPage.startRecording();

    // Navigate to form page
    await recordingPage.page.goto('/test-form');
    await recordingPage.page.fill('#username', 'testuser');
    await recordingPage.page.fill('#email', 'test@example.com');

    await recordingPage.stopRecording();

    // Parameterize the inputs
    await recordingPage.parameterizeInput('#username', 'username');
    await recordingPage.parameterizeInput('#email', 'email');

    // Set test data
    await recordingPage.setTestData({
      username: 'john_doe',
      email: 'john@example.com'
    });

    // Verify parameterization worked
    const actions = await recordingPage.getRecordedActions();
    expect(actions).toContain(expect.stringContaining('{{username}}'));
    expect(actions).toContain(expect.stringContaining('{{email}}'));
  });

  test('should export test in multiple formats', async ({ recordingPage }) => {
    await recordingPage.goto();
    await recordingPage.startRecording();

    // Record some basic interactions
    await recordingPage.page.goto('/login');
    await recordingPage.page.fill('#email', 'test@example.com');
    await recordingPage.page.fill('#password', 'password');
    await recordingPage.page.click('#login-button');

    await recordingPage.stopRecording();

    // Test exporting in different formats
    const formats = ['playwright', 'cypress', 'selenium'] as const;
    
    for (const format of formats) {
      await recordingPage.exportTest(format);
      // Verify export was successful (would check download or API response)
      await recordingPage.expectElementToBeVisible('[data-testid=export-success]');
    }
  });

  test('should validate recorded test', async ({ recordingPage }) => {
    await recordingPage.goto();
    await recordingPage.startRecording();

    // Record a complete workflow
    await recordingPage.page.goto('/login');
    await recordingPage.page.fill('#email', 'test@example.com');
    await recordingPage.page.fill('#password', 'password');
    await recordingPage.page.click('#login-button');
    await recordingPage.page.waitForURL('**/dashboard');

    await recordingPage.stopRecording();

    // Add assertions
    await recordingPage.addAssertion('text', 'h1', 'Dashboard');

    // Validate the test
    const isValid = await recordingPage.validateTest();
    expect(isValid).toBe(true);

    // Check for validation errors
    const errors = await recordingPage.getValidationErrors();
    expect(errors.length).toBe(0);
  });

  test('should record with performance metrics', async ({ 
    recordingPage, 
    performanceMonitor 
  }) => {
    await recordingPage.goto();
    await recordingPage.recordWithPerformanceMetrics();

    // Navigate to a page and perform actions
    await recordingPage.page.goto('/dashboard');
    await recordingPage.page.waitForLoadState('networkidle');

    // Get performance metrics
    const metrics = await performanceMonitor.getMetrics();
    
    expect(metrics.domContentLoaded).toBeGreaterThan(0);
    expect(metrics.loadComplete).toBeGreaterThan(0);
    expect(metrics.firstContentfulPaint).toBeGreaterThan(0);

    await recordingPage.stopRecording();

    // Verify performance data was captured
    const performanceMetrics = await recordingPage.getPerformanceMetrics();
    expect(performanceMetrics.totalLoadTime).toBeGreaterThan(0);
  });

  test('should record mobile interactions', async ({ 
    recordingPage,
    mobileContext 
  }) => {
    const mobilePage = await mobileContext.newPage();
    const mobileRecordingPage = new (recordingPage.constructor as any)(mobilePage);

    await mobileRecordingPage.goto();
    await mobileRecordingPage.recordMobileInteractions('iPhone 12');

    // Perform mobile-specific interactions
    await mobilePage.goto('/mobile-app');
    await mobilePage.tap('[data-testid=menu-button]');
    await mobilePage.swipe('[data-testid=carousel]', { direction: 'left' });

    await mobileRecordingPage.stopRecording();

    // Verify mobile interactions were recorded
    const actions = await mobileRecordingPage.getRecordedActions();
    expect(actions).toContain(expect.stringContaining('tap'));
    expect(actions).toContain(expect.stringContaining('swipe'));

    await mobilePage.close();
  });

  test('should handle recording errors gracefully', async ({ recordingPage }) => {
    await recordingPage.goto();
    await recordingPage.startRecording();

    // Simulate an error scenario
    await recordingPage.page.goto('/non-existent-page');
    
    // The recording should continue despite the error
    expect(await recordingPage.isRecording()).toBe(true);

    // Navigate to a valid page
    await recordingPage.page.goto('/dashboard');
    await recordingPage.page.click('[data-testid=user-menu]');

    await recordingPage.stopRecording();

    // Verify some actions were still recorded
    const actions = await recordingPage.getRecordedActions();
    expect(actions.length).toBeGreaterThan(0);
  });

  test('should support pause and resume recording', async ({ recordingPage }) => {
    await recordingPage.goto();
    await recordingPage.startRecording();

    // Record some actions
    await recordingPage.page.goto('/dashboard');
    await recordingPage.page.click('[data-testid=create-test]');

    // Pause recording
    await recordingPage.pauseRecording();
    
    // Perform actions that shouldn't be recorded
    await recordingPage.page.click('[data-testid=help-button]');
    await recordingPage.page.click('[data-testid=close-help]');

    // Resume recording
    await recordingPage.resumeRecording();
    
    // Record more actions
    await recordingPage.page.fill('[data-testid=test-name]', 'My Test');
    await recordingPage.page.click('[data-testid=save-test]');

    await recordingPage.stopRecording();

    // Verify only actions before pause and after resume were recorded
    const actions = await recordingPage.getRecordedActions();
    expect(actions).toContain(expect.stringContaining('create-test'));
    expect(actions).toContain(expect.stringContaining('test-name'));
    expect(actions).not.toContain(expect.stringContaining('help-button'));
  });
});