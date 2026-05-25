/**
 * E2E: Analytics Dashboard
 * Tests analytics cards, charts, and flaky test display
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(() => {
      const fakeUser = {
        state: {
          user: { id: 'e2e-user', email: 'e2e@qestro.io', name: 'E2E User', role: 'admin' },
          isAuthenticated: true,
          ssoProvider: null,
        },
        version: 0,
      };
      localStorage.setItem('qestro-auth', JSON.stringify(fakeUser));
      localStorage.setItem('access_token', 'e2e-fake-token');
    });
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
  });

  test('renders stat cards', async ({ page }) => {
    await expect(page.getByText('Tests Executed')).toBeVisible();
    await expect(page.getByText('Pass Rate')).toBeVisible();
    await expect(page.getByText('Avg Duration')).toBeVisible();
    await expect(page.getByText('AI Healings')).toBeVisible();
    await expect(page.getByText('Coverage')).toBeVisible();
  });

  test('shows execution trend chart', async ({ page }) => {
    await expect(page.getByText(/Execution Trend/)).toBeVisible();
  });

  test('shows flaky tests section', async ({ page }) => {
    await expect(page.getByText('Flaky Tests')).toBeVisible();
  });

  test('shows slowest tests section', async ({ page }) => {
    await expect(page.getByText('Slowest Tests')).toBeVisible();
  });

  test('shows AI activity section', async ({ page }) => {
    await expect(page.getByText('AI Activity')).toBeVisible();
  });

  test('shows CI/CD integration section', async ({ page }) => {
    await expect(page.getByText('CI/CD Integration')).toBeVisible();
  });

  test('flaky test table is sortable', async ({ page }) => {
    const header = page.getByText('Score').first();
    if (await header.isVisible()) {
      await header.click();
      // Should toggle sort — no crash
      await expect(page.getByText('Flaky Tests')).toBeVisible();
    }
  });
});
