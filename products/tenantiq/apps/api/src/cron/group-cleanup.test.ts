import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runGroupCleanup } from './group-cleanup';

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
vi.mock('../lib/db', () => ({ getDb: () => mockDbChain }));

vi.mock('@tenantiq/db', () => ({
	getAllActiveTenants: vi.fn(async () => [
		{ id: 't1', displayName: 'Acme', azureTenantId: 'az-1', organizationId: 'org-1' },
	]),
}));

const mockPaginate = vi.fn();
vi.mock('./user-sync', () => ({
	createGraphClient: vi.fn(() => ({ paginate: mockPaginate })),
}));

const mockKVPut = vi.fn();
const mockDBPrepare = vi.fn();
const mockDBBind = vi.fn();
const mockDBRun = vi.fn();

function makeEnv() {
	mockDBPrepare.mockReturnValue({ bind: mockDBBind });
	mockDBBind.mockReturnValue({ run: mockDBRun });
	mockDBRun.mockResolvedValue({});
	return {
		DB: { prepare: mockDBPrepare } as any,
		KV: { put: mockKVPut, get: vi.fn() } as any,
		R2: {} as any, SCAN_QUEUE: {} as any,
		REMEDIATION_QUEUE: {} as any, NOTIFICATION_QUEUE: {} as any,
		JWT_SECRET: 'test',
	} as any;
}

function asyncGen<T>(batches: T[][]) {
	return (async function* () { for (const b of batches) yield b; })();
}

describe('runGroupCleanup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		mockKVPut.mockResolvedValue(undefined);
	});

	it('identifies empty groups (no members)', async () => {
		mockPaginate.mockImplementation((_az: string, url: string) => {
			if (url.includes('/groups?')) {
				return asyncGen([[{
					id: 'g1', displayName: 'EmptyGroup', mail: null,
					groupTypes: [], renewedDateTime: new Date().toISOString(),
				}]]);
			}
			// members and owners both empty
			return asyncGen([[]]);
		});

		const env = makeEnv();
		await runGroupCleanup(env);

		expect(mockKVPut).toHaveBeenCalledTimes(1);
		const stored = JSON.parse(mockKVPut.mock.calls[0][1]);
		expect(stored.empty).toBe(1);
		expect(stored.groups[0].status).toBe('empty');
	});

	it('identifies orphaned groups (no owners)', async () => {
		let callCount = 0;
		mockPaginate.mockImplementation((_az: string, url: string) => {
			if (url.includes('/groups?')) {
				return asyncGen([[{
					id: 'g1', displayName: 'Orphaned', mail: null,
					groupTypes: ['Unified'], renewedDateTime: new Date().toISOString(),
				}]]);
			}
			callCount++;
			// members call returns 1, owners call returns 0
			if (callCount % 2 === 1) return asyncGen([[{ id: 'm1' }]]);
			return asyncGen([[]]);
		});

		const env = makeEnv();
		await runGroupCleanup(env);

		const stored = JSON.parse(mockKVPut.mock.calls[0][1]);
		expect(stored.orphaned).toBe(1);
	});

	it('identifies inactive groups (>90 days)', async () => {
		const oldDate = new Date(Date.now() - 100 * 86_400_000).toISOString();
		mockPaginate.mockImplementation((_az: string, url: string) => {
			if (url.includes('/groups?')) {
				return asyncGen([[{
					id: 'g1', displayName: 'InactiveGroup', mail: null,
					groupTypes: [], renewedDateTime: oldDate,
				}]]);
			}
			// has members and owners
			return asyncGen([[{ id: 'x1' }]]);
		});

		const env = makeEnv();
		await runGroupCleanup(env);

		const stored = JSON.parse(mockKVPut.mock.calls[0][1]);
		expect(stored.inactive).toBe(1);
	});

	it('creates alerts when cleanup-worthy groups found', async () => {
		mockPaginate.mockImplementation((_az: string, url: string) => {
			if (url.includes('/groups?')) {
				return asyncGen([[{
					id: 'g1', displayName: 'Empty', mail: null,
					groupTypes: [], renewedDateTime: null,
				}]]);
			}
			return asyncGen([[]]);
		});

		const env = makeEnv();
		await runGroupCleanup(env);

		expect(mockDBPrepare).toHaveBeenCalled();
		const sql = mockDBPrepare.mock.calls[0]?.[0] ?? '';
		expect(sql).toContain('INSERT');
	});
});
