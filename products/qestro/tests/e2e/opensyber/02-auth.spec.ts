import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

test.describe('OpenSyber — Authentication Flows', () => {
  test('2.1 Sign-in page loads', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/02-signin.png`, fullPage: true });
    const body = await page.textContent('body');
    const hasSignIn = body?.toLowerCase().includes('sign in') || body?.toLowerCase().includes('log in') || body?.toLowerCase().includes('welcome');
    expect(hasSignIn).toBeTruthy();
  });

  test('2.2 Sign-in has OAuth providers (Google, GitHub)', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body');
    const hasGoogle = body?.toLowerCase().includes('google');
    const hasGitHub = body?.toLowerCase().includes('github');
    // At least one OAuth provider should be present
    expect(hasGoogle || hasGitHub).toBeTruthy();
  });

  test('2.3 Sign-up page loads', async ({ page }) => {
    await page.goto(`${BASE}/sign-up`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/02-signup.png`, fullPage: true });
    const body = await page.textContent('body');
    const hasSignUp = body?.toLowerCase().includes('sign up') || body?.toLowerCase().includes('create') || body?.toLowerCase().includes('register');
    expect(hasSignUp).toBeTruthy();
  });

  test('2.4 Sign-up has terms/privacy links', async ({ page }) => {
    await page.goto(`${BASE}/sign-up`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Check for terms and privacy references
    const body = await page.textContent('body');
    const hasTerms = body?.toLowerCase().includes('terms');
    const hasPrivacy = body?.toLowerCase().includes('privacy');
    expect(hasTerms || hasPrivacy).toBeTruthy();
  });

  test('2.5 Unauthenticated dashboard access redirects to sign-in', async ({ page }) => {
    const response = await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const url = page.url();
    // Should redirect to sign-in or show auth prompt
    const redirected = url.includes('sign-in') || url.includes('sign-up') || url.includes('auth');
    const body = await page.textContent('body');
    const hasAuthPrompt = body?.toLowerCase().includes('sign in') || body?.toLowerCase().includes('log in');
    expect(redirected || hasAuthPrompt).toBeTruthy();
    await page.screenshot({ path: `${SHOTS}/02-dashboard-redirect.png`, fullPage: false });
  });

  test('2.6 No hardcoded credentials or demo accounts visible', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    // Should NOT contain demo/test credentials
    expect(body).not.toContain('demo@');
    expect(body).not.toContain('test@');
    expect(body).not.toContain('password123');
    expect(body).not.toContain('admin@');
  });

  test('2.7 Sign-in page has no exposed API keys in source', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    expect(html).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(html).not.toMatch(/AKIA[A-Z0-9]{16}/);
    expect(html).not.toContain('Bearer ');
  });
});
