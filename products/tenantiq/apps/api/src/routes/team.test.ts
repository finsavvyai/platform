import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { teamRoutes } from './team';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare } as any,
	KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Team Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/team', teamRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@t.com', name: 'Admin',
			orgId: 'org1', tenantIds: ['t1'], role: 'admin',
		});
	});

	describe('GET /api/team', () => {
		it('returns members and invitations', async () => {
			mockAll
				.mockResolvedValueOnce({ results: [{ id: 'u1', email: 'a@t.com', role: 'admin' }] })
				.mockResolvedValueOnce({ results: [{ id: 'inv1', email: 'b@t.com', status: 'pending' }] });

			const res = await app.request('/api/team', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.members).toHaveLength(1);
			expect(json.invitations).toHaveLength(1);
		});

		it('returns empty when no orgId', async () => {
			const noOrgToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
			});
			const res = await app.request('/api/team', {
				method: 'GET', headers: { Authorization: `Bearer ${noOrgToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.members).toEqual([]);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/team', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/team/invite', () => {
		it('creates invitation successfully', async () => {
			mockFirst.mockResolvedValue(null); // no existing user or invite
			mockRun.mockResolvedValue(undefined);

			const res = await app.request('/api/team/invite', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'new@team.com', role: 'tenant_viewer' }),
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.inviteId).toBeDefined();
			expect(json.inviteUrl).toContain('/invite/');
		});

		it('rejects invalid email', async () => {
			const res = await app.request('/api/team/invite', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'not-an-email' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('rejects invalid role', async () => {
			const res = await app.request('/api/team/invite', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'a@b.com', role: 'super_admin' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('rejects duplicate member', async () => {
			mockFirst.mockResolvedValue({ id: 'existing' });
			const res = await app.request('/api/team/invite', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'exists@t.com', role: 'tenant_viewer' }),
			}, mockEnv);
			expect(res.status).toBe(409);
		});
	});

	describe('DELETE /api/team/:userId', () => {
		it('removes a team member', async () => {
			mockRun.mockResolvedValue(undefined);
			const res = await app.request('/api/team/other-user', {
				method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});

		it('prevents self-removal', async () => {
			const res = await app.request('/api/team/u1', {
				method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('PATCH /api/team/:userId/role', () => {
		it('updates role successfully', async () => {
			mockRun.mockResolvedValue(undefined);
			const res = await app.request('/api/team/u2/role', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: 'tenant_operator' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});

		it('rejects invalid role', async () => {
			const res = await app.request('/api/team/u2/role', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: 'god_mode' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('DELETE /api/team/invitations/:inviteId', () => {
		it('revokes invitation', async () => {
			mockRun.mockResolvedValue(undefined);
			const res = await app.request('/api/team/invitations/inv1', {
				method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});
	});
});
