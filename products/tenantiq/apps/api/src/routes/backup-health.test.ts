import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { backupHealthRoutes } from './backup-health';

// Chainable DB mock
let queryResults: any[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

const kvStore = new Map<string, string>();
const mockKV = {
	get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
	put: vi.fn((key: string, value: string) => { kvStore.set(key, value); return Promise.resolve(); }),
};

const r2Objects: any[] = [];
const mockR2 = {
	list: vi.fn(() => Promise.resolve({ objects: r2Objects })),
} as any;

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockEnv = { DB: {} as any, KV: mockKV as any, R2: mockR2, JWT_SECRET };

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._args: any[]) => ({})),
	desc: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		tenants: { id: {}, displayName: {}, orgId: {}, status: {} },
		organizations: { id: {}, name: {}, status: {} },
	},
}));

vi.mock('../lib/backup', () => ({
	listTenantBackups: vi.fn(() => Promise.resolve(r2Objects.map((o: any) => ({
		backupId: o.key,
		tenantId: 'tenant-1',
		timestamp: o.uploaded.toISOString(),
		type: 'full',
		encryptionAlgorithm: 'AES-256-GCM',
		size: o.size,
		checksumSHA256: '',
		items: {},
	})))),
}));

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return await new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

describe('Backup Health Routes', () => {
	let app: Hono;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		kvStore.clear();
		r2Objects.length = 0;
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/backup-health', backupHealthRoutes);

		authToken = await createTestToken({
			sub: 'user-1',
			email: 'admin@test.com',
			tenantId: 'tenant-1',
			orgId: 'org-1',
			role: 'admin',
		});

		mockKV.get.mockImplementation((key: string) => Promise.resolve(kvStore.get(key) ?? null));
		mockKV.put.mockImplementation((key: string, value: string) => { kvStore.set(key, value); return Promise.resolve(); });
	});

	describe('GET /api/backup-health', () => {
		it('should return critical when no backups exist', async () => {
			const res = await app.request('/api/backup-health', {
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.healthStatus).toBe('critical');
			expect(json.backupCount).toBe(0);
			expect(json.issues).toContain('No backups found');
		});

		it('should return healthy when recent backup exists', async () => {
			const recentTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
			kvStore.set('backup:tenant-1:latest', JSON.stringify({ timestamp: recentTime }));
			r2Objects.push({
				key: 'backups/tenant-1/backup-1.encrypted',
				uploaded: new Date(recentTime),
				size: 1024,
			});

			const res = await app.request('/api/backup-health', {
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.healthStatus).toBe('healthy');
			expect(json.backupCount).toBe(1);
			expect(json.totalSizeBytes).toBe(1024);
		});

		it('should return warning when backup is 48-96h old', async () => {
			const oldTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
			kvStore.set('backup:tenant-1:latest', JSON.stringify({ timestamp: oldTime }));

			const res = await app.request('/api/backup-health', {
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.healthStatus).toBe('warning');
		});

		it('should return critical when backup is >96h old', async () => {
			const veryOld = new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString();
			kvStore.set('backup:tenant-1:latest', JSON.stringify({ timestamp: veryOld }));

			const res = await app.request('/api/backup-health', {
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.healthStatus).toBe('critical');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/backup-health', {}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/backup-health/all', () => {
		it('should return health for all tenants (admin)', async () => {
			queryResults = [[
				{ id: 'tenant-1', displayName: 'Contoso' },
				{ id: 'tenant-2', displayName: 'Fabrikam' },
			]];

			const res = await app.request('/api/backup-health/all', {
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.tenants).toHaveLength(2);
			expect(json.summary).toBeDefined();
			expect(json.summary.total).toBe(2);
		});

		it('should reject viewer role', async () => {
			const viewerToken = await createTestToken({
				sub: 'user-2', email: 'viewer@test.com', tenantId: 'tenant-1', orgId: 'org-1', role: 'viewer',
			});
			const res = await app.request('/api/backup-health/all', {
				headers: { Authorization: `Bearer ${viewerToken}` },
			}, mockEnv);
			expect(res.status).toBe(403);
		});
	});
});
