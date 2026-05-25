import { test, expect, Page } from '@playwright/test';

const APP = 'https://app.tenantiq.app';
const API = 'https://api.tenantiq.app';

const MOCK_USER = {
  email: 'heal@finsavvyai.com',
  orgId: 'heal-org',
  role: 'admin',
  plan: 'professional',
  name: 'Heal Tester',
  id: 'heal-user',
};

type MeMode = 'authed' | '401';

const SHOTS = '/tmp/luna-heal-prod-connect';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://app.tenantiq.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Tenant-Id,X-TF-Device-Fingerprint,X-TF-Public-Key-Hash',
};

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return {
    status,
    contentType: 'application/json',
    headers: { ...CORS_HEADERS, ...extra },
    body: JSON.stringify(body),
  };
}

async function installMocks(page: Page, meMode: MeMode = 'authed') {
  // Handle CORS preflight (OPTIONS) on every API call.
  await page.route('**/api/**', async (route, req) => {
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
    }
    // Default: pass through to more specific routes below — resume by falling through.
    // Playwright gives priority to the most-recently-added matching route, so specific
    // routes registered after this catch-all will override it.
    return route.fulfill(json(200, { data: {}, tenants: [], alerts: [], total: 0 }));
  });
  await page.route('**/api/auth/me', async (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
    if (meMode === '401') return route.fulfill(json(401, { error: 'unauthenticated' }));
    return route.fulfill(json(200, { user: MOCK_USER }));
  });
  await page.route('**/api/tenants', (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
    return route.fulfill(json(200, { tenants: [] }));
  });
  await page.route(/\/api\/.*(?:stream|events|notifications|ws-ticket)/i, (route) =>
    route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' }));
}

