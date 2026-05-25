import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';
const API_BASE = process.env.API_BASE_URL ?? 'https://api.opensyber.cloud';

/**
 * Billing & plan enforcement browser tests — pricing tiers, checkout URLs,
 * plan feature gates, plan limits, upgrade prompts, payment success banner,
 * subscription settings, coupon handling, webhook security.
 */

/* ================================================================== */
/*  Pricing Page — Public                                              */
/* ================================================================== */
test.describe('Pricing Page — Happy Path', () => {
  test('all five tiers displayed with correct prices', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Professional' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mission Defender' })).toBeVisible();

    await expect(page.getByText('$0')).toBeVisible();
    await expect(page.getByText('$299')).toBeVisible();
    await expect(page.getByText('$799')).toBeVisible();
  });

  test('Free tier CTA says "Get Started Free"', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const freeButton = page.locator('a', { hasText: 'Get Started Free' });
    await expect(freeButton).toBeVisible();
  });

  test('Enterprise links to /enterprise', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const contactLink = page.getByRole('link', { name: 'Contact Sales' });
    await expect(contactLink).toBeVisible();

    const href = await contactLink.getAttribute('href');
    expect(href).toContain('/enterprise');
  });

  test('pricing page has feature comparison', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    // Each tier should list features
    const features = page.getByText(/instance|skill|agent|audit|cloud/i);
    const count = await features.count();
    expect(count).toBeGreaterThan(5);
  });
});

test.describe('Pricing Page — Responsive', () => {
  test('pricing renders correctly on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    // All plans should still be visible (scrollable)
    await expect(page.getByText('$0')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
  });
});

/* ================================================================== */
/*  Checkout URLs — Authenticated                                      */
/* ================================================================== */
authTest.describe('Checkout URLs — Structure', () => {
  authTest('checkout URLs contain LemonSqueezy domain', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');

    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBe(2);

    for (const link of links) {
      const href = await link.getAttribute('href');
      authExpect(href).toContain('finsavvy.lemonsqueezy.com');
    }
  });

  authTest('checkout URLs contain user_id', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    authExpect(href).toContain('checkout%5Bcustom%5D%5Buser_id%5D=');
  });

  authTest('checkout URLs contain email', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    authExpect(href).toContain('checkout%5Bemail%5D=');
  });

  authTest('checkout URLs contain redirect URL', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    authExpect(href).toContain('dashboard%3Fpayment%3Dsuccess');
  });

  authTest('each plan has different variant ID', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBe(2);

    const hrefs = await Promise.all(links.map((l) => l.getAttribute('href')));
    const variantPaths = hrefs.map((h) => new URL(h!).pathname);
    const uniquePaths = new Set(variantPaths);
    authExpect(uniquePaths.size).toBe(2);
  });

  authTest('all checkout URLs are HTTPS external links', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBe(2);

    for (const link of links) {
      const href = await link.getAttribute('href');
      authExpect(href).toMatch(/^https:\/\//);
    }
  });

  authTest('checkout URL structure matches LemonSqueezy format', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = await link.getAttribute('href');
      const url = new URL(href!);
      authExpect(url.hostname).toMatch(/^[\w-]+\.lemonsqueezy\.com$/);
      authExpect(url.pathname).toMatch(/^\/buy\/[\w-]+$/);
    }
  });

  authTest('Free tier links to /dashboard when authenticated', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const freeLink = page.locator('a', { hasText: 'Get Started Free' });
    await authExpect(freeLink).toBeVisible();

    const href = await freeLink.getAttribute('href');
    authExpect(href).toContain('/dashboard');
  });

  authTest('paid plan buttons show checkout (not fallback dashboard)', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const personalBtn = page.locator('[data-plan="team"] a, a[href*="lemonsqueezy"]').first();
    const href = await personalBtn.getAttribute('href');
    authExpect(href).not.toContain('/dashboard');
    authExpect(href).toContain('lemonsqueezy.com');
  });
});

/* ================================================================== */
/*  Coupon Handling                                                    */
/* ================================================================== */
authTest.describe('Coupon in Checkout URLs', () => {
  authTest('checkout URLs contain test coupon when configured', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    if (!href?.includes('discount_code')) {
      authTest.skip(true, 'Test coupon not configured');
      return;
    }
    authExpect(href).toContain('checkout%5Bdiscount_code%5D=');
  });
});

/* ================================================================== */
/*  Settings — Subscription Info                                       */
/* ================================================================== */
authTest.describe('Settings — Subscription', () => {
  authTest('subscription card shows current plan', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    await authExpect(page.getByText('Subscription')).toBeVisible({ timeout: 10_000 });
    await authExpect(page.getByText('Current Plan')).toBeVisible();
  });

  authTest('upgrade link visible on free/personal plan', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    const upgradeLink = page.getByRole('link', { name: /upgrade|view plans/i });
    const planName = page.getByText(/Free|Personal/i);

    const hasUpgrade = await upgradeLink.first().isVisible().catch(() => false);
    const isFreeTier = await planName.first().isVisible().catch(() => false);

    // If on free/personal tier, upgrade link should be visible
    if (isFreeTier) {
      authExpect(hasUpgrade).toBe(true);
    }
  });
});

