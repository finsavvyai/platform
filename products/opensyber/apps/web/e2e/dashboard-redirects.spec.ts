import { test, expect } from '@playwright/test';

/**
 * Verify ALL protected dashboard routes redirect unauthenticated users to sign-in.
 * This is a critical security test — no dashboard content should leak without auth.
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/dashboard/agents',
  '/dashboard/agents/policies',
  '/dashboard/agents/violations',
  '/dashboard/agents/alert-channels',
  '/dashboard/agents/team',
  '/dashboard/assets',
  '/dashboard/attack-paths',
  '/dashboard/cloud',
  '/dashboard/cloud/findings',
  '/dashboard/logs',
  '/dashboard/marketplace',
  '/dashboard/oasf',
  '/dashboard/security',
  '/dashboard/security/alerts',
  '/dashboard/security/alert-rules',
  '/dashboard/security/compliance',
  '/dashboard/security/files',
  '/dashboard/security/incidents',
  '/dashboard/security/network',
  '/dashboard/security/policies',
  '/dashboard/security/threats',
  '/dashboard/security/uptime',
  '/dashboard/security/vulnerabilities',
  '/dashboard/settings',
  '/dashboard/settings/notifications',
  '/dashboard/skills',
  '/dashboard/skills/submit',
  '/dashboard/sla',
  '/dashboard/soc2',
  '/dashboard/team',
  '/dashboard/team/residency',
  '/dashboard/team/settings',
  '/dashboard/team/sso',
  '/dashboard/achievements',
];

test.describe('Dashboard Auth Redirects', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to sign-in`, async ({ page }) => {
      // Clerk middleware cold-start can take 15-25s on parallel requests
      await page.goto(route, { waitUntil: 'commit' });
      await expect(page).toHaveURL(/sign-in/, { timeout: 29_000 });
    });
  }
});
