import { describe, expect, it, vi } from 'vitest';
import { runRemediation, type GraphFn, type RemediationPlan } from './auto-remediator';

function makePlan(overrides: Partial<RemediationPlan> = {}): RemediationPlan {
	return {
		tenantId: 't-1',
		orgId: 'org-1',
		findingId: 'CIS-1.1',
		severity: 'high',
		target: { method: 'PATCH', path: '/policies/123', body: { value: 'safe' } },
		baselinePath: '/policies/123',
		watchSeconds: 0, // no real wait in tests
		...overrides,
	};
}

function makeEnv(alertCounts: { recent: number; baseline: number } = { recent: 0, baseline: 0 }) {
	const first = vi.fn();
	first
		.mockResolvedValueOnce({ n: alertCounts.recent })
		.mockResolvedValueOnce({ n: alertCounts.baseline });
	const bind = vi.fn().mockReturnValue({ first });
	const prepare = vi.fn().mockReturnValue({ bind });
	const run = vi.fn().mockResolvedValue({});
	bind.mockReturnValue({ first, run });
	return { DB: { prepare } as any, tenantId: 't-1' };
}

describe('auto-remediator', () => {
	it('applies the fix and does not roll back when the audit log is clean', async () => {
		const calls: Array<{ method: string; path: string }> = [];
		const graph: GraphFn = vi.fn().mockImplementation(async (method, path) => {
			calls.push({ method, path });
			return { ok: true, status: 200, body: { value: 'previous' } };
		});

		const result = await runRemediation(makeEnv(), makePlan(), graph);

		expect(result.applied).toBe(true);
		expect(result.rolledBack).toBe(false);
		expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH']); // baseline + apply, no rollback
	});

	it('rolls back when ≥3 new critical/high alerts spike vs baseline', async () => {
		const calls: Array<{ method: string; path: string }> = [];
		const graph: GraphFn = vi.fn().mockImplementation(async (method, path) => {
			calls.push({ method, path });
			return { ok: true, status: 200, body: { value: 'previous' } };
		});

		const env = makeEnv({ recent: 9, baseline: 1 });
		const result = await runRemediation(env, makePlan(), graph);

		expect(result.applied).toBe(true);
		expect(result.rolledBack).toBe(true);
		expect(result.reason).toMatch(/anomaly/i);
		// GET + PATCH (apply) + PATCH (rollback)
		expect(calls).toHaveLength(3);
		expect(calls[2].method).toBe('PATCH');
	});

	it('does NOT apply if baseline-capture fails', async () => {
		const graph: GraphFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });
		const result = await runRemediation(makeEnv(), makePlan(), graph);
		expect(result.applied).toBe(false);
		expect(result.rolledBack).toBe(false);
		expect(result.reason).toMatch(/baseline-capture failed/i);
		// Only the GET attempt was made, no PATCH
		expect(graph).toHaveBeenCalledTimes(1);
	});

	it('reports failed apply and skips rollback', async () => {
		let callIdx = 0;
		const graph: GraphFn = vi.fn().mockImplementation(async () => {
			callIdx++;
			if (callIdx === 1) return { ok: true, status: 200, body: {} }; // baseline
			return { ok: false, status: 500 }; // apply fails
		});
		const result = await runRemediation(makeEnv(), makePlan(), graph);
		expect(result.applied).toBe(false);
		expect(result.reason).toMatch(/apply failed/i);
	});

	it('dry-run captures baseline and skips the mutation', async () => {
		const calls: Array<{ method: string }> = [];
		const graph: GraphFn = vi.fn().mockImplementation(async (method) => {
			calls.push({ method });
			return { ok: true, status: 200, body: { value: 'previous' } };
		});
		const result = await runRemediation(makeEnv(), makePlan({ dryRun: true }), graph);
		expect(result.applied).toBe(false);
		expect(result.rolledBack).toBe(false);
		expect(result.reason).toMatch(/awaiting approval/i);
		expect(calls).toEqual([{ method: 'GET' }]); // only the baseline GET, no PATCH
	});

	it('treats DB read failure as clean (no false rollback)', async () => {
		const graph: GraphFn = vi.fn().mockResolvedValue({ ok: true, status: 200, body: {} });
		const env = {
			DB: {
				prepare: () => ({ bind: () => ({ first: () => Promise.reject(new Error('DB down')), run: () => Promise.resolve({}) }) }),
			} as any,
			tenantId: 't-1',
		};
		const result = await runRemediation(env, makePlan(), graph);
		expect(result.rolledBack).toBe(false);
	});
});
