import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackSyncJob } from './sync-job-tracker';

function createMockDb() {
	const boundValues: unknown[][] = [];
	const mockStatement = {
		bind: vi.fn((...args: unknown[]) => {
			boundValues.push(args);
			return mockStatement;
		}),
		run: vi.fn().mockResolvedValue({ success: true }),
	};
	const mockDb = {
		prepare: vi.fn(() => mockStatement),
	} as unknown as D1Database;
	return { mockDb, mockStatement, boundValues };
}

describe('trackSyncJob', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('inserts a running record and updates to completed on success', async () => {
		const { mockDb, mockStatement, boundValues } = createMockDb();

		const result = await trackSyncJob(
			mockDb,
			{ type: 'user_sync', tenantId: 't1', orgId: 'o1' },
			async () => ({ itemsProcessed: 42, itemsFailed: 3 }),
		);

		expect(result).toEqual({ itemsProcessed: 42, itemsFailed: 3 });
		expect(mockDb.prepare).toHaveBeenCalledTimes(2);

		// First call: INSERT running
		const insertArgs = boundValues[0];
		expect(insertArgs[3]).toBe('user_sync');
		expect(insertArgs[4]).toBe('running');

		// Second call: UPDATE completed
		const updateArgs = boundValues[1];
		expect(updateArgs[0]).toBe('completed');
		expect(updateArgs[2]).toBe(42);
		expect(updateArgs[3]).toBe(3);
	});

	it('updates to failed and re-throws on error', async () => {
		const { mockDb, boundValues } = createMockDb();

		await expect(
			trackSyncJob(
				mockDb,
				{ type: 'security_scan', tenantId: 't2', orgId: 'o2' },
				async () => {
					throw new Error('Graph API timeout');
				},
			),
		).rejects.toThrow('Graph API timeout');

		// Second call: UPDATE failed
		const updateArgs = boundValues[1];
		expect(updateArgs[0]).toBe('failed');
		expect(updateArgs[2]).toBe('Graph API timeout');
	});

	it('handles non-Error throws gracefully', async () => {
		const { mockDb, boundValues } = createMockDb();

		await expect(
			trackSyncJob(
				mockDb,
				{ type: 'backup', tenantId: 't3', orgId: 'o3' },
				async () => {
					throw 'string error';
				},
			),
		).rejects.toBe('string error');

		const updateArgs = boundValues[1];
		expect(updateArgs[0]).toBe('failed');
		expect(updateArgs[2]).toBe('string error');
	});
});
