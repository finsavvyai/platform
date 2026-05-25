import { test, expect, type Page } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Landing Page & Hero', () => {
  test('1.1 Homepage loads with correct title', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/OpenSyber/i);
    await page.screenshot({ path: `${SHOTS}/01-landing-hero.png`, fullPage: false });
  });

  test('1.2 Hero section has primary CTA', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Look for sign-up or get-started CTA
    const cta = page.locator('a[href*="sign-up"], a[href*="sign-in"], button:has-text("Get Started"), button:has-text("Sign Up"), a:has-text("Get Started")').first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test('1.3 Navigation bar has all expected links', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    for (const item of OPENSYBER.headerNav) {
      const navLink = page.locator(`nav a, header a`).filter({ hasText: new RegExp(item, 'i') }).first();
      await expect(navLink).toBeVisible({ timeout: 5_000 });
    }
    await page.screenshot({ path: `${SHOTS}/01-landing-nav.png`, fullPage: false });
  });

  test('1.4 Hero mentions key value props (runtime security, AI agents)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const body = await page.textContent('body');
    expect(body?.toLowerCase()).toContain('runtime');
    // Should mention agents or AI
    const hasAgent = body?.toLowerCase().includes('agent');
    const hasAI = body?.toLowerCase().includes('ai');
    expect(hasAgent || hasAI).toBeTruthy();
  });

  test('1.5 Solution layers section renders', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SHOTS}/01-landing-features.png`, fullPage: false });
    const body = await page.textContent('body');
    // Should have some feature/value-prop sections
    const hasRuntime = body?.toLowerCase().includes('runtime');
    const hasPolicy = body?.toLowerCase().includes('policy');
    const hasMarketplace = body?.toLowerCase().includes('marketplace') || body?.toLowerCase().includes('skill');
    expect(hasRuntime || hasPolicy || hasMarketplace).toBeTruthy();
  });

  test('1.6 Footer has essential links', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 5_000 });
    // Check for privacy and terms links
    const privacyLink = footer.locator('a[href*="privacy"]').first();
    const termsLink = footer.locator('a[href*="terms"]').first();
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-landing-footer.png`, fullPage: false });
  });

  test('1.7 Full page screenshot for visual regression', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/01-landing-full.png`, fullPage: true });
  });
});
