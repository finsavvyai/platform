import type { Page } from '@playwright/test';

/** Mock an API endpoint with a JSON response (wraps in { data }). */
export async function mockAPI(
  page: Page,
  pattern: string,
  data: unknown,
  status = 200,
) {
  await page.route(`**${pattern}`, route =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    }),
  );
}

/** Mock an API endpoint with raw JSON (no wrapper). */
export async function mockRaw(
  page: Page,
  pattern: string,
  body: unknown,
  status = 200,
) {
  await page.route(`**${pattern}`, route =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  );
}

/** Seed common dashboard API mocks. */
export async function mockDashboard(page: Page) {
  // useAnalytics → api.get → fetchApi returns raw JSON
  await mockRaw(page, '/api/v1/analytics*', {
    totalAlerts: 42, clearedAlerts: 28, escalatedAlerts: 5,
    avgResolutionTime: 2.5, screeningVolume: [],
    dispositionBreakdown: [], riskDistribution: [],
    topEntities: [
      { name: 'Entity A', alerts: 10, risk: 'High' },
    ],
  });
  // ComplianceMetrics → raw fetch → accesses resp.data
  await mockAPI(page, '/api/v1/dashboard/compliance', {
    openCases: 5, activeMonitors: 3, highRiskEntities: 2,
    pendingEDD: 1, unreviewedMedia: 4, txnAlerts: 7,
  });
}
