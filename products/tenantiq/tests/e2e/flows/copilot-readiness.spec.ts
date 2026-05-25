import { test, expect, type Page } from '@playwright/test';

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
			body: JSON.stringify({ tenants: [{ id: 'tenant-e2e', displayName: 'E2E Tenant', domain: 'e2e.onmicrosoft.com', status: 'active', lastSyncAt: '2026-01-01T00:00:00Z' }] }),
		})
	);
	// Catch-all FIRST (Playwright LIFO: routes registered later take priority)
	await page.route('**/api/tenants/**', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [] }) })
	);
	await page.route('**/api/tenants/*/dashboard', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secureScore: 78, totalUsers: 50, totalLicenseSpend: 5000, licenseWaste: 500, activeAlerts: { critical: 0, high: 0, medium: 0, low: 0 }, userBreakdown: { total: 50, active: 45, inactive: 5, disabled: 0 }, topRiskyUsers: [], licenseBreakdown: [], licenseUtilization: 90, recentAlerts: [] }) })
	);
	await page.route('**/api/copilot-readiness/latest', (route) =>
		route.fulfill({
			status: 200, contentType: 'application/json',
			body: JSON.stringify({ overallScore: 78, categories: { identityAccess: { score: 90, checks: [] }, dataProtection: { score: 65, checks: [] } }, recommendations: [{ category: 'Identity & Access', priority: 'high', title: 'Enable MFA for remaining users', description: 'Enable MFA' }], assessedAt: '2026-01-01T00:00:00Z' }),
		})
	);
	await page.route('**/api/copilot-readiness/history', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
	);
	await page.route('**/api/copilot-readiness/license-summary', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ copilotLicensed: 45, totalLicensed: 50, overshareRiskCount: 0, labelGapCount: 0 }) })
	);
	await page.route('**/api/copilot-readiness/assess', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, result: { overallScore: 78, categories: {}, recommendations: [] }, assessmentId: 'assess-1' }) })
	);
}

// ─── Copilot Readiness Flow (E2E-05) ─────────────────────────────────────────

test.describe('Copilot Readiness Flow', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedAdmin(page);
	});

	test('Copilot Readiness page loads with score', async ({ page }) => {
		await page.goto('/security/copilot');
		// RED: data-testid="readiness-score" may not exist yet — fallback to score value text
		await expect(
			page.locator('[data-testid="readiness-score"]').or(page.locator('text=78')).first()
		).toBeVisible({ timeout: 10_000 });
	});

	test('category breakdown is visible', async ({ page }) => {
		await page.goto('/security/copilot');
		// Category labels rendered from CATEGORY_LABELS map
		await expect(
			page.locator('text=Identity & Access').or(page.locator('text=Identity')).first()
		).toBeVisible({ timeout: 10_000 });
	});

	test('Trigger assessment button is present', async ({ page }) => {
		await page.goto('/security/copilot');
		// RED: Assess / Run button may not exist yet
		await expect(
			page.locator('button:has-text("Assess")').or(page.locator('button:has-text("Run")')).or(page.locator('button:has-text("Assess Readiness")')).first()
		).toBeVisible({ timeout: 10_000 });
	});
});
