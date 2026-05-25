import { describe, expect, it } from 'vitest';
import { reconstruct } from './timewarp';

describe('timewarp.reconstruct', () => {
	it('returns null state when no snapshot precedes the target', () => {
		const r = reconstruct({
			tenantId: 't-1', at: 1000,
			snapshot: null, drifts: [], audits: [],
		});
		expect(r.state).toBeNull();
		expect(r.driftsApplied).toBe(0);
		expect(r.narrative[0]).toMatch(/no config_snapshot/i);
	});

	it('parses snapshot payload and reports zero drifts when none in window', () => {
		const r = reconstruct({
			tenantId: 't-1', at: 2000,
			snapshot: { id: 's1', captured_at: '2026-01-01T00:00:00Z', payload: '{"users":42}' },
			drifts: [], audits: [],
		});
		expect(r.state).toEqual({ users: 42 });
		expect(r.driftsApplied).toBe(0);
	});

	it('applies drifts in chronological order, mutating the category bucket', () => {
		const r = reconstruct({
			tenantId: 't-1', at: Date.parse('2026-03-01T12:00:00Z'),
			snapshot: { id: 's1', captured_at: '2026-01-01T00:00:00Z', payload: '{"conditionalAccess":{"policies":1}}' },
			drifts: [
				{ id: 'd1', category: 'conditionalAccess', severity: 'high',
					summary: 'Block legacy auth → report-only', metadata: null,
					detected_at: '2026-02-01T00:00:00Z' },
			],
			audits: [],
		});
		expect(r.driftsApplied).toBe(1);
		const ca = r.state!.conditionalAccess as Record<string, unknown>;
		expect(ca.lastChange).toMatch(/legacy auth/i);
	});

	it('skips drifts that occurred AFTER the target timestamp', () => {
		const r = reconstruct({
			tenantId: 't-1', at: Date.parse('2026-02-15T00:00:00Z'),
			snapshot: { id: 's1', captured_at: '2026-01-01T00:00:00Z', payload: '{}' },
			drifts: [
				{ id: 'd1', category: 'authMethods', severity: 'high', summary: 'Pre-window', metadata: null, detected_at: '2026-02-01T00:00:00Z' },
				{ id: 'd2', category: 'authMethods', severity: 'high', summary: 'Post-window — should NOT apply', metadata: null, detected_at: '2026-02-20T00:00:00Z' },
			],
			audits: [],
		});
		expect(r.driftsApplied).toBe(1);
		const am = r.state!.authMethods as Record<string, unknown>;
		expect(am.lastChange).toMatch(/Pre-window/);
	});

	it('summarises audit narrative — first 5 + +N more', () => {
		const r = reconstruct({
			tenantId: 't-1', at: 9999,
			snapshot: { id: 's1', captured_at: '2026-01-01T00:00:00Z', payload: '{}' },
			drifts: [],
			audits: Array.from({ length: 8 }, (_, i) => ({
				actor: `u-${i}`, action: 'login', resource_type: null, created_at: `2026-02-0${i + 1}T00:00:00Z`,
			})),
		});
		expect(r.auditEvents).toBe(8);
		expect(r.narrative.some((l) => /\+3 more/.test(l))).toBe(true);
	});
});
