/**
 * Shared Dashboard API Mocks for E2E Tests
 * Provides mock responses for dashboard stats and health APIs
 */

import { Page } from '@playwright/test';

export const mockDashboardStatsData = {
  success: true,
  data: {
    testCases: { total: 50, active: 40, byType: {} },
    devices: { total: 5, available: 3, busy: 2 },
    projects: { total: 3 },
    execution: {
      coverage: 89,
      statusBreakdown: { passed: 75, failed: 15, pending: 10 },
    },
    security: {
      score: 98,
      grade: 'A+',
      criticalIssues: 0,
      posture: { auth: 120, data: 98, infra: 86, api: 99, client: 85, gdpr: 65 },
    },
    aiStats: { selfHealed: 42, generated: 18, optimizedTimeMs: 3500 },
    liveFeed: [],
  },
};

export const mockDashboardHealthData = {
  success: true,
  data: { status: 'OPTIMAL' },
};

/**
 * Mock dashboard API endpoints.
 * Must be called BEFORE page.goto() so the routes intercept on first load.
 */
export async function mockDashboardAPIs(page: Page) {
  await page.route('**/api/dashboard/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockDashboardStatsData),
    });
  });

  await page.route('**/api/dashboard/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockDashboardHealthData),
    });
  });
}
