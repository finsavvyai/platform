import { test, expect, type Page } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8787';

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function setupAuthenticatedAdmin(page: Page, overrides: Record<string, unknown> = {}) {
	const user = {
		id: 'user-e2e', email: 'admin@e2e.test', name: 'E2E Admin',
		organizationId: 'org-e2e', tenantIds: ['tenant-e2e'],
		role: 'admin', status: 'active', ...overrides,
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
	// Catch-all FIRST (Playwright LIFO: routes registered later take priority)
	await page.route('**/api/tenants/**', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [] }) })
	);
	await page.route('**/api/tenants/*/dashboard', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secureScore: 80, totalUsers: 50, totalLicenseSpend: 5000, licenseWaste: 500, activeAlerts: { critical: 0, high: 0, medium: 0, low: 0 }, userBreakdown: { total: 50, active: 45, inactive: 5, disabled: 0 }, topRiskyUsers: [], licenseBreakdown: [], licenseUtilization: 90, recentAlerts: [] }) })
	);
	await page.route('**/api/sso*', (route) => {
		if (route.request().method() === 'GET') {
			route.fulfill({
				status: 200, contentType: 'application/json',
				body: JSON.stringify({ connections: [{ id: 'conn-1', provider: 'oidc', domain: 'corp.example.com', display_name: 'Corp OIDC', status: 'active' }] }),
			});
		} else {
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
		}
	});
}

// ─── SSO Provisioning Flow (E2E-04) ──────────────────────────────────────────

test.describe('SSO Provisioning Flow', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedAdmin(page);
	});

	test('SSO settings shows existing connection', async ({ page }) => {
		await page.goto('/settings');
		// RED: mocked connection domain should appear — may need data-testid="sso-connection" added
		await expect(page.locator('text=corp.example.com').first()).toBeVisible({ timeout: 10_000 });
	});

	test('SSO login initiation endpoint does not return 200 for unknown domain', async ({ request }) => {
		// Verify SSO login endpoint reachable — unknown domain should not 200
		const res = await request.get(`${API_BASE}/api/sso/login/corp.example.com`);
		expect(res.status()).not.toBe(200);
	});

	test('OIDC callback with missing state param returns error', async ({ request }) => {
		const res = await request.get(`${API_BASE}/api/sso/callback/oidc?code=test`);
		expect(res.status()).not.toBe(200);
	});
});
