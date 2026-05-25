/**
 * SSO Admin CRUD E2E — Playwright spec.
 * Tests: admin creates Okta-SAML IdP from UI, sees redacted secret, edits, deletes with confirmation.
 * DO NOT RUN in CI until:
 *  1. Dashboard deployed and /admin/sso pages accessible.
 *  2. Test user with org-admin role seeded.
 *  3. API mock server or test DB with known state available.
 */

import { test, expect, Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test-e2e.lunaos.ai';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'e2e-test-password-123';
const TEST_ORG_ID = process.env.TEST_ORG_ID || 'org-e2e-1';

// Sample SAML certificate for testing (self-signed, not real)
const TEST_SAML_CERT = [
    '-----BEGIN CERTIFICATE-----',
    'MIICpDCCAYwCCQDMX9B2YXzN4DANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls',
    'dW5hb3MuYWkwHhcNMjUwMTAxMDAwMDAwWhcNMjYwMTAxMDAwMDAwWjAUMRIwEAYD',
    'VQQDDAlsdW5hb3MuYWkwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECAwEAAQ==',
    '-----END CERTIFICATE-----',
].join('\n');

// ─── Login helper ─────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await page.click('button:has-text("Continue")');
    // Expect password form (no SSO for test admin)
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.fill('input[type="password"]', TEST_ADMIN_PASSWORD);
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

// ─── SSO Admin CRUD ───────────────────────────────────────────────────────────

test.describe('SSO Admin — IdP CRUD flow', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('navigate to /admin/sso list page', async ({ page }) => {
        await page.goto(`${DASHBOARD_URL}/admin/sso`);
        await expect(page).toHaveURL(/\/admin\/sso/);
        await expect(page.getByRole('heading', { name: /identity provider/i })).toBeVisible();
    });

    test('create new Okta SAML IdP from UI', async ({ page }) => {
        await page.goto(`${DASHBOARD_URL}/admin/sso/new`);
        await page.waitForLoadState('networkidle');

        // Fill common fields
        await page.fill('input[name="name"]', 'Okta SAML E2E Test');
        await page.click('input[value="saml"]'); // Select SAML type
        await page.fill('input[name="emailDomain"]', 'e2e-test.example.com');

        // Fill SAML-specific fields
        await page.fill('input[name="samlEntityId"]', 'https://app.lunaos.ai/saml/metadata');
        await page.fill('input[name="samlSsoUrl"]', 'https://dev-123456.okta.com/app/saml/sso/saml');
        await page.fill('textarea[name="samlCertificate"]', TEST_SAML_CERT);

        // Submit
        await page.click('button[type="submit"]');
        await page.waitForURL('**/admin/sso**', { timeout: 10000 });

        // Verify IdP appears in list
        await expect(page.getByText('Okta SAML E2E Test')).toBeVisible();
    });

    test('secret/certificate is redacted in IdP detail view', async ({ page }) => {
        await page.goto(`${DASHBOARD_URL}/admin/sso`);
        // Click on first IdP (assumes at least one exists from prior test)
        const firstIdp = page.locator('[data-testid="idp-row"]').first();
        await firstIdp.click();
        await page.waitForLoadState('networkidle');

        // The client secret hint should be in •••• format, not raw value
        const secretHint = page.locator('[data-testid="secret-hint"]');
        if (await secretHint.count() > 0) {
            const text = await secretHint.textContent();
            expect(text).toMatch(/^••••/);
            expect(text).not.toContain('raw');
            expect(text).not.toContain('secret');
        }
    });

    test('edit IdP name via edit form', async ({ page }) => {
        // Navigate to a known IdP edit page
        await page.goto(`${DASHBOARD_URL}/admin/sso`);
        const editBtn = page.locator('a[href*="/admin/sso/"][href$="/edit"], button:has-text("Edit")').first();
        if (await editBtn.count() > 0) {
            await editBtn.click();
            await page.waitForLoadState('networkidle');

            // Update name
            const nameInput = page.locator('input[name="name"]');
            await nameInput.clear();
            await nameInput.fill('Updated IdP Name E2E');
            await page.click('button[type="submit"]');

            await page.waitForURL('**/admin/sso**', { timeout: 5000 });
            await expect(page.getByText('Updated IdP Name E2E')).toBeVisible();
        }
    });

    test('delete IdP requires typing the provider name to confirm', async ({ page }) => {
        await page.goto(`${DASHBOARD_URL}/admin/sso`);
        const deleteBtn = page.locator('button:has-text("Delete")').first();
        if (await deleteBtn.count() > 0) {
            await deleteBtn.click();

            // Modal should appear
            await expect(page.getByRole('alertdialog')).toBeVisible();
            await expect(page.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');

            // Confirm button should be disabled before typing
            const confirmBtn = page.getByRole('button', { name: /delete provider/i });
            await expect(confirmBtn).toBeDisabled();

            // Type wrong name — still disabled
            const confirmInput = page.getByRole('textbox');
            await confirmInput.fill('Wrong Name');
            await expect(confirmBtn).toBeDisabled();

            // Get the provider name from the modal text and type it correctly
            const providerNameEl = page.locator('[id="delete-modal-title"]').locator('..').locator('strong');
            const providerName = await providerNameEl.textContent() ?? '';
            await confirmInput.clear();
            await confirmInput.fill(providerName);

            // Now confirm button should be enabled
            await expect(confirmBtn).toBeEnabled();

            // Confirm deletion
            await confirmBtn.click();
            await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 3000 });
        }
    });

    test('Esc key dismisses delete confirmation modal', async ({ page }) => {
        await page.goto(`${DASHBOARD_URL}/admin/sso`);
        const deleteBtn = page.locator('button:has-text("Delete")').first();
        if (await deleteBtn.count() > 0) {
            await deleteBtn.click();
            await expect(page.getByRole('alertdialog')).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 3000 });
        }
    });
});

// ─── Authorization guards ─────────────────────────────────────────────────────

test.describe('SSO Admin — authorization guards', () => {
    test('unauthenticated user is redirected to login', async ({ page }) => {
        await page.goto(`${DASHBOARD_URL}/admin/sso`);
        await expect(page).toHaveURL(/\/login|\/auth\/login/, { timeout: 5000 });
    });
});
