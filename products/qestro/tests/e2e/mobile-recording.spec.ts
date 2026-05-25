import { test, expect, Locator, Page } from '@playwright/test';
import { mockAuth, hideOverlays } from './fixtures/auth.fixture';

const SESSIONS_URL = '**/api/recordings/openclaw/sessions';
const START_URL = '**/api/recordings/openclaw/start';

function mockEmptySessions(page: import('@playwright/test').Page) {
  return page.route(SESSIONS_URL, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  );
}

function makeSession(overrides = {}) {
  return {
    id: 'rec_m1', name: 'Mobile Test', url: 'https://example.com',
    status: 'recording', duration: 0, interactionCount: 0,
    framework: 'playwright', confidence: 0, createdAt: new Date().toISOString(),
    viewport: { width: 375, height: 812 }, ...overrides,
  };
}

async function waitForRecordingStudioReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Recording Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Recording' })).toBeVisible();
}

async function openNewRecordingForm(page: Page) {
  const urlField = page.getByPlaceholder('https://your-app.com/flow');
  if (await urlField.isVisible().catch(() => false)) {
    return;
  }

  const trigger = page.getByRole('button', { name: 'New Recording' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await trigger.click();
    try {
      await expect(urlField).toBeVisible({ timeout: 5000 });
      return;
    } catch {
      // Retry: Firefox occasionally drops the first click while the shell is still settling.
    }
  }

  await expect(urlField).toBeVisible();
}

async function clickOption(button: Locator) {
  await expect(button).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await expect(button).toHaveClass(/rose-500|text-rose-300/);
}

async function startRecordingAndWait(page: Page) {
  const startButton = page.getByRole('button', { name: /Start Recording|Starting\.\.\./ });
  const stopButton = page.getByRole('button', { name: 'Stop' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/recordings/openclaw/start') &&
        response.request().method() === 'POST',
      { timeout: 5000 },
    ).catch(() => null);

    await expect(startButton).toBeVisible();
    await startButton.scrollIntoViewIfNeeded();
    await startButton.click();
    await startResponse;

    try {
      await expect(stopButton).toBeVisible({ timeout: 5000 });
      return;
    } catch {
      // Retry: Firefox occasionally keeps the form open even though the button was clicked.
    }
  }

  await expect(stopButton).toBeVisible({ timeout: 15000 });
}

test.describe('Mobile Viewport Recording Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptySessions(page);
    await mockAuth(page);
    await page.goto('/recording-studio');
    await hideOverlays(page);
    await waitForRecordingStudioReady(page);
  });

  test('should select Mobile viewport and start recording', async ({ page }) => {
    await page.route(START_URL, async route => {
      const body = JSON.parse((await route.request().postData()) || '{}');
      expect(body.viewport).toEqual({ width: 375, height: 812 });
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeSession({ name: 'Mobile Login' }) }),
      });
    });

    await openNewRecordingForm(page);
    await clickOption(page.getByRole('button', { name: 'Mobile' }));

    await page.getByPlaceholder('https://your-app.com/flow').fill('https://app.example.com/login');
    await page.getByPlaceholder('e.g. Checkout Flow').fill('Mobile Login');
    await startRecordingAndWait(page);

    await expect(page.getByText('Mobile Login')).toBeVisible();
  });

  test('should select Tablet viewport and start recording', async ({ page }) => {
    await page.route(START_URL, async route => {
      const body = JSON.parse((await route.request().postData()) || '{}');
      expect(body.viewport).toEqual({ width: 768, height: 1024 });
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: makeSession({ id: 'rec_t1', name: 'Tablet Dash', viewport: { width: 768, height: 1024 } }),
        }),
      });
    });

    await openNewRecordingForm(page);
    await clickOption(page.getByRole('button', { name: 'Tablet' }));

    await page.getByPlaceholder('https://your-app.com/flow').fill('https://app.example.com/dashboard');
    await startRecordingAndWait(page);
  });

  test('should use Cypress with Mobile viewport', async ({ page }) => {
    await page.route(START_URL, async route => {
      const body = JSON.parse((await route.request().postData()) || '{}');
      expect(body.framework).toBe('cypress');
      expect(body.viewport).toEqual({ width: 375, height: 812 });
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeSession({ framework: 'cypress' }) }),
      });
    });

    await openNewRecordingForm(page);
    await clickOption(page.getByRole('button', { name: /Cypress/ }));
    await clickOption(page.getByRole('button', { name: 'Mobile' }));

    await page.getByPlaceholder('https://your-app.com/flow').fill('https://example.com');
    await startRecordingAndWait(page);
  });

  test('should show timer during active recording', async ({ page }) => {
    await page.route(START_URL, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeSession() }),
      })
    );

    await openNewRecordingForm(page);
    await clickOption(page.getByRole('button', { name: 'Mobile' }));
    await page.getByPlaceholder('https://your-app.com/flow').fill('https://example.com');
    await startRecordingAndWait(page);

    await expect(page.getByText('00:00')).toBeVisible();
    await expect
      .poll(async () => await page.locator('.rec-timer').textContent(), { timeout: 5000 })
      .not.toBe('00:00');
  });

  test('should show interaction count and framework', async ({ page }) => {
    await page.route(START_URL, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeSession({ interactionCount: 12 }) }),
      })
    );

    await openNewRecordingForm(page);
    await page.getByPlaceholder('https://your-app.com/flow').fill('https://example.com');
    await startRecordingAndWait(page);

    const activeSession = page.locator('.ai-glass-card').filter({ has: page.getByRole('button', { name: 'Stop' }) }).first();
    await expect(activeSession.getByText('12 interactions')).toBeVisible();
    // Framework is displayed in a text-xs div inside the active recording section
    await expect(activeSession.getByText('playwright')).toBeVisible();
  });

  test('should display stats bar', async ({ page }) => {
    // Stat labels use uppercase CSS so match the label text as-is in DOM
    await expect(page.getByText('Total Sessions').first()).toBeVisible();
    await expect(page.getByText('Active').first()).toBeVisible();
    // The label text may be visually uppercased via CSS; match the DOM value
    await expect(page.locator('.ai-metric-card').filter({ hasText: 'Interactions' }).first()).toBeVisible();
    await expect(page.getByText('Avg Confidence').first()).toBeVisible();
  });

  test('should handle stop recording failure', async ({ page }) => {
    await page.route(START_URL, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeSession({ id: 'rec_fail' }) }),
      })
    );
    await page.route('**/api/recordings/openclaw/rec_fail/stop', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: false }),
      })
    );

    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Failed to stop recording');
      await dialog.accept();
    });

    await openNewRecordingForm(page);
    await page.getByPlaceholder('https://your-app.com/flow').fill('https://example.com');
    await startRecordingAndWait(page);

    await page.getByRole('button', { name: 'Stop' }).click();
  });
});
