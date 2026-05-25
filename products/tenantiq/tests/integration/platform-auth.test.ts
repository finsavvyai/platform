/**
 * Platform Auth Integration Tests
 *
 * Non-mock tests that verify the platform authentication endpoints
 * against the running API server with real D1 database.
 */

import { describe, it, expect } from 'vitest';

const apiUrl = process.env.API_URL || 'http://localhost:8787';

describe('Platform Auth Endpoints - Integration', () => {
	describe('POST /platform/auth/login', () => {
		it('rejects request with missing fields', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'test@example.com' }),
			});

			expect(res.status).toBe(400);
			const body = await res.json();
			expect(body.error || body.message).toBeDefined();
		});

		it('rejects request with invalid email format', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'not-an-email',
					password: 'password123',
				}),
			});

			expect(res.status).toBe(400);
		});

		it('rejects short password', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'user@test.com',
					password: 'short',
				}),
			});

			expect(res.status).toBe(400);
		});

		it('rejects non-existent user', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'nonexistent@example.com',
					password: 'password123',
				}),
			});

			// Either 401 (user not found) or 500 (DB error)
			expect([401, 500]).toContain(res.status);
		});
	});

	describe('POST /platform/auth/verify', () => {
		it('rejects request without authorization header', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/verify`, {
				method: 'POST',
			});

			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.error).toBe('Unauthorized');
		});

		it('rejects invalid bearer token', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/verify`, {
				method: 'POST',
				headers: { Authorization: 'Bearer invalid-jwt-token' },
			});

			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.error).toBe('Unauthorized');
		});

		it('rejects non-bearer authorization', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/verify`, {
				method: 'POST',
				headers: { Authorization: 'Basic dXNlcjpwYXNz' },
			});

			expect(res.status).toBe(401);
		});
	});

	describe('GET /platform/auth/me', () => {
		it('rejects unauthenticated request', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/me`);

			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.error).toBe('Unauthorized');
		});

		it('rejects invalid token', async () => {
			const res = await fetch(`${apiUrl}/platform/auth/me`, {
				headers: { Authorization: 'Bearer bad-token' },
			});

			expect(res.status).toBe(401);
		});
	});
});

describe('CORS Headers - Integration', () => {
	it('allows localhost origin', async () => {
		const res = await fetch(`${apiUrl}/health`, {
			headers: { Origin: 'http://localhost:5173' },
		});

		const acaOrigin = res.headers.get('access-control-allow-origin');
		expect(acaOrigin).toBe('http://localhost:5173');
	});

	it('rejects unknown origin', async () => {
		const res = await fetch(`${apiUrl}/health`, {
			headers: { Origin: 'http://evil.example.com' },
		});

		const acaOrigin = res.headers.get('access-control-allow-origin');
		expect(acaOrigin).toBeNull();
	});
});
