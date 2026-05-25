import type { Page, Route } from '@playwright/test';

/**
 * API response mocks for visual tests.
 *
 * Visual diffs need deterministic data: real API responses change by the
 * second (new findings, new alert counts, rotating feature flags) and would
 * produce noisy diffs on every run. We intercept the relevant endpoints
 * and return fixed fixtures for each page under test.
 */

export type MockRecipe = {
  urlPattern: string | RegExp;
  body: unknown;
  status?: number;
};

const emptyMetrics: Record<string, unknown> = {
  totals: { agents: 0, findings: 0, alerts: 0, incidents: 0 },
  trends: { findings: [], alerts: [], mttr: [] },
  posture: { score: 100, delta: 0 },
  generatedAt: '2026-01-01T00:00:00.000Z',
};

export const DASHBOARD_HOME_MOCKS: MockRecipe[] = [
  { urlPattern: /\/api\/dashboard\/metrics/, body: emptyMetrics },
  { urlPattern: /\/api\/agents(\?.*)?$/, body: { data: [] } },
  { urlPattern: /\/api\/alerts(\?.*)?$/, body: { data: [] } },
  { urlPattern: /\/api\/notifications(\?.*)?$/, body: { data: [] } },
];

export const MARKETPLACE_MOCKS: MockRecipe[] = [
  {
    urlPattern: /\/api\/marketplace\/skills/,
    body: {
      data: [
        {
          id: 'skill-demo-1',
          name: 'AI Reasoning Engine',
          description: 'Root cause + risk scoring',
          price: 0,
          category: 'ai',
          downloads: 1234,
        },
        {
          id: 'skill-demo-2',
          name: 'AI Triage',
          description: 'Batch finding prioritization',
          price: 0,
          category: 'ai',
          downloads: 987,
        },
      ],
    },
  },
  { urlPattern: /\/api\/marketplace\/bundles/, body: { data: [] } },
  { urlPattern: /\/api\/marketplace\/installed/, body: { data: [] } },
];

export const ADMIN_METRICS_MOCKS: MockRecipe[] = [
  {
    urlPattern: /\/api\/admin\/metrics/,
    body: {
      users: { total: 0, active: 0, new7d: 0 },
      orgs: { total: 0, paid: 0 },
      revenue: { mrr: 0, arr: 0 },
      agents: { total: 0, healthy: 0 },
      generatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
  { urlPattern: /\/api\/admin\/health/, body: { status: 'ok' } },
];

export async function applyMocks(page: Page, recipes: MockRecipe[]): Promise<void> {
  for (const recipe of recipes) {
    await page.route(recipe.urlPattern, async (route: Route) => {
      await route.fulfill({
        status: recipe.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(recipe.body),
      });
    });
  }
}
