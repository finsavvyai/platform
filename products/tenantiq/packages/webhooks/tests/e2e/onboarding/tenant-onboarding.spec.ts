/**
 * E2E Tests for TenantIQ Tenant Onboarding Flow
 * Tests the complete onboarding journey from landing page to first alert
 */

import { test, expect } from '@playwright/test';

test.describe('Tenant Onboarding Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Start at the landing page
		await page.goto('http://localhost:3000');
	});

	test('complete onboarding flow - new user', async ({ page }) => {
		// Step 1: Landing page check
		await expect(page).toHaveTitle(/TenantIQ/);
		await expect(page.getByText(/AI-Powered Microsoft 365 Intelligence/i)).toBeVisible();

		// Step 2: Click "Get Started" or "Sign In"
		await page.getByRole('button', { name: /get started|sign in/i }).click();

		// Step 3: Microsoft OAuth redirect simulation
		await page.waitForURL(/login|auth/);

		// Step 4: Mock successful authentication
		await page.evaluate(() => {
			localStorage.setItem('tenantiq_token', 'mock-jwt-token-12345');
			localStorage.setItem('tenantiq_user', JSON.stringify({
				id: 'test-user-123',
				email: 'test@contoso.com',
				name: 'Test User'
			}));
		});

		// Step 5: Navigate to dashboard
		await page.goto('http://localhost:3000/dashboard');

		// Step 6: First-time setup wizard should appear
		await expect(page.getByText(/welcome to tenantiq|setup wizard/i)).toBeVisible();

		// Step 7: Connect Microsoft 365 tenant
		await page.getByRole('button', { name: /connect tenant|add tenant/i }).click();

		// Step 8: Tenant connection form
		await page.getByLabel(/tenant name/i).fill('Contoso Demo');
		await page.getByLabel(/domain/i).fill('contoso.com');

		// Step 9: Grant permissions (mock)
		await page.getByRole('button', { name: /grant permissions|authorize/i }).click();

		// Step 10: Wait for tenant sync
		await expect(page.getByText(/syncing tenant|analyzing tenant/i)).toBeVisible();

		// Mock sync complete
		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('tenant-sync-complete', {
				detail: { tenantId: 'tenant-123', status: 'completed' }
			}));
		});

		// Step 11: Verify dashboard loads
		await expect(page.getByText(/security score|alerts|licenses/i)).toBeVisible();

		// Step 12: Check security status
		const securityCard = page.locator('[data-testid="security-status-card"]');
		await expect(securityCard).toBeVisible();

		// Step 13: Check alerts
		const alertsSection = page.locator('[data-testid="alerts-section"]');
		await expect(alertsSection).toBeVisible();

		// Step 14: Verify alert shown
		await expect(page.getByText(/alert|warning|critical/i).first()).toBeVisible();

		// Step 15: Click first alert
		await page.getByRole('button', { name: /view details|see more/i }).first().click();

		// Step 16: Alert modal opens
		const alertModal = page.locator('[role="dialog"]');
		await expect(alertModal).toBeVisible();
		await expect(alertModal.getByText(/business impact/i)).toBeVisible();
		await expect(alertModal.getByText(/recommended action/i)).toBeVisible();

		// Step 17: Check remediation
		await expect(alertModal.getByText(/remediate|fix|resolve/i)).toBeVisible();

		// Step 18: Close modal
		await alertModal.getByRole('button', { name: /close/i }).click();
		await expect(alertModal).not.toBeVisible();

		// Step 19: Navigate to licenses
		await page.getByRole('link', { name: /licenses|optimization/i }).click();
		await expect(page).toHaveURL(/licenses/);

		// Step 20: Verify license waste
		await expect(page.getByText(/potential savings|wasted licenses/i)).toBeVisible();

		console.log('✅ Complete onboarding flow test passed!');
	});

	test('onboarding flow - MSP with multiple tenants', async ({ page }) => {
		// Mock MSP user
		await page.evaluate(() => {
			localStorage.setItem('tenantiq_token', 'mock-msp-token-67890');
			localStorage.setItem('tenantiq_user', JSON.stringify({
				id: 'msp-user-456',
				email: 'admin@msp.com',
				name: 'MSP Admin',
				role: 'admin'
			}));
		});

		await page.goto('http://localhost:3000/dashboard');

		// Should show tenant selector
		await expect(page.getByText(/select tenant|switch tenant/i)).toBeVisible();

		// Add first tenant
		await page.getByRole('button', { name: /add tenant/i }).click();
		await page.getByLabel(/tenant name/i).fill('Client A');
		await page.getByLabel(/domain/i).fill('clienta.com');
		await page.getByRole('button', { name: /save|add/i }).click();

		// Verify tenant appears
		await expect(page.getByText('Client A')).toBeVisible();

		// Add second tenant
		await page.getByRole('button', { name: /add tenant/i }).click();
		await page.getByLabel(/tenant name/i).fill('Client B');
		await page.getByLabel(/domain/i).fill('clientb.com');
		await page.getByRole('button', { name: /save|add/i }).click();

		// Verify both tenants
		await expect(page.getByText('Client A')).toBeVisible();
		await expect(page.getByText('Client B')).toBeVisible();

		// Switch tenants
		await page.getByText('Client B').click();
		await expect(page.getByText(/viewing: client b/i)).toBeVisible();

		console.log('✅ MSP multi-tenant test passed!');
	});

	test('error handling - invalid credentials', async ({ page }) => {
		// Access dashboard without auth
		await page.goto('http://localhost:3000/dashboard');

		// Should redirect
		await expect(page).toHaveURL(/login|auth/);

		// Invalid token
		await page.evaluate(() => {
			localStorage.setItem('tenantiq_token', 'invalid-token');
		});

		await page.goto('http://localhost:3000/dashboard');

		// Should show error
		await expect(page.getByText(/authentication failed|invalid session/i)).toBeVisible();

		console.log('✅ Error handling test passed!');
	});

	test('permission checks - viewer role', async ({ page }) => {
		// Mock viewer
		await page.evaluate(() => {
			localStorage.setItem('tenantiq_token', 'mock-viewer-token');
			localStorage.setItem('tenantiq_user', JSON.stringify({
				id: 'viewer-user-789',
				email: 'viewer@contoso.com',
				name: 'Viewer User',
				role: 'viewer'
			}));
		});

		await page.goto('http://localhost:3000/dashboard');

		// Can view alerts
		await expect(page.getByText(/alerts/i)).toBeVisible();

		// Cannot remediate
		const remediateButton = page.getByRole('button', { name: /remediate|fix/i });
		if (await remediateButton.isVisible()) {
			await expect(remediateButton).toBeDisabled();
		}

		// Cannot add tenants
		const addTenantButton = page.getByRole('button', { name: /add tenant/i });
		await expect(addTenantButton).not.toBeVisible();

		console.log('✅ Permission checks passed!');
	});
});
