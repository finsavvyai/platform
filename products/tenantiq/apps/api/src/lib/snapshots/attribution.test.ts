import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	attributeDrifts,
	persistAttributions,
	runAttribution,
	type DriftRow,
} from './attribution';
import type { DirectoryAuditEntry } from '../audit/m365-audit-fetcher';

const drift = (id: string, category: string, detectedAt: string): DriftRow => ({
	id, category, detectedAt,
});

const audit = (
	id: string,
	at: string,
	category = 'Policy',
	upn = 'admin@x.com',
): DirectoryAuditEntry => ({
	id,
	activityDateTime: at,
	activityDisplayName: 'Update policy',
	category,
	result: 'success',
	initiatedBy: { user: { userPrincipalName: upn } },
	targetResources: [],
});

describe('attributeDrifts — basic matching', () => {
	it('matches a drift to an audit within ±5min window', () => {
		const drifts = [drift('d1', 'conditional_access', '2026-04-27T12:00:00Z')];
		const audits = [audit('a1', '2026-04-27T11:58:00Z')];
		const r = attributeDrifts(drifts, audits);
		expect(r).toEqual([{
			driftId: 'd1', auditId: 'a1', actor: 'admin@x.com',
			activityDateTime: '2026-04-27T11:58:00Z',
		}]);
	});

	it('skips audits outside the window', () => {
		const drifts = [drift('d1', 'conditional_access', '2026-04-27T12:00:00Z')];
		const audits = [audit('a1', '2026-04-27T11:50:00Z')];
		expect(attributeDrifts(drifts, audits)).toEqual([]);
	});

	it('picks closest match when multiple in window', () => {
		const drifts = [drift('d1', 'conditional_access', '2026-04-27T12:00:00Z')];
		const audits = [
			audit('a1', '2026-04-27T11:57:00Z'),
			audit('a2', '2026-04-27T11:59:30Z'),
			audit('a3', '2026-04-27T12:02:00Z'),
		];
		const r = attributeDrifts(drifts, audits);
		expect(r[0].auditId).toBe('a2'); // 30s away vs 3min and 2min
	});
});

describe('attributeDrifts — category bucketing', () => {
	it('only matches conditional_access drift to Policy audits', () => {
		const drifts = [drift('d1', 'conditional_access', '2026-04-27T12:00:00Z')];
		const audits = [
			audit('wrong-bucket', '2026-04-27T12:00:00Z', 'UserManagement'),
			audit('right-bucket', '2026-04-27T12:01:00Z', 'Policy'),
		];
		const r = attributeDrifts(drifts, audits);
		expect(r[0].auditId).toBe('right-bucket');
	});

	it('falls back to ANY category for unknown drift category', () => {
		const drifts = [drift('d1', 'never-seen-category', '2026-04-27T12:00:00Z')];
		const audits = [audit('a1', '2026-04-27T11:59:00Z', 'WhateverCategory')];
		const r = attributeDrifts(drifts, audits);
		expect(r).toHaveLength(1);
	});
});

describe('attributeDrifts — edge cases', () => {
	it('returns empty for empty inputs', () => {
		expect(attributeDrifts([], [])).toEqual([]);
		expect(attributeDrifts([drift('d1', 'x', '2026-04-27T12:00:00Z')], [])).toEqual([]);
	});

	it('skips drifts with invalid detectedAt', () => {
		const drifts = [drift('d1', 'conditional_access', 'not-a-date')];
		const audits = [audit('a1', '2026-04-27T12:00:00Z')];
		expect(attributeDrifts(drifts, audits)).toEqual([]);
	});

	it('skips audits with invalid activityDateTime', () => {
		const drifts = [drift('d1', 'conditional_access', '2026-04-27T12:00:00Z')];
		const audits = [audit('a1', 'not-iso', 'Policy')];
		expect(attributeDrifts(drifts, audits)).toEqual([]);
	});

	it('respects custom window', () => {
		const drifts = [drift('d1', 'conditional_access', '2026-04-27T12:00:00Z')];
		const audits = [audit('a1', '2026-04-27T11:50:00Z')]; // 10min away
		expect(attributeDrifts(drifts, audits, 15 * 60 * 1000)).toHaveLength(1);
		expect(attributeDrifts(drifts, audits, 5 * 60 * 1000)).toHaveLength(0);
	});
});

