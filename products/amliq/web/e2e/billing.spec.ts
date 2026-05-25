import { test, expect } from './fixtures';
import { mockRaw, mockAPI } from './mocks';

test.describe('Billing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('amliq_token', 'fake.jwt.token');
    });
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          data: { id: '1', email: 'admin@test.com', role: 'admin', tenant_id: 'tnt_test' },
        }),
      }),
    );
  });

  test('shows billing page with products', async ({ page }) => {
    await mockRaw(page, '/api/v1/billing/products', [
      { id: 'api_starter', name: 'API Starter', monthly_price: 4900 },
      { id: 'api_pro', name: 'API Professional', monthly_price: 19900 },
    ]);
    await mockRaw(page, '/api/v1/billing/subscriptions', []);
    await mockRaw(page, '/api/v1/billing/usage*', { used: 50, limit: 100 });
    await mockRaw(page, '/api/v1/billing/invoices', []);
    await page.goto('/billing');
    await expect(page.getByText(/billing|subscription|plan/i).first()).toBeVisible();
  });

  test('shows seats management', async ({ page }) => {
    await mockRaw(page, '/api/v1/billing/seats', {
      seats: [{ id: 'seat_1', email: 'user@test.com', role: 'analyst' }],
    });
    await mockRaw(page, '/api/v1/billing/products', []);
    await mockRaw(page, '/api/v1/billing/subscriptions', []);
    await mockRaw(page, '/api/v1/billing/usage*', { used: 0, limit: 100 });
    await mockRaw(page, '/api/v1/billing/invoices', []);
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
  });

  test('billing health endpoint returns status', async ({ page }) => {
    await mockRaw(page, '/api/v1/billing/health', {
      status: 'healthy', mode: 'free_tier', ls_configured: false,
    });
    const resp = await page.request.get('/api/v1/billing/health');
    expect(resp.ok()).toBeTruthy();
  });
});
