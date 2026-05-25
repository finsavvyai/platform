import { chromium } from 'playwright';

const URL = 'https://app.tenantiq.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleMessages = [];
  const errors = [];

  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  console.log(`Navigating to ${URL}...`);

  try {
    const response = await page.goto(URL, { timeout: 20000, waitUntil: 'domcontentloaded' });
    console.log(`Status: ${response?.status()}`);
    console.log(`URL: ${page.url()}`);

    // Wait a bit for JS to execute
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: '/tmp/tenantiq-prod.png', fullPage: true });
    console.log('Screenshot saved to /tmp/tenantiq-prod.png');

    // Check if page is frozen by trying to evaluate JS
    try {
      const title = await page.title();
      console.log(`Title: ${title}`);
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '(empty)');
      console.log(`Body preview: ${bodyText.slice(0, 300)}`);
    } catch (e) {
      console.log(`Page JS evaluation failed (frozen?): ${e.message}`);
    }

    // Print console messages
    if (consoleMessages.length) {
      console.log('\n--- Console messages ---');
      for (const m of consoleMessages.slice(0, 30)) console.log(m);
    }

    if (errors.length) {
      console.log('\n--- Page errors ---');
      for (const e of errors) console.log(e);
    }

  } catch (err) {
    console.log(`Navigation failed: ${err.message}`);
  }

  await browser.close();
})();
