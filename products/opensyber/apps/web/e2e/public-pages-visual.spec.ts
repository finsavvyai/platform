import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

/** Collect console errors during page visit */
function collectConsoleErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

function filterRealErrors(errors: string[]) {
  return errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('Content Security Policy') &&
      !e.includes('hydration') &&
      !e.includes('status of 404')
  );
}

test.describe('Public Pages Visual Validation', () => {
  test.describe.configure({ timeout: 30_000 });

  test('1. Home page — hero, features, social proof, footer', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const resp = await page.goto('/', { waitUntil: 'networkidle' });

    expect(resp?.status()).toBe(200);

    // Hero heading
    const heroH1 = page.locator('h1').first();
    await expect(heroH1).toBeVisible();
    const heroText = await heroH1.textContent();
    expect(heroText?.toLowerCase()).toContain('agent');

    // Navigation header
    const nav = page.locator('header, nav').first();
    await expect(nav).toBeVisible();

    // Footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Social proof badges (e.g. "ZERO TRUST", "SOC2", etc.)
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-home-full.png'),
      fullPage: true,
    });

    const realErrors = filterRealErrors(errors);
    expect(realErrors).toEqual([]);
  });

  test('2. Pricing page — pricing tiers render', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const resp = await page.goto('/pricing', { waitUntil: 'networkidle' });

    expect(resp?.status()).toBe(200);

    // Price amounts visible
    const priceText = page.locator('text=/\\$\\d+/');
    expect(await priceText.count()).toBeGreaterThan(2);

    // Plan names visible (Starter, Team, Professional, Enterprise)
    await expect(page.locator('text=Starter Shield')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Professional' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();

    // Monthly/Annual toggle
    await expect(page.locator('text=/monthly|annual/i').first()).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-pricing-full.png'),
      fullPage: true,
    });

    const realErrors = filterRealErrors(errors);
    expect(realErrors).toEqual([]);
  });

  test('3. Marketplace — skill cards render', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const resp = await page.goto('/marketplace', { waitUntil: 'networkidle' });

    expect(resp?.status()).toBe(200);

    // Heading
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('skill');

    // Skill cards with "Verified" badges
    const verifiedBadges = page.locator('text=Verified');
    expect(await verifiedBadges.count()).toBeGreaterThan(0);

    // Category filter pills
    await expect(page.locator('text=Security').first()).toBeVisible();

    // At least 6 skill cards visible
    const skillNames = ['Secret Scanner', 'Slack Security Alerts', 'Dependency Auditor',
      'Git Guardian', 'Supply Chain Guard', 'Log Analyzer'];
    for (const name of skillNames) {
      await expect(page.locator(`text=${name}`)).toBeVisible();
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-marketplace-full.png'),
      fullPage: true,
    });

    const realErrors = filterRealErrors(errors);
    expect(realErrors).toEqual([]);
  });

  test('4. Blog — blog post list renders', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const resp = await page.goto('/blog', { waitUntil: 'networkidle' });

    expect(resp?.status()).toBe(200);

    // Blog heading
    await expect(page.locator('h1').filter({ hasText: 'Blog' })).toBeVisible();

    // Blog posts with "Read more" links
    const readMoreLinks = page.locator('text=/Read more/i');
    expect(await readMoreLinks.count()).toBeGreaterThan(5);

    // Category filter tags
    await expect(page.locator('text=Threat Intel').first()).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-blog-full.png'),
      fullPage: true,
    });

    const realErrors = filterRealErrors(errors);
    expect(realErrors).toEqual([]);
  });

  test('5. Demo — security dashboard renders', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const resp = await page.goto('/demo', { waitUntil: 'networkidle' });

    expect(resp?.status()).toBe(200);

    // Dashboard title
    await expect(page.locator('text=Security Dashboard').first()).toBeVisible();

    // Security score visible
    await expect(page.locator('text=Security Score')).toBeVisible();

    // Tabs (Overview, Events, Network)
    await expect(page.locator('text=Overview').first()).toBeVisible();
    await expect(page.locator('text=Events').first()).toBeVisible();

    // Instance status
    await expect(page.locator('text=Running').first()).toBeVisible();

    // Score breakdown section
    await expect(page.locator('text=Score Breakdown')).toBeVisible();

    // Recent security events
    await expect(page.locator('text=Recent Security Events')).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-demo-full.png'),
      fullPage: true,
    });

    const realErrors = filterRealErrors(errors);
    expect(realErrors).toEqual([]);
  });

  test('6. Threats — live threat feed renders', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const resp = await page.goto('/threats', { waitUntil: 'networkidle' });

    expect(resp?.status()).toBe(200);

    // Heading
    await expect(page.locator('text=Threat Intelligence')).toBeVisible();

    // LIVE badge
    await expect(page.locator('text=LIVE')).toBeVisible();

    // Threat count
    await expect(page.locator('text=/\\d+.*threats blocked/i')).toBeVisible();

    // Threat entries with severity badges
    const severityBadges = page.locator('text=/CRITICAL|HIGH|MEDIUM/');
    expect(await severityBadges.count()).toBeGreaterThan(2);

    // Status labels
    const blockedLabels = page.locator('text=BLOCKED');
    expect(await blockedLabels.count()).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-threats-full.png'),
      fullPage: true,
    });

    const realErrors = filterRealErrors(errors);
    expect(realErrors).toEqual([]);
  });

  test('7. Sign-in — OAuth buttons render', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const resp = await page.goto('/sign-in', { waitUntil: 'networkidle' });

    expect(resp?.status()).toBe(200);

    // Sign-in heading
    await expect(page.locator('text=Sign in to OpenSyber')).toBeVisible();

    // All 4 OAuth providers
    await expect(page.locator('text=Continue with Google')).toBeVisible();
    await expect(page.locator('text=Continue with GitHub')).toBeVisible();
    await expect(page.locator('text=Continue with Microsoft')).toBeVisible();
    await expect(page.locator('text=Continue with LinkedIn')).toBeVisible();

    // Welcome message on left panel
    await expect(page.locator('text=Welcome Back').first()).toBeVisible();

    // Feature bullets
    await expect(page.locator('text=Real-time security monitoring')).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-signin-full.png'),
      fullPage: true,
    });

    const realErrors = filterRealErrors(errors);
    expect(realErrors).toEqual([]);
  });
});
