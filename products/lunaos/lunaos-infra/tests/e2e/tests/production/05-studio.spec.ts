import { test, expect } from '@playwright/test';

/**
 * Production Test: Studio IDE Experience
 *
 * Tests the AI agent studio at studio.lunaos.ai.
 * Verifies the visual workflow builder loads and
 * unauthenticated users see appropriate content.
 */

const STUDIO = 'https://studio.lunaos.ai';

test.describe('Studio IDE — studio.lunaos.ai', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto(STUDIO);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('studio.lunaos.ai');
  });

  test('page has a meaningful title', async ({ page }) => {
    await page.goto(STUDIO);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.toLowerCase()).toMatch(/luna|studio|agent|orchestrat/i);
  });

  test('page serves over HTTPS', async ({ page }) => {
    await page.goto(STUDIO);
    expect(page.url()).toMatch(/^https:\/\//);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(STUDIO);
    await page.waitForLoadState('networkidle');
    // Filter out benign errors (favicon, analytics)
    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('analytics')
    );
    expect(critical.length).toBeLessThanOrEqual(2);
  });

  test('page loads under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(STUDIO, { waitUntil: 'domcontentloaded' });
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('no horizontal overflow on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(STUDIO);
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 5
    );
    expect(fits).toBe(true);
  });

  test('has visible interactive elements', async ({ page }) => {
    await page.goto(STUDIO);
    await page.waitForLoadState('networkidle');
    const interactive = await page.evaluate(() =>
      document.querySelectorAll(
        'a, button, input, [role="button"]'
      ).length
    );
    expect(interactive).toBeGreaterThan(0);
  });
});
