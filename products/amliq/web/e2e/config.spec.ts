import { test, expect } from '@playwright/test';
import { setupAuth } from './auth-setup';
import { mockAPI, mockRaw } from './mocks';

test.describe('Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await mockRaw(page, '/api/v1/audit*', { entries: [], total: 0 });
    // useConfig → configApi.get → api.get('/config') → fetchApi unwraps .data
    await mockAPI(page, '/api/v1/config', {
      country: 'US', regulation_framework: [],
      enabled_lists: [], default_threshold: 0.7,
      match_weights: {}, auto_dismiss_below: 0.3,
      auto_escalate_above: 0.9, screening_mode: 'realtime',
      batch_schedule: '', max_batch_size: 100,
    });
  });

  test('shows configuration page', async ({ page }) => {
    await page.goto('/config');
    await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible();
  });
});

test.describe('Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  test('shows monitoring page', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText('System Monitoring')).toBeVisible();
  });
});

test.describe('Audit Trail', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    // useAudit → auditApi.list → api.get('/audit') → fetchApi unwraps .data
    await mockAPI(page, '/api/v1/audit*', {
      entries: [
        {
          id: 'audit_1', action: 'screen_initiated',
          actor: 'user_1', target: 'John Doe',
          details: {}, timestamp: '2025-03-20T14:00:00Z',
        },
      ],
    });
  });

  test('shows audit trail page', async ({ page }) => {
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
  });
});
