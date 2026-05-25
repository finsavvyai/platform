import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from './fixtures/auth.fixture';

const SESSIONS_URL = '**/api/recordings/openclaw/sessions';
const START_URL = '**/api/recordings/openclaw/start';

function mockEmptySessions(page: import('@playwright/test').Page) {
  return page.route(SESSIONS_URL, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
}

function mockStartRecording(page: import('@playwright/test').Page, overrides = {}) {
  return page.route(START_URL, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true, data: {
          id: 'rec_test1', name: 'Test Recording', url: 'https://example.com',
          status: 'recording', duration: 0, interactionCount: 0,
          framework: 'playwright', confidence: 0, createdAt: new Date().toISOString(),
          viewport: { width: 1920, height: 1080 }, ...overrides,
        },
      }),
    })
  );
}

test.describe('Recording Studio', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptySessions(page);
    await mockAuth(page);
    await page.goto('/recording-studio');
    await hideOverlays(page);
  });

  test('should display recording studio interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Recording Studio', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Recording' })).toBeVisible();
    await expect(page.getByText('Total Sessions')).toBeVisible();
    await expect(page.getByText('Completed Sessions')).toBeVisible();
  });

  test('should toggle new recording form', async ({ page }) => {
    await page.getByRole('button', { name: 'New Recording' }).click();
    await expect(page.getByText('Start New Recording')).toBeVisible();
    await expect(page.getByText('Target URL')).toBeVisible();
    await expect(page.getByText('Framework')).toBeVisible();
    await expect(page.getByText('Viewport')).toBeVisible();

    await page.getByRole('button', { name: 'New Recording' }).click();
    await expect(page.getByText('Start New Recording')).not.toBeVisible();
  });

  test('should select framework and viewport options', async ({ page }) => {
    await page.getByRole('button', { name: 'New Recording' }).click();

    // Playwright selected by default
    await expect(page.getByRole('button', { name: /Playwright/ })).toHaveClass(/border-rose-500/);
    // Switch to Cypress
    await page.getByRole('button', { name: /Cypress/ }).click();
    await expect(page.getByRole('button', { name: /Cypress/ })).toHaveClass(/border-rose-500/);

    // Desktop selected by default; switch to Mobile
    await expect(page.getByRole('button', { name: 'Desktop' })).toHaveClass(/border-rose-500/);
    await page.getByRole('button', { name: 'Mobile' }).click();
    await expect(page.getByRole('button', { name: 'Mobile' })).toHaveClass(/border-rose-500/);
  });

  test('should require URL before starting recording', async ({ page }) => {
    await page.getByRole('button', { name: 'New Recording' }).click();
    await expect(page.getByRole('button', { name: 'Start Recording' })).toBeDisabled();
  });

  test('should start a recording session', async ({ page }) => {
    await mockStartRecording(page);
    await page.getByRole('button', { name: 'New Recording' }).click();
    await page.getByPlaceholder('https://your-app.com/flow').fill('https://example.com');
    await page.getByPlaceholder('e.g. Checkout Flow').fill('Test Recording');
    await page.getByRole('button', { name: 'Start Recording' }).click();

    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    await expect(page.getByText('Test Recording')).toBeVisible();
    await expect(page.getByText('https://example.com')).toBeVisible();
  });

  test('should stop recording', async ({ page }) => {
    await mockStartRecording(page, { id: 'rec_s1', name: 'Checkout Flow' });
    await page.route('**/api/recordings/openclaw/rec_s1/stop', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );

    await page.getByRole('button', { name: 'New Recording' }).click();
    await page.getByPlaceholder('https://your-app.com/flow').fill('https://app.example.com');
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('button', { name: 'Stop' })).not.toBeVisible();
    await expect(page.getByText('Checkout Flow')).toBeVisible();
  });

  test('should display completed sessions from API', async ({ page }) => {
    await page.route(SESSIONS_URL, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, data: [{
            id: 'rec_1', name: 'Login Flow', url: 'https://app.example.com/login',
            status: 'completed', duration: 45, interactionCount: 8,
            framework: 'playwright', confidence: 91, createdAt: '1 hour ago',
            viewport: { width: 1920, height: 1080 },
          }],
        }),
      })
    );
    await page.reload();

    await expect(page.getByText('Login Flow')).toBeVisible();
    await expect(page.getByText('91%').first()).toBeVisible();
  });

  test('should open code modal via View Test', async ({ page }) => {
    await page.route(SESSIONS_URL, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, data: [{
            id: 'rec_1', name: 'Checkout Flow', url: 'https://app.example.com/checkout',
            status: 'completed', duration: 124, interactionCount: 18,
            framework: 'playwright', confidence: 92, createdAt: '2 hours ago',
            viewport: { width: 1920, height: 1080 },
          }],
        }),
      })
    );
    await page.reload();
    await page.getByRole('button', { name: 'View Test' }).first().click();
    await expect(page.getByText('Checkout Flow.spec.ts')).toBeVisible();
  });

  test('should handle start recording API error', async ({ page }) => {
    await page.route(START_URL, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false }) })
    );

    page.on('dialog', async dialog => {
      // API client throws on 500 status, so the catch block alert fires
      expect(dialog.message()).toContain('Could not bridge to Playwright container');
      await dialog.accept();
    });

    await page.getByRole('button', { name: 'New Recording' }).click();
    await page.getByPlaceholder('https://your-app.com/flow').fill('https://example.com');
    await page.getByRole('button', { name: 'Start Recording' }).click();
  });
});
