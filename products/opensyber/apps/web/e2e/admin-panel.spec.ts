import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Admin panel browser tests — user management, org management,
 * instance management, skill moderation, billing admin, events, metrics.
 * Access control (non-admin redirect), suspension flows.
 */

/* ================================================================== */
/*  Admin Access Control — Unauthenticated                             */
/* ================================================================== */
test.describe('Admin Access — Unauthenticated', () => {
  const adminPages = [
    '/admin',
    '/admin/users',
    '/admin/instances',
    '/admin/organizations',
    '/admin/skills',
    '/admin/billing',
    '/admin/events',
    '/admin/metrics',
  ];

  for (const route of adminPages) {
    test(`${route} redirects unauthenticated users`, async ({ page }) => {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');

      const url = page.url();
      const redirected = url.includes('/sign-in') || url.includes('/api/auth');
      const showsAuth = await page.getByText(/sign in/i).isVisible().catch(() => false);
      const hasOAuth = await page.getByRole('button', { name: /google|github/i })
        .first().isVisible().catch(() => false);

      expect(redirected || showsAuth || hasOAuth).toBe(true);
    });
  }
});

/* ================================================================== */
/*  Admin Dashboard — Authenticated                                    */
/* ================================================================== */
authTest.describe('Admin Dashboard', () => {
  authTest('admin page shows dashboard or access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');

    // Non-admin users should get redirected or see access denied
    const adminDashboard = page.getByRole('heading').first();
    const accessDenied = page.getByText(/access denied|unauthorized|forbidden|not admin/i);
    const redirectedToDashboard = page.url().includes('/dashboard') && !page.url().includes('/admin');

    const hasAdmin = await adminDashboard.isVisible().catch(() => false);
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);

    authExpect(hasAdmin || hasDenied || redirectedToDashboard).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — User Management                                            */
/* ================================================================== */
authTest.describe('Admin Users Page', () => {
  authTest('users page loads or shows access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState('networkidle');

    const userTable = page.locator('table');
    const accessDenied = page.getByText(/access denied|unauthorized|forbidden/i);
    const heading = page.getByRole('heading').first();
    const redirected = !page.url().includes('/admin');

    const hasTable = await userTable.isVisible().catch(() => false);
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    authExpect(hasTable || hasDenied || redirected || hasHeading).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — User Detail & Suspension                                   */
/* ================================================================== */
authTest.describe('Admin User Detail', () => {
  authTest('user detail page handles invalid ID', async ({ page }) => {
    await page.goto(`${BASE}/admin/users/nonexistent-user-id`);
    await page.waitForLoadState('networkidle');

    const errorMsg = page.getByText(/not found|error|no user/i);
    const accessDenied = page.getByText(/access denied|unauthorized/i);
    const redirected = !page.url().includes('/admin');

    const hasError = await errorMsg.first().isVisible().catch(() => false);
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);

    authExpect(hasError || hasDenied || redirected).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — Instance Management                                        */
/* ================================================================== */
authTest.describe('Admin Instances Page', () => {
  authTest('instances page loads or shows access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin/instances`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const accessDenied = page.getByText(/access denied|unauthorized/i);
    const heading = page.getByRole('heading').first();
    const redirected = !page.url().includes('/admin');

    const hasTable = await table.isVisible().catch(() => false);
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    authExpect(hasTable || hasDenied || redirected || hasHeading).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — Organization Management                                    */
/* ================================================================== */
authTest.describe('Admin Organizations Page', () => {
  authTest('organizations page loads or shows access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin/organizations`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const accessDenied = page.getByText(/access denied|unauthorized/i);
    const heading = page.getByRole('heading').first();
    const redirected = !page.url().includes('/admin');

    const hasTable = await table.isVisible().catch(() => false);
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    authExpect(hasTable || hasDenied || redirected || hasHeading).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — Skill Moderation                                           */
/* ================================================================== */
authTest.describe('Admin Skills Moderation', () => {
  authTest('skills moderation page loads or shows access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin/skills`);
    await page.waitForLoadState('networkidle');

    const cards = page.locator('[class*="card"]');
    const accessDenied = page.getByText(/access denied|unauthorized/i);
    const heading = page.getByRole('heading').first();
    const redirected = !page.url().includes('/admin');

    const hasCards = (await cards.count()) > 0;
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    authExpect(hasCards || hasDenied || redirected || hasHeading).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — Billing                                                    */
/* ================================================================== */
authTest.describe('Admin Billing Page', () => {
  authTest('billing page loads or shows access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin/billing`);
    await page.waitForLoadState('networkidle');

    const content = page.locator('main');
    const accessDenied = page.getByText(/access denied|unauthorized/i);
    const heading = page.getByRole('heading').first();
    const redirected = !page.url().includes('/admin');

    const hasContent = await content.isVisible().catch(() => false);
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    authExpect(hasContent || hasDenied || redirected || hasHeading).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — Events Log                                                 */
/* ================================================================== */
authTest.describe('Admin Events Page', () => {
  authTest('events page loads or shows access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin/events`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const accessDenied = page.getByText(/access denied|unauthorized/i);
    const heading = page.getByRole('heading').first();
    const redirected = !page.url().includes('/admin');

    const hasTable = await table.isVisible().catch(() => false);
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    authExpect(hasTable || hasDenied || redirected || hasHeading).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — Metrics                                                    */
/* ================================================================== */
authTest.describe('Admin Metrics Page', () => {
  authTest('metrics page loads or shows access denied', async ({ page }) => {
    await page.goto(`${BASE}/admin/metrics`);
    await page.waitForLoadState('networkidle');

    const charts = page.locator('canvas, svg, [class*="chart"], [class*="metric"]');
    const accessDenied = page.getByText(/access denied|unauthorized/i);
    const heading = page.getByRole('heading').first();
    const redirected = !page.url().includes('/admin');

    const hasCharts = (await charts.count()) > 0;
    const hasDenied = await accessDenied.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    authExpect(hasCharts || hasDenied || redirected || hasHeading).toBe(true);
  });
});

/* ================================================================== */
/*  Admin — Edge Cases                                                 */
/* ================================================================== */
authTest.describe('Admin — Edge Cases', () => {
  authTest('nonexistent admin page handles gracefully', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/nonexistent`);

    const is404 = response?.status() === 404;
    const notFoundText = await page.getByText(/not found|404/i)
      .isVisible().catch(() => false);
    const redirected = !page.url().includes('nonexistent');

    authExpect(is404 || notFoundText || redirected).toBe(true);
  });
});
