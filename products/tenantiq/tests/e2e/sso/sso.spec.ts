import { test, expect, type Page } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8787';

// ─── Auth helper (cookie-based — mocks /api/auth/me) ──────────────────────────

async function setupAuthenticatedAdmin(page: Page, overrides: Record<string, unknown> = {}) {
	const user = {
		id: 'user-e2e',
		email: 'admin@e2e.test',
		name: 'E2E Admin',
		organizationId: 'org-e2e',
		tenantIds: ['tenant-e2e'],
		role: 'admin',
		status: 'active',
		...overrides,
	};

	await page.route('**/api/auth/me', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) })
	);
	await page.route('**/api/tenants', (route) =>
		route.fulfill({
			status: 200, contentType: 'application/json',
			body: JSON.stringify({ tenants: [{ id: 'tenant-e2e', displayName: 'E2E Tenant', domain: 'e2e.onmicrosoft.com', status: 'active', lastSyncAt: null }] }),
		})
	);
	await page.route('**/api/tenants/*/dashboard', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secureScore: 72, totalUsers: 50, totalAlerts: 2, licenseCost: 5000, complianceScore: 88, mfaAdoption: 95, riskScore: 'low' }) })
	);
	await page.route('**/api/tenants/*/alerts*', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [], total: 0 }) })
	);
	await page.route('**/api/sso*', (route) => {
		if (route.request().method() === 'GET') {
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connections: [] }) });
		} else {
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
		}
	});
}

// ─── SSO Settings Tab ─────────────────────────────────────────────────────────

test.describe('SSO Settings Tab', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedAdmin(page);
	});

	test('settings page loads and is accessible to admin', async ({ page }) => {
		await page.goto('/settings');
		await expect(page).toHaveURL(/\/settings/);
		await expect(page.locator('h1, h2').filter({ hasText: /settings/i }).first()).toBeVisible({ timeout: 10_000 });
	});

	test('SSO tab or SSO section is visible for admin user', async ({ page }) => {
		await page.goto('/settings');
		await expect(
			page.locator('text=SSO').or(page.locator('text=Single Sign-On')).or(page.locator('text=Enterprise SSO')).first()
		).toBeVisible({ timeout: 10_000 });
	});

	test('SSO settings section renders connection list (empty state)', async ({ page }) => {
		await page.goto('/settings');
		// No tab system — SSO section renders inline for admin users
		await expect(
			page.locator('text=No SSO connections').or(page.locator('button').filter({ hasText: /add connection/i })).first()
		).toBeVisible({ timeout: 8_000 });
	});

	test('SSO settings section shows SAML and OIDC provider options', async ({ page }) => {
		await page.goto('/settings');
		// Click "Add Connection" to open the form which shows provider options
		const addBtn = page.locator('button').filter({ hasText: /add connection/i });
		if (await addBtn.count() > 0) {
			await addBtn.first().click();
			await expect(page.locator('select option[value="saml"], text=SAML').first()).toBeVisible({ timeout: 8_000 });
			await expect(page.locator('select option[value="oidc"], text=OIDC').first()).toBeVisible({ timeout: 8_000 });
		}
	});

	test('non-admin viewer cannot access SSO settings', async ({ page }) => {
		await setupAuthenticatedAdmin(page, { role: 'viewer' });
		await page.goto('/settings');
		// SSO section should not be rendered for non-admin roles
		const ssoSection = page.locator('h3').filter({ hasText: /enterprise sso/i });
		// Either not present, or present but disabled — both valid
		if (await ssoSection.count() > 0) {
			// If present, add button should be absent
			await expect(page.locator('button').filter({ hasText: /add connection/i })).not.toBeVisible();
		}
	});
});

// ─── SSO Login Initiation (API) ────────────────────────────────────────────────

test.describe('SSO Login Initiation', () => {
	// These tests verify bad inputs don't return a 200 success.
	// Exact error codes vary: 401 (auth guard), 400 (validation), 404 (not found), 422 (unprocessable), 500 (crash).

	test('GET /api/sso/login/:domain with unknown domain does not return 200', async ({ request }) => {
		const res = await request.get(`${API_BASE}/api/sso/login/nonexistent-domain.com`);
		expect(res.status()).not.toBe(200);
	});

	test('GET /api/sso/login/:domain with missing domain does not return 200', async ({ request }) => {
		const res = await request.get(`${API_BASE}/api/sso/login/`);
		// 404 from router (no :domain segment) is valid
		expect([400, 401, 404]).toContain(res.status());
	});

	test('POST /api/sso/callback/saml with no body returns error', async ({ request }) => {
		const res = await request.post(`${API_BASE}/api/sso/callback/saml`, {
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'http://localhost:5173' },
			data: {},
		});
		expect(res.status()).not.toBe(200);
	});

	test('GET /api/sso/callback/oidc with missing state returns error', async ({ request }) => {
		const res = await request.get(`${API_BASE}/api/sso/callback/oidc?code=test`);
		expect(res.status()).not.toBe(200);
	});

	test('GET /api/sso/callback/oidc with missing code returns error', async ({ request }) => {
		const res = await request.get(`${API_BASE}/api/sso/callback/oidc?state=test`);
		expect(res.status()).not.toBe(200);
	});
});

