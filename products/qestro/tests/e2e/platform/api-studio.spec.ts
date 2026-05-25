import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';

test.describe('API Studio Release Gate', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
  });

  test('should render the API Studio release gate', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'API Studio is hidden in the current production release.' })
    ).toBeVisible();
    await expect(page.getByText('Qestro is shipping the real workflow first')).toBeVisible();
  });

  test('should route users back to released flows', async ({ page }) => {
    const gate = page.locator('.mx-auto.max-w-4xl.rounded-3xl').first();

    await expect(gate.getByRole('link', { name: 'Recording Studio' })).toBeVisible();
    await expect(gate.getByRole('link', { name: 'Test Runs' })).toBeVisible();
    await expect(gate.getByRole('link', { name: 'Test Cases' })).toBeVisible();
    await expect(gate.getByRole('link', { name: 'Return to the released product' })).toBeVisible();
  });
});
