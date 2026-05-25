import { chromium } from 'playwright';

// Test on localhost with mocked auth state (valid user, expired trial)
// The dev server must be running: cd apps/web && npm run dev
const URL = 'http://localhost:5173';

const EXPIRED_USER = JSON.stringify({
  id: 'user-1',
  email: 'admin@test.com',
  name: 'Test Admin',
  organizationId: 'org-1',
  tenantIds: ['t-1'],
  role: 'admin',
  plan: 'trial',
  trialEndsAt: '2026-03-01T00:00:00Z', // expired > 7 days ago = grace expired
});
const FAKE_TOKEN = 'fake-but-present';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const errors = [];
  let apiRequests = 0;

  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    if (msg.type() === 'error' || text.includes('Circuit breaker')) {
      console.log(`  CONSOLE: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log(`  PAGE ERROR: ${err.message}`);
  });

  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      apiRequests++;
      if (apiRequests <= 30) {
        console.log(`  API [${apiRequests}]: ${req.method()} ${req.url().split('/api')[1]}`);
      }
    }
  });

  // Inject auth state BEFORE page loads
  await context.addInitScript(`
    localStorage.setItem('tenantiq_user', '${EXPIRED_USER.replace(/'/g, "\\'")}');
    localStorage.setItem('tenantiq_token', '${FAKE_TOKEN}');
  `);

  console.log('Opening localhost with expired trial user...');

  try {
    await page.goto(URL, { timeout: 15000, waitUntil: 'domcontentloaded' });
    console.log('Page loaded, waiting 6s...');
    await page.waitForTimeout(6000);
    console.log(`API requests so far: ${apiRequests}`);

    // Try to evaluate — times out if frozen
    const frozen = await Promise.race([
      page.evaluate(() => {
        const start = performance.now();
        // Force a layout reflow to check if main thread is blocked
        document.body.offsetHeight;
        return { frozen: false, time: performance.now() - start };
      }).then(r => r),
      new Promise(resolve => setTimeout(() => resolve({ frozen: true }), 5000))
    ]);

    console.log(`Frozen: ${frozen.frozen}`);

    // Check for grace overlay
    const overlayVisible = await page.evaluate(() => {
      const overlays = document.querySelectorAll('[class*="fixed"][class*="inset-0"]');
      return Array.from(overlays).map(el => ({
        classes: el.className.slice(0, 100),
        text: el.textContent?.slice(0, 100),
        visible: getComputedStyle(el).display !== 'none'
      }));
    }).catch(() => 'evaluate failed');

    console.log('Overlays:', JSON.stringify(overlayVisible, null, 2));

    await page.screenshot({ path: '/tmp/tenantiq-local-expired.png', fullPage: true });
    console.log('Screenshot: /tmp/tenantiq-local-expired.png');

  } catch (err) {
    console.log(`FAILED: ${err.message}`);
  }

  console.log(`\nTotal API requests: ${apiRequests}`);
  console.log(`Total console errors: ${errors.length}`);

  if (errors.length) {
    console.log('\n--- Errors ---');
    for (const e of errors.slice(0, 10)) console.log(e);
  }

  await browser.close();
})();
