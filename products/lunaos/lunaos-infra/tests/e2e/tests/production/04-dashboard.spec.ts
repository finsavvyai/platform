import { test, expect } from '@playwright/test';

/**
 * Production Test: Dashboard Experience
 *
 * Tests the authenticated dashboard at agents.lunaos.ai.
 * Verifies navigation, page structure, and key features.
 * Note: Without real credentials, tests verify unauthenticated behavior.
 */

const DASHBOARD = 'https://agents.lunaos.ai';

test.describe('Dashboard — agents.lunaos.ai', () => {
  test('root redirects to landing or login', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const validState = url.includes('agents.lunaos.ai');
    expect(validState).toBe(true);
  });

  test('landing page has nav with Login and Get Started', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    // Nav has Login link and Get Started button
    await expect(nav.getByText('Login')).toBeVisible();
    await expect(nav.getByText('Get Started')).toBeVisible();
  });

  test('landing page shows agent info', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.waitForLoadState('networkidle');
    // Badge text: "28 AI agents · Now in beta"
    const body = await page.textContent('body');
    expect(body).toContain('28');
    expect(body).toContain('AI agent');
  });

  test('landing page hero has CTA', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.waitForLoadState('networkidle');
    // CTA: "Start for Free" or "Create Free Account"
    const cta = page.locator('a[href*="/auth/signup"]').first();
    await expect(cta).toBeVisible();
  });

  test('dashboard routes redirect to login when unauthenticated', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/agents',
      '/dashboard/api-keys',
      '/dashboard/settings',
      '/dashboard/billing',
    ];

    for (const route of protectedRoutes) {
      await page.goto(`${DASHBOARD}${route}`);
      await page.waitForLoadState('networkidle');
      const url = page.url();
      const isProtected = url.includes('/auth/login') ||
        url.includes('/auth/signup') ||
        url === `${DASHBOARD}/`;
      expect(isProtected).toBe(true);
    }
  });

  test('pricing page is accessible from dashboard', async ({ page }) => {
    await page.goto(`${DASHBOARD}/pricing`);
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
