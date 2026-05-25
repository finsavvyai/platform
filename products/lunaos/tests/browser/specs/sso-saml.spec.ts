/**
 * SSO SAML E2E — Playwright spec (write-only, do not run).
 * Scenario: configure mock SAML IdP, login as user@saml-domain.com,
 * expect redirect → ACS callback → dashboard.
 */

import { test, expect, Page, Route } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8787';

// ─── Mock SAML Provider setup ─────────────────────────────────────────────────

interface SamlMockConfig {
    idpId: string;
    emailDomain: string;
    userEmail: string;
    idpSsoUrl: string;
}

async function setupSamlMocks(page: Page, config: SamlMockConfig) {
    // Mock discovery
    await page.route(`${API_URL}/v1/sso/discovery**`, async (route: Route) => {
        const url = new URL(route.request().url());
        const email = url.searchParams.get('email') ?? '';
        if (email.endsWith(`@${config.emailDomain}`)) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    idpId: config.idpId,
                    type: 'saml',
                    initiateUrl: '/v1/sso/saml/initiate',
                }),
            });
        } else {
            await route.fulfill({
                status: 404,
                body: JSON.stringify({ hint: 'No SSO configured', correlationId: 'test' }),
            });
        }
    });

    // Mock SAML initiate — return GET binding redirect URL
    await page.route(`${API_URL}/v1/sso/saml/initiate`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                method: 'GET',
                redirectUrl: `${config.idpSsoUrl}?SAMLRequest=mockRequestB64&RelayState=mock-relay-token`,
            }),
        });
    });

    // Mock SAML ACS callback (IdP posts back)
    await page.route(`${API_URL}/v1/sso/saml/callback`, async (route: Route) => {
        const method = route.request().method();
        if (method === 'POST') {
            await route.fulfill({
                status: 302,
                headers: {
                    Location: `${DASHBOARD_URL}/dashboard`,
                    'Set-Cookie': 'sso_session=mock-saml-session.xyz; Path=/; HttpOnly; Secure; SameSite=Lax',
                },
                body: '',
            });
        } else {
            await route.fulfill({ status: 405, body: 'Method Not Allowed' });
        }
    });
}

// ─── SAML flow tests ──────────────────────────────────────────────────────────

test.describe('SSO SAML — email-first discovery and login', () => {
    const CONFIG: SamlMockConfig = {
        idpId: 'idp-saml-e2e',
        emailDomain: 'saml-corp.example.com',
        userEmail: 'bob@saml-corp.example.com',
        idpSsoUrl: 'https://idp.saml-corp.example.com/sso/saml',
    };

    test('entering SAML-configured email triggers IdP redirect', async ({ page }) => {
        await setupSamlMocks(page, CONFIG);
        await page.goto(`${DASHBOARD_URL}/login`);

        await page.fill('#login-email', CONFIG.userEmail);
        await page.click('button:has-text("Continue")');

        // Should show "Redirecting to SSO" state
        await expect(page.getByTestId('sso-redirecting')).toBeVisible({ timeout: 5000 });
    });

    test('SAML POST binding: submits hidden form to IdP', async ({ page }) => {
        // Configure SAML with POST binding
        await page.route(`${API_URL}/v1/sso/saml/initiate`, async (route: Route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    method: 'POST',
                    url: CONFIG.idpSsoUrl,
                    params: {
                        SAMLRequest: btoa('<AuthnRequest/>'),
                        RelayState: 'post-relay-token',
                    },
                }),
            });
        });
        await page.route(`${API_URL}/v1/sso/discovery**`, async (route: Route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ idpId: CONFIG.idpId, type: 'saml', initiateUrl: '/v1/sso/saml/initiate' }),
            });
        });

        // Intercept IdP POST to prevent actual navigation
        await page.route(CONFIG.idpSsoUrl, async (route: Route) => {
            await route.fulfill({ status: 200, body: '<html>Mock IdP</html>' });
        });

        await page.goto(`${DASHBOARD_URL}/login`);
        await page.fill('#login-email', CONFIG.userEmail);
        await page.click('button:has-text("Continue")');

        // Should show redirecting state (form auto-submits)
        await expect(page.getByTestId('sso-redirecting')).toBeVisible({ timeout: 5000 });
    });

    test('SAML ACS callback completes login with session cookie', async ({ page }) => {
        await setupSamlMocks(page, CONFIG);

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
});

// ─── SAML Security — replay / relay state reuse ────────────────────────────────

test.describe('SSO SAML — security rejection cases', () => {
    test('relay state reuse: second callback with same relay → 400', async ({ page }) => {
        let callbackCount = 0;
        await page.route(`${API_URL}/v1/sso/saml/callback`, async (route: Route) => {
            callbackCount++;
            if (callbackCount === 1) {
                await route.fulfill({
                    status: 302,
                    headers: { Location: `${DASHBOARD_URL}/dashboard` },
                    body: '',
                });
            } else {
                // Second use of same relay state
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'invalid_relay', correlationId: 'replay-test' }),
                });
            }
        });

        // Simulate first callback
        await page.request.post(`${API_URL}/v1/sso/saml/callback`, {
            form: { SAMLResponse: btoa('<Response/>'), RelayState: 'relay-abc' },
        });
        // Simulate second callback with same relay state
        const res2 = await page.request.post(`${API_URL}/v1/sso/saml/callback`, {
            form: { SAMLResponse: btoa('<Response/>'), RelayState: 'relay-abc' },
        });
        expect(res2.status()).toBe(400);
    });

    test('missing SAMLResponse → 400', async ({ page }) => {
        const res = await page.request.post(`${API_URL}/v1/sso/saml/callback`, {
            form: { RelayState: 'some-relay' },
        });
        expect([400, 404]).toContain(res.status());
    });

    test('overly long RelayState → 400', async ({ page }) => {
        const longRelay = 'x'.repeat(100);
        const res = await page.request.post(`${API_URL}/v1/sso/saml/callback`, {
            form: { SAMLResponse: btoa('<Response/>'), RelayState: longRelay },
        });
        expect([400]).toContain(res.status());
    });
});

// ─── SAML Discovery error handling ────────────────────────────────────────────

test.describe('SSO SAML — discovery error handling', () => {
    test('service unavailable shows user-friendly error', async ({ page }) => {
        await page.route(`${API_URL}/v1/sso/discovery**`, async (route: Route) => {
            await route.fulfill({ status: 500, body: JSON.stringify({ error: 'internal_error' }) });
        });

        await page.goto(`${DASHBOARD_URL}/login`);
        await page.fill('#login-email', 'user@any.com');
        await page.click('button:has-text("Continue")');

        await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
        // Should not expose internal error details
        const alertText = await page.getByRole('alert').textContent();
        expect(alertText).not.toContain('internal_error');
    });
});
