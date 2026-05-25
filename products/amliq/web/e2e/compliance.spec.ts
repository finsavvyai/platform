import { test, expect } from './fixtures';
import { mockAPI, mockRaw } from './mocks';

test.describe('PEP Screening', () => {
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

  test('shows PEP screening page', async ({ page }) => {
    await page.goto('/compliance/pep');
    await expect(page.getByText(/pep|politically exposed/i).first()).toBeVisible();
  });
});

test.describe('Adverse Media', () => {
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

  test('shows adverse media page', async ({ page }) => {
    await page.goto('/compliance/media');
    await expect(page.getByText(/media|adverse/i).first()).toBeVisible();
  });
});

test.describe('Transaction Monitoring', () => {
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

  test('shows transaction monitoring page', async ({ page }) => {
    await page.goto('/compliance/txn');
    await expect(page.getByText(/transaction|monitoring/i).first()).toBeVisible();
  });
});
