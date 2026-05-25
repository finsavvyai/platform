import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { governanceRoutes } from './governance';

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn().mockImplementation(() => ({
		fetch: vi.fn().mockResolvedValue({ value: [] }),
	})),
}));

vi.mock('../lib/governance/workspace-sync', () => ({
	syncWorkspaces: vi.fn().mockResolvedValue({ count: 5, errors: [] }),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = {
	DB: { prepare: mockPrepare } as any,
	KV: mockKV as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Governance Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/governance', governanceRoutes);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	describe('GET /api/governance/workspaces', () => {
		it('returns workspace list with summary', async () => {
			mockAll.mockResolvedValue({ results: [{ id: 'ws1', name: 'Marketing' }] });
			mockFirst.mockResolvedValue({ total: 10, teams: 5, with_guests: 2, no_owner: 1, total_storage: 1024 });

			const res = await app.request('/api/governance/workspaces', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.workspaces).toHaveLength(1);
			expect(json.summary.total).toBe(10);
		});

		it('returns empty when no tenant', async () => {
			const noTenantToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin',
			});
			const res = await app.request('/api/governance/workspaces', {
				method: 'GET', headers: { Authorization: `Bearer ${noTenantToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.workspaces).toEqual([]);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/governance/workspaces', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/governance/workspaces/:id', () => {
		it('returns workspace detail', async () => {
			mockFirst.mockResolvedValue({ id: 'ws1', name: 'Engineering', tenant_id: 't1' });

			const res = await app.request('/api/governance/workspaces/ws1', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.workspace.id).toBe('ws1');
		});

		it('returns 404 for unknown workspace', async () => {
			mockFirst.mockResolvedValue(null);

			const res = await app.request('/api/governance/workspaces/unknown', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(404);
		});
	});

	describe('POST /api/governance/sync', () => {
		it('returns 400 when no tenant', async () => {
			const noTenantToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin',
			});
			const res = await app.request('/api/governance/sync', {
				method: 'POST', headers: { Authorization: `Bearer ${noTenantToken}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('returns 404 when tenant missing azure id', async () => {
			mockFirst.mockResolvedValue(null);
			const res = await app.request('/api/governance/sync', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('returns 403 when no Graph token', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'az1' });
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/governance/sync', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/governance/sync', {
				method: 'POST',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
