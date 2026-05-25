import { test } from '@playwright/test';

test('Landing page visual after scroll-through', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Scroll through the entire page to trigger all whileInView animations
  await page.evaluate(async () => {
    const height = document.body.scrollHeight;
    for (let y = 0; y < height; y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
  });

  await page.screenshot({
    path: 'test-results/visual-landing-scrolled-desktop.png',
    fullPage: true,
  });
});

test('Landing page visual after scroll-through (mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.evaluate(async () => {
    const height = document.body.scrollHeight;
    for (let y = 0; y < height; y += 300) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
  });

  await page.screenshot({
    path: 'test-results/visual-landing-scrolled-mobile.png',
    fullPage: true,
  });
});

test('Pricing page visual (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3001/pricing', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.evaluate(async () => {
    const height = document.body.scrollHeight;
    for (let y = 0; y < height; y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
  });

  await page.screenshot({
    path: 'test-results/visual-pricing-scrolled-desktop.png',
    fullPage: true,
  });
});
