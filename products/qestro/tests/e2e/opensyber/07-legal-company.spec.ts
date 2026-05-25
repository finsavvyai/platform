import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Legal Pages', () => {
  test('7.1 Privacy policy loads with content', async ({ page }) => {
    await page.goto(`${BASE}/privacy`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/07-privacy.png`, fullPage: true });
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('privacy');
    expect(body.length).toBeGreaterThan(500);
  });

  test('7.2 Terms of service loads with content', async ({ page }) => {
    await page.goto(`${BASE}/terms`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/07-terms.png`, fullPage: true });
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('terms');
    expect(body.length).toBeGreaterThan(500);
  });
});

test.describe('OpenSyber — Company Pages', () => {
  test('7.3 About page loads', async ({ page }) => {
    await page.goto(`${BASE}/about`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/07-about.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(200);
  });

  test('7.4 Security policy page loads', async ({ page }) => {
    await page.goto(`${BASE}/security`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/07-security.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    // Should mention encryption, compliance, or security practices
    const hasSecurity = body.toLowerCase().includes('encryption') ||
      body.toLowerCase().includes('tls') ||
      body.toLowerCase().includes('compliance') ||
      body.toLowerCase().includes('security');
    expect(hasSecurity).toBeTruthy();
  });

  test('7.5 Enterprise page loads with contact form', async ({ page }) => {
    await page.goto(`${BASE}/enterprise`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/07-enterprise.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    const hasEnterprise = body.toLowerCase().includes('enterprise') ||
      body.toLowerCase().includes('contact') ||
      body.toLowerCase().includes('sso') ||
      body.toLowerCase().includes('custom');
    expect(hasEnterprise).toBeTruthy();
  });

  test('7.6 Governance page loads', async ({ page }) => {
    await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const response = await page.goto(`${BASE}/governance`);
    expect(response?.status()).toBeLessThan(500);
  });

  test('7.7 Compliance page loads', async ({ page }) => {
    await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('7.8 Partners page loads', async ({ page }) => {
    const response = await page.goto(`${BASE}/partners`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('OpenSyber — Comparison Pages', () => {
  test('7.9 OpenSyber vs DIY monitoring comparison', async ({ page }) => {
    await page.goto(`${BASE}/compare/opensyber-vs-diy-monitoring`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/07-compare-diy.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(200);
  });

  test('7.10 TokenForge vs traditional sessions comparison', async ({ page }) => {
    await page.goto(`${BASE}/compare/tokenforge-vs-traditional-sessions`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/07-compare-tokenforge.png`, fullPage: false });
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(200);
  });
});
