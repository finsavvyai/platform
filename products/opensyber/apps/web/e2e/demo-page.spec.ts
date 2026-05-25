import { test, expect } from '@playwright/test';

/**
 * Demo page tests — simulated dashboard, interactive tabs,
 * metrics display, and CTA elements.
 */
test.describe('Demo — Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo');
  });

  test('demo page renders with navigation', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('demo has tab navigation controls', async ({ page }) => {
    const overview = page.getByRole('button', { name: /overview/i }).or(
      page.getByText('Overview').first()
    );
    await expect(overview).toBeVisible();
  });

  test('demo shows resource gauges', async ({ page }) => {
    await page.waitForTimeout(2000);
    const gauge = page.getByText(/CPU|Memory|Disk/i).first();
    await expect(gauge).toBeVisible();
  });
});

test.describe('Demo — Tab Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo');
  });

  test('events tab is clickable and shows content', async ({ page }) => {
    const eventsTab = page.getByRole('button', { name: /events/i }).or(
      page.getByText('Events').first()
    );
    await eventsTab.click();
    await page.waitForTimeout(3000);
    // Should show event list items or loading state
    const content = page.locator(
      'tr, li, [class*="event"], [class*="feed"], [class*="row"]'
    );
    const count = await content.count();
    expect(count).toBeGreaterThan(0);
  });

  test('network tab renders visualization', async ({ page }) => {
    const networkTab = page.getByRole('button', { name: /network/i }).or(
      page.getByText('Network').first()
    );
    await networkTab.click();
    await page.waitForTimeout(1000);
    const viz = page.locator('svg, canvas, [class*="network"]').first();
    await expect(viz).toBeVisible();
  });
});

test.describe('Demo — CTA & Navigation', () => {
  test('demo page has CTA to sign up or dashboard', async ({ page }) => {
    await page.goto('/demo');
    const cta = page.getByRole('link', {
      name: /sign up|start free|get started|dashboard/i,
    });
    await expect(cta.first()).toBeVisible();
  });

  test('demo page does not require authentication', async ({ page }) => {
    await page.goto('/demo');
    // Should NOT redirect to sign-in
    expect(page.url()).not.toContain('sign-in');
  });
});
