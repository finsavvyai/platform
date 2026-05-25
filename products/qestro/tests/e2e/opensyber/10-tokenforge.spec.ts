import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const TF_BASE = OPENSYBER.tokenforgeURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('TokenForge — Landing & Public Pages', () => {
  test('10.1 TokenForge homepage loads', async ({ page }) => {
    await page.goto(TF_BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/10-tokenforge-home.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('tokenforge');
  });

  test('10.2 TokenForge pricing page loads', async ({ page }) => {
    await page.goto(`${TF_BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/10-tokenforge-pricing.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('pricing');
  });

  test('10.3 TokenForge docs load', async ({ page }) => {
    await page.goto(`${TF_BASE}/docs`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('10.4 TokenForge sign-in page loads', async ({ page }) => {
    await page.goto(`${TF_BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/10-tokenforge-signin.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    const hasAuth = body.toLowerCase().includes('sign in') || body.toLowerCase().includes('log in');
    expect(hasAuth).toBeTruthy();
  });

  test('10.5 TokenForge sign-up page loads', async ({ page }) => {
    await page.goto(`${TF_BASE}/sign-up`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    const hasSignUp = body.toLowerCase().includes('sign up') || body.toLowerCase().includes('create') || body.toLowerCase().includes('register');
    expect(hasSignUp).toBeTruthy();
  });

  test('10.6 TokenForge blog loads', async ({ page }) => {
    await page.goto(`${TF_BASE}/blog`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('10.7 TokenForge blog article loads', async ({ page }) => {
    await page.goto(`${TF_BASE}/blog/session-hijacking-after-mfa`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/10-tokenforge-blog-article.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(500);
  });

  test('10.8 TokenForge dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto(`${TF_BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const url = page.url();
    const body = await page.textContent('body') || '';
    const redirected = url.includes('sign-in') || url.includes('sign-up');
    const hasAuthPrompt = body.toLowerCase().includes('sign in') || body.toLowerCase().includes('log in');
    expect(redirected || hasAuthPrompt).toBeTruthy();
  });
});
