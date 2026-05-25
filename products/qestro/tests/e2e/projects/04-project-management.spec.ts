/**
 * E2E Test: Project Management
 *
 * SKIPPED: There is no /projects route in App.tsx.
 * Navigating to /projects renders the Dashboard (catch-all route).
 * These tests will be re-enabled when a dedicated Projects page is built.
 */

import { test, expect } from '@playwright/test';
import { mockAuth } from '../fixtures/auth.fixture';

test.describe.skip('Project Management (no /projects route)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto('/');
  });

  test('placeholder - projects page does not exist yet', async ({ page }) => {
    // /projects falls through to the Dashboard catch-all route.
    // Re-enable this suite when a Projects page is implemented.
    expect(true).toBeTruthy();
  });
});
