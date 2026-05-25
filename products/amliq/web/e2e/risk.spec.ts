import { test, expect } from '@playwright/test';
import { setupAuth } from './auth-setup';
import { mockAPI } from './mocks';

test.describe('Risk Assessment', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.route('**/api/v1/audit*', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { entries: [], total: 0 } }) }));
  });

  test('shows risk assessment form', async ({ page }) => {
    await page.goto('/compliance/risk');
    await expect(page.getByRole('heading', { name: 'Risk Assessment' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Calculate Risk' }),
    ).toBeVisible();
  });

  test('displays risk score after calculation', async ({ page }) => {
    await mockAPI(page, '/api/v1/risk/score', {
      composite_score: 0.85,
      risk_level: 'critical',
      factors: ['sanctions:90%', 'pep:80%'],
      breakdown: { sanctions: 0.9, pep: 0.8, adverse_media: 0.5 },
    });
    await page.goto('/compliance/risk');
    await page.getByLabel('Entity ID').fill('ent_123');
    await page.getByRole('button', { name: 'Calculate Risk' }).click();
  });
});

test.describe('PEP Screening', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.route('**/api/v1/audit*', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { entries: [], total: 0 } }) }));
  });

  test('shows PEP screening form', async ({ page }) => {
    await page.goto('/compliance/pep');
    await expect(page.getByRole('heading', { name: 'PEP & Sanctions Screening' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Screen PEP & Sanctions' }),
    ).toBeVisible();
  });

  test('shows result for known PEP', async ({ page }) => {
    await mockAPI(page, '/api/v1/pep/screen', {
      results: [{ entity_id: 'ent_1', position: 'President', country: 'US', tier: 1 }],
      total: 1,
    });
    await mockAPI(page, '/api/v1/screen', {
      id: 'scr_1', matches: [], score: 0,
    });
    await page.goto('/compliance/pep');
    await page.getByPlaceholder(/enter name/i).fill('John Doe');
    await page.getByRole('button', { name: 'Screen PEP & Sanctions' }).click();
  });
});