async function gotoReady(page: Page, path: string) {
  await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('main, aside', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

test.describe('Connect Microsoft 365 Tenant heal loop', () => {
  test('01 dashboard empty state', async ({ page }) => {
    await installMocks(page);
    await gotoReady(page, '/');
    // Ensure authed empty state rendered (not SignInHero which has the "Sign in" heading)
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 15_000 });
    const cta = page.locator('main a[href*="/api/auth/onboard-org"]', { hasText: /Connect with Microsoft/i }).first();
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await expect(cta).toHaveAttribute('href', `${API}/api/auth/onboard-org`);
    const settingsLink = page.locator('main a[href="/settings"]').first();
    await expect(settingsLink).toBeVisible();
    const fills = await cta.locator('svg rect').evaluateAll((els) => els.map((e) => (e as SVGElement).getAttribute('fill')));
    for (const c of ['#F25022', '#7FBA00', '#00A4EF', '#FFB900']) expect(fills).toContain(c);
    await page.screenshot({ path: `${SHOTS}/01-dashboard-empty.png`, fullPage: true });
  });

  test('02 sidebar logo clickable + connect-tenant slot', async ({ page }) => {
    await installMocks(page);
    await gotoReady(page, '/');
    const logo = page.locator('aside a[href="/"][aria-label*="dashboard" i]').first();
    await expect(logo).toBeVisible();
    const connectBtn = page.locator('aside a[href*="/api/auth/onboard-org"]').first();
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toContainText(/Connect Tenant/i);
    const fills = await connectBtn.locator('svg rect').evaluateAll((els) => els.map((e) => (e as SVGElement).getAttribute('fill')));
    for (const c of ['#F25022', '#7FBA00', '#00A4EF', '#FFB900']) expect(fills).toContain(c);
    await page.screenshot({ path: `${SHOTS}/02-sidebar.png`, fullPage: true });
  });

  const scopedRoutes = [
    { path: '/alerts', title: 'Alert Management', tagline: /Real-time visibility into every security event/ },
    { path: '/audit', title: 'Audit & Compliance', tagline: /A defensible record of every tenant change/ },
    { path: '/security/cis', title: 'CIS Benchmark', tagline: /100\+ CIS M365 Foundations v3\.1 controls, automated/ },
    { path: '/workflows', title: 'Workflows', tagline: /Automate the remediation playbooks you run every week/ },
    { path: '/licenses', title: 'License Optimization', tagline: /Stop paying for licenses no-one uses/ },
    { path: '/ai', title: 'AI Agent', tagline: /security analyst that never sleeps/ },
    { path: '/threats', title: 'Threat Detection', tagline: /Identity threats spotted before they become incidents/ },
    { path: '/backups', title: 'Cloud Backups', tagline: /Point-in-time restore/ },
    { path: '/governance', title: 'Workspace Governance', tagline: /Own your Teams, SharePoint, and Groups sprawl/ },
  ];

  for (const r of scopedRoutes) {
    test(`03 marketing hero at ${r.path}`, async ({ page }) => {
      await installMocks(page);
      await gotoReady(page, r.path);
      // Eyebrow pill title
      await expect(page.locator('main').getByText(r.title, { exact: false }).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('main').getByText(r.tagline).first()).toBeVisible();
      // 4 bullet checkmarks (li > svg)
      const checkmarks = page.locator('main ul li svg');
      await expect.poll(async () => await checkmarks.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(4);
      const cta = page.locator('main a[href*="/api/auth/onboard-org"]').first();
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute('href', `${API}/api/auth/onboard-org`);
      await page.screenshot({ path: `${SHOTS}/03-${r.path.replace(/\//g, '_') || 'root'}.png`, fullPage: true });
    });
  }

  test('04 settings → connected tenants', async ({ page }) => {
    await installMocks(page);
    await gotoReady(page, '/settings');
    // Might require scroll to find the tenant card
    await page.evaluate(() => window.scrollTo(0, 600));
    const connectBtn = page.getByRole('link', { name: /Connect Microsoft 365 Tenant/i }).first()
      .or(page.getByRole('button', { name: /Connect Microsoft 365 Tenant/i }).first());
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/No tenants connected yet/i)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-settings.png`, fullPage: true });
  });

  test('05 skills hub plan label + upgrade link', async ({ page }) => {
    await installMocks(page);
    await gotoReady(page, '/skills');
    await expect(page.getByText(/Professional Plan/).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/of \d+ skills active/i).first()).toBeVisible();
    await expect(page.getByText(/Upgrade to unlock \d+ more/i).first()).toBeVisible();
    const body = await page.textContent('body');
    expect(body).not.toMatch(/\$260\/mo/);
    await page.screenshot({ path: `${SHOTS}/05-skills.png`, fullPage: true });
  });

  test('06 session expiry 401 redirects to login', async ({ page }) => {
    let me401 = false;
    // Catch-all first
    await page.route('**/api/**', async (route, req) => {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
      if (me401) return route.fulfill(json(401, { error: 'unauthenticated' }));
      return route.fulfill(json(200, {}));
    });
    await page.route('**/api/auth/me', async (route, req) => {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
      if (me401) return route.fulfill(json(401, { error: 'unauthenticated' }));
      return route.fulfill(json(200, { user: MOCK_USER }));
    });
    await page.route('**/api/tenants', (route) => route.fulfill(json(200, { tenants: [] })));
    await page.route('**/api/auth/refresh', (route) => route.fulfill(json(401, {})));
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', headers: CORS_HEADERS, body: '<html><body>login</body></html>' }));
    await page.route(/\/api\/.*(?:stream|events|notifications|ws-ticket)/i, (route) =>
      route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' }));

    await gotoReady(page, '/alerts');
    me401 = true;
    // Navigate to any route — the layout re-runs api.get('/auth/me'); 401 + refresh-fail triggers redirect.
    await page.goto(`${APP}/alerts?t=${Date.now()}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const redirected = await page.waitForURL(/\/api\/auth\/login/, { timeout: 20_000 }).then(() => true).catch(() => false);
    expect(redirected).toBeTruthy();
    await page.screenshot({ path: `${SHOTS}/06-session-expiry.png`, fullPage: true });
  });

  test('07 mobile viewport 390x844 CTA height', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await installMocks(p);
    await p.goto(`${APP}/alerts`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('main', { timeout: 20_000 });
    await p.waitForTimeout(1500);
    const cta = p.locator('main a[href*="/api/auth/onboard-org"]').first();
    await expect(cta).toBeVisible({ timeout: 15_000 });
    const box = await cta.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await p.screenshot({ path: `${SHOTS}/07-mobile-alerts.png`, fullPage: true });
    await ctx.close();
  });
});
