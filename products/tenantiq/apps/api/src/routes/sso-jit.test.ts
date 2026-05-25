// RED: implementation not yet created
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import from implementation file that does not yet exist — this is intentional RED state
import { jitProvision } from './sso-jit';

const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockDb = { prepare: mockPrepare } as unknown as D1Database;

const orgId = 'org1';
const email = 'user@example.com';

describe('jitProvision — SSO-04: JIT upsert + concurrent race', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns existing user ID when user already exists in platform_users for that org+email', async () => {
		const existingId = 'existing-uuid-123';
		mockFirst.mockResolvedValueOnce({ id: existingId, email, org_id: orgId });

		const result = await jitProvision(mockDb, orgId, email, 'Existing User');

		expect(result).toBe(existingId);
	});

	it('inserts new row and returns new UUID when user does not exist', async () => {
		const newId = 'new-uuid-456';
		// First SELECT returns null (user not found)
		mockFirst.mockResolvedValueOnce(null);
		// INSERT OR IGNORE executes
		mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
		// Second SELECT after insert returns the new user
		mockFirst.mockResolvedValueOnce({ id: newId, email, org_id: orgId });

		const result = await jitProvision(mockDb, orgId, email, 'New User');

		expect(result).toBe(newId);
	});

	it('uses INSERT OR IGNORE — DB.prepare is called with "INSERT OR IGNORE" substring', async () => {
		mockFirst.mockResolvedValueOnce(null);
		mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
		mockFirst.mockResolvedValueOnce({ id: 'some-uuid', email, org_id: orgId });

		await jitProvision(mockDb, orgId, email, 'Test User');

		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		expect(prepareCallSQLs.some((sql) => sql.includes('INSERT OR IGNORE'))).toBe(true);
	});

	it('re-fetches user after insert — two SELECT DB.prepare calls total', async () => {
		mockFirst.mockResolvedValueOnce(null);
		mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
		mockFirst.mockResolvedValueOnce({ id: 'new-uuid', email, org_id: orgId });

		await jitProvision(mockDb, orgId, email, 'Test User');

		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		const selectCalls = prepareCallSQLs.filter((sql) =>
			sql.toUpperCase().includes('SELECT'),
		);
		expect(selectCalls.length).toBeGreaterThanOrEqual(2);
	});

	it('concurrent calls for same email+org return same ID', async () => {
		const sharedId = 'shared-uuid-789';
		// All concurrent calls find the user on the first SELECT (simulating the INSERT OR IGNORE + re-fetch resolving to same row)
		mockFirst.mockResolvedValue({ id: sharedId, email, org_id: orgId });

		const results = await Promise.all(
			Array.from({ length: 5 }, () => jitProvision(mockDb, orgId, email, 'Test User')),
		);

		// All 5 calls must return the same ID
		expect(new Set(results).size).toBe(1);
		expect(results[0]).toBe(sharedId);
	});

	it('sets auth_provider column to "sso" in the INSERT statement', async () => {
		mockFirst.mockResolvedValueOnce(null);
		mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
		mockFirst.mockResolvedValueOnce({ id: 'new-uuid', email, org_id: orgId });

		await jitProvision(mockDb, orgId, email, 'Test User');

		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		const insertSQL = prepareCallSQLs.find((sql) => sql.includes('INSERT'));
		expect(insertSQL).toBeDefined();
		// The INSERT statement must reference auth_provider column
		expect(insertSQL).toContain('auth_provider');

		// Verify the bound value for auth_provider is 'sso'
		const bindCalls: unknown[][] = mockBind.mock.calls;
		const hasSsoValue = bindCalls.some((args) =>
			args.some((arg) => arg === 'sso'),
		);
		expect(hasSsoValue).toBe(true);
	});
});
