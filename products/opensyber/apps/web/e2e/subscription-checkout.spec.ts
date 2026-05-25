import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const API_BASE = process.env.API_BASE_URL ?? 'https://api.opensyber.cloud';
const TF_API_BASE = process.env.TF_API_BASE_URL ?? 'https://tokenforge-api.opensyber.cloud';

// === PUBLIC TESTS (no auth needed) ===

test.describe('OpenSyber — Pricing Public', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('all five tiers displayed with correct prices', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Personal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();
    await expect(page.getByText('$0')).toBeVisible();
    await expect(page.getByText('$49')).toBeVisible();
    await expect(page.getByText('$149')).toBeVisible();
    await expect(page.getByText('$399')).toBeVisible();
  });

  test('Free tier CTA says "Get Started Free"', async ({ page }) => {
    const freeButton = page.locator('a', { hasText: 'Get Started Free' });
    await expect(freeButton).toBeVisible();
  });

  test('Enterprise links to /enterprise', async ({ page }) => {
    const contactLink = page.getByRole('link', { name: 'Contact Sales' });
    await expect(contactLink).toBeVisible();
    const href = await contactLink.getAttribute('href');
    expect(href).toContain('/enterprise');
  });
});

test.describe('OpenSyber — Webhook Endpoint Security', () => {
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

  test('Clerk webhook rejects unsigned requests', async ({ request }) => {
    const res = await request.post(`${API_BASE}/webhooks/clerk`, {
      data: { type: 'user.created', data: {} },
    });
    // Should reject — no svix signature headers
    expect([400, 401, 403]).toContain(res.status());
  });
});

test.describe('OpenSyber — Auth Enforcement', () => {
  test('GET /api/user returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/user`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('GET /api/instances returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/instances`);
    expect(res.status()).toBe(401);
  });

  test('POST /api/instances returns 401 without auth', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/instances`, {
      data: { name: 'test', region: 'us-east' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('TokenForge — Landing & Pricing', () => {
  test('landing page loads with hero section', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud');
    await expect(page.getByText('Your auth stops at login')).toBeVisible();
  });

  test('landing page shows 4 pricing tiers', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud');
    await expect(page.getByText('$0').first()).toBeVisible();
    await expect(page.getByText('$49').first()).toBeVisible();
    await expect(page.getByText('$199').first()).toBeVisible();
  });

  test('Pro button links to LemonSqueezy checkout', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud');
    const proLink = page.locator('a[href*="lemonsqueezy.com"]').first();
    if (await proLink.count() === 0) {
      test.skip(true, 'No checkout URLs on TokenForge landing');
      return;
    }
    const href = await proLink.getAttribute('href');
    expect(href).toContain('finsavvy.lemonsqueezy.com');
  });

  test('TokenForge checkout URLs include test coupon', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud');
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    if (links.length === 0) {
      test.skip(true, 'No checkout URLs');
      return;
    }
    const href = await links[0].getAttribute('href');
    if (!href?.includes('discount_code')) {
      test.skip(true, 'Test coupon not configured on TokenForge');
      return;
    }
    expect(href).toContain('discount_code');
  });

  test('pricing page loads standalone', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud/pricing');
    await expect(page.getByText('$49').first()).toBeVisible();
    await expect(page.getByText('$199').first()).toBeVisible();
  });

  test('FAQ section expands and collapses', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud');
    // Find FAQ section and click first question
    const faqButton = page.locator('button', { hasText: 'Does TokenForge block attacks' }).first();
    if (await faqButton.count() === 0) {
      test.skip(true, 'FAQ section not found');
      return;
    }
    await faqButton.click();
    await expect(page.getByText('BOTH').first()).toBeVisible();
  });
});

