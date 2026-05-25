/**
 * Authentication Flow E2E Tests
 *
 * Tests the auth callback page, unauthenticated dashboard behavior,
 * and platform auth API endpoints against the real running server.
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8787';

test.describe('Auth Callback Flow', () => {
	test('shows error for missing authentication data', async ({
		page,
	}) => {
		await page.goto('/auth/callback');

		await expect(
			page.locator('text=Sign-in Failed')
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.locator('text=Missing authentication data')
		).toBeVisible();
	});

	test('shows error message from query param', async ({ page }) => {
		await page.goto('/auth/callback?error=access_denied');

		await expect(
			page.locator('text=Sign-in Failed')
		).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('text=access_denied')).toBeVisible();
	});

	test('valid token+user redirects to dashboard', async ({ page }) => {
		const mockUser = encodeURIComponent(
			JSON.stringify({
				id: 'test-user-1',
				email: 'e2e@tenantiq.test',
				name: 'E2E Test User',
				role: 'admin',
				organizationId: 'org-1',
				tenantIds: [],
			})
		);

		await page.goto(
			`/auth/callback?token=test-jwt-token&user=${mockUser}`
		);

		await page.waitForURL('/', { timeout: 10_000 });
	});
});

test.describe('Dashboard - Unauthenticated', () => {
	test('shows sign-in hero when not authenticated', async ({
		page,
	}) => {
		await page.goto('/');

		await expect(
			page.locator('text=Sign in with Microsoft')
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.locator('.logo-text', { hasText: 'TenantIQ' })
		).toBeVisible();
	});
});

test.describe('Platform Auth API - Real Endpoints', () => {
	test('login rejects missing fields', async ({ request }) => {
		const res = await request.post(
			`${API_URL}/platform/auth/login`,
			{ data: { email: 'test@example.com' } }
		);
		expect(res.status()).toBe(400);
	});

	test('login rejects invalid credentials', async ({ request }) => {
		const res = await request.post(
			`${API_URL}/platform/auth/login`,
			{
				data: {
					email: 'nonexistent@example.com',
					password: 'wrongpass1',
				},
			}
		);
		expect([401, 500]).toContain(res.status());
	});

	test('verify rejects missing auth header', async ({ request }) => {
		const res = await request.post(
			`${API_URL}/platform/auth/verify`
		);
		expect(res.status()).toBe(401);
	});

	test('verify rejects invalid token', async ({ request }) => {
		const res = await request.post(
			`${API_URL}/platform/auth/verify`,
			{ headers: { Authorization: 'Bearer invalid-token-xxx' } }
		);
		expect(res.status()).toBe(401);
	});

	test('me rejects unauthenticated request', async ({ request }) => {
		const res = await request.get(`${API_URL}/platform/auth/me`);
		expect(res.status()).toBe(401);
	});
});
