import { test, expect } from '@playwright/test';
import { setupAuth } from './auth-setup';
import { mockAPI } from './mocks';

test.describe('Case Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await mockAPI(page, '/api/v1/cases*', {
      cases: [
        {
          id: 'case_1', entity_name: 'John Doe', matched_name: 'John D.',
          status: 'open', priority: 'high', assigned_to: '',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'case_2', entity_name: 'Acme Corp', matched_name: 'ACME',
          status: 'escalated', priority: 'critical', assigned_to: 'analyst_1',
          created_at: '2025-01-10T08:00:00Z',
        },
      ],
      total: 2,
    });
  });

  test('shows case management title', async ({ page }) => {
    await page.goto('/compliance/cases');
    await expect(page.getByText('Case Management')).toBeVisible();
  });

  test('shows status filter buttons', async ({ page }) => {
    await page.goto('/compliance/cases');
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'open' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'escalated' })).toBeVisible();
  });

  test('displays case list', async ({ page }) => {
    await page.goto('/compliance/cases');
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Acme Corp')).toBeVisible();
  });

  test('filter buttons trigger API call', async ({ page }) => {
    let requestURL = '';
    page.on('request', req => {
      if (req.url().includes('/api/v1/cases')) requestURL = req.url();
    });
    await page.goto('/compliance/cases');
    await page.getByRole('button', { name: 'open' }).click();
    await page.waitForTimeout(500);
    expect(requestURL).toContain('status=open');
  });
});
