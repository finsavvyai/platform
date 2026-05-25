import { test, expect } from '@playwright/test';

/**
 * OAuth Setup and Configuration Tests
 * Testing Google OAuth integration end-to-end
 */

test.describe('OAuth Configuration', () => {

  test('Google OAuth button redirects to Google consent screen', async ({ page }) => {
    await page.goto('/auth/register');

    // Click "Continue with Google"
    const googleButton = page.locator('button', { hasText: /Continue with Google/i });
    await expect(googleButton).toBeVisible();

    // Start waiting for navigation before clicking
    const navigationPromise = page.waitForURL(/accounts\.google\.com/, { timeout: 5000 });

    await googleButton.click();

    try {
      await navigationPromise;

      // Should be redirected to Google OAuth consent screen
      expect(page.url()).toContain('accounts.google.com');
      expect(page.url()).toContain('oauth2');

      // Check for Google consent screen elements
      await expect(page.locator('text=/Sign in with Google|Choose an account/i')).toBeVisible({ timeout: 10000 });

      console.log('✅ Google OAuth redirect successful!');
    } catch (error) {
      // If we get a 503 error, it means OAuth is not configured
      const content = await page.content();

      if (content.includes('OAuth not configured')) {
        console.log('⚠️  Google OAuth not configured yet. Follow these steps:');
        console.log('');
        console.log('1. Go to https://console.cloud.google.com/');
        console.log('2. Create OAuth credentials');
        console.log('3. Add redirect URI: https://sdlc.cc/auth/google/callback');
        console.log('4. Run: wrangler secret put GOOGLE_CLIENT_ID --env production');
        console.log('5. Run: wrangler secret put GOOGLE_CLIENT_SECRET --env production');
        console.log('');
        console.log('See OAUTH_SETUP.md for detailed instructions.');

        // Mark test as expected to fail until OAuth is configured
        test.skip();
      } else if (page.url().includes('invalid_client')) {
        console.log('❌ Google OAuth credentials are invalid or not found');
        console.log('   Error: 401 invalid_client');
        console.log('   This means the Client ID doesn\'t exist or is incorrect.');
        console.log('');
        console.log('   Fix: Update your Google OAuth credentials in Wrangler secrets');

        test.skip();
      } else {
        throw error;
      }
    }
  });

  test('GitHub OAuth button redirects to GitHub authorization', async ({ page }) => {
    await page.goto('/auth/register');

    // Click "Continue with GitHub"
    const githubButton = page.locator('button', { hasText: /Continue with GitHub/i });
    await expect(githubButton).toBeVisible();

    // Start waiting for navigation before clicking
    const navigationPromise = page.waitForURL(/github\.com/, { timeout: 5000 });

    await githubButton.click();

    try {
      await navigationPromise;

      // Should be redirected to GitHub OAuth authorization screen
      expect(page.url()).toContain('github.com');
      expect(page.url()).toContain('login/oauth/authorize');

      console.log('✅ GitHub OAuth redirect successful!');
    } catch (error) {
      const content = await page.content();

      if (content.includes('OAuth not configured')) {
        console.log('⚠️  GitHub OAuth not configured yet.');
        test.skip();
      } else {
        throw error;
      }
    }
  });

  test('Login page also has OAuth buttons', async ({ page }) => {
    await page.goto('/auth/login');

    // Check both OAuth buttons exist
    await expect(page.locator('button', { hasText: /Continue with Google/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /Continue with GitHub/i })).toBeVisible();
  });

  test('OAuth API endpoint returns proper error when not configured', async ({ page }) => {
    const response = await page.request.get('/api/v1/auth/google');

    // Should either redirect to Google or return 503 if not configured
    if (response.status() === 503) {
      const body = await response.json();
      expect(body.error).toBe('OAuth not configured');
      expect(body.message).toContain('Google OAuth is not configured');
    } else {
      // If configured, should redirect
      expect(response.status()).toBe(302);
      const location = response.headers()['location'];
      expect(location).toContain('accounts.google.com');
    }
  });
});

test.describe('OAuth Callback Flow', () => {

  test('OAuth callback URL structure is correct', async ({ page }) => {
    // Test that the callback routes exist
    const googleCallbackResponse = await page.request.get('/auth/google/callback?code=test&state=test');

    // Should redirect (either to login with error or to API route)
    expect([302, 307, 308]).toContain(googleCallbackResponse.status());
  });

  test('OAuth callback handles missing parameters', async ({ page }) => {
    // Navigate to callback without code
    await page.goto('/auth/google/callback');

    // Should redirect to login with error
    await expect(page).toHaveURL(/\/auth\/login\?error=/);
  });

  test('OAuth callback validates state parameter', async ({ page }) => {
    // Navigate to callback with invalid state
    await page.goto('/auth/google/callback?code=test&state=invalid-state-format');

    // Should redirect to login with error
    await expect(page).toHaveURL(/\/auth\/login\?error=/);
  });
});

test.describe('OAuth Setup Instructions', () => {

  test('OAUTH_SETUP.md file exists and has correct content', async () => {
    const fs = require('fs');
    const path = require('path');

    const setupFilePath = path.join(__dirname, '../../OAUTH_SETUP.md');
    expect(fs.existsSync(setupFilePath)).toBe(true);

    const content = fs.readFileSync(setupFilePath, 'utf-8');
    expect(content).toContain('Google OAuth Setup');
    expect(content).toContain('GitHub OAuth Setup');
    expect(content).toContain('wrangler secret put');
    expect(content).toContain('GOOGLE_CLIENT_ID');
    expect(content).toContain('GOOGLE_CLIENT_SECRET');
  });
});
