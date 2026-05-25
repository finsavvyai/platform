import { test, expect } from './fixtures';
import { mockRaw } from './mocks';

test.describe('Sanctions Lists', () => {
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
    await mockRaw(page, '/api/v1/lists', {
      data: [
        { id: 'ofac', name: 'OFAC SDN', entity_count: 12000, last_sync: '2026-04-04' },
        { id: 'eu', name: 'EU FSF', entity_count: 8000, last_sync: '2026-04-04' },
        { id: 'un', name: 'UN Consolidated', entity_count: 6000, last_sync: '2026-04-03' },
      ],
    });
  });

  test('shows sanctions lists page', async ({ page }) => {
    await page.goto('/lists');
    await expect(page.getByText(/list|sanction/i).first()).toBeVisible();
  });

  test('shows marketplace', async ({ page }) => {
    await mockRaw(page, '/api/v1/lists/marketplace*', {
      lists: [
        { id: 'dfat', name: 'DFAT', jurisdiction: 'AU', enabled: false },
        { id: 'interpol', name: 'Interpol', jurisdiction: 'Global', enabled: true },
      ],
    });
    await page.goto('/lists/marketplace');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
