import { test, expect } from '@playwright/test';

/**
 * Verify ALL protected dashboard and admin routes redirect
 * unauthenticated users to the sign-in page.
 * Extends dashboard-redirects.spec.ts with admin routes
 * and additional dashboard sub-pages.
 */
const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/security',
  '/dashboard/marketplace',
  '/dashboard/team',
  '/dashboard/settings',
  '/dashboard/agents',
  '/dashboard/cloud',
  '/dashboard/assets',
  '/dashboard/attack-paths',
  '/dashboard/logs',
  '/dashboard/skills',
  '/dashboard/oasf',
  '/dashboard/sla',
  '/dashboard/soc2',
  '/dashboard/achievements',
  '/dashboard/integrations',
  '/dashboard/policies',
  '/dashboard/profile',
  '/dashboard/bundles',
  '/dashboard/kill-chain',
  '/dashboard/mcp-monitoring',
  '/dashboard/rule-engine',
  '/dashboard/slo-dashboard',
  '/dashboard/threat-feed',
  '/dashboard/getting-started',
];

const ADMIN_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/instances',
  '/admin/organizations',
  '/admin/billing',
  '/admin/skills',
  '/admin/events',
  '/admin/audit',
  '/admin/metrics',
];

test.describe('Dashboard Auth Guard — dashboard routes', () => {
  for (const route of DASHBOARD_ROUTES) {
    test(`${route} redirects to /sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 });
    });
  }
});

test.describe('Dashboard Auth Guard — admin routes', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route} redirects to /sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 });
    });
  }
});
