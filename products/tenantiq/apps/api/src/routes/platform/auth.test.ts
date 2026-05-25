import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import authRoutes from './auth';

let queryResults: any[] = [];

const mockDbChain: any = {};
for (const method of ['select', 'from', 'where', 'limit', 'update', 'set']) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: (value: any) => unknown) => resolve(queryResults.shift() ?? []);
	},
	configurable: true,
});

const mockGenerateToken = vi.fn(async () => 'jwt-token');
const mockVerifyPassword = vi.fn(async () => true);
const mockVerifyToken = vi.fn(async () => ({ sub: 'user-1' }));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
}));

vi.mock('../../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		platformUsers: { id: {}, email: {} },
		organizations: { id: {} },
	},
}));

vi.mock('../../lib/auth', () => ({
	generateToken: (...args: unknown[]) => mockGenerateToken(...args),
	verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
	verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

describe('Platform Auth Routes', () => {
	let app: Hono<AppEnv>;
	const env = {
		JWT_SECRET: 'test-secret',
		ENVIRONMENT: 'test',
		KV: {} as KVNamespace,
		R2: {} as R2Bucket,
		SCAN_QUEUE: {} as Queue,
		REMEDIATION_QUEUE: {} as Queue,
		NOTIFICATION_QUEUE: {} as Queue,
		TENANT_EVENTS: {} as DurableObjectNamespace,
		DB: {} as D1Database,
	} as AppEnv['Bindings'];

	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/platform/auth', authRoutes);
	});

	it('logs in an active user and returns org summary', async () => {
		queryResults = [
			[
				{
					id: 'user-1',
					email: 'admin@tenant.test',
					name: 'Admin User',
					status: 'active',
					passwordHash: 'hash',
					role: 'tenant_admin',
					organizationId: 'org-1',
					emailVerified: 1,
				},
			],
			[],
			[
				{
					id: 'org-1',
					name: 'Acme',
					slug: 'acme',
					subscriptionTier: 'professional',
					subscriptionStatus: 'active',
				},
			],
		];

		const res = await app.request(
			'/platform/auth/login',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'admin@tenant.test', password: 'password123' }),
			},
			env
		);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.token).toBe('jwt-token');
		expect(json.user.email).toBe('admin@tenant.test');
		expect(json.organization).toMatchObject({ id: 'org-1', slug: 'acme' });
		expect(mockVerifyPassword).toHaveBeenCalledWith('password123', 'hash');
		expect(mockGenerateToken).toHaveBeenCalled();
	});

	it('rejects invalid credentials', async () => {
		queryResults = [
			[
				{
					id: 'user-1',
					email: 'admin@tenant.test',
					name: 'Admin User',
					status: 'active',
					passwordHash: 'hash',
					role: 'tenant_admin',
					organizationId: 'org-1',
					emailVerified: 1,
				},
			],
		];
		mockVerifyPassword.mockResolvedValueOnce(false);

		const res = await app.request(
			'/platform/auth/login',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'admin@tenant.test', password: 'badpass99' }),
			},
			env
		);

		expect(res.status).toBe(401);
		expect(mockGenerateToken).not.toHaveBeenCalled();
	});

	it('verifies a valid bearer token', async () => {
		queryResults = [[{ id: 'user-1', email: 'a@test.com', name: 'A', role: 'tenant_admin', organizationId: 'org-1', status: 'active' }]];

		const res = await app.request(
			'/platform/auth/verify',
			{ method: 'POST', headers: { Authorization: 'Bearer token-1' } },
			env
		);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.valid).toBe(true);
		expect(json.user.id).toBe('user-1');
		expect(mockVerifyToken).toHaveBeenCalledWith('token-1', 'test-secret');
	});

	it('returns 401 on missing authorization header', async () => {
		const res = await app.request('/platform/auth/verify', { method: 'POST' }, env);
		expect(res.status).toBe(401);
	});
});
