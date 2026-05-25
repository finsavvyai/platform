import { describe, expect, it, vi } from 'vitest';
import {
	fetchDirectoryAudits,
	actorFor,
	type DirectoryAuditEntry,
} from './m365-audit-fetcher';

function entry(overrides: Partial<DirectoryAuditEntry> = {}): DirectoryAuditEntry {
	return {
		id: 'a1',
		activityDateTime: '2026-04-27T12:00:00Z',
		activityDisplayName: 'Update conditional access policy',
		category: 'Policy',
		result: 'success',
		initiatedBy: { user: { userPrincipalName: 'admin@x.com' } },
		targetResources: [],
		...overrides,
	};
}

describe('fetchDirectoryAudits', () => {
	it('throws on invalid since', async () => {
		const fetcher = vi.fn();
		await expect(fetchDirectoryAudits(fetcher, new Date('not-a-date'))).rejects.toThrow(TypeError);
	});

	it('throws when since > until', async () => {
		const fetcher = vi.fn();
		const since = new Date('2026-04-27T00:00:00Z');
		const until = new Date('2026-04-26T00:00:00Z');
		await expect(fetchDirectoryAudits(fetcher, since, until)).rejects.toThrow(RangeError);
	});

	it('returns single page when no nextLink', async () => {
		const fetcher = vi.fn().mockResolvedValueOnce({ value: [entry({ id: 'a1' })] });
		const r = await fetchDirectoryAudits(fetcher, new Date('2026-04-27T00:00:00Z'));
		expect(r).toHaveLength(1);
		expect(r[0].id).toBe('a1');
	});

	it('paginates via @odata.nextLink', async () => {
		const fetcher = vi.fn()
			.mockResolvedValueOnce({
				value: [entry({ id: 'a1' })],
				'@odata.nextLink': 'https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$skiptoken=abc',
			})
			.mockResolvedValueOnce({ value: [entry({ id: 'a2' })] });
		const r = await fetchDirectoryAudits(fetcher, new Date('2026-04-27T00:00:00Z'));
		expect(r.map((e) => e.id)).toEqual(['a1', 'a2']);
	});

	it('caps at MAX_PAGES to avoid runaway iteration', async () => {
		const fetcher = vi.fn().mockResolvedValue({
			value: [entry()],
			'@odata.nextLink': 'https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$skiptoken=loop',
		});
		const r = await fetchDirectoryAudits(fetcher, new Date('2026-04-27T00:00:00Z'));
		expect(fetcher).toHaveBeenCalledTimes(10);
		expect(r).toHaveLength(10);
	});

	it('encodes ISO timestamps in $filter', async () => {
		const fetcher = vi.fn().mockResolvedValueOnce({ value: [] });
		await fetchDirectoryAudits(fetcher, new Date('2026-04-27T00:00:00Z'), new Date('2026-04-27T01:00:00Z'));
		const path = fetcher.mock.calls[0][0] as string;
		expect(path).toContain('activityDateTime%20ge%202026-04-27T00%3A00%3A00.000Z');
		expect(path).toContain('activityDateTime%20le%202026-04-27T01%3A00%3A00.000Z');
	});
});

describe('actorFor', () => {
	it('prefers userPrincipalName', () => {
		expect(actorFor(entry({
			initiatedBy: { user: { userPrincipalName: 'a@x.com', displayName: 'A' } },
		}))).toBe('a@x.com');
	});

	it('falls back to user displayName', () => {
		expect(actorFor(entry({ initiatedBy: { user: { displayName: 'A Admin' } } }))).toBe('A Admin');
	});

	it('falls back to app displayName', () => {
		expect(actorFor(entry({ initiatedBy: { app: { displayName: 'AutomationApp' } } }))).toBe('AutomationApp');
	});

	it('returns "unknown" when nothing identifiable', () => {
		expect(actorFor(entry({ initiatedBy: {} }))).toBe('unknown');
	});
});
