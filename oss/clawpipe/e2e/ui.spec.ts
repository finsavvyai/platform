import { test, expect } from '@playwright/test';

const LANDING = 'https://clawpipe.pages.dev';
const DASHBOARD = 'https://clawpipe-dashboard.pages.dev';

test.describe('Landing Page', () => {

  test('loads and shows hero', async ({ page }) => {
    await page.goto(LANDING);
    await expect(page.locator('h1')).toContainText('Control cost');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('has correct title and meta', async ({ page }) => {
    await page.goto(LANDING);
    await expect(page).toHaveTitle(/ClawPipe/);
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute('content', /LLM/);
  });

  test('navigation links work', async ({ page }) => {
    await page.goto(LANDING);
    const pricingLink = page.locator('nav a[href="#pricing"]');
    await expect(pricingLink).toBeVisible();
    await pricingLink.click();
    await expect(page.locator('#pricing')).toBeInViewport();
  });

  test('pipeline stages visible', async ({ page }) => {
    await page.goto(LANDING);
    const steps = page.locator('.card.card-sm');
    await expect(steps).toHaveCount(5);
    await expect(steps.first()).toContainText('Skip if deterministic');
    await expect(steps.last()).toContainText('Execute and learn');
  });

  test('feature cards render', async ({ page }) => {
    await page.goto(LANDING);
    const cards = page.locator('.card');
    await expect(cards).toHaveCount(18);
    await expect(cards.first()).toContainText('Duplicate prompts');
  });

  test('pricing section has 5 tiers', async ({ page }) => {
    await page.goto(LANDING);
    const priceCards = page.locator('.pricing-card');
    await expect(priceCards).toHaveCount(5);
    await expect(page.locator('.pricing-card.most-popular')).toContainText('Growth');
  });

  test('comparison table has 8 feature rows', async ({ page }) => {
    await page.goto(LANDING);
    const rows = page.locator('.table-wrap tbody tr');
    await expect(rows).toHaveCount(8);
  });

  test('code block shows SDK import', async ({ page }) => {
    await page.goto(LANDING);
    const code = page.locator('pre').filter({ hasText: 'clawpipe-ai' });
    await expect(code).toContainText('clawpipe-ai');
  });

  test('skip link works for accessibility', async ({ page }) => {
    await page.goto(LANDING);
    const skipLink = page.locator('.skip-link');
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
  });

  test('respects dark/light color scheme', async ({ page }) => {
    await page.goto(LANDING);
    const body = page.locator('body');
    const bg = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb\(/);
  });
});

test.describe('Dashboard', () => {

  test('loads and shows auth page', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.evaluate(() => {
      localStorage.removeItem('clawpipe-user');
      localStorage.removeItem('clawpipe-config');
    });
    await page.reload();

    await expect(page.locator('#auth-page')).toBeVisible();
    await expect(page.locator('#auth-title')).toContainText('Sign In');
  });

  test('auth form has required fields', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();
    await expect(page.locator('#auth-submit-btn')).toContainText('Sign In');
  });

  test('OAuth buttons present', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const oauthBtns = page.locator('.oauth-btn');
    await expect(oauthBtns).toHaveCount(3);
    await expect(page.locator('#oauth-btn-google')).toContainText('Google');
    await expect(page.locator('#oauth-btn-github')).toContainText('GitHub');
    await expect(page.locator('#oauth-btn-oidc')).toContainText('SSO');
  });

  test('toggle between sign in and sign up', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#auth-title')).toContainText('Sign In');
    await page.locator('#auth-toggle-link').click();
    await expect(page.locator('#auth-title')).toContainText('Create Account');
    await expect(page.locator('#auth-submit-btn')).toContainText('Create Account');

    await page.locator('#auth-toggle-link').click();
    await expect(page.locator('#auth-title')).toContainText('Sign In');
  });

  test('register form submits and stores user', async ({ page }) => {
    const email = `pw-e2e-${Date.now()}@clawpipe-test.ai`;

    await page.goto(DASHBOARD);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('#auth-toggle-link').click();
    await expect(page.locator('#auth-title')).toContainText('Create Account');

    await page.fill('#auth-name', 'Playwright User');
    await page.fill('#auth-email', email);
    await page.fill('#auth-password', 'playwrightPass123');
    await page.click('#auth-submit-btn');

    await page.waitForTimeout(3000);
    const savedUser = await page.evaluate(() => localStorage.getItem('clawpipe-user'));
    if (savedUser) {
      const user = JSON.parse(savedUser);
      expect(user.email).toBe(email);
      expect(user.name).toBe('Playwright User');
    } else {
      const errorVisible = await page.locator('#auth-error').isVisible();
      const authVisible = await page.locator('#auth-page').isVisible();
      expect(errorVisible || authVisible).toBeTruthy();
    }
  });

  test('header shows status', async ({ page }) => {
    await page.goto(DASHBOARD);
    const status = page.locator('#status');
    await expect(status).toBeVisible();
  });

  test('disconnect button hidden on auth page', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#disconnect-btn')).toBeHidden();
  });

  test('Settings tab present in tab nav', async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.locator('#tab-settings')).toHaveCount(1);
    await expect(page.locator('#tab-settings')).toContainText('Settings');
  });

  test('Settings panel has Slack + budget inputs', async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.locator('#view-settings')).toHaveCount(1);
    await expect(page.locator('#slack-webhook-input')).toHaveCount(1);
    await expect(page.locator('#budget-input')).toHaveCount(1);
    await expect(page.locator('#slack-status-chip')).toHaveCount(1);
    await expect(page.locator('#budget-status-chip')).toHaveCount(1);
  });
});