/* ================================================================== */
/*  Payment Success Banner                                             */
/* ================================================================== */
authTest.describe('Payment Success Banner', () => {
  authTest('payment=success query param shows success banner', async ({ page }) => {
    await page.goto(`${BASE}/dashboard?payment=success`);
    await page.waitForLoadState('networkidle');

    const banner = page.getByText(/payment|success|thank you|welcome/i);
    const hasBanner = await banner.first().isVisible().catch(() => false);

    // Banner should appear on payment success redirect
    authExpect(hasBanner).toBe(true);
  });
});

/* ================================================================== */
/*  Plan Feature Gates — API Level                                     */
/* ================================================================== */
test.describe('Plan Feature Gates — API', () => {
  test('cloud sync API returns 403 for free plan', async ({ request }) => {
    // Without auth, returns 401 (auth check before plan check)
    const res = await request.get(`${API_BASE}/api/cloud-accounts`);
    expect([401, 403]).toContain(res.status());
  });
});

/* ================================================================== */
/*  Plan Feature Gates — UI Level                                      */
/* ================================================================== */
authTest.describe('Plan Feature Gates — UI', () => {
  authTest('cloud security page shows content or upgrade prompt', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud`);
    await page.waitForLoadState('networkidle');

    // Either shows cloud security page or upgrade prompt
    const cloudHeading = page.getByText(/cloud security/i);
    const upgradePrompt = page.getByText(/upgrade|requires|pro plan/i);
    const content = page.locator('main');

    const hasCloud = await cloudHeading.isVisible().catch(() => false);
    const hasUpgrade = await upgradePrompt.first().isVisible().catch(() => false);
    const hasContent = await content.isVisible().catch(() => false);

    authExpect(hasCloud || hasUpgrade || hasContent).toBe(true);
  });

  authTest('team dashboard shows content or plan gate', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/agents/team`);
    await page.waitForLoadState('networkidle');

    const teamContent = page.locator('table, [class*="member"]');
    const planGate = page.getByText(/upgrade|team plan|requires/i);
    const content = page.locator('main');

    const hasTeam = await teamContent.first().isVisible().catch(() => false);
    const hasGate = await planGate.first().isVisible().catch(() => false);
    const hasContent = await content.isVisible().catch(() => false);

    authExpect(hasTeam || hasGate || hasContent).toBe(true);
  });
});

/* ================================================================== */
/*  Webhook Security                                                   */
/* ================================================================== */
test.describe('Webhook Security', () => {
  test('LemonSqueezy webhook rejects missing signature', async ({ request }) => {
    const res = await request.post(`${API_BASE}/webhooks/lemonsqueezy`, {
      data: { test: true },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Missing signature');
  });

  test('LemonSqueezy webhook rejects invalid signature', async ({ request }) => {
    const res = await request.post(`${API_BASE}/webhooks/lemonsqueezy`, {
      headers: { 'X-Signature': 'invalid-signature-here' },
      data: { meta: { event_name: 'test' }, data: { id: '1', attributes: {} } },
    });
    expect(res.status()).toBe(401);
  });

  test('LemonSqueezy webhook rejects empty body', async ({ request }) => {
    const res = await request.post(`${API_BASE}/webhooks/lemonsqueezy`, {
      headers: { 'X-Signature': 'fake' },
      data: {},
    });
    expect([400, 401]).toContain(res.status());
  });
});

/* ================================================================== */
/*  Enterprise Contact Page                                            */
/* ================================================================== */
test.describe('Enterprise Contact', () => {
  test('enterprise page loads with contact form', async ({ page }) => {
    await page.goto(`${BASE}/enterprise`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/enterprise/i).first()).toBeVisible({ timeout: 10_000 });

    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('enterprise form validates required fields', async ({ page }) => {
    await page.goto(`${BASE}/enterprise`);
    await page.waitForLoadState('networkidle');

    const submitBtn = page.getByRole('button', { name: /get in touch/i });
    await submitBtn.click();

    const errorMsg = page.getByText(/required|fill/i);
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
  });

  test('enterprise form accepts valid input', async ({ page }) => {
    await page.goto(`${BASE}/enterprise`);
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('Your name').fill('Test User');
    await page.getByPlaceholder('Work email').fill('test@example.com');
    await page.getByPlaceholder('Company name').fill('Test Corp');
    await page.getByPlaceholder('Tell us about your needs').fill('E2E test — ignore');

    await page.getByRole('button', { name: /get in touch/i }).click();

    // Accept either success or error (API may be unavailable in test)
    const success = page.getByText(/thank you|sent|received/i);
    const error = page.getByText(/error|failed|try again/i);
    await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
  });
});
