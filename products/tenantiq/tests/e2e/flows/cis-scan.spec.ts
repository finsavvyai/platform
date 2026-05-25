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
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secureScore: 80, totalUsers: 50, totalLicenseSpend: 5000, licenseWaste: 500, activeAlerts: { critical: 0, high: 1, medium: 0, low: 0 }, userBreakdown: { total: 50, active: 45, inactive: 5, disabled: 0 }, topRiskyUsers: [], licenseBreakdown: [], licenseUtilization: 90, recentAlerts: [] }) })
	);
	await page.route('**/api/cis-benchmark/scan', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, result: { overallScore: 80, passCount: 1, failCount: 1, partialCount: 0, totalControls: 2, sectionScores: {}, controls: [{ id: 'cis-1', title: 'MFA Required', status: 'fail', severity: 'high', remediationSteps: ['Enable MFA'] }], scannedAt: '2026-01-01T00:00:00Z' } }) })
	);
	await page.route('**/api/cis-benchmark/latest', (route) =>
		route.fulfill({
			status: 200, contentType: 'application/json',
			body: JSON.stringify({ overallScore: 80, passCount: 1, failCount: 1, partialCount: 0, totalControls: 2, sectionScores: { Identity: { pass: 1, fail: 1, total: 2, score: 50 } }, controls: [{ id: 'cis-1', title: 'MFA Required', status: 'fail', severity: 'high', remediationSteps: ['Enable MFA'] }], scannedAt: '2026-01-01T00:00:00Z' }),
		})
	);
}

// ─── CIS Scan Flow (E2E-03) ───────────────────────────────────────────────────

test.describe('CIS Scan Flow', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedAdmin(page);
	});

	test('CIS benchmark page loads with control results', async ({ page }) => {
		await page.goto('/security/cis');
		// RED: data-testid="cis-control-table" may not exist yet
		await expect(
			page.locator('[data-testid="cis-control-table"]').or(page.locator('text=MFA Required')).first()
		).toBeVisible({ timeout: 10_000 });
	});

	test('failing controls are displayed with severity badge', async ({ page }) => {
		await page.goto('/security/cis');
		// RED: data-testid="severity-badge" may not exist yet
		await expect(
			page.locator('[data-testid="severity-badge"]').or(page.locator('text=high')).first()
		).toBeVisible({ timeout: 10_000 });
	});

	test('scan trigger button is visible', async ({ page }) => {
		await page.goto('/security/cis');
		// RED: "Run Scan" / "Trigger" button may not exist yet
		await expect(
			page.locator('button:has-text("Run Scan")').or(page.locator('button:has-text("Trigger")')).or(page.locator('button:has-text("Scan")')).first()
		).toBeVisible({ timeout: 10_000 });
	});
});
