import { test, expect } from './fixtures';
import { mockRaw } from './mocks';

test.describe('Team Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('amliq_token', 'fake.jwt.token');
    });
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          data: { id: '1', email: 'admin@test.com', role: 'admin', tenant_id: 'tnt_abc' },
        }),
      }),
    );
    await mockRaw(page, '/api/v1/team*', {
      members: [
        { id: 'u1', email: 'admin@test.com', role: 'admin' },
        { id: 'u2', email: 'analyst@test.com', role: 'analyst' },
      ],
    });
  });

  test('shows team page', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByText(/team/i).first()).toBeVisible();
  });
});

test.describe('Platform Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('amliq_token', 'fake.jwt.token');
    });
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          data: { id: '1', email: 'admin@test.com', role: 'admin', tenant_id: 'tnt_abc' },
        }),
      }),
    );
  });

  test('shows platform overview', async ({ page }) => {
    await mockRaw(page, '/api/v1/platform*', { tenants: 5, users: 20 });
    await page.goto('/platform/overview');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
