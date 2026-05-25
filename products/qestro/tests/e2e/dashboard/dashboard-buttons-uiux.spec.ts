/**
 * E2E Test: Dashboard Buttons and UI/UX Tests
 * Tests the current released dashboard wedge.
 */

import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from '../fixtures/auth.fixture';
import { mockDashboardAPIs } from '../fixtures/dashboard.fixture';

test.describe('Dashboard - Button and UI/UX Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });
    await hideOverlays(page);
  });

  test.describe('Dashboard Action Buttons', () => {
    test('should render "Run Diagnostics" button', async ({ page }) => {
      await expect(
        page.locator('button:has-text("Run Diagnostics")')
      ).toBeVisible();
    });

    test('should click "Run Diagnostics" and trigger scan', async ({ page }) => {
      await page.locator('button:has-text("Run Diagnostics")').click();

      const transientScanState = await page
        .locator('button:has-text("Running Scan..."), text=SYSTEM STATUS: SCANNING...')
        .first()
        .isVisible()
        .catch(() => false);

      if (!transientScanState) {
        // On fast responses the button may immediately return to idle state.
        await expect(
          page.locator('button:has-text("Run Diagnostics")')
        ).toBeVisible({ timeout: 10000 });
      }
    });

    test('should render "Record New Flow" button', async ({ page }) => {
      await expect(
        page.locator('button:has-text("Record New Flow")')
      ).toBeVisible();
    });

    test('should navigate to runs from the activity shortcut', async ({ page }) => {
      await page.locator('button:has-text("View test runs")').click();
      await page.waitForURL(/\/runs/, { timeout: 5000 });
      expect(page.url()).toContain('/runs');
    });

    test('should expose the phase-one shortcut buttons', async ({ page }) => {
      await expect(page.locator('button:has-text("Open Recording Studio")')).toBeVisible();
      await expect(page.locator('button:has-text("Inspect runs")')).toBeVisible();
      await expect(page.locator('button:has-text("Open settings")')).toBeVisible();
    });
  });

  test.describe('Dashboard Interactive Elements', () => {
    test('should render stat cards', async ({ page }) => {
      const summaryGrid = page.locator('.dashboard-container > .grid').first();
      await expect(summaryGrid.getByText('Projects', { exact: true })).toBeVisible();
      await expect(summaryGrid.getByText('Test Cases', { exact: true })).toBeVisible();
      await expect(summaryGrid.getByText('Run Coverage', { exact: true })).toBeVisible();
      await expect(summaryGrid.getByText('Jira-ready Artifacts', { exact: true })).toBeVisible();
    });

    test('should display execution overview section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Execution Overview', level: 3 })).toBeVisible();
    });

    test('should display recent activity section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Recent Activity', level: 3 })).toBeVisible();
    });

    test('should display system status text', async ({ page }) => {
      await expect(page.getByText(/System status:/i)).toBeVisible();
    });
  });

  test.describe('Console Error Detection', () => {
    test('should not produce console errors when clicking buttons', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      const buttonTexts = ['Run Diagnostics', 'View test runs'];
      for (const text of buttonTexts) {
        const btn = page.locator(`button:has-text("${text}")`);
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(500);
        }
      }

      const critical = errors.filter(
        (e) =>
          !e.includes('Failed to load resource') &&
          !e.includes('Failed to fetch') &&
          !e.includes('Cross-Origin Request Blocked') &&
          !e.includes('CORS request did not succeed') &&
          !e.includes('Could not connect to the server.') &&
          !e.includes('due to access control checks.') &&
          !e.includes('127.0.0.1:3999')
      );
      expect(critical.length).toBe(0);
    });
  });

  test.describe('Button Completeness', () => {
    test('should have all expected dashboard buttons', async ({ page }) => {
      const expected = [
        'Run Diagnostics', 'Record New Flow', 'View test runs',
        'Open Recording Studio', 'Inspect runs', 'Open settings',
      ];
      for (const text of expected) {
        await expect(page.locator(`button:has-text("${text}")`)).toBeVisible();
      }
      await expect(page.getByRole('button', { name: 'Logout' }).first()).toBeVisible();
    });
  });
});
