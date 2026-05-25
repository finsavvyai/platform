import { chromium } from 'playwright';

const URL = 'https://app.tenantiq.app';

// Simulate an expired-trial user in localStorage
const FAKE_USER = JSON.stringify({
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  organizationId: 'org-1',
  tenantIds: ['t-1'],
  role: 'admin',
  plan: 'trial',
  trialEndsAt: '2026-03-01T00:00:00Z', // expired ~6 weeks ago
});
const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.fake';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const errors = [];
  let requestCount = 0;

  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    // Print circuit breaker messages immediately
    if (text.includes('Circuit breaker') || text.includes('infinite') || msg.type() === 'error') {
      console.log(`  CONSOLE: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log(`  PAGE ERROR: ${err.message}`);
  });

  page.on('request', (req) => {
    requestCount++;
    if (req.url().includes('/api/')) {
      console.log(`  REQ [${requestCount}]: ${req.method()} ${req.url().replace(URL, '')}`);
    }
  });

  // Set localStorage before navigating
  await context.addInitScript(({ user, token }) => {
    localStorage.setItem('tenantiq_user', user);
    localStorage.setItem('tenantiq_token', token);
  }, { user: FAKE_USER, token: FAKE_TOKEN });

  console.log('Navigating with expired trial user...');

  try {
    const response = await page.goto(URL, { timeout: 15000, waitUntil: 'domcontentloaded' });
    console.log(`Status: ${response?.status()}`);

    // Wait and monitor — if page freezes, evaluate() will timeout
    console.log('Waiting 8s for JS to settle...');
    await page.waitForTimeout(8000);

    console.log(`Total requests so far: ${requestCount}`);

    // Try to interact — if frozen this will timeout
    try {
      const title = await page.evaluate(() => document.title, null, { timeout: 3000 });
      console.log(`Title: ${title}`);

      const bodySnippet = await page.evaluate(() => {
        return document.body?.innerText?.slice(0, 500) || '(empty body)';
      }, null, { timeout: 3000 });
      console.log(`Body: ${bodySnippet.slice(0, 300)}`);

      // Check if grace overlay is visible
      const overlay = await page.evaluate(() => {
        const el = document.querySelector('.fixed.inset-0.z-50');
        return el ? el.textContent?.slice(0, 200) : null;
      }, null, { timeout: 3000 });
      console.log(`Grace overlay: ${overlay ?? '(not found)'}`);

    } catch (e) {
      console.log(`JS FROZEN — evaluate timed out: ${e.message}`);
    }

    await page.screenshot({ path: '/tmp/tenantiq-expired.png', fullPage: true });
    console.log('Screenshot: /tmp/tenantiq-expired.png');

  } catch (err) {
    console.log(`Navigation failed: ${err.message}`);
  }

  console.log(`\nTotal console messages: ${consoleMessages.length}`);
  console.log(`Total page errors: ${errors.length}`);
  console.log(`Total network requests: ${requestCount}`);

  // Print all console errors
  const errorMsgs = consoleMessages.filter(m => m.startsWith('[error]'));
  if (errorMsgs.length) {
    console.log('\n--- All console errors ---');
    for (const m of errorMsgs.slice(0, 20)) console.log(m);
  }

  await browser.close();
})();
