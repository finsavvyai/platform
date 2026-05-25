import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { ssoRoutes } from './sso';
import { AppError } from '../lib/errors';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare } as unknown,
	KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } as unknown,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as unknown;

async function createToken(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('SSO Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/sso', ssoRoutes);
		app.onError((err, c) => {
			if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
			return c.json({ error: 'Internal error' }, 500);
		});
		token = await createToken({
			sub: 'u1', email: 'admin@t.com', name: 'Admin',
			orgId: 'org1', tenantIds: ['t1'], role: 'admin',
		});
	});

	describe('GET /api/sso', () => {
		it('returns connections for org', async () => {
			mockAll.mockResolvedValueOnce({
				results: [{ id: 'sso1', org_id: 'org1', provider: 'oidc' }],
			});

			const res = await app.request('/api/sso', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = (await res.json()) as { connections: unknown[] };
			expect(json.connections).toHaveLength(1);
		});

		it('returns empty when no orgId', async () => {
			const noOrgToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
			});

			const res = await app.request('/api/sso', {
				method: 'GET', headers: { Authorization: `Bearer ${noOrgToken}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = (await res.json()) as { connections: unknown[] };
			expect(json.connections).toEqual([]);
		});
	});

	describe('POST /api/sso', () => {
		it('creates a connection with valid data', async () => {
			mockFirst.mockResolvedValueOnce(null); // no duplicate
			mockRun.mockResolvedValueOnce({ meta: {} });

			const res = await app.request('/api/sso', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					provider: 'oidc',
					displayName: 'Okta',
					domain: 'example.com',
					issuerUrl: 'https://example.okta.com',
					clientId: 'abc123',
				}),
			}, mockEnv);

			expect(res.status).toBe(201);
			const json = (await res.json()) as { success: boolean };
			expect(json.success).toBe(true);
		});

		it('rejects duplicate domain', async () => {
			mockFirst.mockResolvedValueOnce({ id: 'existing' });

			const res = await app.request('/api/sso', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					provider: 'saml',
					displayName: 'Entra',
					domain: 'example.com',
				}),
			}, mockEnv);

			expect(res.status).toBe(422);
		});

		it('rejects invalid provider', async () => {
			const res = await app.request('/api/sso', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					provider: 'ldap',
					displayName: 'Bad',
					domain: 'bad.com',
				}),
			}, mockEnv);

			expect(res.status).toBe(422);
		});
	});

	describe('PATCH /api/sso/:id', () => {
		it('updates a connection', async () => {
			mockFirst.mockResolvedValueOnce({ id: 'sso1' }); // exists check
			mockRun.mockResolvedValueOnce({ meta: {} });

			const res = await app.request('/api/sso/sso1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ displayName: 'Updated Okta', status: 'active' }),
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = (await res.json()) as { success: boolean };
			expect(json.success).toBe(true);
		});

		it('returns 404 for non-existent connection', async () => {
			mockFirst.mockResolvedValueOnce(null);

			const res = await app.request('/api/sso/bad-id', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ displayName: 'Nope' }),
			}, mockEnv);

			expect(res.status).toBe(404);
		});

		it('returns 422 when no fields to update', async () => {
			mockFirst.mockResolvedValueOnce({ id: 'sso1' });

			const res = await app.request('/api/sso/sso1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({}),
			}, mockEnv);

			expect(res.status).toBe(422);
		});

		it('returns 422 when no org', async () => {
			const noOrgToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
			});
			const res = await app.request('/api/sso/sso1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${noOrgToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ displayName: 'Test' }),
			}, mockEnv);

			expect(res.status).toBe(422);
		});

		it('rejects invalid update schema', async () => {
			const res = await app.request('/api/sso/sso1', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ provider: 'ldap' }),
			}, mockEnv);

			expect(res.status).toBe(422);
		});
	});

	describe('DELETE /api/sso/:id', () => {
		it('deletes an existing connection', async () => {
			mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

			const res = await app.request('/api/sso/sso1', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
		});

		it('returns 404 for non-existent connection', async () => {
			mockRun.mockResolvedValueOnce({ meta: { changes: 0 } });

			const res = await app.request('/api/sso/bad-id', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(404);
		});
	});

	describe('POST /api/sso/:id/test', () => {
		it('returns check results for oidc connection', async () => {
			mockFirst.mockResolvedValueOnce({
				id: 'sso1', provider: 'oidc', issuer_url: 'https://example.com',
				client_id: 'abc', metadata_url: null, certificate: null,
			});

			const res = await app.request('/api/sso/sso1/test', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json = (await res.json()) as { checks: unknown[] };
			expect(json.checks.length).toBeGreaterThan(0);
		});

		it('returns 404 for missing connection', async () => {
			mockFirst.mockResolvedValueOnce(null);

			const res = await app.request('/api/sso/bad/test', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(404);
		});
	});
});
