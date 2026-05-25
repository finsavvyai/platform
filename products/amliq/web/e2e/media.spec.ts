import { test, expect } from '@playwright/test';
import { setupAuth } from './auth-setup';
import { mockAPI } from './mocks';

test.describe('Adverse Media', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    // AdverseMedia uses fields: title, url, detected_at
    await mockAPI(page, '/api/v1/media/unreviewed*', {
      hits: [
        {
          id: 'media_1', entity_id: 'ent_1', url: 'https://news.test',
          title: 'Sanctions violation suspected', category: 'sanctions',
          severity: 8, detected_at: '2025-02-01',
        },
      ],
    });
  });

  test('shows adverse media title', async ({ page }) => {
    await page.goto('/compliance/media');
    await expect(page.getByRole('heading', { name: 'Adverse Media' })).toBeVisible();
  });
});

test.describe('Transaction Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    // TransactionMonitoring fetches /api/v1/transactions/alerts (not /txn/)
    await mockAPI(page, '/api/v1/transactions/alerts/summary*', {
      high_value: 3, rapid_movement: 1, structuring: 2, high_risk_country: 1,
    });
    await mockAPI(page, '/api/v1/transactions/alerts*', {
      alerts: [
        {
          id: 'txalert_1', transaction_id: 'txn_1', alert_type: 'high_value',
          severity: 8, description: 'Over $1M', created_at: '2025-03-01',
        },
      ],
      total: 1,
    });
  });

  test('shows transaction monitoring title', async ({ page }) => {
    await page.goto('/compliance/txn');
    await expect(page.getByText('Transaction Monitoring')).toBeVisible();
  });
});
