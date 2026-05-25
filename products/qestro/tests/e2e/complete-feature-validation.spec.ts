import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from './fixtures/auth.fixture';
import { mockDashboardAPIs } from './fixtures/dashboard.fixture';

async function expectReleaseGate(page: import('@playwright/test').Page, feature: string) {
  const gate = page.locator('.mx-auto.max-w-4xl.rounded-3xl').first();

  await expect(
    page.getByRole('heading', { name: `${feature} is hidden in the current production release.` })
  ).toBeVisible();
  await expect(gate.getByText('Qestro is shipping the real workflow first')).toBeVisible();
  await expect(gate.getByRole('link', { name: 'Recording Studio' })).toBeVisible();
  await expect(gate.getByRole('link', { name: 'Test Runs' })).toBeVisible();
  await expect(gate.getByRole('link', { name: 'Test Cases' })).toBeVisible();
}

test.describe('Qestro Complete Feature Validation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('Recording Studio page loads with key elements', async ({ page }) => {
    await page.goto('/recording-studio');
    await page.waitForLoadState('networkidle');

    // Validate recording studio interface
    await expect(page.getByRole('heading', { name: 'Recording Studio', level: 1 })).toBeVisible();

    // New Recording button should be visible
    await expect(page.getByText('New Recording')).toBeVisible();
  });

  test('Recording Studio shows new recording form', async ({ page }) => {
    await page.goto('/recording-studio');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);

    // Click New Recording to expand form
    await page.getByText('New Recording').click();

    // Form fields should be visible
    await expect(page.locator('input[type="url"]')).toBeVisible();

    // Framework options should be visible
    await expect(page.getByRole('button', { name: /Playwright/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cypress/ })).toBeVisible();

    // Viewport options
    await expect(page.getByRole('button', { name: 'Desktop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobile' })).toBeVisible();

    // Start Recording button should be visible
    await expect(page.getByRole('button', { name: 'Start Recording' })).toBeVisible();
  });

  test('Recording Studio shows completed sessions', async ({ page }) => {
    await page.goto('/recording-studio');
    await page.waitForLoadState('networkidle');

    // Completed Sessions section should be visible
    await expect(page.getByText('Completed Sessions')).toBeVisible();
  });

  test('Dashboard loads with the current release contract', async ({ page }) => {
    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);

    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Release Dashboard', level: 2 })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/System status:/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Diagnostics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record New Flow' })).toBeVisible();
  });

  test('Dashboard shows stat cards', async ({ page }) => {
    const summaryGrid = page.locator('.dashboard-container > .grid').first();

    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });

    await expect(summaryGrid.getByText('Projects', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Test Cases', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Run Coverage', { exact: true })).toBeVisible();
    await expect(summaryGrid.getByText('Jira-ready Artifacts', { exact: true })).toBeVisible();
  });

  test('Dashboard shows execution overview and recent activity', async ({ page }) => {
    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('heading', { name: 'Execution Overview', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Activity', level: 3 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View test runs' })).toBeVisible();
  });

  test('Dashboard shows phased release shortcuts', async ({ page }) => {
    await mockDashboardAPIs(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('heading', { name: '1. Record a flow', level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2. Launch a run', level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '3. Connect Jira', level: 4 })).toBeVisible();
  });

  test('Billing loads current subscription shell', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Billing & Subscription' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Subscription' })).toBeVisible();
  });

  test('Agent Department is release gated', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    await expectReleaseGate(page, 'Agent Department');
  });

  test('Settings loads Jira and Appearance sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Jira Integration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  });

  test('Accessibility - keyboard navigation', async ({ page }) => {
    await page.goto('/recording-studio');
    await page.waitForLoadState('networkidle');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(['BUTTON', 'INPUT', 'A', 'BODY']).toContain(focusedElement);

    // Buttons should have accessible text or be icon buttons with SVG
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 5)) {
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      const hasSvg = (await button.locator('svg').count()) > 0;
      expect(ariaLabel || (text && text.trim().length > 0) || hasSvg).toBeTruthy();
    }
  });
});

test.describe('Production Readiness Validation', () => {
  test('Performance Benchmarks - page load', async ({ page }) => {
    await mockAuth(page);
    const budget = test.info().project.name === 'mobile' ? 15000 : 8000;
    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Release Dashboard', level: 2 })).toBeVisible({
      timeout: 15000,
    });

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(budget);
  });

  test.fixme('Health Check and System Status', async ({ page }) => {
    // /health route does not exist in App.tsx
  });

  test('Security - login page renders', async ({ page }) => {
    // Visit login page without auth - should show login form
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Security - auth redirects unauthenticated users', async ({ page }) => {
    // Without mockAuth, visiting protected route should redirect to login
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should be redirected to login
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Feature Integration Test', () => {
  test('Navigate between key pages', async ({ page }) => {
    await mockAuth(page);
    await mockDashboardAPIs(page);

    // Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
    await expect(page.getByRole('heading', { name: 'Release Dashboard', level: 2 })).toBeVisible({ timeout: 10000 });

    // Recording Studio
    await page.goto('/recording-studio');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);
    await expect(page.getByRole('heading', { name: 'Recording Studio', level: 1 })).toBeVisible();

    // Test Cases
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('button', { name: /Create Test Case|New Test Case/i })
    ).toBeVisible();

    // Test Runs
    await page.goto('/runs');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('button', { name: /Run First Test|New Run|New Test Run/i })
    ).toBeVisible();

    // Insights is intentionally gated in the Phase 1 release
    await page.goto('/insights');
    await page.waitForLoadState('networkidle');
    await expectReleaseGate(page, 'Analytics');
  });
});
