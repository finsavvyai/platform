import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runGuestReview } from './guest-review';

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
	createGraphClient: vi.fn(() => ({
		paginate: mockPaginate,
	})),
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
		R2: {} as any,
		SCAN_QUEUE: {} as any,
		REMEDIATION_QUEUE: {} as any,
		NOTIFICATION_QUEUE: {} as any,
		JWT_SECRET: 'test',
	} as any;
}

function asyncGen<T>(batches: T[][]) {
	return (async function* () { for (const b of batches) yield b; })();
}

describe('runGuestReview', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		mockKVPut.mockResolvedValue(undefined);
	});

	it('classifies stale guests and stores results in KV', async () => {
		const staleDate = new Date(Date.now() - 100 * 86_400_000).toISOString();

		// paginate for guest users
		mockPaginate.mockImplementation((azId: string, url: string) => {
			if (url.includes('userType')) {
				return asyncGen([[{
					id: 'g1', displayName: 'Guest1', mail: 'g@ext.com',
					userPrincipalName: 'g1#EXT#@acme.com',
					signInActivity: { lastSignInDateTime: staleDate },
				}]]);
			}
			// memberOf for group count
			return asyncGen([[{ id: 'grp1' }]]);
		});

		const env = makeEnv();
		await runGuestReview(env);

		expect(mockKVPut).toHaveBeenCalledTimes(1);
		const kvKey = mockKVPut.mock.calls[0][0];
		expect(kvKey).toBe('guest-review:t1');
		const stored = JSON.parse(mockKVPut.mock.calls[0][1]);
		expect(stored.total).toBe(1);
		expect(stored.stale).toBe(1);
		expect(stored.guests[0].status).toBe('stale');
	});

	it('classifies orphaned guests with zero groups', async () => {
		mockPaginate.mockImplementation((_az: string, url: string) => {
			if (url.includes('userType')) {
				return asyncGen([[{
					id: 'g2', displayName: 'Orphan', mail: null,
					userPrincipalName: 'g2#EXT#@acme.com',
					signInActivity: { lastSignInDateTime: new Date().toISOString() },
				}]]);
			}
			return asyncGen([[]]); // no groups
		});

		const env = makeEnv();
		await runGuestReview(env);

		const stored = JSON.parse(mockKVPut.mock.calls[0][1]);
		expect(stored.orphaned).toBe(1);
		expect(stored.guests[0].status).toBe('orphaned');
	});

	it('classifies remove_candidate for guests >180 days inactive', async () => {
		const oldDate = new Date(Date.now() - 200 * 86_400_000).toISOString();
		mockPaginate.mockImplementation((_az: string, url: string) => {
			if (url.includes('userType')) {
				return asyncGen([[{
					id: 'g3', displayName: 'OldGuest', mail: 'old@ext.com',
					userPrincipalName: 'g3#EXT#@acme.com',
					signInActivity: { lastSignInDateTime: oldDate },
				}]]);
			}
			return asyncGen([[{ id: 'grp1' }]]);
		});

		const env = makeEnv();
		await runGuestReview(env);

		const stored = JSON.parse(mockKVPut.mock.calls[0][1]);
		expect(stored.removeCandidates).toBe(1);
		expect(stored.guests[0].status).toBe('remove_candidate');
	});

	it('creates alerts when problematic guests found', async () => {
		const staleDate = new Date(Date.now() - 100 * 86_400_000).toISOString();
		mockPaginate.mockImplementation((_az: string, url: string) => {
			if (url.includes('userType')) {
				return asyncGen([[{
					id: 'g1', displayName: 'Guest1', mail: 'g@ext.com',
					userPrincipalName: 'g1#EXT#@acme.com',
					signInActivity: { lastSignInDateTime: staleDate },
				}]]);
			}
			return asyncGen([[{ id: 'grp1' }]]);
		});

		const env = makeEnv();
		await runGuestReview(env);

		expect(mockDBPrepare).toHaveBeenCalled();
		const sql = mockDBPrepare.mock.calls[0]?.[0] ?? '';
		expect(sql).toContain('INSERT');
	});
});
