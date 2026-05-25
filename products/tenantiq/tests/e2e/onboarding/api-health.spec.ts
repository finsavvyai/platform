/**
 * API Health E2E Tests
 *
 * Non-mock tests that verify all health endpoints respond
 * correctly through the real running API server.
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8787';

test.describe('API Health Verification', () => {
	test('health endpoint returns healthy status', async ({ request }) => {
		const res = await request.get(`${API_URL}/health`);
		expect(res.ok()).toBe(true);

		const body = await res.json();
		expect(body.status).toBe('healthy');
		expect(body.checks.database).toBe('healthy');
		expect(body.checks.version).toBeDefined();
		expect(body.checks.uptimeSeconds).toBeGreaterThanOrEqual(0);
	});

	test('readiness endpoint returns ready', async ({ request }) => {
		const res = await request.get(`${API_URL}/health/ready`);
		expect(res.ok()).toBe(true);

		const body = await res.json();
		expect(body.status).toBe('ready');
		expect(body.timestamp).toBeDefined();
	});

	test('liveness endpoint returns alive', async ({ request }) => {
		const res = await request.get(`${API_URL}/health/live`);
		expect(res.ok()).toBe(true);

		const body = await res.json();
		expect(body.status).toBe('alive');
	});

	test('all health endpoints return JSON', async ({ request }) => {
		const endpoints = ['/health', '/health/ready', '/health/live'];

		for (const ep of endpoints) {
			const res = await request.get(`${API_URL}${ep}`);
			const ct = res.headers()['content-type'] || '';
			expect(ct).toContain('application/json');
		}
	});

	test('unknown routes return 404 JSON', async ({ request }) => {
		const res = await request.get(`${API_URL}/nonexistent-xyz`);
		expect(res.status()).toBe(404);

		const body = await res.json();
		expect(body.error).toBe('Not found');
	});
});
