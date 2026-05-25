import { test, expect } from '@playwright/test';

/**
 * Verify ALL admin routes redirect unauthenticated users to sign-in.
 * With Clerk middleware protecting /admin(.*), these should cleanly
 * redirect rather than loop.
 */
const ADMIN_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/instances',
  '/admin/organizations',
  '/admin/billing',
  '/admin/events',
  '/admin/skills',
];

test.describe('Admin Auth Redirects', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route} redirects to sign-in`, async ({ page }) => {
      await page.goto(route);
      const url = page.url();
      // Clerk middleware should redirect unauthenticated users to sign-in
      expect(url).toContain('sign-in');
    });
  }
});
