import { test, expect } from '@playwright/test';
import { setupAuth, mockRuns, mockProjects } from './fixtures';

test.describe('Dashboard (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    // Mock API responses for authenticated endpoints
    await page.route('**/api/user/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.route('**/api/runs', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: mockRuns }),
      }),
    );

    await page.route('**/api/projects', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projects: mockProjects }),
      }),
    );

    await page.route('**/api/cloud/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pool: { total: 0, idle: 0, busy: 0, pending: 0 },
          runners: [],
        }),
      }),
    );

    // Mock billing/plan endpoint if it exists
    await page.route('**/api/billing/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: 'free' }),
      }),
    );
  });

  test('authenticated user sees the runs page', async ({ page }) => {
    await page.goto('/');
    // Should redirect to /runs
    await page.waitForURL('**/runs');
    await expect(page).toHaveURL(/\/runs/);
  });

  test('navigation between pages works', async ({ page }) => {
    await page.goto('/runs');

    // Navigate to Projects
    await page.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects/);

    // Navigate to Settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);

    // Navigate back to Runs
    await page.getByRole('link', { name: 'Runs' }).click();
    await expect(page).toHaveURL(/\/runs/);
  });

  test('sidebar navigation links are present', async ({ page }) => {
    await page.goto('/runs');

    const expectedLinks = [
      'Runs',
      'Projects',
      'Analytics',
      'Runners',
      'Artifacts',
      'Ask AI',
      'Integrations',
      'Skill Market',
      'Team',
      'Settings',
    ];

    for (const label of expectedLinks) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });
});
