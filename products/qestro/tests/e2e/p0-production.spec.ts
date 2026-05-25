import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://qestro.app';
const SCREENSHOT_DIR = 'test-results/p0-production';

// Force fresh context — no cache
test.use({
  storageState: undefined,
  bypassCSP: true,
});

test.describe('Production P0 Verification', () => {

  test('1. Login page — screenshot & no demo creds', async ({ browser }) => {
    // Use incognito context for clean cache
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login.png`, fullPage: true });

    const body = await page.textContent('body');
    expect(body).not.toContain('testpassword123');
    expect(body).not.toContain('test@questro.io');
    expect(body).toContain('Early access');

    await context.close();
  });

  test('2. Register page — screenshot & terms links', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-register.png`, fullPage: true });

    const termsLink = page.locator('a[href="/terms"]');
    const privacyLink = page.locator('a[href="/privacy"]');
    await expect(termsLink).toBeVisible({ timeout: 10000 });
    await expect(privacyLink).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('3. Privacy page — screenshot & content', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-privacy.png`, fullPage: true });

    await expect(page.locator('h1')).toContainText('Privacy Policy', { timeout: 10000 });
    await expect(page.locator('text=Information We Collect')).toBeVisible();

    await context.close();
  });

  test('4. Terms page — screenshot & content', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/terms`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-terms.png`, fullPage: true });

    await expect(page.locator('h1')).toContainText('Terms of Service', { timeout: 10000 });
    await expect(page.locator('text=Acceptance of Terms')).toBeVisible();

    await context.close();
  });

  test('5. 404 page — screenshot', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/this-route-does-not-exist-xyz`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-404-or-redirect.png`, fullPage: true });

    await context.close();
  });

  test('6. Forgot password page — screenshot', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-forgot-password.png`, fullPage: true });

    await context.close();
  });

  test('7. No API keys in served JS bundles', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Load the app and check all loaded scripts for API keys
    const apiKeyFound: string[] = [];

    page.on('response', async (response) => {
      if (response.url().endsWith('.js') && response.status() === 200) {
        try {
          const text = await response.text();
          if (text.includes('sk-proj-')) {
            apiKeyFound.push(response.url());
          }
        } catch { /* ignore */ }
      }
    });

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    expect(apiKeyFound).toEqual([]);

    await context.close();
  });
});
