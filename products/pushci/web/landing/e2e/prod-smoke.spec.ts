import { test, expect, request } from '@playwright/test';

const PROD = 'https://pushci.dev';
const APP = 'https://app.pushci.dev';
const API = 'https://api.pushci.dev';

test.describe('PushCI production smoke', () => {
  test('landing root renders hero copy', async ({ page }) => {
    await page.goto(PROD, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/PushCI/i);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(200);
  });

  test('pricing page renders tier copy', async ({ page }) => {
    await page.goto(`${PROD}/pricing`, { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Free|Pro|Team|Enterprise/i);
  });

  test('docs page renders', async ({ page }) => {
    await page.goto(`${PROD}/docs`, { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(200);
  });

  test('product page renders', async ({ page }) => {
    await page.goto(`${PROD}/product`, { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(200);
  });

  test('contact page renders', async ({ page }) => {
    await page.goto(`${PROD}/contact`, { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(100);
  });

  test('dashboard login renders', async ({ page }) => {
    await page.goto(APP, { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(50);
  });

  test('api health returns ok', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.status).toBe('ok');
  });

  test('llms.txt served as text', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${PROD}/llms.txt`);
    expect(res.status()).toBe(200);
    const t = await res.text();
    expect(t).toMatch(/PushCI/i);
    expect(t.length).toBeGreaterThan(500);
  });

  test('sitemap.xml served', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${PROD}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const t = await res.text();
    expect(t).toMatch(/<urlset/);
  });

  test('robots.txt served', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${PROD}/robots.txt`);
    expect(res.status()).toBe(200);
  });
});