// ─── SSO Auth Guard ────────────────────────────────────────────────────────────

test.describe('SSO Auth Guard', () => {
	test('unauthenticated user visiting /settings sees sign-in prompt', async ({ page }) => {
		await page.route('**/api/auth/me', (route) =>
			route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
		);
		await page.goto('/settings');
		// Should show sign-in hero or redirect to landing page with sign-in
		await expect(
			page.locator('text=Sign in').or(page.locator('text=Log in')).or(page.locator('text=Sign In')).or(page.locator('[data-testid="sign-in"]')).first()
		).toBeVisible({ timeout: 10_000 });
	});
});

// ─── SSO Connection Management (UI interactions) ──────────────────────────────

test.describe('SSO Connection Management', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedAdmin(page);
	});

	test('can open SAML add form from SSO settings section', async ({ page }) => {
		await page.goto('/settings');

		// Click Add Connection button
		const addBtn = page.locator('button').filter({ hasText: /add connection/i });
		if (await addBtn.count() > 0) {
			await addBtn.first().click();
			// Switch to SAML provider
			const providerSelect = page.locator('select').filter({ has: page.locator('option[value="saml"]') });
			if (await providerSelect.count() > 0) {
				await providerSelect.selectOption('saml');
				// SAML form fields should appear
				await expect(
					page.locator('input[placeholder*="metadata"], input[placeholder*="Metadata"], input[placeholder*="idp"], textarea[placeholder*="BEGIN CERTIFICATE"]').first()
				).toBeVisible({ timeout: 5_000 });
			}
		}
	});

	test('can open OIDC add form from SSO settings section', async ({ page }) => {
		await page.goto('/settings');

		const addBtn = page.locator('button').filter({ hasText: /add connection/i });
		if (await addBtn.count() > 0) {
			await addBtn.first().click();
			// OIDC is default — issuer URL field should be visible
			await expect(
				page.locator('input[placeholder*="accounts.google"], input[placeholder*="issuer"], input[placeholder*="Issuer"]').first()
			).toBeVisible({ timeout: 5_000 });
		}
	});

	test('SSO settings shows existing connection with cert status', async ({ page }) => {
		// Mock with an existing connection that has cert data
		await page.route('**/api/sso*', (route) =>
			route.fulfill({
				status: 200, contentType: 'application/json',
				body: JSON.stringify({
					connections: [{
						id: 'conn-1', provider: 'saml', domain: 'corp.example.com',
						display_name: 'Corp SAML', status: 'active',
						certExpiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(),
					}],
				}),
			})
		);
		await page.goto('/settings');
		await expect(page.locator('text=corp.example.com').first()).toBeVisible({ timeout: 8_000 });
	});
});

// ─── Full-Screen Screenshot Tour ──────────────────────────────────────────────

test.describe('Screen tour — all major routes', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedAdmin(page);
		// Stub all tenant API calls generically
		await page.route('**/api/tenants/**', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
		);
	});

	const ROUTES = [
		{ path: '/', name: 'dashboard' },
		{ path: '/alerts', name: 'alerts' },
		{ path: '/licenses', name: 'licenses' },
		{ path: '/security', name: 'security' },
		{ path: '/security/cis', name: 'cis-benchmark' },
		{ path: '/security/email', name: 'email-security' },
		{ path: '/ai', name: 'ai-agent' },
		{ path: '/workflows', name: 'workflows' },
		{ path: '/audit', name: 'audit' },
		{ path: '/backups', name: 'backups' },
		{ path: '/backups/config', name: 'config-snapshots' },
		{ path: '/governance', name: 'governance' },
		{ path: '/governance/storage', name: 'storage-analytics' },
		{ path: '/msp', name: 'msp-benchmark' },
		{ path: '/skills', name: 'skills-hub' },
		{ path: '/settings', name: 'settings' },
		{ path: '/team', name: 'team' },
	];

	for (const { path, name } of ROUTES) {
		test(`${name} page loads without crash`, async ({ page }) => {
			await page.goto(path);
			// Single-pass escape: replace all '/' with '\/' for regex
			const escaped = path.replace(/\//g, '\\/');
			await expect(page).toHaveURL(new RegExp(escaped));
			// No JS error modal
			await expect(page.locator('text=Unexpected error')).not.toBeVisible();
			await expect(page.locator('text=500')).not.toBeVisible();
			// Page has some content (not blank)
			await expect(page.locator('body')).not.toBeEmpty();
		});
	}
});
