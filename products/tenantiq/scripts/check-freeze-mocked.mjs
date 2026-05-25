import { chromium } from 'playwright';

// Test against PRODUCTION with intercepted API calls returning success.
// This simulates a valid session where the user has an expired trial
// but the backend still serves data.
const URL = 'https://app.tenantiq.app';

const EXPIRED_USER = {
  id: 'user-1',
  email: 'admin@test.com',
  name: 'Test Admin',
  organizationId: 'org-1',
  tenantIds: ['t-1'],
  role: 'admin',
  plan: 'trial',
  trialEndsAt: '2026-03-01T00:00:00Z', // expired > 7 days ago
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const errors = [];
  let apiHits = {};

  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    if (msg.type() === 'error' || text.includes('Circuit') || text.includes('loop')) {
      console.log(`  CONSOLE: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log(`  PAGE ERROR: ${err.message}`);
  });

  // Intercept API calls — return mock success responses
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const path = url.split('/api')[1] || url;
    apiHits[path] = (apiHits[path] || 0) + 1;

    if (apiHits[path] <= 3) {
      console.log(`  API [${apiHits[path]}x]: ${route.request().method()} ${path}`);
    } else if (apiHits[path] === 4) {
      console.log(`  API [4+]: ${path} — suppressing further logs`);
    }

    // Return mocked responses
    if (path.includes('/tenants') && !path.includes('/dashboard') && !path.includes('/alerts') && !path.includes('/sync') && !path.includes('/events')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenants: [{ id: 't-1', displayName: 'Test Tenant', domain: 'test.com', status: 'active', lastSyncAt: '2026-04-10T00:00:00Z' }]
        })
      });
    }
    if (path.includes('/dashboard')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          secureScore: 72, activeAlerts: { critical: 0, high: 1, medium: 3, low: 5 },
          totalUsers: 150, totalLicenses: 200, totalLicenseSpend: 5000, licenseWaste: 500,
          complianceScore: 85, lastSyncAt: '2026-04-10T00:00:00Z', recentAlerts: []
        })
      });
    }
    if (path.includes('/alerts')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [], total: 0 }) });
    }
    if (path.includes('/auth/refresh')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'refreshed-token' }) });
    }
    if (path.includes('/billing')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tier: 'trial', status: 'inactive', subscription: null }) });
    }
    if (path.includes('/notifications') || path.includes('/announcements')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    // Default: return empty 200
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Block SSE/WebSocket to avoid noise
  await page.route('**/events/stream**', route => route.abort());

  // Inject expired trial user
  await context.addInitScript(`
    localStorage.setItem('tenantiq_user', ${JSON.stringify(JSON.stringify(EXPIRED_USER))});
    localStorage.setItem('tenantiq_token', 'valid-session-token');
    localStorage.setItem('tenantiq_current_tenant', 't-1');
  `);

  console.log('Opening production with mocked API + expired trial...');

  try {
    const response = await page.goto(URL, { timeout: 15000, waitUntil: 'domcontentloaded' });
    console.log(`Status: ${response?.status()}`);

    // Monitor for 10 seconds
    for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(2000);
      const totalHits = Object.values(apiHits).reduce((a, b) => a + b, 0);
      console.log(`  [${i * 2}s] Total API hits: ${totalHits}`);
      if (totalHits > 50) {
        console.log('  >>> LOOP DETECTED — too many API calls');
        break;
      }
    }

    // Check if page is responsive
    const responsive = await Promise.race([
      page.evaluate(() => document.title).then(t => ({ ok: true, title: t })),
      new Promise(resolve => setTimeout(() => resolve({ ok: false }), 5000))
    ]);
    console.log(`Page responsive: ${responsive.ok}${responsive.title ? ' — ' + responsive.title : ''}`);

    // Check for grace overlay
    if (responsive.ok) {
      const overlayInfo = await page.evaluate(() => {
        const el = document.querySelector('[class*="fixed"][class*="inset-0"][class*="z-50"]');
        if (!el) return null;
        return { visible: true, text: el.textContent?.slice(0, 200) };
      });
      console.log(`Grace overlay: ${overlayInfo ? JSON.stringify(overlayInfo) : 'not found'}`);
    }

    await page.screenshot({ path: '/tmp/tenantiq-mocked-expired.png', fullPage: true });
    console.log('Screenshot: /tmp/tenantiq-mocked-expired.png');

  } catch (err) {
    console.log(`FAILED: ${err.message}`);
  }

  // Print hit summary
  console.log('\n--- API hit counts ---');
  for (const [path, count] of Object.entries(apiHits).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}x  ${path}`);
  }

  console.log(`\nPage errors: ${errors.length}`);
  for (const e of errors.slice(0, 5)) console.log(`  ${e}`);

  await browser.close();
})();