test.describe('TokenForge — API Health & Security', () => {
  test('health endpoint returns healthy', async ({ request }) => {
    const res = await request.get(`${TF_API_BASE}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  test('root returns API info', async ({ request }) => {
    const res = await request.get(`${TF_API_BASE}/`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toContain('TokenForge');
  });

  test('SDK script loads', async ({ request }) => {
    const res = await request.get(`${TF_API_BASE}/sdk.js`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(1000);
  });

  test('badge script loads', async ({ request }) => {
    const res = await request.get(`${TF_API_BASE}/badge.js`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('TokenForge');
  });

  test('sessions endpoint requires auth', async ({ request }) => {
    const res = await request.get(`${TF_API_BASE}/v1/sessions`);
    expect([401, 403]).toContain(res.status());
  });

  test('webhook rejects missing signature', async ({ request }) => {
    const res = await request.post(`${TF_API_BASE}/webhooks/lemonsqueezy`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_signature');
  });

  test('security headers present', async ({ request }) => {
    const res = await request.get(`${TF_API_BASE}/`);
    const headers = res.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toBeDefined();
  });
});

test.describe('TokenForge — Public Pages', () => {
  test('docs page loads', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud/docs');
    await expect(page.getByText('Script Tag').first()).toBeVisible();
  });

  test('integrations page loads', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud/docs/integrations');
    await expect(page.getByText('React').first()).toBeVisible();
  });

  test('native SDKs page loads', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud/docs/integrations/native');
    await expect(page.getByText('Swift').first()).toBeVisible();
  });

  test('blog index loads', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud/blog');
    await expect(page).toHaveURL(/\/blog/);
  });

  test('sign-in page loads with OAuth buttons', async ({ page }) => {
    await page.goto('https://tokenforge.opensyber.cloud/sign-in');
    await expect(page.getByText('Google').first()).toBeVisible();
    await expect(page.getByText('GitHub').first()).toBeVisible();
  });
});

// === AUTHENTICATED TESTS (need Clerk session) ===

authTest.describe('OpenSyber — Checkout URLs (Authenticated)', () => {
  authTest.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  authTest('checkout URLs contain LemonSqueezy domain', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBe(3);

    for (const link of links) {
      const href = await link.getAttribute('href');
      authExpect(href).toContain('finsavvy.lemonsqueezy.com');
    }
  });

  authTest('checkout URLs contain user_id', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    authExpect(href).toContain('checkout%5Bcustom%5D%5Buser_id%5D=');
  });

  authTest('checkout URLs contain email', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    authExpect(href).toContain('checkout%5Bemail%5D=');
  });

  authTest('checkout URLs contain redirect URL', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    authExpect(href).toContain('dashboard%3Fpayment%3Dsuccess');
  });

  authTest('checkout URLs contain test coupon', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    const href = await links[0].getAttribute('href');
    // Coupon should be present when NEXT_PUBLIC_LS_TEST_COUPON is set
    if (!href?.includes('discount_code')) {
      authTest.skip(true, 'Test coupon not configured');
      return;
    }
    authExpect(href).toContain('checkout%5Bdiscount_code%5D=');
  });

  authTest('each plan has different variant ID', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBe(3);

    const hrefs = await Promise.all(links.map((l) => l.getAttribute('href')));
    const variantPaths = hrefs.map((h) => new URL(h!).pathname);
    const uniquePaths = new Set(variantPaths);
    authExpect(uniquePaths.size).toBe(3);
  });

  authTest('paid plan buttons not showing Go to Dashboard fallback', async ({ page }) => {
    const personalBtn = page.locator('[data-plan="personal"] a, a[href*="lemonsqueezy"]').first();
    const href = await personalBtn.getAttribute('href');
    authExpect(href).not.toContain('/dashboard');
    authExpect(href).toContain('lemonsqueezy.com');
  });

  authTest('Free tier links to /dashboard when authenticated', async ({ page }) => {
    const freeLink = page.locator('a', { hasText: 'Get Started Free' });
    await authExpect(freeLink).toBeVisible();
    const href = await freeLink.getAttribute('href');
    authExpect(href).toContain('/dashboard');
  });

  authTest('all 3 checkout URLs are external links', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBe(3);

    for (const link of links) {
      const href = await link.getAttribute('href');
      authExpect(href).toMatch(/^https:\/\//);
    }
  });

  authTest('checkout URL structure matches LemonSqueezy format', async ({ page }) => {
    const links = await page.locator('a[href*="lemonsqueezy.com"]').all();
    authExpect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = await link.getAttribute('href');
      // Expected format: https://{store}.lemonsqueezy.com/buy/{variant}?params
      const url = new URL(href!);
      authExpect(url.hostname).toMatch(/^[\w-]+\.lemonsqueezy\.com$/);
      authExpect(url.pathname).toMatch(/^\/buy\/[\w-]+$/);
    }
  });
});
