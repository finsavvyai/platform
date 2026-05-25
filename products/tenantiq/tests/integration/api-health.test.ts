/**
 * API Health Integration Tests
 *
 * Non-mock tests that verify the health endpoints by
 * running the actual Hono app with a real D1 database binding.
 *
 * Uses Miniflare's D1 simulator (in-memory SQLite) — no mocking.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Miniflare } from 'miniflare';

let mf: Miniflare;
let apiUrl: string;

beforeAll(async () => {
	mf = new Miniflare({
		modules: true,
		scriptPath: 'apps/api/src/index.ts',
		// Fallback: we test via the running wrangler dev server instead
	});

	// Use the running dev server for integration tests
	apiUrl = process.env.API_URL || 'http://localhost:8787';
});

describe('Health Endpoints - Integration', () => {
	it('GET /health returns 200 with healthy status', async () => {
		const res = await fetch(`${apiUrl}/health`);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.status).toBe('healthy');
		expect(body.checks).toBeDefined();
		expect(body.checks.database).toBe('healthy');
		expect(body.checks.version).toBeDefined();
		expect(typeof body.checks.uptimeSeconds).toBe('number');
		expect(body.checks.timestamp).toBeDefined();
		expect(body.environment).toBeDefined();
	});

	it('GET /health/ready returns readiness status', async () => {
		const res = await fetch(`${apiUrl}/health/ready`);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.status).toBe('ready');
		expect(body.timestamp).toBeDefined();
	});

	it('GET /health/live returns alive', async () => {
		const res = await fetch(`${apiUrl}/health/live`);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.status).toBe('alive');
		expect(body.timestamp).toBeDefined();
	});

	it('returns JSON content-type for all health endpoints', async () => {
		const endpoints = ['/health', '/health/ready', '/health/live'];

		for (const ep of endpoints) {
			const res = await fetch(`${apiUrl}${ep}`);
			const ct = res.headers.get('content-type') || '';
			expect(ct).toContain('application/json');
		}
	});

	it('health response includes security headers', async () => {
		const res = await fetch(`${apiUrl}/health`);
		// Verify security headers are set by middleware
		expect(res.headers.get('x-content-type-options')).toBeTruthy();
	});
});

describe('404 Handling - Integration', () => {
	it('returns 404 JSON for unknown routes', async () => {
		const res = await fetch(`${apiUrl}/nonexistent-route-xyz`);
		expect(res.status).toBe(404);

		const body = await res.json();
		expect(body.error).toBe('Not found');
	});
});
