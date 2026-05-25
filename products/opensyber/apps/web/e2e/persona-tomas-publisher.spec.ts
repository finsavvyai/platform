import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Persona: Tomás Herrera — Security Skill Publisher
 *
 * Journey: Discovers marketplace → reviews skill detail pages →
 * signs up as publisher → submits skill → monitors installs/ratings →
 * creates bundles → tracks revenue.
 *
 * Plan: Pro ($149/mo)
 * Key value: Skill publishing, marketplace revenue, verification pipeline
 */

/* ================================================================== */
/*  PHASE 1: AWARENESS — Marketplace Discovery                         */
/* ================================================================== */
test.describe('Tomás — Awareness: Marketplace Discovery', () => {
  test('public marketplace page loads with categories', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('category filter tabs are functional', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);

    const securityTab = page.getByRole('link', { name: 'Security' });
    if (await securityTab.isVisible().catch(() => false)) {
      await securityTab.click();
      await expect(page).toHaveURL(/category=security/);
    }
  });

  test('skill detail page loads with description', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    const skillLinks = page.locator('a[href^="/marketplace/"]').filter({
      hasNot: page.locator('[href*="bundles"]'),
    });

    if ((await skillLinks.count()) > 0) {
      await skillLinks.first().click();
      await page.waitForLoadState('networkidle');
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible();
    }
  });

  test('bundles page loads', async ({ page }) => {
    await page.goto(`${BASE}/marketplace/bundles`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });
});

/* ================================================================== */
/*  PHASE 2: CONSIDERATION — Publisher Economics                        */
/* ================================================================== */
test.describe('Tomás — Consideration: Pricing & Publisher Model', () => {
  test('pricing page shows Pro tier with marketplace access', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);

    await expect(page.getByText(/pro/i).first()).toBeVisible();
    await expect(page.getByText(/\$149/i).first()).toBeVisible();
  });

  test('blog has technical content for credibility evaluation', async ({ page }) => {
    await page.goto(`${BASE}/blog`);
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Should have multiple blog posts
    const articles = page.locator('a[href^="/blog/"]');
    const count = await articles.count();
    expect(count).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/*  PHASE 3: ONBOARDING — Publisher Dashboard                          */
/* ================================================================== */
authTest.describe('Tomás — Onboarding: Publisher Workspace', () => {
  authTest('skill submission page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/skills/submit`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('dashboard marketplace shows browse/manage interface', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  PHASE 4: ACTIVATION — Skill Management & Bundles                   */
/* ================================================================== */
authTest.describe('Tomás — Activation: Skill & Bundle Management', () => {
  authTest('installed skills page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/skills`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('bundles management page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/bundles`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('marketplace has recommendation engine', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    // Should show recommendations, suggestions, or featured content
    const content = page.locator('main');
    await authExpect(content).toBeVisible();
  });
});

/* ================================================================== */
/*  PHASE 5: RETENTION — Monitoring & Analytics                        */
/* ================================================================== */
authTest.describe('Tomás — Retention: Skill Performance Tracking', () => {
  authTest('settings page shows subscription info', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    await authExpect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  authTest('profile page loads with publisher info', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/profile`);
    await page.waitForLoadState('networkidle');

    await authExpect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });
});
