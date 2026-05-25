import { chromium } from '@playwright/test';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  const p = await ctx.newPage();
  await p.goto('https://www.producthunt.com/products/cepien-ai', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(6000);
  const text = await p.evaluate(() => document.body.innerText);
  const links = await p.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((h) => !h.includes('producthunt.com') && !h.includes('google.com'))
      .slice(0, 40),
  );
  console.log('=== TEXT ===');
  console.log(text.slice(0, 5000));
  console.log('=== LINKS ===');
  console.log(links.join('\n'));
  await b.close();
})();
