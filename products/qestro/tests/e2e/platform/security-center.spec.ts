import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';

test.describe('Security Center Release Gate', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto('/security');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
  });

  test('should render the Security Center release gate', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Security Center is hidden in the current production release.' })
    ).toBeVisible();
    await expect(page.getByText('Qestro is shipping the real workflow first')).toBeVisible();
  });

  test('should keep release fallback links available', async ({ page }) => {
    const gate = page.locator('.mx-auto.max-w-4xl.rounded-3xl').first();

    await expect(gate.getByRole('link', { name: 'Recording Studio' })).toBeVisible();
    await expect(gate.getByRole('link', { name: 'Test Runs' })).toBeVisible();
    await expect(gate.getByRole('link', { name: 'Test Cases' })).toBeVisible();
  });
});
