import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { backupDataRoutes } from './backup-data';

let queryResults: any[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockEnv = { DB: {} as any, KV: {} as any, R2: {} as any, JWT_SECRET } as any;

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._args: any[]) => ({})),
	desc: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		backupJobs: {
			id: {}, orgId: {}, tenantId: {}, type: {}, status: {},
			itemsCount: {}, sizeBytes: {}, startedAt: {}, completedAt: {},
			error: {}, createdAt: {},
		},
	},
}));

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Backup Data Routes', () => {
	let app: Hono;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/backups', backupDataRoutes);
		token = await createToken({
			sub: 'user-1', email: 'admin@test.com', orgId: 'org-1',
			tenantIds: ['tenant-1'], role: 'admin',
		});
	});

	describe('POST /api/backups/start', () => {
		it('should start a backup job', async () => {
			queryResults = [[]];
			const res = await app.request('/api/backups/start', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'exchange' }),
			}, mockEnv);
			expect(res.status).toBe(201);
			const json: any = await res.json();
			expect(json.job).toBeDefined();
			expect(json.job.type).toBe('exchange');
			expect(json.job.status).toBe('pending');
		});

		it('should reject invalid type', async () => {
			const res = await app.request('/api/backups/start', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'invalid' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/backups/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'exchange' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/backups/jobs', () => {
		it('should list backup jobs', async () => {
			queryResults = [[
				{ id: 'bkp_1', orgId: 'org-1', tenantId: 'tenant-1', type: 'exchange', status: 'completed', itemsCount: 50, sizeBytes: 1024, startedAt: Date.now(), completedAt: Date.now(), error: null, createdAt: Date.now() },
			]];
			const res = await app.request('/api/backups/jobs', {
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.jobs).toBeDefined();
		});
	});

	describe('GET /api/backups/jobs/:id', () => {
		it('should return a single job', async () => {
			queryResults = [[
				{ id: 'bkp_1', orgId: 'org-1', tenantId: 'tenant-1', type: 'sharepoint', status: 'running', itemsCount: 0, sizeBytes: 0, startedAt: Date.now(), completedAt: null, error: null, createdAt: Date.now() },
			]];
			const res = await app.request('/api/backups/jobs/bkp_1', {
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.job.type).toBe('sharepoint');
		});

		it('should return 404 for unknown job', async () => {
			queryResults = [[]];
			const res = await app.request('/api/backups/jobs/unknown', {
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('POST /api/backups/restore', () => {
		it('should queue restore for completed job', async () => {
			queryResults = [[
				{ id: 'bkp_1', orgId: 'org-1', tenantId: 'tenant-1', type: 'teams', status: 'completed', itemsCount: 10, sizeBytes: 512, startedAt: Date.now(), completedAt: Date.now(), error: null, createdAt: Date.now() },
			]];
			const res = await app.request('/api/backups/restore', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ jobId: 'bkp_1', items: ['item-1'], destination: 'original' }),
			}, mockEnv);
			expect(res.status).toBe(202);
		});

		it('should reject restore of non-completed job', async () => {
			queryResults = [[
				{ id: 'bkp_2', orgId: 'org-1', tenantId: 'tenant-1', type: 'exchange', status: 'running', itemsCount: 0, sizeBytes: 0, startedAt: Date.now(), completedAt: null, error: null, createdAt: Date.now() },
			]];
			const res = await app.request('/api/backups/restore', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ jobId: 'bkp_2', items: ['item-1'], destination: 'original' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('GET /api/backups/storage', () => {
		it('should return storage usage', async () => {
			queryResults = [[
				{ type: 'exchange', sizeBytes: 1024, status: 'completed' },
				{ type: 'sharepoint', sizeBytes: 2048, status: 'completed' },
			]];
			const res = await app.request('/api/backups/storage', {
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.usage).toBeDefined();
			expect(json.usage.totalJobs).toBe(2);
		});
	});
});
