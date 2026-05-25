import { test, expect, devices } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Internationalization', () => {
  test('9.1 Language switcher is visible', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Look for EN/language selector
    const langSwitch = page.locator('button, a, [class*="lang"], [class*="locale"]').filter({
      hasText: /^EN$|^ES$|^FR$|^DE$|^JA$/,
    }).first();
    const visible = await langSwitch.isVisible().catch(() => false);
    // Language switcher should exist in header
    expect(visible).toBeTruthy();
  });

  test('9.2 Spanish locale loads', async ({ page }) => {
    await page.goto(`${BASE}/es`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/09-locale-es.png`, fullPage: false });
    // Should load without error
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('9.3 French locale loads', async ({ page }) => {
    await page.goto(`${BASE}/fr`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('9.4 German locale loads', async ({ page }) => {
    await page.goto(`${BASE}/de`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('9.5 Japanese locale loads', async ({ page }) => {
    await page.goto(`${BASE}/ja`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('OpenSyber — Responsive / Mobile', () => {
  test.use({ ...devices['iPhone 13'] });

  test('9.6 Homepage renders on mobile', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/09-mobile-home.png`, fullPage: false });
    // Should not have horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('9.7 Pricing page renders on mobile', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/09-mobile-pricing.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('pricing');
  });

  test('9.8 Mobile navigation exists (hamburger menu)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Should have hamburger/mobile menu button
    const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="nav" i], [class*="hamburger"], [class*="mobile-menu"], button:has(svg)').first();
    const visible = await menuBtn.isVisible().catch(() => false);
    // Mobile should have some nav mechanism
    expect(visible).toBeTruthy();
  });

  test('9.9 Sign-in page usable on mobile', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/09-mobile-signin.png`, fullPage: true });
    const body = await page.textContent('body') || '';
    const hasAuth = body.toLowerCase().includes('sign in') || body.toLowerCase().includes('log in');
    expect(hasAuth).toBeTruthy();
  });
});
