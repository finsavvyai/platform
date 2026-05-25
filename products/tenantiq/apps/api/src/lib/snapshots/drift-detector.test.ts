import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./capture', () => ({
	getSnapshotCategory: vi.fn(),
}));

vi.mock('./diff', () => ({
	diffSnapshots: vi.fn(),
}));

import { detectDrift } from './drift-detector';
import { getSnapshotCategory } from './capture';
import { diffSnapshots } from './diff';
import type { SnapshotManifest } from './capture';

describe('Drift Detector', () => {
	const mockKV = { put: vi.fn().mockResolvedValue(undefined) } as any;
	const mockRun = vi.fn().mockResolvedValue({ success: true });
	const mockBind = vi.fn((..._args: any[]) => ({ run: mockRun }));
	const mockPrepare = vi.fn(() => ({ bind: mockBind }));
	const mockDB = { prepare: mockPrepare } as any;

	const newManifest: SnapshotManifest = {
		id: 'snap-new',
		tenantId: 't1',
		label: 'New',
		snapshotType: 'manual',
		categories: ['conditional_access', 'auth_methods'],
		objectCount: 5,
		errors: [],
		createdBy: 'u1',
		createdAt: '2026-03-15T10:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockRun.mockResolvedValue({ success: true });
	});

	it('returns zero drifts when no previous snapshot', async () => {
		const result = await detectDrift(mockKV, mockDB, 't1', newManifest, null);
		expect(result.driftsDetected).toBe(0);
		expect(result.categories).toEqual([]);
		expect(result.alertsCreated).toBe(0);
	});

	it('returns zero drifts when no changes detected', async () => {
		(getSnapshotCategory as any).mockResolvedValue({ data: { key: 'val' } });
		(diffSnapshots as any).mockReturnValue([]);

		const result = await detectDrift(mockKV, mockDB, 't1', newManifest, 'snap-old');
		expect(result.driftsDetected).toBe(0);
	});

	it('detects drifts and creates DB records', async () => {
		(getSnapshotCategory as any).mockResolvedValue({ data: { key: 'val' } });
		(diffSnapshots as any).mockReturnValue([
			{
				categoryId: 'conditional_access',
				name: 'conditional_access',
				changes: [{ path: 'policy.enabled', type: 'changed', oldValue: true, newValue: false }],
				changeCount: 1,
			},
		]);

		const result = await detectDrift(mockKV, mockDB, 't1', newManifest, 'snap-old');
		expect(result.driftsDetected).toBe(1);
		expect(result.alertsCreated).toBe(1);
		expect(mockPrepare).toHaveBeenCalled();
		expect(mockKV.put).toHaveBeenCalled();
		// Alert INSERT must include snapshotId and baselineId in metadata
		// Bind order: id, tenant_id, type, severity, title, description, status, source, metadata, created_at, updated_at
		const allCalls = mockBind.mock.calls;
		const alertInsertCall = allCalls.find((args) =>
			args[2] === 'config_drift' && typeof args[8] === 'string' && args[8].includes('snapshotId')
		);
		expect(alertInsertCall).toBeDefined();
		expect(alertInsertCall![8]).toContain('"snapshotId":"snap-new"');
		expect(alertInsertCall![8]).toContain('"baselineId":"snap-old"');
	});

	it('creates alerts for each changed category', async () => {
		(getSnapshotCategory as any).mockResolvedValue({ data: {} });
		(diffSnapshots as any).mockReturnValue([
			{ categoryId: 'conditional_access', name: 'conditional_access', changes: [{ path: 'a', type: 'changed' }], changeCount: 1 },
			{ categoryId: 'auth_methods', name: 'auth_methods', changes: [{ path: 'b', type: 'added' }], changeCount: 1 },
		]);

		const result = await detectDrift(mockKV, mockDB, 't1', newManifest, 'snap-old');
		expect(result.driftsDetected).toBe(2);
		expect(result.alertsCreated).toBe(2);
	});

	it('skips categories with zero changes', async () => {
		(getSnapshotCategory as any).mockResolvedValue({ data: {} });
		(diffSnapshots as any).mockReturnValue([
			{ categoryId: 'conditional_access', name: 'ca', changes: [{ path: 'a', type: 'changed' }], changeCount: 1 },
			{ categoryId: 'auth_methods', name: 'am', changes: [], changeCount: 0 },
		]);

		const result = await detectDrift(mockKV, mockDB, 't1', newManifest, 'snap-old');
		expect(result.alertsCreated).toBe(1);
	});

	it('stores latest drift result in KV', async () => {
		(getSnapshotCategory as any).mockResolvedValue({ data: {} });
		(diffSnapshots as any).mockReturnValue([
			{ categoryId: 'conditional_access', name: 'ca', changes: [{ path: 'x', type: 'changed' }], changeCount: 1 },
		]);

		await detectDrift(mockKV, mockDB, 't1', newManifest, 'snap-old');
		expect(mockKV.put).toHaveBeenCalledWith(
			'drift:t1:latest',
			expect.any(String),
			{ expirationTtl: 86400 },
		);
	});

	it('handles DB errors gracefully via catch', async () => {
		(getSnapshotCategory as any).mockResolvedValue({ data: {} });
		(diffSnapshots as any).mockReturnValue([
			{ categoryId: 'conditional_access', name: 'ca', changes: [{ path: 'x', type: 'changed' }], changeCount: 1 },
		]);
		mockRun.mockRejectedValue(new Error('DB error'));

		// Should not throw — drift-detector uses .catch()
		const result = await detectDrift(mockKV, mockDB, 't1', newManifest, 'snap-old');
		expect(result.driftsDetected).toBe(1);
	});
});
