import { test, expect } from '@playwright/test';
import { setupAuth } from './auth-setup';
import { mockDashboard } from './mocks';

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'Sidebar nav labels hidden on mobile');
    await setupAuth(page);
    await mockDashboard(page);
    // Mock all page APIs to avoid 404 flickers
    await page.route('**/api/v1/**', route => {
      const url = route.request().url();
      if (url.includes('auth/me') || url.includes('analytics') ||
          url.includes('dashboard')) {
        return route.fallback();
      }
      if (url.includes('/quota')) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { used: 0, limit: -1, remaining: 0 } }),
        });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      });
    });
  });

  test('renders all section titles', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav p').filter({ hasText: /main/i }).first()).toBeVisible();
    await expect(page.locator('nav p').filter({ hasText: /compliance/i }).first()).toBeVisible();
    await expect(page.locator('nav p').filter({ hasText: /system/i }).first()).toBeVisible();
  });

  test('navigates to cases page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Cases' }).click();
    await page.waitForURL('**/compliance/cases');
    await expect(page.getByText('Case Management')).toBeVisible();
  });

  test('navigates to PEP screening', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'PEP Screening' }).click();
    await page.waitForURL('**/compliance/pep');
    await expect(page.getByRole('heading', { name: 'PEP & Sanctions Screening' })).toBeVisible();
  });

  test('navigates to risk assessment', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Risk Assessment' }).click();
    await page.waitForURL('**/compliance/risk');
  });

  test('navigates to analytics', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Analytics' }).click();
    await page.waitForURL('**/analytics');
  });
});
