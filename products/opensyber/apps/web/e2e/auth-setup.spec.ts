import { test as setup } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

/**
 * One-time auth setup for Auth.js OAuth flow.
 *
 * OpenSyber uses Auth.js with Google / GitHub / LinkedIn / Microsoft
 * Entra ID as OAuth providers (HMAC-SHA256 JWT, migrated from Clerk
 * 2026-03-27). There is no credentials provider, so headless E2E auth
 * has two practical paths:
 *
 * (A) STORAGE STATE INJECTION (recommended for CI):
 *     Manually sign in once locally, copy the saved state JSON, then
 *     paste it as the value of E2E_AUTH_STATE_JSON before this spec
 *     runs. The state expires when the JWT does (default 30 days).
 *
 *     1. pnpm -C apps/web dev
 *     2. Open http://localhost:3000/sign-in, sign in via OAuth
 *     3. Copy session cookies from devtools as JSON
 *     4. Set E2E_AUTH_STATE_JSON=<paste> and re-run tests
 *
 * (B) HEADED OAUTH (recommended for first-run / refresh):
 *     Set E2E_OAUTH_PROVIDER + E2E_OAUTH_EMAIL + E2E_OAUTH_PASSWORD,
 *     run with `--headed`, complete OAuth in the launched browser,
 *     and the spec will save state on success.
 *
 * If neither env path is configured, this setup skips with a hint.
 * All tests using authTest from fixtures/auth.ts then skip too.
 */
setup('authenticate test user (Auth.js)', async ({ page, context }) => {
  const stateJson = process.env.E2E_AUTH_STATE_JSON;
  if (stateJson) {
    const state = JSON.parse(stateJson);
    await context.addCookies(state.cookies ?? []);
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  const provider = process.env.E2E_OAUTH_PROVIDER;
  const email = process.env.E2E_OAUTH_EMAIL;
  const password = process.env.E2E_OAUTH_PASSWORD;

  if (!provider || !email || !password) {
    setup.skip(
      true,
      'Set E2E_AUTH_STATE_JSON or E2E_OAUTH_PROVIDER+E2E_OAUTH_EMAIL+E2E_OAUTH_PASSWORD to authenticate. Auth-gated specs will skip.',
    );
    return;
  }

  await page.goto('/sign-in');
  const providerButton = page.getByRole('button', {
    name: new RegExp(`continue (with )?${provider}`, 'i'),
  });
  await providerButton.click();

  // OAuth provider hosts its own login form on its own domain.
  // Selectors below are best-effort and may need provider-specific tuning.
  const emailInput = page.locator('input[type="email"], input[name*="email"], input[name="identifier"]').first();
  await emailInput.fill(email);

  const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
  await nextBtn.click();

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);

  const submitBtn = page.getByRole('button', { name: /sign in|next|submit/i }).first();
  await submitBtn.click();

  // Wait for redirect back to OpenSyber dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
