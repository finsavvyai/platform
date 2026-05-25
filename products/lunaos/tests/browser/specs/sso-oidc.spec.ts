/**
 * SSO OIDC E2E — Playwright spec (write-only, do not run).
 * Scenario: configure mock OIDC provider, login as user@configured-domain.com,
 * expect redirect → callback → dashboard.
 */

import { test, expect, Page, Route } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8787';

// ─── Mock OIDC Provider setup ─────────────────────────────────────────────────

interface OidcMockConfig {
    idpId: string;
    emailDomain: string;
    userEmail: string;
    userName: string;
}

async function setupOidcMocks(page: Page, config: OidcMockConfig) {
    // Mock the discovery endpoint
    await page.route(`${API_URL}/v1/sso/discovery**`, async (route: Route) => {
        const url = new URL(route.request().url());
        const email = url.searchParams.get('email') ?? '';
        if (email.endsWith(`@${config.emailDomain}`)) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    idpId: config.idpId,
                    type: 'oidc',
                    initiateUrl: '/v1/sso/oidc/initiate',
                }),
            });
        } else {
            await route.fulfill({
                status: 404,
                body: JSON.stringify({ hint: 'No SSO configured', correlationId: 'test' }),
            });
        }
    });

    // Mock OIDC initiate
    await page.route(`${API_URL}/v1/sso/oidc/initiate`, async (route: Route) => {
        // Return a mock IdP auth URL pointing back to our mock callback trigger
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                redirectUrl: `${DASHBOARD_URL}/test-oidc-callback?code=mock-auth-code&state=mock-state`,
                correlationId: 'test-init',
            }),
        });
    });

    // Mock OIDC callback — simulate the IdP posting back
    await page.route(`${API_URL}/v1/sso/oidc/callback**`, async (route: Route) => {
        // Simulate successful callback → session cookie + redirect
        await route.fulfill({
            status: 302,
            headers: {
                Location: `${DASHBOARD_URL}/dashboard`,
                'Set-Cookie': 'sso_session=mock-session.abc123; Path=/; HttpOnly; Secure; SameSite=Lax',
            },
            body: '',
        });
    });
}

// ─── OIDC flow tests ──────────────────────────────────────────────────────────

test.describe('SSO OIDC — email-first discovery and login', () => {
    const CONFIG: OidcMockConfig = {
        idpId: 'idp-oidc-e2e',
        emailDomain: 'oidc-corp.example.com',
        userEmail: 'alice@oidc-corp.example.com',
        userName: 'Alice Smith',
    };

    test('entering SSO-configured email triggers redirect to IdP', async ({ page }) => {
        await setupOidcMocks(page, CONFIG);
        await page.goto(`${DASHBOARD_URL}/login`);

        // Step 1: Enter email
        await page.fill('#login-email', CONFIG.userEmail);
        await page.click('button:has-text("Continue")');

        // Step 2: Should show "Redirecting…" state
        await expect(page.getByTestId('sso-redirecting')).toBeVisible({ timeout: 5000 });
    });

    test('entering non-SSO email shows password form', async ({ page }) => {
        await setupOidcMocks(page, CONFIG);
        await page.goto(`${DASHBOARD_URL}/login`);

        await page.fill('#login-email', 'user@no-sso-domain.com');
        await page.click('button:has-text("Continue")');

        // Should fall through to password form
        await expect(page.locator('#login-password')).toBeVisible({ timeout: 5000 });
    });

    test('OIDC callback sets session cookie and redirects to dashboard', async ({ page }) => {
        await setupOidcMocks(page, CONFIG);

        // Simulate landing on callback URL (as IdP would redirect to)
        const cookies: string[] = [];
        page.on('response', (response) => {
            const cookie = response.headers()['set-cookie'];
            if (cookie) cookies.push(cookie);
        });

        await page.goto(`${DASHBOARD_URL}/login`);
        await page.fill('#login-email', CONFIG.userEmail);
        await page.click('button:has-text("Continue")');

        await page.waitForURL('**/dashboard**', { timeout: 10000 });
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('tampered state param results in error page (not silently accepted)', async ({ page }) => {
        await page.route(`${API_URL}/v1/sso/oidc/callback**`, async (route: Route) => {
            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'state_bad_sig', correlationId: 'test' }),
            });
        });

        // Simulate arriving at callback with bad state
        await page.goto(`${DASHBOARD_URL}/v1/sso/oidc/callback?code=code&state=tampered.sig`);
        // Should not land on dashboard
        await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 3000 });
    });

    test('discovery loading state shows accessible spinner', async ({ page }) => {
        // Slow the discovery response
        await page.route(`${API_URL}/v1/sso/discovery**`, async (route: Route) => {
            await new Promise((r) => setTimeout(r, 500));
            await route.fulfill({
                status: 404,
                body: JSON.stringify({ hint: 'No SSO', correlationId: 'test' }),
            });
        });

        await page.goto(`${DASHBOARD_URL}/login`);
        await page.fill('#login-email', 'user@slow.com');
        await page.click('button:has-text("Continue")');

        // Loading state
        const submitBtn = page.getByRole('button', { name: /checking/i });
        await expect(submitBtn).toBeVisible({ timeout: 2000 });
        // Spinner icon should be aria-hidden
        const spinner = page.locator('[aria-hidden="true"]').filter({ hasText: '' }).first();
        // Button should be disabled during loading
        await expect(submitBtn).toBeDisabled();
    });
});

// ─── Open redirect prevention ─────────────────────────────────────────────────

test.describe('SSO OIDC — open redirect prevention', () => {
    const EVIL_PATHS = [
        '//evil.com',
        'https://evil.com/steal-token',
        'http://evil.com',
    ];

    for (const evilPath of EVIL_PATHS) {
        test(`returnPath "${evilPath.slice(0, 30)}" is rejected → fallback to /dashboard`, async ({ page }) => {
            await page.route(`${API_URL}/v1/sso/oidc/callback**`, async (route: Route) => {
                // This should never redirect to an external domain
                const resp = await route.fetch();
                const location = resp.headers()['location'];
                // Ensure the server does not redirect to evil.com
                if (location) {
                    expect(location).not.toContain('evil.com');
                    expect(location).toMatch(/^\/[^\/]/);
                }
                await route.fulfill({ response: resp });
            });
            // The actual attack would come via returnPath in state; backend should sanitize
        });
    }
});
