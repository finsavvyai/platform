/**
 * E2E: Visual Regression Page
 * Tests the visual regression workflow — URL input, run test, view results
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Visual Regression', () => {
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
    await page.goto(`${BASE_URL}/visual-regression`);
    await page.waitForLoadState('networkidle');
  });

  test('renders page title and Quick Run form', async ({ page }) => {
    await expect(page.getByText('Visual Regression')).toBeVisible();
    await expect(page.getByPlaceholder('https://your-app.com/page')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. dashboard-header')).toBeVisible();
    await expect(page.getByRole('button', { name: /run test/i })).toBeVisible();
  });

  test('shows filter buttons', async ({ page }) => {
    await expect(page.getByText('All Results')).toBeVisible();
    await expect(page.getByText('Passed')).toBeVisible();
    await expect(page.getByText('Failed')).toBeVisible();
    await expect(page.getByText('New')).toBeVisible();
  });

  test('shows empty state when no results', async ({ page }) => {
    await expect(page.getByText(/select a result|no results/i)).toBeVisible();
  });

  test('Run Test button disabled without input', async ({ page }) => {
    const runButton = page.getByRole('button', { name: /run test/i });
    await expect(runButton).toBeDisabled();
  });

  test('Run Test button enabled with input', async ({ page }) => {
    await page.getByPlaceholder('https://your-app.com/page').fill('https://example.com');
    await page.getByPlaceholder('e.g. dashboard-header').fill('test-baseline');
    const runButton = page.getByRole('button', { name: /run test/i });
    await expect(runButton).toBeEnabled();
  });

  test('mobile responsive — no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('Visual Regression')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
