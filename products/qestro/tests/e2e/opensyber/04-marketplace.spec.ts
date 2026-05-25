import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Skills Marketplace', () => {
  test('4.1 Marketplace page loads', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/04-marketplace.png`, fullPage: false });
    const body = await page.textContent('body');
    const hasMarketplace = body?.toLowerCase().includes('marketplace') ||
      body?.toLowerCase().includes('skill') ||
      body?.toLowerCase().includes('catalog');
    expect(hasMarketplace).toBeTruthy();
  });

  test('4.2 Skill cards are visible', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Should have card-like elements for skills
    const cards = page.locator('[class*="card"], [class*="Card"], article, [class*="skill"], [class*="Skill"]');
    const count = await cards.count();
    // Expect at least a few skills visible
    expect(count).toBeGreaterThan(0);
  });

  test('4.3 Category filters are present', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    let categoriesFound = 0;
    for (const cat of OPENSYBER.skillCategories) {
      if (body.toLowerCase().includes(cat.toLowerCase())) {
        categoriesFound++;
      }
    }
    // At least 2 categories should be visible
    expect(categoriesFound).toBeGreaterThanOrEqual(2);
  });

  test('4.4 Skill detail page loads (first skill)', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Click on the first skill link/card
    const skillLink = page.locator('a[href*="/marketplace/"]').filter({
      hasNotText: /bundle|catalog|back/i,
    }).first();
    if (await skillLink.isVisible()) {
      await skillLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SHOTS}/04-skill-detail.png`, fullPage: false });
      const body = await page.textContent('body') || '';
      // Skill detail should have description or install info
      const hasDetail = body.toLowerCase().includes('install') ||
        body.toLowerCase().includes('description') ||
        body.toLowerCase().includes('version') ||
        body.toLowerCase().includes('rating');
      expect(hasDetail).toBeTruthy();
    }
  });

  test('4.5 Bundles page loads', async ({ page }) => {
    await page.goto(`${BASE}/marketplace/bundles`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/04-bundles.png`, fullPage: false });
    // Page should render without error
    const body = await page.textContent('body');
    expect(body?.toLowerCase()).not.toContain('404');
    expect(body?.toLowerCase()).not.toContain('not found');
  });

  test('4.6 Full marketplace screenshot', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/04-marketplace-full.png`, fullPage: true });
  });
});
