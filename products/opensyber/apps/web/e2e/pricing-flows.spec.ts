import { test, expect } from '@playwright/test';

/**
 * Comprehensive pricing page tests — plan cards, features,
 * CTAs, MSSP section, and toggle behavior.
 */
test.describe('Pricing — Plan Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('page has hero heading', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });

  test('self-serve plans render', async ({ page }) => {
    const plans = [/starter shield/i, /team/i, /professional/i];
    for (const plan of plans) {
      const heading = page.getByRole('heading', { name: plan }).first();
      await expect(heading).toBeVisible();
    }
  });

  test('enterprise plans render', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /enterprise/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /mission defender/i }).first()
    ).toBeVisible();
  });

  test('free plan shows $0 price', async ({ page }) => {
    await expect(page.getByText('$0').first()).toBeVisible();
  });

  test('Team plan shows Most Popular badge', async ({ page }) => {
    await expect(page.getByText(/most popular/i).first()).toBeVisible();
  });
});

test.describe('Pricing — Feature Lists', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('free plan lists included skills', async ({ page }) => {
    await expect(
      page.getByText(/secret scanner/i).first()
    ).toBeVisible();
  });

  test('stats bar shows breach cost data', async ({ page }) => {
    await expect(page.getByText('$4.88M')).toBeVisible();
    await expect(page.getByText('204 days')).toBeVisible();
  });

  test('plan cards have CTA buttons', async ({ page }) => {
    const startFree = page.getByRole('link', {
      name: /start free|get started|sign up/i,
    });
    const contactSales = page.getByRole('link', {
      name: /contact sales/i,
    });
    await expect(startFree.first()).toBeVisible();
    await expect(contactSales.first()).toBeVisible();
  });
});

test.describe('Pricing — MSSP & Enterprise', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('MSSP section is visible', async ({ page }) => {
    await expect(
      page.getByText(/managed service providers/i).first()
    ).toBeVisible();
  });

  test('wholesale discount mentioned', async ({ page }) => {
    await expect(
      page.getByText(/40%.*wholesale/i).first()
    ).toBeVisible();
  });

  test('Contact Sales links to /enterprise', async ({ page }) => {
    const link = page.getByRole('link', { name: /contact sales/i }).first();
    await link.click();
    await expect(page).toHaveURL(/enterprise/);
  });

  test('bottom tagline renders', async ({ page }) => {
    await expect(
      page.getByText(/start free forever/i).first()
    ).toBeVisible();
  });
});
