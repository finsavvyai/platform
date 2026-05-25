import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runNightlyBackup } from './nightly-backup';

let queryResults: unknown[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})) }));
vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		tenants: { status: {}, id: {} },
		organizations: { status: {}, id: {}, name: {}, azureTenantId: {} },
		platformUsers: { organizationId: {}, id: {}, email: {}, name: {}, status: {} },
		usersCache: { tenantId: {} },
		alerts: { tenantId: {}, id: {}, severity: {}, type: {}, title: {}, description: {}, status: {}, createdAt: {}, updatedAt: {}, source: {} },
	},
}));

vi.mock('../lib/sync-job-tracker', () => ({
	trackSyncJob: vi.fn(async (_db: any, _opts: any, fn: () => Promise<any>) => fn()),
}));

const mockCreateBackup = vi.fn(async () => ({
	backupId: 'bk-1', tenantId: 't1', timestamp: new Date().toISOString(), size: 1234,
}));
const mockCleanup = vi.fn(async () => {});
vi.mock('../lib/backup', () => ({
	createTenantBackup: (...args: any[]) => mockCreateBackup(...args),
	cleanupOldBackups: (...args: any[]) => mockCleanup(...args),
	listTenantBackups: vi.fn(async () => []),
}));

const mockKVPut = vi.fn();
const mockKVGet = vi.fn();

function makeEnv() {
	return {
		DB: {} as any,
		KV: { put: mockKVPut, get: mockKVGet } as any,
		R2: {} as any,
		SCAN_QUEUE: {} as any,
		REMEDIATION_QUEUE: {} as any,
		NOTIFICATION_QUEUE: {} as any,
		JWT_SECRET: 'test',
	} as any;
}

const tenant = {
	id: 't1', name: 'Acme', displayName: 'Acme', azureTenantId: 'az-1', status: 'active',
};

describe('runNightlyBackup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		mockKVPut.mockResolvedValue(undefined);
		mockKVGet.mockResolvedValue(null);
	});

	it('backs up active tenants and stores metadata in KV', async () => {
		// tenants query, users query, alerts query
		queryResults = [[tenant], [], []];

		const env = makeEnv();
		await runNightlyBackup(env);

		expect(mockCreateBackup).toHaveBeenCalledTimes(1);
		expect(mockKVPut).toHaveBeenCalled();
		const latestKey = mockKVPut.mock.calls.find((c: any) => c[0].includes('latest'));
		expect(latestKey).toBeDefined();
	});

	it('runs cleanup for old backups', async () => {
		queryResults = [[tenant], [], []];

		const env = makeEnv();
		await runNightlyBackup(env);

		expect(mockCleanup).toHaveBeenCalledTimes(1);
	});

	it('detects drift when user count changes significantly', async () => {
		const previousSnapshot = JSON.stringify({ userCount: 10, licenseCount: 5, alertCount: 2 });
		mockKVGet.mockImplementation((key: string) => {
			if (key.includes('backup-snapshot')) return Promise.resolve(previousSnapshot);
			return Promise.resolve(null);
		});

		// tenant, 20 users (delta > threshold), alerts
		const manyUsers = Array.from({ length: 20 }, (_, i) => ({
			azureUserId: `u${i}`, email: `u${i}@acme.com`, displayName: `User ${i}`,
			jobTitle: null, department: null, accountEnabled: true, tenantId: 't1',
		}));
		queryResults = [[tenant], manyUsers, []];

		const env = makeEnv();
		await runNightlyBackup(env);

		// Should have inserted a drift alert
		expect(mockDbChain.insert).toHaveBeenCalled();
	});

	it('handles errors gracefully per-tenant', async () => {
		mockCreateBackup.mockRejectedValueOnce(new Error('R2 error'));
		queryResults = [[tenant], [], []];

		const env = makeEnv();
		// Should not throw
		await expect(runNightlyBackup(env)).resolves.toBeUndefined();
	});
});
