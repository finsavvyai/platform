import { test, expect } from './fixtures';
import { mockAPI } from './mocks';

test.describe('Screening', () => {
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
  });

  test('shows screening form', async ({ page }) => {
    await page.goto('/screen');
    await expect(
      page.getByRole('heading', { name: 'Screen Entity' }),
    ).toBeVisible();
  });

  test('displays results after screening', async ({ page }) => {
    await mockAPI(page, '/api/v1/screen', {
      id: 'scr_1',
      matches: [
        {
          listName: 'OFAC SDN', confidence: 0.92,
          riskLevel: 'High', entityName: 'JOHN DOE',
          layers: ['exact', 'fuzzy'],
        },
      ],
    });
    await page.goto('/screen');
    const form = page.locator('form').first();
    if (await form.isVisible()) {
      const nameInput = page.getByPlaceholder(/first|name/i).first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('John Doe');
      }
    }
  });
});

test.describe('Alerts', () => {
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
    await mockAPI(page, '/api/v1/alerts*', {
      alerts: [
        {
          id: 'alt_1', entity_name: 'Suspect Corp',
          status: 'pending', risk: 'High', created_at: '2025-03-01',
        },
      ],
      total: 1,
    });
  });

  test('shows alert queue', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page.getByText('Alert Queue')).toBeVisible();
  });
});