describe('persistAttributions', () => {
	const mockRun = vi.fn();
	const mockBind = vi.fn(() => ({ run: mockRun }));
	const mockPrepare = vi.fn(() => ({ bind: mockBind }));
	const mockDb = { prepare: mockPrepare } as unknown as D1Database;

	beforeEach(() => {
		mockRun.mockReset().mockResolvedValue({ success: true, meta: { changes: 1 } });
		mockBind.mockClear();
		mockPrepare.mockClear();
	});

	it('returns 0 immediately for empty matches', async () => {
		expect(await persistAttributions(mockDb, [])).toBe(0);
		expect(mockPrepare).not.toHaveBeenCalled();
	});

	it('UPDATEs each match and counts persisted rows', async () => {
		const r = await persistAttributions(mockDb, [
			{ driftId: 'd1', auditId: 'a1', actor: 'a@x.com', activityDateTime: '2026-04-27T12:00:00Z' },
			{ driftId: 'd2', auditId: 'a2', actor: 'b@x.com', activityDateTime: '2026-04-27T12:01:00Z' },
		]);
		expect(r).toBe(2);
		expect(mockBind).toHaveBeenCalledTimes(2);
	});

	it('counts only successful UPDATEs', async () => {
		mockRun
			.mockResolvedValueOnce({ success: true, meta: { changes: 1 } })
			.mockResolvedValueOnce({ success: true, meta: { changes: 0 } });
		const r = await persistAttributions(mockDb, [
			{ driftId: 'd1', auditId: 'a1', actor: 'a@x.com', activityDateTime: 'x' },
			{ driftId: 'd2', auditId: 'a2', actor: 'b@x.com', activityDateTime: 'y' },
		]);
		expect(r).toBe(1);
	});
});

describe('runAttribution', () => {
	const mockAll = vi.fn();
	const mockRun = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
	const mockBind = vi.fn(() => ({ all: mockAll, run: mockRun }));
	const mockPrepare = vi.fn(() => ({ bind: mockBind }));
	const mockDb = { prepare: mockPrepare } as unknown as D1Database;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
	});

	it('returns zero counts when no unattributed drifts', async () => {
		mockAll.mockResolvedValueOnce({ results: [] });
		const fetcher = vi.fn();
		const r = await runAttribution(mockDb, fetcher, 't1', new Date('2026-04-27T00:00:00Z'));
		expect(r).toEqual({ unattributed: 0, matched: 0, persisted: 0 });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('matches and persists when audits + drifts overlap', async () => {
		mockAll.mockResolvedValueOnce({
			results: [{ id: 'd1', category: 'conditional_access', detectedAt: '2026-04-27T12:00:00Z' }],
		});
		const fetcher = vi.fn().mockResolvedValueOnce({
			value: [audit('a1', '2026-04-27T11:59:00Z')],
		});
		const r = await runAttribution(mockDb, fetcher, 't1', new Date('2026-04-27T00:00:00Z'));
		expect(r).toEqual({ unattributed: 1, matched: 1, persisted: 1 });
	});

	it('survives Graph fetch failure (returns 0 matched)', async () => {
		mockAll.mockResolvedValueOnce({
			results: [{ id: 'd1', category: 'conditional_access', detectedAt: '2026-04-27T12:00:00Z' }],
		});
		const fetcher = vi.fn().mockRejectedValueOnce(new Error('graph 500'));
		const r = await runAttribution(mockDb, fetcher, 't1', new Date('2026-04-27T00:00:00Z'));
		expect(r.matched).toBe(0);
		expect(r.persisted).toBe(0);
	});
});
