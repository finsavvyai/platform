import { test, expect, request } from '@playwright/test';

const FRONTEND = 'https://qestro.app';
const API = 'https://api.qestro.app';

type Provider = {
  id: string;
  buttonLabel: RegExp;
  authHost: string;
  authPathPrefix: string;
};

const PROVIDERS: Provider[] = [
  { id: 'github',    buttonLabel: /github/i,    authHost: 'github.com',              authPathPrefix: '/login/oauth/authorize' },
  { id: 'google',    buttonLabel: /google/i,    authHost: 'accounts.google.com',     authPathPrefix: '/o/oauth2/' },
  { id: 'microsoft', buttonLabel: /microsoft/i, authHost: 'login.microsoftonline.com', authPathPrefix: '/common/oauth2/' },
  { id: 'linkedin',  buttonLabel: /linkedin/i,  authHost: 'www.linkedin.com',        authPathPrefix: '/oauth/v2/authorization' },
  { id: 'discord',   buttonLabel: /discord/i,   authHost: 'discord.com',             authPathPrefix: '/api/oauth2/authorize' },
];

test.describe('OAuth providers — live', () => {
  test('providers endpoint lists all five + email', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/api/auth/providers`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const ids = body.providers.map((p: { id: string }) => p.id).sort();
    expect(ids).toEqual(['discord', 'email', 'github', 'google', 'linkedin', 'microsoft']);
  });

  for (const p of PROVIDERS) {
    test(`${p.id} authorize redirect lands on ${p.authHost}`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.get(`${API}/api/auth/${p.id}`, { maxRedirects: 0 });
      expect(res.status()).toBe(302);
      const loc = res.headers()['location'];
      expect(loc).toBeTruthy();
      const u = new URL(loc);
      expect(u.host).toBe(p.authHost);
      expect(u.pathname.startsWith(p.authPathPrefix)).toBeTruthy();
      expect(u.searchParams.get('client_id')).toBeTruthy();
      expect(u.searchParams.get('redirect_uri')).toBe(`${API}/api/auth/${p.id}/callback`);
    });
  }

  for (const p of PROVIDERS) {
    test(`${p.id} callback without code → /login?error=missing_code`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.get(`${API}/api/auth/${p.id}/callback`, { maxRedirects: 0 });
      expect(res.status()).toBe(302);
      expect(res.headers()['location']).toBe(`${FRONTEND}/login?error=missing_code`);
    });
  }

  test('login page shows a button for each provider and click redirects', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    for (const p of PROVIDERS) {
      await expect(page.getByRole('button', { name: p.buttonLabel }).first()).toBeVisible();
    }
  });
});
