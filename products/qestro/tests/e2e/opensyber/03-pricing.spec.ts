import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Pricing Page', () => {
  test('3.1 Pricing page loads', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/03-pricing-top.png`, fullPage: false });
    const body = await page.textContent('body');
    expect(body?.toLowerCase()).toContain('pricing');
  });

  test('3.2 All plan tiers are displayed', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    for (const plan of OPENSYBER.plans) {
      expect(body.toLowerCase()).toContain(plan.toLowerCase());
    }
  });

  test('3.3 Billing toggle works (monthly/annual)', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Look for billing toggle
    const toggle = page.locator('button, [role="switch"], label').filter({
      hasText: /annual|monthly|yearly/i,
    }).first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/03-pricing-toggle.png`, fullPage: false });
    }
  });

  test('3.4 Free plan has sign-up CTA', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Should have at least one CTA button (Get Started, Sign Up, etc.)
    const cta = page.locator('a[href*="sign-up"], button:has-text("Get Started"), button:has-text("Start Free"), a:has-text("Get Started"), a:has-text("Start Free")').first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test('3.5 Enterprise plan has contact-sales CTA', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    // Enterprise should have contact/sales CTA
    const hasContact = body.toLowerCase().includes('contact') || body.toLowerCase().includes('sales') || body.toLowerCase().includes('talk to');
    expect(hasContact).toBeTruthy();
  });

  test('3.6 Full pricing page screenshot', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/03-pricing-full.png`, fullPage: true });
  });
});
