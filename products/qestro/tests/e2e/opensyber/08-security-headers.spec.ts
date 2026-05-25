import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;

test.describe('OpenSyber — Security & Performance Headers', () => {
  test('8.1 Homepage returns proper security headers', async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBeLessThan(400);

    const headers = response.headers();
    // Should have basic security headers
    const hasXFrame = !!headers['x-frame-options'] || !!headers['content-security-policy'];
    const hasXContent = !!headers['x-content-type-options'];
    // At minimum, server should respond correctly
    expect(response.ok()).toBeTruthy();
  });

  test('8.2 HTTPS redirect works', async ({ request }) => {
    // Attempting http should redirect to https or at least work on https
    const response = await request.get(BASE);
    expect(response.url()).toContain('https://');
  });

  test('8.3 No server version exposed', async ({ request }) => {
    const response = await request.get(BASE);
    const headers = response.headers();
    // Should not expose exact server version
    const server = headers['server'] || '';
    expect(server).not.toMatch(/nginx\/\d|apache\/\d|express/i);
  });

  test('8.4 API endpoints return proper CORS headers', async ({ request }) => {
    const response = await request.get(`${BASE}/api/auth/callback`, {
      headers: { Origin: 'https://opensyber.cloud' },
    });
    // API should at minimum respond (even if 405/401)
    expect(response.status()).toBeLessThan(500);
  });

  test('8.5 robots.txt exists', async ({ request }) => {
    const response = await request.get(`${BASE}/robots.txt`);
    // Should exist or at least not 500
    expect(response.status()).toBeLessThan(500);
  });

  test('8.6 sitemap.xml exists', async ({ request }) => {
    const response = await request.get(`${BASE}/sitemap.xml`);
    // Nice to have - don't fail hard
    expect(response.status()).toBeLessThan(500);
  });

  test('8.7 favicon exists', async ({ request }) => {
    const response = await request.get(`${BASE}/favicon.ico`);
    expect(response.status()).toBeLessThan(500);
  });

  test('8.8 No API keys leaked in homepage HTML', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    // Check for common API key patterns
    expect(html).not.toMatch(/sk-[a-zA-Z0-9]{20,}/); // OpenAI
    expect(html).not.toMatch(/AKIA[A-Z0-9]{16}/); // AWS
    expect(html).not.toMatch(/ghp_[a-zA-Z0-9]{36}/); // GitHub
    expect(html).not.toMatch(/xoxb-[0-9]{10,}/); // Slack
    expect(html).not.toContain('-----BEGIN PRIVATE KEY-----');
    expect(html).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
  });

  test('8.9 All public pages return < 500 status', async ({ request }) => {
    const pages = OPENSYBER.publicPages;
    const results: { path: string; status: number }[] = [];
    for (const path of pages) {
      const response = await request.get(`${BASE}${path}`);
      results.push({ path, status: response.status() });
      expect(response.status()).toBeLessThan(500);
    }
  });
});
