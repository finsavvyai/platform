/**
 * Dashboard Functionality Tests
 * Tests for dashboard page interactions and features
 */

import { test, expect } from '../fixtures/testFixtures';
import { testData } from '../fixtures/testFixtures';
import { PlaywrightTestHelpers } from '../utils/testHelpers';

test.describe('Dashboard Functionality', () => {
  test('should display dashboard correctly for authenticated user', async ({ authenticatedPage, dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectDashboardToBeLoaded();
    await dashboardPage.expectWelcomeMessage(testData.users.validUser.name);
  });

  test('should show test list', async ({ authenticatedPage, dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForTestsToLoad();
    await dashboardPage.expectTestListToBeVisible();
  });

  test('should create new test', async ({ authenticatedPage, dashboardPage, page }) => {
    // Mock API response for test creation
    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/tests', {
      success: true,
      test: { id: '123', name: 'New Test' }
    });

    await dashboardPage.goto();
    await dashboardPage.createNewTest();
    
    // Should navigate to test creation page
    await dashboardPage.expectUrlToMatch('**/tests/create');
  });

  test('should start recording session', async ({ authenticatedPage, dashboardPage, page }) => {
    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/recording/start', {
      success: true,
      sessionId: 'session-123'
    });

    await dashboardPage.goto();
    
    // Check if recording button is enabled
    const isEnabled = await dashboardPage.isRecordingButtonEnabled();
    expect(isEnabled).toBe(true);
    
    await dashboardPage.startRecording();
    
    // Should show recording indicator or navigate to recording page
    await page.waitForURL('**/recording/**');
  });

  test('should search tests', async ({ authenticatedPage, dashboardPage, page }) => {
    // Mock search API response
    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/tests/search*', {
      success: true,
      tests: [
        { id: '1', name: 'Login Test', type: 'web' },
        { id: '2', name: 'API Test', type: 'api' }
      ]
    });

    await dashboardPage.goto();
    await dashboardPage.searchTests('login');
    
    // Wait for search results
    await PlaywrightTestHelpers.waitForApiCall(page, '**/api/tests/search*');
    await dashboardPage.expectTestToExist('Login Test');
  });

  test('should filter tests by type', async ({ authenticatedPage, dashboardPage, page }) => {
    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/tests*', {
      success: true,
      tests: [
        { id: '1', name: 'Web Test', type: 'web' },
        { id: '2', name: 'API Test', type: 'api' }
      ]
    });

    await dashboardPage.goto();
    await dashboardPage.filterTests('web');
    
    await dashboardPage.expectTestToExist('Web Test');
  });

  test('should select and view test details', async ({ authenticatedPage, dashboardPage, page }) => {
    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/tests*', {
      success: true,
      tests: [
        { id: '1', name: 'Sample Test', type: 'web' }
      ]
    });

    await dashboardPage.goto();
    await dashboardPage.waitForTestsToLoad();
    await dashboardPage.selectTest('Sample Test');
    
    // Should navigate to test details
    await page.waitForURL('**/tests/**');
  });

  test('should logout successfully', async ({ authenticatedPage, dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.logout();
    
    // Should redirect to login page
    await page.waitForURL('**/login');
  });

  test('should navigate to settings', async ({ authenticatedPage, dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.navigateToSettings();
    
    await dashboardPage.expectUrlToMatch('**/settings');
  });
});

test.describe('Dashboard Data Management', () => {
  test('should handle empty test list', async ({ authenticatedPage, dashboardPage, page }) => {
    // Mock empty response
    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/tests*', {
      success: true,
      tests: []
    });

    await dashboardPage.goto();
    await dashboardPage.waitForTestsToLoad();
    await dashboardPage.expectNoTestsMessage();
  });

  test('should handle API errors gracefully', async ({ authenticatedPage, dashboardPage, page }) => {
    // Mock API error
    await PlaywrightTestHelpers.mockApiError(page, '**/api/tests*', 500);

    await dashboardPage.goto();
    
    // Should show error message
    await dashboardPage.expectElementToContainText('[data-testid=error-message]', 'Failed to load tests');
  });

  test('should refresh data when requested', async ({ authenticatedPage, dashboardPage, page }) => {
    let callCount = 0;
    
    await page.route('**/api/tests*', route => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tests: [{ id: callCount.toString(), name: `Test ${callCount}` }]
        })
      });
    });

    await dashboardPage.goto();
    await dashboardPage.waitForTestsToLoad();
    
    // Refresh page
    await dashboardPage.reload();
    await dashboardPage.waitForTestsToLoad();
    
    // Should have made multiple API calls
    expect(callCount).toBeGreaterThan(1);
  });
});

test.describe('Dashboard Performance', () => {
  test('should load dashboard quickly', async ({ authenticatedPage, dashboardPage, page }) => {
    const startTime = Date.now();
    await dashboardPage.goto();
    await dashboardPage.expectDashboardToBeLoaded();
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large test lists efficiently', async ({ authenticatedPage, dashboardPage, page }) => {
    // Mock large dataset
    const largeTestList = Array.from({ length: 100 }, (_, i) => ({
      id: i.toString(),
      name: `Test ${i}`,
      type: 'web'
    }));

    await PlaywrightTestHelpers.mockApiResponse(page, '**/api/tests*', {
      success: true,
      tests: largeTestList
    });

    const startTime = Date.now();
    await dashboardPage.goto();
    await dashboardPage.waitForTestsToLoad();
    const renderTime = Date.now() - startTime;
    
    // Should render within reasonable time even with large dataset
    expect(renderTime).toBeLessThan(5000);
  });
});

test.describe('Dashboard Responsive Design', () => {
  test('should work on tablet devices', async ({ authenticatedPage, dashboardPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await dashboardPage.goto();
    await dashboardPage.expectDashboardToBeLoaded();
    
    // Navigation should be accessible
    await dashboardPage.expectElementToBeVisible('[data-testid=navigation-menu]');
  });

  test('should work on mobile devices', async ({ authenticatedPage, dashboardPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await dashboardPage.goto();
    await dashboardPage.expectDashboardToBeLoaded();
    
    // Mobile navigation should be present
    await dashboardPage.expectElementToBeVisible('[data-testid=mobile-menu-button]');
  });

  test('should adapt layout for different screen sizes', async ({ authenticatedPage, dashboardPage, page }) => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1920, height: 1080 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await dashboardPage.goto();
      await dashboardPage.expectDashboardToBeLoaded();
      
      // Take screenshot for visual regression testing
      await PlaywrightTestHelpers.takeTimestampedScreenshot(
        page, 
        `dashboard-${viewport.width}x${viewport.height}`
      );
    }
  });
});