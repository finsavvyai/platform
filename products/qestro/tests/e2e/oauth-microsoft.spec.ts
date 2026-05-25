import { test, expect, request } from '@playwright/test';

const FRONTEND = 'https://qestro.app';
const API = 'https://api.qestro.app';
const AZURE_CLIENT_ID = '324d18c2-0525-41e3-9fb7-ebae8c08c9f0';
// Multi-tenant as of 2026-04-18 — accepts any Entra tenant + personal Microsoft accounts
const AZURE_TENANT_ID = 'common';

test.describe('Microsoft OAuth — production', () => {
  test('domain verification file served as JSON with correct appId', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${FRONTEND}/.well-known/microsoft-identity-association.json`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
    const body = await res.json();
    expect(body.associatedApplications).toEqual([{ applicationId: AZURE_CLIENT_ID }]);
  });

  test('providers endpoint lists microsoft', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/api/auth/providers`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const ids = body.providers.map((p: { id: string }) => p.id);
    expect(ids).toContain('microsoft');
  });

  test('authorize endpoint redirects to Microsoft with correct parameters', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/api/auth/microsoft`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const loc = res.headers()['location'];
    expect(loc).toBeTruthy();
    const u = new URL(loc);
    expect(u.host).toBe('login.microsoftonline.com');
    expect(u.pathname).toBe(`/${AZURE_TENANT_ID}/oauth2/v2.0/authorize`);
    expect(u.searchParams.get('client_id')).toBe(AZURE_CLIENT_ID);
    expect(u.searchParams.get('redirect_uri')).toBe(`${API}/api/auth/microsoft/callback`);
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.searchParams.get('scope')).toContain('openid');
  });

  test('callback without code redirects to login with error', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/api/auth/microsoft/callback`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toBe(`${FRONTEND}/login?error=missing_code`);
  });

  test('login page has Microsoft button and triggers authorize redirect', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    const msButton = page.getByRole('button', { name: /microsoft/i });
    await expect(msButton).toBeVisible();

    const navigationPromise = page.waitForURL(/login\.microsoftonline\.com/, { timeout: 10_000 });
    await msButton.click();
    await navigationPromise;

    const url = new URL(page.url());
    expect(url.host).toBe('login.microsoftonline.com');
    expect(url.searchParams.get('client_id')).toBe(AZURE_CLIENT_ID);
  });

  test('frontend /auth/callback route is reachable (SPA shell)', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${FRONTEND}/auth/callback?access_token=test&email=a@b.co&provider=microsoft`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/text\/html/);
  });
});
