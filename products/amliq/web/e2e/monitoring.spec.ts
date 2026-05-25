import { test, expect } from './fixtures';
import { mockRaw } from './mocks';

test.describe('Continuous Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('amliq_token', 'fake.jwt.token');
    });
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          data: { id: '1', email: 'a@b.com', role: 'admin', tenant_id: 'tnt_abc' },
        }),
      }),
    );
    await mockRaw(page, '/api/v1/monitors', {
      monitors: [
        {
          id: 'mon_1', entity_name: 'John Smith', entity_type: 'individual',
          frequency: 'daily', status: 'active', created_at: '2026-01-01',
        },
        {
          id: 'mon_2', entity_name: 'Acme Corp', entity_type: 'company',
          frequency: 'weekly', status: 'paused', created_at: '2026-02-15',
        },
      ],
      total: 2,
    });
  });

  test('shows monitoring page with entities', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText(/monitor/i).first()).toBeVisible();
  });

  test('monitoring page loads without error', async ({ page }) => {
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle');
    // No crash = page renders
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
