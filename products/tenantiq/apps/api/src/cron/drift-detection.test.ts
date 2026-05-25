import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDriftDetection } from './drift-detection';

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
		organizations: { status: {}, id: {} },
		alerts: { id: {}, tenantId: {}, severity: {}, type: {}, title: {}, description: {}, status: {}, createdAt: {}, updatedAt: {}, source: {} },
	},
}));

vi.mock('../lib/sync-job-tracker', () => ({
	trackSyncJob: vi.fn(async (_db: any, _opts: any, fn: () => Promise<any>) => fn()),
}));

vi.mock('../lib/broadcast', () => ({
	broadcastToTenant: vi.fn(async () => {}),
}));

vi.mock('../lib/snapshots/suppression', () => ({
	loadSuppressionRules: vi.fn(async () => []),
	isPathSuppressed: vi.fn(() => false),
}));

const mockGetManifest = vi.fn();
const mockGetCategory = vi.fn();
vi.mock('../lib/snapshots/capture', () => ({
	getSnapshotManifest: (...args: any[]) => mockGetManifest(...args),
	getSnapshotCategory: (...args: any[]) => mockGetCategory(...args),
}));

vi.mock('../lib/snapshots/diff', () => ({
	diffSnapshots: vi.fn(() => [
		{
			categoryId: 'mfa',
			changes: [{ path: 'mfa.settings', type: 'modified', oldValue: 'a', newValue: 'b' }],
		},
	]),
}));

const mockKVPut = vi.fn();
const mockDBPrepare = vi.fn();
const mockDBBind = vi.fn();
const mockDBAll = vi.fn();

function makeEnv() {
	mockDBPrepare.mockReturnValue({ bind: mockDBBind });
	mockDBBind.mockReturnValue({ all: mockDBAll });
	return {
		DB: { prepare: mockDBPrepare } as any,
		KV: { put: mockKVPut, get: vi.fn() } as any,
		R2: {} as any,
		SCAN_QUEUE: {} as any,
		REMEDIATION_QUEUE: {} as any,
		NOTIFICATION_QUEUE: {} as any,
		JWT_SECRET: 'test',
	} as any;
}

describe('runDriftDetection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		mockKVPut.mockResolvedValue(undefined);
	});

	it('compares snapshots and classifies security drifts as critical', async () => {
		queryResults = [[{ id: 't1', status: 'active', displayName: 'Acme' }]];
		mockDBAll.mockResolvedValue({ results: [{ id: 'snap-2' }, { id: 'snap-1' }] });

		mockGetManifest.mockResolvedValue({ categories: ['mfa'] });
		mockGetCategory.mockResolvedValue({ data: { policies: [] } });

		const env = makeEnv();
		await runDriftDetection(env);

		// Should store drift report in KV
		expect(mockKVPut).toHaveBeenCalled();
		const kvKey = mockKVPut.mock.calls[0][0];
		expect(kvKey).toContain('drift:t1:latest');

		const report = JSON.parse(mockKVPut.mock.calls[0][1]);
		expect(report.totalChanges).toBe(1);
		expect(report.drifts[0].severity).toBe('critical');
	});

	it('creates alerts for critical/high severity drifts', async () => {
		queryResults = [[{ id: 't1', status: 'active', displayName: 'Acme' }]];
		mockDBAll.mockResolvedValue({ results: [{ id: 'snap-2' }, { id: 'snap-1' }] });
		mockGetManifest.mockResolvedValue({ categories: ['mfa'] });
		mockGetCategory.mockResolvedValue({ data: {} });

		const env = makeEnv();
		await runDriftDetection(env);

		// Alert insert via drizzle chain
		expect(mockDbChain.insert).toHaveBeenCalled();
	});

	it('skips tenants with fewer than 2 snapshots', async () => {
		queryResults = [[{ id: 't1', status: 'active', displayName: 'Acme' }]];
		mockDBAll.mockResolvedValue({ results: [{ id: 'snap-1' }] });

		const env = makeEnv();
		await runDriftDetection(env);

		expect(mockKVPut).not.toHaveBeenCalled();
	});

	it('skips when manifests are missing', async () => {
		queryResults = [[{ id: 't1', status: 'active', displayName: 'Acme' }]];
		mockDBAll.mockResolvedValue({ results: [{ id: 'snap-2' }, { id: 'snap-1' }] });
		mockGetManifest.mockResolvedValue(null);

		const env = makeEnv();
		await runDriftDetection(env);

		expect(mockKVPut).not.toHaveBeenCalled();
	});
});
